const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
    region: 'eu-north-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
    endpoint: 'http://localhost:8000'
});

// Set NODE_TLS_REJECT_UNAUTHORIZED to 0 for local DynamoDB
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

console.log('🚀 Creating Missing Tables and Populating Data');
console.log('==============================================');

// Table definitions that might be missing
const missingTables = [
    'GradeB_Science_Questions',
    'GradeB_History_Questions',
    'GradeC_Science_Questions',
    'GradeC_History_Questions'
];

// Function to create a table if it doesn't exist
async function createTableIfNotExists(tableName) {
    try {
        // Check if table exists
        const result = await dynamodb.describeTable({ TableName: tableName }).promise();
        console.log(`✅ Table ${tableName} already exists`);
        return true;
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.log(`🔨 Creating table ${tableName}...`);
            
            const tableParams = {
                TableName: tableName,
                KeySchema: [
                    { AttributeName: 'questionId', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'questionId', AttributeType: 'S' }
                ],
                BillingMode: 'PAY_PER_REQUEST'
            };
            
            await dynamodb.createTable(tableParams).promise();
            
            // Wait for table to become active
            console.log(`⏳ Waiting for table ${tableName} to become active...`);
            await dynamodb.waitFor('tableExists', { TableName: tableName }).promise();
            
            console.log(`✅ Table ${tableName} created successfully`);
            return true;
        } else {
            console.error(`❌ Error checking/creating table ${tableName}:`, error.message);
            return false;
        }
    }
}

// Simple data to populate the missing tables
const simpleData = {
    GradeB_Science_Questions: [
        {
            questionId: "GradeB_Science_001",
            question: "What do plants need to grow?",
            options: ["Water only", "Sunlight only", "Water and sunlight", "Air only"],
            correctAnswer: "Water and sunlight",
            difficulty: "simple",
            points: 10
        },
        {
            questionId: "GradeB_Science_002",
            question: "Which animal is a mammal?",
            options: ["Fish", "Bird", "Dog", "Snake"],
            correctAnswer: "Dog",
            difficulty: "moderate",
            points: 15
        },
        {
            questionId: "GradeB_Science_003",
            question: "How many legs does an insect have?",
            options: ["4", "6", "8", "10"],
            correctAnswer: "6",
            difficulty: "complex",
            points: 20
        }
    ],
    
    GradeB_History_Questions: [
        {
            questionId: "GradeB_History_001",
            question: "Who built the pyramids?",
            options: ["Romans", "Greeks", "Egyptians", "Vikings"],
            correctAnswer: "Egyptians",
            difficulty: "simple",
            points: 10
        },
        {
            questionId: "GradeB_History_002",
            question: "Which country is famous for building the Great Wall?",
            options: ["Japan", "China", "India", "Korea"],
            correctAnswer: "China",
            difficulty: "moderate",
            points: 15
        },
        {
            questionId: "GradeB_History_003",
            question: "Who discovered America?",
            options: ["Marco Polo", "Christopher Columbus", "Vasco da Gama", "Ferdinand Magellan"],
            correctAnswer: "Christopher Columbus",
            difficulty: "complex",
            points: 20
        }
    ],
    
    GradeC_Science_Questions: [
        {
            questionId: "GradeC_Science_001",
            question: "What is the chemical formula for water?",
            options: ["CO2", "H2O", "NaCl", "O2"],
            correctAnswer: "H2O",
            difficulty: "simple",
            points: 10
        },
        {
            questionId: "GradeC_Science_002",
            question: "How many chambers does a human heart have?",
            options: ["2", "3", "4", "5"],
            correctAnswer: "4",
            difficulty: "moderate",
            points: 15
        },
        {
            questionId: "GradeC_Science_003",
            question: "What is the powerhouse of the cell?",
            options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"],
            correctAnswer: "Mitochondria",
            difficulty: "complex",
            points: 20
        }
    ],
    
    GradeC_History_Questions: [
        {
            questionId: "GradeC_History_001",
            question: "In which year did the Titanic sink?",
            options: ["1910", "1911", "1912", "1913"],
            correctAnswer: "1912",
            difficulty: "simple",
            points: 10
        },
        {
            questionId: "GradeC_History_002",
            question: "Who painted the Mona Lisa?",
            options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"],
            correctAnswer: "Leonardo da Vinci",
            difficulty: "moderate",
            points: 15
        },
        {
            questionId: "GradeC_History_003",
            question: "Who was the first Emperor of Rome?",
            options: ["Julius Caesar", "Augustus", "Nero", "Marcus Aurelius"],
            correctAnswer: "Augustus",
            difficulty: "complex",
            points: 20
        }
    ]
};

// Additional questions for existing tables to cover missing difficulties
const additionalQuestions = {
    GradeB_Maths_Questions: [
        {
            questionId: "GradeB_Math_003",
            question: "What is 24 ÷ 6?",
            options: ["3", "4", "5", "6"],
            correctAnswer: "4",
            difficulty: "moderate",
            points: 15
        },
        {
            questionId: "GradeB_Math_004",
            question: "What is 144 ÷ 12?",
            options: ["10", "11", "12", "13"],
            correctAnswer: "12",
            difficulty: "complex",
            points: 20
        }
    ],
    
    GradeC_Maths_Questions: [
        {
            questionId: "GradeC_Math_003",
            question: "What is 15 × 12?",
            options: ["170", "175", "180", "185"],
            correctAnswer: "180",
            difficulty: "moderate",
            points: 15
        },
        {
            questionId: "GradeC_Math_004",
            question: "What is the area of a rectangle with length 8cm and width 6cm?",
            options: ["42 cm²", "46 cm²", "48 cm²", "52 cm²"],
            correctAnswer: "48 cm²",
            difficulty: "complex",
            points: 20
        }
    ]
};

// Function to populate a table with data
async function populateTable(tableName, questions) {
    console.log(`\n📚 Populating ${tableName}...`);
    
    for (const question of questions) {
        try {
            const params = {
                TableName: tableName,
                Item: question,
                ConditionExpression: 'attribute_not_exists(questionId)'
            };
            
            await docClient.put(params).promise();
            console.log(`  ✅ Added: ${question.questionId} (${question.difficulty})`);
            
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                console.log(`  ⚠️  Already exists: ${question.questionId}`);
            } else {
                console.log(`  ❌ Error adding ${question.questionId}: ${error.message}`);
            }
        }
    }
}

// Main execution
async function createAndPopulate() {
    console.log('🎯 Step 1: Creating missing tables...\n');
    
    for (const tableName of missingTables) {
        await createTableIfNotExists(tableName);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit between operations
    }
    
    console.log('\n🎯 Step 2: Populating missing tables...\n');
    
    // Populate new tables
    for (const [tableName, questions] of Object.entries(simpleData)) {
        await populateTable(tableName, questions);
    }
    
    // Add additional questions to existing tables
    for (const [tableName, questions] of Object.entries(additionalQuestions)) {
        await populateTable(tableName, questions);
    }
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  ✅ Created missing tables for Grade B & C Science and History');
    console.log('  ✅ Added questions with Simple, Moderate, and Complex difficulties');
    console.log('  ✅ Enhanced existing Grade B & C Maths tables');
    console.log('\n🎯 Now all grades have proper quiz content distribution!');
}

// Run the setup
createAndPopulate().catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
});
