// /backend/middleware/auth.js

const admin = require('firebase-admin');

const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Unauthorized', 
                message: 'No token provided' 
            });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Add user info to request
        req.user = decodedToken;
        
        // Check if user has interviewer role (if you implement role-based access)
        if (!decodedToken.email_verified) {
            return res.status(403).json({ 
                error: 'Forbidden', 
                message: 'Email not verified' 
            });
        }

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ 
            error: 'Unauthorized', 
            message: 'Invalid token' 
        });
    }
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    // Handle specific types of errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({ 
            error: 'Validation Error', 
            message: err.message 
        });
    }

    if (err.name === 'FirebaseError') {
        return res.status(401).json({ 
            error: 'Authentication Error', 
            message: 'Invalid authentication' 
        });
    }

    // Default error
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
};

module.exports = {
    authenticateUser,
    errorHandler
};