// src/physics/ShuttlePhysics.js

import { PhysicsConstants } from '../constants/PhysicsConstants';
import { ShuttleStages } from '../constants/ShuttleStages';
import { getStageLabel } from '../constants/ShuttleStages';
import * as THREE from 'three';

export class ShuttlePhysics {
    constructor() {
        this.stage = ShuttleStages.IDLE;
        this.time = 0; 
        this.engineStartupTimer = 0; 

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

        this.tiltAngle = 0;
        this.targetTilt = 0;
        this.tiltLocked = false;

        this.forwardVector = new THREE.Vector3(0, 1, 0);
        this.upVector = new THREE.Vector3(0, 1, 0);

        this.launchPad = null;
        this.towerTilted = false;

        this.spinAxis = new THREE.Vector3(0, 0, 0);
        this.spinQuaternion = new THREE.Quaternion();
        this.isSpinning = false;

        this.spinSpeedDeg = 90;
        this.spinTargetAngleRad = 0;
        this.spinAccumulatedRad = 0; 
        this.baseQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(-Math.PI / 2, 0, -Math.PI)
        );

        this.orientation = new THREE.Quaternion();
        this.throttle = 1.0;
        
      
        this.maneuveringThrust = 0; 
        this.lateralThrust = 0; 
        
     
        this.stageStartTime = 0; 
        


        this.srbDetachedBoost = 1.0; 
        this.srbDetachedBoostTime = 0; 

        console.log("ShuttlePhysics Initialized:");
        console.log(`  Initial Position: (${this.position.x.toFixed(0)}, ${this.position.y.toFixed(0)}, ${this.position.z.toFixed(0)}) m (from Earth center)`);
        console.log(`  Initial Altitude: ${(this.position.y - PhysicsConstants.EARTH_RADIUS).toFixed(0)} m`);
        console.log(`  Initial Total Mass: ${this.calculateTotalMass().toFixed(2)} kg`);
    }


    setLaunchPad(launchPad) {
        const newLocal = this;
        newLocal.launchPad = launchPad;
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

        let effectiveArea = crossSectionalArea;
        const speedSq = velocity.lengthSq();
        if (speedSq > 0.0001) {
            const velDir = velocity.clone().normalize();
            const fwdDir = this.forwardVector.clone().normalize();
            const cosAoA = THREE.MathUtils.clamp(velDir.dot(fwdDir), -1, 1);
            const aoa = Math.acos(cosAoA);
            const areaScale = Math.sin(aoa); 
           
            effectiveArea = crossSectionalArea * (0.15 + 0.85 * areaScale);
        }

        const velocityMagnitudeSq = speedSq;
        if (velocityMagnitudeSq === 0 || isNaN(velocityMagnitudeSq) || !isFinite(velocityMagnitudeSq)) return new THREE.Vector3();

        const dragForceMagnitude = 0.5 * airDensity * dragCoefficient * effectiveArea * velocityMagnitudeSq;

        if (isNaN(dragForceMagnitude) || !isFinite(dragForceMagnitude)) {
            console.warn("Drag force magnitude became NaN/Infinity. Returning zero force.");
            return new THREE.Vector3();
        }

        return velocity.clone().normalize().multiplyScalar(-dragForceMagnitude);
    }

    calculateThrustMagnitude() {
    let currentThrustMagnitude = 0;

    switch (this.stage) {
        case ShuttleStages.IDLE:
            currentThrustMagnitude = 0;
            break;
        case ShuttleStages.ENGINE_STARTUP:
            currentThrustMagnitude = PhysicsConstants.THRUST_ENGINE_STARTUP;
            break;
        case ShuttleStages.LIFTOFF:
           
            if(this.fuelPercentage > 0) {
                currentThrustMagnitude += PhysicsConstants.THRUST_MAIN_ENGINES;
            }
            if(this.isRocket1Attached) {
                currentThrustMagnitude += (PhysicsConstants.THRUST_SOLID_ROCKETS / 2);
            }
            if (this.isRocket2Attached) {
                currentThrustMagnitude += (PhysicsConstants.THRUST_SOLID_ROCKETS / 2);
            }
            break;
        case ShuttleStages.GRAVITY_TURN: 
            if(this.fuelPercentage > 0) {
                const ssmeBase = PhysicsConstants.THRUST_MAIN_ENGINES;
                
                let ssmeBoost = this.srbDetached ? PhysicsConstants.MAIN_ENGINE_THRUST_BOOST_AFTER_SRB : 1.0;
               
                if (this.srbDetached && this.srbDetachedBoost > 1.0) {
                    ssmeBoost *= this.srbDetachedBoost;
                }
                currentThrustMagnitude += ssmeBase * ssmeBoost;
            }
            if(this.isRocket1Attached) {
                currentThrustMagnitude += (PhysicsConstants.THRUST_SOLID_ROCKETS / 2);
            }
            if (this.isRocket2Attached) {
                currentThrustMagnitude += (PhysicsConstants.THRUST_SOLID_ROCKETS / 2);
            }
            break;
        case ShuttleStages.ATMOSPHERIC_ASCENT:
            if (this.fuelPercentage > 0) {
                const ssmeBase = PhysicsConstants.THRUST_MAIN_ENGINES;
                
                let ssmeBoost = this.srbDetached ? PhysicsConstants.MAIN_ENGINE_THRUST_BOOST_AFTER_SRB : 1.0;
              
                if (this.srbDetached && this.srbDetachedBoost > 1.0) {
                    ssmeBoost *= this.srbDetachedBoost;
                }
                currentThrustMagnitude += ssmeBase * ssmeBoost;
            }
            
            if (this.isRocket1Attached) {
                currentThrustMagnitude += (PhysicsConstants.THRUST_SOLID_ROCKETS / 2);
            }
            if (this.isRocket2Attached) {
                currentThrustMagnitude += (PhysicsConstants.THRUST_SOLID_ROCKETS / 2);
            }
            break;
        case ShuttleStages.ORBITAL_INSERTION:
            if (this.etDetached) {
                const omsBase = PhysicsConstants.THRUST_OMS;
                const omsBoost = PhysicsConstants.OMS_THRUST_BOOST_AFTER_ET;
                currentThrustMagnitude += omsBase * omsBoost;
            } else {
                if (this.fuelPercentage > 0) {
                    currentThrustMagnitude += PhysicsConstants.THRUST_MAIN_ENGINES;
                }
            }
            
           
            if (Math.abs(this.maneuveringThrust) > 0.1) {
                const maneuveringThrustMagnitude = PhysicsConstants.THRUST_OMS * Math.abs(this.maneuveringThrust);
                currentThrustMagnitude += maneuveringThrustMagnitude;
            }
            break;
        case ShuttleStages.ORBITAL_STABILIZATION:
           
            currentThrustMagnitude = 0;
            break;
        case ShuttleStages.FREE_SPACE_MOTION:
           
            if (Math.abs(this.maneuveringThrust) > 0.1) {
                const maneuveringThrustMagnitude = PhysicsConstants.THRUST_OMS * Math.abs(this.maneuveringThrust);
                currentThrustMagnitude += maneuveringThrustMagnitude;
            }
            if (Math.abs(this.lateralThrust) > 0.1) {
                const lateralThrustMagnitude = PhysicsConstants.THRUST_OMS * Math.abs(this.lateralThrust);
                currentThrustMagnitude += lateralThrustMagnitude;
            }
            break;
        case ShuttleStages.ORBITAL_MANEUVERING:
           
            
            if (this.fuelPercentage > 0) {
                const ssmeBase = PhysicsConstants.THRUST_MAIN_ENGINES;
                const ssmeBoost = this.srbDetached ? PhysicsConstants.MAIN_ENGINE_THRUST_BOOST_AFTER_SRB : 1.0;
                const etBoost = this.etDetached ? PhysicsConstants.MAIN_ENGINE_THRUST_BOOST_AFTER_ET : 1.0;
                currentThrustMagnitude += ssmeBase * ssmeBoost * etBoost;
            } else if (this.etDetached) {
                
                const omsBase = PhysicsConstants.THRUST_OMS;
                const omsBoost = PhysicsConstants.OMS_THRUST_BOOST_AFTER_ET;
                currentThrustMagnitude += omsBase * omsBoost;
            }
            
           
            if (Math.abs(this.maneuveringThrust) > 0.1) {
                const maneuveringThrustMagnitude = PhysicsConstants.THRUST_OMS * Math.abs(this.maneuveringThrust);
                currentThrustMagnitude += maneuveringThrustMagnitude;
            }
            break;
        default:
            currentThrustMagnitude = 0;
    }

    return currentThrustMagnitude;
}

    // Returns the current thrust vector in world coordinates for HUD/diagnostics
    calculateThrust() {
        const magnitude = this.calculateThrustMagnitude();
        if (magnitude <= 0) {
            return new THREE.Vector3(0, 0, 0);
        }
        
        let thrustVector = this.forwardVector.clone().multiplyScalar(magnitude);
        
       
        if ((this.stage === ShuttleStages.ORBITAL_MANEUVERING || this.stage === ShuttleStages.ORBITAL_INSERTION || this.stage === ShuttleStages.FREE_SPACE_MOTION) && Math.abs(this.maneuveringThrust) > 0.1) {
            const maneuveringThrustMagnitude = PhysicsConstants.THRUST_OMS * Math.abs(this.maneuveringThrust);
            const maneuveringDirection = this.maneuveringThrust > 0 ? 1 : -1;
            thrustVector.add(this.forwardVector.clone().multiplyScalar(maneuveringThrustMagnitude * maneuveringDirection));
        }
        
       
        if ((this.stage === ShuttleStages.ORBITAL_MANEUVERING || this.stage === ShuttleStages.FREE_SPACE_MOTION) && Math.abs(this.lateralThrust) > 0.1) {
            const lateralThrustMagnitude = PhysicsConstants.THRUST_OMS * Math.abs(this.lateralThrust);
            const lateralDirection = this.lateralThrust > 0 ? 1 : -1;
           
            const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(this.orientation).normalize();
            thrustVector.add(rightVector.multiplyScalar(lateralThrustMagnitude * lateralDirection));
        }
        
        return thrustVector;
    }

    updateTilt(deltaTime) {
        if (this.stage !== ShuttleStages.IDLE && this.stage !== ShuttleStages.ENGINE_STARTUP) {
            const altitude = this.position.y - PhysicsConstants.EARTH_RADIUS;
            if (altitude >= PhysicsConstants.GRAVITY_TURN_START_ALTITUDE) {
            const startAlt = PhysicsConstants.GRAVITY_TURN_START_ALTITUDE;
            const endAlt   = PhysicsConstants.GRAVITY_TURN_END_ALTITUDE;
            const t = THREE.MathUtils.clamp((altitude - startAlt) / Math.max(1, (endAlt - startAlt)), 0, 1);
            this.tiltAngle = THREE.MathUtils.clamp(
                PhysicsConstants.INITIAL_TURN_ANGLE + t * (PhysicsConstants.MAX_TURN_ANGLE - PhysicsConstants.INITIAL_TURN_ANGLE),
                0,
                PhysicsConstants.MAX_TURN_ANGLE
            );
            }
        }
    }

    update(deltaTime) {
    
        if (deltaTime <= 0) {
            return;
        }

        this.force.set(0, 0, 0);

        let altitudeAtStartOfStep = this.position.y - PhysicsConstants.EARTH_RADIUS;

        
        const gravityForce = this.calculateGravityForce(this.position);
        this.force.add(gravityForce);
        
        
        if (this.stage === ShuttleStages.ORBITAL_STABILIZATION || 
            this.stage === ShuttleStages.FREE_SPACE_MOTION || 
            this.stage === ShuttleStages.ORBITAL_MANEUVERING) {
            
                
            const distance = this.position.length();
            const orbitalSpeed = Math.sqrt(PhysicsConstants.GRAVITY_CONSTANT * PhysicsConstants.EARTH_MASS / distance);
            const requiredCentripetalForce = this.calculateTotalMass() * orbitalSpeed * orbitalSpeed / distance;
            
          
            const balancedGravityForce = this.position.clone().normalize().multiplyScalar(-requiredCentripetalForce);
            this.force.add(balancedGravityForce);
        }

        if (this.stage === ShuttleStages.IDLE) {
            if (altitudeAtStartOfStep <= 0) {
                this.position.setY(PhysicsConstants.EARTH_RADIUS);
                this.velocity.set(0, 0, 0);
                this.acceleration.set(0, 0, 0);
                this.force.add(this.calculateNormalForce());
            }
        } else { 
            if (altitudeAtStartOfStep > 0 && altitudeAtStartOfStep < PhysicsConstants.ATMOSPHERE_HEIGHT) {
                this.force.add(this.calculateAirResistance(this.velocity, altitudeAtStartOfStep));
            }
            
            if (this.stage === ShuttleStages.ENGINE_STARTUP && altitudeAtStartOfStep <= 0) {
                this.position.setY(PhysicsConstants.EARTH_RADIUS);
                this.velocity.y = Math.max(0, this.velocity.y); 
                this.acceleration.y = Math.max(0, this.acceleration.y); 
            }
        }

        if (this.stage === ShuttleStages.GRAVITY_TURN || this.stage === ShuttleStages.ATMOSPHERIC_ASCENT) {
            const tiltQuat = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(1, 0, 0),
                THREE.MathUtils.degToRad(this.tiltAngle || 0)
            );
           
            this.orientation.copy(tiltQuat).multiply(this.spinQuaternion);
        }

       
        this.forwardVector.set(0, 1, 0).applyQuaternion(this.orientation).normalize();
        this.upVector.copy(this.forwardVector);

        const currentThrustMagnitude = this.calculateThrustMagnitude(); 

       
        let allowThrust = true;
        if (this.stage === ShuttleStages.ORBITAL_INSERTION) {
            const targetVelocityLEO = PhysicsConstants.ORBITAL_VELOCITY_LEO;

           
            const radialDir = this.position.clone().normalize();
            const horizontalVel = this.velocity.clone().sub(radialDir.multiplyScalar(this.velocity.dot(radialDir)));

            if (horizontalVel.length() >= targetVelocityLEO) {
                allowThrust = false;
            }
        }
        if(currentThrustMagnitude > 0 && allowThrust) {
            let thrustVector = this.forwardVector.clone().multiplyScalar(currentThrustMagnitude * this.throttle);
            
           
            if (this.stage === ShuttleStages.ORBITAL_MANEUVERING || this.stage === ShuttleStages.ORBITAL_INSERTION || this.stage === ShuttleStages.FREE_SPACE_MOTION) {
                if (Math.abs(this.maneuveringThrust) > 0.1) {
                    const maneuveringThrustMagnitude = PhysicsConstants.THRUST_OMS * Math.abs(this.maneuveringThrust);
                    const maneuveringDirection = this.maneuveringThrust > 0 ? 1 : -1;
                    thrustVector.add(this.forwardVector.clone().multiplyScalar(maneuveringThrustMagnitude * maneuveringDirection));
                }
                
                if ((this.stage === ShuttleStages.ORBITAL_MANEUVERING || this.stage === ShuttleStages.FREE_SPACE_MOTION) && Math.abs(this.lateralThrust) > 0.1) {
                    const lateralThrustMagnitude = PhysicsConstants.THRUST_OMS * Math.abs(this.lateralThrust);
                    const lateralDirection = this.lateralThrust > 0 ? 1 : -1;
                    const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(this.orientation).normalize();
                    thrustVector.add(rightVector.multiplyScalar(lateralThrustMagnitude * lateralDirection));
                }
            }
            
            this.force.add(thrustVector);
        }

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

        if (this.fuelPercentage > 0 && currentThrustMagnitude > 0) {
            let actualBurnRate = 0;
            if (this.stage === ShuttleStages.LIFTOFF ||
                this.stage === ShuttleStages.GRAVITY_TURN ||
                this.stage === ShuttleStages.ATMOSPHERIC_ASCENT ||
                this.stage === ShuttleStages.ORBITAL_INSERTION ||
                this.stage === ShuttleStages.ORBITAL_MANEUVERING) {

                if (this.forwardVector.y > 0) {
                    actualBurnRate = mainEngineFuelBurnRate;
                }

                const fuelMassInTank = this.externalTankInitialTotalMass * (this.fuelPercentage / 100);
                actualBurnRate = Math.min(actualBurnRate, fuelMassInTank / deltaTime);

                const fuelPercentageConsumed = (actualBurnRate * deltaTime / this.externalTankInitialTotalMass) * 100;
                let newFuelPercent = Math.max(0, this.fuelPercentage - fuelPercentageConsumed);
                this.fuelPercentage = newFuelPercent;

                if (isNaN(this.fuelPercentage) || !isFinite(this.fuelPercentage)) {
                    console.error("Fuel percentage became NaN/Infinity. Clamping to 0.");
                    this.fuelPercentage = 0;
                }
                // If fuel is zero, detach ET immediately
                if (this.fuelPercentage <= 0 && this.isFuelTankAttached && !this.etDetached) {
                    this.fuelPercentage = 0;
                    this.detachComponent('fuelTank');
                    this.etDetached = true;
                    console.log(`External Fuel Tank detached due to fuel depletion at ${this.time.toFixed(2)}s, Altitude: ${altitudeAtStartOfStep.toFixed(0)}m`);
                }
            }
        }

        this.time += deltaTime;

       
        if (this.srbDetachedBoost > 1.0) {
            const timeSinceBoost = this.time - this.srbDetachedBoostTime;
            if (timeSinceBoost > 10) { 
                this.srbDetachedBoost = Math.max(1.0, this.srbDetachedBoost - 0.1 * deltaTime);
            }
        }


        if (this.stage === ShuttleStages.ORBITAL_MANEUVERING) {
            
            if (Math.abs(this.maneuveringThrust) > 0.01) {
                this.maneuveringThrust *= 0.95; 
            } else {
                this.maneuveringThrust = 0;
            }
            
            if (Math.abs(this.lateralThrust) > 0.01) {
                    this.lateralThrust *= 0.95; 
            } else {
                this.lateralThrust = 0;
            }
        }

        this.updateTilt(deltaTime);

        if (this.stage === ShuttleStages.ENGINE_STARTUP) {
            this.engineStartupTimer += deltaTime;
        } else {
            this.engineStartupTimer = 0;
        }


        this.updateStage(currentAltitude, deltaTime);
        this.handleComponentDetachment(currentAltitude, this.time, this.velocity.length());

        if (this.isSpinning) {
            const step = THREE.MathUtils.degToRad(this.spinSpeedDeg) * deltaTime;
            const remaining = this.spinTargetAngleRad - this.spinAccumulatedRad;
            const stepClamped = Math.min(step, remaining);

            const spinStepQuaternion = new THREE.Quaternion()
                .setFromAxisAngle(this.spinAxis, stepClamped);

            this.spinQuaternion.multiply(spinStepQuaternion); 
            this.spinAccumulatedRad += stepClamped;

            if (this.spinAccumulatedRad >= this.spinTargetAngleRad - 1e-6) {
                this.isSpinning = false; 
            }
            
        }

        this.forwardVector.set(0, 1, 0).applyQuaternion(this.orientation).normalize();

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
                if (currentAltitude >= PhysicsConstants.GRAVITY_TURN_START_ALTITUDE) {
                    this.stage = ShuttleStages.GRAVITY_TURN;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s, Alt: ${currentAltitude.toFixed(0)}m`);
                }
                break;
            case ShuttleStages.GRAVITY_TURN:
                
                if (currentAltitude >= PhysicsConstants.ATMOSPHERE_HEIGHT * 0.5) {
                    this.stage = ShuttleStages.ATMOSPHERIC_ASCENT;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${currentAltitude.toFixed(0)}m`);
                }
                break;
            case ShuttleStages.ATMOSPHERIC_ASCENT:
                
               
                break;
            case ShuttleStages.ORBITAL_INSERTION: {
                const targetAltitudeLEO = PhysicsConstants.LOW_EARTH_ORBIT_ALTITUDE;  
                const targetVelocityLEO = PhysicsConstants.ORBITAL_VELOCITY_LEO;

                if (currentAltitude >= targetAltitudeLEO) {
                    const orbitalSpeed = Math.sqrt(
                        PhysicsConstants.GRAVITY_CONSTANT * PhysicsConstants.EARTH_MASS /
                        (PhysicsConstants.EARTH_RADIUS + targetAltitudeLEO)
                    );

                    const radialDir = this.position.clone().normalize();
                    let tangentDir = new THREE.Vector3().crossVectors(radialDir, new THREE.Vector3(0, 0, 1));

                    if (tangentDir.lengthSq() < 1e-6) {
                        tangentDir = new THREE.Vector3().crossVectors(radialDir, new THREE.Vector3(0, 1, 0));
                    }
                    tangentDir.normalize();

                    const desiredVelocity = tangentDir.multiplyScalar(orbitalSpeed);

                   
                    const lerpFactor = 0.02;
                    this.velocity.lerp(desiredVelocity, lerpFactor);

                  
                    const radialVel = this.velocity.dot(radialDir);
                    const horizontalVel = this.velocity.clone().sub(radialDir.multiplyScalar(radialVel));

                   
                    if (Math.abs(radialVel) < 50 && horizontalVel.length() >= orbitalSpeed * 0.8) {
                        this.velocity.copy(desiredVelocity);
                        this.stage = ShuttleStages.ORBITAL_STABILIZATION;
                        console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s`);
                        console.log(`Radial Velocity: ${radialVel.toFixed(2)} m/s, Horizontal Speed: ${horizontalVel.length().toFixed(2)} m/s`);
                    }
                } else {

                    const timeInInsertion = this.time - this.stageStartTime;
                    if (timeInInsertion > 30) { 
                        this.stage = ShuttleStages.ORBITAL_STABILIZATION;
                        this.stageStartTime = this.time; 
                        console.log(`Shuttle Stage: ${getStageLabel(this.stage)} - Auto transition after 30s in insertion`);
                    }
                }
                break;
            }

            case ShuttleStages.ORBITAL_STABILIZATION:
                
                if (this.acceleration.lengthSq() < 1.0 && velocityMagnitude > (PhysicsConstants.ORBITAL_VELOCITY_LEO * 0.7)) {
                    this.stage = ShuttleStages.FREE_SPACE_MOTION;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s`);
                }

                const timeInStabilization = this.time - this.stageStartTime;
                if (timeInStabilization > 20) { 
                    this.stage = ShuttleStages.FREE_SPACE_MOTION;
                    this.stageStartTime = this.time; 
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} - Auto transition after 20s in stabilization`);
                }
                break;
            case ShuttleStages.FREE_SPACE_MOTION:
               
                if (this.calculateThrustMagnitude() > 0 || Math.abs(this.maneuveringThrust) > 0.1 || Math.abs(this.lateralThrust) > 0.1) {
                    this.stage = ShuttleStages.ORBITAL_MANEUVERING;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s`);
                }
                break;
            case ShuttleStages.ORBITAL_MANEUVERING:
               
                if (this.calculateThrustMagnitude() === 0 && Math.abs(this.maneuveringThrust) < 0.1 && Math.abs(this.lateralThrust) < 0.1) {
                    this.stage = ShuttleStages.FREE_SPACE_MOTION;
                    console.log(`Shuttle Stage: ${getStageLabel(this.stage)} at ${this.time.toFixed(2)}s`);
                }
                break;
        }
    }

    handleComponentDetachment(altitude, currentTime) {
        
        if (!this.srbDetached && this.isRocket1Attached &&
            altitude >= PhysicsConstants.SRB_DETACH_ALTITUDE) {

            this.detachComponent('rocket1');
            this.detachComponent('rocket2');
            this.srbDetached = true;
            
                
            if (this.fuelPercentage > 0) {
                this.srbDetachedBoost = 1.5; 
                this.srbDetachedBoostTime = this.time; 
                console.log(`SRBs detached at ${currentTime.toFixed(2)}s, Altitude: ${altitude.toFixed(0)}m - Applying boost to main engines`);
            }
        }

        if (!this.etDetached && this.isFuelTankAttached &&
            altitude >= PhysicsConstants.FUEL_TANK_DETACH_ALTITUDE) {

          
            if (!this.isSpinning) {
                this.isSpinning = true;
                this.spinAxis.set(0, 1, 0);
                this.spinTargetAngleRad = Math.PI;
                this.spinAccumulatedRad = 0;
                console.log(`Starting rotation before fuel tank detachment at ${currentTime.toFixed(2)}s`);
            }
            
           
            if (this.spinAccumulatedRad >= this.spinTargetAngleRad * 0.8) { // فصل عند 80% من الدوران
                this.detachComponent('fuelTank');
                this.fuelPercentage = 0; 
                this.etDetached = true;
                
              
                this.stage = ShuttleStages.ORBITAL_INSERTION;
                this.stageStartTime = this.time;
                
                console.log(`External Fuel Tank detached at ${currentTime.toFixed(2)}s, Altitude: ${altitude.toFixed(0)}m`);
                console.log(`Stage transition to ORBITAL_INSERTION at ${currentTime.toFixed(2)}s`);
            }
        }
    }

    setStage(stage) {
        this.stage = stage;
        this.stageStartTime = this.time; 
        
        if (stage === ShuttleStages.ENGINE_STARTUP) {
            this.engineStartupTimer = 0;
            this.towerTilted = false; 
            this.tiltLocked = false;
        } else if (stage === ShuttleStages.IDLE) {
            this.towerTilted = false; 
            this.tiltLocked = false;
          
            this.maneuveringThrust = 0;
            this.lateralThrust = 0;
        } else if (stage === ShuttleStages.FREE_SPACE_MOTION) {
           
            this.maneuveringThrust = 0;
            this.lateralThrust = 0;
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