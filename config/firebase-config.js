// backend/config/firebase-config.js
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with robust error handling
function initializeFirebaseAdmin() {
    try {
        // Validate required environment variables
        const requiredEnvVars = [
            'FIREBASE_PROJECT_ID',
            'FIREBASE_CLIENT_EMAIL',
            'FIREBASE_PRIVATE_KEY'
        ];

        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            throw new Error(`Missing Firebase configuration variables: ${missingVars.join(', ')}`);
        }

        // Sanitize private key
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

        // Initialize Firebase Admin
        const firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey
            }),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });

        // Optional: Configure additional services
        const firestore = admin.firestore();
        const storage = admin.storage();
        const auth = admin.auth();

        // Firestore settings

        try {
            // Configure Firestore with all settings at once
            firestore.settings({
                timestampsInSnapshots: true,
                ignoreUndefinedProperties: true,
                cacheSizeBytes: admin.firestore.CACHE_SIZE_UNLIMITED
            });
        } catch (error) {
            console.error('Firestore configuration error:', error);
        }

        // Enhanced authentication configuration
        const configureAuth = async () => {
            try {
                // Custom token generation settings
                await auth.setCustomUserClaims(auth.currentUser?.uid || '', {
                    role: 'user'
                });

                // Session management
                await auth.sessionCookie({
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production'
                });
            } catch (authConfigError) {
                console.error('Authentication configuration error:', authConfigError);
            }
        };

        // Additional security and logging configurations
        const securityConfig = {
            // Custom claims for role-based access
            setUserRole: async (uid, role) => {
                try {
                    await auth.setCustomUserClaims(uid, { role });
                    console.log(`User ${uid} assigned role: ${role}`);
                } catch (roleError) {
                    console.error(`Failed to set user role for ${uid}:`, roleError);
                }
            },

            // Audit logging for critical actions
            auditLog: (action, userId, details = {}) => {
                firestore.collection('audit_logs').add({
                    action,
                    userId,
                    details,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                }).catch(console.error);
            }
        };

        // Proactive error monitoring
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            securityConfig.auditLog('unhandled_rejection', 'system', { reason: reason.toString() });
        });

        return {
            admin: firebaseAdmin,
            firestore,
            storage,
            auth,
            configureAuth,
            securityConfig
        };
    } catch (error) {
        console.error('Firebase Admin Initialization Error:', error);

        // Advanced error reporting
        const errorLog = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        // Optional: Log to a dedicated error collection
        if (admin.firestore) {
            admin.firestore().collection('initialization_errors').add(errorLog)
                .catch(console.error);
        }

        // Graceful shutdown if Firebase cannot be initialized
        process.exit(1);
    }
}

// Export configuration
module.exports = {
    initializeFirebaseAdmin
};