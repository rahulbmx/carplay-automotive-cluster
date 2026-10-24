# 🏎️ CarPlay Automotive Digital Instrument Cluster (7-Inch In-Car Display)

A responsive, standalone digital instrument cluster and Apple CarPlay web application designed for 7-inch landscape displays (1024x600 WSVGA, 1280x720 720p, 1280x800 WXGA) with zero scrolling or page bouncing (locked to `100vw` and `100vh`, `overflow: hidden`, `touch-action: none`).

---

## 🌟 Key Features

### 1. Dedicated Speed & CNG Mileage Focus
* **GPS Speed Only**: Geolocation is used strictly for accurate vehicle speed calculation (`coords.speed * 3.6` with Haversine delta fallback). All non-speed GPS data (coordinates, latitude, longitude, compass heading, pitch) have been completely removed.
* **Maximized Gauges**: Large 280x250 SVG dials ($R=100$) filling their containers with large 52px numeric readouts and illuminated needle sweeps.
* **Clean, Uncluttered Layout**: Zero widget override or overlapping cards. Fixed status bar height and structured grid bins.

### 2. 3-Bay Digital Cockpit Layout
* **Top Status Bar**:
  * **Left**: GPS speed sensor indicator (`GPS SPEED ACTIVE ±2.1m`).
  * **Center**: Automotive 12h/24h Digital Clock with date.
  * **Right**: Outside Air Temperature (OAT in °C) with live Open-Meteo weather icon, automated **Black Ice Warning** alert (flashing snowflake if temperature $\le 3^\circ\text{C}$), and toolbar controls (`KM/H` $\leftrightarrow$ `MPH`, `🌙 NIGHT` $\leftrightarrow$ `☀️ DAY`, Sound, Sim Lab, 7" Bezel Toggle, Fullscreen).
* **Bay 1 (Left 36% width) - Detailed CNG Mileage Telemetry**:
  * **BIG Instant CNG Mileage Gauge** ($0 - 50\text{ km/kg}$) with needle sweep and bold digital readout.
  * **Detailed Mileage Grid**:
    * Trip average mileage ($\text{km/kg}$)
    * Total CNG fuel consumed ($\text{kg}$)
    * Real-time fuel flow rate ($\text{kg/h}$, $0.35\text{ kg/h}$ at idle)
    * Estimated CNG driving range ($\text{km}$)
    * S-CNG tank pressure ($200\text{ bar}$ rating) and remaining fuel mass ($\text{kg}$)
* **Bay 2 (Center 28% width) - 56-Point Efficiency Calibration Analyzer**:
  * **Large Speed vs. Mileage 2D Graph (SVG)**: Exact plot of the 56 calibration points ($10 - 120\text{ km/h}$) with a live glowing marker riding the curve dynamically at current speed.
  * **Comparative Telemetry**: Peak calibration point ($70\text{ km/h} \to 45.0\text{ km/kg}$), efficiency rating ($\%$ of peak), delta from peak ($\text{km/kg}$), and burn rate.
  * **Cluster Theme Quick Switcher**: `AUDI`, `CORVETTE`, `TAYCAN`, `MARUTI S-CNG`.
* **Bay 3 (Right 36% width) - Precision Automotive Speedometer**:
  * **BIG Speedometer Gauge** ($0 - 140\text{ km/h}$) with illuminated needle and bold digital speed readout.
  * **Detailed Speed Grid**:
    * Trip distance ($\text{km}$ or $\text{mi}$) with instant **Reset** button
    * Elapsed driving time (`HH:MM:SS`)
    * Top speed record ($\text{km/h}$ or $\text{mph}$)
    * Trip average speed ($\text{km/h}$ or $\text{mph}$)
    * GPS speed lock state and sensor accuracy

### 3. Laptop Browser 7-Inch Bezel Housing
* When viewed in desktop/laptop browsers, displays inside a realistic **7-inch physical automotive bezel housing** with brushed aluminum texture, corner screws, and resolution switcher (`1024x600`, `1280x720`, `1280x800`).
* Automatically scales to fit any laptop window without scrollbars.
* Click `📱 7"` or `⛶` to toggle edge-to-edge mode for actual CarPlay head units.

---

## 🚀 How to Run

1. Open your browser to:
   ```
   http://localhost:8085/index.html
   ```
2. Or start the server anytime:
   ```powershell
   cd C:\Users\rahul\.gemini\antigravity\scratch\carplay-automotive-cluster
   python -m http.server 8085
   ```
