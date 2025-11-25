const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.getQuestions = async (req, res) => {
    try {
        const { grade, subject, difficulty } = req.params;
        console.log('Received parameters:', { grade, subject, difficulty });
        
        const tableName = `${grade}_${subject}_Questions`;
        console.log('Table name:', tableName);
        
        // First, let's check if the table exists
        try {
            const tableInfo = await dynamodb.describeTable({ TableName: tableName }).promise();
            console.log('Table exists:', tableName);
        } catch (tableError) {
            console.error('Table does not exist or is not accessible:', tableName, tableError.message);
            return res.status(404).json({ 
                success: false, 
                error: `Table ${tableName} not found. Please check your table name or create the table first.`,
                debug: {
                    tableName,
                    parameters: { grade, subject, difficulty }
                }
            });
        }
        
        const params = {
            TableName: tableName,
            FilterExpression: 'difficulty = :difficulty',
            ExpressionAttributeValues: { ':difficulty': difficulty }
        };
        
        console.log('DynamoDB scan params:', JSON.stringify(params, null, 2));
        
        const data = await dynamodb.scan(params).promise();
        console.log('Raw DynamoDB response:', {
            Count: data.Count,
            ScannedCount: data.ScannedCount,
            ItemCount: data.Items ? data.Items.length : 0
        });
        
        if (!data.Items || data.Items.length === 0) {
            console.log(`No ${difficulty} questions found for ${grade} ${subject}`);
            
            // Check what difficulties are available in this table
            const allItemsParams = {
                TableName: tableName
            };
            
            try {
                const allData = await dynamodb.scan(allItemsParams).promise();
                const availableDifficulties = [...new Set(allData.Items.map(item => item.difficulty))];
                
                return res.status(404).json({ 
                    success: false, 
                    error: `No ${difficulty} questions found for ${grade} ${subject}`,
                    totalQuestionsInTable: allData.Count,
                    availableDifficulties: availableDifficulties,
                    suggestion: availableDifficulties.length > 0 
                        ? `Questions exist but not with the requested difficulty level`
                        : "Table exists but contains no questions"
                });
            } catch (scanError) {
                return res.status(404).json({ 
                    success: false, 
                    error: `No ${difficulty} questions found for ${grade} ${subject}`,
                    suggestion: "Check if your table has data or if the difficulty value matches exactly"
                });
            }
        }
        
        // Generate session ID for unique question tracking
        const sessionId = req.sessionID || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Get 30 unique questions using enhanced randomization
        const selectedQuestions = this.getUniqueQuestions(data.Items, sessionId, 30);
        
        // Remove correct answers before sending to client
        const questionsWithoutAnswers = selectedQuestions.map(q => ({
            questionId: q.questionId,
            question: q.question,
            options: q.options,
            difficulty: q.difficulty,
            points: q.points
        }));
        
        console.log('Successfully returning questions:', questionsWithoutAnswers.length);
        
        // Get all available difficulties for reference
        const allItemsParams = {
            TableName: tableName
        };
        
        let availableDifficulties = [];
        try {
            const allData = await dynamodb.scan(allItemsParams).promise();
            availableDifficulties = [...new Set(allData.Items.map(item => item.difficulty))];
        } catch (scanError) {
            console.log('Could not fetch available difficulties:', scanError.message);
        }
        
        res.json({ 
            success: true, 
            questions: questionsWithoutAnswers,
            count: questionsWithoutAnswers.length,
            totalAvailable: data.Count,
            metadata: {
                grade,
                subject,
                difficulty,
                tableName,
                availableDifficulties
            }
        });
    } catch (error) {
        console.error('Get questions error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch questions',
            debug: {
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
                parameters: req.params
            }
        });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        const { grade, subject, difficulty, answers } = req.body;
        const userId = req.session.user.sub;
        
        // Get correct answers from database
        const correctAnswers = await getCorrectAnswers(grade, subject, answers);
        
        // Calculate score
        const score = calculateScore(answers, correctAnswers);
        const totalPossible = calculateTotalPossible(correctAnswers);
        const percentage = Math.round((score / totalPossible) * 100);
        const gradeLetter = calculateGrade(percentage);
        
        // Save attempt
        const attemptId = await saveQuizAttempt(
            userId, grade, subject, difficulty, 
            answers, score, totalPossible, percentage, gradeLetter
        );
        
        res.json({ 
            success: true, 
            attemptId, 
            score, 
            totalPossible, 
            percentage, 
            grade: gradeLetter 
        });
    } catch (error) {
        console.error('Submit quiz error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to submit quiz',
            debug: {
                message: error.message,
                body: req.body
            }
        });
    }
};

async function getCorrectAnswers(grade, subject, userAnswers) {
    const tableName = `${grade}_${subject}_Questions`;
    const questionIds = userAnswers.map(a => a.questionId);
    
    // Use batchGet instead of scan with filter for better performance
    const keys = questionIds.map(id => ({ questionId: id }));
    
    const params = {
        RequestItems: {
            [tableName]: {
                Keys: keys
            }
        }
    };
    
    try {
        const data = await dynamodb.batchGet(params).promise();
        return data.Responses[tableName] || [];
    } catch (error) {
        console.error('Error getting correct answers:', error);
        throw error;
    }
}

function calculateScore(userAnswers, correctAnswers) {
    let score = 0;
    
    userAnswers.forEach(userAnswer => {
        const correctAnswer = correctAnswers.find(ca => ca.questionId === userAnswer.questionId);
        if (correctAnswer && userAnswer.answer === correctAnswer.correctAnswer) {
            score += correctAnswer.points || 10;
        }
    });
    
    return score;
}

function calculateTotalPossible(correctAnswers) {
    return correctAnswers.reduce((total, question) => total + (question.points || 10), 0);
}

function calculateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

async function saveQuizAttempt(userId, grade, subject, difficulty, answers, score, totalPossible, percentage, gradeLetter) {
    const attemptId = `${userId}_${Date.now()}`;
    
    const params = {
        TableName: 'UserAttempts',
        Item: {
            attemptId,
            userId,
            grade,
            subject,
            difficulty,
            answers,
            score,
            totalPossible,
            percentage,
            grade: gradeLetter,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString()
        }
    };
    
    await dynamodb.put(params).promise();
    return attemptId;
}

// Enhanced shuffle algorithm for better randomization
exports.shuffleArray = function(array) {
    const shuffled = [...array];
    
    // Fisher-Yates shuffle algorithm for better randomization
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
};

// Session tracking for preventing duplicate questions
const sessionQuestions = new Map();

exports.getUniqueQuestions = function(allQuestions, sessionId, count = 30) {
    const sessionKey = `session_${sessionId}`;
    const usedQuestions = sessionQuestions.get(sessionKey) || new Set();
    
    // Filter out already used questions
    const availableQuestions = allQuestions.filter(q => !usedQuestions.has(q.questionId));
    
    // If we don't have enough unused questions, reset the session
    if (availableQuestions.length < count) {
        sessionQuestions.delete(sessionKey);
        return this.getUniqueQuestions(allQuestions, sessionId, count);
    }
    
    // Shuffle and select questions
    const shuffled = this.shuffleArray(availableQuestions);
    const selected = shuffled.slice(0, count);
    
    // Track used questions
    selected.forEach(q => usedQuestions.add(q.questionId));
    sessionQuestions.set(sessionKey, usedQuestions);
    
    // Clean up old sessions (keep only last 100 sessions)
    if (sessionQuestions.size > 100) {
        const oldestKey = sessionQuestions.keys().next().value;
        sessionQuestions.delete(oldestKey);
    }
    
    return selected;
};