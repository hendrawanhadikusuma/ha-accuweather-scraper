from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
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
    hourly_forecast: list[dict[str, Any]] = field(default_factory=list)
    daily_forecast: list[dict[str, Any]] = field(default_factory=list)
    allergy: dict[str, Any] = field(default_factory=dict)


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
        self.allergy_url = (
            f"https://www.accuweather.com/"
            f"{self.location['locale']}/{self.location['country']}/"
            f"{self.location['slug']}/{self.location['location_key']}/"
            f"allergies-weather/{self.location['location_key']}"
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
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,image/apng,*/*;q=0.8"
            ),
            "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Referer": "https://www.google.com/",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/150.0.0.0 Safari/537.36"
            ),
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
    def _int(text: str | None) -> int | None:
        number = AccuWeatherScraper._number(text)
        return int(number) if number is not None else None

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

    @staticmethod
    def _parse_forecast_date(date_token: str, anchor: date, previous: date | None) -> date | None:
        try:
            day, month = (int(piece) for piece in date_token.split("/", 1))
        except ValueError:
            return None

        candidate = date(anchor.year, month, day)

        if previous and candidate <= previous:
            try:
                candidate = date(anchor.year + 1, month, day)
            except ValueError:
                return None

        if candidate < anchor and (anchor - candidate).days > 60:
            try:
                candidate = date(anchor.year + 1, month, day)
            except ValueError:
                return None

        return candidate

    @staticmethod
    def _parse_forecast_datetime(time_token: str, anchor_dt: datetime, previous: datetime | None) -> datetime | None:
        try:
            hour, minute = (int(piece) for piece in time_token.split(":", 1))
        except ValueError:
            return None

        candidate = anchor_dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if previous and candidate <= previous:
            candidate = candidate + timedelta(days=1)

        return candidate

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

        pressure_text = self._text(soup, [
            "[class*='pressure'] .value",
            "[class*='pressure']",
        ])

        visibility_text = self._text(soup, [
            "[class*='visibility'] .value",
            "[class*='visibility']",
        ])

        dew_point_text = self._text(soup, [
            "[class*='dew-point'] .value",
            "[class*='dewpoint'] .value",
            "[class*='dew-point']",
            "[class*='dewpoint']",
        ])

        gust_text = self._text(soup, [
            "[class*='gust'] .value",
            "[class*='gust']",
        ])

        cloud_ceiling_text = self._text(soup, [
            "[class*='cloud-ceiling'] .value",
            "[class*='cloud-ceiling']",
        ])

        return {
            "temperature": self._number(temperature_text),
            "realfeel_temperature": self._number(realfeel_text),
            "humidity": self._number(humidity_text),
            "wind_speed": self._number(wind_text),
            "gust_speed": self._number(gust_text),
            "uv_index": self._number(uv_text),
            "precipitation_probability": self._number(precip_text),
            "cloud_cover": self._number(cloud_text),
            "pressure": self._number(pressure_text),
            "visibility": self._number(visibility_text),
            "dew_point": self._number(dew_point_text),
            "cloud_ceiling": self._number(cloud_ceiling_text),
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

    def _parse_allergy(self, html: str) -> dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")
        text = " ".join(soup.stripped_strings)

        allergen = self._text(soup, [
            "h1",
            "h2",
            "[class*='title']",
        ])

        if allergen:
            allergen = allergen.replace("Allergen Forecast", "").strip()

        scale_match = re.search(
            r"The risk of (?:tree|ragweed|grass|mold|dust|dander).+? is (extremely high|very high|high|moderate|low)",
            text,
            re.IGNORECASE,
        )

        safety_tips = None
        safety_match = re.search(r"Safety Tips\s*(.+?)(?:\s+[A-Z][A-Za-z ]+\s|$)", text, re.IGNORECASE)
        if safety_match:
            safety_tips = safety_match.group(1).strip()

        wind_text = None
        wind_match = re.search(r"Average Wind\s*([\d.,]+\s*km/h)", text, re.IGNORECASE)
        if wind_match:
            wind_text = wind_match.group(1)

        gust_text = None
        gust_match = re.search(r"Max Wind Gusts\s*([\d.,]+\s*km/h)", text, re.IGNORECASE)
        if gust_match:
            gust_text = gust_match.group(1)

        realfeel_text = None
        realfeel_match = re.search(r"RealFeel\s*([\d.,]+°[CF])", text, re.IGNORECASE)
        if realfeel_match:
            realfeel_text = realfeel_match.group(1)

        return {
            "allergen": allergen,
            "risk": scale_match.group(1).title() if scale_match else None,
            "safety_tips": safety_tips,
            "average_wind": wind_text,
            "max_wind_gusts": gust_text,
            "realfeel_high": realfeel_text,
        }

    def _parse_hourly_forecast(self, html: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(html, "html.parser")
        text = " ".join(soup.stripped_strings)

        pattern = re.compile(
            r"(?P<time>\d{1,2}:\d{2})\s+(?P<temp>-?\d+(?:[.,]\d+)?)°(?:\s+(?P<precip>\d{1,3})%)?",
            re.IGNORECASE,
        )

        forecasts: list[dict[str, Any]] = []
        anchor = datetime.now().astimezone().replace(minute=0, second=0, microsecond=0)
        previous_dt: datetime | None = None

        for match in pattern.finditer(text):
            forecast_dt = self._parse_forecast_datetime(match.group("time"), anchor, previous_dt)
            if forecast_dt is None:
                continue

            previous_dt = forecast_dt
            precip = match.group("precip")
            forecasts.append(
                {
                    "datetime": forecast_dt,
                    "time_label": match.group("time"),
                    "temperature": self._number(match.group("temp")),
                    "precipitation_probability": self._int(precip) if precip else None,
                    "summary": None,
                    "condition": None,
                }
            )

        return forecasts

    def _parse_daily_forecast(self, html: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(html, "html.parser")
        text = " ".join(soup.stripped_strings)

        forecast_pattern = re.compile(
            r"(?P<label>.+?)\s+(?P<date>\d{1,2}/\d{1,2})\s+"
            r"(?P<high>-?\d+(?:[.,]\d+)?)°\s+(?P<low>-?\d+(?:[.,]\d+)?)°\s+"
            r"(?P<summary>.+?)\s+(?P<precip>\d{1,3})%",
            re.IGNORECASE,
        )

        forecasts: list[dict[str, Any]] = []
        anchor = date.today()
        previous_date: date | None = None

        for match in forecast_pattern.finditer(text):
            forecast_date = self._parse_forecast_date(match.group("date"), anchor, previous_date)
            if forecast_date is None:
                continue

            previous_date = forecast_date
            summary = match.group("summary").strip()

            forecasts.append(
                {
                    "datetime": datetime.combine(forecast_date, time.min, tzinfo=timezone.utc),
                    "condition": self._normalize_condition(summary),
                    "temperature": self._number(match.group("high")),
                    "templow": self._number(match.group("low")),
                    "precipitation_probability": self._int(match.group("precip")),
                    "summary": summary,
                }
            )

        return forecasts

    async def async_fetch(self) -> AccuWeatherData:
        weather_html = await self._get_html(self.weather_url)
        air_html = await self._get_html(self.air_quality_url)
        try:
            allergy_html = await self._get_html(self.allergy_url)
        except Exception:
            allergy_html = ""

        weather = self._parse_weather(weather_html)
        air = self._parse_air_quality(air_html)
        hourly_forecast = self._parse_hourly_forecast(weather_html)
        forecast_daily = self._parse_daily_forecast(weather_html)
        allergy = self._parse_allergy(allergy_html) if allergy_html else {}

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
                "allergy_url": self.allergy_url,
                "locale": self.location["locale"],
                "country": self.location["country"],
                "location_slug": self.location["slug"],
                "source": "AccuWeather HTML",
            },
            daily_forecast=forecast_daily,
            hourly_forecast=hourly_forecast,
            allergy=allergy,
        )
