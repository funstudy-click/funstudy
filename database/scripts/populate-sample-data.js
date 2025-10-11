const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'eu-north-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbService = new AWS.DynamoDB(); // For table operations

// Sample questions data
const sampleQuestions = {
    'GradeA_Maths_Questions': [
        {
            questionId: 'GradeA_Math_001',
            question: 'What is 15 + 27?',
            options: ['40', '41', '42', '43'],
            correctAnswer: '42',
            difficulty: 'simple',
            points: 10
        },
        {
            questionId: 'GradeA_Math_002',
            question: 'What is 8 × 9?',
            options: ['70', '71', '72', '73'],
            correctAnswer: '72',
            difficulty: 'simple',
            points: 10
        },
        {
            questionId: 'GradeA_Math_003',
            question: 'What is the square root of 144?',
            options: ['11', '12', '13', '14'],
            correctAnswer: '12',
            difficulty: 'medium',
            points: 15
        },
        {
            questionId: 'GradeA_Math_004',
            question: 'What is 15% of 200?',
            options: ['25', '30', '35', '40'],
            correctAnswer: '30',
            difficulty: 'medium',
            points: 15
        },
        {
            questionId: 'GradeA_Math_005',
            question: 'Solve: 3x + 7 = 22',
            options: ['x = 4', 'x = 5', 'x = 6', 'x = 7'],
            correctAnswer: 'x = 5',
            difficulty: 'hard',
            points: 20
        }
    ],
    'GradeA_Science_Questions': [
        {
            questionId: 'GradeA_Science_001',
            question: 'What gas do plants absorb during photosynthesis?',
            options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Hydrogen'],
            correctAnswer: 'Carbon Dioxide',
            difficulty: 'simple',
            points: 10
        },
        {
            questionId: 'GradeA_Science_002',
            question: 'How many bones are in the human body?',
            options: ['206', '207', '208', '209'],
            correctAnswer: '206',
            difficulty: 'medium',
            points: 15
        },
        {
            questionId: 'GradeA_Science_003',
            question: 'What is the chemical symbol for gold?',
            options: ['Go', 'Gd', 'Au', 'Ag'],
            correctAnswer: 'Au',
            difficulty: 'hard',
            points: 20
        }
    ],
    'GradeA_History_Questions': [
        {
            questionId: 'GradeA_History_001',
            question: 'In which year did World War II end?',
            options: ['1944', '1945', '1946', '1947'],
            correctAnswer: '1945',
            difficulty: 'simple',
            points: 10
        },
        {
            questionId: 'GradeA_History_002',
            question: 'Who was the first President of the United States?',
            options: ['Thomas Jefferson', 'John Adams', 'George Washington', 'Benjamin Franklin'],
            correctAnswer: 'George Washington',
            difficulty: 'medium',
            points: 15
        },
        {
            questionId: 'GradeA_History_003',
            question: 'Which ancient wonder was located in Alexandria?',
            options: ['Colossus of Rhodes', 'Lighthouse of Alexandria', 'Hanging Gardens', 'Temple of Artemis'],
            correctAnswer: 'Lighthouse of Alexandria',
            difficulty: 'hard',
            points: 20
        }
    ],
    'GradeB_Maths_Questions': [
        {
            questionId: 'GradeB_Math_001',
            question: 'What is 12 + 18?',
            options: ['28', '29', '30', '31'],
            correctAnswer: '30',
            difficulty: 'simple',
            points: 10
        },
        {
            questionId: 'GradeB_Math_002',
            question: 'What is 7 × 8?',
            options: ['54', '55', '56', '57'],
            correctAnswer: '56',
            difficulty: 'simple',
            points: 10
        }
    ],
    'GradeC_Maths_Questions': [
        {
            questionId: 'GradeC_Math_001',
            question: 'What is 5 + 7?',
            options: ['10', '11', '12', '13'],
            correctAnswer: '12',
            difficulty: 'simple',
            points: 10
        },
        {
            questionId: 'GradeC_Math_002',
            question: 'What is 4 × 6?',
            options: ['22', '23', '24', '25'],
            correctAnswer: '24',
            difficulty: 'simple',
            points: 10
        }
    ]
};

async function createTableIfNotExists(tableName) {
    try {
        await dynamodbService.describeTable({ TableName: tableName }).promise();
        console.log(`✅ Table ${tableName} already exists`);
        return true;
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.log(`📋 Creating table ${tableName}...`);
            
            const params = {
                TableName: tableName,
                KeySchema: [
                    { AttributeName: 'questionId', KeyType: 'HASH' }  // Partition key
                ],
                AttributeDefinitions: [
                    { AttributeName: 'questionId', AttributeType: 'S' }
                ],
                BillingMode: 'PAY_PER_REQUEST' // Use on-demand pricing
            };
            
            try {
                await dynamodbService.createTable(params).promise();
                console.log(`✅ Table ${tableName} created successfully`);
                
                // Wait for table to be active
                console.log(`⏳ Waiting for table ${tableName} to be active...`);
                await dynamodbService.waitFor('tableExists', { TableName: tableName }).promise();
                console.log(`✅ Table ${tableName} is now active`);
                
                return true;
            } catch (createError) {
                console.log(`❌ Error creating table ${tableName}:`, createError.message);
                return false;
            }
        } else {
            console.log(`❌ Error checking table ${tableName}:`, error.message);
            return false;
        }
    }
}

async function populateTable(tableName, questions) {
    console.log(`\nPopulating ${tableName}...`);
    
    // First check if table exists, create if not
    const tableReady = await createTableIfNotExists(tableName);
    if (!tableReady) {
        console.log(`❌ Cannot populate ${tableName} - table not available`);
        return;
    }
    
    // Insert questions one by one
    for (const question of questions) {
        try {
            const params = {
                TableName: tableName,
                Item: question,
                ConditionExpression: 'attribute_not_exists(questionId)' // Only insert if doesn't exist
            };
            
            await dynamodb.put(params).promise();
            console.log(`  ✅ Added question: ${question.questionId}`);
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                console.log(`  ⚠️ Question already exists: ${question.questionId}`);
            } else {
                console.log(`  ❌ Error adding question ${question.questionId}:`, error.message);
            }
        }
        
        // Small delay to avoid throttling
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function populateAllTables() {
    console.log('Starting to populate sample data...');
    
    for (const [tableName, questions] of Object.entries(sampleQuestions)) {
        await populateTable(tableName, questions);
    }
    
    console.log('\n✅ Sample data population completed!');
}

async function checkTableContents() {
    console.log('\nChecking table contents...');
    
    for (const tableName of Object.keys(sampleQuestions)) {
        try {
            const params = {
                TableName: tableName,
                Select: 'COUNT'
            };
            
            const result = await dynamodb.scan(params).promise();
            console.log(`${tableName}: ${result.Count} items`);
        } catch (error) {
            console.log(`${tableName}: Error - ${error.message}`);
        }
    }
}

// Run the population
async function main() {
    try {
        await populateAllTables();
        await checkTableContents();
    } catch (error) {
        console.error('Error:', error);
    }
}

// Export for use in other scripts
module.exports = {
    populateAllTables,
    checkTableContents,
    sampleQuestions
};

// Run if called directly
if (require.main === module) {
    main();
}