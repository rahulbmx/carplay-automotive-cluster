/**
 * CarPlay Automotive Digital Instrument Cluster
 * Master Application Controller & Precision Speed / Mileage Engine
 * Focused, Clean, Maximized Gauges, GPS Speed Only, Master Caution (>80 km/h)
 */

(function () {
  'use strict';

  // State
  const state = {
    speedKmh: 0,
    targetSpeedKmh: 70, // Start at 70 km/h
    isMph: false,
    tempC: 22.0,
    weatherIcon: '☀️',
    isBlackIce: false,
    isSimulated: true,
    tripDistanceKm: 18.4,
    totalCngKg: 0.428,
    tripStartTime: Date.now() - (26 * 60 * 1000), // 26 mins ago
    topSpeedKmh: 74,
    cngTankPressureBar: 185,
    cngTankCapacityKg: 10.0,
    currentTheme: 'theme-audi',
    isDayMode: false,
    is24Hour: true,
    bezelRes: '1024x600',
    directScreenMode: false
  };

  // Master Caution State (>80 km/h)
  let masterCautionActive = false;
  let masterCautionAcknowledged = false;

  // GPS Fallback tracking
  let lastGpsPosition = null;
  let lastGpsTime = null;
  let wakeLock = null;

  // DOM Elements Cache
  const el = {};

  function initDomElements() {
    el.frameViewport = document.getElementById('frame-viewport');
    el.automotiveBezel = document.getElementById('automotive-bezel');
    el.clusterScreen = document.getElementById('cluster-screen');

    // Status bar
    el.gpsDot = document.getElementById('gps-dot');
    el.gpsAcc = document.getElementById('gps-acc');
    el.clockTime = document.getElementById('clock-time');
    el.clockAmPm = document.getElementById('clock-ampm');
    el.clockDate = document.getElementById('clock-date');
    el.weatherIcon = document.getElementById('weather-icon');
    el.weatherTemp = document.getElementById('weather-temp');
    el.blackIceBadge = document.getElementById('black-ice-badge');

    // Master Caution buttons
    el.masterCautionBezelBtn = document.getElementById('master-caution-bezel-btn');
    el.masterCautionClusterBtn = document.getElementById('master-caution-cluster-btn');

    // Toolbar buttons
    el.unitBtn = document.getElementById('unit-btn');
    el.dayNightBtn = document.getElementById('day-night-btn');
    el.soundBtn = document.getElementById('sound-btn');
    el.simDrawerBtn = document.getElementById('sim-drawer-btn');
    el.frameToggleBtn = document.getElementById('frame-toggle-btn');
    el.fullscreenBtn = document.getElementById('fullscreen-btn');

    // Bay 1: CNG Mileage & Fuel
    el.instantCngValue = document.getElementById('instant-cng-value');
    el.instantCngUnit = document.getElementById('instant-cng-unit');
    el.tripAvgMileage = document.getElementById('trip-avg-mileage');
    el.totalCngConsumed = document.getElementById('total-cng-consumed');
    el.realtimeFuelFlow = document.getElementById('realtime-fuel-flow');
    el.cngRangeVal = document.getElementById('cng-range-val');
    el.tankPressureVal = document.getElementById('tank-pressure-val');
    el.tankRemainVal = document.getElementById('tank-remain-val');
    el.tankLevelFill = document.getElementById('tank-level-fill');

    // Bay 2: Efficiency Analyzer
    el.curveLiveReadout = document.getElementById('curve-live-readout');
    el.efficiencyScoreVal = document.getElementById('efficiency-score-val');
    el.efficiencyDeltaVal = document.getElementById('efficiency-delta-val');
    el.centerFlowRate = document.getElementById('center-flow-rate');

    // Bay 3: Speedometer & Trip
    el.speedValue = document.getElementById('speed-value');
    el.speedUnit = document.getElementById('speed-unit');
    el.odometerVal = document.getElementById('odometer-val');
    el.odometerUnit = document.getElementById('odometer-unit');
    el.tripResetBtn = document.getElementById('trip-reset-btn');
    el.elapsedTimeVal = document.getElementById('elapsed-time-val');
    el.topSpeedVal = document.getElementById('top-speed-val');
    el.topSpeedUnit = document.getElementById('top-speed-unit');
    el.avgSpeedVal = document.getElementById('avg-speed-val');
    el.avgSpeedUnit = document.getElementById('avg-speed-unit');
    el.gpsLockState = document.getElementById('gps-lock-state');
    el.gpsSpeedAcc = document.getElementById('gps-speed-acc');

    // Simulation Drawer
    el.simDrawer = document.getElementById('simulation-drawer');
    el.simCloseBtn = document.getElementById('sim-close-btn');
    el.simSpeedSlider = document.getElementById('sim-speed-slider');
    el.simSpeedVal = document.getElementById('sim-speed-val');
    el.simTempSlider = document.getElementById('sim-temp-slider');
    el.simTempVal = document.getElementById('sim-temp-val');
  }

  // ==========================================
  // MATHEMATICAL GAUGE HELPERS (ViewBox 0 0 280 240)
  // ==========================================

  const CX = 140, CY = 125, R = 95;

  function angleToCartesian(angleDeg, radius = R) {
    const rad = angleDeg * Math.PI / 180.0;
    return {
      x: CX + radius * Math.sin(rad),
      y: CY - radius * Math.cos(rad)
    };
  }

  function describeArc(fromDeg, toDeg, radius = R) {
    const pStart = angleToCartesian(fromDeg, radius);
    const pEnd = angleToCartesian(toDeg, radius);
    const span = toDeg - fromDeg;
    const largeArc = span > 180 ? 1 : 0;
    return `M ${pStart.x.toFixed(2)} ${pStart.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${pEnd.x.toFixed(2)} ${pEnd.y.toFixed(2)}`;
  }

  // ==========================================
  // SVG GAUGE INITIALIZERS
  // ==========================================

  /**
   * Initializes the Clean Precision Speedometer Dial (0 to 140 km/h)
   * Outer track radius R=95, center core pod radius 46px completely clear of needle
   */
  function initSpeedometerDialSvg() {
    const svg = document.getElementById('speedometer-svg');
    if (!svg) return;

    const startAngle = -135;
    const sweep = 270;
    const maxSpeed = 140;

    let html = `
      <defs>
        <linearGradient id="speedDialGrad" x1="0%" y1="100%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--accent-cyan)" />
          <stop offset="60%" stop-color="var(--accent-gold)" />
          <stop offset="100%" stop-color="var(--accent-red)" />
        </linearGradient>
        <filter id="speedGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Outer Background Track -->
      <path d="${describeArc(startAngle, startAngle + sweep, R)}" 
            fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7" stroke-linecap="round"/>

      <!-- Active Dynamic Speed Arc -->
      <path id="speed-dial-active-arc" d="" 
            fill="none" stroke="url(#speedDialGrad)" stroke-width="7" stroke-linecap="round" />

      <!-- Center Digital Pod Plate (Frames digits, needle never enters here) -->
      <circle cx="${CX}" cy="${CY}" r="46" fill="#060c18" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <circle cx="${CX}" cy="${CY}" r="43" fill="var(--bg-cluster)" />
    `;

    // Radial Tick Marks & Outer Numerals
    for (let s = 0; s <= maxSpeed; s += 10) {
      const angle = startAngle + (s / maxSpeed) * sweep;
      const isMajor = s % 20 === 0;
      const innerR = isMajor ? R - 10 : R - 5;
      const p1 = angleToCartesian(angle, R - 1);
      const p2 = angleToCartesian(angle, innerR);

      const tickColor = isMajor ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)';
      const strokeW = isMajor ? 2.2 : 1.2;

      html += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${tickColor}" stroke-width="${strokeW}" />`;

      if (isMajor) {
        const textPos = angleToCartesian(angle, 71);
        html += `<text x="${textPos.x.toFixed(1)}" y="${(textPos.y + 3.5).toFixed(1)}" font-family="var(--font-mono)" font-size="10.5" 
                 font-weight="700" fill="var(--text-muted)" text-anchor="middle">${s}</text>`;
      }
    }

    // Floating Illuminated Needle Pointer Blade (Sweeps outer ring from r=48 to r=92, clear of center digits)
    html += `
      <g id="speed-needle-group" transform="rotate(-135, ${CX}, ${CY})">
        <polygon points="${CX - 3.5},${CY - 48} ${CX + 3.5},${CY - 48} ${CX + 1.2},${CY - R + 2} ${CX - 1.2},${CY - R + 2}" 
                 fill="var(--needle-color)" filter="url(#speedGlow)" />
        <line x1="${CX}" y1="${CY - 48}" x2="${CX}" y2="${CY - R + 2}" 
              stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
      </g>
    `;

    svg.innerHTML = html;
  }

  /**
   * Initializes the Clean Precision Instant CNG Mileage Gauge (0 to 50 km/kg)
   */
  function initCngGaugeDialSvg() {
    const svg = document.getElementById('cng-gauge-svg');
    if (!svg) return;

    const startAngle = -135;
    const sweep = 270;
    const maxMileage = 50;

    let html = `
      <defs>
        <linearGradient id="cngDialGrad" x1="0%" y1="100%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="var(--accent-red)" />
          <stop offset="35%" stop-color="var(--accent-amber)" />
          <stop offset="70%" stop-color="var(--accent-lime)" />
          <stop offset="95%" stop-color="var(--accent-gold)" />
        </linearGradient>
        <filter id="cngGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Outer Background Track -->
      <path d="${describeArc(startAngle, startAngle + sweep, R)}" 
            fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7" stroke-linecap="round"/>

      <!-- Active Dynamic CNG Arc -->
      <path id="cng-dial-active-arc" d="" 
            fill="none" stroke="url(#cngDialGrad)" stroke-width="7" stroke-linecap="round" />

      <!-- Center Digital Pod Plate (Frames digits, needle never enters here) -->
      <circle cx="${CX}" cy="${CY}" r="46" fill="#060c18" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <circle cx="${CX}" cy="${CY}" r="43" fill="var(--bg-cluster)" />
    `;

    // Mileage Tick Marks & Outer Numbers (0 to 50 in steps of 5)
    for (let m = 0; m <= maxMileage; m += 5) {
      const angle = startAngle + (m / maxMileage) * sweep;
      const isMajor = m % 10 === 0;
      const innerR = isMajor ? R - 10 : R - 5;
      const p1 = angleToCartesian(angle, R - 1);
      const p2 = angleToCartesian(angle, innerR);

      const tickColor = isMajor ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)';
      const strokeW = isMajor ? 2.2 : 1.2;

      html += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${tickColor}" stroke-width="${strokeW}" />`;

      if (isMajor) {
        const textPos = angleToCartesian(angle, 71);
        html += `<text x="${textPos.x.toFixed(1)}" y="${(textPos.y + 3.5).toFixed(1)}" font-family="var(--font-mono)" font-size="10.5" 
                 font-weight="700" fill="var(--text-muted)" text-anchor="middle">${m}</text>`;
      }
    }

    // Floating Illuminated Needle Pointer Blade (Sweeps outer ring from r=48 to r=92, clear of center digits)
    html += `
      <g id="cng-needle-group" transform="rotate(-135, ${CX}, ${CY})">
        <polygon points="${CX - 3.5},${CY - 48} ${CX + 3.5},${CY - 48} ${CX + 1.2},${CY - R + 2} ${CX - 1.2},${CY - R + 2}" 
                 fill="var(--accent-lime)" filter="url(#cngGlow)" />
        <line x1="${CX}" y1="${CY - 48}" x2="${CX}" y2="${CY - R + 2}" 
              stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" />
      </g>
    `;

    svg.innerHTML = html;
  }

  /**
   * Initializes the 56-Point Efficiency Curve SVG in Bay 2
   */
  function initEfficiencyCurveSvg() {
    const svg = document.getElementById('efficiency-curve-svg');
    if (!svg || !window.CNG_CALIBRATION_TABLE) return;

    const width = 310;
    const height = 130;
    const padL = 26;
    const padR = 12;
    const padT = 12;
    const padB = 20;

    const minSpeed = 10;
    const maxSpeed = 120;
    const minMileage = 10.0;
    const maxMileage = 48.0;

    function mapSpeedToX(speed) {
      const clamped = Math.max(minSpeed, Math.min(maxSpeed, speed));
      return padL + ((clamped - minSpeed) / (maxSpeed - minSpeed)) * (width - padL - padR);
    }

    function mapMileageToY(mileage) {
      const clamped = Math.max(minMileage, Math.min(maxMileage, mileage));
      return (height - padB) - ((clamped - minMileage) / (maxMileage - minMileage)) * (height - padT - padB);
    }

    const table = window.CNG_CALIBRATION_TABLE;
    let pathD = '';
    let areaD = '';

    table.forEach((pt, idx) => {
      const x = mapSpeedToX(pt.speed);
      const y = mapMileageToY(pt.mileage);
      if (idx === 0) {
        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        areaD += `M ${x.toFixed(1)} ${(height - padB)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        areaD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    const lastX = mapSpeedToX(table[table.length - 1].speed);
    areaD += ` L ${lastX.toFixed(1)} ${(height - padB)} Z`;

    const peakX = mapSpeedToX(70);
    const peakY = mapMileageToY(45.0);

    let html = `
      <defs>
        <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--accent-amber)" />
          <stop offset="50%" stop-color="var(--accent-gold)" />
          <stop offset="60%" stop-color="var(--accent-lime)" />
          <stop offset="100%" stop-color="var(--accent-cyan)" />
        </linearGradient>
        <linearGradient id="curveAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--accent-cyan)" stop-opacity="0.22" />
          <stop offset="100%" stop-color="var(--accent-cyan)" stop-opacity="0.0" />
        </linearGradient>
      </defs>

      <!-- Baseline Grid & Labels -->
      <line x1="${padL}" y1="${height - padB}" x2="${width - padR}" y2="${height - padB}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${height - padB}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />

      <!-- Horizontal Reference Grid Lines (20, 30, 45 km/kg) -->
      <line x1="${padL}" y1="${mapMileageToY(20).toFixed(1)}" x2="${width - padR}" y2="${mapMileageToY(20).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
      <line x1="${padL}" y1="${mapMileageToY(30).toFixed(1)}" x2="${width - padR}" y2="${mapMileageToY(30).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
      <line x1="${padL}" y1="${peakY.toFixed(1)}" x2="${width - padR}" y2="${peakY.toFixed(1)}" stroke="rgba(255,214,0,0.25)" stroke-dasharray="2,2" />

      <!-- Speed Axis Labels (km/h) -->
      <text x="${mapSpeedToX(10).toFixed(1)}" y="${height - 5}" font-family="var(--font-mono)" font-size="8.5" fill="var(--text-dim)">10</text>
      <text x="${mapSpeedToX(40).toFixed(1)}" y="${height - 5}" font-family="var(--font-mono)" font-size="8.5" fill="var(--text-dim)">40</text>
      <text x="${mapSpeedToX(70).toFixed(1)}" y="${height - 5}" font-family="var(--font-mono)" font-size="8.5" font-weight="700" fill="var(--accent-gold)">70</text>
      <text x="${mapSpeedToX(100).toFixed(1)}" y="${height - 5}" font-family="var(--font-mono)" font-size="8.5" fill="var(--text-dim)">100</text>
      <text x="${mapSpeedToX(120).toFixed(1)}" y="${height - 5}" font-family="var(--font-mono)" font-size="8.5" fill="var(--text-dim)">120</text>

      <!-- Mileage Axis Labels (km/kg) -->
      <text x="${padL - 4}" y="${mapMileageToY(13).toFixed(1)}" font-family="var(--font-mono)" font-size="8.5" fill="var(--text-dim)" text-anchor="end">13</text>
      <text x="${padL - 4}" y="${mapMileageToY(30).toFixed(1)}" font-family="var(--font-mono)" font-size="8.5" fill="var(--text-dim)" text-anchor="end">30</text>
      <text x="${padL - 4}" y="${(peakY + 3).toFixed(1)}" font-family="var(--font-mono)" font-size="8.5" font-weight="700" fill="var(--accent-gold)" text-anchor="end">45</text>

      <!-- Filled Area under Curve -->
      <path d="${areaD}" fill="url(#curveAreaGradient)" />

      <!-- The Calibration Curve Line -->
      <path d="${pathD}" fill="none" stroke="url(#curveGradient)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

      <!-- Peak Point Marker (70 km/h, 45.0 km/kg) -->
      <line x1="${peakX.toFixed(1)}" y1="${peakY.toFixed(1)}" x2="${peakX.toFixed(1)}" y2="${height - padB}" stroke="var(--accent-gold)" stroke-width="1.2" stroke-dasharray="2,2" opacity="0.6" />
      <circle cx="${peakX.toFixed(1)}" cy="${peakY.toFixed(1)}" r="3.5" fill="var(--accent-gold)" stroke="#fff" stroke-width="1" />

      <!-- Live Glowing Tracking Dot (Rides dynamically along the curve) -->
      <g id="curve-tracker-dot-group" transform="translate(${mapSpeedToX(70).toFixed(1)}, ${mapMileageToY(45).toFixed(1)})">
        <circle r="8" fill="var(--accent-cyan)" opacity="0.35" class="pulse-marker" />
        <circle r="4" fill="#ffffff" stroke="var(--accent-cyan)" stroke-width="2" />
      </g>
    `;

    svg.innerHTML = html;

    window.curveMapping = {
      mapSpeedToX,
      mapMileageToY
    };
  }

  // ==========================================
  // MASTER CAUTION WARNING CONTROLLER (>80 km/h)
  // ==========================================

  function updateMasterCaution(speedKmh) {
    const isOverSpeed = speedKmh > 80.0;

    if (isOverSpeed) {
      if (!masterCautionActive) {
        masterCautionActive = true;
        masterCautionAcknowledged = false;
        // Trigger alert tone
        if (window.soundFx) {
          window.soundFx.playOverspeedAlert();
        }
      }
    } else {
      masterCautionActive = false;
      masterCautionAcknowledged = false;
    }

    const buttons = [el.masterCautionBezelBtn, el.masterCautionClusterBtn];
    buttons.forEach(btn => {
      if (!btn) return;
      if (masterCautionActive) {
        btn.classList.add('active');
        if (!masterCautionAcknowledged) {
          btn.classList.add('blinking');
        } else {
          btn.classList.remove('blinking');
        }
      } else {
        btn.classList.remove('active', 'blinking');
      }
    });
  }

  function handleMasterCautionClick() {
    if (window.soundFx) {
      window.soundFx.playClick();
    }
    if (masterCautionActive) {
      masterCautionAcknowledged = !masterCautionAcknowledged;
      const buttons = [el.masterCautionBezelBtn, el.masterCautionClusterBtn];
      buttons.forEach(btn => {
        if (!btn) return;
        if (masterCautionAcknowledged) {
          btn.classList.remove('blinking');
        } else {
          btn.classList.add('blinking');
        }
      });
    }
  }

  // ==========================================
  // TELEMETRY UPDATE & RENDERING PIPELINE
  // ==========================================

  let lastFrameTime = performance.now();

  function updateTelemetryPipeline(timestamp) {
    const dt = Math.min(0.1, (timestamp - lastFrameTime) / 1000.0);
    lastFrameTime = timestamp;

    // Damping towards target speed
    state.speedKmh += (state.targetSpeedKmh - state.speedKmh) * Math.min(1.0, dt * 5.0);
    if (Math.abs(state.speedKmh - state.targetSpeedKmh) < 0.05) {
      state.speedKmh = state.targetSpeedKmh;
    }

    // Top Speed record
    if (state.speedKmh > state.topSpeedKmh) {
      state.topSpeedKmh = Math.round(state.speedKmh);
    }

    // Calculate CNG Telemetry using exact 56-point lookup engine
    const cng = window.calculateCngTelemetry(state.speedKmh);

    // Integrate Trip Distance & CNG Consumed
    if (state.speedKmh > 0.1) {
      const deltaDistKm = (state.speedKmh / 3600.0) * dt;
      state.tripDistanceKm += deltaDistKm;

      const deltaCngKg = (cng.fuelRateKgH / 3600.0) * dt;
      state.totalCngKg += deltaCngKg;
    } else {
      // Idle CNG flow rate 0.35 kg/h
      const deltaCngKg = (0.35 / 3600.0) * dt;
      state.totalCngKg += deltaCngKg;
    }

    // Master Caution Update (>80 km/h)
    updateMasterCaution(state.speedKmh);

    // Render UI Components
    renderTopStatusBar();
    renderBay1Mileage(cng);
    renderBay2Efficiency(cng);
    renderBay3Speedometer(cng);

    requestAnimationFrame(updateTelemetryPipeline);
  }

  // ==========================================
  // RENDERING FUNCTIONS
  // ==========================================

  function renderTopStatusBar() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    let ampm = '';

    if (!state.is24Hour) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
    }
    const hoursStr = String(hours).padStart(2, '0');
    el.clockTime.textContent = `${hoursStr}:${minutes}:${seconds}`;
    el.clockAmPm.textContent = ampm;

    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    el.clockDate.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;

    el.weatherTemp.textContent = `${state.tempC.toFixed(1)}°C`;
    el.weatherIcon.textContent = state.weatherIcon;

    if (state.tempC <= 3.0) {
      el.blackIceBadge.classList.add('active');
    } else {
      el.blackIceBadge.classList.remove('active');
    }
  }

  function renderBay1Mileage(cng) {
    el.instantCngValue.textContent = cng.mileage.toFixed(1);

    if (cng.isStopped) {
      el.instantCngValue.style.color = 'var(--text-muted)';
      el.instantCngValue.style.textShadow = 'none';
    } else if (cng.mileage >= 40) {
      el.instantCngValue.style.color = 'var(--accent-gold)';
      el.instantCngValue.style.textShadow = '0 0 16px rgba(255, 214, 0, 0.7)';
    } else if (cng.mileage >= 28) {
      el.instantCngValue.style.color = 'var(--accent-lime)';
      el.instantCngValue.style.textShadow = '0 0 14px rgba(0, 255, 102, 0.4)';
    } else {
      el.instantCngValue.style.color = 'var(--accent-amber)';
      el.instantCngValue.style.textShadow = '0 0 12px rgba(255, 170, 0, 0.4)';
    }

    // Needle Rotation (-135° at 0 km/kg to +135° at 50 km/kg)
    const startAngle = -135;
    const sweep = 270;
    const clampedMileage = Math.max(0, Math.min(50, cng.mileage));
    const needleDeg = startAngle + (clampedMileage / 50.0) * sweep;

    const needleGroup = document.getElementById('cng-needle-group');
    if (needleGroup) {
      needleGroup.setAttribute('transform', `rotate(${needleDeg.toFixed(2)}, ${CX}, ${CY})`);
    }

    // Active Dynamic Arc
    const cngActiveArc = document.getElementById('cng-dial-active-arc');
    if (cngActiveArc) {
      if (clampedMileage > 0.5) {
        cngActiveArc.setAttribute('d', describeArc(startAngle, needleDeg, R));
      } else {
        cngActiveArc.setAttribute('d', '');
      }
    }

    // Detailed Metrics Pods
    const tripAvg = state.totalCngKg > 0.01 ? (state.tripDistanceKm / state.totalCngKg) : 0.0;
    el.tripAvgMileage.textContent = tripAvg.toFixed(1);
    el.totalCngConsumed.textContent = state.totalCngKg.toFixed(3);
    el.realtimeFuelFlow.textContent = cng.fuelRateKgH.toFixed(2);

    // Tank Telemetry
    const remainingKg = Math.max(0.5, state.cngTankCapacityKg - state.totalCngKg);
    const tankPct = Math.round((remainingKg / state.cngTankCapacityKg) * 100);
    const pressureBar = Math.round((remainingKg / state.cngTankCapacityKg) * 200);

    el.tankLevelFill.style.width = `${tankPct}%`;
    el.tankPressureVal.textContent = `${pressureBar} BAR`;
    el.tankRemainVal.textContent = `${remainingKg.toFixed(1)} kg (${tankPct}%)`;

    // Estimated Range
    const effectiveMileage = cng.mileage > 5 ? cng.mileage : (tripAvg > 5 ? tripAvg : 32.0);
    const estRange = Math.round(remainingKg * effectiveMileage);
    el.cngRangeVal.textContent = `${estRange}`;
  }

  function renderBay2Efficiency(cng) {
    // Dynamic Tracking Dot on 56-Point Curve
    if (window.curveMapping) {
      const dotX = window.curveMapping.mapSpeedToX(state.speedKmh);
      const dotY = window.curveMapping.mapMileageToY(cng.mileage);
      const dotGroup = document.getElementById('curve-tracker-dot-group');
      if (dotGroup) {
        dotGroup.setAttribute('transform', `translate(${dotX.toFixed(1)}, ${dotY.toFixed(1)})`);
      }
    }

    // Live Readout header
    const displaySpeed = state.isMph ? (state.speedKmh * 0.621371).toFixed(1) : state.speedKmh.toFixed(1);
    const speedUnitStr = state.isMph ? 'mph' : 'km/h';
    el.curveLiveReadout.textContent = `${displaySpeed} ${speedUnitStr} ➔ ${cng.mileage.toFixed(1)} km/kg`;

    // Efficiency Rating (% of 45.0 km/kg peak)
    const effScore = Math.min(100, Math.round((cng.mileage / 45.0) * 100));
    el.efficiencyScoreVal.textContent = `${effScore}%`;

    // Delta from peak 45.0 km/kg
    const delta = (cng.mileage - 45.0).toFixed(1);
    el.efficiencyDeltaVal.textContent = `${delta > 0 ? '+' : ''}${delta}`;
    el.efficiencyDeltaVal.style.color = Math.abs(delta) < 2 ? 'var(--accent-gold)' : 'var(--text-main)';

    // Flow rate
    el.centerFlowRate.textContent = `${cng.fuelRateKgH.toFixed(2)}`;
  }

  function renderBay3Speedometer(cng) {
    const displaySpeed = state.isMph ? (state.speedKmh * 0.621371) : state.speedKmh;
    el.speedValue.textContent = Math.round(displaySpeed);
    el.speedUnit.textContent = state.isMph ? 'MPH' : 'KM / H';

    // Speed Dial Needle Rotation (-135° at 0 km/h to +135° at 140 km/h)
    const startAngle = -135;
    const sweep = 270;
    const maxSpeed = 140;
    const clampedSpeed = Math.max(0, Math.min(maxSpeed, state.speedKmh));
    const needleDeg = startAngle + (clampedSpeed / maxSpeed) * sweep;

    const needleGroup = document.getElementById('speed-needle-group');
    if (needleGroup) {
      needleGroup.setAttribute('transform', `rotate(${needleDeg.toFixed(2)}, ${CX}, ${CY})`);
    }

    // Dynamic Active Arc
    const speedActiveArc = document.getElementById('speed-dial-active-arc');
    if (speedActiveArc) {
      if (clampedSpeed > 1) {
        speedActiveArc.setAttribute('d', describeArc(startAngle, needleDeg, R));
      } else {
        speedActiveArc.setAttribute('d', '');
      }
    }

    // Detailed Trip Metrics
    const odoDisplay = state.isMph ? (state.tripDistanceKm * 0.621371) : state.tripDistanceKm;
    el.odometerVal.textContent = odoDisplay.toFixed(1);
    el.odometerUnit.textContent = state.isMph ? 'mi' : 'km';

    // Elapsed Driving Time
    const elapsedMs = Date.now() - state.tripStartTime;
    const sec = Math.floor((elapsedMs / 1000) % 60);
    const min = Math.floor((elapsedMs / (1000 * 60)) % 60);
    const hrs = Math.floor(elapsedMs / (1000 * 60 * 60));
    el.elapsedTimeVal.textContent = `${String(hrs).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    // Top Speed Record
    const topDisplay = state.isMph ? Math.round(state.topSpeedKmh * 0.621371) : state.topSpeedKmh;
    el.topSpeedVal.textContent = topDisplay;
    el.topSpeedUnit.textContent = state.isMph ? 'mph' : 'km/h';

    // Trip Average Speed
    const elapsedHours = Math.max(0.01, elapsedMs / (1000 * 60 * 60));
    const avgSpeed = state.tripDistanceKm / elapsedHours;
    const avgDisplay = state.isMph ? Math.round(avgSpeed * 0.621371) : Math.round(avgSpeed);
    el.avgSpeedVal.textContent = avgDisplay;
    el.avgSpeedUnit.textContent = state.isMph ? 'mph' : 'km/h';
  }

  // ==========================================
  // HARDWARE APIS: GPS (SPEED ONLY) & WAKELOCK
  // ==========================================

  function initGpsTracking() {
    if (!navigator.geolocation) {
      console.warn('Geolocation API not available');
      return;
    }

    navigator.geolocation.watchPosition(
      (pos) => {
        const coords = pos.coords;
        const now = Date.now();

        if (!state.isSimulated) {
          if (coords.speed !== null && coords.speed !== undefined && !isNaN(coords.speed)) {
            state.targetSpeedKmh = Math.max(0, coords.speed * 3.6);
          } else if (lastGpsPosition && lastGpsTime) {
            const dtSec = (now - lastGpsTime) / 1000.0;
            if (dtSec > 0.5) {
              const distMeters = calculateHaversineDistance(
                lastGpsPosition.latitude, lastGpsPosition.longitude,
                coords.latitude, coords.longitude
              );
              state.targetSpeedKmh = Math.max(0, (distMeters / dtSec) * 3.6);
            }
          }
        }

        lastGpsPosition = coords;
        lastGpsTime = now;

        el.gpsDot.className = 'gps-dot';
        const accMeters = coords.accuracy ? coords.accuracy.toFixed(1) : '2.0';
        el.gpsAcc.textContent = `ACTIVE (±${accMeters}m)`;
        el.gpsLockState.textContent = '3D SPEED FIX ACTIVE';
        el.gpsSpeedAcc.textContent = `±${(accMeters / 5).toFixed(1)} m/s`;

        if (window.weatherService) {
          window.weatherService.fetchWeather(coords.latitude, coords.longitude);
        }
      },
      (err) => {
        console.warn('GPS position error:', err.message);
        el.gpsDot.className = 'gps-dot searching';
        el.gpsAcc.textContent = 'SEARCHING';
        el.gpsLockState.textContent = 'SEARCHING SIGNAL';
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );
  }

  function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLam = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLam / 2) * Math.sin(deltaLam / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function requestScreenWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } catch (err) {}
    }
  }

  // ==========================================
  // RESPONSIVE BEZEL AUTO-SCALING FOR LAPTOPS
  // ==========================================

  function updateBezelScaling() {
    if (state.directScreenMode || document.fullscreenElement) {
      el.automotiveBezel.style.transform = '';
      return;
    }

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    let targetW = 1024;
    let targetH = 600;
    if (state.bezelRes === '1280x720') {
      targetW = 1160;
      targetH = 670;
    } else if (state.bezelRes === '1280x800') {
      targetW = 1100;
      targetH = 700;
    }

    const scaleX = (vpW - 16) / targetW;
    const scaleY = (vpH - 16) / targetH;
    const scale = Math.min(1.0, scaleX, scaleY);

    if (scale < 0.99) {
      el.automotiveBezel.style.transform = `scale(${scale.toFixed(3)})`;
    } else {
      el.automotiveBezel.style.transform = 'scale(1)';
    }
  }

  // ==========================================
  // EVENT LISTENERS & USER CONTROLS
  // ==========================================

  function bindEvents() {
    document.addEventListener('pointerdown', () => {
      window.soundFx.init();
      requestScreenWakeLock();
    }, { once: true });

    window.addEventListener('resize', updateBezelScaling);

    // Master Caution button clicks
    if (el.masterCautionBezelBtn) {
      el.masterCautionBezelBtn.addEventListener('click', handleMasterCautionClick);
    }
    if (el.masterCautionClusterBtn) {
      el.masterCautionClusterBtn.addEventListener('click', handleMasterCautionClick);
    }

    // Unit toggle (KM/H vs MPH)
    el.unitBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      state.isMph = !state.isMph;
      el.unitBtn.textContent = state.isMph ? 'MPH' : 'KM/H';
      el.unitBtn.classList.toggle('active', state.isMph);
    });

    // Day / Night mode toggle
    el.dayNightBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      state.isDayMode = !state.isDayMode;
      document.body.classList.toggle('theme-day', state.isDayMode);
      el.dayNightBtn.textContent = state.isDayMode ? '☀️ DAY' : '🌙 NIGHT';
      el.dayNightBtn.classList.toggle('active', state.isDayMode);
    });

    // Sound toggle
    el.soundBtn.addEventListener('click', () => {
      const isMuted = window.soundFx.toggleMute();
      el.soundBtn.textContent = isMuted ? '🔇' : '🔊';
      el.soundBtn.classList.toggle('active', !isMuted);
    });

    // Simulation Drawer Toggle
    el.simDrawerBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      el.simDrawer.classList.toggle('open');
      el.simDrawerBtn.classList.toggle('active', el.simDrawer.classList.contains('open'));
    });

    el.simCloseBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      el.simDrawer.classList.remove('open');
      el.simDrawerBtn.classList.remove('active');
    });

    // 7" Frame / Direct View Mode Toggle
    el.frameToggleBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      state.directScreenMode = !state.directScreenMode;
      document.body.classList.toggle('direct-screen-mode', state.directScreenMode);
      el.frameToggleBtn.textContent = state.directScreenMode ? '🖥️ FULL' : '📱 7"';
      el.frameToggleBtn.classList.toggle('active', state.directScreenMode);
      updateBezelScaling();
    });

    // Fullscreen Native Toggle
    el.fullscreenBtn.addEventListener('click', () => {
      window.soundFx.playClick();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const isFull = !!document.fullscreenElement;
      document.body.classList.toggle('fullscreen-active', isFull);
      el.fullscreenBtn.classList.toggle('active', isFull);
      updateBezelScaling();
    });

    // Clock format toggle (12h/24h)
    document.querySelector('.digital-clock-pod').addEventListener('click', () => {
      window.soundFx.playClick();
      state.is24Hour = !state.is24Hour;
    });

    // Trip Reset Button
    if (el.tripResetBtn) {
      el.tripResetBtn.addEventListener('click', () => {
        window.soundFx.playClick();
        state.tripDistanceKm = 0.0;
        state.totalCngKg = 0.0;
        state.tripStartTime = Date.now();
        state.topSpeedKmh = Math.round(state.speedKmh);
      });
    }

    // Theme selector tabs
    const themeButtons = document.querySelectorAll('.theme-tab-btn');
    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundFx.playClick();
        const theme = btn.getAttribute('data-theme');
        applyTheme(theme);
      });
    });

    // Bezel resolution switcher buttons
    const resButtons = document.querySelectorAll('.res-btn');
    resButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundFx.playClick();
        const res = btn.getAttribute('data-res');
        state.bezelRes = res;
        el.automotiveBezel.className = `automotive-bezel res-${res}`;
        resButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateBezelScaling();
      });
    });

    // Speed Slider
    el.simSpeedSlider.addEventListener('input', (e) => {
      state.isSimulated = true;
      state.targetSpeedKmh = parseFloat(e.target.value);
      el.simSpeedVal.textContent = `${Math.round(state.targetSpeedKmh)} km/h`;
    });

    // Temperature Slider
    el.simTempSlider.addEventListener('input', (e) => {
      state.tempC = parseFloat(e.target.value);
      el.simTempVal.textContent = `${state.tempC.toFixed(1)}°C`;
      if (window.weatherService) {
        window.weatherService.setSimulatedTemperature(state.tempC);
      }
    });

    // Quick Speed Presets
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundFx.playClick();
        state.isSimulated = true;
        const target = parseFloat(btn.getAttribute('data-speed'));
        state.targetSpeedKmh = target;
        el.simSpeedSlider.value = target;
        el.simSpeedVal.textContent = `${Math.round(target)} km/h`;
      });
    });

    // Weather Service Listener
    if (window.weatherService) {
      window.weatherService.onUpdate(data => {
        state.tempC = data.temperature;
        state.weatherIcon = data.weatherIcon;
        state.isBlackIce = data.isBlackIce;

        if (state.isBlackIce) {
          window.soundFx.playIceWarningChime();
        }
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        requestScreenWakeLock();
      }
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function applyTheme(themeName) {
    document.body.classList.remove('theme-audi', 'theme-corvette', 'theme-taycan', 'theme-maruti');
    document.body.classList.add(themeName);
    state.currentTheme = themeName;

    const themeButtons = document.querySelectorAll('.theme-tab-btn');
    themeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === themeName);
    });
  }

  // ==========================================
  // INITIALIZATION ON LOAD
  // ==========================================

  window.addEventListener('DOMContentLoaded', () => {
    initDomElements();
    initSpeedometerDialSvg();
    initCngGaugeDialSvg();
    initEfficiencyCurveSvg();
    bindEvents();
    initGpsTracking();
    updateBezelScaling();

    // Initial speed setting
    state.targetSpeedKmh = 70;
    state.speedKmh = 0;

    requestAnimationFrame(updateTelemetryPipeline);
  });

})();
