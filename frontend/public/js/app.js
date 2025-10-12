// FunStudy App - Clean Version
const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://funstudy-backend.onrender.com'
    : 'http://localhost:3002';
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

// Email validation function
function validateEmail(email) {
    // More strict email validation pattern
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email);
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
    const confirmPassword = document.getElementById('confirmPassword').value;
    const gradeLevel = document.getElementById('gradeLevel') ? document.getElementById('gradeLevel').value : 'GradeA';
    
    console.log('Registration form values:', { email, password: password ? '***' : '', confirmPassword: confirmPassword ? '***' : '', gradeLevel });
    
    if (!email || !password || !confirmPassword) {
        showMessage('registerMessage', 'Please fill in all fields', 'error');
        return;
    }
    
    // Validate email format
    if (!validateEmail(email)) {
        showMessage('registerMessage', 'Please enter a valid email address (e.g., user@example.com)', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showMessage('registerMessage', 'Passwords do not match', 'error');
        return;
    }
    
    if (password.length < 8) {
        showMessage('registerMessage', 'Password must be at least 8 characters', 'error');
        return;
    }
    
    // Check AWS Cognito password policy requirements
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSymbols) {
        showMessage('registerMessage', 'Password must contain uppercase, lowercase, numbers, and symbols (!@#$%^&*)', 'error');
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
            localStorage.setItem('registrationEmail', email);
            
            // Clear registration form
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('confirmPassword').value = '';
            if (document.getElementById('gradeLevel')) {
                document.getElementById('gradeLevel').value = 'GradeA';
            }
            
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
async function verifyEmail() {
    console.log('verifyEmail function called');
    
    const codeElement = document.getElementById('verificationCode');
    
    if (!codeElement) {
        console.error('Verification code element not found');
        showMessage('verificationMessage', 'Verification form not found', 'error');
        return;
    }
    
    const code = codeElement.value.trim();
    
    if (!code) {
        showMessage('verificationMessage', 'Please enter the verification code', 'error');
        return;
    }
    
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        showMessage('verificationMessage', 'Verification code must be exactly 6 digits', 'error');
        return;
    }
    
    // Get the email from storage (should be stored during registration)
    const email = localStorage.getItem('registrationEmail');
    if (!email) {
        showMessage('verificationMessage', 'Email not found. Please register again.', 'error');
        return;
    }
    
    showLoader();
    
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
        
        if (response.ok && data.success) {
            showMessage('verificationMessage', 'Email verified successfully! You can now login.', 'success');
            localStorage.removeItem('registrationEmail'); // Clean up
            // Clear the verification code
            codeElement.value = '';
            // Switch to login section after a delay
            setTimeout(() => showSection('loginSection'), 3000);
        } else {
            showMessage('verificationMessage', data.error || 'Verification failed. Please check your code.', 'error');
        }
    } catch (error) {
        console.error('Verification error:', error);
        showMessage('verificationMessage', 'Verification failed: ' + error.message, 'error');
    } finally {
        hideLoader();
    }
}

// Keep the old function name for backward compatibility
async function confirmEmail() {
    return verifyEmail();
}

async function resendVerificationCode() {
    // Get the email from storage
    const email = localStorage.getItem('registrationEmail');
    if (!email) {
        showMessage('verificationMessage', 'Email not found. Please register again.', 'error');
        return;
    }
    
    showLoader();
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/resend-confirmation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showMessage('verificationMessage', 'Verification code sent! Please check your email.', 'success');
        } else {
            showMessage('verificationMessage', data.error || 'Failed to resend code', 'error');
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        showMessage('verificationMessage', 'Failed to resend code: ' + error.message, 'error');
    } finally {
        hideLoader();
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

// Authentication check function
async function checkAuth() {
    try {
        console.log('🔍 Checking authentication status...');
        const response = await fetch(`${API_BASE_URL}/debug/session`, {
            credentials: 'include',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        
        console.log('Auth check response status:', response.status);
        
        if (response.ok) {
            const sessionData = await response.json();
            console.log('📊 Session data received:', sessionData);
            
            if (sessionData.isAuthenticated && sessionData.user) {
                console.log('✅ User is authenticated:', sessionData.user.email);
                showAuthenticatedUI(sessionData.user);
                return true;
            } else {
                console.log('❌ User is not authenticated');
                showUnauthenticatedUI();
                return false;
            }
        } else {
            console.warn('⚠️ Session check failed with status:', response.status);
            const errorText = await response.text();
            console.warn('Response text:', errorText);
            showUnauthenticatedUI();
            return false;
        }
    } catch (error) {
        console.error('💥 Authentication check error:', error);
        showUnauthenticatedUI();
        return false;
    }
}

// Show UI for authenticated users
function showAuthenticatedUI(user) {
    console.log('Showing authenticated UI for user:', user.email);
    
    // Update any user info displays
    const userInfoElements = document.querySelectorAll('.user-email');
    userInfoElements.forEach(element => {
        element.textContent = user.email;
    });
    
    // Show the grade selection section (main app)
    showSection('gradeSection');
    
    // Show logout button, hide login/register buttons
    const loginButtons = document.querySelectorAll('[onclick*="login"]');
    const registerButtons = document.querySelectorAll('[onclick*="showSection(\'registerSection\')"]');
    const logoutButtons = document.querySelectorAll('[onclick*="logout"]');
    
    loginButtons.forEach(btn => btn.style.display = 'none');
    registerButtons.forEach(btn => btn.style.display = 'none');
    logoutButtons.forEach(btn => btn.style.display = 'block');
}

// Show UI for unauthenticated users
function showUnauthenticatedUI() {
    console.log('Showing unauthenticated UI');
    
    // Show the login section
    showSection('loginSection');
    
    // Show login/register buttons, hide logout button
    const loginButtons = document.querySelectorAll('[onclick*="login"]');
    const registerButtons = document.querySelectorAll('[onclick*="showSection(\'registerSection\')"]');
    const logoutButtons = document.querySelectorAll('[onclick*="logout"]');
    
    loginButtons.forEach(btn => btn.style.display = 'block');
    registerButtons.forEach(btn => btn.style.display = 'block');
    logoutButtons.forEach(btn => btn.style.display = 'none');
}

// Grade selection functions
function selectGrade(grade) {
    currentGrade = grade;
    console.log('Selected grade:', grade);
    
    // Load subjects for this grade
    loadSubjects(grade);
    
    showSection('subjectSection');
}

// Load available subjects for a grade
async function loadSubjects(grade) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/quiz/subjects/${grade}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.subjects.length > 0) {
            displaySubjects(result.subjects);
        } else {
            // Fallback to hardcoded subjects if API doesn't return any
            console.log('No subjects from API, using fallback');
            displaySubjects(['Science', 'Maths', 'English', 'History']);
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
        // Fallback to hardcoded subjects
        displaySubjects(['Science', 'Maths', 'English', 'History']);
    }
}

// Display subjects in the UI
function displaySubjects(subjects) {
    const subjectOptions = document.getElementById('subject-options');
    if (subjectOptions) {
        subjectOptions.innerHTML = subjects.map(subject => {
            const subjectEmojis = {
                'Maths': '🔢',
                'Science': '🔬',
                'English': '📚',
                'History': '📜'
            };
            const emoji = subjectEmojis[subject] || '📚';
            return `<button class="btn grade-btn" onclick="selectSubject('${subject}')">${emoji} ${subject}</button>`;
        }).join('');
    }
}

// Subject selection functions  
function selectSubject(subject) {
    currentSubject = subject;
    console.log('Selected subject:', subject);
    
    showSection('difficultySection');
}

// Check URL for error parameters
function checkUrlError() {
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const authError = urlParams.get('auth_error');
    
    if (error) {
        console.log('URL error parameter:', error);
        showGenericMessage(`Authentication error: ${error}`, 'error');
    }
    
    if (authError) {
        console.log('Auth error parameter:', authError);
        showGenericMessage(`Login error: ${authError}`, 'error');
    }
}

// Difficulty selection and quiz functions
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let score = 0;

async function startQuiz(difficulty) {
    console.log('🎯 Starting quiz:', { grade: currentGrade, subject: currentSubject, difficulty });
    
    if (!currentGrade || !currentSubject) {
        showGenericMessage('Please select grade and subject first', 'error');
        return;
    }
    
    // Show loading state
    showSection('quizSection');
    showQuizLoading();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/quiz/questions/${currentGrade}/${currentSubject}/${difficulty}`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const quizData = await response.json();
            console.log('📚 Quiz data received:', quizData);
            
            if (quizData.success && quizData.questions && quizData.questions.length > 0) {
                // Initialize quiz state
                currentQuiz = quizData;
                currentQuestionIndex = 0;
                userAnswers = [];
                score = 0;
                
                // Display first question
                displayQuestion();
            } else {
                showQuizError(`No ${difficulty} questions available for ${currentGrade} ${currentSubject}`);
            }
        } else {
            const errorData = await response.json();
            console.log('❌ Quiz error data:', errorData);
            
            // Enhanced error handling with suggestions
            if (errorData.availableDifficulties && errorData.availableDifficulties.length > 0) {
                showQuizErrorWithSuggestions(
                    errorData.error || 'Failed to load quiz questions',
                    errorData.availableDifficulties,
                    difficulty
                );
            } else {
                showQuizError(errorData.error || 'Failed to load quiz questions');
            }
        }
    } catch (error) {
        console.error('Quiz loading error:', error);
        showQuizError('Network error while loading quiz');
    }
}

function showQuizLoading() {
    const quizContainer = document.getElementById('quizContainer');
    if (quizContainer) {
        quizContainer.innerHTML = `
            <div class="quiz-loading">
                <h3>📚 Loading Questions...</h3>
                <p>Preparing your ${currentSubject} quiz for ${currentGrade}</p>
                <div class="loading-spinner">⏳</div>
            </div>
        `;
    }
}

function showQuizError(message) {
    const quizContainer = document.getElementById('quizContainer');
    if (quizContainer) {
        quizContainer.innerHTML = `
            <div class="quiz-error">
                <h3>❌ Quiz Error</h3>
                <p>${message}</p>
                <button class="btn btn-secondary" onclick="showSection('difficultySection')">← Back to Difficulty</button>
            </div>
        `;
    }
}

function showQuizErrorWithSuggestions(message, availableDifficulties, requestedDifficulty) {
    const quizContainer = document.getElementById('quizContainer');
    if (quizContainer) {
        const suggestionButtons = availableDifficulties.map(diff => 
            `<button class="btn btn-primary" onclick="startQuiz('${diff}')" style="margin: 5px;">
                📚 Try ${diff.charAt(0).toUpperCase() + diff.slice(1)}
            </button>`
        ).join('');
        
        quizContainer.innerHTML = `
            <div class="quiz-error">
                <h3>📋 No ${requestedDifficulty.charAt(0).toUpperCase() + requestedDifficulty.slice(1)} Questions Available</h3>
                <p>${message}</p>
                <div style="margin: 20px 0;">
                    <p><strong>🎯 Available difficulties for ${currentGrade} ${currentSubject}:</strong></p>
                    ${suggestionButtons}
                </div>
                <button class="btn btn-secondary" onclick="showSection('difficultySection')">← Back to Difficulty Selection</button>
            </div>
        `;
    }
}

function displayQuestion() {
    if (!currentQuiz || !currentQuiz.questions) return;
    
    const question = currentQuiz.questions[currentQuestionIndex];
    const quizContainer = document.getElementById('quizContainer');
    
    if (quizContainer && question) {
        const isLastQuestion = currentQuestionIndex === currentQuiz.questions.length - 1;
        const isFirstQuestion = currentQuestionIndex === 0;
        
        quizContainer.innerHTML = `
            <div class="quiz-question">
                <div class="quiz-progress">
                    <span>Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${((currentQuestionIndex + 1) / currentQuiz.questions.length) * 100}%"></div>
                    </div>
                </div>
                
                <h3 class="question-text">${question.question}</h3>
                
                <div class="quiz-options">
                    ${question.options.map((option, index) => `
                        <button class="quiz-option btn" onclick="selectAnswer('${option}', ${index})" data-option="${index}">
                            ${String.fromCharCode(65 + index)}. ${option}
                        </button>
                    `).join('')}
                </div>
                
                <div class="quiz-controls">
                    <button class="btn btn-secondary" onclick="previousQuestion()" ${isFirstQuestion ? 'disabled' : ''}>
                        ← Previous
                    </button>
                    
                    <span class="quiz-info">Points: ${question.points || 10}</span>
                    
                    <button class="btn btn-primary" onclick="nextQuestion()" disabled id="nextBtn">
                        ${isLastQuestion ? '🎯 Finish Quiz' : 'Next →'}
                    </button>
                </div>
                
                <div class="quiz-exit">
                    <button class="btn btn-danger" onclick="showSection('difficultySection')">🚪 Exit Quiz</button>
                </div>
            </div>
        `;
        
        // Restore previous answer if it exists
        if (userAnswers[currentQuestionIndex]) {
            const savedAnswer = userAnswers[currentQuestionIndex];
            const options = document.querySelectorAll('.quiz-option');
            options.forEach((btn, idx) => {
                if (question.options[idx] === savedAnswer.selectedAnswer) {
                    btn.classList.add('selected');
                    document.getElementById('nextBtn').disabled = false;
                }
            });
        }
    }
}

function selectAnswer(answer, optionIndex) {
    const question = currentQuiz.questions[currentQuestionIndex];
    
    // Remove previous selection
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Highlight selected answer
    options[optionIndex].classList.add('selected');
    
    // Store the answer (without correct answer info - security improvement)
    userAnswers[currentQuestionIndex] = {
        questionId: question.questionId,
        selectedAnswer: answer
        // Note: No correctAnswer or isCorrect stored here for security
    };
    
    // Enable next button
    document.getElementById('nextBtn').disabled = false;
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    } else {
        // Quiz completed - verify answers with backend
        submitQuizAnswers();
    }
}

async function submitQuizAnswers() {
    try {
        // Show loading
        const quizContainer = document.getElementById('quizContainer');
        quizContainer.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <h3>🔍 Verifying your answers...</h3>
                <p>Please wait while we calculate your results.</p>
            </div>
        `;
        
        // Prepare answers for verification
        const answers = userAnswers.filter(answer => answer).map(answer => ({
            questionId: answer.questionId,
            selectedAnswer: answer.selectedAnswer
        }));
        
        const response = await fetch(`${API_BASE_URL}/api/quiz/verify-answers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                answers,
                grade: currentGrade,
                subject: currentSubject,
                difficulty: currentQuiz.metadata.difficulty
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Update our local data with verified results
            score = result.totalScore;
            userAnswers = result.results.map(r => ({
                questionId: r.questionId,
                selectedAnswer: r.selectedAnswer,
                correctAnswer: r.correctAnswer,
                isCorrect: r.isCorrect,
                points: r.points,
                question: r.question
            }));
            
            showQuizResults();
        } else {
            throw new Error(result.error || 'Failed to verify answers');
        }
        
    } catch (error) {
        console.error('Error verifying answers:', error);
        const quizContainer = document.getElementById('quizContainer');
        quizContainer.innerHTML = `
            <div class="error-container">
                <h3>❌ Error Verifying Answers</h3>
                <p>There was a problem verifying your quiz results.</p>
                <button class="btn btn-primary" onclick="showSection('difficultySection')">🔄 Try Again</button>
            </div>
        `;
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

function showQuizResults() {
    const totalQuestions = currentQuiz.questions.length;
    const correctAnswers = userAnswers.filter(answer => answer && answer.isCorrect).length;
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    
    let grade = 'F';
    let emoji = '😞';
    if (percentage >= 90) { grade = 'A+'; emoji = '🌟'; }
    else if (percentage >= 80) { grade = 'A'; emoji = '🎉'; }
    else if (percentage >= 70) { grade = 'B'; emoji = '😊'; }
    else if (percentage >= 60) { grade = 'C'; emoji = '🙂'; }
    else if (percentage >= 50) { grade = 'D'; emoji = '😐'; }
    
    // Generate detailed question review
    let questionReview = '';
    userAnswers.forEach((answer, index) => {
        if (answer) {
            const isCorrect = answer.isCorrect;
            questionReview += `
                <div class="question-result ${isCorrect ? 'correct' : 'incorrect'}">
                    <div class="question-number">Q${index + 1}</div>
                    <div class="question-content">
                        <p class="question-text">${answer.question}</p>
                        <p class="answer-info">
                            <span class="label">Your Answer:</span> 
                            <span class="${isCorrect ? 'correct' : 'incorrect'}">${answer.selectedAnswer}</span>
                        </p>
                        ${!isCorrect ? `<p class="answer-info"><span class="label">Correct Answer:</span> <span class="correct">${answer.correctAnswer}</span></p>` : ''}
                    </div>
                    <div class="points ${isCorrect ? 'earned' : 'missed'}">
                        ${isCorrect ? '+' : '0'}${answer.points || 10} pts
                    </div>
                </div>
            `;
        }
    });
    
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
        resultsContainer.innerHTML = `
            <div class="quiz-results">
                <h2>${emoji} Quiz Complete!</h2>
                <div class="score-display">
                    <div class="main-score">
                        <span class="score-number">${correctAnswers}/${totalQuestions}</span>
                        <span class="score-percentage">${percentage}%</span>
                        <span class="score-grade">Grade: ${grade}</span>
                    </div>
                    <div class="score-details">
                        <p>Total Points: ${score}</p>
                        <p>Subject: ${currentSubject}</p>
                        <p>Level: ${currentGrade}</p>
                    </div>
                </div>
                
                ${questionReview ? `
                    <div class="detailed-results">
                        <h3>📝 Question Review</h3>
                        ${questionReview}
                    </div>
                ` : ''}
                
                <div class="quiz-actions">
                    <button class="btn btn-primary" onclick="restartQuiz()">🔄 Try Again</button>
                    <button class="btn btn-secondary" onclick="showSection('difficultySection')">🎯 Choose Different Quiz</button>
                    <button class="btn btn-outline" onclick="showSection('gradeSection')">🏠 Main Menu</button>
                </div>
            </div>
        `;
    }
    
    showSection('resultsSection');
}

function restartQuiz() {
    // Reset quiz state
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    
    // Start the same quiz again
    if (currentQuiz && currentQuiz.metadata) {
        startQuiz(currentQuiz.metadata.difficulty);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 === FunStudy App Initialized ===');
    console.log('🌐 API Base URL:', API_BASE_URL);
    console.log('📍 Current page URL:', window.location.href);
    console.log('📑 Available sections:', document.querySelectorAll('.section').length);
    
    // Check server health first
    await checkServer();
    
    // Small delay to ensure any redirects have completed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check authentication status and show appropriate UI
    console.log('🔐 Checking authentication...');
    const isAuthenticated = await checkAuth();
    
    if (!isAuthenticated) {
        console.log('👤 User not authenticated, showing login section');
        showSection('loginSection');
        
        // If auth check failed, try again once after a short delay
        setTimeout(async () => {
            console.log('🔄 Retry authentication check...');
            const retryAuth = await checkAuth();
            if (!retryAuth) {
                console.log('🔑 Authentication retry failed, user needs to login');
            }
        }, 1000);
    }
    
    // Check for any URL parameters (like auth success/error)
    checkUrlError();
});
