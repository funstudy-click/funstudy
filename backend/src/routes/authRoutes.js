const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Authentication routes
router.get('/login', authController.login);
router.get('/callback', authController.callback);
router.get('/logout', authController.logout);
router.post('/register', authController.register);
router.post('/confirm-registration', authController.confirmRegistration);
router.post('/resend-confirmation', authController.resendConfirmationCode);

// Debug route (add this)
router.get('/debug/session', authController.checkSession);
router.get('/debug/cognito-config', authController.debugCognitoConfig);
router.get('/debug/client-config', authController.debugClientConfig);

// Test route to see if auth routes are working
router.get('/test', (req, res) => {
    res.json({
        message: 'Auth routes are working',
        sessionId: req.sessionID,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;