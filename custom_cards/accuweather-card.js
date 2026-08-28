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

const DEFAULT_GRID_OPTIONS = {
  columns: 6,
  rows: 'auto',
  min_rows: 4,
};

const DEFAULT_CARD_CONFIG = {
  title: 'AccuWeather',
  sensors: [],
  forecast_limit: 5,
  hourly_forecast_limit: 6,
  show_current: true,
  show_air_quality: true,
  show_allergy: true,
  show_forecast: true,
  show_sensors: true,
  grid_options: DEFAULT_GRID_OPTIONS,
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

function allergyMeta(risk) {
  const normalized = String(risk || '').trim().toLowerCase();
  if (!normalized) {
    return { label: 'Unknown', color: 'var(--secondary-text-color)' };
  }

  if (normalized.includes('extremely high') || normalized.includes('sangat tinggi')) {
    return { label: risk, color: '#d7263d' };
  }

  if (normalized.includes('very high')) {
    return { label: risk, color: '#f94144' };
  }

  if (normalized.includes('high') || normalized.includes('tinggi')) {
    return { label: risk, color: '#f8961e' };
  }

  if (normalized.includes('moderate') || normalized.includes('sedang')) {
    return { label: risk, color: '#ffd166' };
  }

  if (normalized.includes('low') || normalized.includes('rendah')) {
    return { label: risk, color: '#3ddc97' };
  }

  return { label: risk, color: 'var(--secondary-text-color)' };
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

function forecastLabel(item, isHourly = false) {
  if (!item) {
    return '';
  }

  const labelText = String(item.time_label || item.date_label || '').trim().toLowerCase();
  if (labelText === 'hari ini' || labelText === 'today') {
    return 'Hari ini';
  }

  if (isHourly) {
    if (item.time_label && String(item.time_label).trim().toLowerCase() === 'now') {
      return item.time_label;
    }

    if (item.datetime) {
      try {
        const date = new Date(item.datetime);
        return new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(date);
      } catch (error) {
        return String(item.datetime).slice(11, 16);
      }
    }

    if (item.time_label) {
      return item.time_label;
    }
  }

  if (item.datetime) {
    try {
      const date = new Date(item.datetime);
      return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
    } catch (error) {
      return String(item.datetime).slice(0, 3);
    }
  }

  if (item.date_label) {
    return String(item.date_label).split(',')[0].trim() || item.date_label;
  }

  if (item.time_label) {
    return item.time_label;
  }

  return '';
}

function forecastSummary(item) {
  return normalizeConditionLabel(item?.condition) || normalizeConditionLabel(item?.summary) || item?.summary || '';
}

function forecastSummaryTooltip(item) {
  return item?.summary || forecastSummary(item) || '';
}

function forecastIcon(item, fallbackCondition = '') {
  return item?.icon || getWeatherIcon(item?.condition || forecastSummary(item) || fallbackCondition);
}

function gaugeStatusFontSize(label) {
  const text = String(label || '').trim();
  const length = text.length;

  if (!length) {
    return 16;
  }

  if (length <= 8) {
    return 20;
  }

  if (length <= 12) {
    return 19;
  }

  if (length <= 18) {
    return 18;
  }

  if (length <= 24) {
    return 17;
  }

  if (length <= 32) {
    return 16;
  }

  return 15;
}

function normalizeGridOptions(config) {
  const gridOptions = {
    ...DEFAULT_GRID_OPTIONS,
    ...(config?.grid_options || {}),
  };

  if (config?.grid_columns !== undefined && gridOptions.columns === DEFAULT_GRID_OPTIONS.columns) {
    gridOptions.columns = config.grid_columns;
  }

  if (config?.grid_rows !== undefined && gridOptions.rows === DEFAULT_GRID_OPTIONS.rows) {
    gridOptions.rows = config.grid_rows;
  }

  if (config?.min_rows !== undefined && gridOptions.min_rows === DEFAULT_GRID_OPTIONS.min_rows) {
    gridOptions.min_rows = config.min_rows;
  }

  gridOptions.columns = normalizeGridValue(gridOptions.columns, DEFAULT_GRID_OPTIONS.columns);
  gridOptions.rows = normalizeGridValue(gridOptions.rows, DEFAULT_GRID_OPTIONS.rows);
  gridOptions.min_rows = normalizeIntegerValue(gridOptions.min_rows, DEFAULT_GRID_OPTIONS.min_rows);

  return gridOptions;
}

function normalizeCardConfig(config) {
  const sensors = Array.isArray(config?.sensors)
    ? config.sensors
    : typeof config?.sensors === 'string'
      ? parseSensorList(config.sensors)
      : [];

  return {
    ...DEFAULT_CARD_CONFIG,
    ...config,
    forecast_limit: normalizeIntegerValue(config?.forecast_limit, DEFAULT_CARD_CONFIG.forecast_limit),
    hourly_forecast_limit: normalizeIntegerValue(config?.hourly_forecast_limit, DEFAULT_CARD_CONFIG.hourly_forecast_limit),
    sensors: sensors.filter((entityId) => entityId !== null && entityId !== undefined && entityId !== ''),
    grid_options: normalizeGridOptions(config),
  };
}

function parseSensorList(value) {
  return String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGridValue(value, fallback) {
  const text = String(value ?? '').trim();
  if (!text) {
    return fallback;
  }

  if (text === 'auto' || text === 'full') {
    return text;
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeIntegerValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

class AccuWeatherCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('accuweather-card-editor');
  }

  static getStubConfig(hass, entities, entitiesFallback) {
    return {
      entity: entities?.find((entityId) => String(entityId).startsWith('weather.'))
        || entitiesFallback?.find((entityId) => String(entityId).startsWith('weather.'))
        || entities?.[0]
        || entitiesFallback?.[0]
        || '',
      title: 'AccuWeather',
      show_current: true,
      show_air_quality: true,
      show_forecast: true,
      show_allergy: true,
      show_sensors: true,
      forecast_limit: 5,
      hourly_forecast_limit: 6,
      grid_options: { ...DEFAULT_GRID_OPTIONS },
    };
  }

  setConfig(config) {
    this._config = normalizeCardConfig(config);

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
    return normalizeGridOptions(this._config);
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

  _renderMetricCard(label, value, suffix = '', digits = 0) {
    const rendered = formatNumber(value, digits);
    return `
      <div class="metric">
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-value">${escapeHtml(rendered ?? '--')}${suffix ? ` <span>${escapeHtml(suffix)}</span>` : ''}</div>
      </div>
    `;
  }

  _renderInlineMetric(label, value, suffix = '', digits = 0) {
    const rendered = formatNumber(value, digits);
    return `
      <div class="metric-inline">
        <div class="metric-inline-label">${escapeHtml(label)}</div>
        <div class="metric-inline-value">${escapeHtml(rendered ?? '--')}${suffix ? ` <span>${escapeHtml(suffix)}</span>` : ''}</div>
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
    const label = forecastLabel(item, isHourly);
    const summary = forecastSummary(item);
    const summaryTooltip = forecastSummaryTooltip(item);
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
        <div class="forecast-summary" title="${escapeHtml(summaryTooltip)}">${escapeHtml(summary)}</div>
        ${precip !== null && precip !== undefined ? `<div class="forecast-precip">💧 ${escapeHtml(precip)}%</div>` : ''}
      </div>
    `;
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }

    if (!this._config.entity) {
      this.innerHTML = `
        <ha-card>
          <div class="wrapper">
            <div class="empty">You need to define a weather entity.</div>
          </div>
        </ha-card>
      `;
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

    const conditionSummary = pickValue(attrs.condition_summary, attrs.condition_raw, attrs.summary, conditionLabel);
    const hasAqiPanel = pollutantRows.length || aqiValue !== undefined;
    const weatherPanelColumn = this._config.show_air_quality === false || !hasAqiPanel ? '1 / -1' : 'span 7';
    const aqiPanelColumn = this._config.show_current === false ? '1 / -1' : 'span 5';
    const aqiStatusSize = gaugeStatusFontSize(aqi.label);
    const weatherMetricRow1 = [
      ['Real Feel', attrs.realfeel_temperature, temperatureUnit],
      ['Real Feel Shade', pickValue(attrs.realfeel_shade_temperature, attrs.realfeel_shade, attrs.realfeel_shade_temp, attrs.apparent_temperature, attrs.realfeel_temperature, currentTemperature), temperatureUnit],
      ['Heat Index', pickValue(attrs.heat_index, attrs.heatindex, attrs.heat_index_temperature, attrs.apparent_temperature, attrs.realfeel_temperature, currentTemperature), temperatureUnit],
    ];
    const weatherMetricRow2 = [
      ['Humidity', humidity, '%'],
      ['Wind', windSpeed, windUnit],
      ['Gust', attrs.gust_speed, windUnit],
      ['Pressure', attrs.pressure, 'hPa'],
      ['Visibility', attrs.visibility, 'km'],
    ];
    const weatherMetricRow3 = [
      ['UV Index', attrs.uv_index, ''],
      ['Cloud Cover', attrs.cloud_cover, '%'],
      ['Precip Prob.', attrs.precipitation_probability, '%'],
      ['Dew Point', attrs.dew_point, temperatureUnit],
      ['Cloud Ceiling', attrs.cloud_ceiling, 'm'],
    ];
    const weatherForecastPanel = `
      <section class="weather-panel" style="grid-column: ${weatherPanelColumn};">
        <div class="section-title">
          <span>${escapeHtml(this._config.title)}</span>
          <span class="section-title-secondary">${escapeHtml(location)}</span>
        </div>

        <div class="hero">
          <div class="hero-copy">
            <div class="temperature-row">
              <div class="temperature">${escapeHtml(formatNumber(currentTemperature) ?? '--')}</div>
              <div class="temperature-unit">${escapeHtml(temperatureUnit)}</div>
            </div>
            <div class="condition">${escapeHtml(conditionSummary || conditionLabel || 'Unknown')}</div>
          </div>
          <div class="hero-icon">
            <ha-icon icon="${escapeHtml(icon)}"></ha-icon>
          </div>
        </div>

        <div class="metric-row metric-row-inline">
          ${weatherMetricRow1.map(([label, value, suffix], index) => `
            ${index > 0 ? '<div class="metric-inline-separator">|</div>' : ''}
            ${this._renderInlineMetric(label, value, suffix)}
          `).join('')}
        </div>

        <div class="metric-row metric-row-cards">
          ${weatherMetricRow2.map(([label, value, suffix]) => this._renderMetricCard(label, value, suffix)).join('')}
        </div>

        <div class="metric-row metric-row-cards">
          ${weatherMetricRow3.map(([label, value, suffix]) => this._renderMetricCard(label, value, suffix)).join('')}
        </div>
      </section>
    `;

    const aqiPanel = pollutantRows.length || aqiValue !== undefined
      ? `
        <section class="aqi-panel" style="grid-column: ${aqiPanelColumn};">
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
              <div class="gauge-status" style="color: ${aqiLabelColor}; font-size: ${aqiStatusSize}px;">${escapeHtml(aqi.label)}</div>
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

    const allergyInfo = allergyMeta(attrs.allergy_risk);
    const allergyPanel = (attrs.allergy_allergen || attrs.allergy_risk)
      ? `
        <section class="allergy-panel">
          <div class="section-title">
            <span>Allergy</span>
          </div>
          <div class="allergy-body">
            <div class="allergy-icon">
              <ha-icon icon="mdi:air-filter"></ha-icon>
            </div>
            <div class="allergy-copy">
              <div class="allergy-line allergy-allergen">${escapeHtml(attrs.allergy_allergen || 'Unknown allergen')}</div>
              <div class="allergy-line allergy-risk" style="color: ${allergyInfo.color};">${escapeHtml(allergyInfo.label)}</div>
            </div>
          </div>
        </section>
      `
      : '';

    const forecastPanel = this._config.show_forecast === false
      ? ''
      : `
        <section class="forecast-panel">
          <div class="forecast-section">
            <div class="forecast-section-title">
              <span class="forecast-section-title-main">Forecast</span>
              <span class="forecast-section-title-secondary">Hourly</span>
            </div>
            <div class="forecast-strip">
              ${hourlyForecast.length ? hourlyForecast.map((item) => this._renderForecastCard(item, true)).join('') : '<div class="empty-inline">No hourly forecast data available.</div>'}
            </div>
          </div>

          <div class="forecast-section">
            <div class="forecast-section-title">
              <span class="forecast-section-title-main">Forecast</span>
              <span class="forecast-section-title-secondary">Daily</span>
            </div>
            <div class="forecast-strip">
              ${dailyForecast.length ? dailyForecast.map((item) => this._renderForecastCard(item, false)).join('') : '<div class="empty-inline">No daily forecast data available.</div>'}
            </div>
          </div>
        </section>
      `;

    const sensorPanel = (this._config.show_sensors !== false && Array.isArray(this._config.sensors) && this._config.sensors.length)
      ? `
        <section class="sensor-panel">
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
            background: linear-gradient(180deg, rgba(7, 15, 28, 0.98), rgba(4, 10, 20, 0.98));
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

          .weather-panel,
          .aqi-panel,
          .forecast-panel,
          .allergy-panel,
          .sensor-panel {
            background: radial-gradient(circle at 18% 18%, rgba(34, 211, 238, 0.10), transparent 26%),
            radial-gradient(circle at 82% 10%, rgba(52, 211, 153, 0.08), transparent 24%),
            linear-gradient(180deg, rgba(7, 15, 28, 0.94), rgba(3, 8, 16, 0.98));
          }

          .section-title {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
            font-size: 0.78rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            opacity: 0.78;
            color: var(--primary-color);
          }

          .section-title-secondary {
            color: var(--secondary-text-color);
          }

          .hero {
            display: grid;
            grid-template-columns: 1fr 112px;
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
            width: 112px;
            height: 112px;
            display: grid;
            place-items: center;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
          }

          .hero-icon ha-icon {
            --mdc-icon-size: 82px;
            width: 82px;
            height: 82px;
            display: block;
            line-height: 1;
            color: #ffd166;
          }

          .metric-row {
            display: grid;
            gap: 10px;
          }

          .weather-panel .metric-row + .metric-row {
            margin-top: 10px;
          }

          .metric-row-inline {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
          }

          .metric-row-cards {
            grid-template-columns: repeat(5, 1fr);
          }

          .metric-inline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex: 1 1 0;
            min-width: 0;
          }

          .metric-inline-label {
            font-size: 0.72rem;
            opacity: 0.68;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            line-height: 1.15;
            white-space: normal;
            overflow-wrap: anywhere;
            text-wrap: balance;
            flex: 1 1 auto;
            min-width: 0;
          }

          .metric-inline-separator {
            font-size: 0.9rem;
            opacity: 0.42;
            font-weight: 700;
            flex: 0 0 auto;
          }

          .metric-inline-value {
            font-size: 0.98rem;
            font-weight: 700;
            flex: 0 0 auto;
            white-space: nowrap;
          }

          .metric-inline-value span {
            font-weight: 700;
            opacity: 0.75;
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
            line-height: 1.2;
            white-space: normal;
            overflow-wrap: anywhere;
            text-wrap: balance;
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
            background: var(--card-background-color, rgba(255, 255, 255, 0.96));
            box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
            z-index: 0;
            pointer-events: none;
          }

          .gauge-inner > * {
            position: relative;
            z-index: 1;
          }

          .gauge-label {
            font-size: 0.78rem;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            opacity: 0.9;
            color: var(--primary-text-color);
            font-weight: 800;
          }

          .gauge-value {
            font-size: 2.2rem;
            font-weight: 900;
            line-height: 1;
            margin-top: 4px;
          }

          .gauge-status {
            font-weight: 700;
            text-align: center;
            white-space: normal;
            overflow-wrap: anywhere;
            line-height: 1.1;
            max-width: 170px;
            font-weight: 900;
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
            align-items: start;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .pollutant-name {
            font-size: 0.72rem;
            opacity: 0.68;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 0;
            white-space: normal;
            overflow-wrap: anywhere;
            line-height: 1.2;
          }

          .pollutant-value {
            font-size: 0.98rem;
            font-weight: 700;
            white-space: nowrap;
            justify-self: end;
            align-self: start;
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
            grid-template-columns: 64px minmax(0, 1fr);
            gap: 14px;
            align-items: center;
            font-size: 0.95rem;
            line-height: 1.35;
          }

          .allergy-icon {
            width: 64px;
            height: 64px;
            display: grid;
            place-items: center;
            border-radius: 18px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.06);
            color: var(--primary-color);
          }

          .allergy-icon ha-icon {
            --mdc-icon-size: 34px;
            width: 34px;
            height: 34px;
            display: block;
            line-height: 1;
          }

          .allergy-copy {
            display: grid;
            gap: 4px;
            min-width: 0;
          }

          .allergy-line {
            font-weight: 700;
            line-height: 1.25;
          }

          .allergy-allergen {
            color: var(--primary-text-color);
          }

          .allergy-risk {
            font-size: 1.02rem;
            font-weight: 800;
          }

          .forecast-section + .forecast-section {
            margin-top: 16px;
          }

          .forecast-section-title {
            display: flex;
            align-items: baseline;
            gap: 8px;
            font-size: 0.78rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--primary-color);
            margin-bottom: 10px;
          }

          .forecast-section-title-main {
            font-weight: 800;
          }

          .forecast-section-title-secondary {
            color: var(--secondary-text-color);
            font-weight: 500;
          }

          .forecast-strip {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
            gap: 10px;
            overflow: visible;
            padding-bottom: 2px;
            align-items: start;
          }

          .forecast-card {
            border-radius: 16px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.03);
            padding: 10px 8px;
            text-align: center;
            min-height: 75px;
            display: grid;
            align-content: start;
            justify-items: center;
            gap: 4px;
          }

          .forecast-card ha-icon {
            width: 30px;
            height: 30px;
            color: #ffd166;
          }

          .forecast-label {
            font-size: 0.7rem;
            opacity: 0.76;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            min-height: 1.4em;
          }

          .forecast-temp,
          .forecast-range {
            font-size: 1rem;
            font-weight: 800;
          }

          .forecast-summary {
            font-size: 0.74rem;
            opacity: 0.78;
            min-height: 2.2em;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          .forecast-precip {
            font-size: 0.74rem;
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

            .metric-row-cards {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 780px) {
            .wrapper {
              padding: 12px;
            }

            .dashboard {
              gap: 12px;
            }

            .hero {
              grid-template-columns: 1fr;
            }

            .hero-icon {
              width: 90px;
              height: 90px;
            }

            .hero-icon ha-icon {
              --mdc-icon-size: 66px;
              width: 66px;
              height: 66px;
              display: block;
              line-height: 1;
            }

            .metric-row-inline {
              flex-direction: column;
              align-items: stretch;
            }

            .metric-inline {
              justify-content: space-between;
            }

            .metric-row-cards,
            .pollutant-grid,
            .sensor-list {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 520px) {
            .metric-row-cards,
            .pollutant-grid,
            .sensor-list {
              grid-template-columns: 1fr;
            }

            .metric-row-inline {
              flex-direction: column;
              align-items: stretch;
            }

            .metric-inline {
              justify-content: space-between;
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

class AccuWeatherCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = normalizeCardConfig({});
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = normalizeCardConfig(config);
    this._render();
  }

  _updateConfig(partial) {
    this._config = normalizeCardConfig({
      ...this._config,
      ...partial,
      grid_options: {
        ...(this._config.grid_options || {}),
        ...(partial.grid_options || {}),
      },
    });

    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const config = this._config;
    const sensorsValue = Array.isArray(config.sensors) ? config.sensors.join('\n') : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
        }

        .editor {
          display: grid;
          gap: 16px;
          padding: 4px 0 8px;
        }

        .section {
          display: grid;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          background: var(--card-background-color, rgba(255, 255, 255, 0.02));
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.08));
        }

        .section-title {
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary-color);
        }

        .field-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .field {
          display: grid;
          gap: 6px;
        }

        .field.wide {
          grid-column: 1 / -1;
        }

        label {
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.72;
        }

        input,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border-radius: 12px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          background: rgba(0, 0, 0, 0.12);
          color: var(--primary-text-color);
          padding: 10px 12px;
          font: inherit;
        }

        textarea {
          min-height: 98px;
          resize: vertical;
        }

        .switches {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px 12px;
        }

        .switch {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.08));
          background: rgba(255, 255, 255, 0.02);
        }

        .switch span {
          font-size: 0.92rem;
          font-weight: 600;
        }

        .hint {
          font-size: 0.82rem;
          opacity: 0.65;
          line-height: 1.4;
        }

        @media (max-width: 760px) {
          .field-grid,
          .switches {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="editor">
        <div class="section">
          <div class="section-title">Weather</div>
          <div class="field-grid">
            <div class="field wide">
              <label for="entity">Weather entity</label>
              <input id="entity" type="text" value="${escapeHtml(config.entity || '')}" placeholder="weather.accuweather_palmerah" />
            </div>
            <div class="field wide">
              <label for="title">Card title</label>
              <input id="title" type="text" value="${escapeHtml(config.title || '')}" placeholder="AccuWeather" />
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Layout</div>
          <div class="field-grid">
            <div class="field">
              <label for="grid-columns">Grid columns</label>
              <input id="grid-columns" type="text" value="${escapeHtml(config.grid_options?.columns ?? '')}" placeholder="6 or full" />
            </div>
            <div class="field">
              <label for="grid-rows">Grid rows</label>
              <input id="grid-rows" type="text" value="${escapeHtml(config.grid_options?.rows ?? '')}" placeholder="auto" />
            </div>
            <div class="field">
              <label for="min-rows">Min rows</label>
              <input id="min-rows" type="text" value="${escapeHtml(config.grid_options?.min_rows ?? '')}" placeholder="4" />
            </div>
            <div class="field">
              <label for="forecast-limit">Daily forecast limit</label>
              <input id="forecast-limit" type="text" value="${escapeHtml(config.forecast_limit ?? '')}" placeholder="5" />
            </div>
            <div class="field">
              <label for="hourly-limit">Hourly forecast limit</label>
              <input id="hourly-limit" type="text" value="${escapeHtml(config.hourly_forecast_limit ?? '')}" placeholder="6" />
            </div>
          </div>
          <div class="hint">Rows accepts <code>auto</code> or a number. Columns can also be set to <code>full</code>.</div>
        </div>

        <div class="section">
          <div class="section-title">Panels</div>
          <div class="switches">
            <label class="switch"><span>Show current</span><input id="show-current" type="checkbox" ${config.show_current !== false ? 'checked' : ''} /></label>
            <label class="switch"><span>Show air quality</span><input id="show-air-quality" type="checkbox" ${config.show_air_quality !== false ? 'checked' : ''} /></label>
            <label class="switch"><span>Show forecast</span><input id="show-forecast" type="checkbox" ${config.show_forecast !== false ? 'checked' : ''} /></label>
            <label class="switch"><span>Show allergy</span><input id="show-allergy" type="checkbox" ${config.show_allergy !== false ? 'checked' : ''} /></label>
            <label class="switch"><span>Show sensors</span><input id="show-sensors" type="checkbox" ${config.show_sensors !== false ? 'checked' : ''} /></label>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Sensors</div>
          <div class="field wide">
            <label for="sensors">Additional sensor entities</label>
            <textarea id="sensors" placeholder="sensor.air_quality_index\nsensor.pm25\nsensor.pm10">${escapeHtml(sensorsValue)}</textarea>
          </div>
          <div class="hint">One entity per line or separated by commas.</div>
        </div>
      </div>
    `;

    const updateTextField = (id, handler) => {
      const node = this.shadowRoot.querySelector(`#${id}`);
      if (!node) {
        return;
      }

      node.addEventListener('input', (event) => handler(event.target.value));
    };

    updateTextField('entity', (value) => this._updateConfig({ entity: value.trim() }));
    updateTextField('title', (value) => this._updateConfig({ title: value.trim() }));
    updateTextField('grid-columns', (value) => this._updateConfig({ grid_options: { columns: normalizeGridValue(value, DEFAULT_GRID_OPTIONS.columns) } }));
    updateTextField('grid-rows', (value) => this._updateConfig({ grid_options: { rows: normalizeGridValue(value, DEFAULT_GRID_OPTIONS.rows) } }));
    updateTextField('min-rows', (value) => this._updateConfig({ grid_options: { min_rows: normalizeIntegerValue(value, DEFAULT_GRID_OPTIONS.min_rows) } }));
    updateTextField('forecast-limit', (value) => this._updateConfig({ forecast_limit: normalizeIntegerValue(value, DEFAULT_CARD_CONFIG.forecast_limit) }));
    updateTextField('hourly-limit', (value) => this._updateConfig({ hourly_forecast_limit: normalizeIntegerValue(value, DEFAULT_CARD_CONFIG.hourly_forecast_limit) }));
    updateTextField('sensors', (value) => this._updateConfig({ sensors: parseSensorList(value) }));

    for (const [id, key] of [
      ['show-current', 'show_current'],
      ['show-air-quality', 'show_air_quality'],
      ['show-forecast', 'show_forecast'],
      ['show-allergy', 'show_allergy'],
      ['show-sensors', 'show_sensors'],
    ]) {
      const node = this.shadowRoot.querySelector(`#${id}`);
      if (node) {
        node.addEventListener('change', (event) => this._updateConfig({ [key]: event.target.checked }));
      }
    }
  }
}

if (!customElements.get('accuweather-card-editor')) {
  customElements.define('accuweather-card-editor', AccuWeatherCardEditor);
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
