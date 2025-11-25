// Stripe Webhook Server for Plan Updates
const express = require('express');
const crypto = require('crypto');
const PlanManager = require('./planManager');

class WebhookServer {
    constructor(port = 3001) {
        this.app = express();
        this.port = port;
        this.planManager = new PlanManager();
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Raw body parser for Stripe webhooks
        this.app.use('/webhook', express.raw({ type: 'application/json' }));
        
        // JSON parser for other routes
        this.app.use(express.json());
        
        // CORS for local development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, stripe-signature');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok', 
                service: 'Synk Webhook Server',
                timestamp: new Date().toISOString()
            });
        });

        // Stripe webhook endpoint
        this.app.post('/webhook/stripe', (req, res) => {
            this.handleStripeWebhook(req, res);
        });

        // Manual plan update endpoint (for testing)
        this.app.post('/api/plan/update', (req, res) => {
            try {
                const planData = req.body;
                const result = this.planManager.updatePlanFromStripe(planData);
                res.json({ success: true, plan: result });
            } catch (error) {
                console.error('❌ Manual plan update failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Get current plan endpoint
        this.app.get('/api/plan/current', (req, res) => {
            try {
                const plan = this.planManager.getCurrentPlan();
                res.json({ success: true, plan });
            } catch (error) {
                console.error('❌ Get plan failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Start trial endpoint
        this.app.post('/api/plan/start-trial', (req, res) => {
            try {
                const plan = this.planManager.startTrial();
                res.json({ success: true, plan });
            } catch (error) {
                console.error('❌ Start trial failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    // Verify Stripe webhook signature
    verifyStripeSignature(payload, signature) {
        if (!this.webhookSecret) {
            console.warn('⚠️ No webhook secret configured, skipping signature verification');
            return true;
        }

        try {
            const elements = signature.split(',');
            const signatureHash = elements.find(el => el.startsWith('v1=')).split('=')[1];
            const timestamp = elements.find(el => el.startsWith('t=')).split('=')[1];
            
            const expectedSignature = crypto
                .createHmac('sha256', this.webhookSecret)
                .update(timestamp + '.' + payload)
                .digest('hex');

            return crypto.timingSafeEqual(
                Buffer.from(signatureHash, 'hex'),
                Buffer.from(expectedSignature, 'hex')
            );
        } catch (error) {
            console.error('❌ Signature verification failed:', error);
            return false;
        }
    }

    // Handle Stripe webhook
    handleStripeWebhook(req, res) {
        const signature = req.headers['stripe-signature'];
        const payload = req.body;

        console.log('🔔 Stripe webhook received');

        // Verify signature
        if (!this.verifyStripeSignature(payload, signature)) {
            console.error('❌ Invalid webhook signature');
            return res.status(400).send('Invalid signature');
        }

        try {
            const event = JSON.parse(payload);
            console.log('📋 Webhook event type:', event.type);

            switch (event.type) {
                case 'checkout.session.completed':
                    this.handleCheckoutCompleted(event.data.object);
                    break;

                case 'invoice.payment_succeeded':
                    this.handlePaymentSucceeded(event.data.object);
                    break;

                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    this.handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    this.handleSubscriptionCancelled(event.data.object);
                    break;

                default:
                    console.log('ℹ️ Unhandled webhook event:', event.type);
            }

            res.json({ received: true });

        } catch (error) {
            console.error('❌ Webhook processing failed:', error);
            res.status(400).send('Webhook processing failed');
        }
    }

    // Handle successful checkout
    handleCheckoutCompleted(session) {
        console.log('✅ Checkout completed:', session.id);
        
        try {
            // Extract plan information from session
            const planData = this.extractPlanFromSession(session);
            this.planManager.updatePlanFromStripe(planData);
            
            console.log('✅ Plan activated from checkout');
        } catch (error) {
            console.error('❌ Failed to process checkout:', error);
        }
    }

    // Handle successful payment
    handlePaymentSucceeded(invoice) {
        console.log('💳 Payment succeeded:', invoice.id);
        
        try {
            const planData = this.extractPlanFromInvoice(invoice);
            this.planManager.updatePlanFromStripe(planData);
            
            console.log('✅ Plan renewed from payment');
        } catch (error) {
            console.error('❌ Failed to process payment:', error);
        }
    }

    // Handle subscription updates
    handleSubscriptionUpdated(subscription) {
        console.log('🔄 Subscription updated:', subscription.id);
        
        try {
            const planData = this.extractPlanFromSubscription(subscription);
            this.planManager.updatePlanFromStripe(planData);
            
            console.log('✅ Plan updated from subscription');
        } catch (error) {
            console.error('❌ Failed to process subscription update:', error);
        }
    }

    // Handle subscription cancellation
    handleSubscriptionCancelled(subscription) {
        console.log('❌ Subscription cancelled:', subscription.id);
        
        try {
            // Set plan to expired
            const planData = {
                customer_email: subscription.customer?.email || 'unknown',
                subscription_id: subscription.id,
                product_name: 'cancelled',
                billing_cycle: 'cancelled',
                status: 'cancelled',
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
            };
            
            this.planManager.updatePlanFromStripe(planData);
            console.log('✅ Plan cancelled');
        } catch (error) {
            console.error('❌ Failed to process cancellation:', error);
        }
    }

    // Extract plan data from checkout session
    extractPlanFromSession(session) {
        return {
            customer_email: session.customer_details?.email || session.customer_email,
            subscription_id: session.subscription,
            product_name: this.getProductNameFromSession(session),
            billing_cycle: this.getBillingCycleFromSession(session),
            status: 'active',
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Default 30 days
        };
    }

    // Extract plan data from invoice
    extractPlanFromInvoice(invoice) {
        return {
            customer_email: invoice.customer_email,
            subscription_id: invoice.subscription,
            product_name: this.getProductNameFromInvoice(invoice),
            billing_cycle: this.getBillingCycleFromInvoice(invoice),
            status: 'active',
            current_period_end: new Date(invoice.period_end * 1000).toISOString()
        };
    }

    // Extract plan data from subscription
    extractPlanFromSubscription(subscription) {
        return {
            customer_email: subscription.customer?.email || 'unknown',
            subscription_id: subscription.id,
            product_name: this.getProductNameFromSubscription(subscription),
            billing_cycle: this.getBillingCycleFromSubscription(subscription),
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
        };
    }

    // Helper methods to extract product information
    getProductNameFromSession(session) {
        // This would need to be customized based on your Stripe setup
        // For now, we'll use the amount to determine the plan
        const amount = session.amount_total;
        if (amount >= 2499) return 'Synk Ultimate'; // $24.99+
        return 'Synk Pro';
    }

    getProductNameFromInvoice(invoice) {
        const amount = invoice.amount_paid;
        if (amount >= 2499) return 'Synk Ultimate';
        return 'Synk Pro';
    }

    getProductNameFromSubscription(subscription) {
        if (subscription.items?.data?.[0]?.price?.unit_amount >= 2499) {
            return 'Synk Ultimate';
        }
        return 'Synk Pro';
    }

    getBillingCycleFromSession(session) {
        // Determine from amount - yearly plans are discounted
        const amount = session.amount_total;
        if (amount >= 12000) return 'yearly'; // $120+ indicates yearly
        return 'monthly';
    }

    getBillingCycleFromInvoice(invoice) {
        const amount = invoice.amount_paid;
        if (amount >= 12000) return 'yearly';
        return 'monthly';
    }

    getBillingCycleFromSubscription(subscription) {
        const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
        return interval === 'year' ? 'yearly' : 'monthly';
    }

    // Start the webhook server
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.log(`🚀 Webhook server running on port ${this.port}`);
                    console.log(`📡 Webhook endpoint: http://localhost:${this.port}/webhook/stripe`);
                    resolve(this.server);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Stop the webhook server
    stop() {
        if (this.server) {
            this.server.close();
            console.log('🛑 Webhook server stopped');
        }
    }
}

module.exports = WebhookServer;