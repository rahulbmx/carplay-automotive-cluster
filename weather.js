/**
 * Weather Module: Open-Meteo API Integration
 * Fetches real-time temperature and weather code without requiring an API key.
 * Manages Outside Air Temperature (OAT) and Black Ice Warning condition (<= 3°C).
 */

class WeatherService {
  constructor() {
    this.temperature = 22.0; // Default fallback temperature in °C
    this.weatherCode = 0;    // Clear sky
    this.isBlackIce = false;
    this.isSimulated = false;
    this.simulatedTemp = null;
    this.lastFetchTime = 0;
    this.lastLat = null;
    this.lastLon = null;
    this.listeners = [];
  }

  onUpdate(callback) {
    this.listeners.push(callback);
  }

  notify() {
    const currentTemp = this.isSimulated && this.simulatedTemp !== null ? this.simulatedTemp : this.temperature;
    this.isBlackIce = currentTemp <= 3.0;

    const data = {
      temperature: currentTemp,
      weatherCode: this.weatherCode,
      weatherIcon: this.getWeatherIcon(this.weatherCode),
      weatherDescription: this.getWeatherDescription(this.weatherCode),
      isBlackIce: this.isBlackIce
    };

    this.listeners.forEach(cb => cb(data));
  }

  setSimulatedTemperature(temp) {
    if (temp === null || temp === undefined) {
      this.isSimulated = false;
      this.simulatedTemp = null;
    } else {
      this.isSimulated = true;
      this.simulatedTemp = parseFloat(temp);
    }
    this.notify();
  }

  async fetchWeather(lat, lon) {
    if (this.isSimulated && this.simulatedTemp !== null) {
      this.notify();
      return;
    }

    const now = Date.now();
    // Cache for 10 minutes unless coordinates moved significantly (> 0.05 deg)
    if (this.lastLat !== null && this.lastLon !== null) {
      const dist = Math.hypot(lat - this.lastLat, lon - this.lastLon);
      if (now - this.lastFetchTime < 600000 && dist < 0.05) {
        return;
      }
    }

    this.lastLat = lat;
    this.lastLon = lon;
    this.lastFetchTime = now;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current_weather=true`;
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Weather fetch failed');
      const data = await response.json();

      if (data && data.current_weather) {
        this.temperature = parseFloat(data.current_weather.temperature);
        this.weatherCode = data.current_weather.weathercode;
        this.notify();
      }
    } catch (err) {
      console.warn('Open-Meteo fetch error, retaining current temperature:', err);
      this.notify();
    }
  }

  getWeatherIcon(code) {
    // WMO Weather interpretation codes (WW)
    if (code === 0) return '☀️'; // Clear sky
    if (code === 1 || code === 2) return '🌤️'; // Mainly clear, partly cloudy
    if (code === 3) return '☁️'; // Overcast
    if (code >= 45 && code <= 48) return '🌫️'; // Fog
    if (code >= 51 && code <= 55) return '🌦️'; // Drizzle
    if (code >= 61 && code <= 65) return '🌧️'; // Rain
    if (code >= 71 && code <= 77) return '🌨️'; // Snow fall
    if (code >= 80 && code <= 82) return '🌧️'; // Rain showers
    if (code >= 85 && code <= 86) return '🌨️'; // Snow showers
    if (code >= 95 && code <= 99) return '⛈️'; // Thunderstorm
    return '🌡️';
  }

  getWeatherDescription(code) {
    if (code === 0) return 'Clear';
    if (code === 1 || code === 2) return 'Partly Cloudy';
    if (code === 3) return 'Overcast';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 67) return 'Rain';
    if (code >= 71 && code <= 86) return 'Snow';
    if (code >= 95) return 'Storm';
    return 'Fair';
  }
}

window.weatherService = new WeatherService();
