// Main Application Logic
class VirtualTryOnApp {
    constructor() {
        this.faceTracker = null;
        this.glassesRenderer = null;
        this.isInitialized = false;
        this.currentFrame = 'classic';
        this.previousLandmarks = null;
        this.smoothingEnabled = true;
        
        // DOM elements
        this.videoElement = null;
        this.canvasElement = null;
        this.outputCanvas = null;
        this.loadingIndicator = null;
        this.errorMessage = null;
        
        // Control elements
        this.frameButtons = null;
        this.sizeSlider = null;
        this.widthSlider = null;
        this.heightSlider = null;
        this.captureBtn = null;
        this.resetBtn = null;
    }

    async init() {
        try {
            this.setupDOMElements();
            this.setupEventListeners();
            await this.initializeFaceTracking();
            this.initializeGlassesRenderer();
            this.setupResizeHandler();
            
            this.isInitialized = true;
            this.hideLoading();
            
            console.log('Virtual Try-On app initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize the virtual try-on system. Please check your camera permissions and refresh the page.');
        }
    }

    setupDOMElements() {
        this.videoElement = document.getElementById('videoElement');
        this.canvasElement = document.getElementById('canvasElement');
        this.outputCanvas = document.getElementById('outputCanvas');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');
        
        this.frameButtons = document.querySelectorAll('.frame-btn');
        this.sizeSlider = document.getElementById('sizeSlider');
        this.widthSlider = document.getElementById('widthSlider');
        this.heightSlider = document.getElementById('heightSlider');
        this.captureBtn = document.getElementById('captureBtn');
        this.resetBtn = document.getElementById('resetBtn');

        this.resizeCanvases();
    }

    setupEventListeners() {
        // Frame selection buttons
        this.frameButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.changeFrame(e.target.dataset.frame);
            });
        });

        // Control sliders
        this.sizeSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('sizeValue').textContent = value.toFixed(1);
            if (this.glassesRenderer) {
                this.glassesRenderer.updateScale(value);
            }
        });

        this.widthSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('widthValue').textContent = value.toFixed(1);
            if (this.glassesRenderer) {
                this.glassesRenderer.updateWidth(value);
            }
        });

        this.heightSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('heightValue').textContent = value;
            if (this.glassesRenderer) {
                this.glassesRenderer.updateHeightOffset(value);
            }
        });

        // Action buttons
        this.captureBtn.addEventListener('click', () => {
            this.capturePhoto();
        });

        this.resetBtn.addEventListener('click', () => {
            this.resetSettings();
        });

        // Modal controls
        const modal = document.getElementById('captureModal');
        const closeBtn = document.querySelector('.close');
        const downloadBtn = document.getElementById('downloadBtn');
        const shareBtn = document.getElementById('shareBtn');

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        downloadBtn.addEventListener('click', () => {
            this.downloadPhoto();
        });

        shareBtn.addEventListener('click', () => {
            this.sharePhoto();
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    async initializeFaceTracking() {
        try {
            this.faceTracker = new FaceTracker();
            await this.faceTracker.init(
                this.videoElement,
                this.canvasElement,
                (results) => this.onFaceDetected(results)
            );
        } catch (error) {
            console.error('Face tracking initialization failed:', error);
            throw new Error('Could not access camera or initialize face tracking');
        }
    }

    initializeGlassesRenderer() {
        this.glassesRenderer = new GlassesRenderer();
        this.glassesRenderer.init(this.outputCanvas);
    }

    onFaceDetected(results) {
        if (!results || !this.glassesRenderer) return;

        // Apply smoothing to landmarks
        if (this.smoothingEnabled && this.previousLandmarks) {
            results.landmarks = LandmarkUtils.smoothLandmarks(
                results.landmarks,
                this.previousLandmarks,
                0.7
            );
        }

        // THIS IS THE KEY CALL - Update glasses position based on face landmarks
        this.glassesRenderer.updateGlasses(
            results.landmarks,
            this.outputCanvas.width,
            this.outputCanvas.height
        );

        // Store landmarks for smoothing
        this.previousLandmarks = results.landmarks;
    }

    changeFrame(frameType) {
        this.currentFrame = frameType;
        
        // Update button states
        this.frameButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.frame === frameType) {
                btn.classList.add('active');
            }
        });

        // Update glasses model
        if (this.glassesRenderer) {
            this.glassesRenderer.changeFrame(frameType);
        }
    }

    capturePhoto() {
        if (!this.videoElement || !this.outputCanvas) return;

        const captureCanvas = document.createElement('canvas');
        const ctx = captureCanvas.getContext('2d');
        
        captureCanvas.width = this.videoElement.videoWidth || this.outputCanvas.width;
        captureCanvas.height = this.videoElement.videoHeight || this.outputCanvas.height;

        // Draw video frame
        ctx.drawImage(this.videoElement, 0, 0, captureCanvas.width, captureCanvas.height);

        // Draw glasses overlay
        ctx.drawImage(this.outputCanvas, 0, 0, captureCanvas.width, captureCanvas.height);

        // Show in modal
        const capturedCanvas = document.getElementById('capturedCanvas');
        const capturedCtx = capturedCanvas.getContext('2d');
        
        capturedCanvas.width = captureCanvas.width;
        capturedCanvas.height = captureCanvas.height;
        capturedCtx.drawImage(captureCanvas, 0, 0);

        // Store for download
        this.capturedImageData = captureCanvas.toDataURL('image/png');

        // Show modal
        document.getElementById('captureModal').style.display = 'block';
    }

    downloadPhoto() {
        if (!this.capturedImageData) return;

        const link = document.createElement('a');
        link.download = `addsub-tryou-${Date.now()}.png`;
        link.href = this.capturedImageData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async sharePhoto() {
        if (!this.capturedImageData) return;

        if (navigator.share) {
            try {
                const response = await fetch(this.capturedImageData);
                const blob = await response.blob();
                const file = new File([blob], 'addsub-tryou.png', { type: 'image/png' });

                await navigator.share({
                    title: 'My AddSub Virtual Try-On',
                    text: 'Check out how I look in these glasses!',
                    files: [file]
                });
            } catch (error) {
                console.error('Error sharing:', error);
                this.fallbackShare();
            }
        } else {
            this.fallbackShare();
        }
    }

    fallbackShare() {
        const text = 'Check out my virtual try-on with AddSub glasses!';
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Share text copied to clipboard!');
            });
        } else {
            alert('Sharing not supported on this device. You can save the image and share it manually.');
        }
    }

    resetSettings() {
        this.sizeSlider.value = 1.0;
        this.widthSlider.value = 1.0;
        this.heightSlider.value = 0;
        
        document.getElementById('sizeValue').textContent = '1.0';
        document.getElementById('widthValue').textContent = '1.0';
        document.getElementById('heightValue').textContent = '0';
        
        if (this.glassesRenderer) {
            this.glassesRenderer.updateScale(1.0);
            this.glassesRenderer.updateWidth(1.0);
            this.glassesRenderer.updateHeightOffset(0);
        }
        
        this.changeFrame('classic');
    }

    resizeCanvases() {
        const container = this.videoElement.parentElement;
        const rect = container.getBoundingClientRect();
        
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        
        // Set canvas dimensions
        this.canvasElement.width = width;
        this.canvasElement.height = height;
        this.outputCanvas.width = width;
        this.outputCanvas.height = height;
        
        // Update CSS size too
        this.canvasElement.style.width = width + 'px';
        this.canvasElement.style.height = height + 'px';
        this.outputCanvas.style.width = width + 'px';
        this.outputCanvas.style.height = height + 'px';
        
        if (this.glassesRenderer) {
            this.glassesRenderer.resize(width, height);
        }
    }

    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resizeCanvases();
            }, 250);
        });
    }

    showLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'block';
        }
    }

    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    showError(message) {
        this.hideLoading();
        if (this.errorMessage) {
            this.errorMessage.querySelector('p').textContent = message;
            this.errorMessage.style.display = 'block';
        }
    }

    destroy() {
        if (this.faceTracker) {
            this.faceTracker.stop();
        }
        this.isInitialized = false;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const app = new VirtualTryOnApp();
    
    try {
        await app.init();
    } catch (error) {
        console.error('Failed to start virtual try-on app:', error);
    }
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        app.destroy();
    });
});