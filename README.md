# AccuWeather Scraper for Home Assistant

A local Home Assistant custom integration that fetches and parses AccuWeather HTML directly from Home Assistant. No Cloudflare Worker, API key, or external proxy is required.

## Features

- Configure an AccuWeather weather URL.
- Automatically extracts locale, country, location slug, and location key.
- Automatically derives the Air Quality URL from the weather URL.
- Polls AccuWeather directly from Home Assistant.
- Exposes a `weather` entity compatible with the built-in Weather Forecast card.
- Exposes current weather, hourly/daily forecast, air-quality, and allergy data through the `weather` entity attributes.
- Exposes current weather and air-quality sensors.
- Uses a single coordinator to avoid duplicated HTTP requests.

## Installation

### Option 1: HACS

1. Add this repository to HACS as a **Custom repository**.
2. Choose **Integration** as the repository type.
3. Install **AccuWeather Scraper**.
4. Restart Home Assistant.
5. Add **AccuWeather Scraper** from Settings → Devices & services → Add Integration.

### Option 2: Manual install

Copy `custom_components/accuweather_scraper` into:

`/config/custom_components/accuweather_scraper`

Restart Home Assistant, then add **AccuWeather Scraper** from Settings → Devices & services → Add Integration.

Example URL:

`https://www.accuweather.com/id/id/palmerah/681074/weather-forecast/681074`

## Notes

This project scrapes public HTML rather than using the official AccuWeather API. HTML structure can change at any time. If AccuWeather changes its markup, update `scraper.py`.

Respect AccuWeather's terms, robots policies, and reasonable request rates when deploying this integration.

## Custom card

This repo also includes a dashboard-style companion Lovelace card at `custom_cards/accuweather-card.js`.

Important: Home Assistant does not load this file automatically from the integration install. You still need to place the card file in your HA `www` folder before adding it as a Lovelace resource.

Recommended path:

`/config/www/accuweather-card.js`

Add it as a dashboard resource, for example:

```yaml
url: /local/accuweather-card.js
type: module
```

If you store the file under a subfolder like `/config/www/community/accuweather-card/accuweather-card.js`, update the resource URL to match, for example:

```yaml
url: /local/community/accuweather-card/accuweather-card.js
type: module
```

If you want the card to be installable through HACS with no manual copy step, it should live in a separate frontend repository.

This card also ships with a Lovelace visual editor once the JS file is loaded as a dashboard resource. In the UI editor you can set the weather entity, title, grid options, panel toggles, forecast limits, and sensor list without writing YAML by hand.


## Match card

The repo also includes a `match-card` at `custom_cards/match-card.js` for esports-style matchup data.

Example config:

```yaml
type: custom:match-card
entity: sensor.mlbb_match
title: MLBB MATCH
subtitle: Mobile Legends
```

The card reads team names, team logos, scores, venue, date, status, and update metadata from the sensor attributes.

## System card

The repo also includes a `system-card` at `custom_cards/system-card.js` for Raspberry Pi monitor data.

Example config:

```yaml
type: custom:system-card
entity: sensor.rpi_raspberrypi_monitor
title: System
history_hours: 24
```

The sparkline charts use Home Assistant history data for the selected entity, so Recorder/history needs to be available for chart traces to appear.

## Network card

The repo also includes a `network-card` at `custom_cards/network-card.js` for router and UPnP/IGD data.

Latency is not exposed by UPnP/IGD itself. Use a Home Assistant `Ping` sensor or another RTT/latency sensor for the `latency_entity` field.

Example config:

```yaml
type: custom:network-card
entity: sensor.tl_wr820n_300mbps_wi_fi_router_external_ip
title: Network
download_speed_entity: sensor.tl_wr820n_300mbps_wi_fi_router_download_speed
upload_speed_entity: sensor.tl_wr820n_300mbps_wi_fi_router_upload_speed
external_ip_entity: sensor.tl_wr820n_300mbps_wi_fi_router_external_ip
connected_devices_entity: sensor.router_connected_devices
latency_entity: sensor.router_latency
history_hours: 24
```

Typical latency sources:

- `Ping` integration against your router IP for local LAN latency.
- `Ping` integration against a public endpoint such as `1.1.1.1` or `8.8.8.8` for internet latency.
- Any template or command-line sensor that publishes round-trip time in milliseconds.

If your router integration exposes the connected-device count or WAN IP as attributes on a single router entity, you can keep `entity` pointed at that main router state and leave the optional `*_entity` fields empty.

Example card config:

```yaml
type: custom:accuweather-card
entity: weather.accuweather_palmerah
grid_options:
  columns: 6
  rows: auto
sensors:
  - sensor.air_quality_index
  - sensor.pm25
  - sensor.pm10
```

The card reads weather, hourly/daily forecast, AQI, and allergy attributes from the `weather` entity and can be extended with more sensor entities if you want denser layouts.

### Example configs

#### Full dashboard

```yaml
type: custom:accuweather-card
entity: weather.accuweather_palmerah
grid_options:
  columns: 6
  rows: auto
show_current: true
show_air_quality: true
show_forecast: true
show_allergy: true
show_sensors: true
forecast_limit: 5
hourly_forecast_limit: 6
sensors:
  - sensor.air_quality_index
  - sensor.pm25
  - sensor.pm10
```

#### Weather only

```yaml
type: custom:accuweather-card
entity: weather.accuweather_palmerah
show_air_quality: false
show_forecast: false
show_allergy: false
show_sensors: false
```

#### Forecast only

```yaml
type: custom:accuweather-card
entity: weather.accuweather_palmerah
show_current: false
show_air_quality: false
show_allergy: false
show_sensors: false
show_forecast: true
forecast_limit: 5
hourly_forecast_limit: 6
```

#### Air quality + allergy only

```yaml
type: custom:accuweather-card
entity: weather.accuweather_palmerah
show_current: false
show_forecast: false
show_sensors: false
show_air_quality: true
show_allergy: true
```
