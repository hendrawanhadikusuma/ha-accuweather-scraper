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
