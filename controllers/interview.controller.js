// backend/controllers/interview.controller.js

const admin = require('firebase-admin');
const openAIService = require('../services/openai.service');
const analysisService = require('../services/analysis.service');

class InterviewController {
    // Create a new interview session
    async createInterview(req, res) {
        try {
            const { type, level, duration, candidateEmail } = req.body;
            const interviewer = req.user.uid;

            const interviewData = {
                type,
                level,
                duration,
                candidateEmail,
                interviewer,
                status: 'scheduled',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            const interviewRef = await admin.firestore()
                .collection('interviews')
                .add(interviewData);

            res.status(201).json({
                id: interviewRef.id,
                ...interviewData
            });
        } catch (error) {
            console.error('Create interview error:', error);
            res.status(500).json({
                error: 'Failed to create interview',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // Get interview details
    async getInterview(req, res) {
        try {
            const { id } = req.params;
            const doc = await admin.firestore()
                .collection('interviews')
                .doc(id)
                .get();

            if (!doc.exists) {
                return res.status(404).json({ error: 'Interview not found' });
            }

            res.json({
                id: doc.id,
                ...doc.data()
            });
        } catch (error) {
            console.error('Get interview error:', error);
            res.status(500).json({
                error: 'Failed to fetch interview',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // Update interview status
    async updateInterview(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Remove protected fields
            delete updates.interviewer;
            delete updates.createdAt;

            updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

            await admin.firestore()
                .collection('interviews')
                .doc(id)
                .update(updates);

            res.json({ message: 'Interview updated successfully' });
        } catch (error) {
            console.error('Update interview error:', error);
            res.status(500).json({
                error: 'Failed to update interview',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // Generate interview questions
    async generateQuestions(req, res) {
        try {
            const { type, level, count } = req.body;
            
            const questions = await openAIService.generateQuestions({
                type,
                level,
                count: count || 5
            });

            res.json(questions);
        } catch (error) {
            console.error('Generate questions error:', error);
            res.status(500).json({
                error: 'Failed to generate questions',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // Complete interview session
    async completeInterview(req, res) {
        try {
            const { id } = req.params;
            const { feedback, responses, fraudDetectionEvents } = req.body;

            const completionData = {
                status: 'completed',
                feedback,
                responses,
                fraudDetectionEvents,
                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await admin.firestore()
                .collection('interviews')
                .doc(id)
                .update(completionData);

            res.json({
                message: 'Interview completed successfully',
                id
            });
        } catch (error) {
            console.error('Complete interview error:', error);
            res.status(500).json({
                error: 'Failed to complete interview',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // List interviews for an interviewer
    async listInterviews(req, res) {
        try {
            const interviewer = req.user.uid;
            const { status, limit = 10 } = req.query;

            let query = admin.firestore()
                .collection('interviews')
                .where('interviewer', '==', interviewer)
                .orderBy('createdAt', 'desc')
                .limit(parseInt(limit));

            if (status) {
                query = query.where('status', '==', status);
            }

            const snapshot = await query.get();
            const interviews = [];

            snapshot.forEach(doc => {
                interviews.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            res.json(interviews);
        } catch (error) {
            console.error('List interviews error:', error);
            res.status(500).json({
                error: 'Failed to list interviews',
                message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }
}

module.exports = new InterviewController();