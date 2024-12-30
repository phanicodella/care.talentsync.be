// /backend/routes/interviews.js

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const emailService = require('../services/emailService');

router.post('/schedule', async (req, res) => {
    try {
        const { candidateName, candidateEmail, date, time } = req.body;
        const db = admin.firestore();

        // Validate input
        if (!candidateName || !candidateEmail || !date || !time) {
            return res.status(400).json({
                error: 'Missing required fields'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(candidateEmail)) {
            return res.status(400).json({
                error: 'Invalid email format'
            });
        }

        // Create interview document
        const interviewData = {
            candidateName,
            candidateEmail,
            date: admin.firestore.Timestamp.fromDate(new Date(`${date}T${time}`)),
            status: 'scheduled',
            meetingLink: `${process.env.MEETING_BASE_URL}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            interviewerId: req.user.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const interviewRef = await db.collection('interviews').add(interviewData);

        // Send email notification
        await emailService.sendInterviewInvite({
            id: interviewRef.id,
            ...interviewData
        });

        // Schedule reminder email (24 hours before)
        const reminderDate = new Date(interviewData.date.toDate());
        reminderDate.setHours(reminderDate.getHours() - 24);

        await db.collection('reminders').add({
            interviewId: interviewRef.id,
            type: 'email',
            scheduledFor: admin.firestore.Timestamp.fromDate(reminderDate),
            status: 'pending'
        });

        res.status(201).json({
            id: interviewRef.id,
            ...interviewData
        });

    } catch (error) {
        console.error('Schedule interview error:', error);
        res.status(500).json({
            error: 'Failed to schedule interview',
            message: error.message
        });
    }
});

router.get('/', async (req, res) => {
    try {
        const db = admin.firestore();
        const { status, startDate, endDate } = req.query;

        let query = db.collection('interviews')
            .where('interviewerId', '==', req.user.uid)
            .orderBy('date', 'desc');

        if (status) {
            query = query.where('status', '==', status);
        }

        if (startDate) {
            query = query.where('date', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate)));
        }

        if (endDate) {
            query = query.where('date', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate)));
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
        console.error('Get interviews error:', error);
        res.status(500).json({
            error: 'Failed to fetch interviews',
            message: error.message
        });
    }
});

router.patch('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;
        const db = admin.firestore();

        const interviewRef = db.collection('interviews').doc(id);
        const interview = await interviewRef.get();

        if (!interview.exists) {
            return res.status(404).json({
                error: 'Interview not found'
            });
        }

        if (interview.data().interviewerId !== req.user.uid) {
            return res.status(403).json({
                error: 'Not authorized to cancel this interview'
            });
        }

        await interviewRef.update({
            status: 'cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            cancelledBy: req.user.uid
        });

        // Send cancellation email
        await emailService.sendInterviewCancellation({
            id,
            ...interview.data()
        });

        res.json({
            message: 'Interview cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel interview error:', error);
        res.status(500).json({
            error: 'Failed to cancel interview',
            message: error.message
        });
    }
});

module.exports = router;