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

const dynamodb = new AWS.DynamoDB.DocumentClient();

console.log('🚀 Comprehensive Database Population Tool');
console.log('===========================================');

// Comprehensive question database
const questionDatabase = {
    // Grade B Questions (Ages 8-10)
    GradeB_Science: [
        // Simple
        { questionId: "GradeB_Science_001", question: "What do plants need to grow?", options: ["Water only", "Sunlight only", "Water and sunlight", "Air only"], correctAnswer: "Water and sunlight", difficulty: "simple", points: 10 },
        { questionId: "GradeB_Science_002", question: "Which animal is a mammal?", options: ["Fish", "Bird", "Dog", "Snake"], correctAnswer: "Dog", difficulty: "simple", points: 10 },
        { questionId: "GradeB_Science_003", question: "What makes things fall down?", options: ["Wind", "Gravity", "Light", "Sound"], correctAnswer: "Gravity", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "GradeB_Science_004", question: "How many legs does an insect have?", options: ["4", "6", "8", "10"], correctAnswer: "6", difficulty: "moderate", points: 15 },
        { questionId: "GradeB_Science_005", question: "What is the largest planet in our solar system?", options: ["Earth", "Mars", "Jupiter", "Saturn"], correctAnswer: "Jupiter", difficulty: "moderate", points: 15 },
        { questionId: "GradeB_Science_006", question: "What do we call animals that eat both plants and meat?", options: ["Carnivore", "Herbivore", "Omnivore", "Insectivore"], correctAnswer: "Omnivore", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GradeB_Science_007", question: "Which gas makes up most of Earth's atmosphere?", options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Hydrogen"], correctAnswer: "Nitrogen", difficulty: "complex", points: 20 },
        { questionId: "GradeB_Science_008", question: "What process do plants use to make food?", options: ["Respiration", "Photosynthesis", "Digestion", "Circulation"], correctAnswer: "Photosynthesis", difficulty: "complex", points: 20 }
    ],

    GradeB_History: [
        // Simple
        { questionId: "GradeB_History_001", question: "Who built the pyramids?", options: ["Romans", "Greeks", "Egyptians", "Vikings"], correctAnswer: "Egyptians", difficulty: "simple", points: 10 },
        { questionId: "GradeB_History_002", question: "What did knights wear for protection?", options: ["Cloth", "Armor", "Wood", "Leather"], correctAnswer: "Armor", difficulty: "simple", points: 10 },
        { questionId: "GradeB_History_003", question: "What did people use before cars?", options: ["Planes", "Horses", "Trains only", "Boats"], correctAnswer: "Horses", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "GradeB_History_004", question: "Which country is famous for building the Great Wall?", options: ["Japan", "China", "India", "Korea"], correctAnswer: "China", difficulty: "moderate", points: 15 },
        { questionId: "GradeB_History_005", question: "What were Viking ships called?", options: ["Galleys", "Longships", "Caravels", "Frigates"], correctAnswer: "Longships", difficulty: "moderate", points: 15 },
        { questionId: "GradeB_History_006", question: "Who discovered America?", options: ["Marco Polo", "Christopher Columbus", "Vasco da Gama", "Ferdinand Magellan"], correctAnswer: "Christopher Columbus", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GradeB_History_007", question: "In which century did the Roman Empire fall?", options: ["3rd century", "4th century", "5th century", "6th century"], correctAnswer: "5th century", difficulty: "complex", points: 20 },
        { questionId: "GradeB_History_008", question: "What was the name of the ship that brought the Pilgrims to America?", options: ["Mayflower", "Santa Maria", "Golden Hind", "Victory"], correctAnswer: "Mayflower", difficulty: "complex", points: 20 }
    ],

    // Grade C Questions (Ages 11-13)
    GradeC_Science: [
        // Simple
        { questionId: "GradeC_Science_001", question: "What is the chemical formula for water?", options: ["CO2", "H2O", "NaCl", "O2"], correctAnswer: "H2O", difficulty: "simple", points: 10 },
        { questionId: "GradeC_Science_002", question: "How many chambers does a human heart have?", options: ["2", "3", "4", "5"], correctAnswer: "4", difficulty: "simple", points: 10 },
        { questionId: "GradeC_Science_003", question: "What is the fastest land animal?", options: ["Lion", "Cheetah", "Horse", "Gazelle"], correctAnswer: "Cheetah", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "GradeC_Science_004", question: "What is the powerhouse of the cell?", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"], correctAnswer: "Mitochondria", difficulty: "moderate", points: 15 },
        { questionId: "GradeC_Science_005", question: "What type of rock is formed by cooling lava?", options: ["Sedimentary", "Metamorphic", "Igneous", "Crystalline"], correctAnswer: "Igneous", difficulty: "moderate", points: 15 },
        { questionId: "GradeC_Science_006", question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctAnswer: "Mars", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GradeC_Science_007", question: "What is the process by which cells divide?", options: ["Meiosis", "Mitosis", "Photosynthesis", "Respiration"], correctAnswer: "Mitosis", difficulty: "complex", points: 20 },
        { questionId: "GradeC_Science_008", question: "What is the pH of pure water?", options: ["6", "7", "8", "9"], correctAnswer: "7", difficulty: "complex", points: 20 }
    ],

    GradeC_History: [
        // Simple
        { questionId: "GradeC_History_001", question: "Who was the first Emperor of Rome?", options: ["Julius Caesar", "Augustus", "Nero", "Marcus Aurelius"], correctAnswer: "Augustus", difficulty: "simple", points: 10 },
        { questionId: "GradeC_History_002", question: "In which year did the Titanic sink?", options: ["1910", "1911", "1912", "1913"], correctAnswer: "1912", difficulty: "simple", points: 10 },
        { questionId: "GradeC_History_003", question: "Who painted the Mona Lisa?", options: ["Michelangelo", "Leonardo da Vinci", "Raphael", "Donatello"], correctAnswer: "Leonardo da Vinci", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "GradeC_History_004", question: "Which war was fought between the North and South in America?", options: ["Revolutionary War", "War of 1812", "Civil War", "Spanish-American War"], correctAnswer: "Civil War", difficulty: "moderate", points: 15 },
        { questionId: "GradeC_History_005", question: "Who was known as the Iron Lady?", options: ["Queen Elizabeth I", "Margaret Thatcher", "Golda Meir", "Indira Gandhi"], correctAnswer: "Margaret Thatcher", difficulty: "moderate", points: 15 },
        { questionId: "GradeC_History_006", question: "In which city was John F. Kennedy assassinated?", options: ["New York", "Washington D.C.", "Dallas", "Los Angeles"], correctAnswer: "Dallas", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GradeC_History_007", question: "What was the name of the alliance between Germany, Austria-Hungary, and Italy in WWI?", options: ["Triple Alliance", "Triple Entente", "Central Powers", "Axis Powers"], correctAnswer: "Triple Alliance", difficulty: "complex", points: 20 },
        { questionId: "GradeC_History_008", question: "Which treaty ended World War I?", options: ["Treaty of Versailles", "Treaty of Paris", "Treaty of Vienna", "Treaty of Berlin"], correctAnswer: "Treaty of Versailles", difficulty: "complex", points: 20 }
    ],

    // GCSE Questions (Ages 14-16)
    GCSE_Maths: [
        // Simple
        { questionId: "GCSE_Maths_001", question: "What is 3² + 4²?", options: ["25", "24", "23", "26"], correctAnswer: "25", difficulty: "simple", points: 10 },
        { questionId: "GCSE_Maths_002", question: "Solve for x: 2x + 6 = 14", options: ["3", "4", "5", "6"], correctAnswer: "4", difficulty: "simple", points: 10 },
        { questionId: "GCSE_Maths_003", question: "What is 20% of 150?", options: ["25", "30", "35", "40"], correctAnswer: "30", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "GCSE_Maths_004", question: "What is the area of a circle with radius 5cm? (π ≈ 3.14)", options: ["78.5 cm²", "75.5 cm²", "80.5 cm²", "85.5 cm²"], correctAnswer: "78.5 cm²", difficulty: "moderate", points: 15 },
        { questionId: "GCSE_Maths_005", question: "Solve: x² - 5x + 6 = 0", options: ["x = 2, 3", "x = 1, 6", "x = 2, 4", "x = 3, 4"], correctAnswer: "x = 2, 3", difficulty: "moderate", points: 15 },
        { questionId: "GCSE_Maths_006", question: "What is sin(30°)?", options: ["0.5", "0.707", "0.866", "1"], correctAnswer: "0.5", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GCSE_Maths_007", question: "If log₂(x) = 3, what is x?", options: ["6", "8", "9", "12"], correctAnswer: "8", difficulty: "complex", points: 20 },
        { questionId: "GCSE_Maths_008", question: "What is the gradient of the line 3x - 2y + 6 = 0?", options: ["1.5", "-1.5", "2/3", "-2/3"], correctAnswer: "1.5", difficulty: "complex", points: 20 }
    ],

    GCSE_Science: [
        // Simple
        { questionId: "GCSE_Science_001", question: "What is the chemical symbol for sodium?", options: ["S", "So", "Na", "Sd"], correctAnswer: "Na", difficulty: "simple", points: 10 },
        { questionId: "GCSE_Science_002", question: "How many electrons does a carbon atom have?", options: ["4", "6", "8", "12"], correctAnswer: "6", difficulty: "simple", points: 10 },
        { questionId: "GCSE_Science_003", question: "What type of energy is stored in food?", options: ["Kinetic", "Chemical", "Nuclear", "Thermal"], correctAnswer: "Chemical", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "GCSE_Science_004", question: "What is the balanced equation for photosynthesis?", options: ["6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", "CO₂ + H₂O → CH₂O + O₂", "C₆H₁₂O₆ → 6CO₂ + 6H₂O", "6O₂ + C₆H₁₂O₆ → 6CO₂ + 6H₂O"], correctAnswer: "6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂", difficulty: "moderate", points: 15 },
        { questionId: "GCSE_Science_005", question: "What is the unit of electrical resistance?", options: ["Ampere", "Volt", "Ohm", "Watt"], correctAnswer: "Ohm", difficulty: "moderate", points: 15 },
        { questionId: "GCSE_Science_006", question: "Which type of radiation has the highest penetrating power?", options: ["Alpha", "Beta", "Gamma", "X-ray"], correctAnswer: "Gamma", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GCSE_Science_007", question: "What is the molecular formula for glucose?", options: ["C₆H₁₂O₆", "C₆H₁₄O₆", "C₅H₁₂O₆", "C₆H₁₂O₅"], correctAnswer: "C₆H₁₂O₆", difficulty: "complex", points: 20 },
        { questionId: "GCSE_Science_008", question: "In the Hardy-Weinberg equation, what does p² represent?", options: ["Heterozygote frequency", "Dominant allele frequency", "Homozygous dominant frequency", "Recessive phenotype frequency"], correctAnswer: "Homozygous dominant frequency", difficulty: "complex", points: 20 }
    ],

    GCSE_History: [
        // Simple
        { questionId: "GCSE_History_001", question: "In which year did World War I begin?", options: ["1912", "1913", "1914", "1915"], correctAnswer: "1914", difficulty: "simple", points: 10 },
        { questionId: "GCSE_History_002", question: "Who was the British Prime Minister during most of World War II?", options: ["Neville Chamberlain", "Winston Churchill", "Clement Attlee", "Anthony Eden"], correctAnswer: "Winston Churchill", difficulty: "simple", points: 10 },
        { questionId: "GCSE_History_003", question: "What was the name of the policy of avoiding war before WWII?", options: ["Isolationism", "Appeasement", "Neutrality", "Pacifism"], correctAnswer: "Appeasement", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "GCSE_History_004", question: "What was the main cause of the Russian Revolution in 1917?", options: ["Economic problems and war losses", "Religious conflicts", "Territorial disputes", "Colonial rebellion"], correctAnswer: "Economic problems and war losses", difficulty: "moderate", points: 15 },
        { questionId: "GCSE_History_005", question: "Which event marked the beginning of the Cold War?", options: ["Berlin Blockade", "Marshall Plan", "Iron Curtain Speech", "Formation of NATO"], correctAnswer: "Iron Curtain Speech", difficulty: "moderate", points: 15 },
        { questionId: "GCSE_History_006", question: "What was the Schlieffen Plan?", options: ["German invasion strategy for France", "British naval strategy", "American economic plan", "Russian mobilization plan"], correctAnswer: "German invasion strategy for France", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GCSE_History_007", question: "Which treaty established the League of Nations?", options: ["Treaty of Versailles", "Treaty of Trianon", "Treaty of Sèvres", "Treaty of Saint-Germain"], correctAnswer: "Treaty of Versailles", difficulty: "complex", points: 20 },
        { questionId: "GCSE_History_008", question: "What was the name of the Nazi propaganda minister?", options: ["Heinrich Himmler", "Joseph Goebbels", "Rudolf Hess", "Hermann Göring"], correctAnswer: "Joseph Goebbels", difficulty: "complex", points: 20 }
    ],

    // 11 Plus Questions (Ages 10-11)
    "11Plus_Maths": [
        // Simple
        { questionId: "11Plus_Maths_001", question: "What is 125 ÷ 5?", options: ["23", "24", "25", "26"], correctAnswer: "25", difficulty: "simple", points: 10 },
        { questionId: "11Plus_Maths_002", question: "What is 9 × 7?", options: ["61", "62", "63", "64"], correctAnswer: "63", difficulty: "simple", points: 10 },
        { questionId: "11Plus_Maths_003", question: "What is 3/4 as a decimal?", options: ["0.25", "0.5", "0.75", "1.25"], correctAnswer: "0.75", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "11Plus_Maths_004", question: "A rectangle has length 8cm and width 5cm. What is its perimeter?", options: ["24cm", "26cm", "28cm", "30cm"], correctAnswer: "26cm", difficulty: "moderate", points: 15 },
        { questionId: "11Plus_Maths_005", question: "What is 40% of 250?", options: ["90", "95", "100", "105"], correctAnswer: "100", difficulty: "moderate", points: 15 },
        { questionId: "11Plus_Maths_006", question: "If a train travels at 60mph for 2.5 hours, how far does it go?", options: ["120 miles", "130 miles", "140 miles", "150 miles"], correctAnswer: "150 miles", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "11Plus_Maths_007", question: "What is the next number in the sequence: 2, 6, 18, 54, ?", options: ["108", "126", "144", "162"], correctAnswer: "162", difficulty: "complex", points: 20 },
        { questionId: "11Plus_Maths_008", question: "A shop reduces all prices by 20%. If a toy originally costs £15, what is the new price?", options: ["£11", "£12", "£13", "£14"], correctAnswer: "£12", difficulty: "complex", points: 20 }
    ],

    "11Plus_Science": [
        // Simple
        { questionId: "11Plus_Science_001", question: "What do we call the study of living things?", options: ["Physics", "Chemistry", "Biology", "Geology"], correctAnswer: "Biology", difficulty: "simple", points: 10 },
        { questionId: "11Plus_Science_002", question: "Which organ pumps blood around the body?", options: ["Lungs", "Brain", "Heart", "Liver"], correctAnswer: "Heart", difficulty: "simple", points: 10 },
        { questionId: "11Plus_Science_003", question: "What happens to water when it freezes?", options: ["It becomes gas", "It becomes ice", "It disappears", "It becomes heavier"], correctAnswer: "It becomes ice", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "11Plus_Science_004", question: "Which vitamin is produced when skin is exposed to sunlight?", options: ["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D"], correctAnswer: "Vitamin D", difficulty: "moderate", points: 15 },
        { questionId: "11Plus_Science_005", question: "What is the main gas that plants take in during photosynthesis?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correctAnswer: "Carbon dioxide", difficulty: "moderate", points: 15 },
        { questionId: "11Plus_Science_006", question: "How long does it take for the Earth to orbit the Sun?", options: ["1 day", "1 month", "1 year", "1 decade"], correctAnswer: "1 year", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "11Plus_Science_007", question: "What is the smallest particle of an element?", options: ["Molecule", "Atom", "Proton", "Electron"], correctAnswer: "Atom", difficulty: "complex", points: 20 },
        { questionId: "11Plus_Science_008", question: "Which type of energy is stored in a stretched rubber band?", options: ["Kinetic energy", "Heat energy", "Potential energy", "Chemical energy"], correctAnswer: "Potential energy", difficulty: "complex", points: 20 }
    ],

    "11Plus_English": [
        // Simple
        { questionId: "11Plus_English_001", question: "What type of word describes an action?", options: ["Noun", "Adjective", "Verb", "Adverb"], correctAnswer: "Verb", difficulty: "simple", points: 10 },
        { questionId: "11Plus_English_002", question: "Which word is spelled correctly?", options: ["Recieve", "Receive", "Recive", "Receeve"], correctAnswer: "Receive", difficulty: "simple", points: 10 },
        { questionId: "11Plus_English_003", question: "What is the plural of 'child'?", options: ["Childs", "Children", "Childes", "Childrens"], correctAnswer: "Children", difficulty: "simple", points: 10 },
        // Moderate
        { questionId: "11Plus_English_004", question: "What is a synonym for 'happy'?", options: ["Sad", "Angry", "Joyful", "Tired"], correctAnswer: "Joyful", difficulty: "moderate", points: 15 },
        { questionId: "11Plus_English_005", question: "Which sentence uses correct punctuation?", options: ["Its a lovely day", "It's a lovely day.", "Its a lovely day.", "It's a lovely day"], correctAnswer: "It's a lovely day.", difficulty: "moderate", points: 15 },
        { questionId: "11Plus_English_006", question: "What is an antonym for 'ancient'?", options: ["Old", "Historic", "Modern", "Traditional"], correctAnswer: "Modern", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "11Plus_English_007", question: "Which literary device is used in 'The stars danced in the sky'?", options: ["Simile", "Metaphor", "Personification", "Alliteration"], correctAnswer: "Personification", difficulty: "complex", points: 20 },
        { questionId: "11Plus_English_008", question: "What is the past participle of 'write'?", options: ["Wrote", "Written", "Writing", "Writes"], correctAnswer: "Written", difficulty: "complex", points: 20 }
    ],

    // Additional Grade B Maths questions for moderate and complex difficulties
    GradeB_Maths_Additional: [
        // Moderate
        { questionId: "GradeB_Math_003", question: "What is 24 ÷ 6?", options: ["3", "4", "5", "6"], correctAnswer: "4", difficulty: "moderate", points: 15 },
        { questionId: "GradeB_Math_004", question: "If you have 15 apples and eat 7, how many are left?", options: ["6", "7", "8", "9"], correctAnswer: "8", difficulty: "moderate", points: 15 },
        { questionId: "GradeB_Math_005", question: "What is half of 50?", options: ["20", "25", "30", "35"], correctAnswer: "25", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GradeB_Math_006", question: "What is 144 ÷ 12?", options: ["10", "11", "12", "13"], correctAnswer: "12", difficulty: "complex", points: 20 },
        { questionId: "GradeB_Math_007", question: "If a pizza is cut into 8 slices and you eat 3, what fraction is left?", options: ["3/8", "5/8", "1/2", "3/5"], correctAnswer: "5/8", difficulty: "complex", points: 20 }
    ],

    // Additional Grade C Maths questions for moderate and complex difficulties
    GradeC_Maths_Additional: [
        // Moderate
        { questionId: "GradeC_Math_003", question: "What is 15 × 12?", options: ["170", "175", "180", "185"], correctAnswer: "180", difficulty: "moderate", points: 15 },
        { questionId: "GradeC_Math_004", question: "What is 3/4 of 20?", options: ["12", "15", "16", "18"], correctAnswer: "15", difficulty: "moderate", points: 15 },
        { questionId: "GradeC_Math_005", question: "If x + 5 = 12, what is x?", options: ["5", "6", "7", "8"], correctAnswer: "7", difficulty: "moderate", points: 15 },
        // Complex
        { questionId: "GradeC_Math_006", question: "What is the area of a rectangle with length 8cm and width 6cm?", options: ["42 cm²", "46 cm²", "48 cm²", "52 cm²"], correctAnswer: "48 cm²", difficulty: "complex", points: 20 },
        { questionId: "GradeC_Math_007", question: "What is 20% of 75?", options: ["12", "15", "18", "20"], correctAnswer: "15", difficulty: "complex", points: 20 }
    ]
};

// Function to populate a single table
async function populateTable(tableName, questions) {
    console.log(`\n📚 Populating ${tableName}...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const question of questions) {
        try {
            const params = {
                TableName: tableName,
                Item: question,
                ConditionExpression: 'attribute_not_exists(questionId)' // Only add if doesn't exist
            };
            
            await dynamodb.put(params).promise();
            successCount++;
            console.log(`  ✅ Added: ${question.questionId}`);
            
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                console.log(`  ⚠️  Already exists: ${question.questionId}`);
            } else {
                console.log(`  ❌ Error adding ${question.questionId}: ${error.message}`);
                errorCount++;
            }
        }
    }
    
    console.log(`📊 ${tableName} Summary: ${successCount} added, ${errorCount} errors`);
}

// Function to map question types to table names
function getTableName(gradePrefix, subject) {
    if (gradePrefix === '11Plus') {
        return `11Plus_${subject}_Questions`;
    }
    return `${gradePrefix}_${subject}_Questions`;
}

// Main population function
async function populateAllTables() {
    console.log('🎯 Starting comprehensive database population...\n');
    
    // Grade B Science and History
    await populateTable(getTableName('GradeB', 'Science'), questionDatabase.GradeB_Science);
    await populateTable(getTableName('GradeB', 'History'), questionDatabase.GradeB_History);
    await populateTable(getTableName('GradeB', 'Maths'), questionDatabase.GradeB_Maths_Additional);
    
    // Grade C Science and History (missing subjects)
    await populateTable(getTableName('GradeC', 'Science'), questionDatabase.GradeC_Science);
    await populateTable(getTableName('GradeC', 'History'), questionDatabase.GradeC_History);
    await populateTable(getTableName('GradeC', 'Maths'), questionDatabase.GradeC_Maths_Additional);
    
    // GCSE subjects (completely empty)
    await populateTable(getTableName('GCSE', 'Maths'), questionDatabase.GCSE_Maths);
    await populateTable(getTableName('GCSE', 'Science'), questionDatabase.GCSE_Science);
    await populateTable(getTableName('GCSE', 'History'), questionDatabase.GCSE_History);
    
    // 11 Plus subjects (completely empty)
    await populateTable(getTableName('11Plus', 'Maths'), questionDatabase['11Plus_Maths']);
    await populateTable(getTableName('11Plus', 'Science'), questionDatabase['11Plus_Science']);
    await populateTable(getTableName('11Plus', 'English'), questionDatabase['11Plus_English']);
    
    console.log('\n🎉 Database population completed successfully!');
    console.log('\n📋 Summary of populated content:');
    console.log('  ✅ Grade B: Science (8), History (8), Maths (5 additional)');
    console.log('  ✅ Grade C: Science (8), History (8), Maths (5 additional)');
    console.log('  ✅ GCSE: Maths (8), Science (8), History (8)');
    console.log('  ✅ 11 Plus: Maths (8), Science (8), English (8)');
    console.log('\n🎯 All difficulties now available: Simple, Moderate, Complex');
}

// Run the population
populateAllTables().catch(error => {
    console.error('❌ Population failed:', error);
    process.exit(1);
});
