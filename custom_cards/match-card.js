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

function normalizeConfig(config) {
  return {
    title: 'MATCH',
    subtitle: '',
    entity: '',
    ...config,
  };
}

function formatDateTime(value) {
  if (!value) {
    return '--';
  }

  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    return String(value);
  }
}

function normalizeStatus(value) {
  const raw = String(value || '').trim().toLowerCase();

  if (['live', 'in_progress', 'ongoing', 'playing'].includes(raw)) {
    return { label: 'LIVE', tone: 'live', detail: 'MATCH IN PROGRESS' };
  }

  if (['finished', 'final', 'post', 'ended', 'done'].includes(raw)) {
    return { label: 'FINAL', tone: 'final', detail: 'MATCH COMPLETED' };
  }

  if (['cancelled', 'canceled', 'postponed', 'delay'].includes(raw)) {
    return { label: 'DELAYED', tone: 'warn', detail: 'MATCH UPDATE PENDING' };
  }

  return { label: 'UPCOMING', tone: 'upcoming', detail: 'MATCH SCHEDULED' };
}

function scoreText(value) {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  return String(value);
}

function initials(value) {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function logoMarkup(url, name, tone = 'team') {
  const fallback = initials(name);
  const escapedName = escapeHtml(name || 'Team');

  if (url) {
    return `
      <div class="match-logo ${tone}">
        <img src="${escapeHtml(url)}" alt="${escapedName} logo" />
      </div>
    `;
  }

  return `
    <div class="match-logo ${tone} fallback" aria-hidden="true">
      <span>${escapeHtml(fallback)}</span>
    </div>
  `;
}

class MatchCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('match-card-editor');
  }

  static getStubConfig() {
    return {
      entity: 'sensor.mlbb_match',
      title: 'MATCH',
      subtitle: 'Mobile Legends',
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error('You need to define an entity');
    }

    this._config = normalizeConfig(config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return {
      columns: 6,
      rows: 'auto',
      min_rows: 3,
    };
  }

  _stateFor(entityId) {
    return this._hass?.states?.[entityId] || null;
  }

  _render() {
    if (!this._config || !this._hass) {
      return;
    }

    const state = this._stateFor(this._config.entity);
    if (!state) {
      this.innerHTML = `
        <ha-card>
          <div class="match-wrapper">
            <div class="match-empty">Match entity not found: ${escapeHtml(this._config.entity)}</div>
          </div>
        </ha-card>
      `;
      return;
    }

    const attrs = state.attributes || {};
    const teamName = pickValue(attrs.team_name, attrs.home_name, attrs.team, 'Team A');
    const opponentName = pickValue(attrs.opponent_name, attrs.away_name, attrs.opponent, 'Team B');
    const teamLogo = pickValue(attrs.team_logo, attrs.home_logo, attrs.logo);
    const opponentLogo = pickValue(attrs.opponent_logo, attrs.away_logo, attrs.opponent_image);
    const status = normalizeStatus(pickValue(attrs.status, state.state));
    const title = pickValue(this._config.title, attrs.friendly_name, 'MATCH');
    const subtitle = pickValue(this._config.subtitle, attrs.game, attrs.league, attrs.venue, '');
    const venue = pickValue(attrs.venue, attrs.location, attrs.event, '--');
    const matchDate = pickValue(attrs.date, attrs.start_time, attrs.event_time, attrs.last_update);
    const teamScore = scoreText(pickValue(attrs.team_score, attrs.home_score));
    const opponentScore = scoreText(pickValue(attrs.opponent_score, attrs.away_score));
    const attribution = pickValue(attrs.attribution, 'Data from match API');
    const apiUrl = pickValue(attrs.api_url, '');

    const styles = `
      <style>
        :host {
          display: block;
        }

        ha-card {
          overflow: hidden;
          background:
            radial-gradient(circle at 16% 16%, rgba(59, 130, 246, 0.16), transparent 28%),
            radial-gradient(circle at 84% 8%, rgba(168, 85, 247, 0.12), transparent 24%),
            linear-gradient(180deg, rgba(7, 12, 22, 0.98), rgba(3, 8, 16, 0.98));
          color: var(--primary-text-color);
          border: 1px solid rgba(96, 165, 250, 0.16);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.36);
        }

        .match-wrapper {
          padding: 8px;
          background:
            radial-gradient(circle at 20% 18%, rgba(59, 130, 246, 0.12), transparent 24%),
            radial-gradient(circle at 86% 10%, rgba(168, 85, 247, 0.08), transparent 22%),
            linear-gradient(180deg, rgba(7, 15, 28, 0.88), rgba(3, 8, 16, 0.96));
        }

        .match-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 6px;
        }

        .match-title-group {
          min-width: 0;
        }

        .match-title {
          font-size: 0.76rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #8ab4ff;
        }

        .match-title span {
          color: rgba(255, 255, 255, 0.78);
        }

        .match-subtitle {
          margin-top: 1px;
          font-size: 0.74rem;
          color: rgba(255, 255, 255, 0.68);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .match-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .match-status.upcoming {
          color: #60a5fa;
          border-color: rgba(96, 165, 250, 0.34);
          background: rgba(59, 130, 246, 0.08);
        }

        .match-status.live {
          color: #fb7185;
          border-color: rgba(251, 113, 133, 0.34);
          background: rgba(251, 113, 133, 0.08);
        }

        .match-status.final {
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.34);
          background: rgba(52, 211, 153, 0.08);
        }

        .match-status.warn {
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.34);
          background: rgba(251, 191, 36, 0.08);
        }

        .match-summary {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
          padding: 8px 10px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .match-team {
          display: grid;
          grid-template-columns: 40px minmax(0, 1fr);
          gap: 8px;
          align-items: center;
          min-width: 0;
        }

        .match-team.away {
          justify-self: end;
          text-align: right;
          grid-template-columns: minmax(0, 1fr) 40px;
        }

        .match-team.away .match-team-copy {
          order: 1;
        }

        .match-team.away .match-logo {
          order: 2;
        }

        .match-logo {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          overflow: hidden;
          background: radial-gradient(circle, rgba(96, 165, 250, 0.12), rgba(96, 165, 250, 0.03));
          border: 1px solid rgba(96, 165, 250, 0.14);
          flex: none;
        }

        .match-logo.away {
          background: radial-gradient(circle, rgba(168, 85, 247, 0.12), rgba(168, 85, 247, 0.03));
          border-color: rgba(168, 85, 247, 0.14);
        }

        .match-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .match-logo.fallback {
          font-size: 0.74rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          color: rgba(255, 255, 255, 0.84);
        }

        .match-team-copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .match-team-name {
          font-size: 0.88rem;
          font-weight: 800;
          line-height: 1.2;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .match-team-meta {
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.66);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .match-score-box {
          display: grid;
          gap: 2px;
          justify-items: center;
          min-width: 56px;
        }

        .match-vs {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.09);
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.18em;
          color: rgba(255, 255, 255, 0.84);
        }

        .match-score {
          font-size: 1.42rem;
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0.02em;
          color: #e0f2fe;
        }

        .match-score-label {
          font-size: 0.57rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.52);
        }

        .match-info {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          margin-bottom: 6px;
        }

        .match-info-item {
          padding: 6px 8px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.06);
          min-width: 0;
        }

        .match-info-label {
          font-size: 0.56rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.56);
          margin-bottom: 2px;
        }

        .match-info-value {
          font-size: 0.75rem;
          font-weight: 700;
          line-height: 1.2;
          color: rgba(255, 255, 255, 0.92);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .match-empty {
          padding: 8px;
          color: rgba(255, 255, 255, 0.72);
        }

        @media (max-width: 720px) {
          .match-wrapper {
            padding: 8px;
          }

          .match-header {
            flex-direction: column;
          }

          .match-summary {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .match-team,
          .match-team.away {
            justify-self: stretch;
            text-align: left;
            grid-template-columns: 40px minmax(0, 1fr);
          }

          .match-team.away .match-team-copy,
          .match-team.away .match-logo {
            order: initial;
          }

          .match-score-box {
            justify-items: start;
          }

          .match-vs {
            width: 38px;
            height: 38px;
          }

          .match-info {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `;

    this.innerHTML = `
      ${styles}
      <ha-card>
        <div class="match-wrapper">
          <div class="match-header">
            <div class="match-title-group">
              <div class="match-title">${escapeHtml(title)} <span>/ Match</span></div>
              <div class="match-subtitle">${escapeHtml(subtitle || attrs.friendly_name || 'Esports scoreboard')}</div>
            </div>
            <div class="match-status ${escapeHtml(status.tone)}">${escapeHtml(status.label)}</div>
          </div>

          <div class="match-summary">
            <div class="match-team home">
              ${logoMarkup(teamLogo, teamName, 'home')}
              <div class="match-team-copy">
                <div class="match-team-name">${escapeHtml(teamName)}</div>
                <div class="match-team-meta">${escapeHtml(apiUrl ? 'Main team' : 'Home side')}</div>
              </div>
            </div>

            <div class="match-score-box" aria-hidden="true">
              <div class="match-vs">VS</div>
              <div class="match-score">${escapeHtml(teamScore)} <span style="opacity:.6">:</span> ${escapeHtml(opponentScore)}</div>
              <div class="match-score-label">Score</div>
            </div>

            <div class="match-team away">
              <div class="match-team-copy">
                <div class="match-team-name">${escapeHtml(opponentName)}</div>
                <div class="match-team-meta">${escapeHtml(apiUrl ? 'Opponent' : 'Away side')}</div>
              </div>
              ${logoMarkup(opponentLogo, opponentName, 'away')}
            </div>
          </div>

          <div class="match-info">
            <div class="match-info-item">
              <div class="match-info-label">Date</div>
              <div class="match-info-value">${escapeHtml(formatDateTime(matchDate))}</div>
            </div>
            <div class="match-info-item">
              <div class="match-info-label">Venue</div>
              <div class="match-info-value">${escapeHtml(venue)}</div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }
}

class MatchCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      entity: '',
      title: 'MATCH',
      subtitle: '',
      ...config,
    };

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this._render();
  }

  _updateConfig(partialConfig) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: { ...this._config, ...partialConfig } },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    if (!this.shadowRoot || !this._config) {
      return;
    }

    const config = this._config;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
        }

        .editor {
          display: grid;
          gap: 12px;
        }

        .section {
          display: grid;
          gap: 10px;
          padding: 12px;
          border-radius: 16px;
          border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.12));
          background: rgba(0, 0, 0, 0.08);
        }

        .section-title {
          font-size: 0.76rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
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
          <div class="section-title">Match</div>
          <div class="field-grid">
            <div class="field wide">
              <label for="entity">Match entity</label>
              <input id="entity" type="text" value="${escapeHtml(config.entity || '')}" placeholder="sensor.mlbb_match" />
            </div>
            <div class="field">
              <label for="title">Card title</label>
              <input id="title" type="text" value="${escapeHtml(config.title || '')}" placeholder="MATCH" />
            </div>
            <div class="field">
              <label for="subtitle">Subtitle</label>
              <input id="subtitle" type="text" value="${escapeHtml(config.subtitle || '')}" placeholder="Mobile Legends" />
            </div>
          </div>
          <div class="hint">This card reads team names, logos, scores, venue, date, and status from the match sensor attributes.</div>
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
    updateTextField('subtitle', (value) => this._updateConfig({ subtitle: value.trim() }));
  }
}

if (!customElements.get('match-card-editor')) {
  customElements.define('match-card-editor', MatchCardEditor);
}

if (!customElements.get('match-card')) {
  customElements.define('match-card', MatchCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'match-card',
  name: 'Match Card',
  description: 'Dashboard-style match card for esports match sensors',
});
