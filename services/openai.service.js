const OpenAI = require('openai');

class OpenAIService {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }
        
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    async generateQuestions({ type, level, count = 5 }) {
        try {
            const prompt = this.createQuestionPrompt(type, level, count);
            
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo",
                messages: [
                    {
                        role: "system",
                        content: this.getSystemPrompt(type, level)
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            });

            const questionsText = response.choices[0].message.content;
            return this.parseQuestions(questionsText) || this.getFallbackQuestions(type, level, count);
        } catch (error) {
            console.error('OpenAI Question Generation Error:', error);
            return this.getFallbackQuestions(type, level, count);
        }
    }

    getSystemPrompt(type, level) {
        const levelDescriptions = {
            'jr': 'entry-level professional with basic knowledge',
            'mid': 'mid-level professional with solid practical experience',
            'senior': 'experienced professional with deep technical expertise',
            'expert': 'top-tier professional with comprehensive industry knowledge'
        };

        const typeDescriptions = {
            'technical': 'assessing technical skills, problem-solving, and technical depth',
            'behavioral': 'evaluating soft skills, teamwork, and professional conduct',
            'situational': 'exploring decision-making and problem-solving in real-world scenarios'
        };

        return `You are an expert interviewer specializing in ${type} interviews for ${level}-level professionals. 
        Design questions that thoroughly assess a ${levelDescriptions[level]} by ${typeDescriptions[type]}.
        Ensure questions are challenging, relevant, and provide insights into the candidate's capabilities.`;
    }

    createQuestionPrompt(type, level, count) {
        return `Generate ${count} carefully crafted ${level}-level ${type} interview questions.
        Each question must:
        - Be specific and contextually relevant
        - Test both theoretical knowledge and practical experience
        - Include potential follow-up points
        - Align with professional expectations for a ${level} candidate
        
        Return as a structured JSON array with these properties:
        - id: unique identifier (e.g., q1, q2)
        - text: full question text
        - difficulty: explicit difficulty rating (easy/medium/hard)
        - category: specific skill or competency being assessed`;
    }

    parseQuestions(content) {
        try {
            const jsonMatch = content.match(/\[{.*}]/s);
            if (!jsonMatch) return null;
            
            const questions = JSON.parse(jsonMatch[0]);
            
            return questions.map(q => ({
                id: q.id || `q_${Math.random().toString(36).substr(2, 9)}`,
                text: q.text,
                difficulty: q.difficulty || 'medium',
                category: q.category || 'general'
            }));
        } catch (error) {
            console.error('Question Parsing Error:', error);
            return null;
        }
    }

    getFallbackQuestions(type, level, count) {
        const fallbackQuestionSets = {
            'technical': [
                { text: 'Describe a challenging technical problem you solved recently.', difficulty: 'medium' },
                { text: 'How do you approach debugging complex software issues?', difficulty: 'hard' },
                { text: 'Explain a technical concept you recently learned.', difficulty: 'easy' }
            ],
            'behavioral': [
                { text: 'Tell me about a time you worked effectively in a team.', difficulty: 'medium' },
                { text: 'How do you handle disagreements with team members?', difficulty: 'medium' },
                { text: 'Describe a situation where you showed leadership.', difficulty: 'hard' }
            ],
            'situational': [
                { text: 'How would you handle a project deadline at risk?', difficulty: 'medium' },
                { text: 'What would you do if a team member is consistently underperforming?', difficulty: 'hard' },
                { text: 'Describe how you would prioritize multiple competing tasks.', difficulty: 'medium' }
            ]
        };

        const baseQuestions = fallbackQuestionSets[type] || fallbackQuestionSets['technical'];
        
        return baseQuestions
            .slice(0, count)
            .map((q, index) => ({
                id: `q${index + 1}`,
                text: q.text,
                difficulty: q.difficulty,
                category: type
            }));
    }
}

module.exports = new OpenAIService();