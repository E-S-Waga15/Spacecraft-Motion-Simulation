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
    THRUST_OMS: 2 * 2600000, // N (Two OMS engines ~26 kN each)

    // Thrust scaling factors for specific phases
    MAIN_ENGINE_THRUST_BOOST_AFTER_SRB: 1.2, // Increase SSME thrust after SRB separation
    MAIN_ENGINE_THRUST_BOOST_AFTER_ET: 1.3, // Increase SSME thrust after ET detachment (113 km)
    OMS_THRUST_BOOST_AFTER_ET: 1.5, // Increase OMS thrust after ET detachment (pre-insertion)

    // جديد: الدفع المطلوب للحفاظ على المكوك ثابتًا أثناء بدء تشغيل المحركات
    // (الكتلة الإجمالية الأولية للمكوك * الجاذبية + هامش بسيط لمنع الغرق)
    THRUST_ENGINE_STARTUP: (110000 + 760000 + 2 * 590000) * 9.81 * 1.005, // N (تقريبًا 20.2 MN)

    // قيم افتراضية لـ Drag Coefficient و Cross-sectional Area
    DRAG_COEFFICIENT: 0.2, // Example value, needs tuning based on shuttle shape and orientation
    CROSS_SECTIONAL_AREA: 200, // m², Example value, largest cross-section during ascent

    // معدل استهلاك الوقود
    FUEL_CONSUMPTION_RATE: 4000, // kg/s (increased to ensure fuel runs out at 113 km altitude)

    // Orbital mechanics
    LOW_EARTH_ORBIT_ALTITUDE: 300000, // meters (transition to ORBITAL_STABILIZATION at 300 km)
    ORBITAL_INSERTION_ALTITUDE_MIN: 300000, // meters (enter insertion from 300 km)
    ORBITAL_INSERTION_ALTITUDE_MAX: 530000, // meters (up to 530 km)
    GEOSTATIONARY_ORBIT_ALTITUDE: 35786000, // meters
    ORBITAL_VELOCITY_LEO: 7800, // m/s (approximate for Low Earth Orbit)
    ORBITAL_VELOCITY_GEO: 3070, // m/s
    ORBITAL_VELOCITY_TOLERANCE: 50, // m/s (tolerance for orbital insertion velocity)

    // Detachment Altitudes and Times
    SRB_DETACH_ALTITUDE: 45000, // meters (SRBs detach at 45 km)
    FUEL_TANK_DETACH_ALTITUDE: 113000, // meters (Fuel tank detaches at 113 km)
    FUEL_TANK_DETACH_FUEL_PERCENT: 5, // % fuel remaining at detachment

    // مرحلة بدء تشغيل المحرك
    ENGINE_STARTUP_DURATION: 15, // seconds (مدة مرحلة بدء المحرك قبل الإقلاع الفعلي)

    GRAVITY_TURN_START_ALTITUDE: 1000,
    GRAVITY_TURN_END_ALTITUDE: 300000, // Extend gravity turn until 300 km
    INITIAL_TURN_ANGLE: 0,
    MAX_TURN_ANGLE: 88, // near-horizontal by ~300 km
    TURN_RATE: 0.5,

    ORBITAL_MANEUVERING_THRUST: 27000,
    OMS_THRUST_BOOST_AFTER_ET: 1.0,
    HOLD_ORBIT_THRUST: 110000 * 9.81,
};