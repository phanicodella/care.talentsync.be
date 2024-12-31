// /frontend/js/websocket-client.js

class WebSocketClient {
    constructor(interviewId, role) {
        this.interviewId = interviewId;
        this.role = role;
        this.callbacks = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.connect();
    }

    connect() {
        // Use secure WebSocket if on HTTPS
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        const port = window.location.port;
        this.ws = new WebSocket(`${protocol}//${host}:${port}`);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            
            // Join interview room
            this.send({
                type: 'join',
                interviewId: this.interviewId,
                role: this.role
            });

            this.triggerCallback('connect');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.triggerCallback('disconnect');
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.triggerCallback('error', error);
        };
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, 2000 * Math.pow(2, this.reconnectAttempts - 1)); // Exponential backoff
        } else {
            console.error('Max reconnection attempts reached');
            this.triggerCallback('maxReconnectAttempts');
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'connection':
                this.triggerCallback('connect', data);
                break;
            
            case 'transcription':
                this.triggerCallback('transcription', data.text);
                break;
            
            case 'analysis':
                this.triggerCallback('analysis', data.analysis);
                break;
            
            case 'participant_joined':
                this.triggerCallback('participantJoined', data);
                break;
            
            case 'question':
                this.triggerCallback('question', data.question);
                break;
            
            case 'error':
                this.triggerCallback('error', data.message);
                break;
            
            default:
                console.warn('Unknown message type:', data.type);
        }
    }

    send(data) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket is not connected');
            this.triggerCallback('error', 'WebSocket is not connected');
        }
    }

    sendTranscription(text) {
        this.send({
            type: 'transcription',
            interviewId: this.interviewId,
            text: text
        });
    }

    sendAnalysis(analysis) {
        this.send({
            type: 'analysis',
            interviewId: this.interviewId,
            analysis: analysis
        });
    }

    sendQuestion(question) {
        this.send({
            type: 'question',
            interviewId: this.interviewId,
            question: question
        });
    }

    on(event, callback) {
        this.callbacks.set(event, callback);
    }

    off(event) {
        this.callbacks.delete(event);
    }

    triggerCallback(event, data) {
        const callback = this.callbacks.get(event);
        if (callback) {
            callback(data);
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Initialize WebSocket in interview analysis page
document.addEventListener('DOMContentLoaded', () => {
    // Get interview ID and role from page
    const interviewId = new URLSearchParams(window.location.search).get('id');
    const role = localStorage.getItem('userRole') || 'interviewer';

    if (interviewId) {
        const wsClient = new WebSocketClient(interviewId, role);

        // Handle WebSocket events
        wsClient.on('connect', () => {
            console.log('Connected to interview session');
            document.getElementById('connectionStatus')?.classList.remove('text-danger');
            document.getElementById('connectionStatus')?.classList.add('text-success');
        });

        wsClient.on('disconnect', () => {
            console.log('Disconnected from interview session');
            document.getElementById('connectionStatus')?.classList.remove('text-success');
            document.getElementById('connectionStatus')?.classList.add('text-danger');
        });

        wsClient.on('transcription', (text) => {
            document.getElementById('transcriptionBox').textContent = text;
        });

        wsClient.on('analysis', (analysis) => {
            // Update analysis UI
            const analysisInstance = window.InterviewAnalysis;
            if (analysisInstance) {
                analysisInstance.updateAnalysis(analysis);
            }
        });

        wsClient.on('error', (error) => {
            console.error('WebSocket error:', error);
            showError(error);
        });

        // Store WebSocket client instance globally for access from other scripts
        window.wsClient = wsClient;
    }
});

// Make WebSocketClient available globally
window.WebSocketClient = WebSocketClient;