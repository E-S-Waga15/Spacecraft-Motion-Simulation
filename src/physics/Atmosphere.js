// src/physics/Atmosphere.js

// A simplified atmospheric model for air density calculation
// This is a basic exponential decay model. For higher fidelity,
// you would use a lookup table or a more complex model (e.g., ICAO Standard Atmosphere).
import { PhysicsConstants } from '../constants/PhysicsConstants';

export class Atmosphere {
    /**
     * Calculates air density at a given altitude using a simplified exponential model.
     * @param {number} altitude - Altitude above sea level in meters.
     * @returns {number} Air density in kg/m^3. Returns 0 if above ATMOSPHERE_HEIGHT.
     */
    static getDensity(altitude) {
        if (altitude < 0) {
            altitude = 0; // Clamp to sea level
        }
        if (altitude > PhysicsConstants.ATMOSPHERE_HEIGHT) {
            return 0; // Above atmosphere, density is negligible
        }

        // Simplified exponential model: rho = rho_0 * exp(-altitude / H_0)
        // rho_0 is air density at sea level (PhysicsConstants.AIR_DENSITY_SEA_LEVEL)
        // H_0 is scale height (approx 8.5 km for Earth's atmosphere, inversely related to AIR_DENSITY_DECAY_RATE)
        const density = PhysicsConstants.AIR_DENSITY_SEA_LEVEL * Math.exp(-altitude * PhysicsConstants.AIR_DENSITY_DECAY_RATE);

        if (isNaN(density) || !isFinite(density) || density < 0) {
            console.warn("Calculated air density is invalid. Clamping to 0.");
            return 0;
        }
        return density;
    }
}