// /frontend/js/feedback.js
class FeedbackService {
    static #API_URL = '/api/feedback';

    static async generateFeedbackSummary(feedbackData) {
        try {
            const response = await fetch(`${this.#API_URL}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                },
                body: JSON.stringify({
                    interviewId: feedbackData.interviewId,
                    technicalSkills: feedbackData.technicalSkills,
                    communicationSkills: feedbackData.communicationSkills,
                    notes: feedbackData.notes
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate feedback summary');
            }

            const data = await response.json();
            return data.feedback;
        } catch (error) {
            console.error('Error generating feedback:', error);
            throw error;
        }
    }

    static async getAuthToken() {
        try {
            const user = firebase.auth().currentUser;
            if (!user) {
                throw new Error('No authenticated user');
            }
            return await user.getIdToken();
        } catch (error) {
            console.error('Error getting auth token:', error);
            throw error;
        }
    }

    static async saveFeedback(interviewId, feedbackData) {
        try {
            const db = firebase.firestore();
            await db.collection('interviews').doc(interviewId).update({
                feedback: {
                    ...feedbackData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: firebase.auth().currentUser.uid
                }
            });
        } catch (error) {
            console.error('Error saving feedback:', error);
            throw error;
        }
    }

    static async loadFeedback(interviewId) {
        try {
            const db = firebase.firestore();
            const doc = await db.collection('interviews').doc(interviewId).get();
            
            if (!doc.exists) {
                throw new Error('Interview not found');
            }

            return doc.data().feedback || null;
        } catch (error) {
            console.error('Error loading feedback:', error);
            throw error;
        }
    }

    static initializeFeedbackForm(interviewId) {
        const form = document.getElementById('feedbackForm');
        const aiSummary = document.getElementById('aiSummary');
        const spinner = aiSummary.querySelector('.spinner-border');
        let debounceTimer;

        // Update rating display
        ['technical', 'communication'].forEach(type => {
            const input = document.getElementById(`${type}Skills`);
            const value = document.getElementById(`${type}Value`);
            
            input.addEventListener('input', () => {
                value.textContent = `${input.value}/5`;
            });
        });

        // Handle notes input with debounce
        const notesInput = document.getElementById('interviewNotes');
        notesInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            
            if (notesInput.value.length >= 50) {
                debounceTimer = setTimeout(async () => {
                    try {
                        spinner.classList.remove('d-none');
                        aiSummary.textContent = 'Generating summary...';

                        const feedbackData = {
                            interviewId,
                            technicalSkills: document.getElementById('technicalSkills').value,
                            communicationSkills: document.getElementById('communicationSkills').value,
                            notes: notesInput.value
                        };

                        const summary = await this.generateFeedbackSummary(feedbackData);
                        
                        // Display comprehensive AI feedback
                        aiSummary.innerHTML = `
                            <h6>Overall Assessment</h6>
                            <p>${summary.overallAssessment}</p>
                            
                            <h6>Technical Strengths</h6>
                            <p>${summary.technicalStrengths}</p>
                            
                            <h6>Areas for Improvement</h6>
                            <p>${summary.areasForImprovement}</p>
                            
                            <h6>Final Recommendation</h6>
                            <p>${summary.finalRecommendation}</p>
                            
                            <h6>Fraud Risk Assessment</h6>
                            <p>Risk Score: ${summary.fraudRiskAssessment.score.toFixed(2)}/10</p>
                            <p>Risk Category: ${summary.fraudRiskAssessment.category}</p>
                        `;
                    } catch (error) {
                        aiSummary.textContent = 'Error generating summary. Please try again.';
                        console.error('Error:', error);
                    } finally {
                        spinner.classList.add('d-none');
                    }
                }, 1000);
            } else {
                aiSummary.textContent = 'Enter at least 50 characters to generate AI summary...';
            }
        });

        // Save feedback
        document.getElementById('saveFeedback').addEventListener('click', async () => {
            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                return;
            }

            try {
                const feedbackData = {
                    technicalSkills: parseInt(document.getElementById('technicalSkills').value),
                    communicationSkills: parseInt(document.getElementById('communicationSkills').value),
                    notes: notesInput.value,
                    aiSummary: aiSummary.textContent
                };

                await this.saveFeedback(interviewId, feedbackData);
                
                const modal = bootstrap.Modal.getInstance(document.getElementById('feedbackModal'));
                modal.hide();
                
                // Show success notification
                window.showNotification('Feedback saved successfully', 'success');
            } catch (error) {
                window.showNotification('Error saving feedback', 'error');
                console.error('Error:', error);
            }
        });

        // Load existing feedback if any
        this.loadFeedback(interviewId).then(feedback => {
            if (feedback) {
                document.getElementById('technicalSkills').value = feedback.technicalSkills;
                document.getElementById('communicationSkills').value = feedback.communicationSkills;
                document.getElementById('interviewNotes').value = feedback.notes;
                
                // Restore AI summary with detailed formatting
                aiSummary.innerHTML = `
                    <h6>Overall Assessment</h6>
                    <p>${feedback.overallAssessment}</p>
                    
                    <h6>Technical Strengths</h6>
                    <p>${feedback.technicalStrengths}</p>
                    
                    <h6>Areas for Improvement</h6>
                    <p>${feedback.areasForImprovement}</p>
                    
                    <h6>Final Recommendation</h6>
                    <p>${feedback.finalRecommendation}</p>
                    
                    <h6>Fraud Risk Assessment</h6>
                    <p>Risk Score: ${feedback.fraudRiskAssessment.score.toFixed(2)}/10</p>
                    <p>Risk Category: ${feedback.fraudRiskAssessment.category}</p>
                `;
                
                // Update displays
                document.getElementById('technicalValue').textContent = `${feedback.technicalSkills}/5`;
                document.getElementById('communicationValue').textContent = `${feedback.communicationSkills}/5`;
            }
        });
    }

    // Additional utility methods
    static async retrieveFeedback(interviewId) {
        try {
            const response = await fetch(`${this.#API_URL}/${interviewId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to retrieve feedback');
            }

            return await response.json();
        } catch (error) {
            console.error('Error retrieving feedback:', error);
            throw error;
        }
    }

    // Export method for external use
    static export(feedbackData) {
        const exportWindow = window.open('', '_blank');
        exportWindow.document.write(`
            <html>
                <head>
                    <title>Interview Feedback Report</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
                        h1 { color: #333; }
                        h2 { color: #666; }
                        p { margin-bottom: 15px; }
                    </style>
                </head>
                <body>
                    <h1>TalentSync Interview Feedback</h1>
                    <h2>Candidate Assessment</h2>
                    <p><strong>Technical Skills:</strong> ${feedbackData.technicalSkills}/5</p>
                    <p><strong>Communication Skills:</strong> ${feedbackData.communicationSkills}/5</p>
                    <h2>Detailed Feedback</h2>
                    <p>${feedbackData.aiSummary}</p>
                </body>
            </html>
        `);
        exportWindow.document.close();
    }
}

// Export for use in other files
window.FeedbackService = FeedbackService;