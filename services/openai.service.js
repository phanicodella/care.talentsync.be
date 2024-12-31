// /backend/services/openaiService.js

const OpenAI = require('openai');

class OpenAIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async generateFeedbackSummary(feedbackData) {
        try {
            const prompt = this.createFeedbackPrompt(feedbackData);
            
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert HR professional summarizing interview feedback. Provide concise, professional, and actionable feedback."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API error:', error);
            throw new Error('Failed to generate feedback summary');
        }
    }

    createFeedbackPrompt(feedbackData) {
        return `
            Please provide a professional interview feedback summary based on the following information:
            
            Technical Skills Rating: ${feedbackData.technicalSkills}/5
            Communication Skills Rating: ${feedbackData.communicationSkills}/5
            
            Interviewer Notes:
            ${feedbackData.notes}
            
            Please structure the response with:
            1. Overall Assessment
            2. Technical Strengths
            3. Areas for Improvement
            4. Final Recommendation
            
            Keep the tone professional and constructive.
        `;
    }

    async validateContent(content) {
        try {
            const response = await this.openai.moderations.create({
                input: content
            });

            return {
                isAppropriate: !response.results[0].flagged,
                categories: response.results[0].categories
            };
        } catch (error) {
            console.error('Content validation error:', error);
            return { isAppropriate: true }; // Fail safe
        }
    }
}

// Create singleton instance
const openAIService = new OpenAIService();

module.exports = openAIService;