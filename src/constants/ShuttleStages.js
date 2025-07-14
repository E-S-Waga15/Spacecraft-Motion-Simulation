// ShuttleStages.js
export const ShuttleStages = {
    IDLE: 'IDLE',                    // حالة السكون
    ENGINE_STARTUP: 'ENGINE_STARTUP', // مرحلة تشغيل المحركات (جديد)
    LIFTOFF: 'LIFTOFF',             // مرحلة الإقلاع
    ATMOSPHERIC_ASCENT: 'ATMOSPHERIC_ASCENT', // مرحلة عبور الغلاف الجوي
    ORBITAL_INSERTION: 'ORBITAL_INSERTION', // مرحلة الدخول في المدار
    ORBITAL_STABILIZATION: 'ORBITAL_STABILIZATION', // مرحلة التوقف في الفضاء
    FREE_SPACE_MOTION: 'FREE_SPACE_MOTION', // مرحلة الحركة الحرة في الفضاء
    ORBITAL_MANEUVERING: 'ORBITAL_MANEUVERING' // مرحلة المناورات المدارية
};

export function getStageLabel(stage) {
    switch (stage) {
        case ShuttleStages.IDLE: return 'Idle';
        case ShuttleStages.ENGINE_STARTUP: return 'Engine Startup'; // إضافة التسمية
        case ShuttleStages.LIFTOFF: return 'Liftoff';
        case ShuttleStages.ATMOSPHERIC_ASCENT: return 'Atmospheric Ascent';
        case ShuttleStages.ORBITAL_INSERTION: return 'Orbital Insertion';
        case ShuttleStages.ORBITAL_STABILIZATION: return 'Orbital Stabilization';
        case ShuttleStages.FREE_SPACE_MOTION: return 'Free Space Motion';
        case ShuttleStages.ORBITAL_MANEUVERING: return 'Orbital Maneuvering';
        default: return stage || 'Unknown';
    }
}