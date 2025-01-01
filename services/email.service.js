// E:\interview-tool\backend\services\email.service.js

const AWS = require('aws-sdk');
const winston = require('winston');

// Configure AWS
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const ses = new AWS.SES({ apiVersion: '2010-12-01' });

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        }),
        new winston.transports.File({ 
            filename: 'email-error.log', 
            level: 'error' 
        })
    ]
});

/**
 * Format interview date and time
 * @param {Object} date - Firestore Timestamp
 * @returns {Object} Formatted date and time strings
 */
function formatDateTime(date) {
    const interviewDate = date.toDate();
    return {
        date: interviewDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }),
        time: interviewDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
    };
}

const emailService = {
    /**
     * Send interview invitation email
     * @param {Object} params - Interview details
     * @returns {Promise} SES send result
     */
    async sendInterviewInvite({ id, candidateName, candidateEmail, date, meetingLink }) {
        logger.info('Preparing to send interview invitation', {
            interviewId: id,
            candidateEmail,
            meetingLink
        });

        if (!candidateEmail || !date || !meetingLink) {
            throw new Error('Missing required parameters for interview invitation');
        }

        const { date: formattedDate, time: formattedTime } = formatDateTime(date);

        const emailParams = {
            Source: process.env.EMAIL_FROM.trim(),
            ConfigurationSetName: process.env.AWS_SES_CONFIG_SET,
            Destination: {
                ToAddresses: [candidateEmail]
            },
            Message: {
                Subject: {
                    Data: 'Interview Invitation - TalentSync'
                },
                Body: {
                    Html: {
                        Data: `
                            <h2>Interview Invitation</h2>
                            <p>Dear ${candidateName},</p>
                            <p>You have been invited to an interview session.</p>
                            <p><strong>Date:</strong> ${formattedDate}</p>
                            <p><strong>Time:</strong> ${formattedTime}</p>
                            <p><strong>Duration:</strong> 60 minutes</p>
                            <p><strong>Interview Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>
                            <p>Please ensure you have:</p>
                            <ul>
                                <li>A stable internet connection</li>
                                <li>A quiet environment for the interview</li>
                                <li>A working camera and microphone</li>
                                <li>Any necessary documentation ready</li>
                            </ul>
                            <p>If you need to reschedule, please contact us as soon as possible.</p>
                            <p>Best regards,<br>TalentSync Team</p>
                        `
                    }
                }
            }
        };

        try {
            const result = await ses.sendEmail(emailParams).promise();
            logger.info('Email sent successfully', {
                messageId: result.MessageId,
                interviewId: id
            });
            return {
                success: true,
                messageId: result.MessageId
            };
        } catch (error) {
            logger.error('Failed to send email', {
                error: error.message,
                interviewId: id,
                candidateEmail
            });
            throw error;
        }
    }
};

module.exports = emailService;