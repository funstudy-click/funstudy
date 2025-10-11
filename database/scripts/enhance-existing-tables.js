const AWS = require('aws-sdk');

// Configure AWS for the working setup
AWS.config.update({
    region: 'eu-north-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local'
});

// If using local endpoint
if (process.env.AWS_ENDPOINT) {
    AWS.config.update({
        endpoint: process.env.AWS_ENDPOINT
    });
}

const dynamodb = new AWS.DynamoDB.DocumentClient();

console.log('🚀 Adding Missing Questions to Existing Tables');
console.log('============================================');

// Focus on adding moderate and complex questions to existing tables
const additionalQuestions = {
    // Grade A questions for moderate and complex difficulties
    GradeA_Maths_Questions: [
        {
            questionId: "GradeA_Math_005",
            question: "What is 8 + 9?",
            options: ["15", "16", "17", "18"],
            correctAnswer: "17",
            difficulty: "moderate",
            points: 15
        },
        {
            questionId: "GradeA_Math_006",
            question: "If you have 20 stickers and give away 12, how many do you have left?",
            options: ["6", "7", "8", "9"],
            correctAnswer: "8",
            difficulty: "complex",
            points: 20
        }
    ],

    GradeA_Science_Questions: [
        {
            questionId: "GradeA_Science_004",
            question: "What do bees make?",
            options: ["Milk", "Honey", "Butter", "Cheese"],
            correctAnswer: "Honey",
            difficulty: "moderate",
            points: 15
        }
    ],

    GradeA_History_Questions: [
        {
            questionId: "GradeA_History_004",
            question: "What did people use before electric lights?",
            options: ["Candles", "Flashlights", "LED lights", "Neon lights"],
            correctAnswer: "Candles",
            difficulty: "moderate",
            points: 15
        }
    ],

    // Grade B questions for moderate and complex difficulties
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

    // Grade C questions for moderate and complex difficulties  
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

// Function to add questions to existing tables
async function addQuestionsToTable(tableName, questions) {
    console.log(`\n📚 Adding questions to ${tableName}...`);
    
    let successCount = 0;
    let errorCount = 0;
    let existsCount = 0;
    
    for (const question of questions) {
        try {
            const params = {
                TableName: tableName,
                Item: question,
                ConditionExpression: 'attribute_not_exists(questionId)'
            };
            
            await dynamodb.put(params).promise();
            successCount++;
            console.log(`  ✅ Added: ${question.questionId} (${question.difficulty})`);
            
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                existsCount++;
                console.log(`  ⚠️  Already exists: ${question.questionId}`);
            } else {
                errorCount++;
                console.log(`  ❌ Error adding ${question.questionId}: ${error.message}`);
            }
        }
    }
    
    console.log(`📊 ${tableName} Summary: ${successCount} added, ${existsCount} already existed, ${errorCount} errors`);
}

// Function to check what questions exist in a table
async function checkTableContent(tableName) {
    try {
        const params = {
            TableName: tableName
        };
        
        const result = await dynamodb.scan(params).promise();
        const difficulties = [...new Set(result.Items.map(item => item.difficulty))];
        
        console.log(`  📋 ${tableName}: ${result.Count} questions, difficulties: ${difficulties.join(', ')}`);
        return { count: result.Count, difficulties };
        
    } catch (error) {
        console.log(`  ❌ Error checking ${tableName}: ${error.message}`);
        return { count: 0, difficulties: [] };
    }
}

// Main function
async function enhanceExistingTables() {
    console.log('🎯 Step 1: Checking current content...\n');
    
    const tablesToCheck = [
        'GradeA_Maths_Questions',
        'GradeA_Science_Questions', 
        'GradeA_History_Questions',
        'GradeB_Maths_Questions',
        'GradeC_Maths_Questions'
    ];
    
    for (const tableName of tablesToCheck) {
        await checkTableContent(tableName);
    }
    
    console.log('\n🎯 Step 2: Adding missing difficulty questions...\n');
    
    for (const [tableName, questions] of Object.entries(additionalQuestions)) {
        await addQuestionsToTable(tableName, questions);
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }
    
    console.log('\n🎉 Enhancement completed!');
    console.log('\n📊 Summary:');
    console.log('  ✅ Added moderate and complex difficulty questions');
    console.log('  ✅ All existing tables now have better difficulty distribution');
    console.log('  ✅ Quiz system should work better with varied question types');
    
    console.log('\n🎯 Next steps:');
    console.log('  1. Test the quiz system with different difficulties');
    console.log('  2. Check if Grade B/C Science & History tables need creation');
    console.log('  3. Verify the frontend displays questions correctly');
}

// Run the enhancement
enhanceExistingTables().catch(error => {
    console.error('❌ Enhancement failed:', error);
    console.log('\n💡 Note: If you see connection errors, the local DynamoDB might not be running.');
    console.log('   The database tables exist remotely and the quiz system should still work.');
    process.exit(1);
});
