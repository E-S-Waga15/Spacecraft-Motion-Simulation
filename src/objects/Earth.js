import * as THREE from 'three';
import { Units } from '../utils/Units';

export class Earth {
    constructor() {
        // Earth's radius in meters (6371km)
        this.radius = Units.toProjectUnits(6371000);
        // Earth's rotation speed (one rotation per 24 hours)
        this.rotationSpeed = 0;

        this.createEarth();
    }

    createEarth() {
        // Create Earth mesh with scaled radius
        const geometry = new THREE.SphereGeometry(this.radius, 718, 718);

        // Load textures
        const textureLoader = new THREE.TextureLoader();

        // Load different maps
        const diffuseMap = textureLoader.load('/texture/earth_atmos_2048.jpg');
        const bumpMap = textureLoader.load('/texture/earth_normal_2048.jpg');
        const specularMap = textureLoader.load('/texture/earth_specular_2048.jpg');

        // Configure textures
        diffuseMap.wrapS = diffuseMap.wrapT = THREE.RepeatWrapping;
        bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
        specularMap.wrapS = specularMap.wrapT = THREE.RepeatWrapping;

        // Create Earth material with textures
        const material = new THREE.MeshStandardMaterial({
            map: diffuseMap,
            bumpMap: bumpMap,
            bumpScale: 0.5,
            metalness: 0.0,
            roughness: 0.8,
            side: THREE.FrontSide,
            envMapIntensity: 1.0
        });

        this.earth = new THREE.Mesh(geometry, material);

        // Rotate Earth around X axis to change lake position (30 degrees)
        this.earth.rotation.x = THREE.MathUtils.degToRad(30);
    }

    update() {
        // Rotate Earth
        if (this.earth) {
            this.earth.rotation.y += this.rotationSpeed;
        }
    }

    getObject() {
        return this.earth;
    }

    getRadius() {
        return this.radius;
    }
} 