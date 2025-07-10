import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Units } from '../utils/Units';

export class WaterObject {
    constructor(earth) {
        this.earth = earth;
        this.radius = earth.getRadius();
        this.createWater();
    }

    createWater() {
        const waterSize = Units.toProjectUnits(30000);
        const waterGeometry = new THREE.PlaneGeometry(waterSize, waterSize);

        // Load water normal map
        const waterNormals = new THREE.TextureLoader().load(
            '/texture/waternormals.jpg',
            function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(250, 250);
            }
        );

        // Create water object
        this.water = new Water(waterGeometry, {
            textureWidth: 512,
            textureHeight: 2048,
            waterNormals: waterNormals,
            waterColor: 0x2b5378,
            distortionScale: 1,
            fog: false
        });

        // Rotate water to be horizontal
        this.water.rotation.x = -Math.PI / 2;

        // Define wave data
        const waves = {
            A: {
                direction: 45,      // Wave A direction in degrees
                steepness: 0.8,     // Increased wave A steepness (was 0.5)
                wavelength: 20      // Increased wave A wavelength (was 10)
            },
            B: {
                direction: -30,     // Wave B direction in degrees
                steepness: 0.7,     // Increased wave B steepness (was 0.4)
                wavelength: 40      // Increased wave B wavelength (was 20)
            }
        };

        // Modify shader to add wave properties
        this.water.material.onBeforeCompile = function (shader) {
            shader.uniforms.waveA = {
                value: [
                    Math.sin((waves.A.direction * Math.PI) / 180),
                    Math.cos((waves.A.direction * Math.PI) / 180),
                    waves.A.steepness,
                    waves.A.wavelength
                ]
            };
            shader.uniforms.waveB = {
                value: [
                    Math.sin((waves.B.direction * Math.PI) / 180),
                    Math.cos((waves.B.direction * Math.PI) / 180),
                    waves.B.steepness,
                    waves.B.wavelength
                ]
            };
        };

        // Position water at launch pad level
        this.water.position.y = this.radius + Units.toProjectUnits(-3); // Slightly above Earth's surface
    }

    update() {
        if (this.water) {
            this.water.material.uniforms['time'].value += 1.0 / 600.0;
        }
    }

    getObject() {
        return this.water;
    }
} 