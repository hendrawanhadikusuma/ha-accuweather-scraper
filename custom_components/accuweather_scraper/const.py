from __future__ import annotations

from datetime import timedelta

DOMAIN = "accuweather_scraper"

CONF_WEATHER_URL = "weather_url"

DEFAULT_SCAN_INTERVAL = timedelta(minutes=15)

ATTR_LOCATION_KEY = "location_key"
ATTR_LOCATION = "location"
ATTR_WEATHER_URL = "weather_url"
ATTR_AIR_QUALITY_URL = "air_quality_url"

SENSOR_DEFINITIONS = {
    "temperature": {
        "name": "Temperature",
        "unit": "°C",
        "device_class": "temperature",
        "state_class": "measurement",
    },
    "realfeel_temperature": {
        "name": "RealFeel Temperature",
        "unit": "°C",
        "device_class": "temperature",
        "state_class": "measurement",
    },
    "humidity": {
        "name": "Humidity",
        "unit": "%",
        "device_class": "humidity",
        "state_class": "measurement",
    },
    "wind_speed": {
        "name": "Wind Speed",
        "unit": "km/h",
        "device_class": "wind_speed",
        "state_class": "measurement",
    },
    "uv_index": {
        "name": "UV Index",
        "unit": None,
        "device_class": None,
        "state_class": "measurement",
    },
    "precipitation_probability": {
        "name": "Precipitation Probability",
        "unit": "%",
        "device_class": None,
        "state_class": "measurement",
    },
    "cloud_cover": {
        "name": "Cloud Cover",
        "unit": "%",
        "device_class": None,
        "state_class": "measurement",
    },
    "air_quality_index": {
        "name": "Air Quality Index",
        "unit": None,
        "device_class": None,
        "state_class": "measurement",
    },
    "pm25": {
        "name": "PM2.5",
        "unit": "µg/m³",
        "device_class": "pm25",
        "state_class": "measurement",
    },
    "pm10": {
        "name": "PM10",
        "unit": "µg/m³",
        "device_class": "pm10",
        "state_class": "measurement",
    },
    "no2": {
        "name": "NO₂",
        "unit": "µg/m³",
        "device_class": None,
        "state_class": "measurement",
    },
    "so2": {
        "name": "SO₂",
        "unit": "µg/m³",
        "device_class": None,
        "state_class": "measurement",
    },
    "co": {
        "name": "CO",
        "unit": "µg/m³",
        "device_class": None,
        "state_class": "measurement",
    },
    "o3": {
        "name": "O₃",
        "unit": "µg/m³",
        "device_class": None,
        "state_class": "measurement",
    },
}
