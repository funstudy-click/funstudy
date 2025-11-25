const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS
AWS.config.update({ region: 'eu-north-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbService = new AWS.DynamoDB();

class UK11PlusUploader {
    constructor() {
        this.batchSize = 25;
        this.delayBetweenBatches = 100;
    }

    async uploadAllQuestions() {
        console.log('🎓 UK 11 Plus Questions Upload Started');
        console.log('=====================================');

        const questionFiles = [
            {
                file: 'uk-11plus-questions.json',
                tableName: 'GradeA_Math_Questions',
                key: 'GradeA_Math_Questions'
            },
            {
                file: 'grade-b-math-questions.json',
                tableName: 'GradeB_Math_Questions',
                key: 'GradeB_Math_Questions'
            },
            {
                file: 'grade-c-math-questions.json',
                tableName: 'GradeC_Math_Questions', 
                key: 'GradeC_Math_Questions'
            }
        ];

        let totalSuccess = 0;
        let totalErrors = 0;

        for (const fileInfo of questionFiles) {
            try {
                const filePath = path.join(__dirname, '..', 'data', fileInfo.file);
                
                if (!fs.existsSync(filePath)) {
                    console.log(`⚠️  File not found: ${fileInfo.file}`);
                    continue;
                }

                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const questions = data[fileInfo.key] || [];

                if (questions.length === 0) {
                    console.log(`⚠️  No questions found in ${fileInfo.file}`);
                    continue;
                }

                console.log(`\\n📚 Processing ${fileInfo.file}`);
                console.log(`   Grade: ${fileInfo.tableName}`);
                console.log(`   Questions: ${questions.length}`);

                // Add grade and subject metadata to each question
                const enrichedQuestions = questions.map(q => ({
                    ...q,
                    grade: fileInfo.tableName.split('_')[0],
                    subject: 'Math',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }));

                const result = await this.uploadQuestions(fileInfo.tableName, enrichedQuestions);
                totalSuccess += result.success;
                totalErrors += result.errors;

            } catch (error) {
                console.log(`❌ Error processing ${fileInfo.file}:`, error.message);
                totalErrors++;
            }
        }

        console.log('\\n🎯 Upload Summary');
        console.log('==================');
        console.log(`✅ Total Success: ${totalSuccess}`);
        console.log(`❌ Total Errors: ${totalErrors}`);
        console.log(`📊 Success Rate: ${((totalSuccess / (totalSuccess + totalErrors)) * 100).toFixed(1)}%`);
    }

    async uploadQuestions(tableName, questions) {
        console.log(`\\n📋 Starting upload to ${tableName} (${questions.length} questions)`);
        
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
            RequestItems: {
                [tableName]: putRequests
            }
        };

        const result = await dynamodb.batchWrite(params).promise();
        
        let errors = 0;
        if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
            errors = result.UnprocessedItems[tableName] ? result.UnprocessedItems[tableName].length : 0;
            console.log(`    ⚠️  ${errors} unprocessed items`);
        }

        return { success: questions.length - errors, errors };
    }

    async createTableIfNotExists(tableName) {
        try {
            await dynamodbService.describeTable({ TableName: tableName }).promise();
            console.log(`  ✅ Table ${tableName} exists`);
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                console.log(`  🔨 Creating table ${tableName}...`);
                await this.createTable(tableName);
            } else {
                throw error;
            }
        }
    }

    async createTable(tableName) {
        const params = {
            TableName: tableName,
            KeySchema: [
                { AttributeName: 'questionId', KeyType: 'HASH' }
            ],
            AttributeDefinitions: [
                { AttributeName: 'questionId', AttributeType: 'S' }
            ],
            BillingMode: 'PAY_PER_REQUEST'
        };

        await dynamodbService.createTable(params).promise();
        console.log(`  ✅ Table ${tableName} created successfully`);
        
        // Wait for table to be active
        await this.waitForTableActive(tableName);
    }

    async waitForTableActive(tableName) {
        console.log(`  ⏳ Waiting for table ${tableName} to be active...`);
        
        while (true) {
            const result = await dynamodbService.describeTable({ TableName: tableName }).promise();
            if (result.Table.TableStatus === 'ACTIVE') {
                console.log(`  ✅ Table ${tableName} is now active`);
                break;
            }
            await this.delay(1000);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the upload
async function main() {
    try {
        const uploader = new UK11PlusUploader();
        await uploader.uploadAllQuestions();
        console.log('\\n🎉 All questions uploaded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('💥 Upload failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = UK11PlusUploader;