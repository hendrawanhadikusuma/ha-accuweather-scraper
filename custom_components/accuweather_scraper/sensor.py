from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, SENSOR_DEFINITIONS
from .coordinator import AccuWeatherCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: AccuWeatherCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities = [
        AccuWeatherSensor(coordinator, entry, key, definition)
        for key, definition in SENSOR_DEFINITIONS.items()
    ]

    async_add_entities(entities)


class AccuWeatherSensor(CoordinatorEntity[AccuWeatherCoordinator], SensorEntity):
    def __init__(self, coordinator, entry, key, definition) -> None:
        super().__init__(coordinator)
        self._key = key
        self._definition = definition
        self._attr_name = definition["name"]
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_native_unit_of_measurement = definition["unit"]
        self._attr_device_class = definition["device_class"]
        self._attr_state_class = definition["state_class"]

        location = coordinator.data.location if coordinator.data else entry.title

        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=f"AccuWeather {location}",
            manufacturer="AccuWeather",
            model="HTML Scraper",
        )

    @property
    def native_value(self):
        if self._key == "condition":
            return self.coordinator.data.condition

        return self.coordinator.data.values.get(self._key)

    @property
    def extra_state_attributes(self):
        return self.coordinator.data.attributes
