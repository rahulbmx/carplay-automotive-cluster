/**
 * CNG Speed (km/h) to Mileage (km/kg) Lookup Table & Calibration Engine
 * Exact 56-point calibration table with continuous linear interpolation.
 */

const CNG_CALIBRATION_TABLE = [
  { speed: 10, mileage: 13.0 },
  { speed: 12, mileage: 14.2 },
  { speed: 14, mileage: 15.4 },
  { speed: 16, mileage: 16.6 },
  { speed: 18, mileage: 17.8 },
  { speed: 20, mileage: 19.0 },
  { speed: 22, mileage: 20.0 },
  { speed: 24, mileage: 21.0 },
  { speed: 26, mileage: 22.0 },
  { speed: 28, mileage: 23.0 },
  { speed: 30, mileage: 24.0 },
  { speed: 32, mileage: 24.7 },
  { speed: 34, mileage: 25.4 },
  { speed: 36, mileage: 26.1 },
  { speed: 38, mileage: 26.8 },
  { speed: 40, mileage: 27.5 },
  { speed: 42, mileage: 27.9 },
  { speed: 44, mileage: 28.3 },
  { speed: 46, mileage: 28.7 },
  { speed: 48, mileage: 29.1 },
  { speed: 50, mileage: 29.5 },
  { speed: 52, mileage: 29.8 },
  { speed: 54, mileage: 30.1 },
  { speed: 56, mileage: 30.4 },
  { speed: 58, mileage: 30.7 },
  { speed: 60, mileage: 31.0 },
  { speed: 62, mileage: 33.8 },
  { speed: 64, mileage: 36.6 },
  { speed: 66, mileage: 39.4 },
  { speed: 68, mileage: 42.2 },
  { speed: 70, mileage: 45.0 }, // Peak Efficiency Calibration Point
  { speed: 72, mileage: 43.0 },
  { speed: 74, mileage: 41.0 },
  { speed: 76, mileage: 39.0 },
  { speed: 78, mileage: 37.0 },
  { speed: 80, mileage: 35.0 },
  { speed: 82, mileage: 33.3 },
  { speed: 84, mileage: 31.6 },
  { speed: 86, mileage: 29.9 },
  { speed: 88, mileage: 28.2 },
  { speed: 90, mileage: 26.5 },
  { speed: 92, mileage: 25.9 },
  { speed: 94, mileage: 25.3 },
  { speed: 96, mileage: 24.7 },
  { speed: 98, mileage: 24.1 },
  { speed: 100, mileage: 23.5 },
  { speed: 102, mileage: 22.9 },
  { speed: 104, mileage: 22.3 },
  { speed: 106, mileage: 21.7 },
  { speed: 108, mileage: 21.1 },
  { speed: 110, mileage: 20.5 },
  { speed: 112, mileage: 19.9 },
  { speed: 114, mileage: 19.3 },
  { speed: 116, mileage: 18.7 },
  { speed: 118, mileage: 18.1 },
  { speed: 120, mileage: 17.5 }
];

/**
 * Calculates instantaneous CNG mileage and fuel flow rate based on vehicle speed.
 * @param {number} speedKmh - Current vehicle speed in km/h.
 * @returns {{ mileage: number, fuelRateKgH: number, isStopped: boolean }}
 */
function calculateCngTelemetry(speedKmh) {
  const speed = Math.max(0, Number(speedKmh) || 0);

  // 1. Idle condition: speed <= 0.8 km/h
  if (speed <= 0.8) {
    return {
      speedKmh: speed,
      mileage: 0.0,
      fuelRateKgH: 0.35, // Idle fuel rate
      isStopped: true
    };
  }

  let mileage = 0;

  // 2. Low speed: speed < 10 km/h (scale linearly from 0 to 13.0 km/kg)
  if (speed < 10) {
    mileage = (speed / 10) * 13.0;
  }
  // 3. Lookup table range: 10 to 120 km/h (continuous linear interpolation)
  else if (speed <= 120) {
    let p1 = CNG_CALIBRATION_TABLE[0];
    let p2 = CNG_CALIBRATION_TABLE[CNG_CALIBRATION_TABLE.length - 1];

    for (let i = 0; i < CNG_CALIBRATION_TABLE.length - 1; i++) {
      if (speed >= CNG_CALIBRATION_TABLE[i].speed && speed <= CNG_CALIBRATION_TABLE[i + 1].speed) {
        p1 = CNG_CALIBRATION_TABLE[i];
        p2 = CNG_CALIBRATION_TABLE[i + 1];
        break;
      }
    }

    if (p1.speed === p2.speed) {
      mileage = p1.mileage;
    } else {
      const t = (speed - p1.speed) / (p2.speed - p1.speed);
      mileage = p1.mileage + t * (p2.mileage - p1.mileage);
    }
  }
  // 4. High speed: speed > 120 km/h (extrapolate with aerodynamic drop-off)
  else {
    const dragFactor = Math.pow(120 / speed, 1.85);
    mileage = Math.max(8.0, 17.5 * dragFactor);
  }

  // Real-time fuel flow rate: kg/h = speed (km/h) / mileage (km/kg)
  const fuelRateKgH = mileage > 0 ? (speed / mileage) : 0.35;

  return {
    speedKmh: speed,
    mileage: parseFloat(mileage.toFixed(1)),
    fuelRateKgH: parseFloat(fuelRateKgH.toFixed(2)),
    isStopped: false
  };
}

// Export for browser
if (typeof window !== 'undefined') {
  window.CNG_CALIBRATION_TABLE = CNG_CALIBRATION_TABLE;
  window.calculateCngTelemetry = calculateCngTelemetry;
}
