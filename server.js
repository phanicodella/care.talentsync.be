// /backend/server.js

require('dotenv').config();
const winston = require('winston');
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initializeFirebaseAdmin } = require('./config/firebase-config');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const { verifySESSetup, verifyEmailSender } = require('./config/aws');

// Initialize Firebase Admin
const firebaseConfig = initializeFirebaseAdmin();

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? 'https://talentsync.tech'
        : ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Body parsing
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Authentication Middleware
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await firebaseConfig.admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Import routes
const authRoutes = require('./routes/auth');
const interviewRoutes = require('./routes/interviews');
const analysisRoutes = require('./routes/analysis');
const questionRoutes = require('./routes/questions');

// Route registration
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes); // Remove authenticateUser for interview routes
app.use('/api/analysis', authenticateUser, analysisRoutes);
app.use('/api/questions', questionRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Basic WebSocket message handling
            switch(data.type) {
                case 'interview_start':
                    console.log('Interview started');
                    break;
                case 'candidate_response':
                    console.log('Candidate response received');
                    break;
                case 'fraud_detection':
                    console.log('Fraud detection update');
                    break;
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// Interview room route - IMPORTANT: This must come before the catch-all route
app.get('/interview/:id', (req, res) => {
    console.log(`Serving interview room for ID: ${req.params.id}`);
    res.sendFile(path.join(__dirname, 'public', 'templates', 'interview-room.html'));
});

// Serve interview room
app.get('/interview-room', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'templates', 'interview-room.html'));
});

// Catch-all route for frontend routing
app.get('*', (req, res) => {
    // Don't redirect interview routes
    if (req.path.startsWith('/interview/')) {
        res.sendFile(path.join(__dirname, 'public', 'templates', 'interview-room.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// Server startup
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});
// logger:
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

global.logger = logger;

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

module.exports = app;