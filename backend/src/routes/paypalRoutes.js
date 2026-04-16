const express = require('express');
const router = express.Router();
const paypalService = require('../services/paypalService');
const subscriptionStoreService = require('../services/subscriptionStoreService');

// Store for temporary subscription data (in production, use Redis or database)
const subscriptionStore = new Map();
const MONTHLY_PLAN_ID = process.env.PAYPAL_MONTHLY_PLAN_ID || 'P-86B36697AH868180CNHQCGWI';
const YEARLY_PLAN_ID = process.env.PAYPAL_YEARLY_PLAN_ID || 'P-2UF78835G6687705SMZC3NRI';

function getPlanMetadata(planId) {
    if (planId === YEARLY_PLAN_ID) {
        return {
            type: 'yearly',
            amount: '£29.99'
        };
    }

    if (planId === MONTHLY_PLAN_ID) {
        return {
            type: 'monthly',
            amount: '£1.99'
        };
    }

    return {
        type: 'monthly',
        amount: '£1.99'
    };
}

function resolveSubscriptionStatus(paypalStatus) {
    return String(paypalStatus || '').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
}

function isOverdueByOneMonth(nextBillingTime) {
    if (!nextBillingTime) return false;
    const nextBilling = new Date(nextBillingTime).getTime();
    if (Number.isNaN(nextBilling)) return false;
    const now = Date.now();
    const graceMs = 30 * 24 * 60 * 60 * 1000;
    return now > (nextBilling + graceMs);
}

async function syncSubscriptionToDynamo({ subscriptionId, email, userId }) {
    const subscription = await paypalService.getSubscription(subscriptionId);

    let status = resolveSubscriptionStatus(subscription.status);
    const nextBillingTime = subscription.billing_info?.next_billing_time || null;
    const lastPayment = subscription.billing_info?.last_payment || null;

    // Business rule: if payment overdue for one month, mark inactive and cancel.
    if (status === 'ACTIVE' && isOverdueByOneMonth(nextBillingTime)) {
        try {
            await paypalService.cancelSubscription(subscriptionId, 'No payment received for over one month');
        } catch (cancelError) {
            console.warn('Unable to auto-cancel overdue subscription:', cancelError.message);
        }
        status = 'INACTIVE';
    }

    const updatedUser = await subscriptionStoreService.upsertSubscription({
        email,
        userId,
        subscriptionId,
        planId: subscription.plan_id,
        status,
        nextBillingTime,
        lastPaymentTime: lastPayment?.time || null,
        lastPaymentAmount: lastPayment?.amount?.value || null,
        lastPaymentCurrency: lastPayment?.amount?.currency_code || null,
        source: 'paypal-api'
    });

    if (lastPayment?.time) {
        await subscriptionStoreService.addPaymentRecord({
            email,
            userId: updatedUser?.id,
            subscriptionId,
            amount: lastPayment?.amount?.value || null,
            currency: lastPayment?.amount?.currency_code || null,
            paidAt: lastPayment.time,
            transactionId: `paypal_last_payment_${subscriptionId}`,
            status: 'COMPLETED',
            source: 'paypal-api'
        });
    }

    return {
        subscription,
        persistedStatus: status,
        user: updatedUser
    };
}

// Create subscription
router.post('/create-subscription', async (req, res) => {
    try {
        const { planId, userEmail } = req.body;

        if (!planId || !userEmail) {
            return res.status(400).json({
                success: false,
                message: 'Plan ID and user email are required'
            });
        }

        const subscriptionData = {
            plan_id: planId,
            start_time: new Date(Date.now() + 60000).toISOString(), // Start in 1 minute
            quantity: "1",
            shipping_amount: {
                currency_code: "GBP",
                value: "0.00"
            },
            subscriber: {
                name: {
                    given_name: userEmail.split('@')[0],
                    surname: "User"
                },
                email_address: userEmail
            },
            application_context: {
                brand_name: "FunStudy 11 Plus",
                locale: "en-GB",
                shipping_preference: "NO_SHIPPING",
                user_action: "SUBSCRIBE_NOW",
                payment_method: {
                    payer_selected: "PAYPAL",
                    payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
                },
                return_url: `${process.env.FRONTEND_URL || 'https://funstudy-snowy.vercel.app'}/subscription-success`,
                cancel_url: `${process.env.FRONTEND_URL || 'https://funstudy-snowy.vercel.app'}/subscription-cancelled`
            }
        };

        const subscription = await paypalService.createSubscription(subscriptionData);
        
        // Store subscription info temporarily
        subscriptionStore.set(subscription.id, {
            userEmail,
            createdAt: Date.now()
        });

        // Clean up old entries (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [id, data] of subscriptionStore.entries()) {
            if (data.createdAt < oneHourAgo) {
                subscriptionStore.delete(id);
            }
        }

        res.json({
            success: true,
            subscriptionId: subscription.id,
            approvalUrl: subscription.links.find(link => link.rel === 'approve')?.href
        });

    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create subscription',
            error: error.message
        });
    }
});

// Get subscription status
router.get('/subscription/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const subscription = await paypalService.getSubscription(id);
        
        res.json({
            success: true,
            subscription: {
                id: subscription.id,
                status: subscription.status,
                planId: subscription.plan_id,
                startTime: subscription.start_time,
                nextBillingTime: subscription.billing_info?.next_billing_time,
                subscriber: subscription.subscriber
            }
        });

    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription',
            error: error.message
        });
    }
});

// Confirm and persist subscription after frontend PayPal approval
router.post('/confirm-subscription', async (req, res) => {
    try {
        const { subscriptionId, email } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'subscriptionId is required'
            });
        }

        const userEmail = req.session?.user?.email || email;
        const userId = req.session?.user?.sub || null;

        const result = await syncSubscriptionToDynamo({
            subscriptionId,
            email: userEmail,
            userId
        });
        const planMetadata = getPlanMetadata(result.subscription.plan_id);

        res.json({
            success: true,
            subscription: {
                id: result.subscription.id,
                planId: result.subscription.plan_id,
                type: planMetadata.type,
                amount: planMetadata.amount,
                paypalStatus: result.subscription.status,
                status: result.persistedStatus,
                nextBillingTime: result.subscription.billing_info?.next_billing_time || null,
                lastPaymentTime: result.subscription.billing_info?.last_payment?.time || null
            }
        });
    } catch (error) {
        console.error('Confirm subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm subscription',
            error: error.message
        });
    }
});

// Returns effective subscription status for current logged-in user
router.get('/subscription-status', async (req, res) => {
    try {
        const userEmail = req.session?.user?.email || req.query.email;
        if (!userEmail) {
            return res.status(401).json({
                success: false,
                message: 'No authenticated user context for subscription lookup'
            });
        }

        const user = await subscriptionStoreService.findUserByEmail(userEmail);
        if (!user || !user.subscriptionId) {
            return res.json({
                success: true,
                isSubscribed: false,
                status: 'INACTIVE'
            });
        }

        const syncResult = await syncSubscriptionToDynamo({
            subscriptionId: user.subscriptionId,
            email: userEmail,
            userId: user.id
        });
        const planMetadata = getPlanMetadata(syncResult.subscription.plan_id);

        const active = syncResult.persistedStatus === 'ACTIVE';

        res.json({
            success: true,
            isSubscribed: active,
            status: syncResult.persistedStatus,
            subscriptionId: user.subscriptionId,
            planId: syncResult.subscription.plan_id,
            type: planMetadata.type,
            amount: planMetadata.amount,
            nextBillingTime: syncResult.subscription.billing_info?.next_billing_time || null,
            lastPaymentTime: syncResult.subscription.billing_info?.last_payment?.time || null
        });
    } catch (error) {
        console.error('Subscription status lookup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription status',
            error: error.message
        });
    }
});

// Cancel subscription
router.post('/subscription/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const cancelled = await paypalService.cancelSubscription(id, reason);
        
        if (cancelled) {
            res.json({
                success: true,
                message: 'Subscription cancelled successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to cancel subscription'
            });
        }

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription',
            error: error.message
        });
    }
});

// Get available plans
router.get('/plans', async (req, res) => {
    try {
        // In a real application, you might store these in a database
        // For now, we'll return hardcoded plan information
        const plans = [
            {
                id: MONTHLY_PLAN_ID,
                name: "FunStudy Monthly Premium",
                description: "Monthly subscription to FunStudy 11 Plus Premium features",
                price: "1.99",
                currency: "GBP",
                interval: "month",
                features: [
                    "Access to all Grade A, B & C quizzes",
                    "Unlimited quiz attempts",
                    "Detailed performance analytics",
                    "Progress tracking",
                    "Subject-specific practice",
                    "Premium support"
                ]
            },
            {
                id: YEARLY_PLAN_ID,
                name: "FunStudy Annual Premium",
                description: "Annual subscription to FunStudy 11 Plus Premium features",
                price: "29.99",
                currency: "GBP",
                interval: "year",
                features: [
                    "Access to all Grade A, B & C quizzes",
                    "Unlimited quiz attempts",
                    "Detailed performance analytics",
                    "Progress tracking",
                    "Subject-specific practice",
                    "Premium support"
                ]
            }
        ];

        res.json({
            success: true,
            plans
        });

    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get plans',
            error: error.message
        });
    }
});

// Initialize PayPal products (admin endpoint)
router.post('/admin/initialize', async (req, res) => {
    try {
        const result = await paypalService.initializeFunStudyProducts();
        
        res.json({
            success: true,
            message: 'PayPal products and plans initialized successfully',
            data: result
        });

    } catch (error) {
        console.error('Initialize products error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to initialize products',
            error: error.message
        });
    }
});

// Webhook endpoint for PayPal events
router.post('/webhook', async (req, res) => {
    try {
        const event = req.body;
        console.log('PayPal webhook received:', event.event_type);

        switch (event.event_type) {
            case 'BILLING.SUBSCRIPTION.CREATED':
                console.log('Subscription created:', event.resource.id);
                // Handle subscription creation
                break;

            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                console.log('Subscription activated:', event.resource.id);
                // Handle subscription activation - grant access to user
                const userData = subscriptionStore.get(event.resource.id);
                const activationEmail = userData?.userEmail || event.resource.subscriber?.email_address || null;
                if (activationEmail) {
                    console.log('Granting access to user:', activationEmail);
                    await subscriptionStoreService.upsertSubscription({
                        email: activationEmail,
                        subscriptionId: event.resource.id,
                        planId: event.resource.plan_id,
                        status: 'ACTIVE',
                        nextBillingTime: event.resource.billing_info?.next_billing_time || null,
                        lastPaymentTime: event.resource.billing_info?.last_payment?.time || null,
                        lastPaymentAmount: event.resource.billing_info?.last_payment?.amount?.value || null,
                        lastPaymentCurrency: event.resource.billing_info?.last_payment?.amount?.currency_code || null,
                        source: 'paypal-webhook'
                    });
                }
                if (userData) {
                    subscriptionStore.delete(event.resource.id);
                }
                break;

            case 'BILLING.SUBSCRIPTION.UPDATED':
                await subscriptionStoreService.upsertSubscription({
                    subscriptionId: event.resource.id,
                    planId: event.resource.plan_id,
                    status: resolveSubscriptionStatus(event.resource.status),
                    nextBillingTime: event.resource.billing_info?.next_billing_time || null,
                    lastPaymentTime: event.resource.billing_info?.last_payment?.time || null,
                    lastPaymentAmount: event.resource.billing_info?.last_payment?.amount?.value || null,
                    lastPaymentCurrency: event.resource.billing_info?.last_payment?.amount?.currency_code || null,
                    source: 'paypal-webhook'
                });
                break;

            case 'BILLING.SUBSCRIPTION.CANCELLED':
                console.log('Subscription cancelled:', event.resource.id);
                // Handle subscription cancellation - revoke access
                await subscriptionStoreService.upsertSubscription({
                    subscriptionId: event.resource.id,
                    planId: event.resource.plan_id,
                    status: 'INACTIVE',
                    source: 'paypal-webhook'
                });
                break;

            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                console.log('Subscription payment failed:', event.resource.id);
                // Handle payment failure
                await subscriptionStoreService.upsertSubscription({
                    subscriptionId: event.resource.id,
                    planId: event.resource.plan_id,
                    status: 'INACTIVE',
                    source: 'paypal-webhook'
                });
                break;

            case 'BILLING.SUBSCRIPTION.EXPIRED':
                console.log('Subscription expired:', event.resource.id);
                // Handle subscription expiration
                await subscriptionStoreService.upsertSubscription({
                    subscriptionId: event.resource.id,
                    planId: event.resource.plan_id,
                    status: 'INACTIVE',
                    source: 'paypal-webhook'
                });
                break;

            case 'PAYMENT.SALE.COMPLETED':
                console.log('Subscription payment completed:', event.resource.id);
                await subscriptionStoreService.addPaymentRecord({
                    subscriptionId: event.resource.billing_agreement_id || event.resource.subscription_id,
                    amount: event.resource.amount?.total || event.resource.amount?.value || null,
                    currency: event.resource.amount?.currency || event.resource.amount?.currency_code || null,
                    paidAt: event.resource.create_time || new Date().toISOString(),
                    transactionId: event.resource.id,
                    status: 'COMPLETED',
                    source: 'paypal-webhook'
                });
                break;

            default:
                console.log('Unhandled webhook event:', event.event_type);
        }

        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

module.exports = router;