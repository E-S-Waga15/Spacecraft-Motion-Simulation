// src/camera/ShuttleTrackingCamera.js

import * as THREE from 'three';
import { Units } from '../utils/Units';
import { PhysicsConstants } from '../constants/PhysicsConstants';

export class ShuttleTrackingCamera {
    constructor(shuttleModel) {
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.shuttleModel = shuttleModel; // مرجع لنموذج المكوك (THREE.Group)

        // الإزاحة من المكوك (تم تعديل هذه القيم)
        this.offset = new THREE.Vector3(
            Units.toProjectUnits(0),     // لا يوجد إزاحة على X
            Units.toProjectUnits(80),    // 80 متر أعلى من المكوك (قربت قليلاً)
            Units.toProjectUnits(200)    // 200 متر أمام المكوك (كانت -300، الآن 200)
        );
        // النقطة التي تنظر إليها الكاميرا بالنسبة للمكوك (أعلى قليلاً من مركز المكوك)
        this.lookAtOffset = new THREE.Vector3(
            Units.toProjectUnits(0),
            Units.toProjectUnits(50),    // انظر إلى نقطة أعلى بـ 50 متر من مركز المكوك
            Units.toProjectUnits(0)
        );

        // وضع مبدئي للكاميرا
        this.camera.position.set(
            Units.toProjectUnits(0),
            Units.toProjectUnits(PhysicsConstants.EARTH_RADIUS + 200),
            Units.toProjectUnits(0)
        );
        this.camera.lookAt(new THREE.Vector3(0, Units.toProjectUnits(PhysicsConstants.EARTH_RADIUS), 0));

        this.isEnabled = false;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    update() {
        if (!this.isEnabled) return;

        if (this.shuttleModel) {
            const shuttlePosition = this.shuttleModel.position;

            const tempVector = new THREE.Vector3();
            const shuttleQuaternion = this.shuttleModel.quaternion;

            // تطبيق الإزاحة بالنسبة لدوران المكوك
            tempVector.copy(this.offset).applyQuaternion(shuttleQuaternion);
            this.camera.position.copy(shuttlePosition).add(tempVector);

            // حساب نقطة النظر بتطبيق الإزاحة النسبية لدوران المكوك
            const lookAtTarget = new THREE.Vector3();
            lookAtTarget.copy(this.lookAtOffset).applyQuaternion(shuttleQuaternion);
            this.camera.lookAt(shuttlePosition.clone().add(lookAtTarget));
        }
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    getCamera() {
        return this.camera;
    }
}