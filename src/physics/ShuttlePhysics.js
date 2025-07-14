// src/physics/ShuttlePhysics.js

import { PhysicsConstants } from '../constants/PhysicsConstants';
import { ShuttleStages } from '../constants/ShuttleStages';
import { getStageLabel } from '../constants/ShuttleStages';
import * as THREE from 'three';

export class ShuttlePhysics {
    constructor() {
        this.stage = ShuttleStages.IDLE;
        this.time = 0; // Simulation time in seconds
        this.engineStartupTimer = 0; // مؤقت لمرحلة بدء المحرك

        this.position = new THREE.Vector3(0, PhysicsConstants.EARTH_RADIUS, 0);
        this.velocity = new THREE.Vector3();
        this.acceleration = new THREE.Vector3();
        this.force = new THREE.Vector3();

        this.shuttleDryMass = PhysicsConstants.SHUTTLE_MASS;
        this.externalTankInitialTotalMass = PhysicsConstants.FUEL_TANK_MASS;
        this.srbInitialTotalMass = PhysicsConstants.ROCKET_MASS;

        this.isFuelTankAttached = true;
        this.isRocket1Attached = true;
        this.isRocket2Attached = true;

        this.fuelPercentage = 100;

        this.srbDetached = false;
        this.etDetached = false;

        this.launchPad = null; 
        this.towerTilted = false; 

        console.log("ShuttlePhysics Initialized:");
        console.log(`  Initial Position: (${this.position.x.toFixed(0)}, ${this.position.y.toFixed(0)}, ${this.position.z.toFixed(0)}) m (from Earth center)`);
        console.log(`  Initial Altitude: ${(this.position.y - PhysicsConstants.EARTH_RADIUS).toFixed(0)} m`);
        console.log(`  Initial Total Mass: ${this.calculateTotalMass().toFixed(2)} kg`);
    }


    setLaunchPad(launchPad) {
        this.launchPad = launchPad;
    }

    calculateTotalMass() {
        let totalMass = this.shuttleDryMass;

        if (this.isFuelTankAttached) {
            let currentEtMass = this.externalTankInitialTotalMass * (this.fuelPercentage / 100);
            totalMass += currentEtMass;
        }
        if (this.isRocket1Attached) {
            totalMass += this.srbInitialTotalMass;
        }
        if (this.isRocket2Attached) {
            totalMass += this.srbInitialTotalMass;
        }

        if (isNaN(totalMass)) {
            console.error("Critical Error: Calculated totalMass became NaN! Returning fallback mass.");
            return 1;
        }
        if (!isFinite(totalMass)) {
            console.error("Critical Error: Calculated totalMass became Infinity! Returning fallback mass.");
            return 1;
        }

        if (totalMass <= 0) {
            console.warn("Calculated total mass is zero or negative. Clamping to a small positive value.");
            return 1;
        }
        return totalMass;
    }

    calculateGravityForce(position) {
        const distance = position.length();
        if (distance < 1 || isNaN(distance) || !isFinite(distance)) {
            console.warn("Invalid distance for gravity calculation. Returning zero force.");
            return new THREE.Vector3();
        }

        const gravityMagnitude = PhysicsConstants.GRAVITY_CONSTANT *
            PhysicsConstants.EARTH_MASS *
            this.calculateTotalMass() /
            (distance * distance);

        if (isNaN(gravityMagnitude) || !isFinite(gravityMagnitude)) {
            console.warn("Gravity magnitude became NaN/Infinity. Returning zero force.");
            return new THREE.Vector3();
        }

        return position.clone().normalize().multiplyScalar(-gravityMagnitude);
    }

    calculateNormalForce() {
        const totalMass = this.calculateTotalMass();
        const weightMagnitude = PhysicsConstants.GRAVITY * totalMass;
        return new THREE.Vector3(0, weightMagnitude, 0);
    }

    calculateAirResistance(velocity, altitude) {
        if (altitude > PhysicsConstants.ATMOSPHERE_HEIGHT) {
            return new THREE.Vector3();
        }

        const airDensity = PhysicsConstants.AIR_DENSITY_SEA_LEVEL *
            Math.exp(-altitude * PhysicsConstants.AIR_DENSITY_DECAY_RATE);

        if (airDensity < 0 || isNaN(airDensity) || !isFinite(airDensity)) {
            console.warn("Air density became invalid. Returning zero drag.");
            return new THREE.Vector3();
        }

        const dragCoefficient = PhysicsConstants.DRAG_COEFFICIENT;
        const crossSectionalArea = PhysicsConstants.CROSS_SECTIONAL_AREA;

        const velocityMagnitudeSq = velocity.lengthSq();
        if (velocityMagnitudeSq === 0 || isNaN(velocityMagnitudeSq) || !isFinite(velocityMagnitudeSq)) return new THREE.Vector3();

        const dragForceMagnitude = 0.5 * airDensity * dragCoefficient * crossSectionalArea * velocityMagnitudeSq;

        if (isNaN(dragForceMagnitude) || !isFinite(dragForceMagnitude)) {
            console.warn("Drag force magnitude became NaN/Infinity. Returning zero force.");
            return new THREE.Vector3();
        }

        return velocity.clone().normalize().multiplyScalar(-dragForceMagnitude);
    }

    calculateThrust() {
        const thrust = new THREE.Vector3();
        let currentThrustMagnitude = 0;

        switch (this.stage) {
            case ShuttleStages.IDLE:
                currentThrustMagnitude = 0;
                break;
            case ShuttleStages.ENGINE_STARTUP:
                currentThrustMagnitude = PhysicsConstants.THRUST_ENGINE_STARTUP;
                break;
            case ShuttleStages.LIFTOFF:
                if (this.fuelPercentage > 0) {
                    currentThrustMagnitude += PhysicsConstants.THRUST_MAIN_ENGINES;
                }
                if (this.isRocket1Attached) {
                    currentThrustMagnitude += (PhysicsConstants.THRUST_SOLID_ROCKETS / 2);
                }
                if (this.isRocket2Attached) {
                    currentThrustMagnitude += (PhysicsConstants.THRUST_SOLID_ROCKETS / 2);
                }
                break;
            case ShuttleStages.ATMOSPHERIC_ASCENT:
                if (this.fuelPercentage > 0) {
                    currentThrustMagnitude += PhysicsConstants.THRUST_MAIN_ENGINES;
                }
                break;
            case ShuttleStages.ORBITAL_INSERTION:
                if (this.fuelPercentage > 0) {
                    currentThrustMagnitude += PhysicsConstants.THRUST_MAIN_ENGINES * 0.5;
                }
                break;
            case ShuttleStages.ORBITAL_MANEUVERING:
                currentThrustMagnitude += PhysicsConstants.THRUST_MAIN_ENGINES * 0.001;
                break;
            default:
                currentThrustMagnitude = 0;
        }

        if (isNaN(currentThrustMagnitude) || !isFinite(currentThrustMagnitude)) {
            console.warn("Thrust magnitude became NaN/Infinity. Returning zero thrust.");
            return new THREE.Vector3();
        }

        thrust.y = currentThrustMagnitude;
        return thrust;
    }

    update(deltaTime) {
        const maxDeltaTime = 0.0166;
        if (deltaTime > maxDeltaTime) {
            deltaTime = maxDeltaTime;
            console.warn(`deltaTime capped to ${maxDeltaTime.toFixed(3)}s for stability.`);
        }
        if (deltaTime <= 0) {
            return;
        }

        this.force.set(0, 0, 0);

        let altitudeAtStartOfStep = this.position.y - PhysicsConstants.EARTH_RADIUS;

        this.force.add(this.calculateGravityForce(this.position));

        if (this.stage === ShuttleStages.IDLE) {
            if (altitudeAtStartOfStep <= 0) {
                this.position.setY(PhysicsConstants.EARTH_RADIUS);
                this.velocity.set(0, 0, 0);
                this.acceleration.set(0, 0, 0);
                this.force.add(this.calculateNormalForce());
            }
        } else { // Handle non-IDLE stages (including ENGINE_STARTUP)
            if (altitudeAtStartOfStep > 0 && altitudeAtStartOfStep < PhysicsConstants.ATMOSPHERE_HEIGHT) {
                this.force.add(this.calculateAirResistance(this.velocity, altitudeAtStartOfStep));
            }
            // Ensure no sinking below ground during ENGINE_STARTUP if it happens
            if (this.stage === ShuttleStages.ENGINE_STARTUP && altitudeAtStartOfStep <= 0) {
                this.position.setY(PhysicsConstants.EARTH_RADIUS);
                this.velocity.y = Math.max(0, this.velocity.y); // Prevent downward velocity
                this.acceleration.y = Math.max(0, this.acceleration.y); // Prevent downward acceleration
            }
        }

        const currentThrustVector = this.calculateThrust();
        this.force.add(currentThrustVector);

        const currentTotalMass = this.calculateTotalMass();
        if (currentTotalMass > 0 && !isNaN(currentTotalMass) && isFinite(currentTotalMass)) {
            this.acceleration.copy(this.force).divideScalar(currentTotalMass);
        } else {
            this.acceleration.set(0, 0, 0);
            console.error("Invalid mass detected, acceleration set to zero.", currentTotalMass);
        }

        this.velocity.addScaledVector(this.acceleration, deltaTime);
        this.position.addScaledVector(this.velocity, deltaTime);

        const currentAltitude = this.position.y - PhysicsConstants.EARTH_RADIUS;

        if (this.stage !== ShuttleStages.IDLE) {
            if (currentAltitude < -1) {
                console.warn(`Shuttle significantly below ground (${currentAltitude.toFixed(2)}m) during flight! Snapping back.`);
                this.position.setY(PhysicsConstants.EARTH_RADIUS);
                if (this.velocity.y < 0) {
                    this.velocity.y = 0;
                }
                if (this.acceleration.y < 0) {
                    this.acceleration.y = 0;
                }
            }
        }

        if (isNaN(this.position.x) || !isFinite(this.position.x) ||
            isNaN(this.position.y) || !isFinite(this.position.y) ||
            isNaN(this.position.z) || !isFinite(this.position.z)) {
            console.error("Position became NaN/Infinity. Resetting to initial ground position.");
            this.position.set(0, PhysicsConstants.EARTH_RADIUS, 0);
            this.velocity.set(0, 0, 0);
            this.acceleration.set(0, 0, 0);
        }

        if (isNaN(this.velocity.x) || !isFinite(this.velocity.x) ||
            isNaN(this.velocity.y) || !isFinite(this.velocity.y) ||
            isNaN(this.velocity.z) || !isFinite(this.velocity.z)) {
            console.error("Velocity became NaN/Infinity. Resetting to zero.");
            this.velocity.set(0, 0, 0);
            this.acceleration.set(0, 0, 0);
        }

        if (isNaN(this.acceleration.x) || !isFinite(this.acceleration.x) ||
            isNaN(this.acceleration.y) || !isFinite(this.acceleration.y) ||
            isNaN(this.acceleration.z) || !isFinite(this.acceleration.z)) {
            console.error("Acceleration became NaN/Infinity. Resetting to zero.");
            this.acceleration.set(0, 0, 0);
        }

        const mainEngineFuelBurnRate = PhysicsConstants.FUEL_CONSUMPTION_RATE;

        if (this.fuelPercentage > 0 && currentThrustVector.lengthSq() > 0.1) {
            let actualBurnRate = 0;
            if (this.stage === ShuttleStages.LIFTOFF ||
                this.stage === ShuttleStages.ATMOSPHERIC_ASCENT ||
                this.stage === ShuttleStages.ORBITAL_INSERTION ||
                this.stage === ShuttleStages.ORBITAL_MANEUVERING) {

                if (currentThrustVector.y > 0) {
                    actualBurnRate = mainEngineFuelBurnRate;
                }

                const fuelMassInTank = this.externalTankInitialTotalMass * (this.fuelPercentage / 100);
                actualBurnRate = Math.min(actualBurnRate, fuelMassInTank / deltaTime);

                const fuelPercentageConsumed = (actualBurnRate * deltaTime / this.externalTankInitialTotalMass) * 100;
                this.fuelPercentage = Math.max(0, this.fuelPercentage - fuelPercentageConsumed);

                if (isNaN(this.fuelPercentage) || !isFinite(this.fuelPercentage)) {
                    console.error("Fuel percentage became NaN/Infinity. Clamping to 0.");
                    this.fuelPercentage = 0;
                }
            }
        }

        this.time += deltaTime;

       
        if (this.stage === ShuttleStages.ENGINE_STARTUP) {
            this.engineStartupTimer += deltaTime;
        } else {
            this.engineStartupTimer = 0;
        }

     
        this.updateStage(currentAltitude, deltaTime);
        this.handleComponentDetachment(currentAltitude, this.time, this.velocity.length());

        console.log(`--- Time: ${this.time.toFixed(2)}s | Stage: ${getStageLabel(this.stage)} ---`);
        console.log(`  Altitude: ${currentAltitude.toFixed(2)} m`);
        console.log(`  Speed: ${this.velocity.length().toFixed(2)} m/s`);
        console.log(`  Velocity Y: ${this.velocity.y.toFixed(2)} m/s`);
        console.log(`  Acceleration: ${this.acceleration.length().toFixed(2)} m/s²`);
        console.log(`  Acceleration Y: ${this.acceleration.y.toFixed(2)} m/s²`);
        console.log(`  Current Mass: ${this.calculateTotalMass().toFixed(2)} kg`);
        console.log(`  Fuel: ${this.fuelPercentage.toFixed(2)}%`);
        console.log(`  Force (Total Y): ${this.force.y.toFixed(2)} N`);
        console.log(`  Position (Y from Center): ${this.position.y.toFixed(0)} m`);
        console.log("--------------------------------------------------");
    }

    updateStage(currentAltitude, deltaTime) {
        const velocityMagnitude = this.velocity.length();

        switch (this.stage) {
            case ShuttleStages.IDLE:
                break;
            case ShuttleStages.ENGINE_STARTUP:
              
                if (this.engineStartupTimer >= (PhysicsConstants.ENGINE_STARTUP_DURATION - 2) && !this.towerTilted) {
                    if (this.launchPad && this.launchPad.towerModel) {
                        this.launchPad.tiltTower(90);
                        this.towerTilted = true;
                        console.log("ShuttlePhysics: Launch pad tower tilting initiated via simulation time.");
                    }
                }
                if (this.engineStartupTimer >= PhysicsConstants.ENGINE_STARTUP_DURATION) {
                    this.stage = ShuttleStages.LIFTOFF;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} - Transitioned from ENGINE_STARTUP.`);
                }
                break;
            case ShuttleStages.LIFTOFF:
                if (currentAltitude > PhysicsConstants.SRB_DETACH_ALTITUDE && this.srbDetached) {
                    this.stage = ShuttleStages.ATMOSPHERIC_ASCENT;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s, Alt: ${currentAltitude.toFixed(0)}m`);
                }
                break;
            case ShuttleStages.ATMOSPHERIC_ASCENT:
                if (currentAltitude > PhysicsConstants.ATMOSPHERE_HEIGHT && this.etDetached) {
                    this.stage = ShuttleStages.ORBITAL_INSERTION;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s, Alt: ${currentAltitude.toFixed(0)}m`);
                }
                break;
            case ShuttleStages.ORBITAL_INSERTION:
                const targetAltitudeLEO = PhysicsConstants.LOW_EARTH_ORBIT_ALTITUDE;
                const targetVelocityLEO = PhysicsConstants.ORBITAL_VELOCITY_LEO;

                if (currentAltitude >= targetAltitudeLEO - 10000 &&
                    currentAltitude <= targetAltitudeLEO + 10000 &&
                    Math.abs(velocityMagnitude - targetVelocityLEO) < PhysicsConstants.ORBITAL_VELOCITY_TOLERANCE) {
                    this.stage = ShuttleStages.ORBITAL_STABILIZATION;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s, Alt: ${currentAltitude.toFixed(0)}m, Speed: ${velocityMagnitude.toFixed(0)}m/s`);
                }
                break;
            case ShuttleStages.ORBITAL_STABILIZATION:
                if (this.acceleration.lengthSq() < 0.1 && velocityMagnitude > (PhysicsConstants.ORBITAL_VELOCITY_LEO * 0.9)) {
                    this.stage = ShuttleStages.FREE_SPACE_MOTION;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s`);
                }
                break;
            case ShuttleStages.FREE_SPACE_MOTION:
                if (this.calculateThrust().lengthSq() > 0.1) {
                    this.stage = ShuttleStages.ORBITAL_MANEUVERING;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s`);
                }
                break;
            case ShuttleStages.ORBITAL_MANEUVERING:
                if (this.calculateThrust().lengthSq() < 0.1) {
                    this.stage = ShuttleStages.FREE_SPACE_MOTION;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s`);
                }
                break;
        }
    }

    handleComponentDetachment(altitude, currentTime, currentVelocity) {
        if (!this.srbDetached && this.isRocket1Attached &&
            currentTime >= PhysicsConstants.SRB_DETACH_TIME &&
            altitude >= PhysicsConstants.SRB_DETACH_ALTITUDE) {

            this.detachComponent('rocket1');
            this.detachComponent('rocket2');
            this.srbDetached = true;
            console.log(`SRBs detached at ${currentTime.toFixed(2)}s, Altitude: ${altitude.toFixed(0)}m`);
        }

        if (!this.etDetached && this.isFuelTankAttached &&
            currentTime >= PhysicsConstants.FUEL_TANK_DETACH_TIME &&
            altitude >= PhysicsConstants.FUEL_TANK_DETACH_ALTITUDE &&
            currentVelocity >= PhysicsConstants.ORBITAL_VELOCITY_LEO * 0.95 &&
            this.fuelPercentage <= PhysicsConstants.FUEL_TANK_DETACH_FUEL_PERCENT) {

            this.detachComponent('fuelTank');
            this.fuelPercentage = 0;
            this.etDetached = true;
            console.log(`External Fuel Tank detached at ${currentTime.toFixed(2)}s, Altitude: ${altitude.toFixed(0)}m`);
        }
    }

    setStage(stage) {
        this.stage = stage;
        if (stage === ShuttleStages.ENGINE_STARTUP) {
            this.engineStartupTimer = 0;
            this.towerTilted = false; // إعادة تعيين علامة الميلان عند بدء مرحلة جديدة
        } else if (stage === ShuttleStages.IDLE) {
            this.towerTilted = false; // إعادة تعيين العلامة عند العودة إلى السكون
        }
        console.log(`Shuttle Stage manually set to: ${getStageLabel(stage)}`);
    }

    detachComponent(component) {
        switch (component) {
            case 'fuelTank':
                this.isFuelTankAttached = false;
                break;
            case 'rocket1':
                this.isRocket1Attached = false;
                break;
            case 'rocket2':
                this.isRocket2Attached = false;
                break;
            default:
                console.warn(`Attempted to detach unknown component: ${component}`);
        }
    }
}