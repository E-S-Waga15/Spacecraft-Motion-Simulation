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

        // ******** متغيرات للعلم الثاني *********
        this.flagGroup2 = new THREE.Group();
        this.flagPole2 = null;
        this.flagMesh2 = null;

        // ******** متغيرات حاملة الطائرات *********
        this.carrierGroup = new THREE.Group();
        this.carrierModel = null;
        this.carrierPosition = new THREE.Vector3();
        this.carrierRotation = 0;

        // ******** متغيرات الطائرات المروحية الثابتة على الحاملة *********
        this.staticHelicopters = [];

        // ******** متغيرات الطائرات المروحية *********
        this.helicopters = [];
        this.helicopterGroup = new THREE.Group();
        this.helicopterModel = null;
        this.helicopterFlightTime = 0;
        this.helicopterPatrolRadius = Units.toProjectUnits(1000); // 1km
        this.helicopterPatrolHeight = Units.toProjectUnits(200); // 200m
        this.helicopterSpeed = Units.toProjectUnits(50); // 50 m/s
        this.helicopterPhaseDuration = 5; // 5 seconds per phase
        this.maxHelicopters = 3;

        // ******** إضاءة ليلية للحاملة *********
        this.nightLightsEnabled = false;
        this.nightLights = [];
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
            
            console.log(`Attempting to load model: ${path}`);
            
            loader.load(
                path,
                (gltf) => {
                    console.log(`Successfully loaded model: ${path}`);
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
                    // تتبع تقدم التحميل
                    const progress = (xhr.loaded / xhr.total) * 100;
                    console.log(`Loading progress for ${path}: ${progress.toFixed(2)}%`);
                },
                (error) => {
                    console.error(`Error loading model ${path}:`, error);
                    console.error(`Full error details:`, {
                        message: error.message,
                        type: error.type,
                        target: error.target
                    });
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

    /**
     * يحمل موديل حاملة الطائرات
     */
    async loadCarrier() {
        try {
            console.log('Starting to load carrier model...');
            
            // محاولة تحميل الموديل مع معالجة أفضل للأخطاء
            this.carrierModel = await this.loadModel('/models/moskva-class-helicopter-cruiser/moskvaclass.glb');
            
            // تحديد موقع حاملة الطائرات
            const carrierDistance = Units.toProjectUnits(-20);
            const carrierAngle = Math.PI/4;
            this.carrierPosition.set(
                70, // على محور X
                0.3, // على سطح البحر
                10 // للخلف على محور Z
            );
            
            this.carrierModel.position.copy(this.carrierPosition);
            this.carrierModel.rotation.y = Math.PI; // تدوير 180 درجة
            
            // تحجيم حاملة الطائرات - تصغير بنسبة 30%
            const carrierBox = new THREE.Box3().setFromObject(this.carrierModel);
            const carrierSize = new THREE.Vector3();
            carrierBox.getSize(carrierSize);
            const baseScale = Units.toProjectUnits(300) / carrierSize.x;
            const finalScale = baseScale * 0.7;
            this.carrierModel.scale.set(finalScale, finalScale, finalScale);
            
            // الاحتفاظ بالمواد الأصلية للمودل - لا تغيير الألوان
            this.carrierModel.traverse((child) => {
                if (child.isMesh) {
                    // إجبار استخدام MeshStandardMaterial مع خصائص PBR لضمان ظهور الألوان
                    let newMaterial;
                    if (child.material && child.material.map) {
                        // إذا كان هناك خريطة، احتفظ بها
                        newMaterial = new THREE.MeshStandardMaterial({
                            map: child.material.map,
                            color: child.material.color || 0x888888,
                            metalness: 0.3,
                            roughness: 0.7,
                            envMapIntensity: 1.0
                        });
                    } else {
                        // مادة افتراضية مع لون رمادي
                        newMaterial = new THREE.MeshStandardMaterial({
                            color: 0x888888,
                            metalness: 0.3,
                            roughness: 0.7,
                            envMapIntensity: 1.0
                        });
                    }
                    
                    child.material = newMaterial;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    console.log(`Carrier mesh: ${child.name || 'unnamed'} - PBR material applied`);
                }
            });



            // ******** البحث عن مواقع الطائرات المروحية الأصلية في موديل الحاملة *********
            console.log('=== Searching for original helicopter positions in carrier model ===');
            const originalHelicopterPositions = [];
            
            this.carrierModel.traverse((child) => {
                if (child.name) {
                    console.log(`Object name: ${child.name}, Position: (${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);
                    
                    // البحث عن الطائرات المروحية الأصلية في الموديل
                    if (child.name.toLowerCase().includes('helicopter') || 
                        child.name.toLowerCase().includes('helo') ||
                        child.name.toLowerCase().includes('chopper') ||
                        child.name.toLowerCase().includes('rotor') ||
                        child.name.toLowerCase().includes('blade') ||
                        child.name.toLowerCase().includes('aircraft')) {
                        
                        originalHelicopterPositions.push({
                            name: child.name,
                            position: child.position.clone(),
                            rotation: child.rotation.clone(),
                            scale: child.scale.clone()
                        });
                        
                        console.log(`Found original helicopter: ${child.name}`);
                        console.log(`  Position: (${child.position.x.toFixed(2)}, ${child.position.y.toFixed(2)}, ${child.position.z.toFixed(2)})`);
                        console.log(`  Rotation: (${child.rotation.x.toFixed(2)}, ${child.rotation.y.toFixed(2)}, ${child.rotation.z.toFixed(2)})`);
                        
                        // إخفاء الطائرة المروحية الأصلية
                        child.visible = false;
                    }
                }
            });
            console.log('=== End of carrier model objects ===');

            // ******** تحميل الطائرات المروحية من موديل helicoptercruiser.glb ووضعها في المواقع الأصلية *********
            if (originalHelicopterPositions.length > 0) {
                try {
                    console.log('Loading helicopters from helicoptercruiser.glb...');
                    const helicopterModel = await this.loadModel('/models/moskva-class-helicopter-cruiser/helicoptercruiser.glb');
                    
                    // تحجيم الطائرة المروحية لتناسب الحاملة
                    const helicopterBox = new THREE.Box3().setFromObject(helicopterModel);
                    const helicopterSize = new THREE.Vector3();
                    helicopterBox.getSize(helicopterSize);
                    
                    // تحجيم الطائرة المروحية لتناسب حجم الحاملة مع زيادة 30%
                    const baseHelicopterScale = Units.toProjectUnits(15) / helicopterSize.x; // 15 متر طول
                    const helicopterScale = baseHelicopterScale * 1.3; // زيادة 30%
                    helicopterModel.scale.set(helicopterScale, helicopterScale, helicopterScale);
                    
                    // إنشاء طائرات مروحية جديدة في المواقع الأصلية
                    originalHelicopterPositions.forEach((originalPos, index) => {
                        const newHelicopter = helicopterModel.clone();
                        
                        // وضع الطائرة المروحية في الموقع الأصلي
                        newHelicopter.position.copy(originalPos.position);
                        newHelicopter.rotation.copy(originalPos.rotation);
                        newHelicopter.scale.copy(originalPos.scale);

                        // تدوير الطائرة المروحية 30 درجة نحو اليسار (حول محور Y)
                        newHelicopter.rotation.y += THREE.MathUtils.degToRad(30);

                        // الاحتفاظ بالمواد الأصلية للطائرة المروحية - لا تغيير الألوان
                        newHelicopter.traverse((child) => {
                            if (child.isMesh) {
                                // الاحتفاظ بالمادة الأصلية إذا كانت موجودة
                                if (child.material) {
                                    // التأكد من أن المادة مرئية فقط
                                    child.material.transparent = false;
                                    child.material.opacity = 1.0;
                                    child.material.needsUpdate = true;
                                    
                                    // إضافة خصائص إضافية لتحسين الرؤية
                                    if (child.material.map) {
                                        child.material.map.colorSpace = THREE.SRGBColorSpace;
                                        child.material.map.needsUpdate = true;
                                    }
                                }
                                
                                child.castShadow = true;
                                child.receiveShadow = true;
                                
                                console.log(`Helicopter mesh: ${child.name || 'unnamed'} - Original material preserved`);
                            }
                        });
                        
                        this.carrierGroup.add(newHelicopter);
                        this.staticHelicopters.push(newHelicopter);
                        
                        console.log(`Helicopter ${index + 1} placed at original position: ${originalPos.name}`);
                        console.log(`  Position: (${originalPos.position.x.toFixed(2)}, ${originalPos.position.y.toFixed(2)}, ${originalPos.position.z.toFixed(2)})`);
                    });
                    
                    console.log(`Successfully placed ${originalHelicopterPositions.length} helicopters at their original positions.`);
                    console.log(`Helicopter scale: ${helicopterScale.toFixed(3)}`);
                    
                } catch (helicopterError) {
                    console.error('Error loading helicopters from helicoptercruiser.glb:', helicopterError);
                    console.warn('Helicopters failed to load, continuing without them...');
                }
            } else {
                console.log('No original helicopter positions found in carrier model.');
                
                // إذا لم يتم العثور على مواقع أصلية، استخدم مواقع افتراضية
                try {
                    console.log('Using default helicopter positions...');
                    const helicopterModel = await this.loadModel('/models/moskva-class-helicopter-cruiser/helicoptercruiser.glb');
                    
                    // تحجيم الطائرة المروحية مع زيادة 30%
                    const helicopterBox = new THREE.Box3().setFromObject(helicopterModel);
                    const helicopterSize = new THREE.Vector3();
                    helicopterBox.getSize(helicopterSize);
                    const baseHelicopterScale = Units.toProjectUnits(15) / helicopterSize.x;
                    const helicopterScale = baseHelicopterScale * 1.65; // زيادة 30%
                    helicopterModel.scale.set(helicopterScale, helicopterScale, helicopterScale);
                    
                    // مواقع افتراضية على سطح الحاملة
                    const defaultPositions = [
                        { x: 130, y: 40, z: 45 },
                       
                    ];
                    
                    defaultPositions.forEach((pos, index) => {
                        const newHelicopter = helicopterModel.clone();
                        newHelicopter.position.set(
                            Units.toProjectUnits(pos.x),
                            Units.toProjectUnits(pos.y),
                            Units.toProjectUnits(pos.z)
                        );
                        newHelicopter.rotation.y = Math.PI;

                        // تدوير الطائرة المروحية 30 درجة نحو اليسار (حول محور Y)
                        newHelicopter.rotation.y += THREE.MathUtils.degToRad(30);

                        // الاحتفاظ بالمواد الأصلية للطائرة المروحية - لا تغيير الألوان
                        newHelicopter.traverse((child) => {
                            if (child.isMesh) {
                                // الاحتفاظ بالمادة الأصلية إذا كانت موجودة
                                if (child.material) {
                                    // التأكد من أن المادة مرئية فقط
                                    child.material.transparent = false;
                                    child.material.opacity = 1.0;
                                    child.material.needsUpdate = true;
                                    
                                    // إضافة خصائص إضافية لتحسين الرؤية
                                    if (child.material.map) {
                                        child.material.map.colorSpace = THREE.SRGBColorSpace;
                                        child.material.map.needsUpdate = true;
                                    }
                                }
                                
                                child.castShadow = true;
                                child.receiveShadow = true;
                                
                                console.log(`Helicopter mesh: ${child.name || 'unnamed'} - Original material preserved`);
                            }
                        });
                        
                        this.carrierGroup.add(newHelicopter);
                        this.staticHelicopters.push(newHelicopter);
                        
                        console.log(`Helicopter ${index + 1} placed at default position: (${pos.x}, ${pos.y}, ${pos.z})`);
                    });
                    
                    console.log('Helicopters placed at default positions successfully.');
                    
                } catch (helicopterError) {
                    console.error('Error loading helicopters with default positions:', helicopterError);
                }
            }
            
            this.carrierGroup.add(this.carrierModel);
            this.group.add(this.carrierGroup);
            
            // أضف أضواء كاشفة فوق سطح الحاملة مثل أضواء القاعدة
            try {
                this.addCarrierDeckLights();
            } catch (e) {
                console.warn('Failed to add carrier deck lights:', e);
            }

            console.log('Carrier loaded with original colors and positioned successfully.');
            console.log(`Carrier scale: ${finalScale.toFixed(3)}`);
            console.log(`Carrier position: ${this.carrierPosition.x.toFixed(2)}, ${this.carrierPosition.y.toFixed(2)}, ${this.carrierPosition.z.toFixed(2)}`);
            return this.carrierModel;
        } catch (error) {
            console.error('Error loading carrier model:', error);
            console.warn('Carrier model failed to load, continuing without it...');
            return null;
        }
    }

    /**
     * يضبط شدة الخريطة البيئية على جميع خامات الحاملة
     */
    setEnvMapIntensity(intensity) {
        if (!this.carrierModel) return;
        console.log(`Setting carrier envMapIntensity to: ${intensity}`);
        this.carrierModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = intensity;
                child.material.needsUpdate = true;
                console.log(`Updated material for mesh: ${child.name || 'unnamed'}, envMapIntensity: ${child.material.envMapIntensity}`);
            }
        });
    }

    /**
     * يضيف أضواء كاشفة فوق سطح الحاملة مشابهة لأضواء القاعدة
     */
    addCarrierDeckLights() {
        if (!this.carrierModel || !this.carrierGroup) return;

        const bbox = new THREE.Box3().setFromObject(this.carrierModel);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bbox.getSize(size);
        bbox.getCenter(center);

        const deckY = bbox.min.y + size.y * 0.9;
        const heightOffset = Units.toProjectUnits(20);

        // أربع نقاط فوق زوايا المدرج، موجهة للأسفل نحو السطح
        const cornerPositions = [
            new THREE.Vector3(bbox.min.x + size.x * 0.15, deckY + heightOffset, center.z - size.z * 0.35),
            new THREE.Vector3(bbox.min.x + size.x * 0.15, deckY + heightOffset, center.z + size.z * 0.35),
            new THREE.Vector3(bbox.max.x - size.x * 0.15, deckY + heightOffset, center.z - size.z * 0.35),
            new THREE.Vector3(bbox.max.x - size.x * 0.15, deckY + heightOffset, center.z + size.z * 0.35),
        ];

        const lightsGroup = new THREE.Group();
        lightsGroup.name = 'CarrierDeckSpotlights';

        cornerPositions.forEach((pos) => {
            const spot = new THREE.SpotLight(0xfff2cc, 12.0, 0, THREE.MathUtils.degToRad(38), 0.35);
            spot.position.copy(pos);
            spot.castShadow = true;
            spot.shadow.mapSize.width = 1024;
            spot.shadow.mapSize.height = 1024;
            spot.shadow.bias = -0.00015;
            spot.decay = 1.0;

            const target = new THREE.Object3D();
            target.position.set(pos.x, deckY, pos.z);
            lightsGroup.add(target);
            spot.target = target;

            lightsGroup.add(spot);
        });

        // كشاف غامر قوي فوق مركز الحاملة لضمان ظهور الإضاءة دائماً
        const flood = new THREE.PointLight(0xffffff, 120.0, 0);
        flood.position.set(center.x, deckY + Units.toProjectUnits(60), center.z);
        flood.castShadow = true;
        flood.shadow.mapSize.width = 1024;
        flood.shadow.mapSize.height = 1024;
        flood.shadow.bias = -0.0002;
        lightsGroup.add(flood);

        this.carrierGroup.add(lightsGroup);
    }

    /**
     * ينشئ أضواء ليلية على سطح الحاملة
     */
    createCarrierNightLights() {
        if (!this.carrierModel || this.nightLights.length > 0) return;

        const lightsGroup = new THREE.Group();
        lightsGroup.name = 'CarrierNightLights';

        // احصل على صندوق يحيط بالحاملة لتحديد أماكن منطقية للأضواء
        const bbox = new THREE.Box3().setFromObject(this.carrierModel);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        bbox.getSize(size);
        bbox.getCenter(center);

        // ارتفاع سطح التقريب
        const deckHeight = bbox.max.y - (size.y * 0.75);

        // نقاط تقريبة على أطراف سطح الحاملة لوضع الأضواء
        const positions = [
            new THREE.Vector3(bbox.min.x + size.x * 0.15, deckHeight, center.z - size.z * 0.35),
            new THREE.Vector3(bbox.min.x + size.x * 0.15, deckHeight, center.z + size.z * 0.35),
            new THREE.Vector3(bbox.max.x - size.x * 0.15, deckHeight, center.z - size.z * 0.35),
            new THREE.Vector3(bbox.max.x - size.x * 0.15, deckHeight, center.z + size.z * 0.35),
            // أضواء إضافية على منتصف المدرج
            new THREE.Vector3(center.x, deckHeight, center.z - size.z * 0.25),
            new THREE.Vector3(center.x, deckHeight, center.z + size.z * 0.25),
        ];

        positions.forEach((pos, idx) => {
            const point = new THREE.PointLight(0x99ccff, 1.5, Units.toProjectUnits(800));
            point.position.copy(pos);
            point.castShadow = false;
            lightsGroup.add(point);

            // وهج بسيط مرئي (اختياري)
            const bulbGeom = new THREE.SphereGeometry(Units.toProjectUnits(0.2), 8, 8);
            const bulbMat = new THREE.MeshBasicMaterial({ color: 0x99ccff });
            const bulb = new THREE.Mesh(bulbGeom, bulbMat);
            bulb.position.copy(pos);
            lightsGroup.add(bulb);

            this.nightLights.push(point);
        });

        // كشاف عند مقدمة الحاملة
        const bowSpot = new THREE.SpotLight(0xffffff, 2.0, Units.toProjectUnits(2000), THREE.MathUtils.degToRad(25), 0.3);
        bowSpot.position.set(bbox.max.x, deckHeight + Units.toProjectUnits(3), center.z);
        bowSpot.target.position.set(bbox.max.x + Units.toProjectUnits(15), deckHeight, center.z);
        bowSpot.castShadow = true;
        lightsGroup.add(bowSpot);
        lightsGroup.add(bowSpot.target);
        this.nightLights.push(bowSpot);

        this.carrierGroup.add(lightsGroup);
    }

    /**
     * تفعيل/تعطيل أضواء الحاملة الليلية
     * @param {boolean} enabled
     */
    setNightLightsEnabled(enabled) {
        this.nightLightsEnabled = enabled;
        if (!this.carrierGroup) return;
        if (enabled) {
            if (this.nightLights.length === 0) {
                this.createCarrierNightLights();
            }
        }

        // تبديل الرؤية لمجموعة الأضواء إن وُجدت
        const lightsGroup = this.carrierGroup.getObjectByName('CarrierNightLights');
        if (lightsGroup) {
            lightsGroup.visible = !!enabled;
        }
        // بعض الأضواء قد لا تكون ضمن المجموعة (حالة أمان)
        this.nightLights.forEach((l) => {
            l.visible = !!enabled;
        });
    }



    /**
     * يطبق النسيج على حاملة الطائرات
     */
    async applyCarrierTextures(carrierModel) {
        const textureLoader = new THREE.TextureLoader();
        
        try {
            // تحميل النسيج الأساسي للحاملة
            const baseTexture = await textureLoader.loadAsync('/models/moskva-class-helicopter-cruiser/textures/base.png');
            baseTexture.colorSpace = THREE.SRGBColorSpace;
            
            // تحميل نسيج العادي (normal map)
            const normalTexture = await textureLoader.loadAsync('/models/moskva-class-helicopter-cruiser/textures/normal.png');
            
            // تحميل نسيج الخشونة (roughness map)
            const roughnessTexture = await textureLoader.loadAsync('/models/moskva-class-helicopter-cruiser/textures/roughness.png');
            
            // تحميل نسيج المعدنية (metallic map)
            const metallicTexture = await textureLoader.loadAsync('/models/moskva-class-helicopter-cruiser/textures/metallic.png');
            
            carrierModel.traverse((child) => {
                if (child.isMesh) {
                    // إنشاء مادة جديدة مع النسيج
                    const material = new THREE.MeshStandardMaterial({
                        map: baseTexture,
                        normalMap: normalTexture,
                        roughnessMap: roughnessTexture,
                        metalnessMap: metallicTexture,
                        metalness: 0.5,
                        roughness: 0.8,
                        transparent: false,
                        opacity: 1.0
                    });
                    
                    child.material = material;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    console.log(`Applied textures to carrier mesh: ${child.name || 'unnamed'}`);
                }
            });
            
            console.log('Carrier textures applied successfully.');
        } catch (error) {
            console.error('Error loading carrier textures:', error);
            
            // إذا فشل تحميل النسيج، استخدم لون افتراضي
            carrierModel.traverse((child) => {
                if (child.isMesh) {
                    const material = new THREE.MeshStandardMaterial({
                        color: 0x4a4a4a,
                        metalness: 0.3,
                        roughness: 0.7,
                        transparent: false,
                        opacity: 1.0
                    });
                    
                    child.material = material;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    console.log(`Applied fallback material to carrier mesh: ${child.name || 'unnamed'}`);
                }
            });
        }
    }

    /**
     * يحمل موديل الطائرة المروحية
     */
    async loadHelicopter() {
        try {
            this.helicopterModel = await this.loadModel('/models/moskva-class-helicopter-cruiser/helicoptercruiser.glb');
            
            // تحجيم الطائرة المروحية
            const helicopterBox = new THREE.Box3().setFromObject(this.helicopterModel);
            const helicopterSize = new THREE.Vector3();
            helicopterBox.getSize(helicopterSize);
            const helicopterScale = Units.toProjectUnits(20) / helicopterSize.x;
            this.helicopterModel.scale.set(helicopterScale, helicopterScale, helicopterScale);
            
            // تحميل النسيج وتطبيقه على الطائرة المروحية
            await this.applyHelicopterTextures(this.helicopterModel);
            
            console.log('Helicopter model loaded with textures successfully.');
            return this.helicopterModel;
        } catch (error) {
            console.error('Error loading helicopter model:', error);
            return null;
        }
    }

    /**
     * يطبق النسيج على الطائرة المروحية
     */
    async applyHelicopterTextures(helicopterModel) {
        const textureLoader = new THREE.TextureLoader();
        
        try {
            // تحميل النسيج الأساسي للطائرة المروحية
            const baseTexture = await textureLoader.loadAsync('/models/moskva-class-helicopter-cruiser/textures/helicopter_base.png');
            baseTexture.colorSpace = THREE.SRGBColorSpace;
            
            // تحميل نسيج العادي للطائرة المروحية
            const normalTexture = await textureLoader.loadAsync('/models/moskva-class-helicopter-cruiser/textures/helicopter_normal.png');
            
            helicopterModel.traverse((child) => {
                if (child.isMesh) {
                    // إنشاء مادة جديدة مع النسيج
                    const material = new THREE.MeshStandardMaterial({
                        map: baseTexture,
                        normalMap: normalTexture,
                        metalness: 0.2,
                        roughness: 0.8,
                        transparent: false,
                        opacity: 1.0
                    });
                    
                    child.material = material;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    console.log(`Applied textures to helicopter mesh: ${child.name || 'unnamed'}`);
                }
            });
            
            console.log('Helicopter textures applied successfully.');
        } catch (error) {
            console.error('Error loading helicopter textures:', error);
            
            // إذا فشل تحميل النسيج، استخدم لون افتراضي
            helicopterModel.traverse((child) => {
                if (child.isMesh) {
                    const material = new THREE.MeshStandardMaterial({
                        color: 0x2a2a2a,
                        metalness: 0.2,
                        roughness: 0.8,
                        transparent: false,
                        opacity: 1.0
                    });
                    
                    child.material = material;
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    console.log(`Applied fallback material to helicopter mesh: ${child.name || 'unnamed'}`);
                }
            });
        }
    }

    /**
     * ينشئ طائرة مروحية جديدة
     */
    createHelicopter() {
        if (!this.helicopterModel) {
            console.error('Helicopter model not loaded yet!');
            return null;
        }
        
        const helicopter = this.helicopterModel.clone();
        helicopter.userData = {
            phase: 'patrol',
            phaseTime: 0,
            startPosition: new THREE.Vector3(),
            targetPosition: new THREE.Vector3(),
            currentPosition: new THREE.Vector3(),
            patrolAngle: Math.random() * Math.PI * 2,
            speed: this.helicopterSpeed
        };
        
        // تحديد موقع البداية (على سطح الحاملة)
        const carrierDeckHeight = Units.toProjectUnits(10);
        const patrolRadius = Units.toProjectUnits(35);
        
        helicopter.userData.currentPosition.set(
            this.carrierPosition.x + patrolRadius * Math.cos(helicopter.userData.patrolAngle),
            this.carrierPosition.y + carrierDeckHeight,
            this.carrierPosition.z + patrolRadius * Math.sin(helicopter.userData.patrolAngle)
        );
        
        helicopter.position.copy(helicopter.userData.currentPosition);
        helicopter.userData.startPosition.copy(helicopter.userData.currentPosition);
        
        // إصلاح مشكلة اللون الأسود للطائرات المروحية
        helicopter.traverse((child) => {
            if (child.isMesh) {
                // إنشاء مادة جديدة تماماً مع إضاءة محسنة
                const newMaterial = new THREE.MeshStandardMaterial({ 
                    color: 0x2a2a2a, // لون رمادي داكن للطائرات المروحية
                    metalness: 0.2,
                    roughness: 0.8,
                    transparent: false,
                    opacity: 1.0,
                    emissive: 0x111111, // إضافة توهج خفيف
                    emissiveIntensity: 0.1
                });
                
                child.material = newMaterial;
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        this.helicopterGroup.add(helicopter);
        this.helicopters.push(helicopter);
        
        console.log('Helicopter created and positioned on carrier deck.');
        console.log(`Helicopter position: ${helicopter.position.x.toFixed(2)}, ${helicopter.position.y.toFixed(2)}, ${helicopter.position.z.toFixed(2)}`);
        console.log(`Total helicopters: ${this.helicopters.length}`);
        return helicopter;
    }

    /**
     * يحدث حركة الطائرات المروحية
     */
    updateHelicopters(deltaTime) {
        this.helicopterFlightTime += deltaTime;
        
        // إنشاء طائرة مروحية جديدة كل 10 ثوانٍ إذا لم نصل للحد الأقصى
        if (this.helicopters.length < this.maxHelicopters && this.helicopterFlightTime > 10) {
            this.createHelicopter();
            this.helicopterFlightTime = 0;
            console.log(`Created helicopter. Total helicopters: ${this.helicopters.length}`);
        }
        
        // تحديث كل طائرة مروحية
        this.helicopters.forEach((helicopter, index) => {
            const userData = helicopter.userData;
            userData.phaseTime += deltaTime;
            
            switch (userData.phase) {
                case 'patrol':
                    this.updateHelicopterPatrol(helicopter, deltaTime);
                    break;
                case 'approach':
                    this.updateHelicopterApproach(helicopter, deltaTime);
                    break;
                case 'return':
                    this.updateHelicopterReturn(helicopter, deltaTime);
                    break;
            }
            
            // تغيير المرحلة كل 5 ثوانٍ
            if (userData.phaseTime >= this.helicopterPhaseDuration) {
                this.changeHelicopterPhase(helicopter);
                userData.phaseTime = 0;
            }
        });
    }

    /**
     * يحدث حركة الطائرة المروحية في مرحلة الدوريات
     */
    updateHelicopterPatrol(helicopter, deltaTime) {
        const userData = helicopter.userData;
        const carrierDeckHeight = Units.toProjectUnits(10); // ارتفاع سطح الحاملة (مصغر)
        const patrolRadius = Units.toProjectUnits(35); // نصف قطر أصغر للدوران على سطح الحاملة
        
        // دوران حول مركز الحاملة على سطحها
        userData.patrolAngle += 0.3 * deltaTime; // سرعة دوران أبطأ
        
        const newX = this.carrierPosition.x + patrolRadius * Math.cos(userData.patrolAngle);
        const newZ = this.carrierPosition.z + patrolRadius * Math.sin(userData.patrolAngle);
        
        userData.currentPosition.set(newX, this.carrierPosition.y + carrierDeckHeight, newZ);
        helicopter.position.copy(userData.currentPosition);
        
        // توجيه الطائرة المروحية في اتجاه الحركة
        const direction = new THREE.Vector3(
            -Math.sin(userData.patrolAngle),
            0,
            Math.cos(userData.patrolAngle)
        );
        helicopter.lookAt(helicopter.position.clone().add(direction));
    }

    /**
     * يحدث حركة الطائرة المروحية في مرحلة الاقتراب
     */
    updateHelicopterApproach(helicopter, deltaTime) {
        const userData = helicopter.userData;
        const launchPadPosition = new THREE.Vector3(0, this.helicopterPatrolHeight, 0);
        
        // التحرك نحو قاعدة الإطلاق مع الارتفاع تدريجياً
        const direction = launchPadPosition.clone().sub(userData.currentPosition).normalize();
        const movement = direction.multiplyScalar(userData.speed * deltaTime);
        
        userData.currentPosition.add(movement);
        helicopter.position.copy(userData.currentPosition);
        
        // توجيه الطائرة المروحية نحو قاعدة الإطلاق
        helicopter.lookAt(launchPadPosition);
    }

    /**
     * يحدث حركة الطائرة المروحية في مرحلة العودة
     */
    updateHelicopterReturn(helicopter, deltaTime) {
        const userData = helicopter.userData;
        const carrierDeckHeight = Units.toProjectUnits(10); // ارتفاع سطح الحاملة (مصغر)
        
        // العودة إلى موقع البداية على سطح الحاملة
        const returnPosition = new THREE.Vector3(
            userData.startPosition.x,
            this.carrierPosition.y + carrierDeckHeight,
            userData.startPosition.z
        );
        
        const direction = returnPosition.clone().sub(userData.currentPosition).normalize();
        const movement = direction.multiplyScalar(userData.speed * deltaTime);
        
        userData.currentPosition.add(movement);
        helicopter.position.copy(userData.currentPosition);
        
        // توجيه الطائرة المروحية نحو موقع البداية
        helicopter.lookAt(returnPosition);
    }

    /**
     * يغير مرحلة الطائرة المروحية
     */
    changeHelicopterPhase(helicopter) {
        const userData = helicopter.userData;
        
        switch (userData.phase) {
            case 'patrol':
                userData.phase = 'approach';
                userData.targetPosition.set(0, this.helicopterPatrolHeight, 0); // قاعدة الإطلاق
                break;
            case 'approach':
                userData.phase = 'return';
                userData.targetPosition.copy(userData.startPosition);
                break;
            case 'return':
                userData.phase = 'patrol';
                break;
        }
        
        console.log(`Helicopter phase changed to: ${userData.phase}`);
    }

    async load() {
        try {
            console.log('Starting to load launch pad components...');
            
            // --- تحميل موديل منصة الإطلاق الرئيسي (launch_site.glb) ---
            console.log('Loading main launch pad model...');
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
            console.log('Main launch pad model loaded successfully');

            // --- تحميل موديل البرج (launch_site4.glb) ---
            console.log('Loading tower model...');
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
            console.log('Tower model loaded and positioned successfully');

            // ******** تخزين الموضع الأولي للبرج *********
            this.initialTowerPosition.copy(this.towerGroup.position);
            // *************************************************

            // --- تحديد موضع الـ group الكامل لمنصة الإطلاق على سطح الأرض ---
            const radius = this.earth.getRadius();
            const mainPadLoweringAmountProjectUnits = Units.toProjectUnits(5);

            this.group.position.set(0, radius + mainPadBaseOffset - mainPadLoweringAmountProjectUnits, 0);

            // ******** تحميل حاملة الطائرات (مع معالجة الأخطاء) *********
            console.log('Attempting to load carrier...');
            try {
                await this.loadCarrier();
            } catch (carrierError) {
                console.warn('Carrier failed to load, continuing without it:', carrierError);
            }

            // ******** تحميل العلم الأول *********
            console.log('Loading first flag...');
            try {
                await this.createFlag(-17.5, 43, -22.15, false);
            } catch (flagError) {
                console.warn('First flag failed to load:', flagError);
            }

            // ******** تحميل العلم الثاني *********
            console.log('Loading second flag...');
            try {
                await this.createFlag(21.6, 43, 39, true);
            } catch (flagError) {
                console.warn('Second flag failed to load:', flagError);
            }

            console.log('Launch pad components loaded successfully.');
            console.log(`    Main Pad Height after scale: ${(mainPadSize.y / Units.UNIT_SCALE_FACTOR).toFixed(2)} meters`);
            console.log(`    Tower Height after scale: ${(towerHeightAfterScale / Units.UNIT_SCALE_FACTOR).toFixed(2)} meters`);
            console.log(`    Launch Pad Group Position (Y): ${(this.group.position.y / Units.UNIT_SCALE_FACTOR).toFixed(2)} meters (from scene origin)`);

            return this.group;
        } catch (error) {
            console.error('Error loading launch pad models:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            // إرجاع المجموعة حتى لو فشل تحميل بعض المكونات
            return this.group;
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

        // ******** تحديث حركة الطائرات المروحية *********
        if (this.helicopters.length > 0) {
            this.updateHelicopters(deltaTime);
        }

        // ******** تحديث الطائرات المروحية الثابتة مع دوران الحاملة *********
        if (this.staticHelicopters.length > 0) {
            this.staticHelicopters.forEach((helicopter, index) => {
                // الطائرات المروحية تدور مع الحاملة تلقائياً لأنها جزء من carrierGroup
                // يمكن إضافة حركات إضافية هنا إذا لزم الأمر
            });
        }
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