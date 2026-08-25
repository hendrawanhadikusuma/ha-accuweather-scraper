from __future__ import annotations

import re
from urllib.parse import urlparse

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_NAME

from .const import CONF_WEATHER_URL, DOMAIN


def parse_accuweather_url(url: str) -> dict[str, str]:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or parsed.netloc.lower() != "www.accuweather.com":
        raise ValueError("invalid_domain")

    # Expected:
    # /{locale}/{country}/{location-slug}/{location-key}/weather-forecast/{location-key}
    match = re.fullmatch(
        r"/([^/]+)/([^/]+)/([^/]+)/([0-9]+)/weather-forecast/([0-9]+)/?",
        parsed.path,
        re.IGNORECASE,
    )

    if not match:
        raise ValueError("invalid_weather_url")

    locale, country, slug, location_key, trailing_key = match.groups()

    if location_key != trailing_key:
        raise ValueError("location_key_mismatch")

    return {
        "locale": locale,
        "country": country,
        "slug": slug,
        "location_key": location_key,
    }


class AccuWeatherConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}

        if user_input is not None:
            try:
                parsed = parse_accuweather_url(user_input[CONF_WEATHER_URL])
            except ValueError as err:
                errors["base"] = str(err)
            else:
                await self.async_set_unique_id(parsed["location_key"])
                self._abort_if_unique_id_configured()

                title = user_input.get(CONF_NAME) or parsed["slug"].replace("-", " ").title()

                return self.async_create_entry(
                    title=title,
                    data={
                        CONF_NAME: title,
                        CONF_WEATHER_URL: user_input[CONF_WEATHER_URL].strip(),
                        **parsed,
                    },
                )

        schema = vol.Schema({
            vol.Required(CONF_WEATHER_URL): str,
            vol.Optional(CONF_NAME): str,
        })

        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
