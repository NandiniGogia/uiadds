class GlassesRenderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.glassesModel = null;
    this.currentFrame = 'classic';
    this.scale = 1.0;
    this.width = 1.0;
    this.heightOffset = 0;
    this.isInitialized = false;
    this.gltfLoader = null;
    this.loadedModels = new Map();
    this.canvas = null;
    this.canvasWidth = 0;
    this.canvasHeight = 0;

    // PNG support
    this.pngImage = null;
  }

  init(canvas) {
    try {
      this.canvas = canvas;
      this.canvasWidth = canvas.width;
      this.canvasHeight = canvas.height;

      // Scene setup
      this.scene = new THREE.Scene();

      const aspect = canvas.width / canvas.height;
      const frustumSize = 2;
      this.camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2, frustumSize * aspect / 2,
        frustumSize / 2, -frustumSize / 2,
        0.1, 1000
      );
      this.camera.position.set(0, 0, 5);

      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
      });
      this.renderer.setSize(canvas.width, canvas.height);
      this.renderer.setClearColor(0x000000, 0);

      this.gltfLoader = new THREE.GLTFLoader();

      this.setupLighting();
      this.loadGlassesModel(this.currentFrame);

      this.isInitialized = true;
      this.animate();
    } catch (error) {
      console.error("Error initializing glasses renderer:", error);
    }
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 5);
    this.scene.add(directionalLight);
  }

  async loadGlassesModel(frameType) {
    if (this.glassesModel) {
      this.scene.remove(this.glassesModel);
      this.glassesModel = null;
    }

    this.currentFrame = frameType;

    if (frameType === 'gltf' || frameType === 'realistic') {
      await this.loadGLTFModel();
    } else if (frameType === 'png') {
      this.loadPNGGlasses();
    } else {
      this.glassesModel = this.createGlassesGeometry(frameType);
      this.scene.add(this.glassesModel);
    }
  }

  loadPNGGlasses() {
    this.pngImage = new Image();
    this.pngImage.src = "a2ec560f-b602-41d6-baa5-0241e9f78513.png";
    this.pngImage.onload = () => {
      console.log("PNG glasses loaded");
    };
  }

  async loadGLTFModel() {
    return new Promise((resolve) => {
      if (this.loadedModels.has("gltf")) {
        this.glassesModel = this.loadedModels.get("gltf").clone();
        this.scene.add(this.glassesModel);
        resolve();
        return;
      }
      this.gltfLoader.load("scene.gltf", (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.scale.set(0.15, 0.15, 0.15);
        model.position.set(0, 0, 0);
        this.loadedModels.set("gltf", model.clone());
        this.glassesModel = model;
        this.scene.add(this.glassesModel);
        resolve();
      }, undefined, () => {
        this.glassesModel = this.createGlassesGeometry('classic');
        this.scene.add(this.glassesModel);
        resolve();
      });
    });
  }

  updateGlasses(landmarks, canvasWidth, canvasHeight) {
    if (this.currentFrame === 'png' && this.pngImage) {
      const ctx = this.canvas.getContext("2d");
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      if (!leftEye || !rightEye) return;

      const left = this.normalizedToWorld(leftEye, canvasWidth, canvasHeight);
      const right = this.normalizedToWorld(rightEye, canvasWidth, canvasHeight);

      const eyeDistance = Math.sqrt((right.x - left.x) ** 2 + (right.y - left.y) ** 2);
      const glassesWidth = eyeDistance * 2.5 * this.scale;
      const glassesHeight = (this.pngImage.height / this.pngImage.width) * glassesWidth;

      const centerX = (left.x + right.x) / 2 + canvasWidth / 2;
      const centerY = (left.y + right.y) / 2 + canvasHeight / 2;

      ctx.drawImage(
        this.pngImage,
        centerX - glassesWidth / 2,
        centerY - glassesHeight / 2,
        glassesWidth,
        glassesHeight
      );
      return;
    }

    if (!this.glassesModel || !landmarks) return;

    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    if (!leftEye || !rightEye) return;

    const leftEyeWorld = this.normalizedToWorld(leftEye, canvasWidth, canvasHeight);
    const rightEyeWorld = this.normalizedToWorld(rightEye, canvasWidth, canvasHeight);

    const centerX = (leftEyeWorld.x + rightEyeWorld.x) / 2;
    const centerY = (leftEyeWorld.y + rightEyeWorld.y) / 2 + (this.heightOffset * 0.001);

    const eyeDistance = Math.abs(rightEyeWorld.x - leftEyeWorld.x);
    const baseScale = eyeDistance * 0.8;
    const finalScale = baseScale * this.scale * this.width;

    const angle = Math.atan2(rightEyeWorld.y - leftEyeWorld.y, rightEyeWorld.x - leftEyeWorld.x);

    this.glassesModel.position.set(centerX, centerY, 0);
    this.glassesModel.rotation.z = angle;
    this.glassesModel.scale.set(finalScale, finalScale, finalScale);

    this.glassesModel.visible = true;
  }

  normalizedToWorld(landmark, canvasWidth, canvasHeight) {
    const aspect = canvasWidth / canvasHeight;
    const frustumSize = 2;
    return {
      x: (landmark.x - 0.5) * frustumSize * aspect,
      y: -(landmark.y - 0.5) * frustumSize,
      z: landmark.z || 0
    };
  }

  changeFrame(frameType) {
    this.loadGlassesModel(frameType);
  }

  updateScale(scale) { this.scale = scale; }
  updateWidth(width) { this.width = width; }
  updateHeightOffset(offset) { this.heightOffset = offset; }

  resize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    if (this.camera && this.renderer) {
      const aspect = width / height;
      const frustumSize = 2;
      this.camera.left = -frustumSize * aspect / 2;
      this.camera.right = frustumSize * aspect / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = -frustumSize / 2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
