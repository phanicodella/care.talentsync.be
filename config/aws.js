// /backend/config/aws.js

const AWS = require('aws-sdk');

// Configure AWS with environment variables
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Initialize SES with specific API version
const ses = new AWS.SES({ 
    apiVersion: '2010-12-01',
    // Add retry configuration for better reliability
    maxRetries: 3,
    retryDelayOptions: {
        base: 100 // milliseconds
    }
});

// Verify email sending works
const verifyEmailConfiguration = async () => {
    try {
        await ses.getSendQuota().promise();
        console.log('AWS SES configured successfully');
    } catch (error) {
        console.error('AWS SES configuration error:', error);
        throw new Error('Failed to configure AWS SES');
    }
};

module.exports = {
    ses,
    verifyEmailConfiguration
};