// FunStudy App - Clean Version
const API_BASE_URL = 'https://funstudy-backend.onrender.com';
let currentGrade = '';
let currentSubject = '';

// Utility functions
function showSection(sectionId) {
    console.log('Switching to section:', sectionId);
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show the target section with error handling
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    } else {
        console.error(`Section with ID '${sectionId}' not found. Available sections:`);
        document.querySelectorAll('.section').forEach(section => {
            console.log('- ' + section.id);
        });
    }
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
        showGenericMessage(message, type);
    }
}

function showGenericMessage(message, type) {
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
async function login() {
    try {
        console.log('🔐 Starting login process...');
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
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('registerMessage', 'Registration successful! Please check your email for verification code.', 'success');
            
            const verificationEmailElement = document.getElementById('verificationEmail');
            if (verificationEmailElement) {
                verificationEmailElement.value = email;
            }
            
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('gradeLevel').value = 'GradeA';
            
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
    window.location.href = `${API_BASE_URL}/auth/logout`;
}

// Email verification functions
async function confirmEmail() {
    const emailElement = document.getElementById('verificationEmail');
    const codeElement = document.getElementById('verificationCode');
    
    if (!emailElement || !codeElement) {
        showGenericMessage('Verification form elements not found', 'error');
        return;
    }
    
    const email = emailElement.value.trim();
    const code = codeElement.value.trim();
    
    if (!email || !code) {
        showGenericMessage('Please enter both email and verification code', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/confirm-registration`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, confirmationCode: code })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showGenericMessage('Email verified successfully! You can now login.', 'success');
            emailElement.value = '';
            codeElement.value = '';
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

// Navigation functions
function selectGrade(grade) {
    currentGrade = grade;
    console.log('Grade selected:', grade);
    showSection('subjectSection');
}

function selectSubject(subject) {
    currentSubject = subject;
    console.log('Subject selected:', subject);
    showSection('difficultySection');
}

function selectDifficulty(difficulty) {
    console.log('Difficulty selected:', difficulty);
    startQuiz(difficulty);
}

function goHome() {
    showSection('gradeSection');
}

function goBack() {
    const currentSection = document.querySelector('.section.active');
    if (currentSection) {
        const sectionId = currentSection.id;
        switch (sectionId) {
            case 'subjectSection':
                showSection('gradeSection');
                break;
            case 'difficultySection':
                showSection('subjectSection');
                break;
            case 'quizSection':
                showSection('difficultySection');
                break;
            case 'resultsSection':
                showSection('gradeSection');
                break;
            default:
                showSection('gradeSection');
        }
    }
}

// Quiz functions
async function startQuiz(difficulty) {
    showLoader();
    try {
        const response = await fetch(`${API_BASE_URL}/api/quiz/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                grade: currentGrade,
                subject: currentSubject,
                difficulty: difficulty
            })
        });

        const data = await response.json();
        
        if (data.success && data.questions) {
            displayQuiz(data.questions);
        } else {
            showGenericMessage('Failed to load quiz questions', 'error');
        }
    } catch (error) {
        console.error('Quiz loading error:', error);
        showGenericMessage('Failed to load quiz', 'error');
    } finally {
        hideLoader();
    }
}

function displayQuiz(questions) {
    // Implementation for displaying quiz questions
    console.log('Displaying quiz with questions:', questions);
    showSection('quizSection');
    // Add quiz display logic here
}

// Auth callback handler
function handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    const error = urlParams.get('error');

    if (authStatus === 'success') {
        console.log('✅ Authentication successful!');
        window.history.replaceState({}, document.title, window.location.pathname);
        showSection('gradeSection');
        showGenericMessage('Login successful! Welcome to FunStudy!', 'success');
        return;
    }

    if (error) {
        console.error('❌ Authentication error:', error);
        let errorMessage = 'Authentication failed';
        
        switch (error) {
            case 'invalid_state':
                errorMessage = 'Security validation failed. Please try logging in again.';
                break;
            case 'access_denied':
                errorMessage = 'Login was cancelled or access was denied.';
                break;
            case 'email_not_verified':
                errorMessage = 'Please verify your email address before logging in.';
                break;
            default:
                errorMessage = `Login failed: ${error}`;
        }
        
        showGenericMessage(errorMessage, 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
        showSection('loginSection');
    }
}

// Server health check
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

// Initialize app - SINGLE DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FunStudy App Initialized ===');
    console.log('API Base URL:', API_BASE_URL);
    console.log('Current page URL:', window.location.href);
    console.log('Available sections:', document.querySelectorAll('.section').length);
    
    // Handle auth callback first
    handleAuthCallback();
    
    // Check server health
    checkServer();
    
    // Show default section if no auth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('auth') && !urlParams.get('error')) {
        showSection('loginSection');
    }
});