const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Configure AWS
AWS.config.update({ 
    region: process.env.AWS_REGION || 'eu-north-1' 
});

exports.getUserProfile = async (req, res) => {
    try {
        // Check if user is in session
        if (!req.session || !req.session.user) {
            return res.status(401).json({ 
                success: false, 
                error: 'Not authenticated' 
            });
        }
        const userId = req.session.user.sub;
        
        const params = {
            TableName: 'Users',
            Key: { userId }
        };
        
        const data = await dynamodb.get(params).promise();
        
        if (!data.Item) {
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }
        
        res.json({ 
            success: true, 
            user: data.Item 
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch user profile' 
        });
    }
};

exports.getUserAttempts = async (req, res) => {
    try {
        const userId = req.session.user.sub;
        
        const params = {
            TableName: 'UserAttempts',
            FilterExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': userId },
            Limit: 20,
            ScanIndexForward: false // Most recent first
        };
        
        const data = await dynamodb.scan(params).promise();
        
        res.json({ 
            success: true, 
            attempts: data.Items,
            count: data.Items.length
        });
    } catch (error) {
        console.error('Get user attempts error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch user attempts' 
        });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const userId = req.session.user.sub;
        const { gradeLevel, preferences } = req.body;
        
        const params = {
            TableName: 'Users',
            Key: { userId },
            UpdateExpression: 'SET gradeLevel = :gradeLevel, preferences = :preferences',
            ExpressionAttributeValues: {
                ':gradeLevel': gradeLevel,
                ':preferences': preferences
            },
            ReturnValues: 'ALL_NEW'
        };
        
        const data = await dynamodb.update(params).promise();
        
        res.json({ 
            success: true, 
            user: data.Attributes 
        });
    } catch (error) {
        console.error('Update user profile error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update user profile' 
        });
    }
};