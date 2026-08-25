from __future__ import annotations

from datetime import timedelta
import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import CONF_WEATHER_URL, DEFAULT_SCAN_INTERVAL, DOMAIN
from .scraper import AccuWeatherData, AccuWeatherScraper

_LOGGER = logging.getLogger(__name__)


class AccuWeatherCoordinator(DataUpdateCoordinator[AccuWeatherData]):
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.entry = entry
        self.scraper = AccuWeatherScraper(
            session=hass.helpers.aiohttp_client.async_get_clientsession(),
            weather_url=entry.data[CONF_WEATHER_URL],
        )

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=DEFAULT_SCAN_INTERVAL,
            update_method=self._async_update_data,
        )

    async def _async_update_data(self) -> AccuWeatherData:
        try:
            return await self.scraper.async_fetch()
        except Exception as err:
            raise UpdateFailed(f"Unable to fetch AccuWeather: {err}") from err
