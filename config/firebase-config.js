// /frontend/js/firebase-config.js

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCtqnl-95_iYESTBHu_FlFtj80Ab4zMqZk",
    authDomain: "talentsync-70bbb.firebaseapp.com",
    projectId: "talentsync-70bbb",
    storageBucket: "talentsync-70bbb.firebasestorage.app",
    messagingSenderId: "13476679191",
    appId: "1:13476679191:web:f328102e1b692d07b51652"
};

// Initialize Firebase with error handling
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // Initialize services
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Configure Firestore
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
    });

    // Enable offline persistence
    db.enablePersistence()
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code == 'unimplemented') {
                console.warn('The current browser does not support persistence.');
            }
        });

    // Configure Auth persistence
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .catch((error) => {
            console.error('Auth persistence error:', error);
        });

    // Export Firebase instances
    window.auth = auth;
    window.db = db;
    window.storage = storage;
    window.firebase = firebase;

} catch (error) {
    console.error('Firebase initialization error:', error);
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger m-3';
    errorDiv.role = 'alert';
    errorDiv.textContent = 'Failed to initialize application. Please refresh the page or contact support.';
    document.body.prepend(errorDiv);
}

// Authentication state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        console.log('User is signed in:', user.email);
        document.body.classList.add('logged-in');
        
        // Update UI elements that show user info
        const userElements = document.querySelectorAll('.user-email');
        userElements.forEach(el => {
            el.textContent = user.email;
        });
    } else {
        // User is signed out
        console.log('User is signed out');
        document.body.classList.remove('logged-in');
        
        // Redirect to login if not already there
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
});

// Export auth state check function
window.checkAuth = async () => {
    return new Promise((resolve, reject) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                reject(new Error('Not authenticated'));
            }
        });
    });
};

// Export token getter function
window.getAuthToken = async () => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error('No authenticated user');
    }
    return await user.getIdToken(true);
};
