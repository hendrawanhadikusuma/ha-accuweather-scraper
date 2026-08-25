from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from aiohttp import ClientSession


@dataclass
class AccuWeatherData:
    location: str
    location_key: str
    condition: str | None = None
    values: dict[str, float | int | str | None] = field(default_factory=dict)
    attributes: dict[str, Any] = field(default_factory=dict)


class AccuWeatherScraper:
    def __init__(self, session: ClientSession, weather_url: str) -> None:
        self.session = session
        self.weather_url = weather_url
        self.location = self._parse_url(weather_url)

        self.air_quality_url = (
            f"https://www.accuweather.com/"
            f"{self.location['locale']}/{self.location['country']}/"
            f"{self.location['slug']}/{self.location['location_key']}/"
            f"air-quality-index/{self.location['location_key']}"
        )

    @staticmethod
    def _parse_url(url: str) -> dict[str, str]:
        parsed = urlparse(url)
        match = re.fullmatch(
            r"/([^/]+)/([^/]+)/([^/]+)/([0-9]+)/weather-forecast/([0-9]+)/?",
            parsed.path,
            re.IGNORECASE,
        )
        if not match:
            raise ValueError("Unsupported AccuWeather URL format")

        locale, country, slug, location_key, trailing_key = match.groups()

        if location_key != trailing_key:
            raise ValueError("Location keys in URL do not match")

        return {
            "locale": locale,
            "country": country,
            "slug": slug,
            "location_key": location_key,
        }

    async def _get_html(self, url: str) -> str:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (X11; Linux aarch64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/151.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml",
        }

        async with self.session.get(
            url,
            headers=headers,
            timeout=30,
            allow_redirects=True,
        ) as response:
            response.raise_for_status()
            return await response.text(errors="replace")

    @staticmethod
    def _number(text: str | None) -> float | None:
        if not text:
            return None

        normalized = text.replace(",", ".")
        match = re.search(r"-?\d+(?:\.\d+)?", normalized)
        return float(match.group()) if match else None

    @staticmethod
    def _text(soup: BeautifulSoup, selectors: list[str]) -> str | None:
        for selector in selectors:
            node = soup.select_one(selector)
            if node:
                value = " ".join(node.stripped_strings)
                if value:
                    return value
        return None

    @staticmethod
    def _meta(soup: BeautifulSoup, name: str) -> str | None:
        node = soup.select_one(f'meta[name="{name}"]')
        return node.get("content") if node else None

    def _parse_weather(self, html: str) -> dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")

        temperature_text = self._text(soup, [
            ".current-weather-info .temp",
            ".current-weather-card .temp",
            "[class*='current-weather'] .temp",
        ])

        realfeel_text = self._text(soup, [
            ".real-feel",
            "[class*='realfeel']",
            "[class*='real-feel']",
        ])

        condition = self._text(soup, [
            ".current-weather-info .phrase",
            ".current-weather-card .phrase",
            "[class*='current-weather'] .phrase",
        ])

        humidity_text = self._text(soup, [
            "[class*='humidity'] .value",
            "[class*='humidity']",
        ])

        wind_text = self._text(soup, [
            "[class*='wind'] .value",
            "[class*='wind']",
        ])

        uv_text = self._text(soup, [
            "[class*='uv-index'] .value",
            "[class*='uv'] .value",
        ])

        precip_text = self._text(soup, [
            "[class*='precipitation'] .value",
            "[class*='precip'] .value",
        ])

        cloud_text = self._text(soup, [
            "[class*='cloud-cover'] .value",
            "[class*='cloud'] .value",
        ])

        return {
            "temperature": self._number(temperature_text),
            "realfeel_temperature": self._number(realfeel_text),
            "humidity": self._number(humidity_text),
            "wind_speed": self._number(wind_text),
            "uv_index": self._number(uv_text),
            "precipitation_probability": self._number(precip_text),
            "cloud_cover": self._number(cloud_text),
            "condition": condition,
            "page_title": self._meta(soup, "title"),
        }

    def _parse_air_quality(self, html: str) -> dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")
        text = " ".join(soup.stripped_strings)

        result: dict[str, Any] = {
            "air_quality_index": None,
            "pm25": None,
            "pm10": None,
            "no2": None,
            "so2": None,
            "co": None,
            "o3": None,
        }

        # First try semantic labels around cards/rows.
        patterns = {
            "air_quality_index": [
                r"Air Quality Index\s*[:\-]?\s*(\d+)",
                r"AQI\s*[:\-]?\s*(\d+)",
            ],
            "pm25": [r"PM2\.5\s*[:\-]?\s*([\d.,]+)"],
            "pm10": [r"PM10\s*[:\-]?\s*([\d.,]+)"],
            "no2": [r"NO2\s*[:\-]?\s*([\d.,]+)"],
            "so2": [r"SO2\s*[:\-]?\s*([\d.,]+)"],
            "co": [r"CO\s*[:\-]?\s*([\d.,]+)"],
            "o3": [r"O3\s*[:\-]?\s*([\d.,]+)"],
        }

        for key, expressions in patterns.items():
            for expression in expressions:
                match = re.search(expression, text, re.IGNORECASE)
                if match:
                    result[key] = self._number(match.group(1))
                    break

        return result

    async def async_fetch(self) -> AccuWeatherData:
        weather_html = await self._get_html(self.weather_url)
        air_html = await self._get_html(self.air_quality_url)

        weather = self._parse_weather(weather_html)
        air = self._parse_air_quality(air_html)

        values = {
            **{k: v for k, v in weather.items() if k != "condition" and k != "page_title"},
            **air,
        }

        location = self.location["slug"].replace("-", " ").title()

        return AccuWeatherData(
            location=location,
            location_key=self.location["location_key"],
            condition=weather.get("condition"),
            values=values,
            attributes={
                "weather_url": self.weather_url,
                "air_quality_url": self.air_quality_url,
                "locale": self.location["locale"],
                "country": self.location["country"],
                "location_slug": self.location["slug"],
                "source": "AccuWeather HTML",
            },
        )
