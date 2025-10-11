const AWS = require('aws-sdk');
const fs = require('fs');

// Configure AWS
AWS.config.update({ region: 'eu-north-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbService = new AWS.DynamoDB();

class QuestionUploader {
    constructor() {
        this.batchSize = 25;
        this.delayBetweenBatches = 100;
    }

    async uploadQuestions(tableName, questions) {
        console.log(`\n📋 Starting upload to ${tableName} (${questions.length} questions)`);
        
        await this.createTableIfNotExists(tableName);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < questions.length; i += this.batchSize) {
            const batch = questions.slice(i, i + this.batchSize);
            console.log(`  📦 Processing batch ${Math.floor(i/this.batchSize) + 1} (${batch.length} questions)`);
            
            try {
                const result = await this.uploadBatch(tableName, batch);
                successCount += result.success;
                errorCount += result.errors;
            } catch (error) {
                console.log(`  ❌ Batch failed:`, error.message);
                errorCount += batch.length;
            }
            
            if (i + this.batchSize < questions.length) {
                await this.delay(this.delayBetweenBatches);
            }
        }
        
        console.log(`✅ Upload completed: ${successCount} success, ${errorCount} errors`);
        return { success: successCount, errors: errorCount };
    }

    async uploadBatch(tableName, questions) {
        const putRequests = questions.map(question => ({
            PutRequest: { Item: question }
        }));

        const params = {
            RequestItems: { [tableName]: putRequests }
        };

        try {
            const result = await dynamodb.batchWrite(params).promise();
            
            if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
                console.log(`  ⚠️ Some items were unprocessed, retrying...`);
                await this.delay(200);
                
                const retryResult = await dynamodb.batchWrite({
                    RequestItems: result.UnprocessedItems
                }).promise();
                
                return {
                    success: questions.length - (Object.keys(retryResult.UnprocessedItems || {}).length),
                    errors: Object.keys(retryResult.UnprocessedItems || {}).length
                };
            }
            
            return { success: questions.length, errors: 0 };
        } catch (error) {
            console.log(`  ❌ Batch write error:`, error.message);
            return { success: 0, errors: questions.length };
        }
    }

    async createTableIfNotExists(tableName) {
        try {
            await dynamodbService.describeTable({ TableName: tableName }).promise();
            console.log(`  ✅ Table ${tableName} exists`);
            return true;
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                console.log(`  📋 Creating table ${tableName}...`);
                
                const params = {
                    TableName: tableName,
                    KeySchema: [{ AttributeName: 'questionId', KeyType: 'HASH' }],
                    AttributeDefinitions: [{ AttributeName: 'questionId', AttributeType: 'S' }],
                    BillingMode: 'PAY_PER_REQUEST'
                };
                
                await dynamodbService.createTable(params).promise();
                await dynamodbService.waitFor('tableExists', { TableName: tableName }).promise();
                console.log(`  ✅ Table ${tableName} created`);
                return true;
            } else {
                throw error;
            }
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    validateQuestion(question) {
        const required = ['questionId', 'question', 'options', 'correctAnswer', 'difficulty', 'points'];
        const missing = required.filter(field => !question[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }
        
        if (!Array.isArray(question.options) || question.options.length < 2) {
            throw new Error('Options must be an array with at least 2 choices');
        }
        
        if (!question.options.includes(question.correctAnswer)) {
            throw new Error('Correct answer must be one of the options');
        }
        
        return true;
    }
}

async function uploadFromJSONFile(filePath) {
    const uploader = new QuestionUploader();
    
    try {
        console.log(`📖 Reading questions from ${filePath}`);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const questionsData = JSON.parse(fileContent);
        
        for (const [tableName, questions] of Object.entries(questionsData)) {
            questions.forEach((question, index) => {
                try {
                    uploader.validateQuestion(question);
                } catch (error) {
                    throw new Error(`Question ${index + 1} in ${tableName}: ${error.message}`);
                }
            });
            
            await uploader.uploadQuestions(tableName, questions);
        }
        
        console.log('\n🎉 All uploads completed successfully!');
    } catch (error) {
        console.error('❌ Upload failed:', error.message);
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
📚 Question Bulk Upload Tool

Usage:
  node bulk-upload-questions.js <json-file>

Example:
  node bulk-upload-questions.js ../data/new-questions.json
        `);
        process.exit(1);
    }
    
    const [filePath] = args;
    uploadFromJSONFile(filePath);
}