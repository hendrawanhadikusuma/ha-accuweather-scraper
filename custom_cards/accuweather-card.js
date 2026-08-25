const AQI_LEVELS = [
  { max: 50, label: 'Good', color: '#3ddc97' },
  { max: 100, label: 'Moderate', color: '#ffd166' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', color: '#f8961e' },
  { max: 200, label: 'Unhealthy', color: '#f3722c' },
  { max: 300, label: 'Very Unhealthy', color: '#e63946' },
  { max: Infinity, label: 'Hazardous', color: '#7b2cbf' },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  if (Number.isNaN(number)) {
    return String(value);
  }

  return number.toFixed(digits).replace(/\.0+$/, '');
}

function aqiMeta(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return { label: 'Unknown', color: '#6c757d' };
  }

  return AQI_LEVELS.find((level) => number <= level.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

function forecastLabel(item) {
  if (!item) {
    return '';
  }

  if (item.time_label) {
    return item.time_label;
  }

  if (item.date_label) {
    return item.date_label;
  }

  if (item.datetime) {
    try {
      const date = new Date(item.datetime);
      return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date).toUpperCase();
    } catch (error) {
      return String(item.datetime).slice(0, 10);
    }
  }

  return '';
}

function getWeatherIcon(condition) {
  const normalized = String(condition || '').toLowerCase();
  if (normalized.includes('rain')) return 'mdi:weather-rainy';
  if (normalized.includes('storm') || normalized.includes('thunder')) return 'mdi:weather-lightning-rainy';
  if (normalized.includes('snow')) return 'mdi:weather-snowy';
  if (normalized.includes('fog') || normalized.includes('mist')) return 'mdi:weather-fog';
  if (normalized.includes('cloud')) return 'mdi:weather-cloudy';
  if (normalized.includes('wind')) return 'mdi:weather-windy';
  if (normalized.includes('partly')) return 'mdi:weather-partly-cloudy';
  return 'mdi:weather-sunny';
}

class AccuWeatherCard extends HTMLElement {
  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('You need to define an entity');
    }

    this._config = {
      title: 'AccuWeather',
      sensors: [],
      forecast_limit: 5,
      ...config,
    };

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 4;
  }

  _stateFor(entityId) {
    return this._hass?.states?.[entityId] || null;
  }

  _renderMetric(label, value, suffix = '') {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    return `
      <div class="metric">
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-value">${escapeHtml(value)}${suffix ? ` <span>${escapeHtml(suffix)}</span>` : ''}</div>
      </div>
    `;
  }

  _renderSensor(entityId) {
    const state = this._stateFor(entityId);
    if (!state) {
      return '';
    }

    return `
      <div class="sensor-pill">
        <div class="sensor-name">${escapeHtml(state.attributes.friendly_name || state.entity_id)}</div>
        <div class="sensor-value">${escapeHtml(state.state)}</div>
      </div>
    `;
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }

    const weather = this._stateFor(this._config.entity);
    if (!weather) {
      this.innerHTML = `
        <ha-card>
          <div class="wrapper">
            <div class="empty">Weather entity not found: ${escapeHtml(this._config.entity)}</div>
          </div>
        </ha-card>
      `;
      return;
    }

    const attrs = weather.attributes || {};
    const temperature = attrs.temperature ?? weather.state ?? '-';
    const temperatureUnit = attrs.temperature_unit || '°C';
    const condition = weather.state || 'unknown';
    const icon = attrs.icon || getWeatherIcon(condition);
    const apparent = attrs.apparent_temperature;
    const humidity = attrs.humidity;
    const windSpeed = attrs.wind_speed;
    const windUnit = attrs.wind_speed_unit || 'km/h';
    const dailyForecast = Array.isArray(attrs.daily_forecast) ? attrs.daily_forecast.slice(0, this._config.forecast_limit) : [];
    const hourlyForecast = Array.isArray(attrs.hourly_forecast) ? attrs.hourly_forecast.slice(0, this._config.hourly_forecast_limit || 6) : [];
    const aqiValue = attrs.air_quality_index;
    const aqi = aqiMeta(aqiValue);
    const allergyAllergen = attrs.allergy_allergen;
    const allergyRisk = attrs.allergy_risk;
    const allergyTips = attrs.allergy_safety_tips;
    const detailMetrics = [
      ['Gust', attrs.gust_speed, windUnit],
      ['Pressure', attrs.pressure, 'hPa'],
      ['Visibility', attrs.visibility, 'km'],
      ['Dew point', attrs.dew_point, temperatureUnit],
      ['Cloud cover', attrs.cloud_cover, '%'],
      ['UV index', attrs.uv_index, ''],
      ['Precip prob.', attrs.precipitation_probability, '%'],
      ['Cloud ceiling', attrs.cloud_ceiling, 'ft'],
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');
    const pollutantRows = [
      ['PM2.5', attrs.pm25, 'µg/m³'],
      ['PM10', attrs.pm10, 'µg/m³'],
      ['NO₂', attrs.no2, 'µg/m³'],
      ['SO₂', attrs.so2, 'µg/m³'],
      ['CO', attrs.co, 'µg/m³'],
      ['O₃', attrs.o3, 'µg/m³'],
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');

    const forecastCards = dailyForecast.map((item) => {
      const label = forecastLabel(item);
      const summary = item.summary || item.condition || '';
      const iconName = item.icon || getWeatherIcon(item.condition || summary);
      const high = formatNumber(item.temperature);
      const low = formatNumber(item.templow);
      const precip = item.precipitation_probability;

      return `
        <div class="forecast-card">
          <div class="forecast-day">${escapeHtml(label)}</div>
          <ha-icon icon="${iconName}"></ha-icon>
          <div class="forecast-range">${high !== null ? `${escapeHtml(high)}${escapeHtml(temperatureUnit)}` : '--'} / ${low !== null ? `${escapeHtml(low)}${escapeHtml(temperatureUnit)}` : '--'}</div>
          <div class="forecast-summary">${escapeHtml(summary || '')}</div>
          ${precip !== null && precip !== undefined ? `<div class="forecast-precip">💧 ${escapeHtml(precip)}%</div>` : ''}
        </div>
      `;
    }).join('');

    const hourlyCards = hourlyForecast.map((item) => {
      const label = forecastLabel(item);
      const summary = item.summary || item.condition || '';
      const iconName = item.icon || getWeatherIcon(item.condition || summary || (Number(item.precipitation_probability) > 60 ? 'rain' : 'partly cloudy'));
      const temp = formatNumber(item.temperature);
      const precip = item.precipitation_probability;

      return `
        <div class="forecast-card hourly-card">
          <div class="forecast-day">${escapeHtml(label)}</div>
          <ha-icon icon="${iconName}"></ha-icon>
          <div class="forecast-range">${temp !== null ? `${escapeHtml(temp)}${escapeHtml(temperatureUnit)}` : '--'}</div>
          ${precip !== null && precip !== undefined ? `<div class="forecast-precip">💧 ${escapeHtml(precip)}%</div>` : ''}
        </div>
      `;
    }).join('');

    const aqiGaugeFill = Number.isFinite(Number(aqiValue))
      ? Math.min(100, (Number(aqiValue) / 300) * 100)
      : 0;

    this.innerHTML = `
      <ha-card>
        <style>
          :host { display: block; }
          ha-card { overflow: hidden; }
          .wrapper {
            padding: 16px;
            color: var(--primary-text-color);
            background: radial-gradient(circle at top left, rgba(0, 170, 255, 0.09), transparent 30%),
              linear-gradient(180deg, rgba(10, 16, 24, 0.96), rgba(6, 10, 18, 0.98));
          }
          .grid {
            display: grid;
            gap: 14px;
            grid-template-columns: 2fr 1.15fr;
          }
          .panel {
            border: 1px solid rgba(120, 200, 255, 0.16);
            border-radius: 18px;
            background: rgba(2, 10, 20, 0.55);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
            padding: 14px;
          }
          .section-title {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            color: #5ed7ff;
            font-size: 0.78rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 12px;
          }
          .current-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 12px;
          }
          .location {
            font-size: 0.95rem;
            opacity: 0.9;
            letter-spacing: 0.03em;
          }
          .temperature {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            margin-top: 4px;
          }
          .temperature .value {
            font-size: 4rem;
            line-height: 0.9;
            font-weight: 200;
          }
          .temperature .unit {
            font-size: 1.5rem;
            line-height: 1;
            opacity: 0.85;
            margin-top: 7px;
          }
          .condition {
            margin-top: 10px;
            font-size: 1.05rem;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }
          .current-main {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 180px;
            gap: 14px;
            align-items: center;
          }
          .hero-icon {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 180px;
            font-size: 120px;
            color: #ffd166;
            filter: drop-shadow(0 0 18px rgba(255, 191, 0, 0.35));
          }
          .submetrics {
            margin-top: 14px;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
          }
          .detail-grid {
            margin-top: 10px;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .metric {
            border-radius: 14px;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          .metric-label {
            font-size: 0.74rem;
            opacity: 0.65;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 4px;
          }
          .metric-value {
            font-size: 1rem;
            font-weight: 700;
          }
          .metric-value span { font-weight: 500; opacity: 0.75; }
          .forecast-strip {
            display: grid;
            grid-template-columns: repeat(${Math.max(1, Math.min(dailyForecast.length || 1, 5))}, minmax(0, 1fr));
            gap: 10px;
          }
          .forecast-strip.hourly {
            grid-template-columns: repeat(${Math.max(1, Math.min(hourlyForecast.length || 1, 6))}, minmax(0, 1fr));
            margin-bottom: 12px;
          }
          .forecast-card {
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.03);
            padding: 10px 8px 12px;
            text-align: center;
          }
          .hourly-card {
            padding-top: 12px;
          }
          .forecast-day {
            font-size: 0.72rem;
            opacity: 0.75;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 8px;
          }
          .forecast-card ha-icon {
            width: 32px;
            height: 32px;
            color: #ffd166;
          }
          .forecast-range {
            margin-top: 6px;
            font-size: 0.98rem;
            font-weight: 700;
          }
          .forecast-summary {
            margin-top: 4px;
            font-size: 0.76rem;
            opacity: 0.78;
            min-height: 2.1em;
          }
          .forecast-precip {
            margin-top: 6px;
            font-size: 0.78rem;
            color: #7dd3fc;
          }
          .aqi-body {
            display: grid;
            grid-template-columns: 170px minmax(0, 1fr);
            gap: 14px;
            align-items: center;
          }
          .gauge {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            margin: 0 auto;
            display: grid;
            place-items: center;
            background: conic-gradient(${aqi.color} 0% ${aqiGaugeFill}%, rgba(255,255,255,0.08) ${aqiGaugeFill}% 100%);
            position: relative;
          }
          .gauge::after {
            content: '';
            position: absolute;
            inset: 18px;
            border-radius: 50%;
            background: rgba(4, 9, 16, 0.98);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }
          .gauge-inner {
            position: relative;
            z-index: 1;
            text-align: center;
          }
          .gauge-label {
            font-size: 0.7rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            opacity: 0.7;
          }
          .gauge-value {
            font-size: 2.1rem;
            line-height: 1;
            font-weight: 700;
            color: ${aqi.color};
            margin-top: 6px;
          }
          .gauge-status {
            margin-top: 6px;
            font-size: 0.78rem;
            font-weight: 700;
            color: ${aqi.color};
            text-transform: uppercase;
          }
          .pollutants {
            display: grid;
            gap: 8px;
          }
          .pollutant {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 12px;
            align-items: center;
            padding: 8px 10px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.03);
          }
          .pollutant .name { opacity: 0.8; }
          .pollutant .value { font-weight: 700; }
          .pollutant .value span { opacity: 0.7; font-weight: 500; margin-left: 4px; }
          .allergy {
            margin-top: 12px;
            border-radius: 14px;
            padding: 12px;
            background: linear-gradient(180deg, rgba(255, 183, 3, 0.09), rgba(255, 255, 255, 0.03));
            border: 1px solid rgba(255, 183, 3, 0.15);
          }
          .allergy-title {
            color: #ffbf00;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 0.75rem;
            font-weight: 800;
            margin-bottom: 8px;
          }
          .allergy-risk {
            font-size: 1.05rem;
            font-weight: 800;
            color: #fb7185;
            margin-bottom: 6px;
          }
          .allergy-desc { opacity: 0.8; line-height: 1.45; }
          .sensor-list {
            margin-top: 12px;
            display: grid;
            gap: 8px;
          }
          .sensor-pill {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            border-radius: 12px;
            padding: 8px 10px;
            background: rgba(255, 255, 255, 0.03);
          }
          .sensor-name { opacity: 0.75; }
          .sensor-value { font-weight: 700; }
          .empty { padding: 16px; opacity: 0.8; }
          .footer-note {
            margin-top: 14px;
            font-size: 0.82rem;
            opacity: 0.6;
          }
          @media (max-width: 1100px) {
            .grid { grid-template-columns: 1fr; }
            .current-main { grid-template-columns: 1fr; }
            .aqi-body { grid-template-columns: 1fr; }
            .submetrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }
        </style>

        <div class="wrapper">
          <div class="grid">
            <div class="panel">
              <div class="section-title">
                <span>Weather</span>
                <span>${escapeHtml(attrs.location || this._config.entity)}</span>
              </div>
              <div class="current-main">
                <div>
                  <div class="temperature">
                    <div class="value">${escapeHtml(formatNumber(temperature) ?? temperature)}</div>
                    <div class="unit">${escapeHtml(temperatureUnit)}</div>
                  </div>
                  <div class="condition">${escapeHtml(condition)}</div>
                  <div class="location">${escapeHtml(attrs.condition_raw || '')}</div>

                  <div class="submetrics">
                    ${this._renderMetric('Feels like', formatNumber(apparent), temperatureUnit)}
                    ${this._renderMetric('Humidity', formatNumber(humidity), '%')}
                    ${this._renderMetric('Wind', formatNumber(windSpeed), windUnit)}
                  </div>

                  ${detailMetrics.length ? `
                    <div class="detail-grid">
                      ${detailMetrics.map(([label, value, suffix]) => this._renderMetric(label, formatNumber(value), suffix)).join('')}
                    </div>
                  ` : ''}
                </div>
                <div class="hero-icon">
                  <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
                </div>
              </div>
            </div>

            <div class="panel">
              <div class="section-title">
                <span>Air Quality</span>
                <span>${escapeHtml(aqi.label)}</span>
              </div>
              <div class="aqi-body">
                <div class="gauge" style="background: conic-gradient(${aqi.color} 0% ${aqiGaugeFill}%, rgba(255,255,255,0.08) ${aqiGaugeFill}% 100%);">
                  <div class="gauge-inner">
                    <div class="gauge-label">AQI</div>
                    <div class="gauge-value">${escapeHtml(formatNumber(aqiValue) ?? '--')}</div>
                    <div class="gauge-status">${escapeHtml(aqi.label)}</div>
                  </div>
                </div>
                <div>
                  <div class="pollutants">
                    ${pollutantRows.map(([name, value, unit]) => `
                      <div class="pollutant">
                        <div class="name">${escapeHtml(name)}</div>
                        <div class="value">${escapeHtml(formatNumber(value, 1) ?? '--')} <span>${escapeHtml(unit)}</span></div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>

              ${(allergyAllergen || allergyRisk || allergyTips) ? `
                <div class="allergy">
                  <div class="allergy-title">Allergy</div>
                  ${allergyAllergen ? `<div class="allergy-desc"><strong>Allergen:</strong> ${escapeHtml(allergyAllergen)}</div>` : ''}
                  ${allergyRisk ? `<div class="allergy-risk">${escapeHtml(allergyRisk)}</div>` : ''}
                  ${allergyTips ? `<div class="allergy-desc">${escapeHtml(allergyTips)}</div>` : ''}
                </div>
              ` : ''}
            </div>

            <div class="panel">
              <div class="section-title">
                <span>Forecast</span>
                <span>Hourly / Daily</span>
              </div>
              <div class="forecast-strip hourly">
                ${hourlyCards || '<div class="empty">No hourly forecast data available.</div>'}
              </div>
              <div class="forecast-strip">
                ${forecastCards || '<div class="empty">No forecast data available.</div>'}
              </div>
              ${this._config.sensors?.length ? `
                <div class="sensor-list">
                  ${this._config.sensors.map((entityId) => this._renderSensor(entityId)).join('')}
                </div>
              ` : ''}
            </div>
          </div>

          <div class="footer-note">${escapeHtml(this._config.forecast_note || 'Built for current weather, daily forecast, AQI, and allergy data.')}</div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get('accuweather-card')) {
  customElements.define('accuweather-card', AccuWeatherCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'accuweather-card',
  name: 'AccuWeather Card',
  description: 'Dashboard-style card for current weather, forecast, AQI, and allergy',
});
