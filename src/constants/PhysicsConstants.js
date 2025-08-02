// src/constants/PhysicsConstants.js
export const PhysicsConstants = {
    // Earth constants
    EARTH_RADIUS: 6371000, // meters
    EARTH_MASS: 5.972e24, // kg
    GRAVITY_CONSTANT: 6.67430e-11, // m³/kg/s²
    GRAVITY: 9.81, // m/s² (Standard gravity at Earth's surface)

    // Atmosphere constants
    ATMOSPHERE_HEIGHT: 100000, // meters
    AIR_DENSITY_SEA_LEVEL: 1.225, // kg/m³
    AIR_DENSITY_DECAY_RATE: 1 / 8500, // per meter (approx. for 8.5km scale height)

    // Space shuttle constants
    SHUTTLE_MASS: 110000, // kg (Dry mass of Orbiter)
    FUEL_TANK_MASS: 760000, // kg (Initial Total Mass of External Tank, including fuel)
    ROCKET_MASS: 590000, // kg (Initial Total Mass of ONE Solid Rocket Booster, including fuel)

    // تصحيح قيم الدفع بناءً على البيانات الفعلية
    THRUST_MAIN_ENGINES: 3 * 1.75e6, // N (Total for 3 main engines, each approx 1.75MN) = 5.25e6 N
    THRUST_SOLID_ROCKETS: 2 * 14.7e6, // N (Total for 2 SRBs, each approx 14.7MN) = 29.4e6 N

    // جديد: الدفع المطلوب للحفاظ على المكوك ثابتًا أثناء بدء تشغيل المحركات
    // (الكتلة الإجمالية الأولية للمكوك * الجاذبية + هامش بسيط لمنع الغرق)
    THRUST_ENGINE_STARTUP: (110000 + 760000 + 2 * 590000) * 9.81 * 1.005, // N (تقريبًا 20.2 MN)

    // قيم افتراضية لـ Drag Coefficient و Cross-sectional Area
    DRAG_COEFFICIENT: 0.2, // Example value, needs tuning based on shuttle shape and orientation
    CROSS_SECTIONAL_AREA: 200, // m², Example value, largest cross-section during ascent

    // معدل استهلاك الوقود
    FUEL_CONSUMPTION_RATE: 460, // kg/s (Example for main engines)

    // Orbital mechanics
    LOW_EARTH_ORBIT_ALTITUDE: 200000, // meters (Example LEO altitude for transition)
    GEOSTATIONARY_ORBIT_ALTITUDE: 35786000, // meters
    ORBITAL_VELOCITY_LEO: 7800, // m/s (approximate for Low Earth Orbit)
    ORBITAL_VELOCITY_GEO: 3070, // m/s
    ORBITAL_VELOCITY_TOLERANCE: 50, // m/s (tolerance for orbital insertion velocity)

    // Detachment Altitudes and Times
    SRB_DETACH_ALTITUDE: 11000, // meters
    SRB_DETACH_TIME: 60, // seconds

    FUEL_TANK_DETACH_ALTITUDE: 15000, // meters
    FUEL_TANK_DETACH_TIME: 60, // seconds
    FUEL_TANK_DETACH_FUEL_PERCENT: 5, // % fuel remaining at detachment

    // مرحلة بدء تشغيل المحرك
    ENGINE_STARTUP_DURATION: 3, // seconds (مدة مرحلة بدء المحرك قبل الإقلاع الفعلي)
};