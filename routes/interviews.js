const express = require('express');
const admin = require('firebase-admin');

const router = express.Router();
const { body, validationResult } = require('express-validator');
const emailService = require('../services/email.service');

const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: 'Unauthorized' });
    }
};

router.get('/:id/verify-access', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`[DEBUG] Verifying access for interview: ${id}`);

        const db = admin.firestore();
        const interviewDoc = await db.collection('interviews').doc(id).get();

        if (!interviewDoc.exists) {
            console.log(`[DEBUG] Interview not found: ${id}`);
            return res.status(404).json({ 
                error: 'Interview not found',
                details: 'No interview exists with this ID'
            });
        }

        const interviewData = interviewDoc.data();
        console.log('[DEBUG] Interview Data:', JSON.stringify(interviewData, null, 2));

        if (interviewData.status === 'cancelled') {
            console.log(`[DEBUG] Interview is cancelled`);
            return res.status(400).json({ 
                error: 'Interview has been cancelled',
                status: interviewData.status
            });
        }

        console.log('[DEBUG] Interview access verified successfully');
        return res.json({
            id: interviewDoc.id,
            candidateName: interviewData.candidateName,
            candidateEmail: interviewData.candidateEmail,
            type: interviewData.type || 'technical',
            level: interviewData.level || 'mid',
            duration: interviewData.duration || 45,
            questionCount: interviewData.questionCount || 5,
            status: interviewData.status
        });
    } catch (error) {
        console.error('[DEBUG] Interview Access Verification Error:', error);
        res.status(500).json({ 
            error: 'Server error during interview access validation',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

router.post('/schedule', authenticateUser, [
    body('candidateName').trim().notEmpty().withMessage('Candidate name is required'),
    body('candidateEmail').isEmail().withMessage('Valid email is required'),
    body('date').isISO8601().withMessage('Valid date is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { candidateName, candidateEmail, date, type = 'technical', level = 'mid' } = req.body;
        const interviewDate = new Date(date);
        
        if (interviewDate <= new Date()) {
            return res.status(400).json({ error: 'Interview must be scheduled in the future' });
        }

        const db = admin.firestore();
        const interviewData = {
            candidateName,
            candidateEmail,
            date: admin.firestore.Timestamp.fromDate(interviewDate),
            type,
            level,
            status: 'scheduled',
            interviewerId: req.user.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const interviewRef = await db.collection('interviews').add(interviewData);
        
        try {
            await emailService.sendInterviewInvite({
                id: interviewRef.id,
                ...interviewData
            });
        } catch (emailError) {
            console.error('Failed to send email invitation:', emailError);
        }

        res.status(201).json({
            id: interviewRef.id,
            ...interviewData,
            date: interviewDate.toISOString()
        });
    } catch (error) {
        console.error('Schedule interview error:', error);
        res.status(500).json({ error: 'Failed to schedule interview' });
    }
});

router.get('/', authenticateUser, async (req, res) => {
    try {
        const db = admin.firestore();
        const { status } = req.query;

        let query = db.collection('interviews')
            .where('interviewerId', '==', req.user.uid)
            .orderBy('date', 'desc');

        if (status) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.get();
        const interviews = [];

        snapshot.forEach(doc => {
            interviews.push({
                id: doc.id,
                ...doc.data(),
                date: doc.data().date.toDate().toISOString()
            });
        });

        res.json(interviews);
    } catch (error) {
        console.error('Get interviews error:', error);
        res.status(500).json({
            error: 'Failed to fetch interviews',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

router.patch('/:id/cancel', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const db = admin.firestore();
        const interviewRef = db.collection('interviews').doc(id);

        const interview = await interviewRef.get();
        if (!interview.exists) {
            return res.status(404).json({ error: 'Interview not found' });
        }

        if (interview.data().interviewerId !== req.user.uid) {
            return res.status(403).json({ error: 'Not authorized to cancel this interview' });
        }

        await interviewRef.update({
            status: 'cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            cancelledBy: req.user.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            message: 'Interview cancelled successfully',
            id
        });
    } catch (error) {
        console.error('Cancel interview error:', error);
        res.status(500).json({
            error: 'Failed to cancel interview',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// backend/routes/interviews.js - send-invite route

router.post('/:id/send-invite', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('[DEBUG] Send invite request:', id);

        const db = admin.firestore();
        const interviewDoc = await db.collection('interviews').doc(id).get();

        if (!interviewDoc.exists) {
            return res.status(404).json({ error: 'Interview not found' });
        }

        const interviewData = interviewDoc.data();
        console.log('[VERBOSE] Interview Data:', JSON.stringify(interviewData, null, 2));
        console.log('[VERBOSE] Email Configuration:', {
            from: process.env.EMAIL_FROM,
            awsRegion: process.env.AWS_REGION,
            candidateEmail: interviewData.candidateEmail
        });

        try {
            const emailResult = await emailService.sendInterviewInvite({
                id,
                candidateName: interviewData.candidateName,
                candidateEmail: interviewData.candidateEmail,
                date: interviewData.date,
                meetingLink: `${process.env.FRONTEND_URL}/interview/${id}`
            });

            console.log('[SUCCESS] Email Sending Result:', emailResult);

            await interviewDoc.ref.update({
                inviteSentAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ 
                message: 'Interview invitation sent successfully',
                emailResult 
            });
        } catch (emailError) {
            console.error('[ERROR] Email Sending Failure:', {
                message: emailError.message,
                stack: emailError.stack
            });
            
            res.status(500).json({ 
                error: 'Failed to send interview invitation', 
                details: emailError.message 
            });
        }
    } catch (error) {
        console.error('[CRITICAL] Invite Sending Process Error:', {
            message: error.message,
            stack: error.stack
        });
        
        res.status(500).json({ 
            error: 'Unexpected error in invite process', 
            details: error.message 
        });
    }
});

router.post('/complete', async (req, res) => {
    try {
        const { interviewId, questions, fraudDetectionEvents, duration, completedAt } = req.body;

        const db = admin.firestore();
        const interviewRef = db.collection('interviews').doc(interviewId);

        const completionData = {
            status: 'completed',
            questions,
            fraudDetectionEvents,
            duration,
            completedAt: admin.firestore.Timestamp.fromDate(new Date(completedAt)),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await interviewRef.update(completionData);

        res.json({
            message: 'Interview completed successfully',
            id: interviewId
        });
    } catch (error) {
        console.error('Complete interview error:', error);
        res.status(500).json({
            error: 'Failed to complete interview',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;