class InterviewRoom {
    constructor() {
        // DOM Elements
        this.userVideo = document.getElementById('userVideo');
        this.toggleVideoBtn = document.getElementById('toggleVideo');
        this.toggleAudioBtn = document.getElementById('toggleAudio');
        this.startButton = document.getElementById('startButton');
        this.endButton = document.getElementById('endInterview');
        this.nextButton = document.getElementById('nextQuestion');
        this.chatArea = document.getElementById('chatArea');
        this.transcriptArea = document.getElementById('transcriptArea');
        this.recordingStatus = document.getElementById('recordingStatus');
        this.completionModal = document.getElementById('completionModal');
        this.timer = document.getElementById('timer');

        // State Management
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentTranscript = '';
        this.questions = [];
        this.currentQuestionIndex = -1;
        this.interviewStarted = false;
        this.isRecording = false;
        this.recognition = null;
        this.fraudDetectionInterval = null;

        // Interview Configuration (can be set from backend)
        this.interviewConfig = {
            type: 'technical', // or 'behavioral'
            level: 'senior',   // jr, mid, senior, expert
            duration: 45,      // minutes
            questionCount: 5
        };

        // Bind methods
        this.initializeMedia = this.initializeMedia.bind(this);
        this.toggleVideo = this.toggleVideo.bind(this);
        this.toggleAudio = this.toggleAudio.bind(this);
        this.startInterview = this.startInterview.bind(this);
        this.endInterview = this.endInterview.bind(this);
        this.nextQuestion = this.nextQuestion.bind(this);
        this.handleTranscript = this.handleTranscript.bind(this);

        // Initialize
        this.initialize();
    }

    async initialize() {
        try {
            // Set up event listeners
            this.toggleVideoBtn.addEventListener('click', this.toggleVideo);
            this.toggleAudioBtn.addEventListener('click', this.toggleAudio);
            this.startButton.addEventListener('click', this.startInterview);
            this.endButton.addEventListener('click', this.endInterview);
            this.nextButton.addEventListener('click', this.nextQuestion);

            // Initialize media devices
            await this.initializeMedia();

            // Initialize speech recognition
            if ('webkitSpeechRecognition' in window) {
                this.recognition = new webkitSpeechRecognition();
                this.setupSpeechRecognition();
            }

            // Fetch interview configuration if available in URL
            const urlParams = new URLSearchParams(window.location.search);
            const interviewId = urlParams.get('id');
            if (interviewId) {
                await this.fetchInterviewConfig(interviewId);
            }

            // Generate initial questions
            await this.generateQuestions();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Failed to initialize interview room. Please refresh the page.');
        }
    }

    async initializeMedia() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            this.userVideo.srcObject = this.mediaStream;
        } catch (error) {
            console.error('Media access error:', error);
            this.showError('Unable to access camera or microphone. Please check permissions.');
        }
    }

    setupSpeechRecognition() {
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            const current = event.resultIndex;
            const transcript = event.results[current][0].transcript;
            
            if (event.results[current].isFinal) {
                this.handleTranscript(transcript, true);
            } else {
                this.handleTranscript(transcript, false);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.restartSpeechRecognition();
        };
    }

    restartSpeechRecognition() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            setTimeout(() => {
                this.recognition.start();
            }, 1000);
        }
    }

    async fetchInterviewConfig(interviewId) {
        try {
            const response = await fetch(`/api/interviews/${interviewId}/config`);
            if (!response.ok) throw new Error('Failed to fetch interview configuration');
            const config = await response.json();
            this.interviewConfig = { ...this.interviewConfig, ...config };
        } catch (error) {
            console.error('Config fetch error:', error);
        }
    }

    async generateQuestions() {
        try {
            const response = await fetch('/api/questions/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.interviewConfig)
            });

            if (!response.ok) throw new Error('Failed to generate questions');
            this.questions = await response.json();
        } catch (error) {
            console.error('Question generation error:', error);
            this.showError('Failed to generate interview questions.');
        }
    }

    toggleVideo() {
        if (this.mediaStream) {
            const videoTrack = this.mediaStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            this.toggleVideoBtn.innerHTML = `<i class="fas fa-video${videoTrack.enabled ? '' : '-slash'}"></i>`;
        }
    }

    toggleAudio() {
        if (this.mediaStream) {
            const audioTrack = this.mediaStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            this.toggleAudioBtn.innerHTML = `<i class="fas fa-microphone${audioTrack.enabled ? '' : '-slash'}"></i>`;
        }
    }

    async startInterview() {
        try {
            this.interviewStarted = true;
            this.startButton.classList.add('hidden');
            this.endButton.classList.remove('hidden');
            
            // Start recording and speech recognition
            this.startRecording();
            this.recognition?.start();
            
            // Show first question
            await this.nextQuestion();
            
            // Start fraud detection
            this.startFraudDetection();
            
            // Start timer if configured
            if (this.interviewConfig.duration) {
                this.startTimer(this.interviewConfig.duration * 60);
            }
        } catch (error) {
            console.error('Start interview error:', error);
            this.showError('Failed to start interview. Please try again.');
        }
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

            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateRecordingStatus(true);
        }
    }

    async nextQuestion() {
        if (this.currentQuestionIndex + 1 >= this.questions.length) {
            await this.endInterview();
            return;
        }

        this.currentQuestionIndex++;
        const question = this.questions[this.currentQuestionIndex];

        // Add question to chat
        const questionElement = document.createElement('div');
        questionElement.className = 'chat-message bg-blue-50 p-3 rounded-lg max-w-[80%]';
        questionElement.innerHTML = `
            <p class="text-sm text-gray-500 mb-1">AI Interviewer</p>
            <p class="text-gray-800">${question.text}</p>
        `;
        this.chatArea.appendChild(questionElement);
        this.chatArea.scrollTop = this.chatArea.scrollHeight;

        // Clear current transcript for new question
        this.currentTranscript = '';
    }

    handleTranscript(transcript, isFinal) {
        if (!this.interviewStarted) return;

        if (isFinal) {
            // Add candidate's response to chat
            const responseElement = document.createElement('div');
            responseElement.className = 'chat-message transcript-text bg-gray-50 p-3 rounded-lg max-w-[80%] ml-auto';
            responseElement.innerHTML = `
                <p class="text-sm text-gray-500 mb-1">You</p>
                <p class="text-gray-800">${transcript}</p>
            `;
            this.transcriptArea.appendChild(responseElement);
            this.chatArea.scrollTop = this.chatArea.scrollHeight;

            // Send for analysis
            this.analyzeResponse(transcript);
        }
    }

    async analyzeResponse(transcript) {
        try {
            const response = await fetch('/api/analysis/response', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    transcript,
                    questionId: this.questions[this.currentQuestionIndex].id,
                    interviewType: this.interviewConfig.type,
                    level: this.interviewConfig.level
                })
            });

            if (!response.ok) throw new Error('Failed to analyze response');
            const analysis = await response.json();
            
            // Store analysis for final report
            this.questions[this.currentQuestionIndex].analysis = analysis;
        } catch (error) {
            console.error('Response analysis error:', error);
        }
    }

    startFraudDetection() {
        // Perform fraud detection every 5 seconds
        this.fraudDetectionInterval = setInterval(async () => {
            try {
                // Capture current frame
                const canvas = document.createElement('canvas');
                canvas.width = this.userVideo.videoWidth;
                canvas.height = this.userVideo.videoHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this.userVideo, 0, 0);
                const frameData = canvas.toDataURL('image/jpeg', 0.8);

                // Send for analysis
                const response = await fetch('/api/analysis/fraud-detection', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ frame: frameData })
                });

                if (!response.ok) throw new Error('Fraud detection failed');
                const result = await response.json();

                if (result.fraudDetected) {
                    this.handleFraudDetection(result);
                }
            } catch (error) {
                console.error('Fraud detection error:', error);
            }
        }, 5000);
    }

    handleFraudDetection(result) {
        // Log the fraud detection event
        console.warn('Fraud detection alert:', result);
        
        // Store with interview data
        this.fraudDetectionEvents = this.fraudDetectionEvents || [];
        this.fraudDetectionEvents.push({
            timestamp: new Date(),
            type: result.type,
            confidence: result.confidence
        });
    }

    startTimer(duration) {
        let timeLeft = duration;
        const timerInterval = setInterval(() => {
            if (!this.interviewStarted) {
                clearInterval(timerInterval);
                return;
            }

            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            this.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (--timeLeft < 0) {
                clearInterval(timerInterval);
                this.endInterview();
            }
        }, 1000);
    }

    async endInterview() {
        try {
            // Stop recording and recognition
            if (this.mediaRecorder && this.isRecording) {
                this.mediaRecorder.stop();
                this.isRecording = false;
                this.recognition?.stop();
            }

            // Stop fraud detection
            if (this.fraudDetectionInterval) {
                clearInterval(this.fraudDetectionInterval);
            }

            // Prepare final data
            const interviewData = {
                questions: this.questions,
                fraudDetectionEvents: this.fraudDetectionEvents || [],
                duration: this.interviewConfig.duration,
                completedAt: new Date().toISOString()
            };

            // Send final data
            const response = await fetch('/api/interviews/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(interviewData)
            });

            if (!response.ok) throw new Error('Failed to complete interview');

            // Show completion modal
            this.completionModal.classList.remove('hidden');
        } catch (error) {
            console.error('End interview error:', error);
            this.showError('Failed to complete interview. Please contact support.');
        }
    }

    updateRecordingStatus(isRecording) {
        this.recordingStatus.innerHTML = isRecording ? `
            <span class="text-gray-600">
                <i class="fas fa-circle text-red-500 animate-pulse"></i>
                Recording in progress...
            </span>
        ` : '';
    }

    showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg';
        errorElement.textContent = message;
        document.body.appendChild(errorElement);
        setTimeout(() => errorElement.remove(), 5000);
    }

    cleanup() {
        // Stop all media tracks
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        // Stop recording if active
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }

        // Stop speech recognition
        if (this.recognition) {
            this.recognition.stop();
        }

        // Clear intervals
        if (this.fraudDetectionInterval) {
            clearInterval(this.fraudDetectionInterval);
        }
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.interviewRoom = new InterviewRoom();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.interviewRoom) {
        window.interviewRoom.cleanup();
    }
});
