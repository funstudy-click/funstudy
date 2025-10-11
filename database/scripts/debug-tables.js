const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'eu-north-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbClient = new AWS.DynamoDB();

async function listTables() {
    console.log('📋 Listing all DynamoDB tables...\n');
    try {
        const result = await dynamodbClient.listTables().promise();
        console.log('Available tables:');
        result.TableNames.forEach((tableName, index) => {
            console.log(`  ${index + 1}. ${tableName}`);
        });
        console.log(`\nTotal: ${result.TableNames.length} tables\n`);
        return result.TableNames;
    } catch (error) {
        console.error('❌ Error listing tables:', error.message);
        return [];
    }
}

async function checkTable(tableName) {
    console.log(`🔍 Checking table: ${tableName}`);

    try {
        // Check table status
        const tableInfo = await dynamodbClient.describeTable({ TableName: tableName }).promise();
        console.log(`  Status: ${tableInfo.Table.TableStatus}`);
        console.log(`  Item Count: ${tableInfo.Table.ItemCount}`);

        // Scan for items
        const scanParams = {
            TableName: tableName,
            Select: 'COUNT'
        };

        const scanResult = await dynamodb.scan(scanParams).promise();
        console.log(`  Actual Items (scan): ${scanResult.Count}`);

        // If there are items, show a sample
        if (scanResult.Count > 0) {
            const sampleParams = {
                TableName: tableName,
                Limit: 3
            };

            const sampleResult = await dynamodb.scan(sampleParams).promise();
            console.log(`  Sample items:`);
            sampleResult.Items.forEach((item, index) => {
                console.log(`    ${index + 1}. ${JSON.stringify(item, null, 6)}`);
            });
        }

        console.log(''); // Empty line
        return true;
    } catch (error) {
        console.log(`  ❌ Error: ${error.message}\n`);
        return false;
    }
}

async function testSpecificQuery() {
    console.log('🎯 Testing specific query: GradeA_Maths_Questions with difficulty "simple"');

    const tableName = 'GradeA_Maths_Questions';

    try {
        const params = {
            TableName: tableName,
            FilterExpression: 'Difficulty = :difficulty',
            ExpressionAttributeValues: { ':difficulty': 'simple' }
        };

        console.log('Query parameters:', JSON.stringify(params, null, 2));

        const result = await dynamodb.scan(params).promise();

        console.log(`Found ${result.Count} items with difficulty "simple"`);
        console.log(`Scanned ${result.ScannedCount} total items`);

        if (result.Items && result.Items.length > 0) {
            console.log('Sample items found:');
            result.Items.forEach((item, index) => {
                console.log(`  ${index + 1}. Question: ${item.question}`);
                console.log(`     Difficulty: ${item.difficulty}`);
                console.log(`     Options: ${JSON.stringify(item.options)}`);
                console.log('');
            });
        } else {
            console.log('❌ No items found with difficulty "simple"');

            // Let's check what difficulties exist
            console.log('Checking what difficulties exist in the table...');
            const allItemsParams = {
                TableName: tableName
            };

            const allItems = await dynamodb.scan(allItemsParams).promise();
            const difficulties = new Set();

            allItems.Items.forEach(item => {
                if (item.difficulty) {
                    difficulties.add(item.difficulty);
                }
            });

            console.log('Available difficulties:', Array.from(difficulties));
        }

    } catch (error) {
        console.error('❌ Query error:', error.message);
    }

    console.log('');
}

async function checkAWSConfiguration() {
    console.log('⚙️ Checking AWS Configuration...');
    console.log(`Region: ${AWS.config.region || 'Not set'}`);
    console.log(`Access Key: ${AWS.config.accessKeyId ? 'Set' : 'Not set'}`);
    console.log(`Secret Key: ${AWS.config.secretAccessKey ? 'Set' : 'Not set'}`);
    console.log('');
}

async function main() {
    console.log('🚀 DynamoDB Debug Tool\n');
    console.log('=' * 50 + '\n');

    await checkAWSConfiguration();

    const tables = await listTables();

    if (tables.length === 0) {
        console.log('❌ No tables found. Please create tables first.');
        return;
    }

    // Check the specific tables we need
    const requiredTables = [
        'GradeA_Maths_Questions',
        'GradeA_Science_Questions',
        'GradeA_History_Questions',
        'GradeB_Maths_Questions',
        'GradeC_Maths_Questions',
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
        'UserAttempts'
    ];

    console.log('🔍 Checking required tables...\n');

    for (const tableName of requiredTables) {
        await checkTable(tableName);
    }

    await testSpecificQuery();

    console.log('✅ Debug complete!');
    console.log('\nNext steps:');
    console.log('1. If tables are empty, run the populate-sample-data.js script');
    console.log('2. If tables don\'t exist, run your table creation script first');
    console.log('3. Check the difficulty values match exactly (case sensitive)');
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    listTables,
    checkTable,
    testSpecificQuery,
    checkAWSConfiguration
};