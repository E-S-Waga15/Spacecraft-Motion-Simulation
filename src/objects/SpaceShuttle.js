// src/components/SpaceShuttle.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Units } from '../utils/Units';
import { ShuttlePhysics } from '../physics/ShuttlePhysics';
import { ShuttleStages } from '../constants/ShuttleStages';
import { PhysicsConstants } from '../constants/PhysicsConstants';
import { CustomParticleSystem } from '../Effects/CustomParticleFire';
import { CustomParticleSmoke } from '../Effects/CustomParticleSmoke';

export class SpaceShuttle {
    constructor(earth, physics, camera, scene) {
        this.earth = earth;
        this.model = null;
        this.rotationSpeed = 0;

        this.shuttle = null;
        this.fuelTank = null;
        this.rocket1 = null;
        this.rocket2 = null;

        this.physics = physics;
        this.audioListener = null;
        this.camera = camera;
        this.scene = scene;

        this.initialModelPosition = null;
        this.initialModelRotation = new THREE.Euler(-Math.PI / 2, 0, -Math.PI / 2);

        this.mainEngineParticleSystems = [];
        this.srbParticleSystems = [];
        this.smokeParticleSystem = [];

        this.rocketDetachmentAnimation = {
            rocket1: {
                isDetaching: false,
                startTime: 0,
                duration: 3.0,
                startPosition: new THREE.Vector3(),
                startRotation: new THREE.Euler(),
                velocity: new THREE.Vector3(),
                angularVelocity: new THREE.Euler(),
                smokeParticles: []
            },
            rocket2: {
                isDetaching: false,
                startTime: 0,
                duration: 3.0,
                startPosition: new THREE.Vector3(),
                startRotation: new THREE.Euler(),
                velocity: new THREE.Vector3(),
                angularVelocity: new THREE.Euler(),
                smokeParticles: []
            }
        };

        this.fuelTankDetachmentAnimation = {
            isDetaching: false,
            startTime: 0,
            duration: 5.0,
            startPosition: new THREE.Vector3(),
            startRotation: new THREE.Euler(),
            velocity: new THREE.Vector3(),
            angularVelocity: new THREE.Euler(),
            smokeParticles: [],
            explosionParticles: []
        };
        this.detachedParts = [];
        this.gravityConstant = -9.81; // Real-world gravity in m/s^2

        // New: Threshold for removing detached parts (e.g., 2000 meters below shuttle's detachment point)
        this.DETACHED_PART_FALL_THRESHOLD_METERS = 2000;
    }

    setAudioListener(listener) {
        this.audioListener = listener;
    }

    startRocketDetachmentAnimation(rocketName) {
        const animation = this.rocketDetachmentAnimation[rocketName];
        if (!animation || animation.isDetaching) return;

        const rocket = rocketName === 'rocket1' ? this.rocket1 : this.rocket2;
        if (!rocket) return;

        animation.isDetaching = true;
        animation.startTime = this.physics.time;
        animation.startPosition.copy(rocket.position);
        animation.startRotation.copy(rocket.rotation);

        const rocketIndex = rocketName === 'rocket1' ? -1 : 1;
        animation.velocity.set(
            rocketIndex * (15 + Math.random() * 10),
            -20 - Math.random() * 15,
            (Math.random() - 0.5) * 10
        );

        animation.angularVelocity.set(
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 2,
            rocketIndex * (1 + Math.random())
        );

        console.log(`Starting detachment animation for ${rocketName} with velocity:`, animation.velocity);
    }

    startFuelTankDetachmentAnimation() {
        const animation = this.fuelTankDetachmentAnimation;
        if (!animation || animation.isDetaching) return;

        if (!this.fuelTank) return;

        animation.isDetaching = true;
        animation.startTime = this.physics.time;
        animation.startPosition.copy(this.fuelTank.position);
        animation.startRotation.copy(this.fuelTank.rotation);

        animation.velocity.set(
            (Math.random() - 0.5) * 20,
            -25 - Math.random() * 15,
            (Math.random() - 0.5) * 20
        );
        animation.angularVelocity.set(
            (Math.random() - 0.5) * 2.5,
            (Math.random() - 0.5) * 2.0,
            (Math.random() - 0.5) * 2.5
        );

        this.addFuelTankExplosionParticles(this.fuelTank.position);

        console.log(`Starting fuel tank detachment animation with velocity:`, animation.velocity);
    }

    updateRocketDetachmentAnimation(deltaTime) {
        const currentTime = this.physics.time;

        ['rocket1', 'rocket2'].forEach(rocketName => {
            const animation = this.rocketDetachmentAnimation[rocketName];
            if (!animation || !animation.isDetaching) return;

            const rocket = rocketName === 'rocket1' ? this.rocket1 : this.rocket2;
            if (!rocket) return;

            const elapsedTime = currentTime - animation.startTime;
            const progress = elapsedTime / animation.duration;

            if (progress >= 1.0) {
                if (rocket.parent) {
                    rocket.parent.remove(rocket);
                }
                animation.isDetaching = false;
                console.log(`${rocketName} removed after animation`);
                return;
            }

            const newPosition = animation.startPosition.clone();
            newPosition.add(animation.velocity.clone().multiplyScalar(elapsedTime));

            const gravityEffect = -0.5 * 9.81 * elapsedTime * elapsedTime;
            newPosition.y += gravityEffect;

            rocket.position.copy(newPosition);

            const newRotation = animation.startRotation.clone();
            const rotationDamping = Math.exp(-elapsedTime * 0.5);
            newRotation.x += animation.angularVelocity.x * elapsedTime * rotationDamping;
            newRotation.y += animation.angularVelocity.y * elapsedTime * rotationDamping;
            newRotation.z += animation.angularVelocity.z * elapsedTime * rotationDamping;
            rocket.rotation.copy(newRotation);

            const fadeProgress = Math.pow(progress, 1.5);
            const alpha = 1.0 - fadeProgress * 0.7;
            rocket.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            if (material.opacity !== undefined) {
                                material.opacity = alpha;
                                material.transparent = true;
                            }
                        });
                    } else {
                        if (child.material.opacity !== undefined) {
                            child.material.opacity = alpha;
                            child.material.transparent = true;
                        }
                    }
                }
            });

            if (Math.random() < 0.3) {
                this.addSmokeParticle(rocket.position, animation);
            }
        });
    }

    updateFuelTankDetachmentAnimation(deltaTime) {
        const animation = this.fuelTankDetachmentAnimation;
        if (!animation || !animation.isDetaching) return;

        if (!this.fuelTank) return;

        const currentTime = this.physics.time;
        const elapsedTime = currentTime - animation.startTime;
        const progress = elapsedTime / animation.duration;

        if (progress >= 1.0) {
            if (this.fuelTank.parent) {
                this.fuelTank.parent.remove(this.fuelTank);
            }
            animation.isDetaching = false;
            console.log("Fuel tank removed after animation");
            return;
        }

        const newPosition = animation.startPosition.clone();
        newPosition.add(animation.velocity.clone().multiplyScalar(elapsedTime));

        const gravityEffect = -0.5 * 9.81 * elapsedTime * elapsedTime;
        newPosition.y += gravityEffect;

        this.fuelTank.position.copy(newPosition);

        const newRotation = animation.startRotation.clone();
        const rotationDamping = Math.exp(-elapsedTime * 0.4);
        newRotation.x += animation.angularVelocity.x * elapsedTime * rotationDamping;
        newRotation.y += animation.angularVelocity.y * elapsedTime * rotationDamping;
        newRotation.z += animation.angularVelocity.z * elapsedTime * rotationDamping;
        this.fuelTank.rotation.copy(newRotation);

        const fadeProgress = Math.pow(progress, 1.5);
        const alpha = 1.0 - fadeProgress * 0.7;
        this.fuelTank.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        if (material.opacity !== undefined) {
                            material.opacity = alpha;
                            material.transparent = true;
                        }
                    });
                } else {
                    if (child.material.opacity !== undefined) {
                        child.material.opacity = alpha;
                        child.material.transparent = true;
                    }
                }
            }
        });

        if (Math.random() < 0.3) {
            this.addFuelTankSmokeParticle(this.fuelTank.position, animation);
        }
    }

    addFuelTankSmokeParticle(position, animation) {
        const smokeParticle = {
            position: position.clone(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                Math.random() * 4 + 1,
                (Math.random() - 0.5) * 10
            ),
            life: 2.0 + Math.random() * 1.0,
            maxLife: 2.0 + Math.random() * 1.0,
            size: Math.random() * 4 + 2,
            color: new THREE.Color(
                0.6 + Math.random() * 0.3,
                0.6 + Math.random() * 0.3,
                0.6 + Math.random() * 0.3
            )
        };

        animation.smokeParticles.push(smokeParticle);
    }

    addFuelTankExplosionParticles(position) {
        for (let i = 0; i < 15; i++) {
            const explosionParticle = {
                position: position.clone(),
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 30,
                    Math.random() * 20 + 10,
                    (Math.random() - 0.5) * 30
                ),
                life: 1.0 + Math.random() * 0.5,
                maxLife: 1.0 + Math.random() * 0.5,
                size: Math.random() * 5 + 3,
                color: new THREE.Color(
                    0.8 + Math.random() * 0.2,
                    0.6 + Math.random() * 0.2,
                    0.3 + Math.random() * 0.2
                )
            };

            this.fuelTankDetachmentAnimation.explosionParticles.push(explosionParticle);
        }
    }

    isRocketDetaching() {
        return this.rocketDetachmentAnimation.rocket1.isDetaching ||
            this.rocketDetachmentAnimation.rocket2.isDetaching;
    }

    getDetachingRockets() {
        const detachingRockets = [];
        if (this.rocketDetachmentAnimation.rocket1.isDetaching) {
            detachingRockets.push(this.rocket1);
        }
        if (this.rocketDetachmentAnimation.rocket2.isDetaching) {
            detachingRockets.push(this.rocket2);
        }
        return detachingRockets;
    }

    isFuelTankDetaching() {
        return this.fuelTankDetachmentAnimation.isDetaching;
    }

    getDetachingFuelTank() {
        return this.fuelTankDetachmentAnimation.isDetaching ? this.fuelTank : null;
    }

    addSmokeParticle(position, animation) {
        const smokeParticle = {
            position: position.clone(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8
            ),
            life: 1.5 + Math.random() * 1.0,
            maxLife: 1.5 + Math.random() * 1.0,
            size: Math.random() * 2 + 0.5,
            color: new THREE.Color(
                0.6 + Math.random() * 0.2,
                0.6 + Math.random() * 0.2,
                0.6 + Math.random() * 0.2
            )
        };

        animation.smokeParticles.push(smokeParticle);
    }

    updateSmokeParticles(deltaTime) {
        ['rocket1', 'rocket2'].forEach(rocketName => {
            const animation = this.rocketDetachmentAnimation[rocketName];
            if (!animation || !animation.isDetaching) return;

            for (let i = animation.smokeParticles.length - 1; i >= 0; i--) {
                const particle = animation.smokeParticles[i];
                particle.life -= deltaTime;

                if (particle.life <= 0) {
                    animation.smokeParticles.splice(i, 1);
                    continue;
                }

                particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

                particle.velocity.y -= 9.81 * deltaTime;

                particle.velocity.multiplyScalar(0.98);
            }
        });
    }

    updateFuelTankSmokeParticles(deltaTime) {
        const animation = this.fuelTankDetachmentAnimation;
        if (!animation || !animation.isDetaching) return;

        for (let i = animation.smokeParticles.length - 1; i >= 0; i--) {
            const particle = animation.smokeParticles[i];
            particle.life -= deltaTime;

            if (particle.life <= 0) {
                animation.smokeParticles.splice(i, 1);
                continue;
            }

            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

            particle.velocity.y -= 9.81 * deltaTime;

            particle.velocity.multiplyScalar(0.98);
        }

        for (let i = animation.explosionParticles.length - 1; i >= 0; i--) {
            const particle = animation.explosionParticles[i];
            particle.life -= deltaTime;

            if (particle.life <= 0) {
                animation.explosionParticles.splice(i, 1);
                continue;
            }

            particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime));

            particle.velocity.y -= 9.81 * deltaTime;

            particle.velocity.multiplyScalar(0.95);
        }
    }

    renderSmokeParticles(scene) {
        ['rocket1', 'rocket2'].forEach(rocketName => {
            const animation = this.rocketDetachmentAnimation[rocketName];
            if (!animation || !animation.isDetaching) return;

            animation.smokeParticles.forEach(particle => {
                const geometry = new THREE.SphereGeometry(particle.size * 0.1, 8, 8);
                const material = new THREE.MeshBasicMaterial({
                    color: particle.color,
                    transparent: true,
                    opacity: particle.life / particle.maxLife * 0.5
                });

                const smokeMesh = new THREE.Mesh(geometry, material);
                smokeMesh.position.copy(particle.position);
                scene.add(smokeMesh);

                setTimeout(() => {
                    if (smokeMesh.parent) {
                        smokeMesh.parent.remove(smokeMesh);
                    }
                    geometry.dispose();
                    material.dispose();
                }, 16);
            });
        });
    }

    renderFuelTankSmokeParticles(scene) {
        const animation = this.fuelTankDetachmentAnimation;
        if (!animation || !animation.isDetaching) return;

        animation.smokeParticles.forEach(particle => {
            const geometry = new THREE.SphereGeometry(particle.size * 0.12, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: particle.color,
                transparent: true,
                opacity: particle.life / particle.maxLife * 0.5
            });

            const smokeMesh = new THREE.Mesh(geometry, material);
            smokeMesh.position.copy(particle.position);
            scene.add(smokeMesh);

            setTimeout(() => {
                if (smokeMesh.parent) {
                    smokeMesh.parent.remove(smokeMesh);
                }
                geometry.dispose();
                material.dispose();
            }, 16);
        });

        animation.explosionParticles.forEach(particle => {
            const geometry = new THREE.SphereGeometry(particle.size * 0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: particle.color,
                transparent: true,
                opacity: particle.life / particle.maxLife * 0.8
            });

            const explosionMesh = new THREE.Mesh(geometry, material);
            explosionMesh.position.copy(particle.position);
            scene.add(explosionMesh);

            setTimeout(() => {
                if (explosionMesh.parent) {
                    explosionMesh.parent.remove(explosionMesh);
                }
                geometry.dispose();
                material.dispose();
            }, 16);
        });
    }

    toggleEngineEffects(enable) {
        console.log(`SpaceShuttle: Engine effects ${enable ? 'enabled' : 'disabled'}`);
    }

    playSounds(play) {
        if (this.audioListener) {
            console.log(`SpaceShuttle: Engine sounds ${play ? 'playing' : 'stopped'}`);
            if (play && !this.engineSound) {
                this.engineSound = new THREE.Audio(this.audioListener);
                const audioLoader = new THREE.AudioLoader();
                audioLoader.load('/sounds/lunch.mp3', (buffer) => {
                    this.engineSound.setBuffer(buffer);
                    this.engineSound.setLoop(true);
                    this.engineSound.setVolume(0.5);
                    this.engineSound.play();
                });
            } else if (!play && this.engineSound) {
                this.engineSound.stop();
                this.engineSound.disconnect();
                this.engineSound = null;
            }
        }
    }

    playSoundsLunch(play) {
        if (this.audioListener) {
            console.log(`SpaceShuttle: lunch sounds ${play ? 'playing' : 'stopped'}`);
            if (play && !this.lunchSound) {
                this.lunchSound = new THREE.Audio(this.audioListener);
                const audioLoader = new THREE.AudioLoader();
                audioLoader.load('/sounds/lunchRocet.mp3', (buffer) => {
                    this.lunchSound.setBuffer(buffer);
                    this.lunchSound.setLoop(true);
                    this.lunchSound.setVolume(0.5);
                    this.lunchSound.play();
                });
            } else if (!play && this.lunchSound) {
                this.lunchSound.stop();
                this.lunchSound.disconnect();
                this.lunchSound = null;
            }
        }
    }

    loadModel(path, position = { x: 0, y: 0, z: 0 }, rotation = { x: 0, y: 0, z: 0 }, scale = 1) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    model.position.set(position.x, position.y, position.z);
                    model.rotation.set(rotation.x, rotation.y, rotation.z);
                    model.scale.set(scale, scale, scale);
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    resolve(model);
                },
                undefined,
                (error) => {
                    console.error(`Error loading model ${path}:`, error);
                    reject(error);
                }
            );
        });
    }

    async load() {
        try {
            this.model = new THREE.Group();

            this.shuttle = await this.loadModel('/models/space_shuttle/space_shuttle.glb',
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI / 2, y: 0, z: -Math.PI }
            );
            this.model.add(this.shuttle);

            this.fuelTank = await this.loadModel('/models/fuel_tank/fuel_tank.glb',
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI / 2, y: 0, z: -Math.PI }
            );
            this.model.add(this.fuelTank);

            this.rocket1 = await this.loadModel('/models/rocket/rocket_1.glb',
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI / 2, y: 0, z: -Math.PI }
            );
            this.model.add(this.rocket1);

            this.rocket2 = await this.loadModel('/models/rocket/rocket_2.glb',
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI / 2, y: 0, z: -Math.PI }
            );
            this.model.add(this.rocket2);

            const targetRealHeightMeters = 45.46;
            const box = new THREE.Box3().setFromObject(this.model);
            const currentModelHeight = box.max.y - box.min.y;
            const scaleFactor = Units.toProjectUnits(targetRealHeightMeters) / currentModelHeight;
            this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);

            this._setupFireEffects();

            const initialShuttleHeightFromSurfaceMeters = 22;
            const initialShuttleWidthOffsetMeters = -24;

            const initialModelYPosition = this.earth.getRadius() + Units.toProjectUnits(initialShuttleHeightFromSurfaceMeters);
            const initialModelZPosition = Units.toProjectUnits(initialShuttleWidthOffsetMeters);

            this.model.position.set(0, initialModelYPosition, initialModelZPosition);
            this.initialModelPosition = this.model.position.clone();
            this.initialModelRotation = this.model.rotation.clone();

            const initialPhysicsYPosition = PhysicsConstants.EARTH_RADIUS + initialShuttleHeightFromSurfaceMeters;
            this.physics.position.set(0, initialPhysicsYPosition, 0);

            console.log('Space shuttle loaded successfully');
            console.log(`Initial Visual Model Position (Project Units): ${this.initialModelPosition.toArray().map(v => v.toFixed(2))}`);
            console.log(`Initial Physics Position (Real Meters): ${this.physics.position.toArray().map(v => v.toFixed(2))}`);

            return this.model;
        } catch (error) {
            console.error('Error loading space shuttle model:', error);
            return null;
        }
    }

    _setupFireEffects() {

        const shuttleFirePositions = [

            new THREE.Vector3(0, 6.65, -2.5),

        ];

        shuttleFirePositions.forEach(pos => {
            const ps = new CustomParticleSystem(this.camera, this.shuttle, '/texture/fire.png');

            ps._points.position.copy(pos);
            this.mainEngineParticleSystems.push(ps);


        });


        const srb1FirePosition = new THREE.Vector3(
            -1, 5.1, -4
        );

        const psRocket1 = new CustomParticleSystem(this.camera, this.rocket1, '/texture/fire.png');
        psRocket1._points.position.copy(srb1FirePosition);
        this.srbParticleSystems.push(psRocket1);


        const srb2FirePosition = new THREE.Vector3(
            1, 5.1, -4
        );

        const psRocket2 = new CustomParticleSystem(this.camera, this.rocket2, '/texture/fire.png');
        psRocket2._points.position.copy(srb2FirePosition);
        this.srbParticleSystems.push(psRocket2);

        const smokePosition2 = new THREE.Vector3(
            0, 6, -8
        );

        const pssmoke2 = new CustomParticleSmoke(this.camera, this.rocket2, '/texture/smoke.png');
        pssmoke2._points.position.copy(smokePosition2);
        this.srbParticleSystems.push(pssmoke2);


        const smokePosition = new THREE.Vector3(
            0, 4, -3
        );

        const pssmoke = new CustomParticleSmoke(this.camera, this.rocket2, '/texture/smoke.png');
        pssmoke._points.position.copy(smokePosition);
        this.smokeParticleSystem.push(pssmoke);
    }

    /**
     * Detaches a given part from the main shuttle model and adds it to the scene
     * with an initial velocity and angular velocity to simulate falling.
     * @param {THREE.Object3D} part - The Three.js object to detach (e.g., this.rocket1, this.fuelTank).
     * @param {number} [initialPushX=0] - Initial push along the X-axis (in meters/second).
     * @param {number} [initialPushY=-1] - Initial push along the Y-axis (in meters/second, negative for downwards).
     * @param {number} [initialPushZ=0] - Initial push along the Z-axis (in meters/second).
     */
    detachPart(part, initialPushX = 0, initialPushY = -1, initialPushZ = 0) { // Default initialY changed to -1 for slower fall
        if (!part || !part.parent) {
            console.warn('Cannot detach part: part is null or has no parent.');
            return;
        }
    }

    update(deltaTime) {

        if (this.model) {
            if (this.physics.stage === ShuttleStages.IDLE) {
                this.model.position.copy(this.initialModelPosition);
                this.model.rotation.copy(this.initialModelRotation);
                this.mainEngineParticleSystems.forEach(ps => ps.setVisibility(false));
                this.srbParticleSystems.forEach(ps => ps.setVisibility(false));
                this.smokeParticleSystem.forEach(ps => ps.setVisibility(false));
                // Clear detached parts if we return to idle
                this.detachedParts.forEach(part => this.scene.remove(part.model));
                this.detachedParts = [];
            } else {
                this.physics.update(deltaTime);

                const physicsPositionInProjectUnits = new THREE.Vector3(
                    Units.toProjectUnits(this.physics.position.x),
                    Units.toProjectUnits(this.physics.position.y),
                    Units.toProjectUnits(this.physics.position.z)
                );

                if (
                    this.physics.stage === ShuttleStages.ENGINE_STARTUP ||
                    this.physics.stage === ShuttleStages.LIFTOFF ||
                    this.physics.stage === ShuttleStages.ATMOSPHERIC_ASCENT
                ) {
                    this.model.position.x = this.initialModelPosition.x;
                    this.model.position.y = physicsPositionInProjectUnits.y;
                    this.model.position.z = this.initialModelPosition.z;
                } else {
                    this.model.position.copy(physicsPositionInProjectUnits);
                }

                this.model.rotation.copy(this.initialModelRotation);


                this.mainEngineParticleSystems.forEach(ps => ps.update(deltaTime));
                this.srbParticleSystems.forEach(ps => ps.update(deltaTime));
                this.smokeParticleSystem.forEach(ps => ps.update(deltaTime));

                this.updateRocketDetachmentAnimation(deltaTime);
                this.updateSmokeParticles(deltaTime);
                this.updateFuelTankDetachmentAnimation(deltaTime);
                this.updateFuelTankSmokeParticles(deltaTime);

                switch (this.physics.stage) {
                    case ShuttleStages.ENGINE_STARTUP:
                        this.mainEngineParticleSystems.forEach(ps => ps.setVisibility(true));
                        this.srbParticleSystems.forEach(ps => ps.setVisibility(true));
                        this.smokeParticleSystem.forEach(ps => ps.setVisibility(true));
                        this.playSounds(true);
                        break;
                    case ShuttleStages.LIFTOFF:
                        this.mainEngineParticleSystems.forEach(ps => ps.setVisibility(true));
                        this.srbParticleSystems.forEach(ps => ps.setVisibility(true));
                        this.smokeParticleSystem.forEach(ps => ps.setVisibility(false));
                        this.playSounds(false);
                        this.playSoundsLunch(true);
                        break;
                    case ShuttleStages.ATMOSPHERIC_ASCENT:
                        if (this.physics.srbDetached && this.rocket1.parent &&
                            !this.rocketDetachmentAnimation.rocket1.isDetaching) {

                            this.startRocketDetachmentAnimation('rocket1');
                            this.startRocketDetachmentAnimation('rocket2');
                            this.srbParticleSystems.forEach(ps => ps.setVisibility(false));
                            console.log("Visual: Starting SRB detachment animation.");
                        }
                        this.mainEngineParticleSystems.forEach(ps => ps.setVisibility(true));
                        this.smokeParticleSystem.forEach(ps => ps.setVisibility(false));
                        break;
                    case ShuttleStages.ORBITAL_INSERTION:
                        if (this.physics.etDetached && this.fuelTank.parent &&
                            !this.fuelTankDetachmentAnimation.isDetaching) {
                            this.startFuelTankDetachmentAnimation();
                            console.log("Visual: Starting fuel tank detachment animation.");
                        }
                        this.mainEngineParticleSystems.forEach(ps => ps.setVisibility(false));
                        this.srbParticleSystems.forEach(ps => ps.setVisibility(false));
                        this.smokeParticleSystem.forEach(ps => ps.setVisibility(false));
                        this.playSoundsLunch(false);
                        break;
                    case ShuttleStages.ORBITAL_STABILIZATION:
                    case ShuttleStages.FREE_SPACE_MOTION:
                        this.mainEngineParticleSystems.forEach(ps => ps.setVisibility(false));
                        this.srbParticleSystems.forEach(ps => ps.setVisibility(false));
                        this.smokeParticleSystem.forEach(ps => ps.setVisibility(false));
                        this.playSoundsLunch(false);
                        break;
                    case ShuttleStages.ORBITAL_MANEUVERING:
                        this.mainEngineParticleSystems.forEach(ps => ps.setVisibility(true));
                        this.srbParticleSystems.forEach(ps => ps.setVisibility(false));
                        this.smokeParticleSystem.forEach(ps => ps.setVisibility(false));
                        this.playSoundsLunch(true);
                        break;
                }
            }

            // ******** Update detached parts' physics and visual state ********
            const gravityProjectUnits = Units.toProjectUnits(this.gravityConstant);
            const thresholdProjectUnits = Units.toProjectUnits(this.DETACHED_PART_FALL_THRESHOLD_METERS);

            for (let i = this.detachedParts.length - 1; i >= 0; i--) {
                const part = this.detachedParts[i];

                // Apply gravity to vertical velocity (slowed down for visual effect)
                part.velocity.y += (gravityProjectUnits * 0.1) * deltaTime; // Gravity reduced to 10% for slower fall

                // Apply velocity to position
                part.model.position.addScaledVector(part.velocity, deltaTime);

                // Apply angular velocity to rotation
                part.model.rotation.x += part.angularVelocity.x;
                part.model.rotation.y += part.angularVelocity.y;
                part.model.rotation.z += part.angularVelocity.z;

                // Remove part if it has fallen sufficiently far below its detachment point
                if (part.initialWorldYPosition - part.model.position.y > thresholdProjectUnits) {
                    this.scene.remove(part.model);
                    this._disposeThreeObject(part.model); // Custom disposal function
                    this.detachedParts.splice(i, 1); // Remove from array
                    console.log(`Detached part removed from scene (fell past threshold): ${part.model.name || 'Unnamed Part'}`);
                }
            }
            // **********************************************************************
        }
    }

    // Helper function to safely dispose of Three.js object resources
    _disposeThreeObject(object) {
        if (!object) return;

        object.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => {
                            material.dispose();
                            if (material.map) material.map.dispose();
                            if (material.normalMap) material.normalMap.dispose();
                            // Dispose other textures if applicable (e.g., roughnessMap, metalnessMap)
                        });
                    } else {
                        child.material.dispose();
                        if (child.material.map) child.material.map.dispose();
                        if (child.material.normalMap) child.material.normalMap.dispose();
                        // Dispose other textures if applicable
                    }
                }
            }
        });
    }

    dispose() {
        this.mainEngineParticleSystems.forEach(ps => ps.dispose());
        this.srbParticleSystems.forEach(ps => ps.dispose());
        this.smokeParticleSystem.forEach(ps => ps.dispose());

        // Dispose detached parts that might still be in the scene
        this.detachedParts.forEach(part => {
            this.scene.remove(part.model);
            this._disposeThreeObject(part.model);
        });
        this.detachedParts = []; // Clear the array

        if (this.model) {
            this._disposeThreeObject(this.model); // Dispose the main shuttle model
            if (this.model.parent) {
                this.model.parent.remove(this.model);
            }
        }
        if (this.engineSound) {
            this.engineSound.stop();
            this.engineSound.disconnect();
            this.engineSound = null;
        }
        if (this.lunchSound) {
            this.lunchSound.stop();
            this.lunchSound.disconnect();
            this.lunchSound = null;
        }
    }

    getAltitude() {
        return this.physics.position.y - PhysicsConstants.EARTH_RADIUS;
    }
}