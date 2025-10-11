// FIXED: Correct port number - changed from 3002 to 3003
const API_BASE = 'http://localhost:3003';
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
    document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

function showMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `<div class="alert ${type}">${message}</div>`;
        setTimeout(() => element.innerHTML = '', 5000);
    }
}

// Auth functions
async function login() {
    console.log('Attempting login...');
    showLoader();
    try {
        // Redirect to backend login endpoint
        window.location.href = `${API_BASE}/auth/login`;
    } catch (error) {
        console.error('Login error:', error);
        hideLoader();
        showMessage('loginMessage', 'Login failed: ' + error.message, 'error');
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
        // For now, redirect to login after "registration"
        showMessage('registerMessage', 'Registration simulation complete. Please login.', 'success');
        setTimeout(() => showSection('loginSection'), 2000);
    } catch (error) {
        showMessage('registerMessage', 'Registration failed: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
}

function logout() {
    console.log('Logging out...');
    window.location.href = `${API_BASE}/auth/logout`;
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
        const response = await fetch(`${API_BASE}/debug/session`, {
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
        const response = await fetch(`${API_BASE}/health`);
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
    console.log('API Base URL:', API_BASE);
    
    checkServer();
    checkAuth();
    checkUrlError();
    
    // Add some debug info to console
    console.log('Current page URL:', window.location.href);
    console.log('Available sections:', document.querySelectorAll('.section').length);
});