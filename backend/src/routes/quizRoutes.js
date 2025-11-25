const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: process.env.AWS_REGION || 'eu-north-1' });

// Create BOTH DynamoDB instances - this is crucial for the fix
const dynamodb = new AWS.DynamoDB.DocumentClient(); // For data operations
const dynamodbService = new AWS.DynamoDB(); // For table management operations

console.log('DynamoDB configured with region:', AWS.config.region);

// Helper function to check if table exists
async function checkTableExists(tableName) {
    try {
        await dynamodbService.describeTable({ TableName: tableName }).promise();
        return true;
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            return false;
        }
        throw error; // Re-throw other errors
    }
}

// Helper function to get all available tables (for debugging)
async function getAvailableTables() {
    try {
        const result = await dynamodbService.listTables().promise();
        return result.TableNames || [];
    } catch (error) {
        console.error('Error listing tables:', error);
        return [];
    }
}

// GET /api/quiz/questions/:grade/:subject/:difficulty
router.get('/questions/:grade/:subject/:difficulty', async (req, res) => {
    try {
        const { grade, subject, difficulty } = req.params;
        
        console.log('Received parameters:', { grade, subject, difficulty });
        
        // Validate parameters
        if (!grade || !subject || !difficulty) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                required: ['grade', 'subject', 'difficulty']
            });
        }
        
        // Try different table naming conventions for Math/Maths
        let tableName;
        let tableExists = false;
        
        if (subject.toLowerCase() === 'math') {
            // Try both 'Math' and 'Maths' table naming
            const possibleNames = [
                `${grade}_Math_Questions`,
                `${grade}_Maths_Questions`
            ];
            
            for (const name of possibleNames) {
                console.log(`Checking table: ${name}`);
                if (await checkTableExists(name)) {
                    tableName = name;
                    tableExists = true;
                    console.log(`✅ Found table: ${tableName}`);
                    break;
                }
            }
        } else {
            tableName = `${grade}_${subject}_Questions`;
            tableExists = await checkTableExists(tableName);
        }
        
        if (!tableExists) {
            console.log(`❌ No suitable table found for ${grade} ${subject}`);
            
            // Get available tables for debugging
            const availableTables = await getAvailableTables();
            console.log('Available tables:', availableTables);
            
            return res.status(404).json({
                success: false,
                error: `No table found for ${grade} ${subject}`,
                availableTables: availableTables,
                suggestion: 'Check if the table name matches exactly with your DynamoDB tables'
            });
        }
        
        // Query questions from the table using DocumentClient
        const params = {
            TableName: tableName,
            FilterExpression: 'difficulty = :difficulty',
            ExpressionAttributeValues: {
                ':difficulty': difficulty
            }
        };
        
        console.log('Scanning table with params:', params);
        
        const result = await dynamodb.scan(params).promise();
        console.log(`Found ${result.Items.length} questions`);
        
        if (result.Items.length === 0) {
            // Check if there are any questions in the table at all
            const allItemsParams = { TableName: tableName };
            const allItems = await dynamodb.scan(allItemsParams).promise();
            
            return res.status(404).json({
                success: false,
                error: `No ${difficulty} questions found for ${grade} ${subject}`,
                totalQuestionsInTable: allItems.Items.length,
                suggestion: allItems.Items.length > 0 
                    ? 'Questions exist but not with the requested difficulty level'
                    : 'No questions found in the table'
            });
        }
        
        // Shuffle questions to provide variety
        const shuffledQuestions = result.Items.sort(() => 0.5 - Math.random());
        
        // Limit to reasonable number (e.g., 10 questions max)
        const limitedQuestions = shuffledQuestions.slice(0, 10);
        
        // SECURITY FIX: Remove correct answers from questions sent to frontend
        const secureQuestions = limitedQuestions.map(question => ({
            questionId: question.questionId,
            question: question.question,
            options: question.options,
            points: question.points || 10,
            difficulty: question.difficulty
            // correctAnswer is intentionally removed for security
        }));
        
        console.log(`Returning ${secureQuestions.length} shuffled questions (without answers)`);
        
        res.json({
            success: true,
            questions: secureQuestions,
            count: secureQuestions.length,
            totalAvailable: result.Items.length,
            metadata: {
                grade,
                subject,
                difficulty,
                tableName
            }
        });
        
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /api/quiz/verify-answers - Secure answer verification
router.post('/verify-answers', async (req, res) => {
    try {
        const { answers, grade, subject, difficulty } = req.body;
        
        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid answers format'
            });
        }
        
        const tableName = `${grade}_${subject}_Questions`;
        
        // Fetch all questions to verify answers
        const questionIds = answers.map(a => a.questionId);
        const results = [];
        let totalScore = 0;
        
        for (const answer of answers) {
            const params = {
                TableName: tableName,
                Key: { questionId: answer.questionId }
            };
            
            const result = await dynamodb.get(params).promise();
            
            if (result.Item) {
                const isCorrect = result.Item.correctAnswer === answer.selectedAnswer;
                const points = isCorrect ? (result.Item.points || 10) : 0;
                
                results.push({
                    questionId: answer.questionId,
                    question: result.Item.question,
                    isCorrect,
                    points,
                    correctAnswer: result.Item.correctAnswer, // Only send after quiz completion
                    selectedAnswer: answer.selectedAnswer
                });
                
                if (isCorrect) {
                    totalScore += points;
                }
            }
        }
        
        res.json({
            success: true,
            results,
            totalScore,
            totalQuestions: answers.length,
            percentage: Math.round((results.filter(r => r.isCorrect).length / answers.length) * 100)
        });
        
    } catch (error) {
        console.error('Error verifying answers:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// GET /api/quiz/subjects/:grade - Get available subjects for a grade
router.get('/subjects/:grade', async (req, res) => {
    try {
        const { grade } = req.params;
        
        console.log('Fetching subjects for grade:', grade);
        
        // Get all available tables
        const availableTables = await getAvailableTables();
        
        // Filter tables that match the grade pattern
        const gradePattern = new RegExp(`^${grade}_(.+)_Questions$`);
        const subjects = [];
        
        availableTables.forEach(tableName => {
            const match = tableName.match(gradePattern);
            if (match) {
                subjects.push(match[1]); // Extract subject name
            }
        });
        
        // Filter subjects to only include Math-related subjects (comment out Science and History)
        const allowedSubjects = ['Maths', 'Math', 'Mathematics'];
        const mathSubjects = subjects.filter(subject => 
            allowedSubjects.some(allowed => 
                subject.toLowerCase().includes(allowed.toLowerCase())
            )
        );
        
        // Normalize all math variants to just 'Math' to avoid duplicates
        const normalizedSubjects = mathSubjects.map(subject => {
            if (subject.toLowerCase().includes('math')) {
                return 'Math';
            }
            return subject;
        });
        
        // Remove duplicates
        const uniqueSubjects = [...new Set(normalizedSubjects)];
        
        console.log(`Found subjects for ${grade}:`, subjects);
        console.log(`Math subjects found:`, mathSubjects);
        console.log(`Normalized unique subjects:`, uniqueSubjects);
        
        res.json({
            success: true,
            grade,
            subjects: uniqueSubjects, // Only unique Math subjects
            count: uniqueSubjects.length,
            // allSubjects: [...new Set(subjects)] // Original subjects (commented out Science/History)
        });
        
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// GET /api/quiz/difficulties/:grade/:subject - Get available difficulties
router.get('/difficulties/:grade/:subject', async (req, res) => {
    try {
        const { grade, subject } = req.params;
        const tableName = `${grade}_${subject}_Questions`;
        
        console.log('Fetching difficulties for:', tableName);
        
        // Check if table exists
        const tableExists = await checkTableExists(tableName);
        if (!tableExists) {
            return res.status(404).json({
                success: false,
                error: `Table ${tableName} not found`
            });
        }
        
        // Get all items from the table and extract unique difficulties
        const params = {
            TableName: tableName,
            ProjectionExpression: 'difficulty'
        };
        
        const result = await dynamodb.scan(params).promise();
        const difficulties = [...new Set(result.Items.map(item => item.difficulty))];
        
        console.log(`Found difficulties for ${grade} ${subject}:`, difficulties);
        
        res.json({
            success: true,
            grade,
            subject,
            difficulties: difficulties.sort(),
            count: difficulties.length
        });
        
    } catch (error) {
        console.error('Error fetching difficulties:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// GET /api/quiz/stats - Get quiz statistics
router.get('/stats', async (req, res) => {
    try {
        const availableTables = await getAvailableTables();
        const questionTables = availableTables.filter(name => name.endsWith('_Questions'));
        
        const stats = {
            totalTables: questionTables.length,
            tables: []
        };
        
        // Get stats for each table
        for (const tableName of questionTables) {
            try {
                const result = await dynamodb.scan({
                    TableName: tableName,
                    Select: 'COUNT'
                }).promise();
                
                stats.tables.push({
                    tableName,
                    questionCount: result.Count
                });
            } catch (error) {
                console.error(`Error getting stats for ${tableName}:`, error.message);
                stats.tables.push({
                    tableName,
                    questionCount: 0,
                    error: error.message
                });
            }
        }
        
        res.json({
            success: true,
            stats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error fetching quiz stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// POST /api/quiz/submit - Submit quiz answers (placeholder)
router.post('/submit', async (req, res) => {
    try {
        const { answers, metadata } = req.body;
        
        // TODO: Implement score calculation and storage
        // For now, just return a mock response
        
        console.log('Quiz submission received:', {
            answerCount: answers?.length || 0,
            metadata
        });
        
        res.json({
            success: true,
            message: 'Quiz submitted successfully',
            score: 0, // TODO: Calculate actual score
            totalQuestions: answers?.length || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error submitting quiz:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message
        });
    }
});

// Debug endpoint to test DynamoDB connection
router.get('/debug/dynamodb', async (req, res) => {
    try {
        const availableTables = await getAvailableTables();
        
        const connectionTest = {
            region: AWS.config.region,
            availableTables,
            tableCount: availableTables.length,
            questionTables: availableTables.filter(name => name.endsWith('_Questions')),
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            message: 'DynamoDB connection test',
            data: connectionTest
        });
        
    } catch (error) {
        console.error('DynamoDB debug error:', error);
        res.status(500).json({
            success: false,
            error: 'DynamoDB connection failed',
            details: error.message
        });
    }
});

module.exports = router;