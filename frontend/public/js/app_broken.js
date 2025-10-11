// FIXED: Correct port number - changed to 3003 (server is running on 3003)
const API_BASE_URL = 'http://localhost:3003';
    try {
        const url = `${API_BASE_URL}/api/quiz/questions/${currentGrade}/${currentSubject}/${difficulty}`;
        console.log('Fetching quiz from:', url); currentGrade = '';
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

function showMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="alert ${type}">${message}</div>`;
        setTimeout(() => element.innerHTML = '', 5000);
    }
}

// Auth functions
function login() {
    try {
        // Redirect to OAuth login - this is server-side redirect
        window.location.href = `${API_BASE_URL}/auth/login`;
    } catch (error) {
        console.error('Login redirect error:', error);
        showMessage('loginMessage', 'Login redirect failed', 'error');
    }
}

async function register() {
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
            
            // Store email for verification
            document.getElementById('verificationEmail').value = email;
            
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

// Quiz selection functions
function selectGrade(grade) {
    console.log('Selected grade:', grade);
    currentGrade = grade;
    document.getElementById('selectedGrade').textContent = `${grade} - Select Subject`;
    showSection('subjectSection');
}

function selectSubject(subject) {
    console.log('Selected subject:', subject);
    currentSubject = subject;
    document.getElementById('selectedSubject').textContent = `${currentGrade} ${subject} - Select Difficulty`;
    showSection('difficultySection');
}

// FIXED: Updated startQuiz function to properly load and display questions
async function startQuiz(difficulty) {
    console.log('Starting quiz:', { grade: currentGrade, subject: currentSubject, difficulty });
    showLoader();
    
    try {
        const url = `${API_BASE}/api/quiz/questions/${currentGrade}/${currentSubject}/${difficulty}`;
        console.log('Fetching questions from:', url);
        
        const response = await fetch(url, {
            credentials: 'include'
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Questions data received:', data);
            
            if (data.success && data.questions && data.questions.length > 0) {
                // Initialize quiz with the fetched questions
                initializeQuiz(data.questions, difficulty);
                showSection('quizSection');
            } else {
                alert('No questions found for this selection. Please try a different combination.');
                console.error('No questions in response:', data);
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('API error:', errorData);
            alert('Failed to load questions: ' + (errorData.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Network error starting quiz:', error);
        alert('Error starting quiz: ' + error.message);
    } finally {
        hideLoader();
    }
}

// Check if user is already logged in
async function checkAuth() {
    console.log('Checking authentication status...');
    try {
        const response = await fetch(`${API_BASE_URL}/debug/session`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Auth check response:', data);
            
            const authStatusElement = document.getElementById('auth-status');
            if (authStatusElement) {
                authStatusElement.textContent = 
                    data.isAuthenticated ? `Logged in as ${data.user?.email || 'User'}` : 'Not logged in';
            }
            
            if (data.isAuthenticated) {
                console.log('User is authenticated, showing grade selection');
                showSection('gradeSection');
            } else {
                console.log('User not authenticated, staying on login page');
            }
        } else {
            console.log('Auth check failed with status:', response.status);
            const authStatusElement = document.getElementById('auth-status');
            if (authStatusElement) {
                authStatusElement.textContent = 'Check failed';
            }
        }
    } catch (error) {
        console.error('Auth check error:', error);
        const authStatusElement = document.getElementById('auth-status');
        if (authStatusElement) {
            authStatusElement.textContent = 'Error: ' + error.message;
        }
        // Not logged in, show login section
        showSection('loginSection');
    }
}

// Check server status
async function checkServer() {
    console.log('Checking server status...');
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('Server health:', data);
            const serverStatusElement = document.getElementById('server-status');
            if (serverStatusElement) {
                serverStatusElement.textContent = `✅ Connected (${data.status})`;
            }
        } else {
            console.log('Server health check failed with status:', response.status);
            const serverStatusElement = document.getElementById('server-status');
            if (serverStatusElement) {
                serverStatusElement.textContent = '❌ Server error';
            }
        }
    } catch (error) {
        console.error('Server check error:', error);
        const serverStatusElement = document.getElementById('server-status');
        if (serverStatusElement) {
            serverStatusElement.textContent = '❌ Connection failed';
        }
    }
}

// Check for URL errors (from auth callback)
function checkUrlError() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
        console.log('URL error found:', error);
        const urlErrorElement = document.getElementById('url-error');
        if (urlErrorElement) {
            urlErrorElement.textContent = error;
        }
        showMessage('loginMessage', `Authentication error: ${error}`, 'error');
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FunStudy App Initialized ===');
    console.log('API Base URL:', API_BASE_URL);
    
    checkServer();
    checkAuth();
    checkUrlError();
    
    // Add some debug info to console
    console.log('Current page URL:', window.location.href);
    console.log('Available sections:', document.querySelectorAll('.section').length);
    console.log('API Base URL:', API_BASE_URL);
});

// Email verification functions
async function confirmEmail() {
    console.log('confirmEmail function called');
    
    const emailElement = document.getElementById('verificationEmail');
    const codeElement = document.getElementById('verificationCode');
    
    console.log('Email element:', emailElement);
    console.log('Code element:', codeElement);
    
    if (!emailElement || !codeElement) {
        console.error('Verification form elements not found');
        showMessage('Verification form elements not found', 'error');
        return;
    }
    
    const email = emailElement.value.trim();
    const code = codeElement.value.trim();
    
    console.log('Email value:', email);
    console.log('Code value:', code);
    
    if (!email || !code) {
        showMessage('Please enter both email and verification code', 'error');
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
            showMessage('Email verified successfully! You can now login.', 'success');
            // Clear the verification form
            emailElement.value = '';
            codeElement.value = '';
            // Redirect to login after a short delay
            setTimeout(() => showSection('loginSection'), 2000);
        } else {
            showMessage(data.message || 'Email verification failed', 'error');
        }
    } catch (error) {
        console.error('Email verification error:', error);
        showMessage('Network error during verification', 'error');
    }
}

async function resendConfirmationCode() {
    const emailElement = document.getElementById('verificationEmail');
    
    if (!emailElement) {
        showMessage('Email field not found', 'error');
        return;
    }
    
    const email = emailElement.value.trim();
    
    if (!email) {
        showMessage('Please enter your email address', 'error');
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
            showMessage('Verification code resent to your email', 'success');
        } else {
            showMessage(data.message || 'Failed to resend verification code', 'error');
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        showMessage('Network error during resend', 'error');
    }
}
