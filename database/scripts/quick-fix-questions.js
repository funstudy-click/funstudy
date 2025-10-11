const AWS = require('aws-sdk');

console.log('🚀 Quick Database Fix - Adding Missing Questions');
console.log('============================================');

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Quick additional questions to fix immediate gaps
const quickFixes = {
    // Grade A missing moderate and complex questions
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
        },
        {
            questionId: "GradeA_Science_005",
            question: "How many wings does a butterfly have?",
            options: ["2", "3", "4", "6"],
            correctAnswer: "4",
            difficulty: "complex",
            points: 20
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
        },
        {
            questionId: "GradeA_History_005",
            question: "What were the first cars powered by?",
            options: ["Electricity", "Steam", "Gasoline", "Wind"],
            correctAnswer: "Steam",
            difficulty: "complex",
            points: 20
        }
    ],
    
    // Grade B and C questions for missing difficulties
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
    ],
    
    // Add some basic questions to empty tables
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
        }
    ]
};

// Add questions function
async function addQuestions(tableName, questions) {
    console.log(`\n📚 Adding ${questions.length} questions to ${tableName}...`);
    
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
    
    console.log(`📊 ${tableName}: ${successCount} added, ${existsCount} existed, ${errorCount} errors`);
}

// Main execution
async function applyQuickFixes() {
    console.log('🎯 Applying quick database fixes...\n');
    
    for (const [tableName, questions] of Object.entries(quickFixes)) {
        await addQuestions(tableName, questions);
        await new Promise(resolve => setTimeout(resolve, 300)); // Small delay
    }
    
    console.log('\n🎉 Quick fixes completed!');
    console.log('\n📊 Summary:');
    console.log('  ✅ Added moderate & complex questions to Grade A tables');
    console.log('  ✅ Added missing difficulty questions to Grade B & C Maths');
    console.log('  ✅ Added basic questions to empty Grade C Science & History');
    console.log('\n🎯 The quiz system should now work much better!');
    
    console.log('\n📋 Restart your backend server to pick up the difficulty fix.');
}

// Run fixes
applyQuickFixes().catch(error => {
    console.error('❌ Quick fixes failed:', error);
    console.log('\n💡 Make sure your AWS credentials are properly configured.');
    console.log('💡 The backend code fix (difficulty case) should still help.');
    process.exit(1);
});
