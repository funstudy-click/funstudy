const axios = require('axios');

class PayPalService {
    constructor() {
        this.clientId = process.env.PAYPAL_CLIENT_ID;
        this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
        this.baseUrl = process.env.NODE_ENV === 'production' 
            ? 'https://api-m.paypal.com' 
            : 'https://api-m.sandbox.paypal.com';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    getConfigSummary() {
        return {
            nodeEnv: process.env.NODE_ENV || null,
            baseUrl: this.baseUrl,
            hasClientId: !!this.clientId,
            hasClientSecret: !!this.clientSecret,
            clientIdPrefix: this.clientId ? this.clientId.slice(0, 6) : null,
            clientIdSuffix: this.clientId ? this.clientId.slice(-6) : null,
            clientSecretLength: this.clientSecret ? this.clientSecret.length : 0
        };
    }

    async debugAccessToken() {
        const summary = this.getConfigSummary();

        try {
            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const response = await axios({
                method: 'POST',
                url: `${this.baseUrl}/v1/oauth2/token`,
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en_US',
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: 'grant_type=client_credentials'
            });

            return {
                ok: true,
                summary,
                tokenType: response.data?.token_type || null,
                expiresIn: response.data?.expires_in || null,
                scope: response.data?.scope || null
            };
        } catch (error) {
            return {
                ok: false,
                summary,
                status: error.response?.status || null,
                paypalError: error.response?.data || null,
                message: error.message
            };
        }
    }

    async getAccessToken() {
        // Check if we have a valid token
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            
            const response = await axios({
                method: 'POST',
                url: `${this.baseUrl}/v1/oauth2/token`,
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'en_US',
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: 'grant_type=client_credentials'
            });

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000 - 60000); // Refresh 1 min early

            return this.accessToken;
        } catch (error) {
            console.error('PayPal token error:', error.response?.data || error.message);
            throw new Error('Failed to get PayPal access token');
        }
    }

    async createProduct(productData) {
        const token = await this.getAccessToken();
        
        try {
            const response = await axios({
                method: 'POST',
                url: `${this.baseUrl}/v1/catalogs/products`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'PayPal-Request-Id': `PRODUCT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                },
                data: productData
            });

            return response.data;
        } catch (error) {
            console.error('PayPal create product error:', error.response?.data || error.message);
            throw error;
        }
    }

    async createSubscriptionPlan(planData) {
        const token = await this.getAccessToken();
        
        try {
            const response = await axios({
                method: 'POST',
                url: `${this.baseUrl}/v1/billing/plans`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'PayPal-Request-Id': `PLAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                },
                data: planData
            });

            return response.data;
        } catch (error) {
            console.error('PayPal create plan error:', error.response?.data || error.message);
            throw error;
        }
    }

    async createSubscription(subscriptionData) {
        const token = await this.getAccessToken();
        
        try {
            const response = await axios({
                method: 'POST',
                url: `${this.baseUrl}/v1/billing/subscriptions`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'PayPal-Request-Id': `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                },
                data: subscriptionData
            });

            return response.data;
        } catch (error) {
            console.error('PayPal create subscription error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getSubscription(subscriptionId) {
        const token = await this.getAccessToken();
        
        try {
            const response = await axios({
                method: 'GET',
                url: `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            return response.data;
        } catch (error) {
            console.error('PayPal get subscription error:', error.response?.data || error.message);
            throw error;
        }
    }

    async getPlan(planId) {
        const token = await this.getAccessToken();

        try {
            const response = await axios({
                method: 'GET',
                url: `${this.baseUrl}/v1/billing/plans/${planId}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            return response.data;
        } catch (error) {
            console.error('PayPal get plan error:', error.response?.data || error.message);
            throw error;
        }
    }

    async cancelSubscription(subscriptionId, reason) {
        const token = await this.getAccessToken();
        
        try {
            const response = await axios({
                method: 'POST',
                url: `${this.baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                data: {
                    reason: reason || 'User cancelled subscription'
                }
            });

            return response.status === 204;
        } catch (error) {
            console.error('PayPal cancel subscription error:', error.response?.data || error.message);
            throw error;
        }
    }



    // Method to initialize FunStudy products and plans
    async initializeFunStudyProducts() {
        try {
            // Create the main FunStudy product
            const product = await this.createProduct({
                name: "FunStudy 11 Plus Premium",
                description: "Premium access to all FunStudy 11 Plus educational quizzes and features",
                type: "SERVICE",
                category: "EDUCATION_AND_TEXTBOOKS",
                image_url: "https://funstudy-snowy.vercel.app/favicon.ico",
                home_url: "https://funstudy-snowy.vercel.app"
            });

            console.log('Created FunStudy product:', product.id);

            // Create subscription plans
            const yearlyPlan = await this.createSubscriptionPlan({
                product_id: product.id,
                name: "FunStudy Annual Premium",
                description: "Annual subscription to FunStudy 11 Plus Premium features",
                status: "ACTIVE",
                billing_cycles: [
                    {
                        frequency: {
                            interval_unit: "YEAR",
                            interval_count: 1
                        },
                        tenure_type: "REGULAR",
                        sequence: 1,
                        total_cycles: 999, // Ongoing subscription
                        pricing_scheme: {
                            fixed_price: {
                                value: "29.99",
                                currency_code: "GBP"
                            }
                        }
                    }
                ],
                payment_preferences: {
                    auto_bill_outstanding: true,
                    setup_fee: {
                        value: "0.00",
                        currency_code: "GBP"
                    },
                    setup_fee_failure_action: "CONTINUE",
                    payment_failure_threshold: 3
                },
                taxes: {
                    percentage: "0",
                    inclusive: false
                }
            });

            console.log('Created yearly plan:', yearlyPlan.id);

            return {
                productId: product.id,
                yearlyPlanId: yearlyPlan.id
            };

        } catch (error) {
            console.error('Error initializing FunStudy products:', error);
            throw error;
        }
    }
}

module.exports = new PayPalService();