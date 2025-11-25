const AWS = require('aws-sdk');

AWS.config.update({ region: 'eu-north-1' });
const dynamodbService = new AWS.DynamoDB();

async function debugSubjects() {
    try {
        const result = await dynamodbService.listTables().promise();
        const grade = 'GradeA';
        
        console.log('=== DEBUG SUBJECTS ===');
        console.log('All tables:', result.TableNames);
        
        // Filter tables that match the grade pattern
        const gradePattern = new RegExp(`^${grade}_(.+)_Questions$`);
        const subjects = [];
        
        result.TableNames.forEach(tableName => {
            const match = tableName.match(gradePattern);
            if (match) {
                subjects.push(match[1]); // Extract subject name
                console.log(`Table: ${tableName} -> Subject: ${match[1]}`);
            }
        });
        
        console.log('Raw subjects found:', subjects);
        
        // Filter subjects to only include Math-related subjects
        const allowedSubjects = ['Maths', 'Math', 'Mathematics'];
        const mathSubjects = subjects.filter(subject => 
            allowedSubjects.some(allowed => 
                subject.toLowerCase().includes(allowed.toLowerCase())
            )
        );
        
        console.log('Math subjects found:', mathSubjects);
        
        // Normalize all math variants to just 'Math'
        const normalizedSubjects = mathSubjects.map(subject => {
            if (subject.toLowerCase().includes('math')) {
                return 'Math';
            }
            return subject;
        });
        
        console.log('Normalized subjects:', normalizedSubjects);
        
        // Remove duplicates
        const uniqueSubjects = [...new Set(normalizedSubjects)];
        
        console.log('Final unique subjects:', uniqueSubjects);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

debugSubjects();