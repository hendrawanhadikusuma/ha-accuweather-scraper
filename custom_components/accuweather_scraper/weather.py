from __future__ import annotations

from datetime import datetime

from homeassistant.components.weather import Forecast, WeatherEntity, WeatherEntityFeature
from homeassistant.const import UnitOfSpeed, UnitOfTemperature
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import AccuWeatherCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: AccuWeatherCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([AccuWeatherWeather(coordinator, entry)])


class AccuWeatherWeather(CoordinatorEntity[AccuWeatherCoordinator], WeatherEntity):
    _attr_supported_features = WeatherEntityFeature.FORECAST_DAILY | WeatherEntityFeature.FORECAST_HOURLY

    def __init__(self, coordinator: AccuWeatherCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_name = entry.title
        self._attr_unique_id = f"{entry.entry_id}_weather"

        location = coordinator.data.location if coordinator.data else entry.title
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=f"AccuWeather {location}",
            manufacturer="AccuWeather",
            model="HTML Scraper",
        )

    @property
    def condition(self) -> str | None:
        if not self.coordinator.data:
            return None
        return self._normalize_condition(self.coordinator.data.condition)

    @property
    def native_temperature(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("temperature")

    @property
    def native_temperature_unit(self):
        return UnitOfTemperature.CELSIUS

    @property
    def temperature_unit(self):
        return UnitOfTemperature.CELSIUS

    @property
    def native_apparent_temperature(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("realfeel_temperature")

    @property
    def native_dew_point(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("dew_point")

    @property
    def native_pressure(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("pressure")

    @property
    def native_visibility(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("visibility")

    @property
    def native_wind_gust_speed(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("gust_speed")

    @property
    def humidity(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("humidity")

    @property
    def native_wind_speed(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("wind_speed")

    @property
    def native_wind_speed_unit(self):
        return UnitOfSpeed.KILOMETERS_PER_HOUR

    @property
    def wind_speed_unit(self):
        return UnitOfSpeed.KILOMETERS_PER_HOUR

    @property
    def cloud_coverage(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("cloud_cover")

    @property
    def uv_index(self):
        if not self.coordinator.data:
            return None
        return self.coordinator.data.values.get("uv_index")

    async def async_forecast_daily(self) -> list[Forecast] | None:
        if not self.coordinator.data:
            return None
        return [self._forecast_payload(item) for item in self.coordinator.data.daily_forecast] or None

    async def async_forecast_hourly(self) -> list[Forecast] | None:
        if not self.coordinator.data:
            return None
        return [self._forecast_payload(item) for item in self.coordinator.data.hourly_forecast] or None

    @staticmethod
    def _forecast_payload(item: dict[str, object]) -> dict[str, object]:
        payload = {key: value for key, value in item.items() if value is not None}

        timestamp = payload.get("datetime")
        if isinstance(timestamp, datetime):
            payload["datetime"] = timestamp.isoformat()

        field_map = {
            "temperature": "native_temperature",
            "templow": "native_templow",
            "wind_speed": "native_wind_speed",
            "gust_speed": "native_wind_gust_speed",
            "apparent_temperature": "native_apparent_temperature",
            "dew_point": "native_dew_point",
            "pressure": "native_pressure",
            "precipitation": "native_precipitation",
            "cloud_cover": "cloud_coverage",
        }

        for legacy_key, native_key in field_map.items():
            if legacy_key in payload:
                payload[native_key] = payload.pop(legacy_key)

        if "summary" in payload and "condition" not in payload:
            payload["condition"] = payload["summary"]

        return payload

    @property
    def extra_state_attributes(self) -> dict[str, object]:
        if not self.coordinator.data:
            return {}

        weather_metric_keys = [
            "temperature",
            "realfeel_temperature",
            "humidity",
            "wind_speed",
            "gust_speed",
            "uv_index",
            "precipitation_probability",
            "cloud_cover",
            "pressure",
            "visibility",
            "dew_point",
            "cloud_ceiling",
        ]
        pollutant_keys = ["air_quality_index", "pm25", "pm10", "no2", "so2", "co", "o3"]
        weather_values = {
            key: self.coordinator.data.values.get(key)
            for key in weather_metric_keys
        }
        pollutant_values = {
            key: self.coordinator.data.values.get(key)
            for key in pollutant_keys
        }

        daily_forecast = []
        for item in self.coordinator.data.daily_forecast:
            timestamp = item.get("datetime")
            daily_forecast.append(
                {
                    **{key: value for key, value in item.items() if key != "datetime"},
                    "datetime": timestamp.isoformat() if isinstance(timestamp, datetime) else timestamp,
                }
            )

        hourly_forecast = []
        for item in self.coordinator.data.hourly_forecast:
            timestamp = item.get("datetime")
            hourly_forecast.append(
                {
                    **{key: value for key, value in item.items() if key != "datetime"},
                    "datetime": timestamp.isoformat() if isinstance(timestamp, datetime) else timestamp,
                }
            )

        return {
            **self.coordinator.data.attributes,
            **weather_values,
            **pollutant_values,
            **{f"allergy_{key}": value for key, value in self.coordinator.data.allergy.items()},
            "location": self.coordinator.data.location,
            "location_key": self.coordinator.data.location_key,
            "condition_raw": self.coordinator.data.condition,
            "daily_forecast": daily_forecast,
            "daily_forecast_count": len(daily_forecast),
            "hourly_forecast": hourly_forecast,
            "hourly_forecast_count": len(hourly_forecast),
        }

    @staticmethod
    def _normalize_condition(text: str | None) -> str | None:
        if not text:
            return None

        normalized = text.casefold()

        if any(token in normalized for token in ["thunder", "storm", "badai", "petir"]):
            return "lightning-rainy"
        if any(token in normalized for token in ["snow", "salju", "hail", "es"]):
            return "snowy"
        if any(token in normalized for token in ["rain", "hujan", "drizzle", "shower"]):
            return "rainy"
        if any(token in normalized for token in ["fog", "kabut", "mist", "haze"]):
            return "fog"
        if any(token in normalized for token in ["wind", "angin"]):
            return "windy"

        partly_tokens = ["partly", "sebagian", "mostly", "umumnya", "berawan sebagian"]
        clear_tokens = ["clear", "cerah", "sunny"]
        cloud_tokens = ["cloud", "awan", "berawan", "mendung"]

        if any(token in normalized for token in partly_tokens) and any(
            token in normalized for token in clear_tokens + cloud_tokens
        ):
            return "partlycloudy"

        if any(token in normalized for token in cloud_tokens):
            return "cloudy"
        if any(token in normalized for token in clear_tokens):
            return "sunny"

        return None
