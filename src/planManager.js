// Plan Management System for Synk
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class PlanManager {
    constructor() {
        this.synkDir = path.join(os.homedir(), '.synk');
        this.planFilePath = path.join(this.synkDir, 'plan.json');
        this.userIdPath = path.join(this.synkDir, 'user.json');
        this.ensureDirectoryExists();
    }

    ensureDirectoryExists() {
        if (!fs.existsSync(this.synkDir)) {
            fs.mkdirSync(this.synkDir, { recursive: true });
            console.log('✅ Created .synk directory');
        }
    }

    // Generate or get unique user ID for this installation
    getUserId() {
        try {
            if (fs.existsSync(this.userIdPath)) {
                const userData = JSON.parse(fs.readFileSync(this.userIdPath, 'utf8'));
                return userData.userId;
            } else {
                // Generate new user ID
                const userId = crypto.randomUUID();
                const userData = {
                    userId,
                    createdAt: new Date().toISOString(),
                    installationId: crypto.randomBytes(16).toString('hex')
                };
                fs.writeFileSync(this.userIdPath, JSON.stringify(userData, null, 2));
                console.log('✅ Generated new user ID:', userId);
                return userId;
            }
        } catch (error) {
            console.error('❌ Error managing user ID:', error);
            return crypto.randomUUID(); // Fallback
        }
    }

    // Get current plan information
    getCurrentPlan() {
        try {
            if (fs.existsSync(this.planFilePath)) {
                const planData = JSON.parse(fs.readFileSync(this.planFilePath, 'utf8'));
                
                // Only check trial expiration for actual trial plans
                if (planData.type === 'trial' && planData.trialEndsAt) {
                    const trialEnd = new Date(planData.trialEndsAt);
                    const now = new Date();
                    
                    if (now > trialEnd) {
                        // Trial expired
                        return {
                            type: 'expired',
                            name: 'Trial Expired',
                            description: 'Your free trial has ended. Please upgrade to continue using Synk.',
                            features: [],
                            status: 'expired',
                            trialDaysRemaining: 0
                        };
                    } else {
                        // Calculate remaining days
                        const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
                        planData.trialDaysRemaining = daysRemaining;
                    }
                }
                
                // For paid plans (free/pro), ensure no trial data is shown
                if (planData.type === 'free' || planData.type === 'pro') {
                    delete planData.trialDaysRemaining;
                    delete planData.trialStartedAt;
                    delete planData.trialEndsAt;
                }
                
                console.log('✅ Plan data loaded:', planData.type);
                return planData;
            }
        } catch (error) {
            console.error('⚠️ Error reading plan file:', error);
        }

        // Default: no current plan until user starts trial or purchases
        return {
            type: 'none',
            name: 'No Plan',
            description: 'You haven’t started a plan yet. Start your free trial or purchase a plan.',
            features: [],
            status: 'none',
            userId: this.getUserId()
        };
    }

    // Create a new trial plan
    createTrialPlan() {
        const trialStart = new Date();
        const trialEnd = new Date(trialStart.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days

        const trialPlan = {
            type: 'trial',
            name: 'Free Trial',
            description: 'You are currently on a free trial. Connect both services to start your 14-day trial.',
            features: [
                '14-day free trial',
                'All Pro features included',
                'Unlimited Notion databases',
                'Unlimited Google calendars',
                'Real-time bidirectional sync',
                'Email support'
            ],
            status: 'active',
            trialStartedAt: trialStart.toISOString(),
            trialEndsAt: trialEnd.toISOString(),
            trialDaysRemaining: 14,
            userId: this.getUserId()
        };

        this.savePlan(trialPlan);
        return trialPlan;
    }

    // Start trial when user connects both services
    startTrial() {
        const currentPlan = this.getCurrentPlan();
        
        if (currentPlan.type === 'trial' && !currentPlan.trialStartedAt) {
            const trialStart = new Date();
            const trialEnd = new Date(trialStart.getTime() + (14 * 24 * 60 * 60 * 1000));
            
            currentPlan.trialStartedAt = trialStart.toISOString();
            currentPlan.trialEndsAt = trialEnd.toISOString();
            currentPlan.description = 'Your 14-day free trial is now active. Enjoy all Pro features!';
            
            this.savePlan(currentPlan);
            console.log('✅ Trial started');
            return currentPlan;
        }
        
        return currentPlan;
    }

    // Update plan from Stripe webhook
    updatePlanFromStripe(stripeData) {
        try {
            const { 
                customer_email, 
                subscription_id, 
                product_name, 
                billing_cycle,
                status,
                current_period_end 
            } = stripeData;

            let planType = 'pro';
            let planName = 'Pro';
            let features = [
                'Unlimited Google Calendar connections',
                'Unlimited Notion database connections', 
                'Automatic live sync',
                'Manual and incremental sync',
                'AI Integration (Coming Soon)',
                'Priority support'
            ];

            // Determine plan type from product name
            if (product_name && product_name.toLowerCase().includes('free')) {
                planType = 'free';
                planName = 'Free';
                features = [
                    '1 Google Calendar connection',
                    '1 Notion database connection',
                    'Manual sync only'
                ];
            }

            const planData = {
                type: planType,
                name: planName,
                description: `You are subscribed to Synk ${planName} (${billing_cycle}).`,
                features,
                status: status === 'active' ? 'active' : 'inactive',
                subscriptionId: subscription_id,
                customerEmail: customer_email,
                billingCycle: billing_cycle,
                currentPeriodEnd: current_period_end,
                updatedAt: new Date().toISOString(),
                userId: this.getUserId()
            };

            this.savePlan(planData);
            console.log('✅ Plan updated from Stripe:', planType);
            return planData;

        } catch (error) {
            console.error('❌ Error updating plan from Stripe:', error);
            throw error;
        }
    }

    // Save plan data
    savePlan(planData) {
        try {
            fs.writeFileSync(this.planFilePath, JSON.stringify(planData, null, 2));
            console.log('✅ Plan data saved');
            return true;
        } catch (error) {
            console.error('❌ Error saving plan:', error);
            return false;
        }
    }

    // Check if user has access to a feature
    hasFeatureAccess(feature) {
        const plan = this.getCurrentPlan();
        
        if (plan.status === 'expired') {
            return false;
        }

        switch (feature) {
            case 'basic_sync':
                return ['trial', 'free', 'pro'].includes(plan.type);
            
            case 'unlimited_databases':
                return ['trial', 'pro'].includes(plan.type);
            
            case 'automatic_sync':
                return ['trial', 'pro'].includes(plan.type);
            
            case 'incremental_sync':
                return ['trial', 'pro'].includes(plan.type);
            
            case 'advanced_filtering':
                return [].includes(plan.type);
            
            case 'bulk_operations':
                return [].includes(plan.type);
            
            case 'analytics':
                return [].includes(plan.type);
            
            case 'export_import':
                return [].includes(plan.type);
            
            case 'priority_support':
                return ['trial', 'pro'].includes(plan.type);
            
            default:
                return false;
        }
    }

    // Get plan limits
    getPlanLimits() {
        const plan = this.getCurrentPlan();
        
        switch (plan.type) {
            case 'trial':
            case 'pro':
                return {
                    maxDatabases: Infinity,
                    maxCalendars: Infinity,
                    syncFrequency: 7000, // 7 seconds (from config)
                    supportLevel: 'priority'
                };
            
            case 'free':
                return {
                    maxDatabases: 1,
                    maxCalendars: 1,
                    syncFrequency: 0, // manual only
                    supportLevel: 'none'
                };
            
            default:
                return {
                    maxDatabases: 0,
                    maxCalendars: 0,
                    syncFrequency: 0,
                    supportLevel: 'none'
                };
        }
    }

    // Clear plan data (for testing or user reset)
    clearPlanData() {
        try {
            if (fs.existsSync(this.planFilePath)) {
                fs.unlinkSync(this.planFilePath);
                console.log('✅ Plan data cleared');
            }
            return true;
        } catch (error) {
            console.error('❌ Error clearing plan data:', error);
            return false;
        }
    }
}

// Create singleton instance
const planManager = new PlanManager();

// Export individual functions for IPC handlers
module.exports = {
    PlanManager,
    getUserPlan: () => planManager.getCurrentPlan(),
    setUserPlan: (planData) => {
        planManager.savePlan(planData);
        return planData;
    },
    startTrial: () => planManager.startTrial(),
    checkFeatureAccess: (feature) => planManager.hasFeatureAccess(feature),
    getPlanLimits: () => planManager.getPlanLimits(),
    clearPlanData: () => planManager.clearPlanData(),
    updatePlanFromStripe: (stripeData) => planManager.updatePlanFromStripe(stripeData)
};