const express = require('express');
const router = express.Router();
const paypalService = require('../services/paypalService');

// Store for temporary subscription data (in production, use Redis or database)
const subscriptionStore = new Map();

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
                id: process.env.PAYPAL_YEARLY_PLAN_ID,
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
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
                if (userData) {
                    console.log('Granting access to user:', userData.userEmail);
                    // Here you would update your user database to grant premium access
                    subscriptionStore.delete(event.resource.id);
                }
                break;

            case 'BILLING.SUBSCRIPTION.CANCELLED':
                console.log('Subscription cancelled:', event.resource.id);
                // Handle subscription cancellation - revoke access
                break;

            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                console.log('Subscription payment failed:', event.resource.id);
                // Handle payment failure
                break;

            case 'BILLING.SUBSCRIPTION.EXPIRED':
                console.log('Subscription expired:', event.resource.id);
                // Handle subscription expiration
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