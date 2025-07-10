
// عد تنازلي قبل الإقلاع
let countdownElement = document.createElement('div');
countdownElement.style.position = 'absolute';
countdownElement.style.top = '40%';
countdownElement.style.left = '50%';
countdownElement.style.transform = 'translate(-50%, -50%)';
countdownElement.style.fontSize = '80px';
countdownElement.style.color = 'white';
countdownElement.style.fontFamily = 'Orbitron, sans-serif';
countdownElement.style.textShadow = '0 0 20px cyan';
document.body.appendChild(countdownElement);

let countdownTime = 30;
const countdownInterval = setInterval(() => {
    countdownElement.innerText = countdownTime > 0 ? countdownTime : 'Ignition!';
    countdownTime--;

    if (countdownTime < -1) {
        clearInterval(countdownInterval);
        countdownElement.remove();
    }
}, 1000);


// اللهب - مؤثر بسيط باستخدام THREE.Points
let flameParticles, flameGeometry, flameMaterial;

function createFlameEffect() {
    flameGeometry = new THREE.BufferGeometry();
    const count = 100;
    const positions = [];

    for (let i = 0; i < count; i++) {
        positions.push(
            (Math.random() - 0.5) * 0.5, // x
            -Math.random() * 2,          // y
            (Math.random() - 0.5) * 0.5  // z
        );
    }

    flameGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    flameMaterial = new THREE.PointsMaterial({
        color: 0xffa500,
        size: 0.2,
        transparent: true,
        opacity: 0.8
    });

    flameParticles = new THREE.Points(flameGeometry, flameMaterial);
    rocketGroup.add(flameParticles); // rocketGroup هو المجموعة التي تحتوي الصاروخ
}

function updateFlameEffect() {
    if (!flameParticles) return;

    const positions = flameGeometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
        positions[i] -= 0.1 + Math.random() * 0.1; // تحرك للأسفل
        if (positions[i] < -5) positions[i] = 0;
    }
    flameGeometry.attributes.position.needsUpdate = true;
}
