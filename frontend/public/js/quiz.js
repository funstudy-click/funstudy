// Quiz state variables
let quizData = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let quizStartTime = null;
let currentDifficulty = '';

// Initialize quiz with questions data
function initializeQuiz(questions, difficulty) {
    console.log('Initializing quiz with', questions.length, 'questions');
    console.log('First question:', questions[0]);
    
    quizData = questions;
    currentQuestionIndex = 0;
    userAnswers = new Array(questions.length).fill(null);
    quizStartTime = new Date();
    currentDifficulty = difficulty;
    
    // Update quiz header
    document.getElementById('quiz-title').textContent = 
        `${currentGrade} ${currentSubject} (${difficulty})`;
    document.getElementById('total-questions').textContent = questions.length;
    document.getElementById('current-score').textContent = '0';
    
    // Load first question
    loadQuestion();
}

// Load current question
function loadQuestion() {
    const question = quizData[currentQuestionIndex];
    console.log('Loading question', currentQuestionIndex + 1, ':', question);
    
    // Update progress
    document.getElementById('current-question').textContent = currentQuestionIndex + 1;
    
    // Update question text
    document.getElementById('question-text').textContent = question.question;
    
    // Create options
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    if (question.options && Array.isArray(question.options)) {
        question.options.forEach((option, index) => {
            const optionBtn = document.createElement('button');
            optionBtn.className = 'option-btn';
            optionBtn.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
            optionBtn.onclick = () => selectOption(index, option);
            
            // Restore previous selection if any
            if (userAnswers[currentQuestionIndex] === option) {
                optionBtn.classList.add('selected');
            }
            
            optionsContainer.appendChild(optionBtn);
        });
    } else {
        console.error('Question options not found or invalid:', question);
        optionsContainer.innerHTML = '<p>Error: Question options not available</p>';
    }
    
    // Update navigation buttons
    updateNavigationButtons();
}

// Handle option selection
function selectOption(index, selectedAnswer) {
    console.log('Selected option:', index, selectedAnswer);
    
    // Update user answers
    userAnswers[currentQuestionIndex] = selectedAnswer;
    
    // Update UI
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    document.querySelectorAll('.option-btn')[index].classList.add('selected');
    
    // Enable next button
    updateNavigationButtons();
}

// Update navigation buttons state
function updateNavigationButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    // Previous button
    prevBtn.disabled = currentQuestionIndex === 0;
    
    // Next/Submit buttons
    const hasAnswer = userAnswers[currentQuestionIndex] !== null;
    const isLastQuestion = currentQuestionIndex === quizData.length - 1;
    
    if (isLastQuestion) {
        nextBtn.classList.add('hidden');
        if (hasAnswer) {
            submitBtn.classList.remove('hidden');
        } else {
            submitBtn.classList.add('hidden');
        }
    } else {
        nextBtn.classList.remove('hidden');
        nextBtn.disabled = !hasAnswer;
        submitBtn.classList.add('hidden');
    }
}

// Navigate to previous question
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion();
    }
}

// Navigate to next question
function nextQuestion() {
    if (currentQuestionIndex < quizData.length - 1) {
        currentQuestionIndex++;
        loadQuestion();
    }
}

// Submit quiz
async function submitQuiz() {
    console.log('Submitting quiz...');
    
    // Check if all questions are answered
    const unansweredQuestions = userAnswers.filter(answer => answer === null).length;
    if (unansweredQuestions > 0) {
        if (!confirm(`You have ${unansweredQuestions} unanswered questions. Submit anyway?`)) {
            return;
        }
    }
    
    showLoader();
    
    try {
        // Calculate results
        const results = calculateResults();
        
        // For now, we'll just display results without sending to server
        // TODO: Send results to server for storage
        
        // Show results
        displayResults(results);
        showSection('resultsSection');
        
    } catch (error) {
        console.error('Error submitting quiz:', error);
        alert('Error submitting quiz: ' + error.message);
    } finally {
        hideLoader();
    }
}

// Calculate quiz results
function calculateResults() {
    let correctCount = 0;
    let totalScore = 0;
    const maxScore = quizData.reduce((sum, q) => sum + (q.points || 10), 0);
    const questionResults = [];
    
    quizData.forEach((question, index) => {
        const userAnswer = userAnswers[index];
        const isCorrect = userAnswer === question.correctAnswer;
        const points = isCorrect ? (question.points || 10) : 0;
        
        if (isCorrect) correctCount++;
        totalScore += points;
        
        questionResults.push({
            question: question.question,
            userAnswer: userAnswer || 'Not answered',
            correctAnswer: question.correctAnswer,
            isCorrect: isCorrect,
            points: points,
            maxPoints: question.points || 10
        });
    });
    
    const percentage = Math.round((correctCount / quizData.length) * 100);
    const scorePercentage = Math.round((totalScore / maxScore) * 100);
    
    return {
        correctCount,
        totalQuestions: quizData.length,
        percentage,
        totalScore,
        maxScore,
        scorePercentage,
        questionResults,
        timeTaken: Math.round((new Date() - quizStartTime) / 1000), // in seconds
        grade: currentGrade,
        subject: currentSubject,
        difficulty: currentDifficulty
    };
}

// Display quiz results
function displayResults(results) {
    console.log('Displaying results:', results);
    
    // Update score display
    document.getElementById('final-score').textContent = results.percentage;
    document.getElementById('correct-answers').textContent = results.correctCount;
    document.getElementById('total-quiz-questions').textContent = results.totalQuestions;
    
    // Create results breakdown
    const breakdownContainer = document.getElementById('results-breakdown');
    breakdownContainer.innerHTML = '';
    
    // Add summary stats
    const summaryDiv = document.createElement('div');
    summaryDiv.innerHTML = `
        <h4>Quiz Summary</h4>
        <p><strong>Grade:</strong> ${results.grade}</p>
        <p><strong>Subject:</strong> ${results.subject}</p>
        <p><strong>Difficulty:</strong> ${results.difficulty}</p>
        <p><strong>Time Taken:</strong> ${formatTime(results.timeTaken)}</p>
        <p><strong>Score:</strong> ${results.totalScore}/${results.maxScore} points (${results.scorePercentage}%)</p>
        <hr style="margin: 20px 0;">
    `;
    breakdownContainer.appendChild(summaryDiv);
    
    // Add question breakdown
    results.questionResults.forEach((result, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.isCorrect ? 'correct' : 'incorrect'}`;
        
        resultItem.innerHTML = `
            <div class="result-question">
                <strong>Question ${index + 1}:</strong> ${result.question}
            </div>
            <div class="result-answer">
                <p><strong>Your Answer:</strong> ${result.userAnswer}</p>
                <p><strong>Correct Answer:</strong> ${result.correctAnswer}</p>
                <p><strong>Points:</strong> ${result.points}/${result.maxPoints}</p>
            </div>
        `;
        
        breakdownContainer.appendChild(resultItem);
    });
}

// Format time in minutes and seconds
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
}

// Restart the same quiz
function restartQuiz() {
    if (confirm('Are you sure you want to restart this quiz? Your current progress will be lost.')) {
        // Reset quiz state
        currentQuestionIndex = 0;
        userAnswers = new Array(quizData.length).fill(null);
        quizStartTime = new Date();
        
        // Load first question
        loadQuestion();
        showSection('quizSection');
    }
}

// Exit quiz and return to difficulty selection
function exitQuiz() {
    if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
        showSection('difficultySection');
        
        // Reset quiz state
        quizData = [];
        currentQuestionIndex = 0;
        userAnswers = [];
        quizStartTime = null;
    }
}

// Keyboard navigation
document.addEventListener('keydown', function(e) {
    // Only handle keyboard events when quiz is active
    if (!document.getElementById('quizSection').classList.contains('active')) {
        return;
    }
    
    switch(e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
            e.preventDefault();
            if (!document.getElementById('prev-btn').disabled) {
                previousQuestion();
            }
            break;
        case 'ArrowRight':
        case 'ArrowDown':
            e.preventDefault();
            if (!document.getElementById('next-btn').disabled) {
                nextQuestion();
            } else if (document.getElementById('submit-btn').classList.contains('hidden') === false) {
                submitQuiz();
            }
            break;
        case '1':
        case '2':
        case '3':
        case '4':
        case 'a':
        case 'b':
        case 'c':
        case 'd':
            e.preventDefault();
            const optionIndex = ['1', '2', '3', '4', 'a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase()) % 4;
            const options = document.querySelectorAll('.option-btn');
            if (options[optionIndex]) {
                options[optionIndex].click();
            }
            break;
        case 'Enter':
            e.preventDefault();
            if (document.getElementById('submit-btn').classList.contains('hidden') === false) {
                submitQuiz();
            } else if (!document.getElementById('next-btn').disabled) {
                nextQuestion();
            }
            break;
        case 'Escape':
            e.preventDefault();
            exitQuiz();
            break;
    }
});
