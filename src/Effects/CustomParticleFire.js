// src/Effects/CustomParticleFire.js

// ✅ استيرادات ESM القياسية من node_modules
import * as THREE from 'three'; 

// لا نحتاج لـ GLTFLoader أو OrbitControls هنا
// لأنها ستُستخدم في المكان الذي ستستدعي فيه هذا النظام (SpaceShuttle.js)

// Shaders - لا تتغير
const _VS = `
uniform float pointMultiplier;

attribute float size;
attribute float angle;
attribute vec4 colour;

varying vec4 vColour;
varying vec2 vAngle;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = size * pointMultiplier / gl_Position.w;

  vAngle = vec2(cos(angle), sin(angle));
  vColour = colour;
}`;

const _FS = `
uniform sampler2D diffuseTexture;

varying vec4 vColour;
varying vec2 vAngle;

void main() {
  vec2 coords = (gl_PointCoord - 0.5) * mat2(vAngle.x, vAngle.y, -vAngle.y, vAngle.x) + 0.5;
  gl_FragColor = texture2D(diffuseTexture, coords) * vColour;
}`;


// LinearSpline - لا تتغير
class LinearSpline {
  constructor(lerp) {
    this._points = [];
    this._lerp = lerp;
  }

  AddPoint(t, d) {
    this._points.push([t, d]);
  }

  Get(t) {
    let p1 = 0;

    for (let i = 0; i < this._points.length; i++) {
      if (this._points[i][0] >= t) {
        break;
      }
      p1 = i;
    }

    const p2 = Math.min(this._points.length - 1, p1 + 1);

    if (p1 == p2) {
      return this._points[p1][1];
    }

    return this._lerp(
        (t - this._points[p1][0]) / (
            this._points[p2][0] - this._points[p1][0]),
        this._points[p1][1], this._points[p2][1]);
  }
}

// ParticleSystem - تم تعديلها لتكون أكثر عمومية وقابلية للاستخدام
export class CustomParticleSystem {
    constructor(camera, parentObject, texturePath = '/resources/fire.png') {
        const uniforms = {
            diffuseTexture: {
                // ✅ تأكد من أن مسار الصورة صحيح بالنسبة لمجلد public
                value: new THREE.TextureLoader().load(texturePath) 
            },
            pointMultiplier: {
                value: window.innerHeight / (2.0 * Math.tan(0.5 * 60.0 * Math.PI / 180.0))
            }
        };

        this._material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: _VS,
            fragmentShader: _FS,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });

        this._camera = camera;
        this._particles = [];

        this._geometry = new THREE.BufferGeometry();
        this._geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
        this._geometry.setAttribute('size', new THREE.Float32BufferAttribute([], 1));
        this._geometry.setAttribute('colour', new THREE.Float32BufferAttribute([], 4));
        this._geometry.setAttribute('angle', new THREE.Float32BufferAttribute([], 1));

        this._points = new THREE.Points(this._geometry, this._material);
        this._points.visible = false; // ابدأ مخفياً
        parentObject.add(this._points); // إضافة نظام الجسيمات إلى الكائن الأب (المكوك أو المحرك)

        this._alphaSpline = new LinearSpline((t, a, b) => {
            return a + t * (b - a);
        });
        this._alphaSpline.AddPoint(0.0, 0.0);
        this._alphaSpline.AddPoint(0.1, 1.0);
        this._alphaSpline.AddPoint(0.6, 1.0);
        this._alphaSpline.AddPoint(1.0, 0.0);

        this._colourSpline = new LinearSpline((t, a, b) => {
            const c = a.clone();
            return c.lerp(b, t);
        });
        // ✅ الألوان يمكن تعديلها لتناسب لهب المحركات
        this._colourSpline.AddPoint(0.0, new THREE.Color(0xFFF990)); // أصفر فاتح جداً
        this._colourSpline.AddPoint(0.2, new THREE.Color(0xFF8C00)); // برتقالي داكن
        this._colourSpline.AddPoint(0.4, new THREE.Color(0xFF4500)); // برتقالي محمر
        this._colourSpline.AddPoint(1.0, new THREE.Color(0x330000)); // أحمر داكن / أسود (نهاية الدخان)


        this._sizeSpline = new LinearSpline((t, a, b) => {
            return a + t * (b - a);
        });
        this._sizeSpline.AddPoint(0.0, 1.0);
        this._sizeSpline.AddPoint(0.5, 5.0);
        this._sizeSpline.AddPoint(1.0, 1.0);

        this.gdfsghk = 0.0; 

        this._UpdateGeometry();
    }

 

    /**
     * يضيف جسيمات جديدة إلى النظام بناءً على الوقت المنقضي.
     * @param {number} timeElapsed الوقت المنقضي بالثواني.
     */
    _AddParticles(timeElapsed) {
        this.gdfsghk += timeElapsed;
        const n = Math.floor(this.gdfsghk * 100.0); 
        this.gdfsghk -= n / 100.0;

        for (let i = 0; i < n; i++) {
            const life = (Math.random() * 0.75 + 0.25) * 0.55; 

   
            const startPos = new THREE.Vector3(
                (Math.random() * 0.2 - 0.1), 
                (Math.random() * 0.2 - 0.1), 
                (Math.random() * 0.2 - 0.1) 
            );
            
        
            const initialVelocityMagnitude = Math.random() * 5 + 10; // 10-15
            const initialVelocity = new THREE.Vector3(
                (Math.random() * 0.5 - 0.25), 
                -initialVelocityMagnitude,   
                (Math.random() * 0.5 - 0.25)  
            );

            this._particles.push({
                position: startPos,
                size: (Math.random() * 0.5 + 0.5) * 4.0,
                colour: new THREE.Color(),
                alpha: 1.0,
                life: life,
                maxLife: life,
                rotation: Math.random() * 2.0 * Math.PI,
                velocity:  new THREE.Vector3(0, -15, 0),
            });
        }
    }

    _UpdateGeometry() {
        const positions = [];
        const sizes = [];
        const colours = [];
        const angles = [];

        for (let p of this._particles) {
            positions.push(p.position.z,p.position.x , p.position.y);
            colours.push(p.colour.r, p.colour.g, p.colour.b, p.alpha);
            sizes.push(p.currentSize);
            angles.push(p.rotation);
        }

        this._geometry.setAttribute(
            'position', new THREE.Float32BufferAttribute(positions, 3));
        this._geometry.setAttribute(
            'size', new THREE.Float32BufferAttribute(sizes, 1));
        this._geometry.setAttribute(
            'colour', new THREE.Float32BufferAttribute(colours, 4));
        this._geometry.setAttribute(
            'angle', new THREE.Float32BufferAttribute(angles, 1));
        
        this._geometry.attributes.position.needsUpdate = true;
        this._geometry.attributes.size.needsUpdate = true;
        this._geometry.attributes.colour.needsUpdate = true;
        this._geometry.attributes.angle.needsUpdate = true;
    }

    _UpdateParticles(timeElapsed) {
        for (let p of this._particles) {
            p.life -= timeElapsed;
        }

        this._particles = this._particles.filter(p => {
            return p.life > 0.0;
        });

        for (let p of this._particles) {
            const t = 1.0 - p.life / p.maxLife;

            p.rotation += timeElapsed * 0.5;
            p.alpha = this._alphaSpline.Get(t);
            p.currentSize = 1;
            p.colour.copy(this._colourSpline.Get(t));

            p.position.add(p.velocity.clone().multiplyScalar(timeElapsed));

            const drag = p.velocity.clone();
            drag.multiplyScalar(timeElapsed * 0.1);
            drag.x = Math.sign(p.velocity.x) * Math.min(Math.abs(drag.x), Math.abs(p.velocity.x));
            drag.y = Math.sign(p.velocity.y) * Math.min(Math.abs(drag.y), Math.abs(p.velocity.y));
            drag.z = Math.sign(p.velocity.z) * Math.min(Math.abs(drag.z), Math.abs(p.velocity.z));
            p.velocity.sub(drag);
        }

       
        this._particles.sort((a, b) => {
            const d1 = this._camera.position.distanceTo(this._points.localToWorld(a.position.clone()));
            const d2 = this._camera.position.distanceTo(this._points.localToWorld(b.position.clone()));

            if (d1 > d2) {
                return -1;
            }

            if (d1 < d2) {
                return 1;
            }

            return 0;
        });
    }

    /**
     * الخطوة الواحدة لتحديث نظام الجسيمات.
     * @param {number} timeElapsed الوقت المنقضي بالثواني.
     */
    update(timeElapsed) {
       
        if (this._points.visible) {
            this._AddParticles(timeElapsed);
            this._UpdateParticles(timeElapsed);
            this._UpdateGeometry();
        }
    }

    /**
     * لضبط رؤية نظام الجسيمات.
     * @param {boolean} visible
     */
    setVisibility(visible) {
        this._points.visible = visible;
    
        if (!visible) {
            this._particles = [];
            this._UpdateGeometry(); 
        }
    }

    /**
     * ينظف موارد نظام الجسيمات.
     */
    dispose() {
        this._geometry.dispose();
        this._material.dispose();
        if (this._points.parent) {
            this._points.parent.remove(this._points);
        }
    }
}



