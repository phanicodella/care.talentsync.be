// /backend/routes/auth.js

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');

router.post('/verify-token', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ 
                error: 'Token is required' 
            });
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        res.json({ uid: decodedToken.uid });
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ 
            error: 'Invalid token' 
        });
    }
});

router.post('/create-interviewer', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            emailVerified: false
        });

        // Set custom claims for interviewer role
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            interviewer: true
        });

        res.status(201).json({
            message: 'Interviewer created successfully',
            uid: userRecord.uid
        });
    } catch (error) {
        console.error('Create interviewer error:', error);
        res.status(400).json({
            error: 'Failed to create interviewer',
            message: error.message
        });
    }
});

module.exports = router;