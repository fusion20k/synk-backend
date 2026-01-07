---
description: Repository Information Overview
alwaysApply: true
---

# Synk Backend Server Information

## Summary
Synk Backend Server is a Node.js Express application that provides OAuth integration, subscription management, and synchronization services for the Synk application. It handles Google Calendar and Notion integrations, user authentication, Stripe payment processing, and plan management.

## Structure
- **src/**: Core application modules
  - `planManager.js` - Subscription plan management and user ID handling
  - `syncManager.js` - Calendar/database synchronization engine with smart polling
  - `syncTrialDays.js` - Trial period tracking and management
  - `versionConfig.js` - Application version checking and updates
  - `versionMiddleware.js` - API version compatibility middleware
- **migrations/**: SQL database migration scripts for Supabase
  - `add_trial_days_remaining.sql` - Trial tracking column
  - `fix_plan_check_constraint.sql` - Plan validation fixes
  - `update_plan_names.sql` - Plan naming updates
- **render-backend-server.js**: Main server entry point (676 lines)
- **.env.example**: Environment variable template

## Language & Runtime
**Language**: JavaScript (Node.js)  
**Version**: Not explicitly specified (likely Node.js 18+)  
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- `express@^4.21.2` - Web server framework
- `@supabase/supabase-js@^2.45.3` - Database client
- `googleapis@^159.0.0` - Google Calendar API integration
- `stripe@^14.21.0` - Payment processing
- `cors@^2.8.5` - Cross-origin resource sharing
- `jsonwebtoken@^9.0.2` - JWT authentication
- `bcryptjs@^2.4.3` - Password hashing
- `axios@^1.11.0` - HTTP client
- `dotenv@^16.0.0` - Environment configuration
- `node-fetch@^2.7.0` - HTTP requests

## Build & Installation
```bash
# Install dependencies
npm install

# Start the server
npm start
```

## Environment Configuration
**Required Variables**:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `GOOGLE_REDIRECT_URI` - OAuth callback URL
- `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` - Notion OAuth credentials (optional)
- `NOTION_REDIRECT_URI` - Notion OAuth callback
- `PORT` - Server port (default: 10000)
- `BACKEND_URL` - Base URL for deployed server
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe configuration
- `STRIPE_PRICE_*` - Price IDs for subscription tiers
- `SUPABASE_URL`, `SUPABASE_KEY` - Database connection (implied)
- `SYNC_INTERVAL*` - Sync timing configuration

## Main Endpoints
**OAuth Routes**:
- `/oauth2callback` - Google OAuth callback
- `/oauth2callback/notion` - Notion OAuth callback

**Stripe Routes**:
- `/stripe/webhook` - Stripe webhook handler (multiple paths supported)
- `/stripe/ping` - Health check endpoint

**Service Configuration**:
- CORS enabled for: `https://synk-official.com`, `http://localhost:3000`, `https://synk-web.onrender.com`
- Deployed on Render.com (https://synk-backend.onrender.com)

## Database
**Type**: Supabase (PostgreSQL)  
**Schema**: 
- Users table with subscription fields (`plan`, `billing_period`, `is_trial`, `trial_days_remaining`)
- Managed through SQL migrations in `/migrations`
- Supports Free and Pro plans with monthly/yearly billing

## Sync System
**Features**:
- Smart adaptive polling: 5s active, 2.5min idle, 2min background
- Electron-store for persistent sync state
- Google Calendar ↔ Notion bidirectional sync
- Duplicate prevention with ID mapping
- Queue-based sync with debouncing

## Version Management
- Fetches latest version from GitHub (fusion20k/synk-web)
- Minimum supported version: 1.0.0
- Version checks cached for 10 minutes
- Soft update messaging for clients
