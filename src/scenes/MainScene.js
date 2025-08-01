// src/MainScene.js

import * as THREE from "three";
import { Earth } from "../objects/Earth";
import { FreeLookCamera } from "../camera/FreeLookCamera";
import { ShuttleTrackingCamera } from "../camera/ShuttleTrackingCamera";
import { LaunchPad } from "../objects/LaunchPad";
import { SpaceShuttle } from "../objects/SpaceShuttle"; // Make sure this path is correct
import { WaterObject } from "../objects/Water";
import { Units } from "../utils/Units";
import { ShuttlePhysics } from "../physics/ShuttlePhysics";
import { PhysicsConstants } from "../constants/PhysicsConstants";
import { ShuttleStages } from "../constants/ShuttleStages";

export class MainScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("#scene"),
      antialias: true,
    });
    this.isInitialized = false;

    this.shuttlePhysics = new ShuttlePhysics();

    this.freeLookCamera = null;
    this.shuttleTrackingCamera = null;
    this.activeCamera = null;

    this.spacebarPressed = false;

    this.init();
  }

  async init() {
    try {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const audioListener = new THREE.AudioListener();
      this.scene.add(audioListener);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      this.scene.add(ambientLight);

      const sunLight = new THREE.DirectionalLight(0xffffff, 1);
      sunLight.position.set(
        Units.toProjectUnits(10000000),
        Units.toProjectUnits(10000000),
        Units.toProjectUnits(10000000)
      );
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = Units.toProjectUnits(20000000);
      this.scene.add(sunLight);

      const hemisphereLight = new THREE.HemisphereLight(
        0xffffff,
        0x444444,
        0.6
      );
      this.scene.add(hemisphereLight);

      this.earth = new Earth();
      this.scene.add(this.earth.getObject());

      this.water = new WaterObject(this.earth);
      const waterModel = this.water.getObject();
      if (waterModel) {
        this.scene.add(waterModel);
      }

      this.launchPad = new LaunchPad(this.earth);
      const launchPadModel = await this.launchPad.load();
      if (launchPadModel) {
        this.scene.add(launchPadModel);
        this.shuttlePhysics.setLaunchPad(this.launchPad);
      }

      // 🚀 الخطوة الرئيسية: تهيئة الكاميرات أولاً قبل SpaceShuttle
      this.freeLookCamera = new FreeLookCamera(this.earth);

      // ✅ تمرير الكاميرا النشطة حالياً (FreeLookCamera) و الـ scene إلى SpaceShuttle constructor
      this.spaceShuttle = new SpaceShuttle(
        this.earth,
        this.shuttlePhysics,
        this.freeLookCamera.getCamera(),
        this.scene // <--- ADDED THIS LINE: Pass the scene object here
      );
      this.spaceShuttle.setAudioListener(audioListener);
      const shuttleModel = await this.spaceShuttle.load();
      if (shuttleModel) {
        this.scene.add(shuttleModel);
      }

      const axesHelper = new THREE.AxesHelper(Units.toProjectUnits(20));
      this.scene.add(axesHelper);

      // الآن بعد تحميل shuttleModel وتهيئته، يمكننا إنشاء ShuttleTrackingCamera
      // لأنها تحتاج إلى this.spaceShuttle.model
      this.shuttleTrackingCamera = new ShuttleTrackingCamera(
        this.spaceShuttle.model
      );

      this.activeCamera = this.freeLookCamera.getCamera();
      this.freeLookCamera.setEnabled(true);
      this.shuttleTrackingCamera.setEnabled(false);

      window.addEventListener("resize", this.onWindowResize.bind(this));
      window.addEventListener("keydown", this.handleKeyDown.bind(this));
      window.addEventListener("keyup", this.handleKeyUp.bind(this));

      this.isInitialized = true;
      this.animate();
    } catch (error) {
      console.error("Error initializing scene:", error);
    }
  }

  onWindowResize() {
    if (this.freeLookCamera) this.freeLookCamera.onWindowResize();
    if (this.shuttleTrackingCamera) this.shuttleTrackingCamera.onWindowResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  toggleCamera() {
    if (this.activeCamera === this.freeLookCamera.getCamera()) {
      this.activeCamera = this.shuttleTrackingCamera.getCamera();
      this.freeLookCamera.setEnabled(false);
      this.shuttleTrackingCamera.setEnabled(true);
      console.log(
        "Switched to Shuttle Tracking Camera (Press '1' for Free-Look Camera)"
      );
    } else {
      this.activeCamera = this.freeLookCamera.getCamera();
      this.freeLookCamera.setEnabled(true);
      this.shuttleTrackingCamera.setEnabled(false);
      console.log(
        "Switched to Free-Look Camera (Press '2' for Tracking Camera)"
      );
    }
    // ✅ تحديث الكاميرا في SpaceShuttle عند تبديل الكاميرات
    // هذا يضمن أن نظام الجسيمات يستخدم الكاميرا الصحيحة للفرز
    if (this.spaceShuttle && this.spaceShuttle.camera !== this.activeCamera) {
      this.spaceShuttle.camera = this.activeCamera;
    }
  }

  handleKeyDown(event) {
    // تحديث الكاميرا النشطة عند تغييرها
    if (event.code === "Digit1") {
      if (this.activeCamera !== this.freeLookCamera.getCamera()) {
        this.toggleCamera();
      }
    } else if (event.code === "Digit2") {
      if (this.activeCamera !== this.shuttleTrackingCamera.getCamera()) {
        this.toggleCamera();
      }
    }

    if (
      event.code === "Space" &&
      !this.spacebarPressed &&
      this.shuttlePhysics.stage === ShuttleStages.IDLE
    ) {
      console.log("MainScene: Spacebar pressed, initiating launch sequence.");
      this.spacebarPressed = true;

      this.shuttlePhysics.setStage(ShuttleStages.ENGINE_STARTUP);
      if (this.spaceShuttle) {
        this.spaceShuttle.toggleEngineEffects(true); // هذا مجرد سجل
        this.spaceShuttle.playSounds(true); // بدء صوت المحركات
      }
    }
  }

  handleKeyUp(event) {
    if (event.code === "Space") {
      this.spacebarPressed = false;
    }
  }

  animate() {
    if (!this.isInitialized) return;

    requestAnimationFrame(this.animate.bind(this));

    try {
      const deltaTime = 1 / 60; // Fixed timestep for physics and updates

      if (this.earth) {
        this.earth.update();
      }

      if (this.water) {
        this.water.update();
      }

      if (this.launchPad && this.earth && this.earth.getObject()) {
        this.launchPad.update(this.earth.getObject().rotation.y, deltaTime);
      }

      if (this.spaceShuttle) {
        this.spaceShuttle.update(deltaTime);
      }

      if (this.freeLookCamera) {
        this.freeLookCamera.update();
      }
      if (this.shuttleTrackingCamera) {
        this.shuttleTrackingCamera.update();
      }

      this.renderer.render(this.scene, this.activeCamera);
    } catch (error) {
      console.error("Error in animation loop:", error);
    }
  }
}

const sceneManager = new MainScene();
window.scene = sceneManager;