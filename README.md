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

Add it as a dashboard resource, for example:

```yaml
url: /local/accuweather-card.js
type: module
```

Example card config:

```yaml
type: custom:accuweather-card
entity: weather.accuweather_palmerah
sensors:
  - sensor.air_quality_index
  - sensor.pm25
  - sensor.pm10
```

The card reads weather, hourly/daily forecast, AQI, and allergy attributes from the `weather` entity and can be extended with more sensor entities if you want denser layouts.
