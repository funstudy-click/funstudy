// FunStudy App - Clean Version
const API_BASE_URL = window.location.hostname === 'localhost' ? 
    'http://localhost:3002' : 
    'https://funstudy-backend.onrender.com';
const SUBSCRIPTION_PLAN_METADATA = {
    'P-40D15785KF4126507NHQPRZY': { type: 'monthly', amount: null },
    'P-8Y97299421124160VNHQPS7Y': { type: 'yearly', amount: null }
};
let currentGrade = '';
let currentSubject = '';

function getSubscriptionPlanMetadata(planId) {
    return SUBSCRIPTION_PLAN_METADATA[planId] || { type: 'monthly', amount: null };
}

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
        
        // Initialize PayPal when showing subscription section
        if (sectionId === 'subscriptionSection') {
            // Check if user already has subscription
            if (checkSubscriptionStatus()) {
                // Skip payment screen entirely for subscribed users.
                setTimeout(() => showSection('gradeSection'), 0);
                return;
            }
            
            // Check if PayPal container exists
            const monthlyContainer = document.getElementById('paypal-button-container-P-40D15785KF4126507NHQPRZY');
            const yearlyContainer = document.getElementById('paypal-button-container-P-8Y97299421124160VNHQPS7Y');
            
            if (!monthlyContainer || !yearlyContainer) {
                console.error('❌ PayPal button container not found!');
                showGenericMessage('PayPal integration error: button container missing', 'error');
                return;
            }
            
            console.log('🎯 PayPal subscription containers found');
            
            // PayPal buttons will initialize automatically via the inline scripts
        }
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
        // Change Math to Maths for display
        const displaySubject = subject === 'Math' ? 'Maths' : subject;
        subjectButton.textContent = `📖 ${displaySubject}`;
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
        // Capitalize first letter of difficulty
        const capitalizedDifficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        difficultyButton.textContent = `🎯 ${capitalizedDifficulty}`;
        difficultyButton.onclick = () => selectDifficulty(difficulty);
        difficultyOptionsContainer.appendChild(difficultyButton);
    });
}

// Authentication functions
async function login() {
    try {
        console.log('🔐 Starting login process...');

        // If already subscribed on this device, skip payment screen after login.
        if (checkSubscriptionStatus()) {
            showSection('gradeSection');
            return;
        }
        
        // Local development bypass
        if (window.location.hostname === 'localhost') {
            console.log('🏠 Local development - bypassing authentication');
            showMessage('loginMessage', '✅ Local development mode - skipping authentication', 'success');
            setTimeout(() => {
                if (checkSubscriptionStatus()) {
                    showSection('gradeSection');
                } else {
                    showSection('subscriptionSection');
                }
            }, 1500);
            return;
        }
        
        // Production authentication
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
            // Store user email for PayPal integration
            localStorage.setItem('userEmail', email);
            
            showMessage('registerMessage', 'Registration successful! Please check your email for verification code.', 'success');
            
            const verificationEmailElement = document.getElementById('verificationEmail');
            if (verificationEmailElement) {
                verificationEmailElement.value = email;
            }
            
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';
            if (gradeLevelElement) {
                gradeLevelElement.value = 'GradeA';
            }
            
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
        
        // Clear browser storage but preserve subscription for the same returning user.
        try {
            const savedSubscription = localStorage.getItem('funstudySubscription');
            const savedUserEmail = localStorage.getItem('userEmail');
            localStorage.clear();
            if (savedSubscription) {
                localStorage.setItem('funstudySubscription', savedSubscription);
            }
            if (savedUserEmail) {
                localStorage.setItem('userEmail', savedUserEmail);
            }
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
        
        // Simple frontend logout without Cognito session interference
        console.log('✅ Logout successful');
        showGenericMessage('You have been logged out successfully!', 'success');
        
        // Clean redirect to login page
        setTimeout(() => {
            hideLoader();
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

    if (!codeElement) {
        showGenericMessage('Verification form elements not found', 'error');
        return;
    }

    // Get email from hidden field, or fall back to what was stored during registration
    const email = (emailElement && emailElement.value.trim())
        || localStorage.getItem('userEmail')
        || '';
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

    const email = (emailElement && emailElement.value.trim())
        || localStorage.getItem('userEmail')
        || '';

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
    console.log('✅ Grade selected:', grade);
    console.log('Current grade set to:', currentGrade);
    showSection('subjectSection');
    loadSubjects(grade); // Load subjects for the selected grade
}

function selectSubject(subject) {
    currentSubject = subject;
    console.log('✅ Subject selected:', subject);
    console.log('Current subject set to:', currentSubject);
    showSection('difficultySection');
    loadDifficulties(currentGrade, subject); // Load difficulties for the selected grade and subject
}

function selectDifficulty(difficulty) {
    console.log('Difficulty selected:', difficulty);
    console.log('Current state:', { grade: currentGrade, subject: currentSubject, difficulty });
    
    // Validate we have all required parameters
    if (!currentGrade || !currentSubject || !difficulty) {
        console.error('Missing required parameters:', { grade: currentGrade, subject: currentSubject, difficulty });
        showGenericMessage('Please select grade and subject first', 'error');
        return;
    }
    
    startQuiz(difficulty);
}

function goHome() {
    showSection('gradeSection');
}

// PayPal Integration Functions (Simplified for Hosted Button)
// The PayPal hosted button handles all payment processing automatically
// No additional JavaScript initialization is required

function getCurrentUserEmail() {
    // Try to get email from various sources
    // This might need to be adapted based on how you store user info
    const verificationEmail = document.getElementById('verificationEmail');
    if (verificationEmail && verificationEmail.value) {
        return verificationEmail.value;
    }
    
    const registerEmail = document.getElementById('registerEmail');
    if (registerEmail && registerEmail.value) {
        return registerEmail.value;
    }
    
    // Fallback - you might want to store this in localStorage after login
    return localStorage.getItem('userEmail') || 'user@example.com';
}

function checkSubscriptionStatus() {
    const subscription = localStorage.getItem('funstudySubscription');
    if (subscription) {
        try {
            const subscriptionData = JSON.parse(subscription);
            if (subscriptionData.status === 'ACTIVE') {
                console.log('User has active subscription:', subscriptionData.id);
                return true;
            }
        } catch (error) {
            console.error('Error parsing subscription data:', error);
            localStorage.removeItem('funstudySubscription');
        }
    }
    return false;
}

async function refreshSubscriptionStatusFromServer() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/paypal/subscription-status`, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            return checkSubscriptionStatus();
        }

        const data = await response.json();
        if (!data.success) {
            return checkSubscriptionStatus();
        }

        if (data.isSubscribed) {
            const current = JSON.parse(localStorage.getItem('funstudySubscription') || '{}');
            const metadata = getSubscriptionPlanMetadata(data.planId || current.planId);
            localStorage.setItem('funstudySubscription', JSON.stringify({
                id: data.subscriptionId || current.id || 'server-sync',
                type: data.type || current.type || metadata.type,
                amount: data.amount || current.amount || metadata.amount,
                status: 'ACTIVE',
                planId: data.planId || current.planId || null,
                nextBillingTime: data.nextBillingTime || null,
                lastPaymentTime: data.lastPaymentTime || null,
                source: 'server'
            }));
            return true;
        }

        localStorage.removeItem('funstudySubscription');
        return false;
    } catch (error) {
        console.warn('Subscription status sync failed:', error.message);
        return checkSubscriptionStatus();
    }
}

// Skip subscription and continue with limited access
function skipSubscription() {
    console.log('User skipped subscription');
    showSection('gradeSection');
    showGenericMessage('Continuing with limited access. Subscribe anytime for full features!', 'info');
}

function goBack() {
    const currentSection = document.querySelector('.section.active');
    if (currentSection) {
        const sectionId = currentSection.id;
        switch (sectionId) {
            case 'gradeSection':
                showSection('subscriptionSection');
                break;
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
    console.log('🎯 Starting quiz with:', { grade: currentGrade, subject: currentSubject, difficulty });
    showLoader();
    try {
        // Check user subscription status
        const subscriptionData = localStorage.getItem('funstudySubscription');
        const isSubscribed = subscriptionData ? JSON.parse(subscriptionData).status === 'ACTIVE' : false;
        
        console.log(`Starting quiz for ${isSubscribed ? 'SUBSCRIBED' : 'NON-SUBSCRIBED'} user`);
        
        // Pass subscription state as query params so backend can reliably apply limits.
        const questionCount = isSubscribed ? 25 : 5;
        const apiUrl = `${API_BASE_URL}/api/quiz/questions/${currentGrade}/${currentSubject}/${difficulty}?subscribed=${isSubscribed}&questionCount=${questionCount}`;
        console.log('API URL:', apiUrl);
        
        let response;
        try {
            // Primary attempt - direct API call
            response = await fetch(apiUrl, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'x-user-subscribed': String(isSubscribed),
                    'subscription-status': isSubscribed ? 'active' : 'inactive'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        } catch (corsError) {
            console.warn('Direct API call failed, trying CORS proxy:', corsError);
            
            // Fallback: Use a CORS proxy for testing
            const proxyUrl = `https://cors-anywhere.herokuapp.com/${apiUrl}`;
            response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'x-user-subscribed': String(isSubscribed),
                    'subscription-status': isSubscribed ? 'active' : 'inactive'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Proxy request failed! status: ${response.status}`);
            }
            
            console.log('✅ CORS proxy request successful');
        }

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Quiz data received:', data);
        
        if (data.success && data.questions) {
            // Show simple message for non-subscribed users
            if (!isSubscribed) {
                showGenericMessage(`📚 Free Preview: ${data.questions.length} sample questions. Subscribe for more!`, 'info');
            }
            
            displayQuiz(data.questions);
        } else {
            console.error('Quiz API returned error:', data);
            showGenericMessage(data.error || 'Failed to load quiz questions', 'error');
        }
    } catch (error) {
        console.error('Quiz loading error details:', error);
        console.error('Error stack:', error.stack);
        
        // Specific error handling
        if (error.message.includes('CORS')) {
            showGenericMessage('Connection blocked. Please try again in a few minutes as the server is updating.', 'error');
        } else if (error.message.includes('404')) {
            showGenericMessage('Quiz questions not found for this combination. Please try a different selection.', 'error');
        } else if (error.message.includes('Failed to fetch')) {
            showGenericMessage('Network connection error. Please check your internet connection and try again.', 'error');
        } else {
            showGenericMessage('Failed to load quiz. The server may be updating - please try again in a moment.', 'error');
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
        startTime: new Date(),
        timeRemaining: questions.length <= 5 ? 5 * 60 : 30 * 60, // 5 minutes for 5 questions, 30 minutes for more
        isPaused: false,
        timerInterval: null,
        isSubmitting: false
    };
    
    // Render the first question
    renderQuestion();
    
    // Start the timer
    startTimer();
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
            <div class="quiz-timer">
                <div class="timer-display" id="timerDisplay">
                    <span class="timer-icon">⏰</span>
                    <span class="timer-text" id="timerText">${questions.length <= 5 ? '5:00' : '30:00'}</span>
                </div>
            </div>
            <div class="quiz-info">
                <span class="quiz-subject">${currentSubject}</span>
                <span class="quiz-difficulty">${question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}</span>
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
                    : `<button class="btn btn-primary" id="submitBtn" onclick="submitQuiz()">🏆 Submit Quiz</button>`
                }
            </div>
        </div>
        
        <div class="timer-controls-bottom">
            <button class="btn btn-secondary timer-btn" id="pauseBtn" onclick="pauseTimer()">⏸️ Pause</button>
            <button class="btn btn-secondary timer-btn" id="resumeBtn" onclick="resumeTimer()" style="display: none;">▶️ Resume</button>
            <button class="btn btn-danger timer-btn" onclick="stopQuiz()">🛑 Stop Test</button>
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
    const { questions, currentQuestion, answers } = window.quizState;
    
    // Check if user has selected an answer for current question
    if (answers[currentQuestion] === undefined) {
        showGenericMessage('⚠️ Please select an answer before proceeding to the next question.', 'error');
        return;
    }
    
    // Auto-resume if quiz was paused
    if (window.quizState.isPaused) {
        resumeTimer();
    }
    
    if (currentQuestion < questions.length - 1) {
        window.quizState.currentQuestion++;
        renderQuestion();
    }
}

function previousQuestion() {
    // Auto-resume if quiz was paused
    if (window.quizState.isPaused) {
        resumeTimer();
    }
    
    if (window.quizState.currentQuestion > 0) {
        window.quizState.currentQuestion--;
        renderQuestion();
    }
}

async function submitQuiz() {
    const { questions, answers, startTime, currentQuestion } = window.quizState;
    
    // Prevent double submission
    if (window.quizState.isSubmitting) {
        console.log('Quiz submission already in progress, ignoring duplicate click');
        return;
    }
    
    // Check if user has selected an answer for the final question
    if (answers[currentQuestion] === undefined) {
        showGenericMessage('⚠️ Please select an answer before submitting the quiz.', 'error');
        return;
    }
    
    // Mark as submitting to prevent duplicate submissions
    window.quizState.isSubmitting = true;
    
    // Disable submit button visually
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Submitting...';
        submitBtn.style.opacity = '0.6';
    }
    
    // Stop the timer
    clearInterval(window.quizState.timerInterval);
    
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
        // Reset submission flag and hide loader
        if (window.quizState) {
            window.quizState.isSubmitting = false;
        }
        
        // Re-enable submit button
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🏆 Submit Quiz';
            submitBtn.style.opacity = '1';
        }
        
        hideLoader();
    }
}

function displayResults() {
    const results = window.quizResults;
    const isSubscribed = checkSubscriptionStatus();
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
    
    // Subscription upgrade message for non-subscribers
    const subscriptionPrompt = !isSubscribed ? `
        <div class="subscription-upgrade-prompt" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0;">🚀 Want More Questions?</h3>
            <p style="margin: 0 0 15px 0;">You completed ${results.totalQuestions} sample questions. Subscribers get access to hundreds more!</p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button class="btn" onclick="showSection('subscriptionSection')" style="background: #10b981; border: none; color: white;">📅 Subscribe Monthly</button>
                <button class="btn" onclick="showSection('subscriptionSection')" style="background: #f59e0b; border: none; color: white;">🎓 Subscribe Yearly</button>
            </div>
        </div>
    ` : `
        <div class="subscriber-benefits" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px; border-radius: 10px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 5px 0;">✅ Premium Member</h3>
            <p style="margin: 0;">You have access to the full question bank with randomized questions!</p>
        </div>
    `;
    
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
        
        ${subscriptionPrompt}
        
        ${results.detailedResults ? `
            <div class="detailed-results-container">
                <button class="btn btn-secondary" onclick="toggleDetailedResults()">Hide Details</button>
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
                </div>
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
        refreshSubscriptionStatusFromServer().then(isSubscribed => {
            if (isSubscribed) {
                showSection('gradeSection');
                showGenericMessage('Welcome back! Subscription active.', 'success');
            } else {
                showSection('subscriptionSection');
                showGenericMessage('Login successful! Please choose your subscription to access quizzes!', 'success');
            }
        });
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
        console.error('❌ Server check failed:', error);
        return false;
    }
}

// Timer Functions
function startTimer() {
    if (window.quizState.timerInterval) {
        clearInterval(window.quizState.timerInterval);
    }
    
    window.quizState.timerInterval = setInterval(() => {
        if (!window.quizState.isPaused && window.quizState.timeRemaining > 0) {
            window.quizState.timeRemaining--;
            updateTimerDisplay();
            
            if (window.quizState.timeRemaining <= 0) {
                timeUp();
            }
        }
    }, 1000);
    
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const timerText = document.getElementById('timerText');
    if (timerText) {
        const minutes = Math.floor(window.quizState.timeRemaining / 60);
        const seconds = window.quizState.timeRemaining % 60;
        timerText.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Change color when time is running low
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) {
            if (window.quizState.timeRemaining <= 300) { // 5 minutes
                timerDisplay.classList.add('timer-warning');
            }
            if (window.quizState.timeRemaining <= 60) { // 1 minute
                timerDisplay.classList.add('timer-danger');
            }
        }
    }
}

function pauseTimer() {
    if (!window.quizState.isPaused) {
        window.quizState.isPaused = true;
        document.getElementById('pauseBtn').style.display = 'none';
        document.getElementById('resumeBtn').style.display = 'inline-block';
        showGenericMessage('⏸️ Quiz paused. Click Resume to continue.', 'success');
    }
}

function resumeTimer() {
    if (window.quizState.isPaused) {
        window.quizState.isPaused = false;
        const pauseBtn = document.getElementById('pauseBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        
        if (pauseBtn) pauseBtn.style.display = 'inline-block';
        if (resumeBtn) resumeBtn.style.display = 'none';
        
        showGenericMessage('▶️ Quiz resumed. Timer is now active.', 'success');
        
        // Ensure timer display is updated
        updateTimerDisplay();
    }
}

function stopQuiz() {
    if (confirm('⚠️ Are you sure you want to stop the test? Your current progress will be lost.')) {
        clearInterval(window.quizState.timerInterval);
        window.quizState = null;
        showGenericMessage('🛑 Quiz stopped. Returning to grade selection.', 'success');
        showSection('gradeSection');
    }
}

function timeUp() {
    clearInterval(window.quizState.timerInterval);
    showGenericMessage('⏰ Time\'s up! Automatically submitting your quiz.', 'warning');
    
    // Auto-submit the quiz with current answers
    setTimeout(() => {
        submitQuiz();
    }, 2000);
}

// Toggle detailed results visibility
function toggleDetailedResults() {
    const detailsDiv = document.querySelector('.detailed-results');
    const button = document.querySelector('button[onclick="toggleDetailedResults()"]');
    
    if (detailsDiv && button) {
        if (detailsDiv.style.display === 'none') {
            detailsDiv.style.display = 'block';
            button.textContent = 'Hide Details';
        } else {
            detailsDiv.style.display = 'none';
            button.textContent = 'Show Details';
        }
    }
}

// Test backend connectivity
async function testBackendConnection() {
    try {
        console.log('Testing backend connection...');
        const response = await fetch(`${API_BASE_URL}/health`, { 
            method: 'GET',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            console.log('✅ Backend connection successful');
            return true;
        } else {
            console.log('❌ Backend returned error:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ Backend connection failed:', error.message);
        return false;
    }
}

// Initialize app - SINGLE DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FunStudy App Initialized ===');
    console.log('API Base URL:', API_BASE_URL);
    console.log('Current page URL:', window.location.href);
    console.log('Available sections:', document.querySelectorAll('.section').length);
    
    // Show local development notice if running locally
    if (window.location.hostname === 'localhost') {
        const localDevNotice = document.querySelector('.local-dev-notice');
        if (localDevNotice) {
            localDevNotice.style.display = 'block';
        }
    }
    
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
    testBackendConnection();
    
    // Check existing subscription
    checkSubscriptionStatus();
    refreshSubscriptionStatusFromServer();
    checkServer();

    window.addEventListener('focus', function() {
        refreshSubscriptionStatusFromServer();
    });
});