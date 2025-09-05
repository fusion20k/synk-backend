# Synk Backend Deployment Package

This is a clean deployment package for the Synk backend server.

## Files:
- `render-backend-server.js` - Main server file with OAuth polling fixes
- `package.json` - Dependencies and scripts
- `.env.example` - Environment variables template

## Deployment to Render:

1. **Create a new Web Service** on Render
2. **Connect this repository** or upload these files
3. **Set Build Command**: `npm install`
4. **Set Start Command**: `node render-backend-server.js`
5. **Add Environment Variables**:
   ```
   GOOGLE_CLIENT_ID=your_actual_google_client_id
   GOOGLE_CLIENT_SECRET=your_actual_google_client_secret
   BACKEND_URL=https://your-render-service-url.onrender.com
   PORT=10000
   ```

## Testing:
- Health check: `GET /_health`
- OAuth polling: `GET /api/oauth/result?state=test123`
- OAuth callback: `GET /oauth2callback`

## Features:
- ✅ In-memory OAuth results store
- ✅ Robust `/oauth2callback` route with logging
- ✅ `/api/oauth/result` route with status: pending/ready
- ✅ Health check endpoint
- ✅ Proper CORS configuration
- ✅ Environment variable support