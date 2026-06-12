// Weather data layer — uses the free Open-Meteo API (no API key required).
// Geocoding, current weather + 5-day forecast, and historical date-range temps.

const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";

export type Geo = {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

// WMO weather interpretation codes → label + emoji icon.
const WMO: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mainly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Dense drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌦️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌧️" },
  67: { label: "Freezing rain", icon: "🌧️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "❄️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "🌨️" },
  80: { label: "Rain showers", icon: "🌦️" },
  81: { label: "Rain showers", icon: "🌧️" },
  82: { label: "Violent showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Snow showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm + hail", icon: "⛈️" },
  99: { label: "Thunderstorm + hail", icon: "⛈️" },
};

export function describe(code: number) {
  return WMO[code] ?? { label: "Unknown", icon: "❓" };
}

/** Resolve a user's free-text location into coordinates.
 *  Accepts "lat,lon" coordinates directly, otherwise geocodes the name/zip. */
export async function resolveLocation(input: string): Promise<Geo> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Please enter a location.");

  // Direct GPS coordinates, e.g. "40.71, -74.00"
  const coord = trimmed.match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (coord) {
    const lat = parseFloat(coord[1]);
    const lon = parseFloat(coord[2]);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
      throw new Error("Coordinates out of range.");
    return { name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`, country: "", latitude: lat, longitude: lon };
  }

  const url = `${GEO}?name=${encodeURIComponent(trimmed)}&count=1&language=en&format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Geocoding service failed. Try again.");
  const data = await res.json();
  if (!data.results || data.results.length === 0)
    throw new Error(`Location "${trimmed}" not found. Check the spelling or try a city, zip code, or "lat,lon".`);
  const r = data.results[0];
  return {
    name: r.name,
    country: r.country ?? "",
    admin1: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  };
}

export async function reverseName(lat: number, lon: number): Promise<string> {
  try {
    const url = `${GEO}?latitude=${lat}&longitude=${lon}&count=1`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (data.results?.[0]) return `${data.results[0].name}, ${data.results[0].country ?? ""}`;
  } catch {}
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
}

/** Current conditions + 5-day forecast for given coordinates. */
export async function getWeather(lat: number, lon: number) {
  const url =
    `${FORECAST}?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
    `&forecast_days=5&timezone=auto`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Weather service unavailable. Please try again.");
  const d = await res.json();
  const cur = d.current;
  return {
    current: {
      temp: cur.temperature_2m,
      feelsLike: cur.apparent_temperature,
      humidity: cur.relative_humidity_2m,
      wind: cur.wind_speed_10m,
      precipitation: cur.precipitation,
      isDay: cur.is_day === 1,
      ...describe(cur.weather_code),
    },
    forecast: d.daily.time.map((date: string, i: number) => ({
      date,
      max: d.daily.temperature_2m_max[i],
      min: d.daily.temperature_2m_min[i],
      rainChance: d.daily.precipitation_probability_max[i],
      sunrise: d.daily.sunrise[i],
      sunset: d.daily.sunset[i],
      ...describe(d.daily.weather_code[i]),
    })),
    units: { temp: "°C", wind: "km/h" },
  };
}

/** Historical daily temps for a date range (used by the CRUD "create" feature). */
export async function getRangeTemps(lat: number, lon: number, start: string, end: string) {
  const url =
    `${ARCHIVE}?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}` +
    `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean&timezone=auto`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Historical weather service unavailable.");
  const d = await res.json();
  if (!d.daily?.time) return [];
  return d.daily.time.map((date: string, i: number) => ({
    date,
    max: d.daily.temperature_2m_max[i],
    min: d.daily.temperature_2m_min[i],
    mean: d.daily.temperature_2m_mean[i],
  }));
}
