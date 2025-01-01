// backend/middleware/interview-access.js
const admin = require('firebase-admin');

async function validateInterviewAccess(req, res, next) {
    try {
        const { id } = req.params;
        const db = admin.firestore();

        // Fetch interview details
        const interviewDoc = await db.collection('interviews').doc(id).get();
        
        if (!interviewDoc.exists) {
            return res.status(404).json({ error: 'Interview not found' });
        }

        const interviewData = interviewDoc.data();

        // Check interview status
        if (interviewData.status !== 'scheduled') {
            return res.status(400).json({ error: 'Interview is not active' });
        }

        // Verify interview time window
        const interviewTime = interviewData.date.toDate();
        const now = new Date();
        const timeDiff = interviewTime.getTime() - now.getTime();
        
        // Allow access 15 minutes before and until 1 hour after
        if (timeDiff < -60 * 60 * 1000 || timeDiff > 15 * 60 * 1000) {
            return res.status(403).json({ 
                error: 'Interview is not currently accessible',
                details: 'Check interview time or contact interviewer'
            });
        }

        // Optional: Verify candidate email if implemented
        if (req.user.email !== interviewData.candidateEmail) {
            return res.status(403).json({ 
                error: 'Access denied',
                details: 'You are not the assigned candidate'
            });
        }

        // Attach interview data to request for further use
        req.interviewData = interviewData;
        next();
    } catch (error) {
        console.error('Interview access validation error:', error);
        res.status(500).json({ 
            error: 'Server error during interview access validation' 
        });
    }
}

module.exports = { validateInterviewAccess };