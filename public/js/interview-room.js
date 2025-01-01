class InterviewRoom {
    constructor() {
        this.setupState();
        this.initializeElements();
        this.initialize();
    }

    setupState() {
        this.questions = [];
        this.currentQuestionIndex = -1;
        this.responses = [];
        this.interviewConfig = {
            type: 'technical',
            level: 'mid',
            duration: 45
        };
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
    }

    initializeElements() {
        this.elements = {
            welcomeModal: document.getElementById('welcomeModal'),
            startButton: document.getElementById('startInterview'),
            userVideo: document.getElementById('userVideo'),
            nextButton: document.getElementById('nextQuestion'),
            chatArea: document.getElementById('chatArea'),
            timer: document.getElementById('timer'),
            completionModal: document.getElementById('completionModal')
        };

        // Bind event listeners
        if (this.elements.startButton) {
            this.elements.startButton.addEventListener('click', () => this.startInterview());
        }
        if (this.elements.nextButton) {
            this.elements.nextButton.addEventListener('click', () => this.nextQuestion());
        }
    }

    async initialize() {
        try {
            await this.initializeMedia();
            await this.generateQuestions();
            this.setupEventListeners();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize interview');
        }
    }

    async initializeMedia() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            if (this.elements.userVideo) {
                this.elements.userVideo.srcObject = this.mediaStream;
                await this.elements.userVideo.play();
            }
        } catch (error) {
            console.error('Media initialization error:', error);
            this.showError('Unable to access camera or microphone');
        }
    }

    setupEventListeners() {
        // Add any additional event listeners
        document.addEventListener('voiceTranscriptionComplete', this.handleVoiceResponse.bind(this));
    }

    async generateQuestions() {
        try {
            const response = await fetch('/api/questions/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: this.interviewConfig.type,
                    level: this.interviewConfig.level,
                    count: 5
                })
            });

            if (!response.ok) throw new Error('Failed to generate questions');
            
            this.questions = await response.json();
            this.prepareWelcomeScreen();
        } catch (error) {
            console.error('Question generation error:', error);
            this.showError('Failed to generate interview questions');
        }
    }

    prepareWelcomeScreen() {
        if (this.elements.welcomeModal) {
            // Ensure start button is enabled
            if (this.elements.startButton) {
                this.elements.startButton.disabled = false;
            }
        }
    }

    startInterview() {
        // Hide welcome modal
        if (this.elements.welcomeModal) {
            this.elements.welcomeModal.style.display = 'none';
        }

        // Start timer
        this.startTimer();

        // Display first question
        this.nextQuestion();
    }

    nextQuestion() {
        this.currentQuestionIndex++;

        if (this.currentQuestionIndex >= this.questions.length) {
            this.completeInterview();
            return;
        }

        const currentQuestion = this.questions[this.currentQuestionIndex];
        
        // Display question in chat area
        const questionElement = document.createElement('div');
        questionElement.className = 'chat-message bg-blue-50 p-3 rounded-lg max-w-[80%]';
        questionElement.innerHTML = `
            <p class="text-sm text-gray-500 mb-1">AI Interviewer</p>
            <p class="text-gray-800">${currentQuestion.text}</p>
        `;
        
        if (this.elements.chatArea) {
            this.elements.chatArea.appendChild(questionElement);
            this.elements.chatArea.scrollTop = this.elements.chatArea.scrollHeight;
        }

        // Start recording for response
        this.startRecording();
    }

    startRecording() {
        if (this.mediaStream) {
            this.mediaRecorder = new MediaRecorder(this.mediaStream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                // Process recorded audio
                this.processAudioResponse();
            };

            this.mediaRecorder.start();
        }
    }

    processAudioResponse() {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        // Here you would typically send to transcription service
        console.log('Audio recorded', audioBlob);
    }

    startTimer() {
        let timeRemaining = this.interviewConfig.duration * 60;
        
        const timerInterval = setInterval(() => {
            timeRemaining--;
            
            if (this.elements.timer) {
                this.elements.timer.textContent = 
                    `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`;
            }

            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                this.completeInterview();
            }
        }, 1000);
    }

    completeInterview() {
        // Submit interview results
        this.submitInterviewResults();

        // Show completion modal
        if (this.elements.completionModal) {
            this.elements.completionModal.style.display = 'flex';
        }
    }

    async submitInterviewResults() {
        try {
            const response = await fetch('/api/interviews/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questions: this.questions,
                    responses: this.responses,
                    type: this.interviewConfig.type,
                    level: this.interviewConfig.level
                })
            });

            if (!response.ok) throw new Error('Failed to submit interview results');
        } catch (error) {
            console.error('Interview submission error:', error);
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.interviewRoom = new InterviewRoom();
});