const express = require('express');
const router = express.Router();
const paypalService = require('../services/paypalService');
const subscriptionStoreService = require('../services/subscriptionStoreService');

// Store for temporary subscription data (in production, use Redis or database)
const subscriptionStore = new Map();
const MONTHLY_PLAN_ID = process.env.PAYPAL_MONTHLY_PLAN_ID || 'P-40D15785KF4126507NHQPRZY';
const YEARLY_PLAN_ID = process.env.PAYPAL_YEARLY_PLAN_ID || 'P-8Y97299421124160VNHQPS7Y';
const MONTHLY_PLAN_PRICE = process.env.PAYPAL_MONTHLY_PLAN_PRICE || '0.01';
const YEARLY_PLAN_PRICE = process.env.PAYPAL_YEARLY_PLAN_PRICE || '0.02';

function getPlanMetadata(planId) {
    if (planId === YEARLY_PLAN_ID) {
        return {
            type: "yearly",
            amount: "£" + YEARLY_PLAN_PRICE
        };
    }

    if (planId === MONTHLY_PLAN_ID) {
        return {
            type: "monthly",
            amount: "£" + MONTHLY_PLAN_PRICE
        };
    }

    return {
        type: "monthly",
        amount: "£" + MONTHLY_PLAN_PRICE
    };
}

function resolveSubscriptionStatus(paypalStatus, previousStatus) {
    const status = String(paypalStatus || '').toUpperCase();

    if (status === 'ACTIVE') return 'ACTIVE';

    // Only treat terminal states as inactive.
    if (['CANCELLED', 'EXPIRED', 'SUSPENDED'].includes(status)) {
        return 'INACTIVE';
    }

    // Keep active state for pending/transitional statuses to avoid false downgrades.
    if (previousStatus === 'ACTIVE') {
        return 'ACTIVE';
    }

    return 'INACTIVE';
}

function isOverdueByOneMonth(nextBillingTime) {
    if (!nextBillingTime) return false;
    const nextBilling = new Date(nextBillingTime).getTime();
    if (Number.isNaN(nextBilling)) return false;
    const now = Date.now();
    const graceMs = 30 * 24 * 60 * 60 * 1000;
    return now > (nextBilling + graceMs);
}

function computeFallbackNextBillingTime(planType) {
    const next = new Date();
    if (planType === 'yearly') {
        next.setFullYear(next.getFullYear() + 1);
    } else {
        next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString();
}

async function syncSubscriptionToDynamo({ subscriptionId, email, userId, previousStatus }) {
    const subscription = await paypalService.getSubscription(subscriptionId);

    let status = resolveSubscriptionStatus(subscription.status, previousStatus);
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
        const {
            subscriptionId,
            email,
            userId: requestedUserId,
            planId: requestedPlanId,
            planType: requestedPlanType,
            amount: requestedAmount,
            currency: requestedCurrency
        } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({
                success: false,
                message: 'subscriptionId is required'
            });
        }

        const userEmail = req.session?.user?.email || email || null;
        const userId = req.session?.user?.sub || requestedUserId || null;

        if (!userEmail && !userId) {
            return res.status(400).json({
                success: false,
                message: 'User email or ID is required to persist subscription'
            });
        }

        // Primary action: write subscription as ACTIVE immediately.
        // The user has just approved it via PayPal SDK, so we trust the approval.
        // Then attempt PayPal API verification as best-effort enrichment.
        let planId = null;
        let nextBillingTime = null;
        let lastPaymentTime = null;
        let lastPaymentAmount = null;
        let lastPaymentCurrency = null;
        let paypalStatus = 'ACTIVE';

        try {
            const subscription = await paypalService.getSubscription(subscriptionId);
            planId = subscription.plan_id || null;
            paypalStatus = subscription.status || 'ACTIVE';
            nextBillingTime = subscription.billing_info?.next_billing_time || null;
            const lastPayment = subscription.billing_info?.last_payment || null;
            lastPaymentTime = lastPayment?.time || null;
            lastPaymentAmount = lastPayment?.amount?.value || null;
            lastPaymentCurrency = lastPayment?.amount?.currency_code || null;
            console.log('PayPal subscription details fetched:', { planId, paypalStatus, nextBillingTime });
        } catch (paypalApiError) {
            // PayPal API unavailable or credentials not set – persist with available info
            console.warn('PayPal API verification failed, persisting with user-provided data:', paypalApiError.message);
        }

        // Resolve plan and payment metadata even when PayPal API details are delayed/unavailable.
        const resolvedPlanId = planId || requestedPlanId || null;
        const planMetadata = getPlanMetadata(resolvedPlanId);
        const resolvedPlanType = requestedPlanType || planMetadata.type || 'monthly';
        const resolvedCurrency = lastPaymentCurrency || requestedCurrency || 'GBP';
        const resolvedAmount =
            lastPaymentAmount ||
            (requestedAmount != null ? String(requestedAmount) : null) ||
            (planMetadata.amount ? String(planMetadata.amount).replace('£', '') : null);

        if (!lastPaymentTime) {
            lastPaymentTime = new Date().toISOString();
        }

        if (!nextBillingTime) {
            nextBillingTime = computeFallbackNextBillingTime(resolvedPlanType);
        }

        const persistedUser = await subscriptionStoreService.upsertSubscription({
            email: userEmail,
            userId,
            subscriptionId,
            planId: resolvedPlanId,
            status: 'ACTIVE',
            nextBillingTime,
            lastPaymentTime,
            lastPaymentAmount: resolvedAmount,
            lastPaymentCurrency: resolvedCurrency,
            source: 'paypal-frontend-approval'
        });

        try {
            await subscriptionStoreService.addPaymentRecord({
                email: userEmail,
                userId: persistedUser?.id || userId,
                subscriptionId,
                amount: resolvedAmount,
                currency: resolvedCurrency,
                paidAt: lastPaymentTime,
                transactionId: `paypal_approval_${subscriptionId}`,
                status: 'COMPLETED',
                source: 'paypal-frontend-approval'
            });
        } catch (paymentRecordError) {
            console.warn('Unable to append initial payment record:', paymentRecordError.message);
        }

        console.log('Subscription persisted for user:', persistedUser?.id || userId || userEmail);

        res.json({
            success: true,
            subscription: {
                id: subscriptionId,
                planId: resolvedPlanId,
                type: resolvedPlanType,
                amount: resolvedAmount ? `£${resolvedAmount}` : planMetadata.amount,
                paypalStatus,
                status: 'ACTIVE',
                nextBillingTime,
                lastPaymentTime
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

        let resolvedStatus = user.subscriptionStatus || (user.isSubscribed ? 'ACTIVE' : 'INACTIVE');
        let resolvedPlanId = user.subscriptionPlanId || null;
        let resolvedNextBillingTime = user.subscriptionNextBillingTime || null;
        let resolvedLastPaymentTime = user.subscriptionLastPaymentTime || null;

        try {
            const syncResult = await syncSubscriptionToDynamo({
                subscriptionId: user.subscriptionId,
                email: userEmail,
                userId: user.id,
                previousStatus: resolvedStatus
            });

            resolvedStatus = syncResult.persistedStatus;
            resolvedPlanId = syncResult.subscription.plan_id || resolvedPlanId;
            resolvedNextBillingTime = syncResult.subscription.billing_info?.next_billing_time || resolvedNextBillingTime;
            resolvedLastPaymentTime = syncResult.subscription.billing_info?.last_payment?.time || resolvedLastPaymentTime;
        } catch (syncError) {
            console.warn('Subscription status sync fallback (using stored DynamoDB state):', syncError.message);
        }

        const planMetadata = getPlanMetadata(resolvedPlanId);
        const active = resolvedStatus === 'ACTIVE';

        res.json({
            success: true,
            isSubscribed: active,
            status: resolvedStatus,
            subscriptionId: user.subscriptionId,
            planId: resolvedPlanId,
            type: planMetadata.type,
            amount: planMetadata.amount,
            nextBillingTime: resolvedNextBillingTime,
            lastPaymentTime: resolvedLastPaymentTime
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
        const requestedEmail = req.body?.email || null;
        const requestedUserId = req.body?.userId || null;
        const sessionEmail = req.session?.user?.email || null;
        const sessionUserId = req.session?.user?.sub || null;

        let cancelled = false;
        let paypalCancelError = null;
        let refundResult = null;
        let refundError = null;

        try {
            cancelled = await paypalService.cancelSubscription(id, reason);
        } catch (err) {
            paypalCancelError = err;
            console.warn('PayPal cancel call failed, applying local downgrade fallback:', err.message);
        }

        const existing = await subscriptionStoreService.findUserBySubscriptionId(id);
        await subscriptionStoreService.upsertSubscription({
            email: sessionEmail || requestedEmail || existing?.email || null,
            userId: sessionUserId || requestedUserId || existing?.id || null,
            subscriptionId: id,
            planId: existing?.subscriptionPlanId || null,
            status: 'INACTIVE',
            nextBillingTime: null,
            source: cancelled ? 'paypal-api-cancel' : 'paypal-local-fallback-cancel'
        });

        // Attempt to refund the most recent transaction for this subscription
        if (cancelled) {
            try {
                const txns = await paypalService.getSubscriptionTransactions(id);
                const completedTxns = (txns?.transactions || []).filter(t => t.status === 'COMPLETED');
                if (completedTxns.length > 0) {
                    const latest = completedTxns.sort((a, b) =>
                        new Date(b.time || 0) - new Date(a.time || 0)
                    )[0];
                    const captureId = latest.id;
                    const amount = latest.amount_with_breakdown?.gross_amount?.value || null;
                    const currency = latest.amount_with_breakdown?.gross_amount?.currency_code || 'GBP';
                    console.log('Attempting refund for capture:', captureId, amount, currency);
                    refundResult = await paypalService.refundCapture(captureId, amount, currency,
                        'Refund on subscription cancellation');
                    console.log('Refund successful:', refundResult?.id);
                    await subscriptionStoreService.addPaymentRecord({
                        email: sessionEmail || requestedEmail || existing?.email || null,
                        userId: sessionUserId || requestedUserId || existing?.id || null,
                        subscriptionId: id,
                        amount: amount ? `-${amount}` : null,
                        currency,
                        paidAt: new Date().toISOString(),
                        transactionId: refundResult?.id || `refund_${captureId}`,
                        status: 'REFUNDED',
                        source: 'paypal-api-refund'
                    });
                } else {
                    console.log('No completed transactions found to refund for subscription:', id);
                }
            } catch (err) {
                refundError = err;
                console.warn('Refund attempt failed:', err.message);
            }
        }

        const responseMessage = cancelled
            ? (refundResult
                ? 'Subscription cancelled and last payment refunded successfully.'
                : `Subscription cancelled. ${refundError ? 'Refund could not be processed automatically: ' + refundError.message : 'No payment found to refund.'}`)
            : 'Subscription access removed. PayPal cancellation could not be confirmed — please also cancel from your PayPal account.';

        return res.json({
            success: true,
            message: responseMessage,
            refunded: !!refundResult,
            refundId: refundResult?.id || null,
            ...(paypalCancelError && { cancelWarning: paypalCancelError.message }),
            ...(refundError && { refundWarning: refundError.message })
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription',
            error: error.message
        });
    }
});

// Get available plans (fetches live prices from PayPal API, falls back to env vars)
router.get('/plans', async (req, res) => {
    try {
        // Try to get live prices from PayPal API
        let monthlyPrice = MONTHLY_PLAN_PRICE;
        let yearlyPrice = YEARLY_PLAN_PRICE;

        try {
            const [monthlyPlan, yearlyPlan] = await Promise.all([
                paypalService.getPlan(MONTHLY_PLAN_ID),
                paypalService.getPlan(YEARLY_PLAN_ID)
            ]);

            const extractPrice = (plan) => {
                const cycles = plan?.billing_cycles || [];
                for (const cycle of cycles) {
                    if (cycle.pricing_scheme?.fixed_price?.value) {
                        return cycle.pricing_scheme.fixed_price.value;
                    }
                }
                return null;
            };

            const liveMonthly = extractPrice(monthlyPlan);
            const liveYearly = extractPrice(yearlyPlan);
            if (liveMonthly) monthlyPrice = liveMonthly;
            if (liveYearly) yearlyPrice = liveYearly;
            console.log('Fetched live PayPal plan prices:', { monthlyPrice, yearlyPrice });
        } catch (paypalPriceError) {
            console.warn('Could not fetch live plan prices from PayPal, using env vars:', paypalPriceError.message);
        }

        const plans = [
            {
                id: MONTHLY_PLAN_ID,
                name: "FunStudy Monthly Premium",
                description: "Monthly subscription to FunStudy 11 Plus Premium features",
                price: monthlyPrice,
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
                price: yearlyPrice,
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

            case 'PAYMENT.SALE.REFUNDED':
                console.log('Subscription payment refunded:', event.resource.id);
                await subscriptionStoreService.addPaymentRecord({
                    subscriptionId: event.resource.billing_agreement_id || event.resource.subscription_id,
                    amount: event.resource.amount?.total || event.resource.amount?.value || null,
                    currency: event.resource.amount?.currency || event.resource.amount?.currency_code || null,
                    paidAt: event.resource.update_time || event.resource.create_time || new Date().toISOString(),
                    transactionId: event.resource.id,
                    status: 'REFUNDED',
                    source: 'paypal-webhook'
                });

                if (event.resource.billing_agreement_id || event.resource.subscription_id) {
                    await subscriptionStoreService.upsertSubscription({
                        subscriptionId: event.resource.billing_agreement_id || event.resource.subscription_id,
                        status: 'INACTIVE',
                        source: 'paypal-webhook-refund'
                    });
                }
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