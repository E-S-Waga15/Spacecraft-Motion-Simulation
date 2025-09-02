import * as THREE from 'three';
import { Units } from '../utils/Units';
import { PhysicsConstants } from '../constants/PhysicsConstants';

export class ShuttleTrackingCamera {
    constructor(shuttleModel) {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.shuttleModel = shuttleModel;

        this.currentAzimuthRadians = 0;
        this.targetAzimuthRadians = 0;
        this.azimuthDamping = 0.15;

        this.currentPolarRadians = THREE.MathUtils.degToRad(45);
        this.targetPolarRadians = THREE.MathUtils.degToRad(45);
        this.polarDamping = 0.15;
        this.minPolarRadians = THREE.MathUtils.degToRad(5);
        this.maxPolarRadians = THREE.MathUtils.degToRad(175);

        this.currentDistance = Units.toProjectUnits(250);
        this.targetDistance = Units.toProjectUnits(250);
        this.zoomDamping = 0.2;

        this.minDistance = Units.toProjectUnits(80);
        this.maxDistance = Units.toProjectUnits(600);
        this.heightOffset = Units.toProjectUnits(50);
        this.lookAtOffset = new THREE.Vector3(0, 0, 0);

        this.camera.position.set(
            Units.toProjectUnits(0),
            Units.toProjectUnits(PhysicsConstants.EARTH_RADIUS + 200),
            Units.toProjectUnits(0)
        );
        this.camera.lookAt(new THREE.Vector3(0, Units.toProjectUnits(PhysicsConstants.EARTH_RADIUS), 0));

        this.isEnabled = false;

        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.rotateSpeed = 0.005;
        this.rotateSpeedY = 0.005;

        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
        
        this.detachmentEffect = {
            isActive: false,
            startTime: 0,
            duration: 3.0,
            originalPolar: this.currentPolarRadians,
            targetPolar: this.currentPolarRadians + THREE.MathUtils.degToRad(30)
        };
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    update() {
        if (!this.isEnabled) return;

        if (this.shuttleModel) {
            const center = new THREE.Vector3();
            this.shuttleModel.getWorldPosition(center);
            
            const modelMatrix = this.shuttleModel.matrixWorld;
            const modelCenter = new THREE.Vector3(0, 0, 0);
            modelCenter.applyMatrix4(modelMatrix);
            
            const adjustedCenter = center.clone();
            adjustedCenter.add(this.lookAtOffset);
            
            if (this.detachmentEffect.isActive) {
                const currentTime = performance.now() / 1000;
                const elapsedTime = currentTime - this.detachmentEffect.startTime;
                const progress = Math.min(elapsedTime / this.detachmentEffect.duration, 1.0);
                
                if (progress < 0.5) {
                    const lookDownProgress = progress * 2;
                    this.targetPolarRadians = THREE.MathUtils.lerp(
                        this.detachmentEffect.originalPolar,
                        this.detachmentEffect.targetPolar,
                        lookDownProgress
                    );
                } else {
                    const lookUpProgress = (progress - 0.5) * 2;
                    this.targetPolarRadians = THREE.MathUtils.lerp(
                        this.detachmentEffect.targetPolar,
                        this.detachmentEffect.originalPolar,
                        lookUpProgress
                    );
                }
                
                if (progress >= 1.0) {
                    this.detachmentEffect.isActive = false;
                    this.targetPolarRadians = this.detachmentEffect.originalPolar;
                    console.log('Camera detachment effect completed');
                }
            }
            
            this.currentAzimuthRadians += (this.targetAzimuthRadians - this.currentAzimuthRadians) * this.azimuthDamping;
            this.currentPolarRadians += (this.targetPolarRadians - this.currentPolarRadians) * this.polarDamping;
            this.currentDistance += (this.targetDistance - this.currentDistance) * this.zoomDamping;

            const radius = this.currentDistance;
            const theta = this.currentAzimuthRadians;
            const phi = this.currentPolarRadians;

            const horizontalRadius = radius * Math.sin(phi);
            const yOffset = radius * Math.cos(phi);

            const camX = adjustedCenter.x + horizontalRadius * Math.cos(theta);
            const camY = adjustedCenter.y + yOffset;
            const camZ = adjustedCenter.z + horizontalRadius * Math.sin(theta);

            this.camera.position.set(camX, camY, camZ);
            this.camera.lookAt(adjustedCenter);
            
            if (this.debugCounter === undefined) this.debugCounter = 0;
            if (this.debugCounter++ % 60 === 0) {
                console.log('ShuttleTrackingCamera Debug:', {
                    shuttlePosition: center.toArray().map(v => v.toFixed(2)),
                    adjustedCenter: adjustedCenter.toArray().map(v => v.toFixed(2)),
                    cameraPosition: this.camera.position.toArray().map(v => v.toFixed(2)),
                    lookAtTarget: adjustedCenter.toArray().map(v => v.toFixed(2))
                });
            }
        }
    }

    setEnabled(enabled) {
        if (this.isEnabled === enabled) return;
        this.isEnabled = enabled;
        if (enabled) {
            this.currentAzimuthRadians = this.targetAzimuthRadians;
            this.currentPolarRadians = this.targetPolarRadians = THREE.MathUtils.clamp(this.currentPolarRadians, this.minPolarRadians, this.maxPolarRadians);
            this.currentDistance = this.targetDistance = THREE.MathUtils.clamp(this.currentDistance, this.minDistance, this.maxDistance);
            this.update();
            window.addEventListener('mousedown', this._onMouseDown);
            window.addEventListener('mousemove', this._onMouseMove);
            window.addEventListener('mouseup', this._onMouseUp);
            window.addEventListener('wheel', this._onWheel, { passive: true });
        } else {
            window.removeEventListener('mousedown', this._onMouseDown);
            window.removeEventListener('mousemove', this._onMouseMove);
            window.removeEventListener('mouseup', this._onMouseUp);
            window.removeEventListener('wheel', this._onWheel);
            this.isDragging = false;
        }
    }

    getCamera() {
        return this.camera;
    }
    
    triggerDetachmentEffect() {
        this.detachmentEffect.isActive = true;
        this.detachmentEffect.startTime = performance.now() / 1000;
        this.detachmentEffect.originalPolar = this.currentPolarRadians;
        this.detachmentEffect.targetPolar = this.currentPolarRadians + THREE.MathUtils.degToRad(30);
        console.log('Camera detachment effect triggered');
    }

    _onMouseDown(event) {
        if (!this.isEnabled) return;
        this.isDragging = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
    }

    _onMouseMove(event) {
        if (!this.isEnabled || !this.isDragging) return;
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.targetAzimuthRadians -= deltaX * this.rotateSpeed;
        this.targetPolarRadians += deltaY * this.rotateSpeedY;
        this.targetPolarRadians = THREE.MathUtils.clamp(this.targetPolarRadians, this.minPolarRadians, this.maxPolarRadians);
    }

    _onMouseUp() {
        this.isDragging = false;
    }

    _onWheel(event) {
        if (!this.isEnabled) return;
        const delta = Math.sign(event.deltaY);
        const zoomStep = Units.toProjectUnits(20);
        this.targetDistance = THREE.MathUtils.clamp(
            this.currentDistance + delta * zoomStep,
            this.minDistance,
            this.maxDistance
        );
    }
}