// /frontend/public/js/app.js
class AppManager {
    constructor() {
        this.initializeEventListeners();
        this.interviewVerificationAttempts = new Set();

        const scheduleBtn = document.getElementById('scheduleBtn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => {
                const modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
                modal.show();
            });
        }

        const saveScheduleBtn = document.getElementById('saveSchedule');
        if (saveScheduleBtn) {
            saveScheduleBtn.addEventListener('click', () => this.scheduleInterview());
        }
    }

    async setupFirebase() {
        try {
            const response = await fetch('/api/auth/firebase-config');
            const firebaseConfig = await response.json();

            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('Firebase initialized successfully');
            }

            firebase.auth().onAuthStateChanged((user) => {
                const overlay = document.getElementById('n-loadingOverlay');
                if (overlay) {
                    overlay.remove();
                }

                const path = window.location.pathname;
                const isInterviewPage = path.includes('/interview/');
                const isLoginPage = path === '/login.html';

                if (user) {
                    document.body.classList.add('logged-in');
                    if (isLoginPage) {
                        window.location.href = '/index.html';
                    }
                } else {
                    document.body.classList.remove('logged-in');

                    if (!isInterviewPage && !isLoginPage) {
                        window.location.href = '/login.html';
                    } else if (isInterviewPage) {
                        const interviewId = path.split('/').pop();
                        this.verifyInterviewAccess(interviewId);
                    }
                }
            });

            return firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
        } catch (error) {
            console.error('Firebase setup error:', error);
            this.showError('Failed to initialize application');
        }
    }

    async verifyInterviewAccess(interviewId) {
        if (this.interviewVerificationAttempts.has(interviewId)) {
            return;
        }
        this.interviewVerificationAttempts.add(interviewId);

        try {
            console.log('Verifying interview access:', interviewId);
            const response = await fetch(`/api/interviews/${interviewId}/verify-access`);

            if (!response.ok) {
                throw new Error('Invalid interview access');
            }

            const data = await response.json();
            console.log('Interview access verified:', data);

            if (window.InterviewRoom) {
                new window.InterviewRoom(data);
            }
        } catch (error) {
            console.error('Interview access error:', error);
            this.showError('Invalid or expired interview link');

            setTimeout(() => {
                window.location.href = '/';
            }, 3000);
        }
    }

    initializeEventListeners() {
        document.addEventListener('DOMContentLoaded', async () => {
            await this.setupFirebase();

            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', this.logout.bind(this));
            }

            this.initializePageSpecificFunctionality();
        });
    }

    initializePageSpecificFunctionality() {
        const path = window.location.pathname;

        if (path.includes('/index.html') || path === '/') {
            this.initializeDashboard();
        }
    }

    async initializeDashboard() {
        try {
            const interviews = await this.apiRequest('/api/interviews');
            this.renderInterviews(interviews);
        } catch (error) {
            this.showError('Failed to load interviews');
        }
    }

   // Update schedule method in app.js

   async scheduleInterview() {
    const name = document.getElementById('candidateName').value.trim();
    const email = document.getElementById('candidateEmail').value.trim();
    const date = document.getElementById('interviewDate').value;
    const time = document.getElementById('interviewTime').value;

    if (!name || !email || !date || !time) {
        this.showError('All fields are required');
        return;
    }

    try {
        const response = await this.apiRequest('/api/interviews/schedule', 'POST', {
            candidateName: name,
            candidateEmail: email,
            date: `${date}T${time}`,
            type: 'technical',
            level: 'mid'
        });

        if (response.id) {
            // Programmatically close the modal
            const scheduleModal = document.getElementById('scheduleModal');
            const modalInstance = bootstrap.Modal.getInstance(scheduleModal);
            
            if (modalInstance) {
                modalInstance.hide();
            } else {
                // Fallback method
                $(scheduleModal).modal('hide');
            }

            // Reset form
            document.getElementById('scheduleForm').reset();
            
            // Show success notification
            this.showNotification('Interview scheduled successfully', 'success');
            
            // Refresh dashboard
            await this.initializeDashboard();
        }
    } catch (error) {
        console.error('Schedule error:', error);
        this.showError(error.message || 'Failed to schedule interview');
    }
}

    async apiRequest(url, method = 'GET', data = null, skipAuth = false) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (!skipAuth) {
                const token = await this.getAuthToken();
                if (token) {
                    options.headers['Authorization'] = `Bearer ${token}`;
                }
            }

            if (data) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(url, options);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'API request failed');
            }

            return await response.json();
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    async getAuthToken() {
        try {
            const user = firebase.auth().currentUser;
            if (user) {
                return await user.getIdToken();
            }
            return null;
        } catch (error) {
            console.error('Token retrieval error:', error);
            throw error;
        }
    }

    renderInterviews(interviews) {
        const interviewsList = document.getElementById('interviewsList');
        if (!interviewsList) return;

        interviewsList.innerHTML = interviews.length ?
            interviews.map(this.createInterviewRow).join('') :
            '<tr><td colspan="4" class="text-center">No interviews scheduled</td></tr>';
    }

    createInterviewRow(interview) {
        const date = new Date(interview.date);
        const isPast = date < new Date();

        return `
            <tr${isPast ? ' class="table-secondary"' : ''}>
                <td>${interview.candidateName}</td>
                <td>${date.toLocaleString()}</td>
                <td>
                    <span class="badge bg-${interview.status === 'cancelled' ? 'danger' : 'primary'}">
                        ${interview.status}
                    </span>
                </td>
                <td>
                    ${!isPast && interview.status !== 'cancelled' ? `
                        <button onclick="appManager.sendInterviewInvite('${interview.id}')" 
                                class="btn btn-sm btn-primary">
                                <i class="bi bi-envelope"></i> Send Invite
                        </button>
                        <button onclick="appManager.cancelInterview('${interview.id}')" 
                                class="btn btn-sm btn-danger">Cancel</button>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    async sendInterviewInvite(interviewId) {
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`/api/interviews/${interviewId}/send-invite`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send invitation');
            }

            this.showNotification('Interview invitation sent successfully', 'success');
        } catch (error) {
            console.error('Send invite error:', error);
            this.showError(error.message || 'Failed to send interview invitation');
        }
    }

    async cancelInterview(interviewId) {
        if (!confirm('Are you sure you want to cancel this interview?')) return;

        try {
            await this.apiRequest(`/api/interviews/${interviewId}/cancel`, 'PATCH');
            this.showNotification('Interview cancelled successfully', 'success');
            this.initializeDashboard();
        } catch (error) {
            console.error('Cancel interview error:', error);
            this.showError('Failed to cancel interview');
        }
    }

    async logout() {
        try {
            await firebase.auth().signOut();
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Failed to log out');
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 end-0 m-3';
        errorDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    showNotification(message, type = 'info') {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
        notificationDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(notificationDiv);
        setTimeout(() => notificationDiv.remove(), 5000);
    }
}

const appManager = new AppManager();
window.appManager = appManager;