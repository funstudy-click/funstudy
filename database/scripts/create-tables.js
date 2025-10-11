const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'eu-north-1' });
const dynamodb = new AWS.DynamoDB();

// List of tables to create
const tables = [
    'GCSE_Maths_Questions',
    'GCSE_Science_Questions',
    'GCSE_History_Questions',
    '11Plus_Maths_Questions',
    '11Plus_Science_Questions',
    '11Plus_English_Questions',
    'UserAttempts',
    'Users',
    'GradeC_Maths_Questions', 
    'GradeC_Science_Questions',
    'GradeC_History_Questions',
    'UserAttempts',
];

// Table schemas
const tableSchemas = {
    'QuestionTables': {
        KeySchema: [
            { AttributeName: 'questionId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'questionId', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    },
    'UserAttempts': {
        KeySchema: [
            { AttributeName: 'attemptId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'attemptId', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    },
    'Users': {
        KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    }
};

async function createTables() {
    console.log('Starting table creation...');
    
    for (const tableName of tables) {
        try {
            let schema;
            
            if (tableName.includes('Questions')) {
                schema = tableSchemas.QuestionTables;
            } else if (tableName === 'UserAttempts') {
                schema = tableSchemas.UserAttempts;
            } else if (tableName === 'Users') {
                schema = tableSchemas.Users;
            }
            
            const params = {
                TableName: tableName,
                ...schema
            };
            
            await dynamodb.createTable(params).promise();
            console.log(`✅ Created table: ${tableName}`);
            
            // Wait a bit between creations to avoid throttling
            await new Promise(resolve => setTimeout(resolve, 1000));
            
        } catch (error) {
            if (error.code === 'ResourceInUseException') {
                console.log(`⚠️  Table already exists: ${tableName}`);
            } else {
                console.error(`❌ Error creating ${tableName}:`, error.message);
            }
        }
    }
    
    console.log('Table creation process completed!');
}

// Run the function
createTables().catch(console.error);