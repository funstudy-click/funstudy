// FunStudy App - Clean Version
const API_BASE_URL = 'http://localhost:3003';
let currentGrade = '';
let currentSubject = '';

// Utility functions
function showSection(sectionId) {
    console.log('Switching to section:', sectionId);
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function showLoader() {
    document.getElementById('loader').classList.remove('hidden');
}

function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `message ${type}`;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    } else {
        // Fallback to generic message display
        showGenericMessage(message, type);
    }
}

function showGenericMessage(message, type) {
    // Find any message element or create one
    let messageElement = document.querySelector('.message-display');
    if (!messageElement) {
        messageElement = document.createElement('div');
        messageElement.className = 'message-display';
        messageElement.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 10px; border-radius: 5px; z-index: 1000;';
        document.body.appendChild(messageElement);
    }
    
    messageElement.textContent = message;
    messageElement.className = `message-display ${type}`;
    messageElement.style.display = 'block';
    
    if (type === 'error') {
        messageElement.style.backgroundColor = '#f8d7da';
        messageElement.style.color = '#721c24';
    } else if (type === 'success') {
        messageElement.style.backgroundColor = '#d4edda';
        messageElement.style.color = '#155724';
    }
    
    setTimeout(() => {
        messageElement.style.display = 'none';
    }, 5000);
}

// Authentication functions
function login() {
    try {
        console.log('Login function called');
        // Redirect to OAuth login - this is server-side redirect
        window.location.href = `${API_BASE_URL}/auth/login`;
    } catch (error) {
        console.error('Login redirect error:', error);
        showMessage('loginMessage', 'Login redirect failed', 'error');
    }
}

async function register() {
    console.log('Register function called');
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const gradeLevel = document.getElementById('gradeLevel').value;
    
    console.log('Registration form values:', { email, password: password ? '***' : '', gradeLevel });
    
    if (!email || !password) {
        showMessage('registerMessage', 'Please fill in all fields', 'error');
        return;
    }
    
    if (password.length < 8) {
        showMessage('registerMessage', 'Password must be at least 8 characters', 'error');
        return;
    }
    
    showLoader();
    
    try {
        console.log('Sending registration request to:', `${API_BASE_URL}/auth/register`);
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password,
                gradeLevel: gradeLevel
            })
        });
        
        console.log('Registration response status:', response.status);
        const data = await response.json();
        console.log('Registration response data:', data);
        
        if (data.success) {
            showMessage('registerMessage', 'Registration successful! Please check your email for verification code.', 'success');
            
            // Store email for verification
            const verificationEmailElement = document.getElementById('verificationEmail');
            if (verificationEmailElement) {
                verificationEmailElement.value = email;
            }
            
            // Clear registration form
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('gradeLevel').value = 'GradeA';
            
            // Switch to verification section
            setTimeout(() => showSection('verificationSection'), 2000);
        } else {
            showMessage('registerMessage', data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showMessage('registerMessage', 'Registration failed: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
}

function logout() {
    // Redirect to logout route on server
    window.location.href = `${API_BASE_URL}/auth/logout`;
}

// Email verification functions
async function confirmEmail() {
    console.log('confirmEmail function called');
    
    const emailElement = document.getElementById('verificationEmail');
    const codeElement = document.getElementById('verificationCode');
    
    console.log('Email element:', emailElement);
    console.log('Code element:', codeElement);
    
    if (!emailElement || !codeElement) {
        console.error('Verification form elements not found');
        showGenericMessage('Verification form elements not found', 'error');
        return;
    }
    
    const email = emailElement.value.trim();
    const code = codeElement.value.trim();
    
    console.log('Email value:', email);
    console.log('Code value:', code);
    
    if (!email || !code) {
        showGenericMessage('Please enter both email and verification code', 'error');
        return;
    }
    
    try {
        console.log('Sending verification request to:', `${API_BASE_URL}/auth/confirm-registration`);
        const response = await fetch(`${API_BASE_URL}/auth/confirm-registration`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, confirmationCode: code })
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
            showGenericMessage('Email verified successfully! You can now login.', 'success');
            // Clear the verification form
            emailElement.value = '';
            codeElement.value = '';
            // Redirect to login after a short delay
            setTimeout(() => showSection('loginSection'), 2000);
        } else {
            showGenericMessage(data.message || 'Email verification failed', 'error');
        }
    } catch (error) {
        console.error('Email verification error:', error);
        showGenericMessage('Network error during verification', 'error');
    }
}

async function resendConfirmationCode() {
    const emailElement = document.getElementById('verificationEmail');
    
    if (!emailElement) {
        showGenericMessage('Email field not found', 'error');
        return;
    }
    
    const email = emailElement.value.trim();
    
    if (!email) {
        showGenericMessage('Please enter your email address', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/resend-confirmation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showGenericMessage('Verification code resent to your email', 'success');
        } else {
            showGenericMessage(data.message || 'Failed to resend verification code', 'error');
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        showGenericMessage('Network error during resend', 'error');
    }
}

// Health check function
async function checkServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            console.log('✅ Server is running and accessible');
        } else {
            console.warn('⚠️ Server responded but with status:', response.status);
        }
    } catch (error) {
        console.error('❌ Server health check failed:', error);
        showGenericMessage('Server connection failed. Please try again later.', 'error');
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FunStudy App Initialized ===');
    console.log('API Base URL:', API_BASE_URL);
    console.log('Current page URL:', window.location.href);
    console.log('Available sections:', document.querySelectorAll('.section').length);
    
    checkServer();
    
    // Make sure the login section is active by default
    showSection('loginSection');
});
