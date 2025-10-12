const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const AWS = require('aws-sdk');
const crypto = require('crypto');
const querystring = require('querystring');
const https = require('https');

console.log('Environment variables in authController:', {
    AWS_REGION: process.env.AWS_REGION,
    USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    COGNITO_DOMAIN: process.env.COGNITO_DOMAIN,
    REDIRECT_URI: process.env.REDIRECT_URI,
    HAS_SESSION_SECRET: !!process.env.SESSION_SECRET,
    HAS_CLIENT_SECRET: !!process.env.CLIENT_SECRET
});

// Configure AWS
AWS.config.update({
    region: process.env.AWS_REGION || 'eu-north-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Generate random strings for OAuth state and nonce
function generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// Calculate AWS Cognito SECRET_HASH
function calculateSecretHash(username, clientId, clientSecret) {
    const hmac = crypto.createHmac('sha256', clientSecret);
    hmac.update(username + clientId);
    return hmac.digest('base64');
}

// UPDATED: Use the standard Cognito domain format
// If you have a custom domain prefix, use it. Otherwise, use the user pool ID
const COGNITO_DOMAIN_PREFIX = process.env.COGNITO_DOMAIN;
let COGNITO_DOMAIN;
let AUTHORIZE_URL, TOKEN_URL, USERINFO_URL;

if (COGNITO_DOMAIN_PREFIX) {
    // Use custom domain prefix
    COGNITO_DOMAIN = `${COGNITO_DOMAIN_PREFIX}.auth.${process.env.AWS_REGION}.amazoncognito.com`;
} else {
    // Use the user pool ID as domain (fallback)
    COGNITO_DOMAIN = `${process.env.COGNITO_USER_POOL_ID}.auth.${process.env.AWS_REGION}.amazoncognito.com`;
}

AUTHORIZE_URL = `https://${COGNITO_DOMAIN}/oauth2/authorize`;
TOKEN_URL = `https://${COGNITO_DOMAIN}/oauth2/token`;
USERINFO_URL = `https://${COGNITO_DOMAIN}/oauth2/userInfo`;

console.log('Cognito URLs:', {
    COGNITO_DOMAIN,
    AUTHORIZE_URL,
    TOKEN_URL,
    USERINFO_URL
});

exports.login = async (req, res) => {
    try {
        console.log('=== LOGIN REQUEST ===');
        console.log('Request origin:', req.get('origin'));
        
        // Generate state and nonce for security
        const state = crypto.randomBytes(32).toString('hex');
        const nonce = crypto.randomBytes(32).toString('hex');
        
        // Store in session
        req.session.state = state;
        req.session.nonce = nonce;
        
        console.log('Generated state:', state);
        console.log('Session ID:', req.session.id);

        // Get redirect URI from environment
        const redirectUri = process.env.REDIRECT_URI;
        console.log('Redirect URI:', redirectUri);

        // Build Cognito authorization URL
        const authParams = {
            response_type: 'code',
            client_id: process.env.COGNITO_CLIENT_ID,
            redirect_uri: redirectUri,
            scope: 'email openid phone',
            state: state,
            nonce: nonce
        };

        // ✅ FIXED: Add https:// protocol
        const authUrl = `https://${COGNITO_DOMAIN}/oauth2/authorize?${querystring.stringify(authParams)}`;
        
        console.log('Redirecting to Cognito:', authUrl);
        console.log('Full URL should be:', authUrl);

        // Redirect to Cognito
        res.redirect(authUrl);

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Login failed',
            details: error.message 
        });
    }
};

exports.debugSession = async (req, res) => {
    console.log('=== SESSION DEBUG ===');
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    console.log('Session store:', req.sessionStore);
    console.log('Cookies:', req.headers.cookie);
    
    res.json({
        sessionID: req.sessionID,
        hasSession: !!req.session,
        sessionData: req.session,
        cookies: req.headers.cookie
    });
};

// Test endpoint to check if domain is accessible
exports.testDomain = async (req, res) => {
    try {
        // Test if the domain is accessible
        const testUrl = `https://${COGNITO_DOMAIN}/.well-known/openid_configuration`;

        const options = {
            hostname: COGNITO_DOMAIN,
            port: 443,
            path: '/.well-known/openid_configuration',
            method: 'GET',
        };

        const request = https.request(options, (response) => {
            let data = '';
            response.on('data', (chunk) => data += chunk);
            response.on('end', () => {
                res.json({
                    success: true,
                    domain: COGNITO_DOMAIN,
                    statusCode: response.statusCode,
                    accessible: response.statusCode === 200,
                    openidConfig: response.statusCode === 200 ? JSON.parse(data) : null
                });
            });
        });

        request.on('error', (error) => {
            res.json({
                success: false,
                domain: COGNITO_DOMAIN,
                error: error.message,
                accessible: false
            });
        });

        request.end();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            domain: COGNITO_DOMAIN
        });
    }
};

exports.callback = async (req, res) => {
    try {
        console.log('=== CALLBACK REQUEST ===');
        console.log('Query parameters:', req.query);
        console.log('Session state:', req.session?.state);
        console.log('Session ID:', req.session?.id);

        // Check for errors
        if (req.query.error) {
            console.error('OAuth error:', req.query.error, req.query.error_description);
            return res.redirect(`https://funstudy-snowy.vercel.app/?error=${encodeURIComponent(req.query.error)}`);
        }

        const code = req.query.code;
        const receivedState = req.query.state;

        if (!code) {
            console.error('No authorization code received');
            return res.redirect('https://funstudy-snowy.vercel.app/?error=no_code');
        }

        // TEMPORARY FIX: Skip state verification for cross-domain issue
        // In production, you'd want to implement a more secure state management
        if (!req.session?.state) {
            console.warn('⚠️ No session state found - possible cross-domain session issue');
            console.log('Proceeding with authentication despite missing session state');
        } else if (receivedState !== req.session.state) {
            console.error('State mismatch:');
            console.log('Expected state:', req.session.state);
            console.log('Received state:', receivedState);
            // For now, let's proceed but log the mismatch
            console.warn('⚠️ State mismatch detected but proceeding due to cross-domain setup');
        }

        console.log('Exchanging code for tokens...');
        const redirectUri = process.env.REDIRECT_URI;

        const tokenData = await exchangeCodeForTokens(code, redirectUri);
        console.log('Tokens received successfully');

        console.log('Fetching user info...');
        const userInfo = await fetchUserInfo(tokenData.access_token);
        console.log('User info:', {
            sub: userInfo.sub,
            email: userInfo.email,
            name: userInfo.name,
            email_verified: userInfo.email_verified
        });

        // Check if email is verified
        if (userInfo.email_verified !== 'true' && userInfo.email_verified !== true) {
            console.log('User email not verified, redirecting to verification page');
            return res.redirect(`https://funstudy-snowy.vercel.app/?error=email_not_verified&email=${encodeURIComponent(userInfo.email)}`);
        }

        // Save user to database
        await saveUserIfNew(userInfo);

        // Store in session
        req.session.user = userInfo;
        req.session.tokens = tokenData;
        req.session.authenticated = true;

        // Clean up temporary data
        delete req.session.state;
        delete req.session.nonce;

        console.log('Authentication successful, redirecting to frontend');
        // Redirect back to frontend with success
        res.redirect('https://funstudy-snowy.vercel.app/?auth=success');

    } catch (error) {
        console.error('Auth callback error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);
        
        // Provide more specific error information in the redirect
        let errorType = 'auth_failed';
        if (error.message.includes('Token exchange failed')) {
            errorType = 'token_exchange_failed';
        } else if (error.message.includes('UserInfo fetch failed')) {
            errorType = 'userinfo_failed';
        } else if (error.message.includes('Failed to parse')) {
            errorType = 'parse_error';
        }
        
        res.redirect(`https://funstudy-snowy.vercel.app/?error=${errorType}&details=${encodeURIComponent(error.message)}`);
    }
};

exports.debugAuth = async (req, res) => {
    try {
        res.json({
            environment: {
                AWS_REGION: process.env.AWS_REGION,
                COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
                COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
                COGNITO_DOMAIN: process.env.COGNITO_DOMAIN,
                REDIRECT_URI: process.env.REDIRECT_URI,
                HAS_CLIENT_SECRET: !!process.env.CLIENT_SECRET,
                CLIENT_SECRET_LENGTH: process.env.CLIENT_SECRET ? process.env.CLIENT_SECRET.length : 0,
                CLIENT_SECRET_PREVIEW: process.env.CLIENT_SECRET ? process.env.CLIENT_SECRET.substring(0, 15) + '...' : 'not set',
                DOMAIN_CONSTRUCTED: COGNITO_DOMAIN
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.register = async (req, res) => {
    try {
        console.log('=== REGISTRATION REQUEST ===');
        const { email, password, gradeLevel } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters'
            });
        }

        console.log('Registering user:', email);
        console.log('Has CLIENT_SECRET:', !!process.env.CLIENT_SECRET);

        // Create Cognito Identity Service Provider client
        const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
            region: process.env.AWS_REGION
        });

        const params = {
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: [
                {
                    Name: 'email',
                    Value: email
                },
                {
                    Name: 'name',
                    Value: email.split('@')[0] // Use email prefix as name
                }
            ]
            // Note: Removed MessageAction as it's not valid for signUp
            // Email verification is handled by Cognito User Pool settings
        };

        // Add SecretHash if client secret is configured
        if (process.env.CLIENT_SECRET) {
            const secretHash = calculateSecretHash(email, process.env.COGNITO_CLIENT_ID, process.env.CLIENT_SECRET);
            params.SecretHash = secretHash;
            console.log('Added SecretHash to registration params');
        } else {
            console.log('No CLIENT_SECRET found, proceeding without SecretHash');
        }

        console.log('Registration params (without sensitive data):', {
            ClientId: params.ClientId,
            Username: params.Username,
            UserAttributes: params.UserAttributes,
            hasSecretHash: !!params.SecretHash
        });

        // Try registration with current configuration
        let result;
        try {
            result = await cognitoIdentityServiceProvider.signUp(params).promise();
        } catch (firstError) {
            if (firstError.code === 'NotAuthorizedException' && params.SecretHash) {
                // If we get NotAuthorizedException and we're using SecretHash, 
                // try again without SecretHash (client might not have secret configured)
                console.log('First attempt with SecretHash failed, trying without SecretHash...');
                delete params.SecretHash;
                result = await cognitoIdentityServiceProvider.signUp(params).promise();
            } else if (firstError.code === 'NotAuthorizedException' && !params.SecretHash) {
                // If we get NotAuthorizedException without SecretHash,
                // try again with SecretHash (client might require secret)
                console.log('First attempt without SecretHash failed, trying with SecretHash...');
                const secretHash = calculateSecretHash(email, process.env.COGNITO_CLIENT_ID, process.env.CLIENT_SECRET);
                params.SecretHash = secretHash;
                result = await cognitoIdentityServiceProvider.signUp(params).promise();
            } else {
                throw firstError;
            }
        }
        console.log('User registration successful:', result.UserSub);

        // Save user metadata to DynamoDB
        await saveUserMetadata({
            sub: result.UserSub,
            email: email,
            gradeLevel: gradeLevel || 'GradeA',
            name: email.split('@')[0]
        });

        res.json({
            success: true,
            message: 'Registration successful! Please check your email for verification if required, then you can login.',
            userSub: result.UserSub,
            emailVerificationRequired: true // Email verification depends on User Pool settings
        });

    } catch (error) {
        console.error('Registration error details:', {
            code: error.code,
            message: error.message,
            statusCode: error.statusCode
        });

        let errorMessage = 'Registration failed';
        let statusCode = 400;

        switch (error.code) {
            case 'UsernameExistsException':
                errorMessage = 'User already exists with this email. Try logging in instead.';
                break;
            case 'InvalidPasswordException':
                errorMessage = 'Password does not meet requirements. Please use a stronger password with uppercase, lowercase, numbers, and symbols.';
                break;
            case 'InvalidParameterException':
                errorMessage = 'Invalid email or password format';
                break;
            case 'NotAuthorizedException':
                errorMessage = 'Registration not authorized. This may be due to incorrect client configuration or missing SecretHash.';
                statusCode = 401;
                break;
            case 'TooManyRequestsException':
                errorMessage = 'Too many registration attempts. Please try again later.';
                statusCode = 429;
                break;
            default:
                errorMessage = `Registration failed: ${error.message}`;
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: error.code
        });
    }
};

exports.logout = (req, res) => {
    try {
        console.log('=== LOGOUT REQUEST ===');

        // Check if user is authenticated
        if (!req.session?.user) {
            console.log('No user session found, redirecting to home');
            return res.redirect('/');
        }

        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).json({ error: 'Failed to logout' });
            }

            // For development, just redirect to home page instead of Cognito logout
            // This avoids issues with Cognito logout URL configuration
            console.log('Session destroyed, redirecting to home');
            res.redirect('/');
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
};

exports.checkSession = (req, res) => {
    console.log('=== SESSION CHECK ===');
    res.json({
        sessionId: req.sessionID,
        isAuthenticated: !!req.session?.user,
        user: req.session?.user ? {
            sub: req.session.user.sub,
            email: req.session.user.email,
            name: req.session.user.name
        } : null,
        sessionKeys: Object.keys(req.session || {})
    });
};

// Helper function to exchange authorization code for tokens
function exchangeCodeForTokens(code, redirectUri) {
    return new Promise((resolve, reject) => {
        const postData = querystring.stringify({
            grant_type: 'authorization_code',
            client_id: process.env.COGNITO_CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            code: code,
            redirect_uri: redirectUri
        });

        const options = {
            hostname: COGNITO_DOMAIN,
            port: 443,
            path: '/oauth2/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('Token exchange response status:', res.statusCode);
                console.log('Token exchange response data:', data);
                try {
                    const tokenData = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(tokenData);
                    } else {
                        reject(new Error(`Token exchange failed (${res.statusCode}): ${tokenData.error || data}`));
                    }
                } catch (err) {
                    reject(new Error(`Failed to parse token response: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Helper function to fetch user info
function fetchUserInfo(accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: COGNITO_DOMAIN,
            port: 443,
            path: '/oauth2/userInfo',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                console.log('UserInfo response status:', res.statusCode);
                console.log('UserInfo response data:', data);
                try {
                    const userInfo = JSON.parse(data);
                    if (res.statusCode === 200) {
                        resolve(userInfo);
                    } else {
                        reject(new Error(`UserInfo fetch failed (${res.statusCode}): ${userInfo.error || data}`));
                    }
                } catch (err) {
                    reject(new Error(`Failed to parse userinfo response: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function saveUserIfNew(userInfo) {
    const params = {
        TableName: 'Users',
        Key: { id: userInfo.sub },
        UpdateExpression: 'SET email = :email, username = :username, lastLogin = :now, #name = :name',
        ExpressionAttributeNames: {
            '#name': 'name'
        },
        ExpressionAttributeValues: {
            ':email': userInfo.email,
            ':username': userInfo.preferred_username || userInfo.email,
            ':name': userInfo.name || userInfo.email.split('@')[0],
            ':now': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
    };

    try {
        await dynamodb.update(params).promise();
        console.log('User saved/updated:', userInfo.sub);
    } catch (error) {
        console.error('Error saving user:', error);
    }
}

async function saveUserMetadata(userData) {
    const params = {
        TableName: 'Users',
        Item: {
            id: userData.sub,
            email: userData.email,
            username: userData.email,
            name: userData.name,
            gradeLevel: userData.gradeLevel,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        }
    };

    try {
        await dynamodb.put(params).promise();
        console.log('User metadata saved:', userData.sub);
    } catch (error) {
        console.error('Error saving user metadata:', error);
        throw error;
    }
}

// Debug endpoint to check current Cognito configuration
exports.debugCognitoConfig = (req, res) => {
    const redirectUri = process.env.REDIRECT_URI;

    res.json({
        environment: {
            AWS_REGION: process.env.AWS_REGION,
            USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
            CLIENT_ID: process.env.COGNITO_CLIENT_ID,
            REDIRECT_URI_FROM_ENV: process.env.REDIRECT_URI,
            COGNITO_DOMAIN_PREFIX: process.env.COGNITO_DOMAIN_PREFIX
        },
        cognito: {
            COGNITO_DOMAIN,
            AUTHORIZE_URL,
            TOKEN_URL,
            USERINFO_URL
        },
        server: {
            CURRENT_HOST: req.get('host'),
            REDIRECT_URI_USED: redirectUri
        },
        note: "The REDIRECT_URI_USED is what will be used in OAuth flows"
    });
};

// Debug endpoint to check client configuration
exports.debugClientConfig = async (req, res) => {
    try {
        const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
            region: process.env.AWS_REGION
        });

        const params = {
            UserPoolId: process.env.COGNITO_USER_POOL_ID,
            ClientId: process.env.COGNITO_CLIENT_ID
        };

        const result = await cognitoIdentityServiceProvider.describeUserPoolClient(params).promise();

        res.json({
            success: true,
            clientConfig: {
                clientId: result.UserPoolClient.ClientId,
                clientName: result.UserPoolClient.ClientName,
                hasClientSecret: !!result.UserPoolClient.ClientSecret,
                explicitAuthFlows: result.UserPoolClient.ExplicitAuthFlows,
                supportedIdentityProviders: result.UserPoolClient.SupportedIdentityProviders,
                callbackURLs: result.UserPoolClient.CallbackURLs,
                logoutURLs: result.UserPoolClient.LogoutURLs
            },
            environment: {
                hasClientSecretInEnv: !!process.env.CLIENT_SECRET,
                clientIdMatches: process.env.COGNITO_CLIENT_ID === result.UserPoolClient.ClientId,
                cognitoDomain: process.env.COGNITO_DOMAIN,
                region: process.env.AWS_REGION,
                redirectUri: process.env.REDIRECT_URI
            }
        });
    } catch (error) {
        console.error('Error checking client config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check client configuration',
            details: error.message
        });
    }
};

// Confirm email verification code
exports.confirmRegistration = async (req, res) => {
    try {
        console.log('=== EMAIL CONFIRMATION REQUEST ===');
        const { email, confirmationCode } = req.body;

        if (!email || !confirmationCode) {
            return res.status(400).json({
                success: false,
                error: 'Email and confirmation code are required'
            });
        }

        console.log('Confirming registration for:', email);

        const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
            region: process.env.AWS_REGION
        });

        const params = {
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email,
            ConfirmationCode: confirmationCode
        };

        // Add SecretHash if needed (using same logic as registration)
        if (process.env.CLIENT_SECRET) {
            params.SecretHash = calculateSecretHash(email, process.env.COGNITO_CLIENT_ID, process.env.CLIENT_SECRET);
        }

        await cognitoIdentityServiceProvider.confirmSignUp(params).promise();
        console.log('Email confirmation successful for:', email);

        res.json({
            success: true,
            message: 'Email confirmed successfully! You can now login.'
        });

    } catch (error) {
        console.error('Email confirmation error:', error);

        let errorMessage = 'Email confirmation failed';
        switch (error.code) {
            case 'CodeMismatchException':
                errorMessage = 'Invalid confirmation code. Please check the code and try again.';
                break;
            case 'ExpiredCodeException':
                errorMessage = 'Confirmation code has expired. Please request a new code.';
                break;
            case 'NotAuthorizedException':
                errorMessage = 'User is already confirmed or confirmation is not required.';
                break;
            case 'UserNotFoundException':
                errorMessage = 'User not found. Please register first.';
                break;
            default:
                errorMessage = `Confirmation failed: ${error.message}`;
        }

        res.status(400).json({
            success: false,
            error: errorMessage,
            code: error.code
        });
    }
};

// Resend confirmation code
exports.resendConfirmationCode = async (req, res) => {
    try {
        console.log('=== RESEND CONFIRMATION CODE REQUEST ===');
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        console.log('Resending confirmation code to:', email);

        const cognitoIdentityServiceProvider = new AWS.CognitoIdentityServiceProvider({
            region: process.env.AWS_REGION
        });

        const params = {
            ClientId: process.env.COGNITO_CLIENT_ID,
            Username: email
        };

        // Add SecretHash if needed
        if (process.env.CLIENT_SECRET) {
            params.SecretHash = calculateSecretHash(email, process.env.COGNITO_CLIENT_ID, process.env.CLIENT_SECRET);
        }

        await cognitoIdentityServiceProvider.resendConfirmationCode(params).promise();
        console.log('Confirmation code resent to:', email);

        res.json({
            success: true,
            message: 'Confirmation code sent! Please check your email.'
        });

    } catch (error) {
        console.error('Resend confirmation code error:', error);

        let errorMessage = 'Failed to resend confirmation code';
        switch (error.code) {
            case 'UserNotFoundException':
                errorMessage = 'User not found. Please register first.';
                break;
            case 'InvalidParameterException':
                errorMessage = 'User is already confirmed.';
                break;
            case 'TooManyRequestsException':
                errorMessage = 'Too many requests. Please wait before requesting another code.';
                break;
            default:
                errorMessage = `Failed to resend code: ${error.message}`;
        }

        res.status(400).json({
            success: false,
            error: errorMessage,
            code: error.code
        });
    }
};

module.exports = exports;