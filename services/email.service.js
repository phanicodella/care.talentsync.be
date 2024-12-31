// /backend/services/emailService.js

const { ses } = require('../config/aws');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');

class EmailService {
    constructor() {
        this.templates = {};
        this.templatePath = path.join(__dirname, '../templates/emails');
        this.initializeTemplates();
        this.setupRetryPolicy();
    }

    setupRetryPolicy() {
        this.retryConfig = {
            maxRetries: 3,
            initialDelay: 1000, // 1 second
            maxDelay: 5000,     // 5 seconds
            backoffMultiplier: 2
        };
    }

    async initializeTemplates() {
        try {
            const templates = await fs.readdir(this.templatePath);
            
            for (const template of templates) {
                const content = await fs.readFile(
                    path.join(this.templatePath, template),
                    'utf8'
                );
                // Compile the template with Handlebars
                const templateName = path.parse(template).name;
                this.templates[templateName] = handlebars.compile(content);
            }
            console.log('Email templates loaded successfully');
        } catch (error) {
            console.error('Failed to load email templates:', error);
            throw new Error('Email template initialization failed');
        }
    }

    async sendEmail({ to, subject, htmlBody, textBody, attachments = [], replyTo = null, priority = 'normal' }) {
        let attempt = 0;
        let lastError = null;

        while (attempt < this.retryConfig.maxRetries) {
            try {
                const params = {
                    Source: process.env.EMAIL_FROM,
                    Destination: {
                        ToAddresses: Array.isArray(to) ? to : [to]
                    },
                    Message: {
                        Subject: {
                            Data: subject,
                            Charset: 'UTF-8'
                        },
                        Body: {
                            Text: {
                                Data: textBody,
                                Charset: 'UTF-8'
                            },
                            Html: {
                                Data: htmlBody,
                                Charset: 'UTF-8'
                            }
                        }
                    },
                    ConfigurationSetName: process.env.AWS_SES_CONFIG_SET || 'default',
                    Tags: [
                        {
                            Name: 'Priority',
                            Value: priority
                        }
                    ]
                };

                if (replyTo) {
                    params.ReplyToAddresses = [replyTo];
                }

                if (attachments.length > 0) {
                    params.Message.Attachments = attachments.map(attachment => ({
                        Filename: attachment.filename,
                        Content: attachment.content,
                        ContentType: attachment.contentType
                    }));
                }

                const result = await ses.sendEmail(params).promise();
                await this.logEmailSuccess(result.MessageId, to, subject);
                return { success: true, messageId: result.MessageId };

            } catch (error) {
                lastError = error;
                attempt++;

                if (attempt < this.retryConfig.maxRetries) {
                    const delay = Math.min(
                        this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
                        this.retryConfig.maxDelay
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    await this.logEmailFailure(to, subject, error);
                    throw new Error(`Failed to send email after ${attempt} attempts: ${error.message}`);
                }
            }
        }
    }

    async logEmailSuccess(messageId, recipient, subject) {
        try {
            const db = admin.firestore();
            await db.collection('emailLogs').add({
                messageId,
                recipient,
                subject,
                status: 'sent',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error logging email success:', error);
        }
    }

    async logEmailFailure(recipient, subject, error) {
        try {
            const db = admin.firestore();
            await db.collection('emailLogs').add({
                recipient,
                subject,
                status: 'failed',
                error: error.message,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (logError) {
            console.error('Error logging email failure:', logError);
        }
    }

    async sendInterviewInvite(interview) {
        try {
            const template = this.templates['interview-invite'];
            const htmlBody = template({
                candidateName: interview.candidateName,
                date: interview.date.toDate().toLocaleString(),
                meetingLink: interview.meetingLink,
                position: interview.position || 'Not specified'
            });

            return await this.sendEmail({
                to: interview.candidateEmail,
                subject: 'Interview Scheduled - TalentSync',
                htmlBody,
                textBody: this.generateTextVersion(htmlBody),
                priority: 'high'
            });
        } catch (error) {
            console.error('Failed to send interview invite:', error);
            throw error;
        }
    }

    async sendInterviewReminder(interview) {
        try {
            const template = this.templates['interview-reminder'];
            const htmlBody = template({
                candidateName: interview.candidateName,
                date: interview.date.toDate().toLocaleString(),
                meetingLink: interview.meetingLink
            });

            return await this.sendEmail({
                to: interview.candidateEmail,
                subject: 'Interview Reminder - TalentSync',
                htmlBody,
                textBody: this.generateTextVersion(htmlBody),
                priority: 'high'
            });
        } catch (error) {
            console.error('Failed to send interview reminder:', error);
            throw error;
        }
    }

    async sendInterviewCancellation(interview) {
        try {
            const template = this.templates['interview-cancellation'];
            const rescheduleLink = `${process.env.FRONTEND_URL}/reschedule?id=${interview.id}`;
            
            const htmlBody = template({
                candidateName: interview.candidateName,
                date: interview.date.toDate().toLocaleString(),
                position: interview.position || 'Not specified',
                rescheduleLink,
                cancellationReason: interview.cancellationReason
            });

            return await this.sendEmail({
                to: interview.candidateEmail,
                subject: 'Interview Cancelled - TalentSync',
                htmlBody,
                textBody: this.generateTextVersion(htmlBody),
                priority: 'high'
            });
        } catch (error) {
            console.error('Failed to send cancellation email:', error);
            throw error;
        }
    }

    async sendFeedbackSummary(interview) {
        try {
            const template = this.templates['feedback-summary'];
            const htmlBody = template({
                candidateName: interview.candidateName,
                feedback: interview.feedback,
                date: interview.date.toDate().toLocaleString()
            });

            return await this.sendEmail({
                to: interview.candidateEmail,
                subject: 'Interview Feedback - TalentSync',
                htmlBody,
                textBody: this.generateTextVersion(htmlBody)
            });
        } catch (error) {
            console.error('Failed to send feedback summary:', error);
            throw error;
        }
    }

    async sendAdminNotification(type, data) {
        try {
            const adminEmails = process.env.ADMIN_EMAILS.split(',');
            const template = this.templates['admin-notification'];
            const htmlBody = template({
                type,
                data,
                timestamp: new Date().toISOString()
            });

            return await this.sendEmail({
                to: adminEmails,
                subject: `Admin Notification: ${type} - TalentSync`,
                htmlBody,
                textBody: this.generateTextVersion(htmlBody)
            });
        } catch (error) {
            console.error('Failed to send admin notification:', error);
            throw error;
        }
    }

    generateTextVersion(html) {
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<li>/gi, '* ')
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    async verifyEmailAddress(email) {
        try {
            await ses.verifyEmailIdentity({
                EmailAddress: email
            }).promise();
            return true;
        } catch (error) {
            console.error('Failed to verify email address:', error);
            return false;
        }
    }

    async getEmailStatus(messageId) {
        try {
            const db = admin.firestore();
            const logRef = await db.collection('emailLogs')
                .where('messageId', '==', messageId)
                .get();
            
            if (logRef.empty) {
                return null;
            }

            return logRef.docs[0].data();
        } catch (error) {
            console.error('Failed to get email status:', error);
            throw error;
        }
    }
}

// Create and export a singleton instance
const emailService = new EmailService();
module.exports = emailService;