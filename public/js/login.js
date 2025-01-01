// backend/public/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const errorDiv = document.getElementById('loginError');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const submitButton = loginForm.querySelector('button[type="submit"]');
    const spinnerElement = submitButton.querySelector('.spinner-border');
    const buttonText = submitButton.querySelector('.btn-text');

    // Disable built-in browser validation
    loginForm.setAttribute('novalidate', '');

    // Password Visibility Toggle
    togglePasswordBtn.addEventListener('click', () => {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;
        togglePasswordBtn.querySelector('i').classList.toggle('bi-eye');
        togglePasswordBtn.querySelector('i').classList.toggle('bi-eye-slash');
    });

    // Form Validation Function
    function validateForm() {
        let isValid = true;
        
        // Email Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
            emailInput.classList.add('is-invalid');
            isValid = false;
        } else {
            emailInput.classList.remove('is-invalid');
        }

        // Password Validation
        if (passwordInput.value.trim().length < 6) {
            passwordInput.classList.add('is-invalid');
            isValid = false;
        } else {
            passwordInput.classList.remove('is-invalid');
        }

        return isValid;
    }

    // Loading State Management
    function setLoadingState(isLoading) {
        submitButton.disabled = isLoading;
        spinnerElement.classList.toggle('d-none', !isLoading);
        buttonText.textContent = isLoading ? 'Logging in...' : 'Login';
        loadingOverlay.classList.toggle('d-none', !isLoading);
        emailInput.disabled = isLoading;
        passwordInput.disabled = isLoading;
        togglePasswordBtn.disabled = isLoading;
    }

    // Error Handling
    function displayError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('d-none');
        setTimeout(() => {
            errorDiv.classList.add('d-none');
        }, 5000);
    }

    // Login Form Submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Reset previous errors
        errorDiv.classList.add('d-none');
        emailInput.classList.remove('is-invalid');
        passwordInput.classList.remove('is-invalid');
    
        // Validate form
        if (!validateForm()) {
            return;
        }
    
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        setLoadingState(true);
    
        try {
            // Firebase Authentication with SESSION persistence
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
            
            // Sign in
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const idToken = await userCredential.user.getIdToken();
    
            // Verify with backend
            const response = await fetch('/api/auth/verify-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: idToken })
            });
    
            if (!response.ok) {
                throw new Error('Backend verification failed');
            }
    
            // Redirect to index page on success
            window.location.href = '/index.html';
    
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'Authentication failed. Please try again.';
    
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address format.';
                    emailInput.classList.add('is-invalid');
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled. Contact support.';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email.';
                    emailInput.classList.add('is-invalid');
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password. Please try again.';
                    passwordInput.classList.add('is-invalid');
                    break;
            }
    
            displayError(errorMessage);
        } finally {
            setLoadingState(false);
        }
    });
});