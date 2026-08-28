function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pickValue(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }
  return null;
}

function getValueAtPath(source, path) {
  if (!source || !path) {
    return undefined;
  }

  return String(path).split('.').reduce((current, segment) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    return current[segment];
  }, source);
}

function getValueByPathSpec(source, pathSpec) {
  if (Array.isArray(pathSpec)) {
    return pickValue(...pathSpec.map((path) => getValueAtPath(source, path)));
  }

  return getValueAtPath(source, pathSpec);
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
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

function downsample(points, maxPoints = 48) {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = points.length / maxPoints;
  const sampled = [];

  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(points[Math.floor(index * step)]);
  }

  const lastPoint = points[points.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) {
    sampled.push(lastPoint);
  }

  return sampled;
}

function sparklineSvg(points, color, id) {
  const width = 160;
  const height = 36;
  const paddingY = 4;
  const safeColor = color || '#58d8ff';
  const safeId = `spark-${id}`;

  if (!points.length) {
    return `
      <svg viewBox="0 0 ${width} ${height}" class="sparkline" aria-hidden="true">
        <path d="M 0 ${height - paddingY} L ${width} ${height - paddingY}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    `;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length === 1 ? 0 : width / (points.length - 1);

  const coords = points.map((point, index) => {
    const x = index * stepX;
    const normalized = (point.value - min) / range;
    const y = paddingY + ((1 - normalized) * (height - paddingY * 2));
    return { x, y };
  });

  const linePath = coords.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${width} ${height - paddingY} L 0 ${height - paddingY} Z`;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="sparkline" aria-hidden="true">
      <defs>
        <linearGradient id="${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.34" />
          <stop offset="100%" stop-color="${safeColor}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${safeId})" />
      <path d="${linePath}" fill="none" stroke="${safeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function routerLogoSvg() {
  return `
    <svg viewBox="0 0 64 64" class="router-logo" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="router-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#7dd3fc" />
          <stop offset="100%" stop-color="#38bdf8" />
        </linearGradient>
      </defs>
      <rect x="10" y="28" width="44" height="16" rx="8" fill="url(#router-body)" opacity="0.95" />
      <rect x="16" y="19" width="32" height="8" rx="4" fill="#0b1220" opacity="0.9" />
      <rect x="18" y="45" width="4" height="8" rx="2" fill="url(#router-body)" />
      <rect x="42" y="45" width="4" height="8" rx="2" fill="url(#router-body)" />
      <path d="M22 22c2.5-2.6 5.5-3.9 9-3.9s6.5 1.3 9 3.9" fill="none" stroke="#7dd3fc" stroke-width="2.2" stroke-linecap="round" />
      <path d="M18 17c3.6-4 8.1-6 13-6s9.4 2 13 6" fill="none" stroke="#7dd3fc" stroke-opacity="0.7" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  `;
}

function normalizeConfig(config) {
  return {
    title: 'NETWORK',
    history_hours: 24,
    ...config,
  };
}

function dataRateToMbps(value, unit) {
  const numericValue = toNumber(value);
  if (numericValue === null) {
    return null;
  }

  const rawUnit = String(unit || '').trim().toLowerCase();

  if (!rawUnit) {
    return numericValue;
  }

  if (rawUnit.includes('mib/s')) {
    return numericValue * 8;
  }

  if (rawUnit.includes('gib/s')) {
    return numericValue * 8192;
  }

  if (rawUnit.includes('kib/s') || rawUnit.includes('kb/s') || rawUnit.includes('kbyte/s')) {
    return (numericValue * 8) / 1024;
  }

  if (rawUnit.includes('mb/s')) {
    return numericValue * 8;
  }

  if (rawUnit.includes('gb/s')) {
    return numericValue * 8000;
  }

  if (rawUnit.includes('kbps') || rawUnit.includes('kbit/s')) {
    return numericValue / 1000;
  }

  if (rawUnit.includes('mbps') || rawUnit.includes('mbit/s')) {
    return numericValue;
  }

  if (rawUnit.includes('gbps') || rawUnit.includes('gbit/s')) {
    return numericValue * 1000;
  }

  if (rawUnit.includes('bps')) {
    return numericValue / 1000000;
  }

  return numericValue;
}

function formatDataRate(value, unit) {
  const converted = dataRateToMbps(value, unit);
  if (converted === null) {
    return { value: null, unit: 'Mbps' };
  }

  const rawUnit = String(unit || '').trim().toLowerCase();
  if (!rawUnit) {
    return { value: converted, unit: 'Mbps' };
  }

  if (rawUnit.includes('bps') || rawUnit.includes('b/s')) {
    return { value: converted, unit: 'Mbps' };
  }

  return { value: converted, unit: 'Mbps' };
}

function isAvailableState(state) {
  if (!state) {
    return false;
  }

  return !['unknown', 'unavailable', 'none', ''].includes(String(state.state ?? '').trim().toLowerCase());
}

function formatLastUpdate(value) {
  if (!value) {
    return '--';
  }

  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }).format(date);
  } catch (error) {
    return String(value);
  }
}

const NETWORK_METRICS = [
  {
    key: 'download',
    label: 'DOWNLOAD',
    color: '#58d8ff',
    entityKey: 'download_speed_entity',
    chart: false,
    digits: 1,
    valueFormatter: (state) => {
      const converted = formatDataRate(state?.state, state?.attributes?.unit_of_measurement);
      return converted.value !== null
        ? `${formatNumber(converted.value, 1)} <span>${escapeHtml(converted.unit)}</span>`
        : '--';
    },
    seriesFormatter: (state) => dataRateToMbps(state?.state, state?.attributes?.unit_of_measurement),
  },
  {
    key: 'upload',
    label: 'UPLOAD',
    color: '#34d399',
    entityKey: 'upload_speed_entity',
    chart: false,
    digits: 1,
    valueFormatter: (state) => {
      const converted = formatDataRate(state?.state, state?.attributes?.unit_of_measurement);
      return converted.value !== null
        ? `${formatNumber(converted.value, 1)} <span>${escapeHtml(converted.unit)}</span>`
        : '--';
    },
    seriesFormatter: (state) => dataRateToMbps(state?.state, state?.attributes?.unit_of_measurement),
  },
  {
    key: 'latency',
    label: 'LATENCY',
    color: '#fbbf24',
    entityKey: 'latency_entity',
    chart: true,
    digits: 0,
    valueFormatter: (state) => {
      const value = toNumber(state?.state);
      return value !== null ? `${formatNumber(value, 0)} <span>ms</span>` : '--';
    },
    seriesFormatter: (state) => toNumber(state?.state),
  },
];

class NetworkCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('network-card-editor');
  }

  static getStubConfig() {
    return {
      entity: 'sensor.tl_wr820n_300mbps_wi_fi_router_external_ip',
      title: 'NETWORK',
      history_hours: 24,
      download_speed_entity: 'sensor.tl_wr820n_300mbps_wi_fi_router_download_speed',
      upload_speed_entity: 'sensor.tl_wr820n_300mbps_wi_fi_router_upload_speed',
      external_ip_entity: 'sensor.tl_wr820n_300mbps_wi_fi_router_external_ip',
      connected_devices_entity: '',
      latency_entity: '',
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('You need to define an entity');
    }

    this._config = normalizeConfig(config);
    this._historyLoading = false;
    this._historyKey = null;
    this._historyByEntity = {};
    this._render();
    this._loadHistory();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
    this._loadHistory();
  }

  getCardSize() {
    return 4;
  }

  getGridOptions() {
    return {
      columns: 4,
      rows: 'auto',
      min_rows: 3,
    };
  }

  _stateFor(entityId) {
    return this._hass?.states?.[entityId] || null;
  }

  _resolveSummaryValue(entityId, mainState, attributePath) {
    const linkedState = entityId ? this._stateFor(entityId) : null;
    if (linkedState && isAvailableState(linkedState)) {
      return linkedState.state;
    }

    return getValueByPathSpec(mainState?.attributes || {}, attributePath)
      ?? getValueByPathSpec(mainState || {}, attributePath)
      ?? null;
  }

  _buildSeries(historyEntries, metric) {
    const series = [];

    for (const entry of historyEntries) {
      const timestamp = entry.last_updated || entry.last_changed || entry.last_updated_iso || entry.last_changed_iso;
      const numericValue = metric.seriesFormatter(entry);

      if (timestamp && numericValue !== null && numericValue !== undefined && !Number.isNaN(numericValue)) {
        series.push({
          timestamp: String(timestamp),
          value: numericValue,
        });
      }
    }

    return downsample(series, 48);
  }

  async _loadHistory() {
    if (!this._hass || !this._config) {
      return;
    }

    const hours = Math.max(1, Number(this._config.history_hours) || 24);
    const entityIds = NETWORK_METRICS
      .filter((metric) => metric.chart)
      .map((metric) => this._config[metric.entityKey])
      .filter(Boolean);

    if (!entityIds.length) {
      return;
    }

    const historyKey = `${entityIds.join('|')}|${hours}`;
    if (this._historyKey === historyKey || this._historyLoading) {
      return;
    }

    this._historyLoading = true;
    try {
      const start = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const uniqueEntityIds = [...new Set(entityIds)];
      const results = await Promise.all(uniqueEntityIds.map(async (entityId) => {
        const response = await this._hass.callApi('GET', `history/period/${encodeURIComponent(start)}?filter_entity_id=${encodeURIComponent(entityId)}`);
        return [entityId, Array.isArray(response) ? response[0] || [] : []];
      }));

      const historyByEntity = {};
      for (const [entityId, historyEntries] of results) {
        const metric = NETWORK_METRICS.find((item) => this._config[item.entityKey] === entityId);
        if (!metric) {
          continue;
        }

        historyByEntity[entityId] = this._buildSeries(historyEntries, metric);
      }

      this._historyByEntity = historyByEntity;
      this._historyKey = historyKey;
    } catch (error) {
      this._historyByEntity = {};
      this._historyKey = historyKey;
    } finally {
      this._historyLoading = false;
      this._render();
    }
  }

  _renderMetric(metric) {
    const entityId = this._config?.[metric.entityKey];
    const state = entityId ? this._stateFor(entityId) : null;
    const displayValue = state ? metric.valueFormatter(state) : '--';
    const points = entityId ? this._historyByEntity?.[entityId] || [] : [];
    const chartHtml = metric.chart
      ? `
        <div class="network-metric-chart">
          ${sparklineSvg(points, metric.color, metric.key)}
        </div>
      `
      : '';

    return `
      <div class="network-metric${metric.chart ? ' with-chart' : ' no-chart'}${metric.key === 'latency' ? ' wide' : ''}">
        <div class="network-metric-label">${escapeHtml(metric.label)}</div>
        <div class="network-metric-value">${displayValue}</div>
        ${chartHtml}
      </div>
    `;
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }

    const mainState = this._stateFor(this._config.entity);
    if (!mainState) {
      this.innerHTML = `
        <ha-card>
          <div class="network-wrapper">
            <div class="network-empty">Network entity not found: ${escapeHtml(this._config.entity)}</div>
          </div>
        </ha-card>
      `;
      return;
    }

    const attrs = mainState.attributes || {};
    const title = this._config.title || 'NETWORK';
    const routerName = attrs.friendly_name || attrs.host_name || attrs.device_name || 'Router';
    const routerModel = attrs.model || attrs.device_model || attrs.router_model || attrs.fqdn || 'UPnP / IGD';
    const statusOnline = isAvailableState(mainState)
      || NETWORK_METRICS.some((metric) => this._config[metric.entityKey] && isAvailableState(this._stateFor(this._config[metric.entityKey])));
    const status = statusOnline
      ? { label: 'ONLINE', tone: 'good', detail: 'UPNP / IGD ACTIVE' }
      : { label: 'OFFLINE', tone: 'warning', detail: 'NO LIVE DATA' };

    const connectedDevices = this._resolveSummaryValue(this._config.connected_devices_entity, mainState, ['connected_devices', 'number_of_clients', 'clients_connected']);
    const externalIp = this._resolveSummaryValue(this._config.external_ip_entity, mainState, ['external_ip', 'wan_ip', 'public_ip']);
    const lastUpdate = attrs.last_update || attrs.timestamp || mainState.last_updated;

    const metricRows = NETWORK_METRICS
      .filter((metric) => this._config[metric.entityKey])
      .map((metric) => this._renderMetric(metric))
      .join('');

    const styles = `
      <style>
        :host {
          display: block;
        }

        ha-card {
          overflow: hidden;
          background: linear-gradient(180deg, rgba(6, 14, 28, 0.98), rgba(3, 9, 18, 0.98));
          color: var(--primary-text-color);
          border: 1px solid rgba(125, 211, 252, 0.14);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
        }

        .network-wrapper {
          padding: 12px;
          background:
            radial-gradient(circle at 18% 18%, rgba(34, 211, 238, 0.10), transparent 26%),
            radial-gradient(circle at 82% 10%, rgba(52, 211, 153, 0.08), transparent 24%),
            linear-gradient(180deg, rgba(7, 15, 28, 0.94), rgba(3, 8, 16, 0.98));
        }

        .network-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
        }

        .network-title-group {
          min-width: 0;
        }

        .network-title {
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #58d8ff;
        }

        .network-title span {
          color: rgba(255, 255, 255, 0.8);
        }

        .network-subtitle {
          margin-top: 2px;
          font-size: 0.82rem;
          color: rgba(255, 255, 255, 0.68);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .network-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          padding: 8px 10px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .network-badge {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          min-width: 0;
        }

        .network-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: radial-gradient(circle, rgba(34, 211, 238, 0.12), rgba(34, 211, 238, 0.03));
          border: 1px solid rgba(34, 211, 238, 0.12);
          color: #58d8ff;
        }

        .network-icon .router-logo {
          width: 34px;
          height: 34px;
          display: block;
        }

        .network-copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .network-name {
          font-size: 0.92rem;
          font-weight: 800;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .network-line {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.68);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .network-summary-meta {
          display: grid;
          justify-items: end;
          gap: 6px;
          min-width: 0;
        }

        .network-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .network-status-pill.good {
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.34);
          background: rgba(52, 211, 153, 0.08);
        }

        .network-status-pill.warning {
          color: #fb923c;
          border-color: rgba(251, 146, 60, 0.34);
          background: rgba(251, 146, 60, 0.08);
        }

        .network-connected {
          display: grid;
          gap: 2px;
          text-align: right;
        }

        .network-connected-key {
          font-size: 0.62rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.5);
        }

        .network-connected-value {
          font-size: 1.6rem;
          font-weight: 800;
          line-height: 1;
          color: #7dd3fc;
        }

        .network-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .network-metric {
          display: grid;
          grid-template-columns: 74px minmax(0, 1fr) 116px;
          gap: 8px;
          align-items: center;
          min-height: 56px;
          padding: 8px 10px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .network-metric.wide {
          grid-column: 1 / -1;
        }

        .network-metric.no-chart {
          grid-template-columns: 88px minmax(0, 1fr);
        }

        .network-metric.no-chart .network-metric-value {
          justify-self: end;
        }

        .network-metric-label {
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #58d8ff;
        }

        .network-metric-value {
          font-size: 1rem;
          font-weight: 800;
          line-height: 1.1;
          justify-self: start;
        }

        .network-metric-value span {
          font-size: 0.72rem;
          font-weight: 700;
          opacity: 0.75;
        }

        .network-metric-chart {
          min-height: 30px;
        }

        .sparkline {
          width: 100%;
          height: 30px;
          display: block;
          overflow: visible;
        }

        .network-empty {
          padding: 12px;
          color: rgba(255, 255, 255, 0.72);
        }

        @media (max-width: 980px) {
          .network-metric {
            grid-template-columns: 68px minmax(0, 1fr) 104px;
          }

          .network-metric.no-chart {
            grid-template-columns: 76px minmax(0, 1fr);
          }
        }

        @media (max-width: 720px) {
          .network-wrapper {
            padding: 10px;
          }

          .network-header {
            flex-direction: column;
          }

          .network-summary {
            align-items: flex-start;
          }

          .network-summary-meta {
            justify-items: start;
            text-align: left;
          }

          .network-connected {
            text-align: left;
          }

          .network-metrics {
            grid-template-columns: 1fr;
          }

          .network-metric,
          .network-metric.wide {
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "label value"
              "chart chart";
            gap: 4px 8px;
          }

          .network-metric.no-chart {
            grid-template-areas: "label value";
          }

          .network-metric-label { grid-area: label; }
          .network-metric-value { grid-area: value; }
          .network-metric-chart { grid-area: chart; }
        }
      </style>
    `;

    this.innerHTML = `
      ${styles}
      <ha-card>
        <div class="network-wrapper">
          <div class="network-header">
            <div class="network-title-group">
              <div class="network-title">${escapeHtml(title)} <span>/ Router</span></div>
              <div class="network-subtitle">${escapeHtml(routerModel)}</div>
            </div>
          </div>

          <div class="network-summary">
            <div class="network-badge">
              <div class="network-icon">${routerLogoSvg()}</div>
              <div class="network-copy">
                <div class="network-name">${escapeHtml(routerName)}</div>
                <div class="network-line">WAN ${escapeHtml(externalIp || '--')}</div>
                <div class="network-line">Updated ${escapeHtml(formatLastUpdate(lastUpdate))}</div>
              </div>
            </div>
            <div class="network-summary-meta">
              <div class="network-status-pill ${status.tone}">${escapeHtml(status.label)}</div>
              ${connectedDevices !== null && connectedDevices !== undefined
                ? `
                  <div class="network-connected">
                    <div class="network-connected-key">Connected Devices</div>
                    <div class="network-connected-value">${escapeHtml(formatNumber(connectedDevices, 0) ?? '--')}</div>
                  </div>
                `
                : ''}
            </div>
          </div>

          <div class="network-metrics">
            ${metricRows || '<div class="network-empty">No router speed sensors configured.</div>'}
          </div>
        </div>
      </ha-card>
    `;
  }
}

class NetworkCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = normalizeConfig(config || {});
    this._render();
  }

  _updateConfig(partial) {
    this._config = normalizeConfig({
      ...this._config,
      ...partial,
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

    const config = this._config || normalizeConfig({});

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

        input {
          width: 100%;
          box-sizing: border-box;
          border-radius: 12px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          background: rgba(0, 0, 0, 0.12);
          color: var(--primary-text-color);
          padding: 10px 12px;
          font: inherit;
        }

        .hint {
          font-size: 0.82rem;
          opacity: 0.65;
          line-height: 1.4;
        }

        @media (max-width: 760px) {
          .field-grid {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="editor">
        <div class="section">
          <div class="section-title">Router</div>
          <div class="field-grid">
            <div class="field wide">
              <label for="entity">Router entity</label>
              <input id="entity" type="text" value="${escapeHtml(config.entity || '')}" placeholder="sensor.tl_wr820n_300mbps_wi_fi_router_external_ip" />
            </div>
            <div class="field wide">
              <label for="title">Card title</label>
              <input id="title" type="text" value="${escapeHtml(config.title || '')}" placeholder="NETWORK" />
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Metrics</div>
          <div class="field-grid">
            <div class="field">
              <label for="download-speed-entity">Download speed entity</label>
              <input id="download-speed-entity" type="text" value="${escapeHtml(config.download_speed_entity || '')}" placeholder="sensor.tl_wr820n_300mbps_wi_fi_router_download_speed" />
            </div>
            <div class="field">
              <label for="upload-speed-entity">Upload speed entity</label>
              <input id="upload-speed-entity" type="text" value="${escapeHtml(config.upload_speed_entity || '')}" placeholder="sensor.tl_wr820n_300mbps_wi_fi_router_upload_speed" />
            </div>
            <div class="field">
              <label for="latency-entity">Latency entity</label>
              <input id="latency-entity" type="text" value="${escapeHtml(config.latency_entity || '')}" placeholder="sensor.router_latency" />
            </div>
            <div class="field">
              <label for="connected-devices-entity">Connected devices entity</label>
              <input id="connected-devices-entity" type="text" value="${escapeHtml(config.connected_devices_entity || '')}" placeholder="sensor.router_connected_devices" />
            </div>
            <div class="field wide">
              <label for="external-ip-entity">External IP entity</label>
              <input id="external-ip-entity" type="text" value="${escapeHtml(config.external_ip_entity || '')}" placeholder="sensor.tl_wr820n_300mbps_wi_fi_router_external_ip" />
            </div>
            <div class="field">
              <label for="history-hours">History hours</label>
              <input id="history-hours" type="text" value="${escapeHtml(config.history_hours ?? '')}" placeholder="24" />
            </div>
          </div>
          <div class="hint">Use entity helpers to point the card at your UPnP/IGD router sensors. Latency should come from a Home Assistant Ping sensor or another RTT source; speed rows stay text-only.</div>
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
    updateTextField('download-speed-entity', (value) => this._updateConfig({ download_speed_entity: value.trim() }));
    updateTextField('upload-speed-entity', (value) => this._updateConfig({ upload_speed_entity: value.trim() }));
    updateTextField('latency-entity', (value) => this._updateConfig({ latency_entity: value.trim() }));
    updateTextField('connected-devices-entity', (value) => this._updateConfig({ connected_devices_entity: value.trim() }));
    updateTextField('external-ip-entity', (value) => this._updateConfig({ external_ip_entity: value.trim() }));
    updateTextField('history-hours', (value) => this._updateConfig({ history_hours: Number(value) || 24 }));
  }
}

if (!customElements.get('network-card-editor')) {
  customElements.define('network-card-editor', NetworkCardEditor);
}

if (!customElements.get('network-card')) {
  customElements.define('network-card', NetworkCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'network-card',
  name: 'Network Card',
  description: 'Dashboard-style network and router card for UPnP/IGD sensors',
});
