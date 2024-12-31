// backend/services/analysis.service.js

const admin = require('firebase-admin');
const OpenAI = require('openai');
const config = require('../config');

class AnalysisService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: config.openai.apiKey
        });
    }

    /**
     * Analyzes video frame for potential fraud
     * @param {string} frameData - Base64 encoded image frame
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeFraudDetection(frameData) {
        try {
            // Log analysis attempt
            console.log('Starting fraud detection analysis');

            // Use OpenAI Vision API for analysis
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-vision-preview",
                messages: [{
                    role: "system",
                    content: "You are a fraud detection expert. Analyze this image for signs of interview fraud such as: multiple people, unauthorized devices, screen reflections, or suspicious objects."
                }, {
                    role: "user",
                    content: [{
                        type: "image",
                        image: frameData
                    }]
                }],
                max_tokens: 150
            });

            // Parse response for fraud indicators
            const analysis = response.choices[0].message.content;
            const fraudDetected = this.detectFraudFromAnalysis(analysis);

            // Store analysis result
            await this.storeAnalysisResult({
                type: 'fraud_detection',
                result: fraudDetected,
                analysis: analysis,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                fraudDetected: fraudDetected.detected,
                confidence: fraudDetected.confidence,
                details: fraudDetected.details,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Fraud detection error:', error);
            return {
                fraudDetected: false,
                confidence: 0,
                error: 'Analysis failed',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Analyzes candidate's response
     */
    async analyzeResponse({ transcript, questionId, type, level }) {
        try {
            console.log('Starting response analysis');

            const prompt = this.buildAnalysisPrompt({ transcript, type, level });
            
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [{
                    role: "system",
                    content: "You are an expert at analyzing interview responses. Provide detailed, fair analysis."
                }, {
                    role: "user",
                    content: prompt
                }],
                temperature: 0.3,
                max_tokens: 1000
            });

            const analysis = this.parseAnalysis(completion.choices[0].message.content);

            // Store analysis result
            await this.storeAnalysisResult({
                type: 'response_analysis',
                questionId,
                analysis,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return analysis;
        } catch (error) {
            console.error('Response analysis error:', error);
            throw new Error('Failed to analyze response');
        }
    }

    /**
     * Detects fraud indicators from OpenAI analysis
     * @private
     */
    detectFraudFromAnalysis(analysis) {
        const fraudIndicators = [
            'multiple people',
            'phone',
            'screen',
            'reflection',
            'device',
            'notebook',
            'paper',
            'suspicious'
        ];

        const matches = fraudIndicators.filter(indicator => 
            analysis.toLowerCase().includes(indicator)
        );

        const confidence = matches.length / fraudIndicators.length;

        return {
            detected: matches.length > 0,
            confidence: confidence,
            details: matches.length > 0 ? matches : [],
            rawAnalysis: analysis
        };
    }

    /**
     * Builds prompt for response analysis
     * @private
     */
    buildAnalysisPrompt({ transcript, type, level }) {
        return `Analyze the following ${level} level ${type} interview response:
                \n---\n${transcript}\n---\n
                Provide analysis in JSON format with the following criteria:
                - completeness (0-100)
                - accuracy (0-100)
                - clarity (0-100)
                - technicalDepth (0-100)
                - overallScore (0-100)
                - strengths (array of strings)
                - improvementAreas (array of strings)
                - notes (string with detailed feedback)`;
    }

    /**
     * Parses analysis from OpenAI response
     * @private
     */
    parseAnalysis(content) {
        try {
            // Extract JSON from response
            const jsonStr = content.substring(
                content.indexOf('{'),
                content.lastIndexOf('}') + 1
            );
            
            const analysis = JSON.parse(jsonStr);
            
            // Validate required fields
            const requiredFields = [
                'completeness', 'accuracy', 'clarity',
                'technicalDepth', 'overallScore'
            ];
            
            for (const field of requiredFields) {
                if (!(field in analysis)) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            return analysis;
        } catch (error) {
            console.error('Analysis parsing error:', error);
            throw new Error('Failed to parse analysis from OpenAI response');
        }
    }

    /**
     * Stores analysis result in Firebase
     * @private
     */
    async storeAnalysisResult(data) {
        try {
            await admin.firestore()
                .collection('analysis_results')
                .add({
                    ...data,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            console.error('Error storing analysis result:', error);
            // Don't throw - this is a non-critical operation
        }
    }
}

module.exports = new AnalysisService();