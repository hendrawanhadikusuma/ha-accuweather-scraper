const AQI_LEVELS = [
  { max: 50, label: 'Good', color: '#3ddc97' },
  { max: 100, label: 'Moderate', color: '#ffd166' },
  { max: 150, label: 'Unhealthy for Sensitive Groups', color: '#f8961e' },
  { max: 200, label: 'Unhealthy', color: '#f3722c' },
  { max: 300, label: 'Very Unhealthy', color: '#e63946' },
  { max: Infinity, label: 'Hazardous', color: '#7b2cbf' },
];

const CONDITION_LABELS = {
  sunny: 'Sunny',
  'clear-night': 'Clear night',
  cloudy: 'Cloudy',
  fog: 'Fog',
  rainy: 'Rainy',
  snowy: 'Snowy',
  windy: 'Windy',
  'partlycloudy': 'Partly cloudy',
  'lightning-rainy': 'Thunderstorm',
  hail: 'Hail',
  pouring: 'Heavy rain',
};

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

function pickValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return null;
}

function aqiMeta(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return { label: 'Unknown', color: '#6c757d' };
  }

  return AQI_LEVELS.find((level) => number <= level.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

function normalizeConditionLabel(condition) {
  if (!condition) {
    return '';
  }

  const value = String(condition).trim();
  if (!value) {
    return '';
  }

  const key = value.toLowerCase();
  if (CONDITION_LABELS[key]) {
    return CONDITION_LABELS[key];
  }

  const humanized = value.replace(/[_-]+/g, ' ');
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

function getWeatherIcon(condition) {
  const normalized = String(condition || '').toLowerCase();
  if (normalized.includes('rain') || normalized.includes('drizzle') || normalized.includes('shower')) return 'mdi:weather-rainy';
  if (normalized.includes('storm') || normalized.includes('thunder')) return 'mdi:weather-lightning-rainy';
  if (normalized.includes('snow') || normalized.includes('sleet') || normalized.includes('hail')) return 'mdi:weather-snowy';
  if (normalized.includes('fog') || normalized.includes('mist') || normalized.includes('haze')) return 'mdi:weather-fog';
  if (normalized.includes('cloud')) return 'mdi:weather-cloudy';
  if (normalized.includes('wind')) return 'mdi:weather-windy';
  if (normalized.includes('partly')) return 'mdi:weather-partly-cloudy';
  if (normalized.includes('night')) return 'mdi:weather-night';
  return 'mdi:weather-sunny';
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
      return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
    } catch (error) {
      return String(item.datetime).slice(0, 10);
    }
  }

  return '';
}

function forecastSummary(item) {
  return item?.summary || normalizeConditionLabel(item?.condition) || '';
}

function forecastIcon(item, fallbackCondition = '') {
  return item?.icon || getWeatherIcon(item?.condition || forecastSummary(item) || fallbackCondition);
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
      hourly_forecast_limit: 6,
      show_current: true,
      show_air_quality: true,
      show_allergy: true,
      show_forecast: true,
      show_sensors: true,
      ...config,
    };

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return this._config.show_forecast === false ? 4 : 6;
  }

  getGridOptions() {
    return {
      columns: this._config.grid_columns || 6,
      rows: this._config.grid_rows || 'auto',
      min_rows: this._config.min_rows || 4,
    };
  }

  _stateFor(entityId) {
    return this._hass?.states?.[entityId] || null;
  }

  _renderMetric(label, value, suffix = '', digits = 0) {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const rendered = formatNumber(value, digits);
    return `
      <div class="metric">
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-value">${escapeHtml(rendered ?? value)}${suffix ? ` <span>${escapeHtml(suffix)}</span>` : ''}</div>
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

  _renderForecastCard(item, isHourly = false) {
    const label = forecastLabel(item);
    const summary = forecastSummary(item);
    const icon = forecastIcon(item, isHourly ? 'partly cloudy' : summary);
    const precip = item?.precipitation_probability;

    if (isHourly) {
      const temp = formatNumber(item?.temperature);
      return `
        <div class="forecast-card hourly-card">
          <div class="forecast-label">${escapeHtml(label)}</div>
          <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
          <div class="forecast-temp">${temp !== null ? `${escapeHtml(temp)}°` : '--'}</div>
          ${precip !== null && precip !== undefined ? `<div class="forecast-precip">💧 ${escapeHtml(precip)}%</div>` : ''}
        </div>
      `;
    }

    const high = formatNumber(item?.temperature);
    const low = formatNumber(item?.templow);
    return `
      <div class="forecast-card daily-card">
        <div class="forecast-label">${escapeHtml(label)}</div>
        <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
        <div class="forecast-range">${high !== null ? `${escapeHtml(high)}°` : '--'} / ${low !== null ? `${escapeHtml(low)}°` : '--'}</div>
        <div class="forecast-summary">${escapeHtml(summary)}</div>
        ${precip !== null && precip !== undefined ? `<div class="forecast-precip">💧 ${escapeHtml(precip)}%</div>` : ''}
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
    const currentTemperature = pickValue(attrs.temperature, attrs.native_temperature, attrs.current_temperature);
    const temperatureUnit = attrs.temperature_unit || attrs.native_temperature_unit || '°C';
    const condition = weather.state || attrs.condition || 'unknown';
    const conditionLabel = normalizeConditionLabel(condition);
    const icon = attrs.icon || getWeatherIcon(condition);
    const location = attrs.location || attrs.name || this._config.entity;
    const apparent = pickValue(attrs.apparent_temperature, attrs.realfeel_temperature, attrs.native_apparent_temperature);
    const humidity = attrs.humidity;
    const windSpeed = attrs.wind_speed;
    const windUnit = attrs.wind_speed_unit || 'km/h';
    const dailyForecast = Array.isArray(attrs.daily_forecast) ? attrs.daily_forecast.slice(0, this._config.forecast_limit) : [];
    const hourlyForecast = Array.isArray(attrs.hourly_forecast) ? attrs.hourly_forecast.slice(0, this._config.hourly_forecast_limit) : [];
    const aqiValue = attrs.air_quality_index;
    const aqi = aqiMeta(aqiValue);
    const aqiGaugeFill = Number.isFinite(Number(aqiValue))
      ? Math.min(100, (Number(aqiValue) / 300) * 100)
      : 0;
    const aqiLabelColor = aqi.color;

    const detailMetrics = [
      ['Feels like', apparent, temperatureUnit],
      ['Humidity', humidity, '%'],
      ['Wind', windSpeed, windUnit],
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

    const weatherSummary = pickValue(attrs.condition_raw, attrs.summary, conditionLabel);
    const weatherForecastPanel = `
      <section class="panel weather-panel">
        <div class="section-title">
          <span>${escapeHtml(this._config.title)}</span>
          <span>${escapeHtml(location)}</span>
        </div>

        <div class="hero">
          <div class="hero-copy">
            <div class="temperature-row">
              <div class="temperature">${escapeHtml(formatNumber(currentTemperature) ?? '--')}</div>
              <div class="temperature-unit">${escapeHtml(temperatureUnit)}</div>
            </div>
            <div class="condition">${escapeHtml(conditionLabel || 'Unknown')}</div>
            <div class="summary">${escapeHtml(weatherSummary || '')}</div>
          </div>
          <div class="hero-icon">
            <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
          </div>
        </div>

        <div class="metric-grid metric-grid-primary">
          ${this._renderMetric('Feels like', apparent, temperatureUnit)}
          ${this._renderMetric('Humidity', humidity, '%')}
          ${this._renderMetric('Wind', windSpeed, windUnit)}
          ${this._renderMetric('Gust', attrs.gust_speed, windUnit)}
        </div>

        <div class="metric-grid metric-grid-secondary">
          ${this._renderMetric('Pressure', attrs.pressure, 'hPa')}
          ${this._renderMetric('Visibility', attrs.visibility, 'km')}
          ${this._renderMetric('Dew point', attrs.dew_point, temperatureUnit)}
          ${this._renderMetric('Cloud cover', attrs.cloud_cover, '%')}
          ${this._renderMetric('UV index', attrs.uv_index, '')}
          ${this._renderMetric('Precip prob.', attrs.precipitation_probability, '%')}
          ${this._renderMetric('Cloud ceiling', attrs.cloud_ceiling, 'ft')}
        </div>
      </section>
    `;

    const aqiPanel = pollutantRows.length || aqiValue !== undefined
      ? `
        <section class="panel aqi-panel">
          <div class="section-title">
            <span>Air Quality</span>
          </div>
          <div class="aqi-layout">
            <div class="gauge-column">
              <div class="gauge" style="background: conic-gradient(${aqi.color} 0% ${aqiGaugeFill}%, rgba(255,255,255,0.08) ${aqiGaugeFill}% 100%);">
                <div class="gauge-inner">
                  <div class="gauge-label">AQI</div>
                  <div class="gauge-value" style="color: ${aqiLabelColor};">${escapeHtml(formatNumber(aqiValue) ?? '--')}</div>
                </div>
              </div>
              <div class="gauge-status" style="color: ${aqiLabelColor};">${escapeHtml(aqi.label)}</div>
            </div>
            <div class="pollutant-grid">
              ${pollutantRows.map(([name, value, unit]) => `
                <div class="pollutant">
                  <div class="pollutant-name">${escapeHtml(name)}</div>
                  <div class="pollutant-value">${escapeHtml(formatNumber(value, 1) ?? '--')} <span>${escapeHtml(unit)}</span></div>
                </div>
              `).join('')}
              ${!pollutantRows.length ? '<div class="empty-inline">No pollutant data available.</div>' : ''}
            </div>
          </div>
          <div class="aqi-footer">
            <div class="aqi-footer-key">AIR QUALITY FORECAST</div>
            <div class="aqi-footer-value" style="color: ${aqiLabelColor};">${escapeHtml(aqi.label)}</div>
          </div>
        </section>
      `
      : '';

    const allergyPanel = (attrs.allergy_allergen || attrs.allergy_risk || attrs.allergy_safety_tips || attrs.allergy_average_wind || attrs.allergy_max_wind_gusts || attrs.allergy_realfeel_high)
      ? `
        <section class="panel allergy-panel">
          <div class="section-title">
            <span>Allergy</span>
            <span>${escapeHtml(attrs.allergy_risk || 'Forecast')}</span>
          </div>
          <div class="allergy-body">
            ${attrs.allergy_allergen ? `<div class="allergy-line"><strong>Allergen:</strong> ${escapeHtml(attrs.allergy_allergen)}</div>` : ''}
            ${attrs.allergy_risk ? `<div class="allergy-line">${escapeHtml(attrs.allergy_risk)}</div>` : ''}
            ${attrs.allergy_safety_tips ? `<div class="allergy-line">${escapeHtml(attrs.allergy_safety_tips)}</div>` : ''}
            ${attrs.allergy_average_wind ? `<div class="allergy-line"><strong>Average wind:</strong> ${escapeHtml(attrs.allergy_average_wind)}</div>` : ''}
            ${attrs.allergy_max_wind_gusts ? `<div class="allergy-line"><strong>Max wind gusts:</strong> ${escapeHtml(attrs.allergy_max_wind_gusts)}</div>` : ''}
            ${attrs.allergy_realfeel_high ? `<div class="allergy-line"><strong>RealFeel high:</strong> ${escapeHtml(attrs.allergy_realfeel_high)}</div>` : ''}
          </div>
        </section>
      `
      : '';

    const forecastPanel = this._config.show_forecast === false
      ? ''
      : `
        <section class="panel forecast-panel">
          <div class="forecast-section">
            <div class="forecast-section-title">Forecast / Hourly</div>
            <div class="forecast-strip">
              ${hourlyForecast.length ? hourlyForecast.map((item) => this._renderForecastCard(item, true)).join('') : '<div class="empty-inline">No hourly forecast data available.</div>'}
            </div>
          </div>

          <div class="forecast-section">
            <div class="forecast-section-title">Forecast / Daily</div>
            <div class="forecast-strip">
              ${dailyForecast.length ? dailyForecast.map((item) => this._renderForecastCard(item, false)).join('') : '<div class="empty-inline">No daily forecast data available.</div>'}
            </div>
          </div>
        </section>
      `;

    const sensorPanel = (this._config.show_sensors !== false && Array.isArray(this._config.sensors) && this._config.sensors.length)
      ? `
        <section class="panel sensor-panel">
          <div class="section-title">
            <span>Extras</span>
            <span>Sensors</span>
          </div>
          <div class="sensor-list">
            ${this._config.sensors.map((entityId) => this._renderSensor(entityId)).join('')}
          </div>
        </section>
      `
      : '';

    this.innerHTML = `
      <ha-card>
        <style>
          :host {
            display: block;
            width: 100%;
          }

          ha-card {
            overflow: hidden;
            height: 100%;
          }

          .wrapper {
            padding: 16px;
            box-sizing: border-box;
          }

          .dashboard {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 16px;
          }

          .panel {
            border-radius: 20px;
            padding: 16px;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.025));
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-sizing: border-box;
          }

          .weather-panel {
            grid-column: span 7;
          }

          .aqi-panel {
            grid-column: span 5;
          }

          .forecast-panel,
          .allergy-panel,
          .sensor-panel {
            grid-column: 1 / -1;
          }

          .section-title {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
            font-size: 0.78rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            opacity: 0.78;
          }

          .hero {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 12px;
            align-items: center;
            margin-bottom: 14px;
          }

          .temperature-row {
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }

          .temperature {
            font-size: clamp(3rem, 7vw, 4.4rem);
            font-weight: 800;
            line-height: 0.9;
            letter-spacing: -0.05em;
          }

          .temperature-unit {
            font-size: 1.1rem;
            opacity: 0.72;
            padding-top: 8px;
          }

          .condition {
            margin-top: 8px;
            font-size: 1.05rem;
            font-weight: 700;
          }

          .summary {
            margin-top: 4px;
            font-size: 0.88rem;
            opacity: 0.72;
            min-height: 1.2em;
          }

          .hero-icon {
            width: 86px;
            height: 86px;
            display: grid;
            place-items: center;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
          }

          .hero-icon ha-icon {
            width: 64px;
            height: 64px;
            color: #ffd166;
          }

          .metric-grid {
            display: grid;
            gap: 10px;
          }

          .metric-grid-primary {
            grid-template-columns: repeat(2, 1fr);
            margin-bottom: 12px;
          }

          .metric-grid-secondary {
            grid-template-columns: repeat(3, 1fr);
          }

          .metric {
            border-radius: 14px;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          .metric-label {
            font-size: 0.72rem;
            opacity: 0.68;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 4px;
          }

          .metric-value {
            font-size: 1rem;
            font-weight: 700;
            word-break: break-word;
          }

          .metric-value span {
            font-weight: 500;
            opacity: 0.75;
          }

          .aqi-layout {
            display: grid;
            grid-template-columns: 170px 1fr;
            gap: 14px;
            align-items: center;
          }

          .gauge-column {
            display: grid;
            justify-items: center;
            gap: 8px;
          }

          .gauge {
            width: 170px;
            aspect-ratio: 1;
            border-radius: 50%;
            display: grid;
            place-items: center;
            padding: 14px;
            box-sizing: border-box;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
            position: relative;
          }

          .gauge-inner {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: transparent;
            display: grid;
            place-items: center;
            text-align: center;
            padding: 12px;
            box-sizing: border-box;
            position: relative;
            z-index: 1;
          }

          .gauge-inner::before {
            content: '';
            position: absolute;
            inset: 14px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
            z-index: 0;
            pointer-events: none;
          }

          .gauge-inner > * {
            position: relative;
            z-index: 1;
          }

          .gauge-label {
            font-size: 0.68rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            opacity: 0.68;
            color: #0f172a;
          }

          .gauge-value {
            font-size: 2rem;
            font-weight: 800;
            line-height: 1;
            margin-top: 4px;
          }

          .gauge-status {
            font-size: 0.78rem;
            font-weight: 700;
            text-align: center;
            white-space: nowrap;
          }

          .pollutant-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            align-content: start;
          }

          .pollutant {
            display: grid;
            grid-template-columns: 1fr max-content;
            gap: 12px;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .pollutant-name {
            font-size: 0.72rem;
            opacity: 0.68;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .pollutant-value {
            font-size: 0.98rem;
            font-weight: 700;
            white-space: nowrap;
            justify-self: end;
          }

          .pollutant-value span {
            font-weight: 500;
            opacity: 0.75;
            white-space: nowrap;
          }

          .aqi-footer {
            display: flex;
            gap: 12px;
            margin-top: 14px;
            align-items: center;
            flex-wrap: nowrap;
            width: 100%;
          }

          .aqi-footer-key {
            font-size: 0.72rem;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            opacity: 0.68;
            white-space: nowrap;
            flex-shrink: 0;
          }

          .aqi-footer-value {
            font-size: 1rem;
            font-weight: 800;
            white-space: nowrap;
          }

          .allergy-body {
            display: grid;
            gap: 8px;
            font-size: 0.9rem;
            line-height: 1.45;
          }

          .allergy-line {
            padding: 10px 12px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          .forecast-section + .forecast-section {
            margin-top: 16px;
          }

          .forecast-section-title {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            opacity: 0.65;
            margin-bottom: 10px;
          }

          .forecast-strip {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: minmax(120px, 1fr);
            gap: 10px;
            overflow-x: auto;
            padding-bottom: 2px;
          }

          .forecast-card {
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.03);
            padding: 12px 10px;
            text-align: center;
            min-height: 140px;
            display: grid;
            align-content: start;
            justify-items: center;
            gap: 6px;
          }

          .forecast-card ha-icon {
            width: 34px;
            height: 34px;
            color: #ffd166;
          }

          .forecast-label {
            font-size: 0.73rem;
            opacity: 0.76;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            min-height: 1.6em;
          }

          .forecast-temp,
          .forecast-range {
            font-size: 1rem;
            font-weight: 800;
          }

          .forecast-summary {
            font-size: 0.76rem;
            opacity: 0.78;
            min-height: 2.1em;
          }

          .forecast-precip {
            font-size: 0.78rem;
            color: #7dd3fc;
          }

          .sensor-list {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }

          .sensor-pill {
            border-radius: 14px;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
          }

          .sensor-name {
            font-size: 0.72rem;
            opacity: 0.68;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 4px;
          }

          .sensor-value {
            font-size: 0.98rem;
            font-weight: 700;
          }

          .empty,
          .empty-inline {
            opacity: 0.65;
            font-size: 0.9rem;
            padding: 8px 0;
          }

          @media (max-width: 1100px) {
            .weather-panel,
            .aqi-panel {
              grid-column: 1 / -1;
            }
          }

          @media (max-width: 780px) {
            .wrapper {
              padding: 12px;
            }

            .dashboard {
              gap: 12px;
            }

            .panel {
              padding: 14px;
              border-radius: 18px;
            }

            .hero {
              grid-template-columns: 1fr;
            }

            .hero-icon {
              width: 72px;
              height: 72px;
            }

            .hero-icon ha-icon {
              width: 54px;
              height: 54px;
            }

            .metric-grid-primary,
            .metric-grid-secondary,
            .pollutant-grid,
            .sensor-list {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 520px) {
            .metric-grid-primary,
            .metric-grid-secondary,
            .pollutant-grid,
            .sensor-list {
              grid-template-columns: 1fr;
            }
          }
        </style>

        <div class="wrapper">
          <div class="dashboard">
            ${this._config.show_current === false ? '' : weatherForecastPanel}
            ${this._config.show_air_quality === false ? '' : aqiPanel}
            ${forecastPanel}
            ${this._config.show_allergy === false ? '' : allergyPanel}
            ${sensorPanel}
          </div>
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
