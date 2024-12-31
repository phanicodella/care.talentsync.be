// /frontend/js/interview-analysis.js

class InterviewAnalysis {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.segmentCount = 0;
        this.init();
    }

    init() {
        this.render();
        this.attachEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="card shadow-sm">
                <div class="card-header bg-white">
                    <div class="d-flex justify-content-between align-items-center">
                        <h3 class="mb-0">Interview Analysis</h3>
                        <button id="recordButton" class="btn btn-primary">
                            <i class="bi bi-mic"></i> Start Recording
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="mb-4">
                        <h4>Transcription</h4>
                        <div id="transcriptionBox" class="border rounded p-3 bg-light min-vh-25">
                            No transcription yet. Start recording to begin.
                        </div>
                        <div id="processingIndicator" class="text-primary mt-2 d-none">
                            <div class="spinner-border spinner-border-sm" role="status">
                                <span class="visually-hidden">Processing...</span>
                            </div>
                            Processing...
                        </div>
                    </div>
                    
                    <div id="analysisSection" class="d-none">
                        <h4>Analysis</h4>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body">
                                        <h5 class="card-title">Technical Skills</h5>
                                        <div id="technicalScore" class="display-4 text-primary">-</div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body">
                                        <h5 class="card-title">Communication</h5>
                                        <div id="communicationScore" class="display-4 text-success">-</div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body">
                                        <h5 class="card-title">Engagement</h5>
                                        <div id="engagementScore" class="display-4 text-info">-</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mt-4">
                            <canvas id="analysisChart"></canvas>
                        </div>
                        
                        <div class="mt-4">
                            <h5>Key Insights</h5>
                            <ul id="keyInsights" class="list-group">
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-danger d-none mt-3" id="errorAlert" role="alert">
            </div>
        `;
    }

    attachEventListeners() {
        const recordButton = document.getElementById('recordButton');
        recordButton.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.processAudioSegment(audioBlob);
            };

            this.mediaRecorder.start(1000); // Record in 1-second segments
            this.isRecording = true;
            this.updateRecordButton(true);
            this.hideError();
        } catch (error) {
            console.error('Recording error:', error);
            this.showError('Failed to access microphone. Please check permissions.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordButton(false);
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    async processAudioSegment(audioBlob) {
        try {
            this.showProcessing();
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('segmentNumber', this.segmentCount++);

            const response = await fetch(`/api/analysis/transcribe/${this.interviewId}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Failed to process audio');

            const data = await response.json();
            this.updateTranscription(data.transcription.text);
            
            if (data.transcription.text.length > 50) {
                await this.analyzeContent();
            }
        } catch (error) {
            console.error('Processing error:', error);
            this.showError('Failed to process audio segment');
        } finally {
            this.hideProcessing();
        }
    }

    async analyzeContent() {
        try {
            const response = await fetch(`/api/analysis/analyze/${this.interviewId}`, {
                method: 'POST'
            });

            if (!response.ok) throw new Error('Failed to analyze content');

            const analysisData = await response.json();
            this.updateAnalysis(analysisData);
        } catch (error) {
            console.error('Analysis error:', error);
        }
    }

    updateRecordButton(isRecording) {
        const button = document.getElementById('recordButton');
        button.innerHTML = isRecording ? 
            '<i class="bi bi-stop-circle"></i> Stop Recording' :
            '<i class="bi bi-mic"></i> Start Recording';
        button.classList.toggle('btn-danger', isRecording);
        button.classList.toggle('btn-primary', !isRecording);
    }

    updateTranscription(text) {
        const transcriptionBox = document.getElementById('transcriptionBox');
        transcriptionBox.textContent = text;
    }

    updateAnalysis(data) {
        document.getElementById('analysisSection').classList.remove('d-none');
        
        // Update scores
        document.getElementById('technicalScore').textContent = 
            `${(data.technicalScore * 100).toFixed(0)}%`;
        document.getElementById('communicationScore').textContent = 
            `${(data.communicationScore * 100).toFixed(0)}%`;
        document.getElementById('engagementScore').textContent = 
            `${(data.engagementScore * 100).toFixed(0)}%`;

        // Update insights
        const insightsList = document.getElementById('keyInsights');
        insightsList.innerHTML = data.keyInsights
            .map(insight => `<li class="list-group-item">${insight}</li>`)
            .join('');

        this.updateChart(data);
    }

    updateChart(data) {
        const ctx = document.getElementById('analysisChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.segments.map((_, i) => `Segment ${i + 1}`),
                datasets: [{
                    label: 'Technical Skills',
                    data: data.segments.map(s => s.technicalScore * 100),
                    borderColor: '#0d6efd',
                    tension: 0.1
                }, {
                    label: 'Communication',
                    data: data.segments.map(s => s.communicationScore * 100),
                    borderColor: '#198754',
                    tension: 0.1
                }, {
                    label: 'Engagement',
                    data: data.segments.map(s => s.engagementScore * 100),
                    borderColor: '#0dcaf0',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Score (%)'
                        }
                    }
                }
            }
        });
    }

    showProcessing() {
        document.getElementById('processingIndicator').classList.remove('d-none');
    }

    hideProcessing() {
        document.getElementById('processingIndicator').classList.add('d-none');
    }

    showError(message) {
        const errorAlert = document.getElementById('errorAlert');
        errorAlert.textContent = message;
        errorAlert.classList.remove('d-none');
    }

    hideError() {
        document.getElementById('errorAlert').classList.add('d-none');
    }
}

// Export for use in other files
window.InterviewAnalysis = InterviewAnalysis;