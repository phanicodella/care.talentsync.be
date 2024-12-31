// backend/services/websocketService.js

const WebSocket = require('ws');

class WebSocketService {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('New WebSocket connection established');

            // Send initial connection confirmation
            ws.send(JSON.stringify({
                type: 'connection',
                status: 'connected'
            }));

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    
                    switch (data.type) {
                        case 'startInterview':
                            this.handleStartInterview(ws, data);
                            break;
                        case 'transcript':
                            this.handleTranscript(ws, data);
                            break;
                        case 'fraudDetection':
                            this.handleFraudDetection(ws, data);
                            break;
                        default:
                            console.warn('Unknown message type:', data.type);
                    }
                } catch (error) {
                    console.error('WebSocket message handling error:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Failed to process message'
                    }));
                }
            });

            ws.on('close', () => {
                console.log('Client disconnected');
            });
        });
    }

    handleStartInterview(ws, data) {
        ws.send(JSON.stringify({
            type: 'interviewStarted',
            timestamp: new Date().toISOString()
        }));
    }

    handleTranscript(ws, data) {
        // Echo back the transcript for now
        ws.send(JSON.stringify({
            type: 'transcriptProcessed',
            transcript: data.transcript,
            timestamp: new Date().toISOString()
        }));
    }

    handleFraudDetection(ws, data) {
        // Echo back the fraud detection result
        ws.send(JSON.stringify({
            type: 'fraudDetectionResult',
            detected: false,
            confidence: 0,
            timestamp: new Date().toISOString()
        }));
    }

    broadcast(message) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

module.exports = WebSocketService;