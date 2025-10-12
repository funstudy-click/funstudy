require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const app = express();

// Fix: Use single port definition
const PORT = process.env.PORT || 3002;

const corsOptions = {
    origin: [
        'http://localhost:3002', 
        'http://localhost:3003', 
        'http://localhost:8080', 
        'http://localhost:8081', 
        'http://localhost:8082',
        'https://funstudy-snowy.vercel.app',
        /\.vercel\.app$/,
        'https://vercel.app',
        'https://*.vercel.app'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Debug middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Origin:', req.get('Origin'));
    next();
});

console.log('=== SERVER STARTUP ===');
console.log('Environment check:', {
    AWS_REGION: process.env.AWS_REGION,
    USER_POOL_ID: process.env.COGNITO_USER_POOL_ID ? '***SET***' : 'MISSING',
    CLIENT_ID: process.env.COGNITO_CLIENT_ID ? '***SET***' : 'MISSING',
    REDIRECT_URI: process.env.REDIRECT_URI,
    PORT: PORT
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Remove frontend static files serving for backend deployment
// app.use(express.static(path.join(__dirname, '../frontend/public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key-for-development',
    resave: false,
    saveUninitialized: false,
    name: 'funstudy.sid',
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // HTTPS in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Allow cross-site for production
    },
    rolling: true
}));

// Session error handling
app.use((req, res, next) => {
    if (!req.session) {
        console.error('Session initialization failed for request:', req.url);
        return next(new Error('Session initialization failed'));
    }
    next();
});

// Load routes
let authRoutes, quizRoutes, userRoutes;

try {
    authRoutes = require('./src/routes/authRoutes');
    console.log('✅ Auth routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading auth routes:', error.message);
    authRoutes = express.Router();
}

try {
    quizRoutes = require('./src/routes/quizRoutes');
    console.log('✅ Quiz routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading quiz routes:', error.message);
    quizRoutes = express.Router();
}

try {
    userRoutes = require('./src/routes/userRoutes');
    console.log('✅ User routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading user routes:', error.message);
    userRoutes = express.Router();
}

// Use routes
app.use('/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/user', userRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

// Debug endpoints (keep your existing ones)
app.get('/debug/env', (req, res) => {
    res.json({
        AWS_REGION: process.env.AWS_REGION || 'not-set',
        USER_POOL_ID: process.env.COGNITO_USER_POOL_ID ? 'Set' : 'Missing',
        CLIENT_ID: process.env.COGNITO_CLIENT_ID ? 'Set' : 'Missing',
        REDIRECT_URI: process.env.REDIRECT_URI || 'not-set',
        PORT: PORT
    });
});

// Add this to your server.js temporarily
app.get('/debug/auth-config', (req, res) => {
    res.json({
        COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || 'MISSING',
        COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || 'MISSING',
        COGNITO_DOMAIN: process.env.COGNITO_DOMAIN || 'MISSING',
        AWS_REGION: process.env.AWS_REGION || 'MISSING',
        REDIRECT_URI: process.env.REDIRECT_URI || 'MISSING'
    });
});

// Remove the frontend serving route for backend-only deployment
// app.get('*', (req, res) => { ... })

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('=== UNHANDLED ERROR ===');
    console.error('Error:', err);
    console.error('Request:', req.method, req.path);
    
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Start server - Fix: Use consistent PORT variable
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Error handling
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is busy. Exiting...`);
        process.exit(1);
    } else {
        console.error('Server error:', error);
        process.exit(1);
    }
});

module.exports = app;