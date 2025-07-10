// src/components/SpaceShuttle.js

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Units } from '../utils/Units';
import { ShuttlePhysics } from '../physics/ShuttlePhysics';
import { ShuttleStages } from '../constants/ShuttleStages';
import { PhysicsConstants } from '../constants/PhysicsConstants'; // Import PhysicsConstants here too

export class SpaceShuttle {
    constructor(earth, physics) {
        this.earth = earth;
        this.model = null;
        this.rotationSpeed = 0;

        // Store references to individual parts
        this.shuttle = null;
        this.fuelTank = null;
        this.rocket1 = null;
        this.rocket2 = null;

        // Initialize physics system
        this.physics = physics;

        // Store initial position and rotation (for IDLE stage)
        this.initialModelPosition = null; // The visual model's initial position in Three.js units
        this.initialModelRotation = new THREE.Euler(-Math.PI / 2, 0, -Math.PI / 2); // Point upward (Y-axis for Three.js model)

        // Bind the key handler to this instance
        this.handleKeyDown = this.handleKeyDown.bind(this);
        window.addEventListener('keydown', this.handleKeyDown);
    }

    // Function to load a model
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
            // Create a group for all parts
            this.model = new THREE.Group();

            // Load space shuttle in the middle
            this.shuttle = await this.loadModel('/models/space_shuttle/space_shuttle.glb',
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI / 2, y: 0, z: -Math.PI } // Point upward relative to its own local axis
            );
            this.model.add(this.shuttle);

            // Load fuel tank
            this.fuelTank = await this.loadModel('/models/fuel_tank/fuel_tank.glb',
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI / 2, y: 0, z: -Math.PI }
            );
            this.model.add(this.fuelTank);

            // Load rockets
            this.rocket1 = await this.loadModel('/models/rocket/rocket_1.glb',
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI / 2, y: 0, z: -Math.PI }
            );
            this.rocket2 = await this.loadModel('/models/rocket/rocket_2.glb',
                { x: 0, y: 0, z: 0 },
                { x: -Math.PI / 2, y: 0, z: -Math.PI }
            );
            this.model.add(this.rocket1);
            this.model.add(this.rocket2);

            // Scale the entire group to match a target real-world height
            const targetRealHeightMeters = 45.46; // Real height of Space Shuttle stack in meters
            const box = new THREE.Box3().setFromObject(this.model);
            const currentModelHeight = box.max.y - box.min.y; // Height of the loaded model in its own scale
            const scaleFactor = Units.toProjectUnits(targetRealHeightMeters) / currentModelHeight;
            this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // --- Set Initial Position for the Visual Model (in Project Units) ---
            // The shuttle starts on the launch pad at Earth's surface.
            // We need to define its initial offset from Earth's center in project units.
            const initialShuttleHeightFromSurfaceMeters = 22; // Approx height of shuttle base from ground
            const initialShuttleWidthOffsetMeters = -24; // Z-offset for visual presentation if needed

            // Calculate initial Y position (radius of Earth in project units + shuttle's initial height from surface in project units)
            const initialModelYPosition = this.earth.getRadius() + Units.toProjectUnits(initialShuttleHeightFromSurfaceMeters);
            const initialModelZPosition = Units.toProjectUnits(initialShuttleWidthOffsetMeters);

            this.model.position.set(0, initialModelYPosition, initialModelZPosition);

            // Store initial model position and rotation for the IDLE stage
            this.initialModelPosition = this.model.position.clone();
            this.initialModelRotation = this.model.rotation.clone();


            // --- Initialize Physics Position (in Real Meters from Earth's center) ---
            // The physics engine operates in real meters.
            // PhysicsConstants.EARTH_RADIUS is already in real meters.
            const initialPhysicsYPosition = PhysicsConstants.EARTH_RADIUS + initialShuttleHeightFromSurfaceMeters;
            this.physics.position.set(0, initialPhysicsYPosition, 0); // Physics usually starts directly "up" from center

            console.log('Space shuttle loaded successfully');
            console.log(`Initial Visual Model Position (Project Units): ${this.initialModelPosition.toArray().map(v => v.toFixed(2))}`);
            console.log(`Initial Physics Position (Real Meters): ${this.physics.position.toArray().map(v => v.toFixed(2))}`);

            return this.model;
        } catch (error) {
            console.error('Error loading space shuttle model:', error);
            return null;
        }
    }

    handleKeyDown(event) {
        // Start launch sequence on spacebar
        if (event.key === ' ' && this.physics.stage === ShuttleStages.IDLE) {
            console.log('Starting launch sequence');
            this.physics.setStage(ShuttleStages.LIFTOFF);
        }
    }

    update(deltaTime) {
        if (this.model) {
            if (this.physics.stage === ShuttleStages.IDLE) {
                // Rocket is stationary on launch pad
                this.model.position.copy(this.initialModelPosition);
                this.model.rotation.copy(this.initialModelRotation);
            } else {
                // Update physics simulation
                this.physics.update(deltaTime);

                // --- Update Model Position based on Physics (converting from Real Meters to Project Units) ---
                // this.physics.position is in real meters (from Earth's center).
                // this.model.position should be in project units.

                const physicsPositionInProjectUnits = new THREE.Vector3(
                    Units.toProjectUnits(this.physics.position.x),
                    Units.toProjectUnits(this.physics.position.y),
                    Units.toProjectUnits(this.physics.position.z)
                );
                
                // Keep X and Z fixed to initial launch pad position during vertical ascent stages
                if (this.physics.stage === ShuttleStages.LIFTOFF || this.physics.stage === ShuttleStages.ATMOSPHERIC_ASCENT) {
                    this.model.position.x = this.initialModelPosition.x; // Keep initial X
                    this.model.position.y = physicsPositionInProjectUnits.y; // Update Y from physics
                    this.model.position.z = this.initialModelPosition.z; // Keep initial Z
                } else {
                    // For orbital stages and beyond, allow full 3D movement from physics
                    this.model.position.copy(physicsPositionInProjectUnits);
                }

                // For a more dynamic orientation during flight, you might want to adjust rotation
                // based on velocity or acceleration, but for now, keep initial upward rotation.
                this.model.rotation.copy(this.initialModelRotation);

                // Handle stage-specific effects (visuals, sounds, camera, etc.)
                switch (this.physics.stage) {
                    case ShuttleStages.LIFTOFF:
                        // Example: Add engine exhaust effects, camera shake.
                        // You'd typically add a ParticleEmitter for smoke/fire here.
                        break;
                    case ShuttleStages.ATMOSPHERIC_ASCENT:
                        // Example: Adjust exhaust size/intensity based on air density (altitude).
                        // Handle SRB detachment visual event.
                        if (this.physics.srbDetached && this.rocket1.parent) {
                            this.model.remove(this.rocket1);
                            this.model.remove(this.rocket2);
                            console.log("Visual: SRBs removed from scene.");
                            // Add logic to make SRBs fall separately if you had a separate physics for them
                        }
                        break;
                    case ShuttleStages.ORBITAL_INSERTION:
                        // Example: Reduce main engine exhaust.
                        // Handle ET detachment visual event.
                        if (this.physics.etDetached && this.fuelTank.parent) {
                            this.model.remove(this.fuelTank);
                            console.log("Visual: External Fuel Tank removed from scene.");
                            // Add logic for ET falling/burning up
                        }
                        break;
                    case ShuttleStages.ORBITAL_STABILIZATION:
                        // No active thrust, subtle adjustments.
                        break;
                    case ShuttleStages.FREE_SPACE_MOTION:
                        // No thrust, just orbit.
                        break;
                    case ShuttleStages.ORBITAL_MANEUVERING:
                        // Small thruster bursts effects.
                        break;
                }
            }
        }
    }

    dispose() {
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    getAltitude() {
        // Returns the current altitude in real meters, as calculated by the physics engine.
        // This is the distance from the Earth's surface, not from the center.
        return this.physics.position.y - PhysicsConstants.EARTH_RADIUS;
    }
}