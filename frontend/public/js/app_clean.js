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

// Data loading functions
async function loadSubjects(grade) {
    console.log('Loading subjects for grade:', grade);
    showLoader();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/quiz/subjects/${grade}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('Subjects loaded:', data.subjects);
            displaySubjects(data.subjects);
        } else {
            console.error('Failed to load subjects:', data.error);
            showGenericMessage('Failed to load subjects. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
        showGenericMessage('Failed to connect to server. Please try again.', 'error');
    } finally {
        hideLoader();
    }
}

function displaySubjects(subjects) {
    const subjectOptionsContainer = document.getElementById('subject-options');
    
    if (!subjectOptionsContainer) {
        console.error('Subject options container not found');
        return;
    }
    
    // Clear existing subjects
    subjectOptionsContainer.innerHTML = '';
    
    if (subjects.length === 0) {
        subjectOptionsContainer.innerHTML = '<p class="no-data">No subjects available for this grade.</p>';
        return;
    }
    
    // Create subject buttons - Filter to only show Math subjects
    const allowedSubjects = ['Maths', 'Math', 'Mathematics'];
    const filteredSubjects = subjects.filter(subject => 
        allowedSubjects.some(allowed => 
            subject.toLowerCase().includes(allowed.toLowerCase())
        )
    );
    
    // Comment out Science and History subjects
    // const allSubjects = subjects; // Original unfiltered subjects
    
    if (filteredSubjects.length === 0) {
        subjectOptionsContainer.innerHTML = '<p class="no-data">Only Math subjects are currently available.</p>';
        return;
    }
    
    filteredSubjects.forEach(subject => {
        const subjectButton = document.createElement('button');
        subjectButton.className = 'btn subject-btn';
        subjectButton.textContent = `📖 ${subject}`;
        subjectButton.onclick = () => selectSubject(subject);
        subjectOptionsContainer.appendChild(subjectButton);
    });
}

async function loadDifficulties(grade, subject) {
    console.log('Loading difficulties for grade:', grade, 'subject:', subject);
    showLoader();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/quiz/difficulties/${grade}/${subject}`);
        const data = await response.json();
        
        if (data.success) {
            console.log('Difficulties loaded:', data.difficulties);
            displayDifficulties(data.difficulties);
        } else {
            console.error('Failed to load difficulties:', data.error);
            showGenericMessage('Failed to load difficulty levels. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error loading difficulties:', error);
        showGenericMessage('Failed to connect to server. Please try again.', 'error');
    } finally {
        hideLoader();
    }
}

function displayDifficulties(difficulties) {
    const difficultyOptionsContainer = document.getElementById('difficulty-options');
    
    if (!difficultyOptionsContainer) {
        console.error('Difficulty options container not found');
        return;
    }
    
    // Clear existing difficulties
    difficultyOptionsContainer.innerHTML = '';
    
    if (difficulties.length === 0) {
        difficultyOptionsContainer.innerHTML = '<p class="no-data">No difficulty levels available for this subject.</p>';
        return;
    }
    
    // Create difficulty buttons
    difficulties.forEach(difficulty => {
        const difficultyButton = document.createElement('button');
        difficultyButton.className = 'btn difficulty-btn';
        difficultyButton.textContent = `🎯 ${difficulty}`;
        difficultyButton.onclick = () => selectDifficulty(difficulty);
        difficultyOptionsContainer.appendChild(difficultyButton);
    });
}

// Authentication functions
async function login() {
    try {
        console.log('🔐 Starting login process...');
        // Add timestamp to prevent caching and force fresh login
        const timestamp = new Date().getTime();
        window.location.href = `${API_BASE_URL}/auth/login?t=${timestamp}`;
    } catch (error) {
        console.error('Login redirect error:', error);
        showMessage('loginMessage', 'Login redirect failed', 'error');
    }
}

async function register() {
    console.log('Register function called');
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    // Grade level dropdown is commented out, use default value
    const gradeLevelElement = document.getElementById('gradeLevel');
    const gradeLevel = gradeLevelElement ? gradeLevelElement.value : 'GradeA'; // Default to GradeA
    
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

async function logout() {
    try {
        showLoader();
        
        // Clear any local data first
        if (window.quizState) {
            delete window.quizState;
        }
        if (window.quizResults) {
            delete window.quizResults;
        }
        
        // Clear browser storage to ensure clean state
        try {
            localStorage.clear();
            sessionStorage.clear();
            console.log('Browser storage cleared');
        } catch (storageError) {
            console.log('Could not clear storage:', storageError);
        }
        
        // Call backend logout to destroy session
        try {
            const response = await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Backend logout response:', data);
            } else {
                console.log('Backend logout failed with status:', response.status);
            }
        } catch (backendError) {
            console.log('Backend logout failed, but continuing with frontend logout:', backendError);
        }
        
        // Clear frontend session and redirect to login
        console.log('✅ Logout successful');
        showGenericMessage('You have been logged out successfully!', 'success');
        
        // Clear URL parameters and redirect to clean login page
        setTimeout(() => {
            hideLoader();
            // Clear any auth parameters from URL
            window.history.replaceState({}, document.title, window.location.pathname);
            showSection('loginSection');
        }, 1500);
        
    } catch (error) {
        console.error('Logout error:', error);
        hideLoader();
        
        // Fallback: just clear frontend and show login
        showGenericMessage('Logged out successfully!', 'success');
        setTimeout(() => {
            showSection('loginSection');
        }, 1500);
    }
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
    loadSubjects(grade); // Load subjects for the selected grade
}

function selectSubject(subject) {
    currentSubject = subject;
    console.log('Subject selected:', subject);
    showSection('difficultySection');
    loadDifficulties(currentGrade, subject); // Load difficulties for the selected grade and subject
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
        // Use GET request with URL parameters instead of POST with body
        const response = await fetch(`${API_BASE_URL}/api/quiz/questions/${currentGrade}/${currentSubject}/${difficulty}`, {
            method: 'GET',
            credentials: 'include'
        });

        // Check if response is ok before parsing JSON
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.questions) {
            displayQuiz(data.questions);
        } else {
            console.error('Quiz API returned error:', data);
            showGenericMessage(data.error || 'Failed to load quiz questions', 'error');
        }
    } catch (error) {
        console.error('Quiz loading error:', error);
        if (error.message.includes('404')) {
            showGenericMessage('Quiz questions not found for this combination. Please try a different selection.', 'error');
        } else if (error.message.includes('HTTP error')) {
            showGenericMessage(`Server error: ${error.message}`, 'error');
        } else {
            showGenericMessage('Failed to load quiz. Please check your connection.', 'error');
        }
    } finally {
        hideLoader();
    }
}

function displayQuiz(questions) {
    console.log('Displaying quiz with questions:', questions);
    showSection('quizSection');
    
    const quizContainer = document.getElementById('quizContainer');
    if (!quizContainer) {
        console.error('Quiz container not found');
        return;
    }
    
    // Initialize quiz state
    window.quizState = {
        questions: questions,
        currentQuestion: 0,
        answers: {},
        score: 0,
        startTime: new Date()
    };
    
    // Render the first question
    renderQuestion();
}

function renderQuestion() {
    const { questions, currentQuestion, answers } = window.quizState;
    const question = questions[currentQuestion];
    const quizContainer = document.getElementById('quizContainer');
    
    const totalQuestions = questions.length;
    const progress = ((currentQuestion + 1) / totalQuestions) * 100;
    
    quizContainer.innerHTML = `
        <div class="quiz-header">
            <div class="quiz-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <span class="progress-text">Question ${currentQuestion + 1} of ${totalQuestions}</span>
            </div>
            <div class="quiz-info">
                <span class="quiz-subject">${currentSubject}</span>
                <span class="quiz-difficulty">${question.difficulty}</span>
                <span class="quiz-points">${question.points} pts</span>
            </div>
        </div>
        
        <div class="question-container">
            <h3 class="question-text">${question.question}</h3>
            
            <div class="options-container">
                ${question.options.map((option, index) => `
                    <button class="option-btn" data-option="${index}" onclick="selectAnswer(${index})">
                        ${option}
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div class="quiz-controls">
            ${currentQuestion > 0 ? `<button class="btn btn-secondary" onclick="previousQuestion()">⬅️ Previous</button>` : ''}
            <div class="control-buttons">
                ${currentQuestion < totalQuestions - 1 
                    ? `<button class="btn" onclick="nextQuestion()">Next ➡️</button>`
                    : `<button class="btn btn-primary" onclick="submitQuiz()">🏆 Submit Quiz</button>`
                }
            </div>
        </div>
    `;
    
    // Highlight previously selected answer if any
    if (answers[currentQuestion] !== undefined) {
        const selectedButton = quizContainer.querySelector(`[data-option="${answers[currentQuestion]}"]`);
        if (selectedButton) {
            selectedButton.classList.add('selected');
        }
    }
}

function selectAnswer(optionIndex) {
    const { currentQuestion } = window.quizState;
    
    // Update answer in quiz state
    window.quizState.answers[currentQuestion] = optionIndex;
    
    // Update UI to show selection
    const quizContainer = document.getElementById('quizContainer');
    const optionButtons = quizContainer.querySelectorAll('.option-btn');
    
    optionButtons.forEach((btn, index) => {
        btn.classList.remove('selected');
        if (index === optionIndex) {
            btn.classList.add('selected');
        }
    });
}

function nextQuestion() {
    const { questions, currentQuestion } = window.quizState;
    
    if (currentQuestion < questions.length - 1) {
        window.quizState.currentQuestion++;
        renderQuestion();
    }
}

function previousQuestion() {
    if (window.quizState.currentQuestion > 0) {
        window.quizState.currentQuestion--;
        renderQuestion();
    }
}

async function submitQuiz() {
    const { questions, answers, startTime } = window.quizState;
    const endTime = new Date();
    const timeTaken = Math.round((endTime - startTime) / 1000); // in seconds
    
    showLoader();
    
    try {
        // Prepare answers in the format expected by the backend
        const formattedAnswers = questions.map((question, index) => {
            const selectedIndex = answers[index];
            const selectedAnswerText = selectedIndex !== undefined ? question.options[selectedIndex] : null;
            
            return {
                questionId: question.questionId,
                selectedAnswer: selectedAnswerText // Send the actual answer text, not the index
            };
        });
        
        console.log('Quiz submission data:', {
            answers: formattedAnswers,
            grade: currentGrade,
            subject: currentSubject,
            difficulty: questions[0].difficulty,
            rawAnswers: answers
        });
        
        // Submit answers to backend for verification
        const response = await fetch(`${API_BASE_URL}/api/quiz/verify-answers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                answers: formattedAnswers,
                grade: currentGrade,
                subject: currentSubject,
                difficulty: questions[0].difficulty // Use difficulty from the first question
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('Backend response:', data);
        
        if (data.success) {
            // Calculate percentage and correct answers from backend results
            const correctAnswers = data.results.filter(result => result.isCorrect).length;
            const percentage = Math.round((correctAnswers / questions.length) * 100);
            
            console.log('Score calculation:', {
                correctAnswers,
                totalQuestions: questions.length,
                percentage,
                totalScore: data.totalScore
            });
            
            // Store results and show results section
            window.quizResults = {
                correctAnswers,
                totalQuestions: questions.length,
                percentage,
                totalPoints: data.totalScore,
                timeTaken,
                answers,
                questions,
                detailedResults: data.results // Include detailed results from backend
            };
            
            displayResults();
        } else {
            showGenericMessage(data.error || 'Failed to submit quiz', 'error');
        }
    } catch (error) {
        console.error('Quiz submission error:', error);
        showGenericMessage('Failed to submit quiz. Please try again.', 'error');
    } finally {
        hideLoader();
    }
}

function displayResults() {
    const results = window.quizResults;
    showSection('resultsSection');
    
    // Determine performance message
    let performanceMessage = '';
    let performanceIcon = '';
    if (results.percentage >= 90) {
        performanceMessage = 'Excellent work!';
        performanceIcon = '🏆';
    } else if (results.percentage >= 70) {
        performanceMessage = 'Good job!';
        performanceIcon = '👏';
    } else if (results.percentage >= 50) {
        performanceMessage = 'Keep practicing!';
        performanceIcon = '💪';
    } else {
        performanceMessage = 'Need more study!';
        performanceIcon = '📚';
    }
    
    const resultsContainer = document.getElementById('resultsContainer');
    resultsContainer.innerHTML = `
        <div class="results-header">
            <h2>${performanceIcon} Quiz Complete!</h2>
            <p class="performance-message">${performanceMessage}</p>
            <div class="score-display">
                <div class="score-circle">
                    <span class="score-percentage">${results.percentage}%</span>
                </div>
                <div class="score-details">
                    <p>✅ Correct: ${results.correctAnswers}/${results.totalQuestions}</p>
                    <p>⭐ Points: ${results.totalPoints}</p>
                    <p>⏱️ Time: ${Math.floor(results.timeTaken / 60)}:${(results.timeTaken % 60).toString().padStart(2, '0')}</p>
                </div>
            </div>
        </div>
        
        ${results.detailedResults ? `
            <div class="detailed-results">
                <h3>📊 Question Details</h3>
                <div class="question-results">
                    ${results.detailedResults.map((result, index) => `
                        <div class="question-result ${result.isCorrect ? 'correct' : 'incorrect'}">
                            <div class="question-summary">
                                <span class="question-number">Q${index + 1}</span>
                                <span class="result-icon">${result.isCorrect ? '✅' : '❌'}</span>
                                <span class="points">${result.points} pts</span>
                            </div>
                            <div class="question-text">${result.question}</div>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-secondary" onclick="toggleDetailedResults()">Hide Details</button>
            </div>
        ` : ''}
        
        <div class="results-actions">
            <button class="btn" onclick="retakeQuiz()">🔄 Try Again</button>
            <button class="btn btn-secondary" onclick="goHome()">🏠 Back to Home</button>
        </div>
    `;
}

function retakeQuiz() {
    // Reset quiz state and restart with same parameters
    startQuiz(window.quizState.questions[0].difficulty);
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

// Server health check with retry logic for Render cold starts
async function checkServer() {
    try {
        // Add timeout and retry logic for Render cold starts
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(`${API_BASE_URL}/health`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            console.log('✅ Server is running and accessible');
            const data = await response.json();
            console.log('Server status:', data);
        } else {
            console.warn('⚠️ Server responded but with status:', response.status);
            showGenericMessage(`Server returned status ${response.status}. Please try again.`, 'warning');
        }
    } catch (error) {
        console.error('❌ Server health check failed:', error);
        
        if (error.name === 'AbortError') {
            showGenericMessage('Server is starting up (this may take 10-30 seconds on first visit). Please wait and try again.', 'warning');
        } else {
            showGenericMessage('Server connection failed. The server may be starting up. Please wait a moment and try again.', 'warning');
        }
    }
}

// Initialize app - SINGLE DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FunStudy App Initialized ===');
    console.log('API Base URL:', API_BASE_URL);
    console.log('Current page URL:', window.location.href);
    console.log('Available sections:', document.querySelectorAll('.section').length);
    
    // Check for auth callback parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const hasAuthCallback = urlParams.get('auth') || urlParams.get('error');
    
    // Handle auth callback first if present
    if (hasAuthCallback) {
        handleAuthCallback();
    } else {
        // Show default login section only if no auth callback
        showSection('loginSection');
    }
    
    // Check server health
    checkServer();
});