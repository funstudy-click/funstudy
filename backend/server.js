require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const app = express();
// Environment variables
const PORT = process.env.PORT || 8900;

console.log('=== SERVER STARTUP ===');
console.log('Environment check:', {
    AWS_REGION: process.env.AWS_REGION,
    USER_POOL_ID: process.env.USER_POOL_ID ? '***SET***' : 'MISSING',
    CLIENT_ID: process.env.CLIENT_ID ? '***SET***' : 'MISSING',
    CLIENT_SECRET: process.env.CLIENT_SECRET ? '***SET***' : 'MISSING',
    REDIRECT_URI: process.env.REDIRECT_URI,
    SESSION_SECRET: process.env.SESSION_SECRET ? '***SET***' : 'MISSING',
    PORT: process.env.PORT
});

// CORS configuration - important for auth callbacks
app.use(cors({
    origin: [`http://localhost:8900`, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082'],
    credentials: true // Important for sessions
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Enhanced session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
    resave: false,
    saveUninitialized: false,
    name: 'funstudy.sid',
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    },
    rolling: true
}));

// Session error handling middleware
app.use((req, res, next) => {
    if (!req.session) {
        console.error('Session initialization failed for request:', req.url);
        return next(new Error('Session initialization failed'));
    }
    next();
});

// Enhanced debug middleware - log sessions and requests
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n=== ${timestamp} ===`);
    console.log(`${req.method} ${req.path}`);
    console.log('Query params:', req.query);
    console.log('Session ID:', req.sessionID);
    console.log('Session user:', req.session?.user?.sub || 'undefined');
    console.log('Session keys:', Object.keys(req.session || {}));
    
    next();
});

// Import routes with error handling
let authRoutes, quizRoutes, userRoutes;

try {
    authRoutes = require('./src/routes/authRoutes');
    console.log('✅ Auth routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading auth routes:', error.message);
    authRoutes = express.Router(); // Fallback empty router
}

try {
    quizRoutes = require('./src/routes/quizRoutes');
    console.log('✅ Quiz routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading quiz routes:', error.message);
    quizRoutes = express.Router(); // Fallback empty router
}

try {
    userRoutes = require('./src/routes/userRoutes');
    console.log('✅ User routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading user routes:', error.message);
    userRoutes = express.Router(); // Fallback empty router
}

// Use routes
app.use('/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/user', userRoutes);

// Debug endpoint for Cognito configuration
app.get('/debug/cognito-config', (req, res) => {
    try {
        const AWS = require('aws-sdk');
        
        // Configure AWS if not already configured
        if (!AWS.config.region) {
            AWS.config.update({ region: process.env.AWS_REGION || 'eu-north-1' });
        }
        
        const cognito = new AWS.CognitoIdentityServiceProvider({
            region: process.env.AWS_REGION || 'eu-north-1'
        });
        
        const params = {
            UserPoolId: process.env.USER_POOL_ID,
            ClientId: process.env.CLIENT_ID
        };
        
        cognito.describeUserPoolClient(params, (err, data) => {
            if (err) {
                console.error('Error fetching client config:', err);
                return res.status(500).json({
                    error: 'Failed to fetch client configuration',
                    details: err.message
                });
            }
            
            const client = data.UserPoolClient;
            const currentPort = req.get('host').split(':')[1] || '8900';
            const currentCallbackUrl = `http://localhost:${currentPort}/auth/callback`;
            
            res.json({
                clientName: client.ClientName,
                clientId: client.ClientId,
                callbackURLs: client.CallbackURLs || [],
                logoutURLs: client.LogoutURLs || [],
                allowedOAuthFlows: client.AllowedOAuthFlows || [],
                allowedOAuthScopes: client.AllowedOAuthScopes || [],
                supportedIdentityProviders: client.SupportedIdentityProviders || [],
                expectedCallbackURL: process.env.REDIRECT_URI,
                currentCallbackURL: currentCallbackUrl,
                callbackUrlsMatch: (client.CallbackURLs || []).includes(currentCallbackUrl),
                currentDomain: `https://eu-north-10lokrl3ie.auth.eu-north-1.amazoncognito.com`,
                authURL: `https://eu-north-10lokrl3ie.auth.eu-north-1.amazoncognito.com/oauth2/authorize`,
                setupInstructions: {
                    message: 'If you are getting invalid_state errors, you need to add the current callback URL to your AWS Cognito App Client settings.',
                    steps: [
                        '1. Go to AWS Cognito Console',
                        '2. Select your User Pool',
                        '3. Go to App Clients and select your app client',
                        `4. Add "${currentCallbackUrl}" to the Callback URLs list`,
                        '5. Make sure Allowed OAuth Flows includes "Authorization code grant"',
                        '6. Make sure Allowed OAuth Scopes includes "email", "openid", and "phone"'
                    ]
                }
            });
        });
    } catch (error) {
        console.error('Error in cognito-config endpoint:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        sessionId: req.sessionID,
        authenticated: !!req.session?.user,
        environment: {
            nodeEnv: process.env.NODE_ENV || 'development',
            awsRegion: process.env.AWS_REGION || 'not-set',
            port: PORT
        }
    });
});

// Enhanced debug endpoint to check environment variables
app.get('/debug/env', (req, res) => {
    res.json({
        AWS_REGION: process.env.AWS_REGION || 'not-set',
        USER_POOL_ID: process.env.USER_POOL_ID ? 'Set' : 'Missing',
        CLIENT_ID: process.env.CLIENT_ID ? 'Set' : 'Missing',
        REDIRECT_URI: process.env.REDIRECT_URI || 'not-set',
        SESSION_SECRET: process.env.SESSION_SECRET ? 'Set' : 'Missing',
        CLIENT_SECRET: process.env.CLIENT_SECRET ? 'Set' : 'Missing',
        PORT: PORT
    });
});

// Session debug endpoint
app.get('/debug/session', (req, res) => {
    console.log('=== SESSION DEBUG ENDPOINT ===');
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    
    res.json({
        sessionId: req.sessionID,
        isAuthenticated: !!req.session?.user,
        user: req.session?.user ? {
            sub: req.session.user.sub,
            email: req.session.user.email,
            name: req.session.user.name
        } : null,
        sessionKeys: Object.keys(req.session || {}),
        timestamp: new Date().toISOString()
    });
});

// OpenID client test endpoint
app.get('/debug/openid-test', (req, res) => {
    try {
        const { Issuer, generators } = require('openid-client');
        
        res.json({
            message: 'openid-client package test',
            hasIssuer: typeof Issuer,
            hasDiscover: typeof Issuer?.discover,
            hasGenerators: typeof generators,
            hasNonce: typeof generators?.nonce,
            hasState: typeof generators?.state,
            packageInfo: 'openid-client imported successfully'
        });
    } catch (error) {
        res.status(500).json({
            message: 'openid-client package test failed',
            error: error.message,
            stack: error.stack
        });
    }
});

// Test session endpoint
app.get('/debug/test-session', (req, res) => {
    req.session.testData = 'Session is working!';
    req.session.timestamp = new Date().toISOString();
    
    req.session.save((err) => {
        if (err) {
            console.error('Error saving test session:', err);
            return res.json({ error: 'Failed to save session', details: err.message });
        }
        
        res.json({
            message: 'Test session data saved',
            sessionId: req.sessionID,
            testData: req.session.testData,
            timestamp: req.session.timestamp
        });
    });
});

// Callback test route
app.get('/auth/callback-test', (req, res) => {
    console.log('=== CALLBACK TEST ROUTE HIT ===');
    console.log('Query:', req.query);
    console.log('Session:', req.session);
    res.json({
        message: 'Callback test route reached',
        query: req.query,
        sessionId: req.sessionID,
        sessionKeys: Object.keys(req.session || {})
    });
});

// Dashboard route (for after successful auth)
app.get('/dashboard', (req, res) => {
    if (!req.session?.user) {
        console.log('Unauthenticated access to dashboard, redirecting to login');
        return res.redirect('/auth/login');
    }
    
    console.log('Authenticated user accessing dashboard:', req.session.user.sub);
    res.json({
        message: 'Dashboard access successful',
        user: {
            sub: req.session.user.sub,
            email: req.session.user.email,
            name: req.session.user.name
        }
    });
});

// AWS DynamoDB test endpoint
app.get('/debug/dynamodb-test', async (req, res) => {
    try {
        const AWS = require('aws-sdk');
        
        // Configure AWS
        AWS.config.update({ region: process.env.AWS_REGION || 'eu-north-1' });
        
        const dynamodbService = new AWS.DynamoDB();
        
        // List tables
        const result = await dynamodbService.listTables().promise();
        
        res.json({
            message: 'DynamoDB connection test',
            region: AWS.config.region,
            tables: result.TableNames,
            tableCount: result.TableNames.length
        });
    } catch (error) {
        console.error('DynamoDB test error:', error);
        res.status(500).json({
            message: 'DynamoDB test failed',
            error: error.message,
            region: process.env.AWS_REGION || 'not-set'
        });
    }
});

// Serve frontend (must be after all API routes)
app.get('*', (req, res) => {
    console.log('Serving frontend for route:', req.path);
    const indexPath = path.join(__dirname, '../frontend/public/index.html');
    
    // Check if file exists before serving
    const fs = require('fs');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('Index.html not found at:', indexPath);
        res.status(404).send(`
            <h1>Frontend Not Found</h1>
            <p>Could not find index.html at: ${indexPath}</p>
            <p>Please ensure your frontend is built and placed in the correct directory.</p>
        `);
    }
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
    console.error('=== UNHANDLED ERROR ===');
    console.error('Error:', err);
    console.error('Request:', req.method, req.path);
    console.error('Session ID:', req.sessionID);
    console.error('Stack:', err.stack);
    
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
    });
});

// Start server with error handling
const server = app.listen(PORT, () => {
    console.log(`\n=== SERVER STARTED SUCCESSFULLY ===`);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Debug session: http://localhost:${PORT}/debug/session`);
    console.log(`DynamoDB test: http://localhost:${PORT}/debug/dynamodb-test`);
    console.log(`Auth login: http://localhost:${PORT}/auth/login`);
    console.log('==========================================\n');
});

// Handle port already in use
server.on('error', (error) => {
    console.error('=== SERVER ERROR ===');
    if (error.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is busy. Trying port ${Number(PORT) + 1}...`);
        const newPort = Number(PORT) + 1;
        
        const newServer = app.listen(newPort, () => {
            console.log(`Server started on alternate port: http://localhost:${newPort}`);
        });
        
        newServer.on('error', (newError) => {
            console.error('Failed to start on alternate port:', newError.message);
            process.exit(1);
        });
    } else {
        console.error('Server error:', error);
        process.exit(1);
    }
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('=== UNCAUGHT EXCEPTION ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('=== UNHANDLED REJECTION ===');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
});

module.exports = app;