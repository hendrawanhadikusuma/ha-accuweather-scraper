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

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
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
  const height = 42;
  const paddingY = 4;
  const safeColor = color || '#22d3ee';
  const safeId = `spark-${id}`;

  if (!points.length) {
    return `
      <svg viewBox="0 0 ${width} ${height}" class="sparkline" aria-hidden="true">
        <defs>
          <linearGradient id="${safeId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.35" />
            <stop offset="100%" stop-color="${safeColor}" stop-opacity="0" />
          </linearGradient>
        </defs>
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
          <stop offset="0%" stop-color="${safeColor}" stop-opacity="0.38" />
          <stop offset="100%" stop-color="${safeColor}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${safeId})" />
      <path d="${linePath}" fill="none" stroke="${safeColor}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function raspberryPiLogoSvg() {
  return `
    <svg viewBox="-35.5 0 327 327" class="system-logo" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      <g>
        <path d="M69.2981309,0.005 C67.6451309,0.056 65.8651309,0.667 63.8451309,2.26 C58.8991309,0.353 54.1021309,-0.31 49.8131309,3.573 C43.1901309,2.714 41.0381309,4.487 39.4071309,6.557 C37.9531309,6.527 28.5281309,5.062 24.2051309,11.51 C13.3431309,10.225 9.91013093,17.899 13.8001309,25.056 C11.5811309,28.49 9.28213093,31.883 14.4701309,38.431 C12.6351309,42.077 13.7731309,46.033 18.0961309,50.82 C16.9551309,55.947 19.1981309,59.563 23.2211309,62.382 C22.4681309,69.397 29.6541309,73.476 31.7991309,74.929 C32.6231309,79.016 34.3401309,82.874 42.5471309,85.006 C43.9011309,91.098 48.8331309,92.15 53.6101309,93.428 C37.8231309,102.605 24.2851309,114.678 24.3771309,144.303 L22.0641309,148.428 C3.96213093,159.436 -12.3238691,194.818 13.1441309,223.576 C14.8071309,232.578 17.5971309,239.044 20.0811309,246.2 C23.7961309,275.036 48.0431309,288.539 54.4391309,290.136 C63.8101309,297.274 73.7911309,304.047 87.2981309,308.792 C100.030131,321.923 113.824131,326.928 127.693131,326.92 C127.897131,326.92 155.970131,321.924 168.703131,308.792 C182.209131,304.047 192.190131,297.274 201.562131,290.136 C207.957131,288.539 232.204131,275.036 235.919131,246.2 C238.403131,239.044 241.193131,232.578 242.857131,223.576 C268.323131,194.815 252.038131,159.432 233.936131,148.424 L231.620131,144.299 C231.712131,114.677 218.174131,102.603 202.387131,93.424 C207.163131,92.146 212.096131,91.094 213.449131,85.002 C221.656131,82.869 223.374131,79.012 224.197131,74.925 C226.343131,73.472 233.528131,69.393 232.776131,62.378 C236.798131,59.559 239.041131,55.942 237.900131,50.816 C242.224131,46.029 243.361131,42.073 241.526131,38.426 C246.715131,31.882 244.413131,28.489 242.197131,25.055 C246.085131,17.898 242.654131,10.223 231.788131,11.509 C227.467131,5.061 218.044131,6.525 216.586131,6.555 C214.956131,4.486 212.804131,2.713 206.181131,3.572 C201.892131,-0.311 197.096131,0.351 192.149131,2.259 C186.275131,-2.376 182.388131,1.339 177.948131,2.744 C170.837131,0.42 169.210131,3.603 165.716131,4.9 C157.960131,3.261 155.603131,6.829 151.885131,10.595 L147.560131,10.509 C135.862131,17.403 130.050131,31.441 127.990131,38.658 C125.929131,31.44 120.131131,17.402 108.435131,10.509 L104.110131,10.595 C100.387131,6.829 98.0311309,3.261 90.2751309,4.9 C86.7801309,3.603 85.1591309,0.42 78.0421309,2.744 C75.1281309,1.822 72.4481309,-0.094 69.2931309,0.004 L-11,141" fill="#0f172a" opacity="0.92">

        </path>
        <path d="M46.008,30.334 C77.044,46.335 95.087,59.279 104.972,70.303 C99.91,90.592 73.502,91.518 63.846,90.949 C65.823,90.029 67.473,88.926 68.058,87.233 C65.635,85.511 57.044,87.051 51.046,83.682 C53.35,83.204 54.428,82.739 55.505,81.039 C49.839,79.232 43.735,77.674 40.145,74.68 C42.082,74.704 43.891,75.114 46.421,73.359 C41.346,70.624 35.93,68.456 31.722,64.275 C34.346,64.211 37.175,64.249 37.998,63.284 C33.353,60.406 29.433,57.206 26.189,53.705 C29.861,54.148 31.412,53.767 32.3,53.127 C28.788,49.53 24.344,46.493 22.225,42.061 C24.951,43.001 27.446,43.361 29.244,41.979 C28.051,39.287 22.939,37.699 19.995,31.408 C22.866,31.687 25.91,32.034 26.519,31.408 C25.187,25.98 22.901,22.928 20.659,19.766 C26.802,19.675 36.11,19.79 35.689,19.271 L31.89,15.39 C37.891,13.774 44.031,15.649 48.489,17.041 C50.49,15.462 48.453,13.465 46.011,11.426 C51.111,12.107 55.719,13.279 59.885,14.894 C62.11,12.885 58.44,10.875 56.664,8.866 C64.543,10.36 67.881,12.461 71.198,14.564 C73.605,12.257 71.336,10.296 69.712,8.288 C75.653,10.488 78.713,13.329 81.934,16.133 C83.026,14.659 84.709,13.578 82.677,10.022 C86.895,12.453 90.072,15.318 92.422,18.528 C95.032,16.866 93.977,14.594 93.991,12.499 C98.375,16.065 101.157,19.86 104.562,23.565 C105.248,23.065 105.848,21.372 106.379,18.693 C116.836,28.838 131.613,54.393 110.177,64.525 C91.934,49.479 70.146,38.542 46.001,30.338 L46.008,30.334" fill="#75A928">

        </path>
        <path d="M210.686,30.334 C179.654,46.337 161.611,59.277 151.727,70.303 C156.789,90.592 183.196,91.518 192.852,90.949 C190.875,90.029 189.225,88.926 188.641,87.233 C191.064,85.511 199.655,87.051 205.652,83.682 C203.348,83.204 202.271,82.739 201.193,81.039 C206.86,79.232 212.964,77.674 216.553,74.68 C214.616,74.704 212.807,75.114 210.277,73.359 C215.353,70.624 220.769,68.456 224.977,64.275 C222.352,64.211 219.523,64.249 218.701,63.284 C223.346,60.406 227.266,57.206 230.51,53.705 C226.837,54.148 225.287,53.767 224.399,53.127 C227.91,49.53 232.355,46.493 234.474,42.061 C231.747,43.001 229.252,43.361 227.454,41.979 C228.647,39.287 233.76,37.699 236.703,31.408 C233.833,31.687 230.788,32.034 230.179,31.408 C231.514,25.978 233.8,22.926 236.042,19.764 C229.899,19.673 220.591,19.788 221.012,19.269 L224.811,15.387 C218.81,13.772 212.67,15.647 208.212,17.039 C206.211,15.46 208.247,13.463 210.689,11.424 C205.59,12.104 200.981,13.277 196.816,14.892 C194.59,12.883 198.261,10.873 200.037,8.864 C192.158,10.358 188.82,12.459 185.502,14.562 C183.095,12.255 185.365,10.294 186.989,8.286 C181.048,10.486 177.988,13.327 174.767,16.131 C173.674,14.657 171.992,13.576 174.023,10.02 C169.806,12.451 166.629,15.316 164.279,18.526 C161.669,16.864 162.724,14.591 162.71,12.497 C158.326,16.063 155.544,19.857 152.139,23.563 C151.453,23.063 150.853,21.37 150.322,18.69 C139.865,28.836 125.088,54.391 146.524,64.523 C164.757,49.473 186.544,38.538 210.69,30.334 L210.686,30.334" fill="#75A928">

        </path>
        <path d="M165.933,236.933 C166.041,255.866 149.484,271.295 128.953,271.394 C108.421,271.494 91.689,256.227 91.581,237.294 C91.58,237.174 91.58,237.054 91.581,236.933 C91.473,218.001 108.029,202.572 128.561,202.472 C149.093,202.372 165.824,217.639 165.933,236.572 L165.933,236.933" fill="#BC1142">

        </path>
        <path d="M107.246,139.004 C122.65,149.097 125.427,171.973 113.448,190.099 C101.469,208.226 79.271,214.74 63.867,204.648 C48.463,194.555 45.687,171.679 57.665,153.553 C69.644,135.426 91.842,128.912 107.246,139.004" fill="#BC1142">

        </path>
        <path d="M148.822,137.177 C133.419,147.269 130.642,170.146 142.62,188.272 C154.599,206.399 176.797,212.913 192.201,202.82 C207.605,192.728 210.382,169.852 198.403,151.725 C186.425,133.599 164.227,127.085 148.822,137.177" fill="#BC1142">

        </path>
        <path d="M30.258,155.504 C46.889,151.046 35.873,224.307 22.341,218.296 C7.456,206.324 2.662,171.263 30.258,155.504" fill="#BC1142">

        </path>
        <path d="M222.453,154.591 C205.82,150.134 216.838,223.398 230.37,217.387 C245.255,205.414 250.049,170.349 222.453,154.591" fill="#BC1142">

        </path>
        <path d="M165.946,100.034 C194.647,95.188 218.529,112.24 217.565,143.362 C216.621,155.294 155.372,101.811 165.946,100.034" fill="#BC1142">

        </path>
        <path d="M86.646,99.121 C57.943,94.274 34.063,111.33 35.027,142.45 C35.971,154.381 97.221,100.898 86.646,99.121" fill="#BC1142">

        </path>
        <path d="M127.874,91.863 C110.744,91.417 94.304,104.576 94.264,112.209 C94.217,121.483 107.808,130.979 127.991,131.22 C148.601,131.367 161.753,123.619 161.819,114.048 C161.895,103.204 143.074,91.695 127.874,91.862 L127.874,91.863" fill="#BC1142">

        </path>
        <path d="M128.92,282.043 C143.855,281.391 163.895,286.853 163.935,294.1 C164.183,301.136 145.76,317.034 127.93,316.727 C109.464,317.524 91.357,301.601 91.594,296.082 C91.317,287.99 114.078,281.672 128.92,282.043" fill="#BC1142">

        </path>
        <path d="M73.756,239.098 C84.389,251.908 89.237,274.414 80.363,281.049 C71.968,286.114 51.581,284.028 37.091,263.211 C27.318,245.743 28.577,227.968 35.439,222.746 C45.7,216.496 61.554,224.939 73.757,239.098 L73.756,239.098" fill="#BC1142">

        </path>
        <path d="M181.956,235.037 C170.451,248.512 164.045,273.09 172.437,281.006 C180.462,287.156 202.004,286.296 217.916,264.217 C229.47,249.388 225.599,224.623 218.999,218.047 C209.195,210.464 195.12,220.169 181.956,235.033 L181.956,235.037" fill="#BC1142">

        </path>
      </g>
    </svg>
  `;
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

function statusMeta(throttle, temperature) {
  const normalizedThrottle = String(throttle || '').trim().toLowerCase();
  if (normalizedThrottle) {
    return { label: 'ATTENTION', tone: 'warning', detail: 'THROTTLING DETECTED' };
  }

  const temp = Number(temperature);
  if (Number.isFinite(temp) && temp >= 70) {
    return { label: 'HOT', tone: 'warning', detail: 'HIGH TEMPERATURE' };
  }

  return { label: 'ONLINE', tone: 'good', detail: 'ALL SYSTEMS STABLE' };
}

const SYSTEM_METRICS = [
  {
    key: 'cpu',
    label: 'CPU',
    color: '#22d3ee',
    valuePath: 'load_1min_prcnt',
    seriesPath: 'load_1min_prcnt',
    suffix: '%',
    decimals: 1,
    subtitlePaths: ['load_5min_prcnt', 'load_15min_prcnt'],
    subtitleLabels: ['5m', '15m'],
  },
  {
    key: 'memory',
    label: 'RAM',
    color: '#34d399',
    valuePath: 'mem_used_prcnt',
    seriesPath: 'mem_used_prcnt',
    suffix: '%',
    decimals: 0,
    subtitlePath: 'memory.free_mb',
    subtitleFormatter: (value) => `${formatNumber(value, 0) ?? '--'} MB free`,
  },
  {
    key: 'disk',
    label: 'DISK',
    color: '#fbbf24',
    valuePath: 'fs_used_prcnt',
    seriesPath: 'fs_used_prcnt',
    suffix: '%',
    decimals: 0,
    subtitlePath: 'fs_total_gb',
    subtitleFormatter: (value) => `${formatNumber(value, 0) ?? '--'} GB total`,
  },
  {
    key: 'temp',
    label: 'TEMP',
    color: '#fb7185',
    valuePath: 'temperature_c',
    fallbackPaths: ['temp_cpu_c', 'temp_gpu_c'],
    seriesPath: 'temperature_c',
    suffix: '°C',
    decimals: 1,
    subtitlePath: 'temp_gpu_c',
    subtitleFormatter: (value) => `GPU ${formatNumber(value, 1) ?? '--'}°C`,
  },
];

class SystemCard extends HTMLElement {
  static getStubConfig() {
    return {
      entity: 'sensor.rpi_raspberrypi_monitor',
      title: 'SYSTEM',
      history_hours: 24,
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('You need to define an entity');
    }

    this._config = {
      title: 'SYSTEM',
      history_hours: 24,
      ...config,
    };

    this._historyKey = null;
    this._history = null;
    this._render();
    this._loadHistory();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
    this._loadHistory();
  }

  getCardSize() {
    return 5;
  }

  getGridOptions() {
    return {
      columns: 6,
      rows: 'auto',
      min_rows: 4,
    };
  }

  _stateFor(entityId) {
    return this._hass?.states?.[entityId] || null;
  }

  _buildSeries(historyEntries, metric) {
    const series = [];

    for (const entry of historyEntries) {
      const timestamp = entry.last_updated || entry.last_changed || entry.last_updated_iso || entry.last_changed_iso;
      const attributes = entry.attributes || {};
      const value = pickValue(
        getValueAtPath(attributes, metric.seriesPath),
        getValueAtPath(attributes, metric.valuePath),
        ...(metric.fallbackPaths || []).map((path) => getValueAtPath(attributes, path)),
      );
      const numericValue = toNumber(value);

      if (timestamp && numericValue !== null) {
        series.push({
          timestamp: String(timestamp),
          value: numericValue,
        });
      }
    }

    return downsample(series, 48);
  }

  async _loadHistory() {
    if (!this._hass || !this._config?.entity) {
      return;
    }

    const historyKey = `${this._config.entity}|${this._config.history_hours}`;
    if (this._historyKey === historyKey || this._historyLoading) {
      return;
    }

    this._historyLoading = true;
    try {
      const hours = Math.max(1, Number(this._config.history_hours) || 24);
      const start = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const response = await this._hass.callApi('GET', `history/period/${encodeURIComponent(start)}?filter_entity_id=${encodeURIComponent(this._config.entity)}`);
      const historyEntries = Array.isArray(response) ? response[0] || [] : [];
      const series = {};

      for (const metric of SYSTEM_METRICS) {
        series[metric.key] = this._buildSeries(historyEntries, metric);
      }

      this._history = { series };
      this._historyKey = historyKey;
    } catch (error) {
      this._history = { series: {} };
      this._historyKey = historyKey;
    } finally {
      this._historyLoading = false;
      this._render();
    }
  }

  _renderMetric(metric, attrs) {
    const rawValue = pickValue(
      getValueAtPath(attrs, metric.valuePath),
      ...(metric.fallbackPaths || []).map((path) => getValueAtPath(attrs, path)),
    );
    const numericValue = toNumber(rawValue);
    const displayValue = numericValue !== null
      ? `${formatNumber(numericValue, metric.decimals)}${metric.suffix ? ` <span>${escapeHtml(metric.suffix)}</span>` : ''}`
      : '--';

    const subtitleValue = metric.subtitlePaths
      ? metric.subtitlePaths
        .map((path, index) => {
          const value = toNumber(getValueAtPath(attrs, path));
          if (value === null) {
            return null;
          }
          return `${metric.subtitleLabels[index]} ${formatNumber(value, 1)}`;
        })
        .filter(Boolean)
        .join(' · ')
      : metric.subtitleFormatter
        ? metric.subtitleFormatter(getValueAtPath(attrs, metric.subtitlePath))
        : '';

    const points = this._history?.series?.[metric.key] || [];

    return `
      <div class="system-metric">
        <div class="system-metric-label">${escapeHtml(metric.label)}</div>
        <div class="system-metric-value">${displayValue}</div>
        ${subtitleValue ? `<div class="system-metric-subtitle">${escapeHtml(subtitleValue)}</div>` : '<div class="system-metric-subtitle empty"></div>'}
        <div class="system-metric-chart">
          ${sparklineSvg(points, metric.color, metric.key)}
        </div>
      </div>
    `;
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }

    const state = this._stateFor(this._config.entity);
    if (!state) {
      this.innerHTML = `
        <ha-card>
          <div class="system-wrapper">
            <div class="system-empty">System entity not found: ${escapeHtml(this._config.entity)}</div>
          </div>
        </ha-card>
      `;
      return;
    }

    const attrs = state.attributes || {};
    const hostName = attrs.host_name || attrs.fqdn || 'Raspberry Pi';
    const model = attrs.rpi_model || attrs.model || 'Raspberry Pi';
    const cpuTemp = pickValue(attrs.temperature_c, attrs.temp_cpu_c, attrs.temp_gpu_c);
    const status = statusMeta(attrs.throttle, cpuTemp);
    const lastUpdate = attrs.last_update || attrs.timestamp || state.last_updated;

    const metricRows = SYSTEM_METRICS.map((metric) => this._renderMetric(metric, attrs)).join('');

    const styles = `
      <style>
        :host {
          display: block;
        }

        ha-card {
          overflow: hidden;
          background: linear-gradient(180deg, rgba(7, 15, 28, 0.98), rgba(4, 10, 20, 0.98));
          color: var(--primary-text-color);
          border: 1px solid rgba(125, 211, 252, 0.14);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
        }

        .system-wrapper {
          padding: 16px;
          background:
            radial-gradient(circle at 18% 18%, rgba(34, 211, 238, 0.10), transparent 26%),
            radial-gradient(circle at 82% 10%, rgba(52, 211, 153, 0.08), transparent 24%),
            linear-gradient(180deg, rgba(7, 15, 28, 0.94), rgba(3, 8, 16, 0.98));
        }

        .system-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 14px;
        }

        .system-title-group {
          min-width: 0;
        }

        .system-title {
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #58d8ff;
        }

        .system-title span {
          color: rgba(255, 255, 255, 0.8);
        }

        .system-subtitle {
          margin-top: 4px;
          font-size: 0.88rem;
          color: rgba(255, 255, 255, 0.68);
        }

        .system-status {
          text-align: right;
          min-width: 160px;
        }

        .system-status-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }

        .system-status-pill.good {
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.34);
          background: rgba(52, 211, 153, 0.08);
        }

        .system-status-pill.warning {
          color: #fb923c;
          border-color: rgba(251, 146, 60, 0.34);
          background: rgba(251, 146, 60, 0.08);
        }

        .system-status-detail {
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.55);
        }

        .system-summary {
          margin-bottom: 14px;
        }

        .system-badge {
          display: grid;
          grid-template-columns: 70px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .system-badge-icon {
          width: 70px;
          height: 70px;
          display: grid;
          place-items: center;
          border-radius: 20px;
          background: radial-gradient(circle, rgba(34, 211, 238, 0.18), rgba(34, 211, 238, 0.04));
          border: 1px solid rgba(34, 211, 238, 0.16);
          color: #58d8ff;
        }

        .system-badge-icon .system-logo {
          width: 44px;
          height: 44px;
          display: block;
        }

        .system-badge-copy {
          min-width: 0;
          display: grid;
          gap: 4px;
        }

        .system-badge-name {
          font-size: 1rem;
          font-weight: 800;
          line-height: 1.2;
        }

        .system-badge-line {
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.68);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .system-metrics {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .system-metric {
          display: grid;
          grid-template-columns: 82px 88px minmax(0, 1fr) 175px;
          gap: 12px;
          align-items: center;
          min-height: 88px;
          padding: 12px 14px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
        }

        .system-metric-label {
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #58d8ff;
        }

        .system-metric-value {
          font-size: 1.1rem;
          font-weight: 800;
          line-height: 1.1;
          justify-self: start;
        }

        .system-metric-value span {
          font-size: 0.78rem;
          font-weight: 700;
          opacity: 0.75;
        }

        .system-metric-subtitle {
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.62);
          line-height: 1.3;
          min-width: 0;
        }

        .system-metric-subtitle.empty {
          display: none;
        }

        .system-metric-chart {
          min-height: 42px;
        }

        .sparkline {
          width: 100%;
          height: 42px;
          display: block;
          overflow: visible;
        }

        .system-empty {
          padding: 12px;
          color: rgba(255, 255, 255, 0.72);
        }

        @media (max-width: 980px) {
          .system-metric {
            grid-template-columns: 72px 82px minmax(0, 1fr) 150px;
          }

          .system-status {
            min-width: 0;
          }
        }

        @media (max-width: 720px) {
          .system-wrapper {
            padding: 12px;
          }

          .system-header {
            flex-direction: column;
          }

          .system-status {
            text-align: left;
          }

          .system-metric {
            grid-template-columns: 1fr 1fr;
            grid-template-areas:
              "label value"
              "subtitle subtitle"
              "chart chart";
          }

          .system-metric-label { grid-area: label; }
          .system-metric-value { grid-area: value; }
          .system-metric-subtitle { grid-area: subtitle; }
          .system-metric-chart { grid-area: chart; }
        }
      </style>
    `;

    this.innerHTML = `
      ${styles}
      <ha-card>
        <div class="system-wrapper">
          <div class="system-header">
            <div class="system-title-group">
              <div class="system-title">${escapeHtml(this._config.title)} <span>/ Raspberry Pi</span></div>
              <div class="system-subtitle">${escapeHtml(model)}</div>
            </div>
            <div class="system-status">
              <div class="system-status-pill ${status.tone}">${escapeHtml(status.label)}</div>
              <div class="system-status-detail">${escapeHtml(status.detail)}</div>
            </div>
          </div>

          <div class="system-summary">
            <div class="system-badge">
              <div class="system-badge-icon">${raspberryPiLogoSvg()}</div>
              <div class="system-badge-copy">
                <div class="system-badge-name">${escapeHtml(hostName)}</div>
                <div class="system-badge-line">${escapeHtml(model)}</div>
                <div class="system-badge-line">Uptime ${escapeHtml(attrs.up_time || '--')} · Updated ${escapeHtml(formatLastUpdate(lastUpdate))}</div>
              </div>
            </div>
          </div>

          <div class="system-metrics">
            ${metricRows}
          </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get('system-card')) {
  customElements.define('system-card', SystemCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'system-card',
  name: 'System Card',
  description: 'Dashboard-style system card for Raspberry Pi monitor metrics',
});
