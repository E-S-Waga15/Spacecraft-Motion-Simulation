import * as THREE from "three";
import { Earth } from "../objects/Earth";
import { FreeLookCamera } from "../camera/FreeLookCamera";
import { ShuttleTrackingCamera } from "../camera/ShuttleTrackingCamera";
import { LaunchPad } from "../objects/LaunchPad";
import { SpaceShuttle } from "../objects/SpaceShuttle";
import { WaterObject } from "../objects/Water";
import { Units } from "../utils/Units";
import { ShuttlePhysics } from "../physics/ShuttlePhysics";

export class MainScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.querySelector("#scene"),
      antialias: true,
    });
    this.isInitialized = false;
    this.shuttlePhysics = new ShuttlePhysics(); // --- إدارة الكاميرات ---

    this.freeLookCamera = null; // الكاميرا اليدوية الحرة
    this.shuttleTrackingCamera = null; // كاميرا تتبع المكوك
    this.activeCamera = null; // الكاميرا النشطة حاليًا (كائن THREE.Camera)

    // --- جديد: متغير لتتبع ما إذا كان مفتاح المسافة مضغوطًا بالفعل لمنع التكرار السريع ---
    this.spacebarPressed = false;

    this.init();
  }

  async init() {
    try {
      // Setup renderer
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Add ambient light

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
      this.scene.add(ambientLight); // Add directional light (sun)

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
      this.scene.add(sunLight); // Add hemisphere light for better ambient lighting

      const hemisphereLight = new THREE.HemisphereLight(
        0xffffff,
        0x444444,
        0.6
      );
      this.scene.add(hemisphereLight); // Add Earth

      this.earth = new Earth();
      this.scene.add(this.earth.getObject()); // تأكد أن Earth.js لديها getObject() // Add Water

      this.water = new WaterObject(this.earth);
      const waterModel = this.water.getObject();
      if (waterModel) {
        this.scene.add(waterModel);
      } // Add Launch Pad

      this.launchPad = new LaunchPad(this.earth);
      const launchPadModel = await this.launchPad.load();
      if (launchPadModel) {
        this.scene.add(launchPadModel);
      } // Add Space Shuttle

      this.spaceShuttle = new SpaceShuttle(this.earth, this.shuttlePhysics);
      const shuttleModel = await this.spaceShuttle.load();
      if (shuttleModel) {
        this.scene.add(shuttleModel);
      } // Add AxesHelper to visualize X (red), Y (green), Z (blue) axes

      const axesHelper = new THREE.AxesHelper(Units.toProjectUnits(20)); // 20 meters long
      this.scene.add(axesHelper); // --- تهيئة الكاميرات بعد تحميل المكوك والأرض ---

      this.freeLookCamera = new FreeLookCamera(this.earth); // كاميرا التحكم الحر
      this.shuttleTrackingCamera = new ShuttleTrackingCamera(
        this.spaceShuttle.model
      ); // كاميرا تتبع المكوك // تعيين الكاميرا الافتراضية عند البدء (الكاميرا الحرة)
      this.activeCamera = this.freeLookCamera.getCamera();
      this.freeLookCamera.setEnabled(true); // تمكين الكاميرا الحرة
      this.shuttleTrackingCamera.setEnabled(false); // تعطيل كاميرا التتبع في البداية // إضافة مستمع لحدث تغيير حجم النافذة

      window.addEventListener("resize", this.onWindowResize.bind(this)); // إضافة مستمع لحدث الضغط على المفاتيح للتبديل بين الكاميرات
      window.addEventListener("keydown", this.handleKeyDown.bind(this));
      // --- جديد: إضافة مستمع لحدث تحرير المفتاح ---
      window.addEventListener("keyup", this.handleKeyUp.bind(this)); // Set initialized flag

      this.isInitialized = true; // Start animation loop

      this.animate();
    } catch (error) {
      console.error("Error initializing scene:", error);
    }
  }

  onWindowResize() {
    // تحديث جميع الكاميرات عند تغيير حجم النافذة
    if (this.freeLookCamera) this.freeLookCamera.onWindowResize();
    if (this.shuttleTrackingCamera) this.shuttleTrackingCamera.onWindowResize();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  } // دالة للتبديل بين الكاميرات

  toggleCamera() {
    if (this.activeCamera === this.freeLookCamera.getCamera()) {
      // التبديل إلى كاميرا التتبع
      this.activeCamera = this.shuttleTrackingCamera.getCamera();
      this.freeLookCamera.setEnabled(false); // تعطيل الكاميرا الحرة
      this.shuttleTrackingCamera.setEnabled(true); // تمكين كاميرا التتبع
      console.log(
        "Switched to Shuttle Tracking Camera (Press '1' for Free-Look Camera)"
      );
    } else {
      // التبديل إلى الكاميرا الحرة
      this.activeCamera = this.freeLookCamera.getCamera();
      this.freeLookCamera.setEnabled(true); // تمكين الكاميرا الحرة
      this.shuttleTrackingCamera.setEnabled(false); // تعطيل كاميرا التتبع
      console.log(
        "Switched to Free-Look Camera (Press '2' for Tracking Camera)"
      );
    }
  }

  handleKeyDown(event) {
    // نستخدم event.code بدلاً من event.key ليكون أكثر موثوقية لمفاتيح الأرقام
    if (event.code === "Digit1") {
      // مفتاح 1 للكاميرا الحرة
      if (this.activeCamera !== this.freeLookCamera.getCamera()) {
        this.toggleCamera();
      }
    } else if (event.code === "Digit2") {
      // مفتاح 2 لكاميرا التتبع
      if (this.activeCamera !== this.shuttleTrackingCamera.getCamera()) {
        this.toggleCamera();
      }
    } // هنا يمكنك إضافة المزيد من معالجات المفاتيح إذا لزم الأمر
    // --- جديد: منطق تدوير برج الإطلاق بمفتاح المسافة ---
    if (event.code === "Space" && !this.spacebarPressed) {
      this.spacebarPressed = true; // منع الدوران المتعدد
      if (this.launchPad && this.launchPad.towerModel) { 
        // الميلان 90 درجة للخلف (أو للأمام، حسب اتجاه الموديل)
        // قد تحتاج لتجربة +90 أو -90 اعتماداً على اتجاه موديل البرج
        this.launchPad.tiltTower(90); // تدوير 90 درجة (PI/2 راديان)
      } else {
        console.warn("Launch pad tower not available for rotation.");
      }
    }
  }

  // --- جديد: دالة لمعالجة تحرير المفتاح وإعادة تعيين spacebarPressed ---
  handleKeyUp(event) {
    if (event.code === "Space") {
      this.spacebarPressed = false;
    }
  }

  animate() {
    if (!this.isInitialized) return;

    requestAnimationFrame(this.animate.bind(this));

    try {
      const deltaTime = 1 / 60; // Fixed time step for physics (realistic speed) // Update Earth

      if (this.earth) {
        this.earth.update();
      } // Update Water if it exists

      if (this.water) {
        this.water.update();
      } // Update Launch Pad if it exists

      // تأكد من تمرير دوران الأرض الصحيح. إذا كانت rotationSpeed هي معدل الدوران،
      // فستحتاج إلى استخدام rotation.y الفعلي لكائن الأرض للحصول على الموضع المطلق.
         // Update Launch Pad (نمرر deltaTime هنا)
         if (this.launchPad && this.earth && this.earth.getObject()) {
            this.launchPad.update(this.earth.getObject().rotation.y, deltaTime); // <<<<<<<<<<<<<< هنا يتم تمرير deltaTime
        }

      if (this.spaceShuttle) {
        this.spaceShuttle.update(deltaTime);
      } // تحديث الكاميرات (كلتاهما، لكن فقط الكاميرا النشطة ستؤثر على العرض)

      if (this.freeLookCamera) {
        this.freeLookCamera.update();
      }
      if (this.shuttleTrackingCamera) {
        this.shuttleTrackingCamera.update();
      } // Render scene باستخدام الكاميرا النشطة

      this.renderer.render(this.scene, this.activeCamera);
    } catch (error) {
      console.error("Error in animation loop:", error);
    }
  }
}

// تهيئة وإطلاق مدير المشهد
const sceneManager = new MainScene();

// لجعل sceneManager متاحًا للـ HUD script في index.html
window.scene = sceneManager;
