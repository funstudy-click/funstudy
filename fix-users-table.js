const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'eu-north-1' });
const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

async function fixUsersTable() {
    try {
        console.log('Checking Users table...');
        
        // Check if table exists
        const result = await dynamodb.describeTable({ TableName: 'Users' }).promise();
        console.log('✅ Users table exists');
        console.log('KeySchema:', JSON.stringify(result.Table.KeySchema, null, 2));
        console.log('AttributeDefinitions:', JSON.stringify(result.Table.AttributeDefinitions, null, 2));
        
        // Test a simple operation
        console.log('\nTesting table operations...');
        
        // Try to scan the table
        const scanResult = await docClient.scan({ 
            TableName: 'Users',
            Limit: 1
        }).promise();
        
        console.log('✅ Table scan successful, items count:', scanResult.Count);
        
        // Try to put a test item using the correct schema
        const testItem = {
            id: 'test-user-' + Date.now(),
            email: 'test@example.com',
            username: 'testuser',
            name: 'Test User',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        await docClient.put({
            TableName: 'Users',
            Item: testItem
        }).promise();
        
        console.log('✅ Test item insertion successful');
        
        // Clean up test item
        await docClient.delete({
            TableName: 'Users',
            Key: { id: testItem.id }
        }).promise();
        
        console.log('✅ Test item cleanup successful');
        console.log('\n🎉 Users table is working correctly!');
        
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.log('❌ Users table does not exist, creating...');
            
            const params = {
                TableName: 'Users',
                KeySchema: [
                    { AttributeName: 'id', KeyType: 'HASH' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'id', AttributeType: 'S' }
                ],
                BillingMode: 'PAY_PER_REQUEST'
            };
            
            const createResult = await dynamodb.createTable(params).promise();
            console.log('✅ Users table created successfully');
            console.log('Waiting for table to become active...');
            
            await dynamodb.waitFor('tableExists', { TableName: 'Users' }).promise();
            console.log('✅ Users table is now active');
            
        } else {
            console.error('❌ Error with Users table:', error.message);
            console.error('Error code:', error.code);
        }
    }
}

fixUsersTable().then(() => {
    console.log('\nUsers table check completed');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
