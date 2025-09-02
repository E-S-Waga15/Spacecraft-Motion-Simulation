// src/objects/Stars.js
import * as THREE from 'three';

export class Stars {
    constructor() {
        this.stars = null;
        this.createStars();
    }

    createStars() {
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 2,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8
        });

        const starsCount = 15000;
        const positions = new Float32Array(starsCount * 3);
        const colors = new Float32Array(starsCount * 3);
        const sizes = new Float32Array(starsCount);

        for (let i = 0; i < starsCount; i++) {
            const radius = 1000000 + Math.random() * 5000000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            const starColor = new THREE.Color();
            starColor.setHSL(Math.random() * 0.1 + 0.9, 0.1, Math.random() * 0.3 + 0.7);
            colors[i * 3] = starColor.r;
            colors[i * 3 + 1] = starColor.g;
            colors[i * 3 + 2] = starColor.b;

            sizes[i] = Math.random() * 3 + 1;
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        this.stars = new THREE.Points(starsGeometry, starsMaterial);

        console.log('Stars created successfully with', starsCount, 'stars');
    }

    getObject() {
        return this.stars;
    }

    update(deltaTime) {
        if (this.stars) {
            this.stars.rotation.y += 0.0001 * deltaTime;
        }
    }
}
