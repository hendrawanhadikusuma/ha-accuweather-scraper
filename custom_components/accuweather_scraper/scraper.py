from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
import re
from typing import Any
from urllib.parse import parse_qs, urlparse

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
        self.current_weather_url = (
            f"https://www.accuweather.com/"
            f"{self.location['locale']}/{self.location['country']}/"
            f"{self.location['slug']}/{self.location['location_key']}/"
            f"current-weather/{self.location['location_key']}"
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
    def _normalize_label(text: str) -> str:
        return re.sub(r"\s+", " ", text).strip().casefold()

    @staticmethod
    def _first_number(text: str | None) -> float | None:
        if not text:
            return None

        match = re.search(r"-?\d+(?:[.,]\d+)?", text.replace(",", "."))
        return float(match.group()) if match else None

    @staticmethod
    def _extract_label_value(values: dict[str, str], *labels: str) -> str | None:
        for label in labels:
            value = values.get(label)
            if value:
                return value
        return None

    @staticmethod
    def _forecast_payload(item: dict[str, Any]) -> dict[str, Any]:
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

    @staticmethod
    def _meta(soup: BeautifulSoup, name: str) -> str | None:
        node = soup.select_one(f'meta[name="{name}"]')
        return node.get("content") if node else None

    @staticmethod
    def _icon_from_code(code: str | int | None) -> str | None:
        number = None
        if isinstance(code, int):
            number = code
        elif isinstance(code, str):
            match = re.search(r"(\d{1,2})", code)
            if match:
                number = int(match.group(1))

        if number is None:
            return None

        if number in {1, 2, 30}:
            return "mdi:weather-sunny"
        if number in {3, 4, 5, 6, 7, 8}:
            return "mdi:weather-partly-cloudy"
        if number == 11:
            return "mdi:weather-fog"
        if number in {12, 13, 14, 18, 19, 20, 21, 24, 25, 26, 29}:
            return "mdi:weather-rainy"
        if number in {15, 16, 17, 41, 42}:
            return "mdi:weather-lightning-rainy"
        if number in {22, 23, 43, 44}:
            return "mdi:weather-snowy"
        if number == 32:
            return "mdi:weather-windy"
        if number in {33, 34}:
            return "mdi:weather-night"
        if number in {35, 36, 37, 38, 39, 40}:
            return "mdi:weather-night-partly-cloudy"

        return "mdi:help-circle"

    @staticmethod
    def _condition_from_icon_code(code: str | int | None) -> str | None:
        number = None
        if isinstance(code, int):
            number = code
        elif isinstance(code, str):
            match = re.search(r"(\d{1,2})", code)
            if match:
                number = int(match.group(1))

        if number is None:
            return None

        if number in {1, 2, 30}:
            return "sunny"
        if number in {3, 4, 5, 6, 7, 8}:
            return "partlycloudy"
        if number == 11:
            return "fog"
        if number in {12, 13, 14, 18, 19, 20, 21, 24, 25, 26, 29}:
            return "rainy"
        if number in {15, 16, 17, 41, 42}:
            return "lightning-rainy"
        if number in {22, 23, 43, 44}:
            return "snowy"
        if number == 32:
            return "windy"
        if number in {33, 34}:
            return "clear-night"
        if number in {35, 36, 37, 38, 39, 40}:
            return "partlycloudy"

        return None

    @staticmethod
    def _icon_from_condition(condition: str | None) -> str | None:
        if not condition:
            return None

        normalized = condition.casefold()
        if normalized == "sunny":
            return "mdi:weather-sunny"
        if normalized == "partlycloudy":
            return "mdi:weather-partly-cloudy"
        if normalized == "cloudy":
            return "mdi:weather-cloudy"
        if normalized == "rainy":
            return "mdi:weather-rainy"
        if normalized == "lightning-rainy":
            return "mdi:weather-lightning-rainy"
        if normalized == "snowy":
            return "mdi:weather-snowy"
        if normalized == "fog":
            return "mdi:weather-fog"
        if normalized == "windy":
            return "mdi:weather-windy"
        if normalized == "clear-night":
            return "mdi:weather-night"

        return None

    @staticmethod
    def _extract_icon_code(src: str | None) -> int | None:
        if not src:
            return None

        match = re.search(r"/([0-9]{1,2})\.svg", src)
        return int(match.group(1)) if match else None

    @staticmethod
    def _detail_map(nodes: list[Any], label_selector: str = ":scope") -> dict[str, str]:
        detail_values: dict[str, str] = {}
        for node in nodes:
            label = None
            value = None

            if label_selector == ":scope":
                parts = list(node.stripped_strings)
                if len(parts) >= 2:
                    label, value = parts[0], parts[-1]
            else:
                label = AccuWeatherScraper._text(node, [label_selector])
                value = AccuWeatherScraper._text(node, [".value", "div:last-child"])

            if label and value:
                detail_values[AccuWeatherScraper._normalize_label(label)] = value

        return detail_values

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
        page_text = " ".join(soup.stripped_strings)

        detail_values: dict[str, str] = {}
        for detail in soup.select(".cur-con-weather-card__panel .detail"):
            label = self._text(detail, [".label"])
            value = self._text(detail, [".value"])
            if label and value:
                detail_values[self._normalize_label(label)] = value

        temperature_text = self._text(soup, [
            ".current-weather-info .temp",
            ".current-weather-card .temp",
            "[class*='current-weather'] .temp",
        ])

        if not temperature_text:
            temperature_text = self._text(soup, [".cur-con-weather-card .temp"])

        realfeel_text = self._text(soup, [
            ".real-feel",
            "[class*='realfeel']",
            "[class*='real-feel']",
        ])

        if not realfeel_text:
            realfeel_match = re.search(
                r"RealFeel(?:\s*Shade)?(?:™|®)?\s*(?:Temperature)?\s*(-?\d+(?:[.,]\d+)?)°?",
                page_text,
                re.IGNORECASE,
            )
            realfeel_text = realfeel_match.group(1) if realfeel_match else None

        condition = self._text(soup, [
            ".current-weather-info .phrase",
            ".current-weather-card .phrase",
            "[class*='current-weather'] .phrase",
        ])

        if not condition:
            condition_match = re.search(
                r"Cuaca Saat Ini.*?\d{1,2}[:.]\d{2}.*?\d+°.*?RealFeel.*?\d+°\s+(?P<condition>.+?)\s+Detail Lainnya",
                page_text,
                re.IGNORECASE,
            )
            condition = condition_match.group("condition") if condition_match else None

        humidity_text = self._text(soup, [
            "[class*='humidity'] .value",
            "[class*='humidity']",
        ])

        if not humidity_text:
            humidity_text = self._extract_label_value(detail_values, "kelembapan", "humidity")

        wind_text = self._text(soup, [
            "[class*='wind'] .value",
            "[class*='wind']",
        ])

        if not wind_text:
            wind_text = self._extract_label_value(detail_values, "angin", "wind")

        uv_text = self._text(soup, [
            "[class*='uv-index'] .value",
            "[class*='uv'] .value",
        ])

        if not uv_text:
            uv_text = self._extract_label_value(detail_values, "indeks uv", "uv index")

        precip_text = self._text(soup, [
            "[class*='precipitation'] .value",
            "[class*='precip'] .value",
        ])

        cloud_text = self._text(soup, [
            "[class*='cloud-cover'] .value",
            "[class*='cloud'] .value",
        ])

        if not cloud_text:
            cloud_text = self._extract_label_value(detail_values, "tutup awan", "cloud cover")

        pressure_text = self._text(soup, [
            "[class*='pressure'] .value",
            "[class*='pressure']",
        ])

        if not pressure_text:
            pressure_text = self._extract_label_value(detail_values, "tekanan", "pressure")

        visibility_text = self._text(soup, [
            "[class*='visibility'] .value",
            "[class*='visibility']",
        ])

        if not visibility_text:
            visibility_text = self._extract_label_value(detail_values, "visibilitas", "visibility")

        dew_point_text = self._text(soup, [
            "[class*='dew-point'] .value",
            "[class*='dewpoint'] .value",
            "[class*='dew-point']",
            "[class*='dewpoint']",
        ])

        if not dew_point_text:
            dew_point_text = self._extract_label_value(detail_values, "titik embun", "dew point")

        gust_text = self._text(soup, [
            "[class*='gust'] .value",
            "[class*='gust']",
        ])

        if not gust_text:
            gust_text = self._extract_label_value(detail_values, "angin kencang", "wind gust")

        cloud_ceiling_text = self._text(soup, [
            "[class*='cloud-ceiling'] .value",
            "[class*='cloud-ceiling']",
        ])

        if not cloud_ceiling_text:
            cloud_ceiling_text = self._extract_label_value(detail_values, "cloud ceiling", "langit-langit awan")

        realfeel_shade_text = self._extract_label_value(
            detail_values,
            "realfeel shade",
            "realfeel shade™",
            "realfeel shade®",
            "realfeel shade temperature",
        )
        if not realfeel_shade_text:
            shade_match = re.search(
                r"RealFeel\s*Shade(?:™|®)?(?:\s*Temperature)?\s*(-?\d+(?:[.,]\d+)?)°?",
                page_text,
                re.IGNORECASE,
            )
            realfeel_shade_text = shade_match.group(1) if shade_match else None

        heat_index_text = self._extract_label_value(detail_values, "heat index", "heatindex")
        if not heat_index_text:
            heat_index_match = re.search(
                r"Heat\s*Index\s*(-?\d+(?:[.,]\d+)?)°?",
                page_text,
                re.IGNORECASE,
            )
            heat_index_text = heat_index_match.group(1) if heat_index_match else None
        if not heat_index_text:
            heat_index_text = realfeel_shade_text or realfeel_text or temperature_text

        return {
            "temperature": self._number(temperature_text),
            "realfeel_temperature": self._number(realfeel_text),
            "realfeel_shade_temperature": self._number(realfeel_shade_text),
            "heat_index": self._number(heat_index_text),
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

    def _parse_current_weather(self, html: str) -> dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")
        page_text = " ".join(soup.stripped_strings)

        detail_values = self._detail_map(list(soup.select(".current-weather-details .detail-item")))
        mobile_values = self._detail_map(list(soup.select(".panels .panel-item")))
        detail_values.update(mobile_values)

        icon_node = soup.select_one(".current-weather-info img.icon, .current-weather-info img.weather-icon, img.header-weather-icon")
        icon_code = self._extract_icon_code(icon_node.get("src") if icon_node else None)

        temperature_text = self._text(soup, [
            ".current-weather-info .display-temp",
            ".current-weather-info .temp",
            ".display-temp",
            ".temp .display-temp",
        ])

        if not temperature_text:
            temperature_text = self._text(soup, [".temp"])

        realfeel_text = self._extract_label_value(detail_values, "realfeel®", "realfeel", "realfeel temperature")
        if not realfeel_text:
            realfeel_match = re.search(r"RealFeel®?\s*(-?\d+(?:[.,]\d+)?)°?", page_text, re.IGNORECASE)
            realfeel_text = realfeel_match.group(1) if realfeel_match else None

        realfeel_shade_text = self._extract_label_value(
            detail_values,
            "realfeel shade",
            "realfeel shade™",
            "realfeel shade®",
            "realfeel shade temperature",
        )
        if not realfeel_shade_text:
            shade_match = re.search(
                r"RealFeel\s*Shade(?:™|®)?(?:\s*Temperature)?\s*(-?\d+(?:[.,]\d+)?)°?",
                page_text,
                re.IGNORECASE,
            )
            realfeel_shade_text = shade_match.group(1) if shade_match else None

        heat_index_text = self._extract_label_value(detail_values, "heat index", "heatindex")
        if not heat_index_text:
            heat_index_match = re.search(
                r"Heat\s*Index\s*(-?\d+(?:[.,]\d+)?)°?",
                page_text,
                re.IGNORECASE,
            )
            heat_index_text = heat_index_match.group(1) if heat_index_match else None
        if not heat_index_text:
            heat_index_text = realfeel_text or temperature_text

        condition = self._text(soup, [".phrase", ".current-weather-info .phrase"])

        def fallback_value(patterns: list[str]) -> str | None:
            for pattern in patterns:
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    return match.group(1)
            return None

        result: dict[str, Any] = {
            "temperature": self._number(temperature_text),
            "realfeel_temperature": self._number(realfeel_text),
            "realfeel_shade_temperature": self._number(realfeel_shade_text),
            "heat_index": self._number(heat_index_text),
            "humidity": self._number(self._extract_label_value(detail_values, "kelembapan")),
            "wind_speed": self._number(self._extract_label_value(detail_values, "angin")),
            "gust_speed": self._number(self._extract_label_value(detail_values, "angin kencang")),
            "uv_index": self._int(self._extract_label_value(detail_values, "indeks uv")),
            "precipitation_probability": self._number(self._extract_label_value(detail_values, "probabilitas presipitasi")),
            "cloud_cover": self._number(self._extract_label_value(detail_values, "tutupan awan")),
            "pressure": self._number(self._extract_label_value(detail_values, "tekanan")),
            "visibility": self._number(self._extract_label_value(detail_values, "jarak pandang")),
            "dew_point": self._number(self._extract_label_value(detail_values, "titik embun")),
            "cloud_ceiling": self._number(self._extract_label_value(detail_values, "ketinggian awan")),
            "condition": condition,
            "icon_code": icon_code,
            "icon": self._icon_from_code(icon_code) or self._normalize_condition(condition) or "mdi:help-circle",
        }

        if result["humidity"] is None:
            result["humidity"] = self._number(fallback_value([r"Kelembapan\s+(\d+)%", r"Humidity\s+(\d+)%"]))
        if result["wind_speed"] is None:
            result["wind_speed"] = self._number(fallback_value([r"Angin\s+[A-Z]{1,3}\s*(\d+(?:[.,]\d+)?)\s*km/j", r"Wind\s+[A-Z]{1,3}\s*(\d+(?:[.,]\d+)?)\s*km/h"]))
        if result["gust_speed"] is None:
            result["gust_speed"] = self._number(fallback_value([r"Angin Kencang\s*(\d+(?:[.,]\d+)?)\s*km/j", r"Wind Gusts\s*(\d+(?:[.,]\d+)?)\s*km/h"]))
        if result["precipitation_probability"] is None:
            result["precipitation_probability"] = self._number(fallback_value([r"Probabilitas Presipitasi\s*(\d+)%", r"Precipitation Probability\s*(\d+)%"]))
        if result["cloud_cover"] is None:
            result["cloud_cover"] = self._number(fallback_value([r"Tutupan Awan\s*(\d+)%", r"Cloud Cover\s*(\d+)%"]))
        if result["pressure"] is None:
            result["pressure"] = self._number(fallback_value([r"Tekanan\s*[↔↑↓]?\s*(\d+(?:[.,]\d+)?)\s*mb", r"Pressure\s*[↔↑↓]?\s*(\d+(?:[.,]\d+)?)\s*hPa"]))
        if result["visibility"] is None:
            result["visibility"] = self._number(fallback_value([r"Jarak Pandang\s*(\d+(?:[.,]\d+)?)\s*km", r"Visibility\s*(\d+(?:[.,]\d+)?)\s*km"]))
        if result["dew_point"] is None:
            result["dew_point"] = self._number(fallback_value([r"Titik Embun\s*(\d+(?:[.,]\d+)?)\s*°\s*C?", r"Dew Point\s*(\d+(?:[.,]\d+)?)\s*°"]))
        if result["cloud_ceiling"] is None:
            result["cloud_ceiling"] = self._number(fallback_value([r"Ketinggian Awan\s*(\d+(?:[.,]\d+)?)\s*m", r"Cloud Ceiling\s*(\d+(?:[.,]\d+)?)\s*ft"]))
        if result["uv_index"] is None:
            result["uv_index"] = self._int(fallback_value([r"Indeks UV\s*(\d+)", r'"cuuv":"(?P<value>\d+)"']))

        ad_info_match = re.search(r"adInfo:\s*\{(?P<body>[^}]+)\}", html)
        if ad_info_match:
            body = ad_info_match.group("body")
            if result["uv_index"] is None:
                uv_match = re.search(r'"cuuv":"(?P<value>\d+)"', body)
                if uv_match:
                    result["uv_index"] = self._int(uv_match.group("value"))

        return result

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

        current_value = self._text(soup, [
            ".air-quality-content .aq-number",
            ".air-quality-module .aq-number",
            ".aq-number",
        ])
        result["air_quality_index"] = self._int(current_value)

        pollutant_map = {
            "airQualityPollutantPM2_5": "pm25",
            "airQualityPollutantPM10": "pm10",
            "airQualityPollutantNO2": "no2",
            "airQualityPollutantSO2": "so2",
            "airQualityPollutantCO": "co",
            "airQualityPollutantO3": "o3",
        }

        for pollutant in soup.select(".air-quality-current-pollutants .air-quality-pollutant"):
            data_qa = pollutant.get("data-qa", "")
            for token, key in pollutant_map.items():
                if token in data_qa:
                    value = self._text(pollutant, [".pollutant-index"])
                    if value is None:
                        value = self._text(pollutant, [".pollutant-concentration"])
                    result[key] = self._int(value)
                    break

        if result["air_quality_index"] is None:
            patterns = [
                r"AQI\s*[:\-]?\s*(\d+)",
                r"Indeks Kualitas Udara\s*[:\-]?\s*(\d+)",
            ]
            for expression in patterns:
                match = re.search(expression, text, re.IGNORECASE)
                if match:
                    result["air_quality_index"] = self._int(match.group(1))
                    break

        if any(value is None for key, value in result.items() if key != "air_quality_index"):
            fallback_patterns = {
                "pm25": [r"PM2\.?5\s*(\d+(?:[.,]\d+)?)"],
                "pm10": [r"PM10\s*(\d+(?:[.,]\d+)?)"],
                "no2": [r"NO2\s*(\d+(?:[.,]\d+)?)"],
                "so2": [r"SO2\s*(\d+(?:[.,]\d+)?)"],
                "co": [r"CO\s*(\d+(?:[.,]\d+)?)"],
                "o3": [r"O3\s*(\d+(?:[.,]\d+)?)"],
            }
            for key, expressions in fallback_patterns.items():
                if result[key] is not None:
                    continue
                for expression in expressions:
                    match = re.search(expression, text, re.IGNORECASE)
                    if match:
                        result[key] = self._int(match.group(1))
                        break

        return result

    def _parse_allergy(self, html: str) -> dict[str, Any]:
        soup = BeautifulSoup(html, "html.parser")
        text = " ".join(soup.stripped_strings)

        allergen = None
        risk = None
        safety_tips = None

        slug_match = re.search(r'\{[^{}]*"slug":"dust-dander"[^{}]*\}', html)
        if slug_match:
            block = slug_match.group(0)
            allergen_match = re.search(r'"localizedName":"(?P<value>.*?)"', block)
            risk_match = re.search(r'"category":"(?P<value>.*?)"', block)
            safety_match = re.search(r'"categoryPhrase":"(?P<value>.*?)"', block)
            if allergen_match:
                allergen = allergen_match.group("value").replace("\\u0026", "&")
            if risk_match:
                risk = risk_match.group("value")
            if safety_match:
                safety_tips = safety_match.group("value")

        if not allergen:
            allergen = self._text(soup, ["h1", "h2", "[class*='title']"])

        if allergen:
            allergen = allergen.replace("Allergen Forecast", "").strip()

        if not risk:
            scale_match = re.search(
                r"(?:risk of|risiko)\s+.+?\s+is\s+(extremely high|very high|high|moderate|low|sangat tinggi|tinggi|sedang|rendah)",
                text,
                re.IGNORECASE,
            )
            if scale_match:
                risk = scale_match.group(1).title()

        if not safety_tips:
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
            "risk": risk,
            "safety_tips": safety_tips,
            "average_wind": wind_text,
            "max_wind_gusts": gust_text,
            "realfeel_high": realfeel_text,
        }

    def _parse_hourly_forecast(self, html: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(html, "html.parser")
        forecasts: list[dict[str, Any]] = []
        previous_dt: datetime | None = None

        for item in soup.select(".hourly-list__list__item"):
            time_label = self._text(item, [".hourly-list__list__item-time"])
            temperature_text = self._text(item, [".hourly-list__list__item-temp"])
            precip_text = self._text(item, [".hourly-list__list__item-precip span"])
            icon_node = item.select_one("img.hourly-list__list__item-icon, img")
            icon_code = self._extract_icon_code(icon_node.get("src") if icon_node else None)
            condition = self._condition_from_icon_code(icon_code)
            precipitation_probability = self._int(precip_text) if precip_text else None

            if condition is None and precipitation_probability is not None and precipitation_probability >= 60:
                condition = "rainy"

            summary = condition.replace("-", " ") if condition else None
            href = item.get("href", "")

            forecast_dt: datetime | None = None
            query = parse_qs(urlparse(href).query)
            hour_value = query.get("hour", [None])[0]
            if hour_value and hour_value.isdigit():
                forecast_dt = datetime.fromtimestamp(int(hour_value), tz=timezone.utc)
            elif time_label:
                anchor = datetime.now().astimezone().replace(minute=0, second=0, microsecond=0)
                forecast_dt = self._parse_forecast_datetime(time_label, anchor, previous_dt)

            if forecast_dt is None:
                continue

            previous_dt = forecast_dt
            forecasts.append(
                {
                    "datetime": forecast_dt,
                    "time_label": time_label,
                    "temperature": self._number(temperature_text),
                    "precipitation_probability": precipitation_probability,
                    "summary": summary,
                    "condition": condition,
                    "icon_code": icon_code,
                    "icon": self._icon_from_code(icon_code) or self._icon_from_condition(condition),
                }
            )

        return forecasts

    def _parse_daily_forecast(self, html: str) -> list[dict[str, Any]]:
        soup = BeautifulSoup(html, "html.parser")
        forecasts: list[dict[str, Any]] = []
        for item in soup.select(".daily-list-item"):
            day_label = self._text(item, [".date .day"])
            date_text = self._text(item, [".date p:last-child", ".date"])
            label = " ".join(part for part in [day_label, date_text] if part)
            high_text = self._text(item, [".temp-hi", ".hi", ".temp .temp-hi"])
            low_text = self._text(item, [".temp-lo", ".lo", ".temp .temp-lo"])
            summary = self._text(item, [".phrase", ".condition"])
            precip_text = self._text(item, [".precip", ".precipitation-probability"])
            icon_node = item.select_one("img.icon, img.day-icon, img.night-icon")
            icon_code = self._extract_icon_code(icon_node.get("src") if icon_node else None)

            if not label:
                continue

            date_match = re.search(r"(\d{1,2}/\d{1,2})", date_text or label)
            if date_match:
                forecast_date = self._parse_forecast_date(date_match.group(1), date.today(), forecasts[-1]["datetime"].date() if forecasts else None)
            else:
                forecast_date = None

            if forecast_date is None:
                continue

            if not summary:
                summary = self._text(item, [".phrase"])

            forecasts.append(
                {
                    "datetime": datetime.combine(forecast_date, time.min, tzinfo=timezone.utc),
                    "condition": self._normalize_condition(summary),
                    "temperature": self._number(high_text),
                    "templow": self._number(low_text),
                    "precipitation_probability": self._int(precip_text),
                    "summary": summary,
                    "date_label": label,
                    "icon_code": icon_code,
                    "icon": self._icon_from_code(icon_code),
                }
            )

        return forecasts

    async def async_fetch(self) -> AccuWeatherData:
        weather_html = await self._get_html(self.weather_url)
        current_html = await self._get_html(self.current_weather_url)
        air_html = await self._get_html(self.air_quality_url)
        try:
            allergy_html = await self._get_html(self.allergy_url)
        except Exception:
            allergy_html = ""

        weather = self._parse_weather(weather_html)
        current_weather = self._parse_current_weather(current_html)
        air = self._parse_air_quality(air_html)
        hourly_forecast = self._parse_hourly_forecast(weather_html)
        forecast_daily = self._parse_daily_forecast(weather_html)
        allergy = self._parse_allergy(allergy_html) if allergy_html else {}

        allergy.setdefault("average_wind", current_weather.get("wind_speed"))
        allergy.setdefault("max_wind_gusts", current_weather.get("gust_speed"))
        allergy.setdefault("realfeel_high", current_weather.get("realfeel_temperature"))

        raw_condition = weather.get("condition") or current_weather.get("condition")

        values = {
            **{k: v for k, v in weather.items() if k != "condition" and k != "page_title"},
            **{k: v for k, v in current_weather.items() if k != "condition"},
            **air,
        }

        location = self.location["slug"].replace("-", " ").title()

        return AccuWeatherData(
            location=location,
            location_key=self.location["location_key"],
            condition=raw_condition,
            values=values,
            attributes={
                "weather_url": self.weather_url,
                "current_weather_url": self.current_weather_url,
                "air_quality_url": self.air_quality_url,
                "allergy_url": self.allergy_url,
                "locale": self.location["locale"],
                "country": self.location["country"],
                "location_slug": self.location["slug"],
                "source": "AccuWeather HTML",
                "icon": current_weather.get("icon"),
                "icon_code": current_weather.get("icon_code"),
                "condition_raw": raw_condition,
            },
            daily_forecast=forecast_daily,
            hourly_forecast=hourly_forecast,
            allergy=allergy,
        )
