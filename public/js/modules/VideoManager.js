// /frontend/js/modules/VideoManager.js
export class VideoManager {
    constructor(containerElement) {
        this.containerElement = containerElement;
        this.localStream = null;
        this.videoElement = null;
    }

    async initializeVideoStream(constraints = {
        video: { 
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            aspectRatio: 1.333 
        },
        audio: true
    }) {
        try {
            // Request user media with provided or default constraints
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Create video element
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = this.localStream;
            this.videoElement.autoplay = true;
            this.videoElement.playsInline = true;
            
            // Add classes for styling
            this.videoElement.classList.add('talentsync-video-stream');

            // Append to container
            this.containerElement.appendChild(this.videoElement);

            return this.localStream;
        } catch (error) {
            this.handleVideoError(error);
            throw error;
        }
    }

    handleVideoError(error) {
        console.error('Video initialization error:', error);
        
        // Provide user-friendly error messages
        let userMessage = 'Unable to access camera or microphone.';
        
        switch(error.name) {
            case 'NotAllowedError':
                userMessage = 'Camera/Microphone access was denied. Please check your browser settings.';
                break;
            case 'NotFoundError':
                userMessage = 'No camera or microphone found. Please connect a device.';
                break;
            case 'OverconstrainedError':
                userMessage = 'Your device does not meet the video requirements.';
                break;
        }

        // Display error to user (you might want to create a method to show modal/toast)
        this.displayErrorMessage(userMessage);
    }

    displayErrorMessage(message) {
        // Placeholder for error display logic
        // In a real implementation, this would show a modal or toast notification
        console.warn('Video Error:', message);
        alert(message);
    }

    switchCamera() {
        // Method to switch between front and back cameras on mobile devices
        const videoTrack = this.localStream.getVideoTracks()[0];
        const constraints = videoTrack.getConstraints();
        
        // Toggle between front and back cameras
        constraints.facingMode = constraints.facingMode === 'user' ? 'environment' : 'user';
        
        navigator.mediaDevices.getUserMedia({
            video: constraints,
            audio: false
        }).then(stream => {
            const newVideoTrack = stream.getVideoTracks()[0];
            this.localStream.removeTrack(videoTrack);
            this.localStream.addTrack(newVideoTrack);
            this.videoElement.srcObject = this.localStream;
        }).catch(this.handleVideoError);
    }

    adjustVideoQuality(quality = 'medium') {
        // Dynamically adjust video quality based on network conditions
        const qualityConstraints = {
            low: { width: 320, height: 240 },
            medium: { width: 640, height: 480 },
            high: { width: 1280, height: 720 }
        };

        const constraints = {
            video: qualityConstraints[quality],
            audio: true
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                // Replace existing tracks
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = stream;
                this.videoElement.srcObject = this.localStream;
            })
            .catch(this.handleVideoError);
    }

    stopStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
    }

    // Cleanup method
    destroy() {
        this.stopStream();
        if (this.videoElement) {
            this.containerElement.removeChild(this.videoElement);
        }
    }
}

// Usage example
document.addEventListener('DOMContentLoaded', () => {
    const videoContainer = document.getElementById('videoContainer');
    const videoManager = new VideoManager(videoContainer);

    videoManager.initializeVideoStream()
        .then(stream => {
            console.log('Video stream initialized successfully');
        })
        .catch(error => {
            console.error('Failed to initialize video stream', error);
        });
});