import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Units } from '../utils/Units';

export class LaunchPad {
    constructor(earth) {
        this.earth = earth;
        this.group = new THREE.Group();
        this.mainPadModel = null;
        this.towerGroup = new THREE.Group();
        this.towerModel = null;
        this.currentTowerTilt = 0;
        this.targetTowerTilt = 0;
        this.isTilting = false;
        this.tiltSpeed = 1.5;

        this.initialTowerPosition = new THREE.Vector3();
        this.targetTowerOffsetY = 0;
        this.targetTowerOffsetZ = 0;

        // ******** متغيرات للعلم الأول *********
        this.flagGroup = new THREE.Group(); 
        this.flagPole = null;
        this.flagMesh = null;
        this.flagTexture = null;

        // ******** جديد: متغيرات للعلم الثاني *********
        this.flagGroup2 = new THREE.Group(); // مجموعة للعلم والسارية الثانية
        this.flagPole2 = null;
        this.flagMesh2 = null;
        // لن نحتاج لـ flagTexture2 إذا كان نفس العلم يستخدم نفس الصورة
        // ********************************************
    }

    /**
     * يحمل موديل GLTF.
     * @param {string} path - المسار إلى ملف الموديل GLB/GLTF.
     * @param {THREE.Vector3} [position=new THREE.Vector3()] - الموضع الأولي.
     * @param {THREE.Euler} [rotation=new THREE.Euler()] - الدوران الأولي.
     * @param {number} [scale=1] - عامل القياس الأولي.
     * @returns {Promise<THREE.Object3D>} - وعد يعود بالموديل المحمل.
     */
    loadModel(path, position = new THREE.Vector3(), rotation = new THREE.Euler(), scale = 1) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    model.position.copy(position);
                    model.rotation.copy(rotation);
                    model.scale.set(scale, scale, scale);
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    resolve(model);
                },
                (xhr) => {
                    // يمكنك استخدام هذا لتتبع تقدم التحميل إذا أردت
                },
                (error) => {
                    console.error(`Error loading model ${path}:`, error);
                    reject(error);
                }
            );
        });
    }

    // ******** دالة لتحميل العلم وإنشائه (تم تعديلها لتصبح أكثر عمومية) *********
    async createFlag(offsetX, offsetY, offsetZ, isSecondFlag = false) {
        // 1. تحميل صورة العلم (تُحمّل مرة واحدة فقط)
        if (!this.flagTexture) { // حمل الصورة فقط إذا لم تكن محملة بعد
            const textureLoader = new THREE.TextureLoader();
            try {
                this.flagTexture = await textureLoader.loadAsync('/texture/Flag_of_Syria.png');
                this.flagTexture.colorSpace = THREE.SRGBColorSpace;
            } catch (error) {
                console.error('Error loading flag texture:', error);
                return null;
            }
        }

        const scaleMultiplier = 2.5;
        const poleHeightMeters = (15 / 2) ;
        const poleRadiusMeters = 0.05 * scaleMultiplier;

        const poleHeightProjectUnits = Units.toProjectUnits(poleHeightMeters);
        const poleRadiusProjectUnits = Units.toProjectUnits(poleRadiusMeters);

        const poleGeometry = new THREE.CylinderGeometry(poleRadiusProjectUnits, poleRadiusProjectUnits, poleHeightProjectUnits, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });

        let currentFlagPole, currentFlagMesh, currentFlagGroup;

        if (isSecondFlag) {
            currentFlagPole = new THREE.Mesh(poleGeometry, poleMaterial);
            currentFlagMesh = new THREE.Mesh(); // ستتم تهيئتها لاحقًا
            currentFlagGroup = this.flagGroup2; // استخدم المجموعة الثانية
            this.flagPole2 = currentFlagPole;
            this.flagMesh2 = currentFlagMesh;
        } else {
            currentFlagPole = new THREE.Mesh(poleGeometry, poleMaterial);
            currentFlagMesh = new THREE.Mesh(); // ستتم تهيئتها لاحقًا
            currentFlagGroup = this.flagGroup; // استخدم المجموعة الأولى
            this.flagPole = currentFlagPole;
            this.flagMesh = currentFlagMesh;
        }

        currentFlagPole.castShadow = true;
        currentFlagPole.receiveShadow = true;
        currentFlagPole.position.y = poleHeightProjectUnits / 2;
        currentFlagGroup.add(currentFlagPole);

        const flagWidthMeters = 3 * scaleMultiplier;
        const flagHeightMeters = 2 * scaleMultiplier;
        const flagWidthProjectUnits = Units.toProjectUnits(flagWidthMeters);
        const flagHeightProjectUnits = Units.toProjectUnits(flagHeightMeters);

        const segmentsX = 2;
        const segmentsY = 2;

        const flagGeometry = new THREE.PlaneGeometry(flagWidthProjectUnits, flagHeightProjectUnits, segmentsX, segmentsY);
        const flagMaterial = new THREE.MeshStandardMaterial({
            map: this.flagTexture,
            side: THREE.DoubleSide
        });
        currentFlagMesh.geometry = flagGeometry; // تعيين الهندسة
        currentFlagMesh.material = flagMaterial; // تعيين المادة
        currentFlagMesh.castShadow = true;
        currentFlagMesh.receiveShadow = true;

       // Apply the rotation
       const flagRotationAngle = -Math.PI / 3; // -60 degrees
       currentFlagMesh.rotation.y = flagRotationAngle; 

       const halfFlagWidth = flagWidthProjectUnits / 2;
       const rotatedXOffset = -halfFlagWidth * Math.cos(flagRotationAngle);
       const rotatedZOffset = -halfFlagWidth * Math.sin(flagRotationAngle);
        currentFlagMesh.position.set(
            rotatedXOffset+0.015,
            poleHeightProjectUnits - (flagHeightProjectUnits / 2),
            (-flagWidthProjectUnits / 2)+0.02
        );
        
        currentFlagGroup.add(currentFlagMesh);

        currentFlagGroup.position.set(
            Units.toProjectUnits(offsetX),
            Units.toProjectUnits(offsetY),
            Units.toProjectUnits(offsetZ)
        );

        this.group.add(currentFlagGroup);
        console.log(`Flag ${isSecondFlag ? 'Two' : 'One'} loaded and positioned.`);
        return currentFlagGroup;
    }

    async load() {
        try {
            // --- تحميل موديل منصة الإطلاق الرئيسي (launch_site.glb) ---
            this.mainPadModel = await this.loadModel('/models/rocket_laucher_pad/launch_site.glb');

            const mainPadTargetHeightMeters = 55;
            const mainPadTargetHeightProjectUnits = Units.toProjectUnits(mainPadTargetHeightMeters);

            const mainPadBox = new THREE.Box3().setFromObject(this.mainPadModel);
            const mainPadSize = new THREE.Vector3();
            mainPadBox.getSize(mainPadSize);
            const mainPadCurrentHeight = mainPadSize.y;

            if (mainPadCurrentHeight === 0) {
                console.warn("Main pad model has zero height. Cannot scale properly. Using default scale of 1.");
                this.mainPadModel.scale.set(1, 1, 1);
            } else {
                const scaleFactor = mainPadTargetHeightProjectUnits / mainPadCurrentHeight;
                this.mainPadModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
            }

            const scaledMainPadBox = new THREE.Box3().setFromObject(this.mainPadModel);
            const mainPadBaseOffset = Math.abs(scaledMainPadBox.min.y);

            this.group.add(this.mainPadModel);


            // --- تحميل موديل البرج (launch_site4.glb) ---
            this.towerModel = await this.loadModel('/models/rocket_laucher_pad/launch_site4.glb');

            const towerTargetHeightMeters = 30;
            const towerTargetHeightProjectUnits = Units.toProjectUnits(towerTargetHeightMeters);

            const towerBox = new THREE.Box3().setFromObject(this.towerModel);
            const towerSize = new THREE.Vector3();
            towerBox.getSize(towerSize);
            const towerCurrentHeight = towerSize.y;

            if (towerCurrentHeight === 0) {
                console.warn("Tower model has zero height. Cannot scale properly. Using default scale of 1.");
                this.towerModel.scale.set(1, 1, 1);
            } else {
                const towerScaleFactor = towerTargetHeightProjectUnits / towerCurrentHeight;
                this.towerModel.scale.set(0.08071509030386003, towerScaleFactor, towerScaleFactor);
                console.log('Tower Scale Factor (all axes):', towerScaleFactor);
            }

            // --- إعداد مجموعة البرج (towerGroup) كنقطة ارتكاز ---
            const scaledTowerBox = new THREE.Box3().setFromObject(this.towerModel);
            const towerHeightAfterScale = scaledTowerBox.max.y - scaledTowerBox.min.y;

            // نحرك موديل البرج للأعلى داخل towerGroup بحيث تكون قاعدته عند 0 في محور Y
            this.towerModel.position.y = -scaledTowerBox.min.y;

            this.towerGroup.add(this.towerModel);

            // --- تحديد موضع الـ towerGroup بالنسبة للمنصة الرئيسية (group) ---
            const verticalLoweringAmountProjectUnits = Units.toProjectUnits(43);

            this.towerGroup.position.set(
                Units.toProjectUnits(1.2),
                scaledMainPadBox.max.y - verticalLoweringAmountProjectUnits,
                Units.toProjectUnits(-0.2)
            );

            this.group.add(this.towerGroup);

            // ******** تخزين الموضع الأولي للبرج *********
            this.initialTowerPosition.copy(this.towerGroup.position);
            // *************************************************

            // --- تحديد موضع الـ group الكامل لمنصة الإطلاق على سطح الأرض ---
            const radius = this.earth.getRadius();
            const mainPadLoweringAmountProjectUnits = Units.toProjectUnits(5);

            this.group.position.set(0, radius + mainPadBaseOffset - mainPadLoweringAmountProjectUnits, 0);

            // ******** تحميل العلم الأول *********
            // X = -5, Y = 25, Z = -5
            await this.createFlag(-17.5, 43, -22.15, false);

            // ******** جديد: تحميل العلم الثاني *********
            // X = -5, Y = 25, Z = 10 (مع الاحتفاظ بنفس X و Y)
            await this.createFlag(21.6, 43, 39, true); 
            // ************************************************************

            console.log('Launch pad and tower models loaded successfully.');
            console.log(`    Main Pad Height after scale: ${(mainPadSize.y / Units.UNIT_SCALE_FACTOR).toFixed(2)} meters`);
            console.log(`    Tower Height after scale: ${(towerHeightAfterScale / Units.UNIT_SCALE_FACTOR).toFixed(2)} meters`);
            console.log(`    Launch Pad Group Position (Y): ${(this.group.position.y / Units.UNIT_SCALE_FACTOR).toFixed(2)} meters (from scene origin)`);

            return this.group;
        } catch (error) {
            console.error('Error loading launch pad models:', error);
            return null;
        }
    }

    /**
     * يدور الـ group الكامل لمنصة الإطلاق مع الأرض.
     * @param {number} earthRotationAngle - زاوية دوران الأرض الحالية بالراديان.
     * @param {number} deltaTime - الوقت المنقضي منذ الإطار الأخير بالثواني.
     */
    update(earthRotationAngle, deltaTime) {
        if (this.group) {
            this.group.rotation.y = earthRotationAngle;
        }

        // --- تحديث ميلان البرج (إذا كان في حالة ميلان) ---
        if (this.isTilting) {
            const tiltStep = this.tiltSpeed * deltaTime;

            if (this.currentTowerTilt < this.targetTowerTilt) {
                this.currentTowerTilt = Math.min(this.currentTowerTilt + tiltStep, this.targetTowerTilt);
            }
            else if (this.currentTowerTilt > this.targetTowerTilt) {
                this.currentTowerTilt = Math.max(this.currentTowerTilt - tiltStep, this.targetTowerTilt);
            }

            this.towerGroup.rotation.x = this.currentTowerTilt;

            const progress = Math.abs(this.currentTowerTilt / this.targetTowerTilt);

            const currentOffsetY = THREE.MathUtils.lerp(0, this.targetTowerOffsetY, progress);
            const currentOffsetZ = THREE.MathUtils.lerp(0, this.targetTowerOffsetZ, progress);

            this.towerGroup.position.y = this.initialTowerPosition.y + currentOffsetY;
            this.towerGroup.position.z = this.initialTowerPosition.z + currentOffsetZ;

            if (Math.abs(this.currentTowerTilt - this.targetTowerTilt) < 0.001) {
                this.currentTowerTilt = this.targetTowerTilt;
                this.isTilting = false;
                this.towerGroup.position.y = this.initialTowerPosition.y + this.targetTowerOffsetY;
                this.towerGroup.position.z = this.initialTowerPosition.z + this.targetTowerOffsetZ;
                console.log(`Tower tilt animation finished. Current tilt: ${THREE.MathUtils.radToDeg(this.currentTowerTilt).toFixed(2)} degrees.`);
            }
        }
        // ****************************************
        // لا يوجد تحديث لتموج العلم، حيث تم إيقافه
        // ****************************************
    }

    /**
     * يبدأ عملية ميلان البرج إلى زاوية معينة، مع تحديد إزاحة Y و Z إضافية.
     * @param {number} targetAngleDegrees - الزاوية المستهدفة للميلان بالدرجات.
     * @param {number} [offsetY_Meters=0] - الارتفاع الإضافي الذي يجب أن يصل إليه البرج (بالمتر).
     * @param {number} [offsetZ_Meters=0] - الإزاحة الإضافية على محور Z (بالمتر).
     */
    tiltTower(targetAngleDegrees, offsetY_Meters = 8.5, offsetZ_Meters = 6.1) {
        if (this.towerGroup) {
            this.targetTowerTilt = THREE.MathUtils.degToRad(targetAngleDegrees);
            this.targetTowerOffsetY = Units.toProjectUnits(offsetY_Meters);
            this.targetTowerOffsetZ = Units.toProjectUnits(offsetZ_Meters);
            this.isTilting = true;
            console.log(`Starting tower tilt to ${targetAngleDegrees} degrees with Y offset: ${offsetY_Meters}m, Z offset: ${offsetZ_Meters}m.`);
        } else {
            console.warn("Tower group not loaded or found. Cannot tilt.");
        }
    }
}