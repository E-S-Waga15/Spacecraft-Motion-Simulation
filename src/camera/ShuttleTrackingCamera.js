// src/camera/ShuttleTrackingCamera.js

import * as THREE from 'three';
import { Units } from '../utils/Units';
import { PhysicsConstants } from '../constants/PhysicsConstants';

export class ShuttleTrackingCamera {
    constructor(shuttleModel) {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.shuttleModel = shuttleModel; // مرجع لنموذج المكوك (THREE.Group)

        // Orbit parameters
        this.currentAzimuthRadians = 0; // smoothed value
        this.targetAzimuthRadians = 0; // target after mouse drag
        this.azimuthDamping = 0.15; // 0..1 smoothing factor per frame

        // Vertical orbit (polar) parameters
        this.currentPolarRadians = THREE.MathUtils.degToRad(45); // smoothed value
        this.targetPolarRadians = THREE.MathUtils.degToRad(45); // target after mouse drag
        this.polarDamping = 0.15; // smoothing factor per frame
        this.minPolarRadians = THREE.MathUtils.degToRad(5); // allow lower camera angles
        this.maxPolarRadians = THREE.MathUtils.degToRad(175); // allow rotating down as well

        this.currentDistance = Units.toProjectUnits(250); // smoothed value
        this.targetDistance = Units.toProjectUnits(250); // target after wheel
        this.zoomDamping = 0.2; // 0..1 smoothing factor per frame

        this.minDistance = Units.toProjectUnits(80);
        this.maxDistance = Units.toProjectUnits(600);
        this.heightOffset = Units.toProjectUnits(50); // keep camera Y at shuttle Y + this
        // Look exactly at shuttle center to keep it in the middle of screen
        // The shuttle model has specific rotations, so we need to adjust the look-at point
        this.lookAtOffset = new THREE.Vector3(0, 0, 0);

        // وضع مبدئي للكاميرا
        this.camera.position.set(
            Units.toProjectUnits(0),
            Units.toProjectUnits(PhysicsConstants.EARTH_RADIUS + 200),
            Units.toProjectUnits(0)
        );
        this.camera.lookAt(new THREE.Vector3(0, Units.toProjectUnits(PhysicsConstants.EARTH_RADIUS), 0));

        this.isEnabled = false;

        // Mouse interaction state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.rotateSpeed = 0.005; // radians per pixel
        this.rotateSpeedY = 0.005; // radians per pixel for vertical

        // Bind event handlers
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onWheel = this._onWheel.bind(this);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    update() {
        if (!this.isEnabled) return;

        if (this.shuttleModel) {
            // Compute shuttle's world position for accurate tracking
            const center = new THREE.Vector3();
            this.shuttleModel.getWorldPosition(center);
            
            // The shuttle model has specific rotations applied (-90° X, -90° Z)
            // We need to account for the model's center of mass position
            const modelMatrix = this.shuttleModel.matrixWorld;
            const modelCenter = new THREE.Vector3(0, 0, 0);
            modelCenter.applyMatrix4(modelMatrix);
            
            // Calculate the actual center point considering the model's orientation
            const adjustedCenter = center.clone();
            // Add offset to center the view properly on the shuttle
            adjustedCenter.add(this.lookAtOffset);
            
            // Smoothly approach target angles and distance
            this.currentAzimuthRadians += (this.targetAzimuthRadians - this.currentAzimuthRadians) * this.azimuthDamping;
            this.currentPolarRadians += (this.targetPolarRadians - this.currentPolarRadians) * this.polarDamping;
            this.currentDistance += (this.targetDistance - this.currentDistance) * this.zoomDamping;

            // Spherical to Cartesian conversion
            const radius = this.currentDistance;
            const theta = this.currentAzimuthRadians; // around Y axis
            const phi = this.currentPolarRadians; // from Y+ axis

            const horizontalRadius = radius * Math.sin(phi);
            const yOffset = radius * Math.cos(phi);

            const camX = adjustedCenter.x + horizontalRadius * Math.cos(theta);
            const camY = adjustedCenter.y + yOffset;
            const camZ = adjustedCenter.z + horizontalRadius * Math.sin(theta);

            this.camera.position.set(camX, camY, camZ);
            this.camera.lookAt(adjustedCenter);
            
            // Debug logging to help troubleshoot camera positioning
            if (this.debugCounter === undefined) this.debugCounter = 0;
            if (this.debugCounter++ % 60 === 0) { // Log every 60 frames (1 second at 60fps)
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
            // Snap immediately to target so rocket is centered instantly
            this.currentAzimuthRadians = this.targetAzimuthRadians;
            this.currentPolarRadians = this.targetPolarRadians = THREE.MathUtils.clamp(this.currentPolarRadians, this.minPolarRadians, this.maxPolarRadians);
            this.currentDistance = this.targetDistance = THREE.MathUtils.clamp(this.currentDistance, this.minDistance, this.maxDistance);
            // Run an immediate update to ensure correct camera pose on enable
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
        this.targetAzimuthRadians -= deltaX * this.rotateSpeed; // drag right rotates camera clockwise
        this.targetPolarRadians += deltaY * this.rotateSpeedY; // drag up moves camera higher (smaller polar)
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