// src/MainScene.js

import * as THREE from "three";
import { Earth } from "../objects/Earth";
import { FreeLookCamera } from "../camera/FreeLookCamera";
import { ShuttleTrackingCamera } from "../camera/ShuttleTrackingCamera";
import { LaunchPad } from "../objects/LaunchPad";
import { SpaceShuttle } from "../objects/SpaceShuttle";
import { WaterObject } from "../objects/Water";
import { Stars } from "../objects/Stars";
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
    this.lastFrameTime = performance.now();

    this.spacebarPressed = false;

    // ✅ إضافة خاصية للتحكم في سرعة المحاكاة
    this.simulationSpeedFactor = 1.0;

    // ✅ التحكم في إظهار/إخفاء خلفية السماء تحت ارتفاع 50,000 عبر المفتاح M
    this.isSkyBackgroundEnabled = true;

    // ✅ متغيرات للتحكم في خلفية السماء
    this.skyBackground = null;
    this.spaceBackground = null;
    this.currentBackground = 'sky';

    this.init();
  }

  async init() {
    try {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // ✅ إصلاح إعدادات معالجة الألوان
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0; // إعادة التعرض للقيمة الطبيعية
      
      // ✅ إنشاء خلفية السماء
      this.skyBackground = new THREE.Color(0x87CEEB); // لون السماء الأزرق
      this.spaceBackground = null; // خلفية الفضاء (شفافة)
      
      // ✅ تعيين خلفية السماء كبداية
      this.scene.background = this.skyBackground;

      const audioListener = new THREE.AudioListener();
      this.scene.add(audioListener);

      // ✅ تحميل خريطة بيئية للإضاءة (skybox) لاستخدامها كإضاءة انعكاسية
      try {
        const cubeLoader = new THREE.CubeTextureLoader();
        const envMap = cubeLoader.setPath('/skybox/').load([
          'posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg'
        ]);
        envMap.colorSpace = THREE.SRGBColorSpace;
        this.environmentMap = envMap;
        this.scene.environment = envMap; // تفيد خامات PBR مثل MeshStandardMaterial
      } catch (e) {
        console.warn('Environment map failed to load, continuing without it', e);
      }

      // ✅ تحسين الإضاءة المحيطة
      this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // زيادة شدة الإضاءة المحيطة
      this.baseAmbientIntensity = 0.8;
      this.scene.add(this.ambientLight);

      // ✅ تحسين إضاءة الشمس
      this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5); // زيادة شدة إضاءة الشمس
      this.baseSunIntensity = 1.5;
      this.sunLight.position.set(
        Units.toProjectUnits(10000000),
        Units.toProjectUnits(10000000),
        Units.toProjectUnits(10000000)
      );
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 2048;
      this.sunLight.shadow.mapSize.height = 2048;
      this.sunLight.shadow.camera.near = 0.5;
      this.sunLight.shadow.camera.far = Units.toProjectUnits(20000000);
      
      // ✅ تحسين ظلال الشمس
      this.sunLight.shadow.bias = -0.0001;
      this.sunLight.shadow.normalBias = 0.02;
      this.sunLight.shadow.radius = 1;
      
      this.scene.add(this.sunLight);

      // ✅ تحسين إضاءة نصف الكرة
      this.hemisphereLight = new THREE.HemisphereLight(
        0xffffff, // لون السماء
        0x444444, // لون الأرض
        1.0 // زيادة شدة الإضاءة
      );
      this.baseHemisphereIntensity = 1.0;
      this.scene.add(this.hemisphereLight);

      // ✅ إضافة إضاءة إضافية للحاملة والطائرات المروحية
      const carrierLight = new THREE.PointLight(0xffffff, 1.0, Units.toProjectUnits(2000));
      carrierLight.position.set(0, Units.toProjectUnits(100), 0);
      this.scene.add(carrierLight);

      // ✅ إضاءة قمرية ناعمة للوضع الليلي (مطفأة افتراضياً)
      this.moonLight = new THREE.DirectionalLight(0x99bbff, 0.35);
      this.moonLight.position.set(
        Units.toProjectUnits(-2000000),
        Units.toProjectUnits(3000000),
        Units.toProjectUnits(1500000)
      );
      this.moonLight.castShadow = true;
      this.moonLight.shadow.mapSize.width = 1024;
      this.moonLight.shadow.mapSize.height = 1024;
      this.moonLight.shadow.bias = -0.0001;
      this.moonLight.visible = false;
      this.scene.add(this.moonLight);

    

      this.earth = new Earth();
      this.scene.add(this.earth.getObject());

      this.stars = new Stars();
      this.scene.add(this.stars.getObject());

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
        
        // ✅ إضافة إضاءة خاصة للحاملة
        const carrierPosition = this.launchPad.carrierPosition;
        if (carrierPosition) {
          this.carrierSpotLight = new THREE.SpotLight(0xffffff, 2.0, Units.toProjectUnits(6000));
          this.baseCarrierSpotIntensity = 2.0;
          this.carrierSpotLight.position.set(
            carrierPosition.x,
            carrierPosition.y + Units.toProjectUnits(50),
            carrierPosition.z
          );
          this.carrierSpotLight.target.position.copy(carrierPosition);
          this.carrierSpotLight.angle = Math.PI / 6; // 30 درجة
          this.carrierSpotLight.penumbra = 0.3;
          this.carrierSpotLight.castShadow = true;
          this.carrierSpotLight.shadow.mapSize.width = 1024;
          this.carrierSpotLight.shadow.mapSize.height = 1024;
          
          this.scene.add(this.carrierSpotLight);
          this.scene.add(this.carrierSpotLight.target);
          
          console.log('Added special lighting for carrier');
        }
      }

      this.freeLookCamera = new FreeLookCamera(this.earth);
      this.spaceShuttle = new SpaceShuttle(
        this.earth,
        this.shuttlePhysics,
        this.freeLookCamera.getCamera(),
        this.scene
      );
      this.spaceShuttle.setAudioListener(audioListener);
      const shuttleModel = await this.spaceShuttle.load();
      if (shuttleModel) {
        this.scene.add(shuttleModel);
      }

      this.shuttleTrackingCamera = new ShuttleTrackingCamera(
        this.spaceShuttle.model
      );
      console.log(
        "MainScene: ShuttleTrackingCamera initialized with model:",
        this.spaceShuttle.model
      );
      console.log(
        "MainScene: Model position:",
        this.spaceShuttle.model.position
      );
      console.log(
        "MainScene: Model rotation:",
        this.spaceShuttle.model.rotation
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

  // ✅ دالة لتغيير خلفية السماء بناءً على الارتفاع
  updateSkyBackground(altitude) {
    const transitionAltitude = 50000; // 50km
    
    if (altitude >= transitionAltitude && this.currentBackground !== 'space') {
      // الانتقال إلى خلفية الفضاء
      this.scene.background = this.spaceBackground;
      this.currentBackground = 'space';
      console.log('Switched to space background at altitude:', altitude);
    } else if (altitude < transitionAltitude) {
      // تحت 50 كم: نطبق حالة المستخدم (إظهار/إخفاء)
      if (this.isSkyBackgroundEnabled) {
        if (this.currentBackground !== 'sky') {
          this.scene.background = this.skyBackground;
          this.currentBackground = 'sky';
          console.log('Switched to sky background at altitude:', altitude);
        }
      } else {
        if (this.currentBackground !== 'none') {
          this.scene.background = null;
          this.currentBackground = 'none';
          console.log('Sky background hidden (manual) at altitude:', altitude);
        }
      }
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
      if (this.spaceShuttle && this.spaceShuttle.model) {
        console.log(
          "MainScene: Shuttle model position:",
          this.spaceShuttle.model.position
        );
        console.log(
          "MainScene: Shuttle model world position:",
          this.spaceShuttle.model.getWorldPosition(new THREE.Vector3())
        );
      }
    } else {
      this.activeCamera = this.freeLookCamera.getCamera();
      this.freeLookCamera.setEnabled(true);
      this.shuttleTrackingCamera.setEnabled(false);
      console.log(
        "Switched to Free-Look Camera (Press '2' for Tracking Camera)"
      );
    }
    if (this.spaceShuttle && this.spaceShuttle.camera !== this.activeCamera) {
      this.spaceShuttle.camera = this.activeCamera;
    }
  }

  handleKeyDown(event) {
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
        this.spaceShuttle.toggleEngineEffects(true);
        this.spaceShuttle.playSounds(true);
      }
    }

    // ✅ إضافة معالج أحداث لوحة المفاتيح للتحكم في السرعة
    // استخدام مفتاح "+" لزيادة السرعة ومفتاح "-" لإنقاصها
    if (event.key === "0" || event.key === "Equal") {
      this.simulationSpeedFactor = Math.min(
        10.0,
        this.simulationSpeedFactor + 1.0
      );
      console.log(
        `Simulation speed increased to: ${this.simulationSpeedFactor}x`
      );
    } else if (event.key === "-" || event.key === "Minus") {
      this.simulationSpeedFactor = Math.max(
        1.0,
        this.simulationSpeedFactor - 1.0
      );
      console.log(
        `Simulation speed decreased to: ${this.simulationSpeedFactor}x`
      );
    } else if (event.code === 'KeyM') {
      // ✅ التبديل بين إظهار/إخفاء خلفية السماء تحت 50,000
      const transitionAltitude = 50000;
      const altitude = this.spaceShuttle ? this.spaceShuttle.getAltitude() : 0;
      if (altitude < transitionAltitude) {
        this.isSkyBackgroundEnabled = !this.isSkyBackgroundEnabled;
        if (this.isSkyBackgroundEnabled) {
          this.scene.background = this.skyBackground;
          this.currentBackground = 'sky';
          console.log('Sky background enabled (manual).');
          // إطفاء أضواء الحاملة الليلية عند تفعيل ضوء السماء
          if (this.launchPad && typeof this.launchPad.setNightLightsEnabled === 'function') {
            this.launchPad.setNightLightsEnabled(false);
          }
          // إطفاء ضوء القمر
          if (this.moonLight) this.moonLight.visible = false;
          // إعادة شدات الإضاءة النهارية
          if (this.ambientLight) this.ambientLight.intensity = this.baseAmbientIntensity;
          if (this.sunLight) this.sunLight.intensity = this.baseSunIntensity;
          if (this.hemisphereLight) this.hemisphereLight.intensity = this.baseHemisphereIntensity;
          if (this.carrierSpotLight) this.carrierSpotLight.intensity = this.baseCarrierSpotIntensity;
          // خفض تأثير البيئة في النهار (تعتمد على السماء أساساً)
          if (this.scene && this.scene.environment) {
            // لا يوجد intensity للبيئة على المستوى العالمي، لذا نعدّل مواد الحاملة
            if (this.launchPad && typeof this.launchPad.setEnvMapIntensity === 'function') {
              this.launchPad.setEnvMapIntensity(1.0);
            }
          }
        } else {
          this.scene.background = null;
          this.currentBackground = 'none';
          console.log('Sky background disabled (manual).');
          // تشغيل أضواء الحاملة الليلية عند إطفاء ضوء السماء
          if (this.launchPad && typeof this.launchPad.setNightLightsEnabled === 'function') {
            this.launchPad.setNightLightsEnabled(true);
          }
          // تشغيل ضوء القمر
          if (this.moonLight) this.moonLight.visible = true;
          // ضبط شدات إضاءة ليلية تشبه النهار ولكن أضعف
          if (this.ambientLight) this.ambientLight.intensity = this.baseAmbientIntensity * 0.45;
          if (this.sunLight) this.sunLight.intensity = this.baseSunIntensity * 0.35;
          if (this.hemisphereLight) this.hemisphereLight.intensity = this.baseHemisphereIntensity * 0.5;
          // تعزيز إضاءة الحاملة ليلاً لتظهر بوضوح
          if (this.carrierSpotLight) this.carrierSpotLight.intensity = this.baseCarrierSpotIntensity * 2.5;
          // رفع شدة الانعكاسات البيئية ليلاً لتظهر الألوان
          if (this.launchPad && typeof this.launchPad.setEnvMapIntensity === 'function') {
            this.launchPad.setEnvMapIntensity(1.75);
          }
        }
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
      // ✅ حساب الوقت الفعلي المنقضي بين كل إطار (بالثواني)
      const visualDeltaTime = (performance.now() - this.lastFrameTime) / 1000;
      this.lastFrameTime = performance.now();

      // ✅ حساب زمن المحاكاة المنقضي بناءً على عامل السرعة
      const simulationDeltaTime = visualDeltaTime * this.simulationSpeedFactor;

      // ✅ تحديث خلفية السماء بناءً على ارتفاع المكوك
      if (this.spaceShuttle && this.spaceShuttle.model) {
        const altitude = this.spaceShuttle.getAltitude();
        this.updateSkyBackground(altitude);
      }

      if (this.earth) {
        this.earth.update();
      }

      if (this.water) {
        this.water.update();
      }

      if (this.stars) {
        this.stars.update(visualDeltaTime);
      }

      if (this.launchPad && this.earth && this.earth.getObject()) {
        this.launchPad.update(
          this.earth.getObject().rotation.y,
          visualDeltaTime
        );
      }

      if (this.spaceShuttle) {
        // ✅ تمرير زمن المحاكاة المنقضي بدلاً من زمن العرض
        this.spaceShuttle.update(
          simulationDeltaTime,
          this.simulationSpeedFactor
        );
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
