// /frontend/js/login.js

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCtqnl-95_iYESTBHu_FlFtj80Ab4zMqZk",
    authDomain: "talentsync-70bbb.firebaseapp.com",
    projectId: "talentsync-70bbb",
    storageBucket: "talentsync-70bbb.firebasestorage.app",
    messagingSenderId: "13476679191",
    appId: "1:13476679191:web:f328102e1b692d07b51652"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// DOM Elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const errorDiv = document.getElementById('loginError');
const loadingOverlay = document.getElementById('loadingOverlay');
const togglePasswordBtn = document.getElementById('togglePassword');
const submitButton = loginForm.querySelector('button[type="submit"]');
const spinnerElement = submitButton.querySelector('.spinner-border');
const buttonText = submitButton.querySelector('.btn-text');

// Toggle password visibility
togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePasswordBtn.querySelector('i').classList.toggle('bi-eye');
    togglePasswordBtn.querySelector('i').classList.toggle('bi-eye-slash');
});

// Form validation
function validateForm() {
    let isValid = true;
    loginForm.classList.remove('was-validated');

    // Email validation
    if (!emailInput.validity.valid) {
        isValid = false;
        emailInput.classList.add('is-invalid');
    } else {
        emailInput.classList.remove('is-invalid');
    }

    // Password validation
    if (!passwordInput.validity.valid) {
        isValid = false;
        passwordInput.classList.add('is-invalid');
    } else {
        passwordInput.classList.remove('is-invalid');
    }

    return isValid;
}

// Handle login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    
    if (!validateForm()) {
        loginForm.classList.add('was-validated');
        return;
    }

    setLoading(true);
    
    try {
        await auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value);
        // Successful login will trigger onAuthStateChanged
    } catch (error) {
        handleAuthError(error);
    } finally {
        setLoading(false);
    }
});

// Error handling
function handleAuthError(error) {
    let errorMessage = 'An error occurred during login. Please try again.';
    
    switch (error.code) {
        case 'auth/invalid-email':
            errorMessage = 'Please enter a valid email address.';
            emailInput.focus();
            break;
        case 'auth/user-disabled':
            errorMessage = 'This account has been disabled. Please contact your administrator.';
            break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            errorMessage = 'Invalid email or password.';
            passwordInput.focus();
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many failed login attempts. Please try again later.';
            break;
    }
    
    showError(errorMessage);
}

// UI Helpers
function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
}

function hideError() {
    errorDiv.textContent = '';
    errorDiv.classList.add('d-none');
}

function setLoading(isLoading) {
    submitButton.disabled = isLoading;
    spinnerElement.classList.toggle('d-none', !isLoading);
    buttonText.textContent = isLoading ? 'Logging in...' : 'Login';
    loadingOverlay.classList.toggle('d-none', !isLoading);
    emailInput.disabled = isLoading;
    passwordInput.disabled = isLoading;
    togglePasswordBtn.disabled = isLoading;
}

// Check authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        window.location.href = 'index.html';
    } else {
        loadingOverlay.classList.add('d-none');
    }
});

// Prevent form resubmission on page refresh
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

// Clear form on page load
window.addEventListener('pageshow', () => {
    loginForm.reset();
    setLoading(false);
    hideError();
});