// Face Detection and Tracking with MediaPipe
class FaceTracker {
    constructor() {
        this.faceMesh = null;
        this.camera = null;
        this.onResultsCallback = null;
        this.isInitialized = false;
        this.lastDetectionTime = 0;
        this.detectionInterval = 33; // ~30 FPS
    }

    async init(videoElement, canvasElement, onResults) {
        try {
            this.onResultsCallback = onResults;

            // Initialize MediaPipe Face Mesh
            this.faceMesh = new FaceMesh({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                }
            });

            // Configure Face Mesh
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            // Set up results callback
            this.faceMesh.onResults((results) => {
                this.onResults(results);
            });

            // Initialize camera
            this.camera = new Camera(videoElement, {
                onFrame: async () => {
                    const currentTime = Date.now();
                    if (currentTime - this.lastDetectionTime >= this.detectionInterval) {
                        await this.faceMesh.send({ image: videoElement });
                        this.lastDetectionTime = currentTime;
                    }
                },
                width: 1280,
                height: 720
            });

            // Start camera
            await this.camera.start();
            
            this.isInitialized = true;
            console.log('Face tracking initialized successfully');

        } catch (error) {
            console.error('Error initializing face tracking:', error);
            throw error;
        }
    }

    onResults(results) {
        if (this.onResultsCallback) {
            // Process and clean the results
            const processedResults = this.processResults(results);
            this.onResultsCallback(processedResults);
        }
    }

    processResults(results) {
        if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return null;
        }

        const landmarks = results.multiFaceLandmarks[0];
        
        // Key landmark indices for glasses positioning
        const keyLandmarks = {
            // Eyes
            leftEyeOuter: landmarks[33],
            leftEyeInner: landmarks[133],
            leftEyeCenter: landmarks[159],
            rightEyeOuter: landmarks[263],
            rightEyeInner: landmarks[362],
            rightEyeCenter: landmarks[386],
            
            // Nose
            noseTip: landmarks[1],
            noseBridge: landmarks[9],
            noseTop: landmarks[10],
            
            // Face outline
            leftCheek: landmarks[234],
            rightCheek: landmarks[454],
            chin: landmarks[175],
            forehead: landmarks[9],
            
            // Eyebrows
            leftEyebrowOuter: landmarks[70],
            leftEyebrowInner: landmarks[63],
            rightEyebrowOuter: landmarks[300],
            rightEyebrowInner: landmarks[293]
        };

        return {
            landmarks: landmarks,
            keyLandmarks: keyLandmarks,
            confidence: this.calculateConfidence(landmarks),
            faceRect: this.calculateFaceRect(landmarks),
            headPose: this.calculateHeadPose(keyLandmarks)
        };
    }

    calculateConfidence(landmarks) {
        // Simple confidence calculation based on landmark stability
        if (!landmarks || landmarks.length === 0) return 0;
        
        // Check if key landmarks are present and have reasonable values
        const keyIndices = [33, 263, 1, 9]; // Eyes, nose tip, nose bridge
        let validLandmarks = 0;
        
        for (const index of keyIndices) {
            const landmark = landmarks[index];
            if (landmark && 
                landmark.x >= 0 && landmark.x <= 1 &&
                landmark.y >= 0 && landmark.y <= 1) {
                validLandmarks++;
            }
        }
        
        return validLandmarks / keyIndices.length;
    }

    calculateFaceRect(landmarks) {
        if (!landmarks || landmarks.length === 0) return null;

        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        
        for (const landmark of landmarks) {
            minX = Math.min(minX, landmark.x);
            minY = Math.min(minY, landmark.y);
            maxX = Math.max(maxX, landmark.x);
            maxY = Math.max(maxY, landmark.y);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }

    calculateHeadPose(keyLandmarks) {
        if (!keyLandmarks.leftEyeCenter || !keyLandmarks.rightEyeCenter || !keyLandmarks.noseTip) {
            return { pitch: 0, yaw: 0, roll: 0 };
        }

        const leftEye = keyLandmarks.leftEyeCenter;
        const rightEye = keyLandmarks.rightEyeCenter;
        const nose = keyLandmarks.noseTip;

        // Calculate roll (rotation around z-axis)
        const eyeDeltaX = rightEye.x - leftEye.x;
        const eyeDeltaY = rightEye.y - leftEye.y;
        const roll = Math.atan2(eyeDeltaY, eyeDeltaX);

        // Calculate yaw (rotation around y-axis)
        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const noseOffsetX = nose.x - eyeCenterX;
        const yaw = Math.atan2(noseOffsetX, 0.1);

        // Calculate pitch (rotation around x-axis)
        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
        const noseOffsetY = nose.y - eyeCenterY;
        const pitch = Math.atan2(noseOffsetY, 0.1);

        return {
            pitch: pitch,
            yaw: yaw,
            roll: roll
        };
    }

    stop() {
        if (this.camera) {
            this.camera.stop();
        }
        this.isInitialized = false;
    }

    restart() {
        if (this.camera) {
            this.camera.start();
        }
    }

    isReady() {
        return this.isInitialized && this.camera;
    }
}

// Utility functions for landmark processing
class LandmarkUtils {
    static distance(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const dz = (point1.z || 0) - (point2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    static midpoint(point1, point2) {
        return {
            x: (point1.x + point2.x) / 2,
            y: (point1.y + point2.y) / 2,
            z: ((point1.z || 0) + (point2.z || 0)) / 2
        };
    }

    static angle(point1, point2) {
        return Math.atan2(point2.y - point1.y, point2.x - point1.x);
    }

    static normalizeCoordinate(coordinate, canvasWidth, canvasHeight) {
        return {
            x: coordinate.x * canvasWidth,
            y: coordinate.y * canvasHeight,
            z: coordinate.z || 0
        };
    }

    static smoothLandmarks(currentLandmarks, previousLandmarks, smoothingFactor = 0.7) {
        if (!previousLandmarks) return currentLandmarks;

        const smoothed = [];
        for (let i = 0; i < currentLandmarks.length; i++) {
            const current = currentLandmarks[i];
            const previous = previousLandmarks[i];
            
            if (previous) {
                smoothed.push({
                    x: previous.x * smoothingFactor + current.x * (1 - smoothingFactor),
                    y: previous.y * smoothingFactor + current.y * (1 - smoothingFactor),
                    z: (previous.z || 0) * smoothingFactor + (current.z || 0) * (1 - smoothingFactor)
                });
            } else {
                smoothed.push(current);
            }
        }
        
        return smoothed;
    }
}