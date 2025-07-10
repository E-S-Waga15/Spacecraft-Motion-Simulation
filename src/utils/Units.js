// src/utils/Units.js

export class Units {
    // --- Base Conversion Ratio ---
    // This factor defines how many Three.js "project units" represent 1 real-world meter.
    // Based on your previous definition: 1 meter = 0.05 project units
    static METERS_TO_PROJECT_UNITS_FACTOR = 0.05;

    // --- Real-world units (in meters) ---
    static METER = 1;
    static CENTIMETER = 0.01;
    static MILLIMETER = 0.001;
    static KILOMETER = 1000;

    // --- Common angles (in radians) ---
    static DEGREE_45 = Math.PI / 4;
    static DEGREE_90 = Math.PI / 2;
    static DEGREE_180 = Math.PI;
    static DEGREE_360 = Math.PI * 2;

    /**
     * Converts a real-world value from a specified unit to Three.js project units.
     * @param {number} realWorldValue - The value in real-world units (e.g., meters, kilometers).
     * @param {number} [fromUnit=Units.METER] - The unit of the realWorldValue (e.g., Units.METER, Units.KILOMETER).
     * @returns {number} The converted value in Three.js project units.
     */
    static toProjectUnits(realWorldValue, fromUnit = Units.METER) {
        // First, convert the realWorldValue to meters.
        const meters = realWorldValue * fromUnit;
        // Then, convert meters to project units using the base factor.
        return meters * Units.METERS_TO_PROJECT_UNITS_FACTOR;
    }

    /**
     * Converts a Three.js project unit value back to a specified real-world unit.
     * @param {number} projectValue - The value in Three.js project units.
     * @param {number} [toUnit=Units.METER] - The desired real-world unit for the output (e.g., Units.METER, Units.KILOMETER).
     * @returns {number} The converted value in the specified real-world unit.
     */
    static toRealWorld(projectValue, toUnit = Units.METER) {
        // First, convert project units to meters.
        const meters = projectValue / Units.METERS_TO_PROJECT_UNITS_FACTOR;
        // Then, convert meters to the desired real-world unit.
        return meters / toUnit;
    }

    // --- Helper methods for common conversions (simplified names) ---
    // These methods now call the main `toRealWorld` for consistency.

    /**
     * Converts a project unit value to meters.
     * @param {number} projectValue - The value in Three.js project units.
     * @returns {number} The converted value in meters.
     */
    static toMeters(projectValue) {
        return Units.toRealWorld(projectValue, Units.METER);
    }

    /**
     * Converts a project unit value to centimeters.
     * @param {number} projectValue - The value in Three.js project units.
     * @returns {number} The converted value in centimeters.
     */
    static toCentimeters(projectValue) {
        return Units.toRealWorld(projectValue, Units.CENTIMETER);
    }

    /**
     * Converts a project unit value to millimeters.
     * @param {number} projectValue - The value in Three.js project units.
     * @returns {number} The converted value in millimeters.
     */
    static toMillimeters(projectValue) {
        return Units.toRealWorld(projectValue, Units.MILLIMETER);
    }

    /**
     * Converts a project unit value to kilometers.
     * @param {number} projectValue - The value in Three.js project units.
     * @returns {number} The converted value in kilometers.
     */
    static toKilometers(projectValue) {
        return Units.toRealWorld(projectValue, Units.KILOMETER);
    }


    /**
     * Converts a real-world 3D position object to a Three.js project unit position object.
     * @param {{x: number, y: number, z: number}} realWorldPosition - The position in real-world units.
     * @param {number} [fromUnit=Units.METER] - The unit of the realWorldPosition.
     * @returns {{x: number, y: number, z: number}} The converted position in Three.js project units.
     */
    static getProjectPosition(realWorldPosition, fromUnit = Units.METER) {
        return {
            x: Units.toProjectUnits(realWorldPosition.x, fromUnit),
            y: Units.toProjectUnits(realWorldPosition.y, fromUnit),
            z: Units.toProjectUnits(realWorldPosition.z, fromUnit)
        };
    }

    /**
     * Converts a real-world 3D size object to a Three.js project unit size object.
     * @param {{width: number, height: number, depth: number}} realWorldSize - The size in real-world units.
     * @param {number} [fromUnit=Units.METER] - The unit of the realWorldSize.
     * @returns {{width: number, height: number, depth: number}} The converted size in Three.js project units.
     */
    static getProjectSize(realWorldSize, fromUnit = Units.METER) {
        return {
            width: Units.toProjectUnits(realWorldSize.width, fromUnit),
            height: Units.toProjectUnits(realWorldSize.height, fromUnit),
            depth: Units.toProjectUnits(realWorldSize.depth, fromUnit)
        };
    }


    // --- Helper methods for common operations (assuming these refer to project units for random generation) ---
    // These are general helper functions that return values directly in project units.
    static SMALL = 1;
    static MEDIUM = 5;
    static LARGE = 20;
    static MEDIUM_DISTANCE = 50;

    static getRandomSize(min = Units.SMALL, max = Units.LARGE) {
        return Math.random() * (max - min) + min;
    }

    static getRandomPosition(range = Units.MEDIUM_DISTANCE) {
        return {
            x: (Math.random() - 0.5) * range,
            y: (Math.random() - 0.5) * range,
            z: (Math.random() - 0.5) * range
        };
    }

    static getRandomRotation() {
        return {
            x: Math.random() * Units.DEGREE_360,
            y: Math.random() * Units.DEGREE_360,
            z: Math.random() * Units.DEGREE_360
        };
    }

    // Common object dimensions (assuming these return values in project units)
    static getCubeSize(size = Units.MEDIUM) {
        return {
            width: size,
            height: size,
            depth: size
        };
    }

    static getSphereSize(radius = Units.MEDIUM) {
        return {
            radius: radius
        };
    }

    static getPlaneSize(width = Units.MEDIUM, height = Units.MEDIUM) {
        return {
            width: width,
            height: height
        };
    }
}