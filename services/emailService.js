// /backend/services/emailService.js

const { ses } = require('../config/aws');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
    constructor() {
        this.templates = {};
        this.initializeTemplates();
    }

    async initializeTemplates() {
        try {
            const templatePath = path.join(__dirname, '../templates/emails');
            const templates = await fs.readdir(templatePath);
            
            for (const template of templates) {
                const content = await fs.readFile(
                    path.join(templatePath, template),
                    'utf8'
                );
                this.templates[path.parse(template).name] = content;
            }
        } catch (error) {
            console.error('Failed to load email templates:', error);
        }
    }

    async sendEmail({ to, subject, htmlBody, textBody, attachments = [] }) {
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
                }
            };

            // Handle attachments if any
            if (attachments.length > 0) {
                params.Message.Attachments = attachments.map(attachment => ({
                    Filename: attachment.filename,
                    Content: attachment.content,
                    ContentType: attachment.contentType
                }));
            }

            const result = await ses.sendEmail(params).promise();
            console.log(`Email sent successfully: ${result.MessageId}`);
            return { success: true, messageId: result.MessageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    async sendInterviewInvite(interview) {
        try {
            const template = this.templates['interview-invite'];
            const htmlBody = template
                .replace('{{candidateName}}', interview.candidateName)
                .replace('{{date}}', interview.date.toDate().toLocaleString())
                .replace('{{meetingLink}}', interview.meetingLink);

            return await this.sendEmail({
                to: interview.candidateEmail,
                subject: 'Interview Scheduled - TalentSync',
                htmlBody,
                textBody: this.generateTextVersion(htmlBody)
            });
        } catch (error) {
            console.error('Failed to send interview invite:', error);
            throw error;
        }
    }

    async sendInterviewReminder(interview) {
        try {
            const template = this.templates['interview-reminder'];
            const htmlBody = template
                .replace('{{candidateName}}', interview.candidateName)
                .replace('{{date}}', interview.date.toDate().toLocaleString())
                .replace('{{meetingLink}}', interview.meetingLink);

            return await this.sendEmail({
                to: interview.candidateEmail,
                subject: 'Interview Reminder - TalentSync',
                htmlBody,
                textBody: this.generateTextVersion(htmlBody)
            });
        } catch (error) {
            console.error('Failed to send interview reminder:', error);
            throw error;
        }
    }

    generateTextVersion(html) {
        return html
            .replace(/<[^>]+>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

const emailService = new EmailService();
module.exports = emailService;