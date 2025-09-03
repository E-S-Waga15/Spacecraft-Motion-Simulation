# Spacecraft Motion Simulation

A real-time, interactive 3D simulation of a space shuttle launch from pad to orbit. The project combines visually rich Web 3D assets with a simplified physics model for thrust, mass, and staging, alongside smoke/flame effects, multi-camera views, and an immersive space environment.

## Features
- **Launch & Staging Simulation**: Launch sequence and stage separation configured via `src/constants/ShuttleStages.js`, with tunable physics in `src/constants/PhysicsConstants.js`.
- **Simplified Physics Model**: Thrust, mass, gravity, and fuel consumption handled in `src/physics/ShuttlePhysics.js`, with unit utilities in `src/utils/Units.js`.
- **Rich Visual Environment**: Earth, stars, water, and high-resolution skybox textures in `public/skybox` and `src/objects/*`.
- **Particle Effects**: Custom smoke and fire systems in `src/Effects/CustomParticleSmoke.js` and `src/Effects/CustomParticleFire.js`, plus launch countdown visuals in `src/countdown_and_flame.js`.
- **Multiple Cameras**: Shuttle-tracking camera (`src/camera/ShuttleTrackingCamera.js`) and a free-look camera (`src/camera/FreeLookCamera.js`).
- **3D Models & Audio**: GLB models (shuttle, rocket, launch pad) in `public/models/*` and launch sounds in `public/sounds/*`.

## Tech Stack
- JavaScript (ES Modules)
- Vite (fast dev server and bundling)
- Web-based 3D assets (GLB models, textures, skybox)

## Project Structure
```
Spacecraft-Motion-Simulation/
├─ index.html
├─ vite.config.js
├─ package.json
├─ public/
│  ├─ models/ (GLB models: shuttle, rocket, launch pad, etc.)
│  ├─ skybox/ (cube textures)
│  ├─ sounds/ (launch SFX)
│  └─ texture/ (shared textures)
├─ src/
│  ├─ camera/ (FreeLook, ShuttleTracking)
│  ├─ constants/ (PhysicsConstants, ShuttleStages)
│  ├─ Effects/ (CustomParticleSmoke, CustomParticleFire)
│  ├─ objects/ (Earth, Water, Stars, LaunchPad, SpaceShuttle)
│  ├─ physics/ (ShuttlePhysics)
│  ├─ scenes/ (MainScene)
│  ├─ styles/ (main.css)
│  ├─ utils/ (Units)
│  ├─ countdown_and_flame.js
│  └─ main.js (app entry)
└─ style.css
```

## Getting Started
Prerequisites:
- Node.js and npm installed

Install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```

Open the local URL shown in the terminal (typically `http://localhost:5173`).

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Usage
- **Start launch**: Use the main UI controls to trigger the countdown and ignition; smoke and flame effects will play and the shuttle will lift off.
- **Switch cameras**: Toggle between the shuttle-tracking view and the free-look camera to explore the scene.
- **Navigate**: Use mouse and keyboard (per on-screen hints) to pan, orbit, and zoom.

## Customization
- Physics tuning: edit `src/constants/PhysicsConstants.js` (e.g., gravity, main engine thrust, mass, fuel consumption).
- Staging: update or add stages in `src/constants/ShuttleStages.js`.
- Assets: replace/add models and textures in `public/models`, `public/texture`, and `public/skybox`.

## Notes
- The physics model is intentionally simplified for real-time visuals and learning purposes, not for high-fidelity aerospace analysis.
- 3D asset attributions may be required depending on your distribution; verify licenses of included models and textures in `public/`.

## Roadmap (ideas)
- HUD overlays with altitude, velocity, and fuel readouts
- Basic guidance and control (pitch/yaw/roll inputs)
- Orbital insertion and simple trajectory visualization

## License
Specify your preferred license here (e.g., MIT). If reusing assets, include their licenses and attribution details.
