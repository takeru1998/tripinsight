export type WeatherKind =
  | 'sunny'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm';

export type WeatherPeriod = {
  key: 'morning' | 'noon' | 'night';
  label: '朝' | '昼' | '晩';
  time: string;
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
  description: string;
  kind: WeatherKind;
};

export type TripWeather = {
  locationName: string;
  date: string;
  periods: WeatherPeriod[];
};

type GeocodingResponse = {
  results?: Array<{
    name: string;
    admin1?: string;
    latitude: number;
    longitude: number;
  }>;
};

type ForecastResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
};

export function weatherCodeDetails(code: number): {
  description: string;
  kind: WeatherKind;
} {
  if (code === 0) return { description: '快晴', kind: 'sunny' };
  if (code <= 3) return { description: code === 1 ? '晴れ' : '曇り', kind: 'cloudy' };
  if (code === 45 || code === 48) return { description: '霧', kind: 'fog' };
  if (code >= 51 && code <= 67) return { description: '雨', kind: 'rain' };
  if (code >= 71 && code <= 77) return { description: '雪', kind: 'snow' };
  if (code >= 80 && code <= 82) return { description: 'にわか雨', kind: 'rain' };
  if (code >= 85 && code <= 86) return { description: 'にわか雪', kind: 'snow' };
  if (code >= 95) return { description: '雷雨', kind: 'storm' };
  return { description: '曇り', kind: 'cloudy' };
}

function weatherSearchQuery(value: string) {
  return value.trim().replace(/[　\s]*旅行$/, '').trim();
}

export async function fetchTripWeather(
  location: string,
  date: string,
  signal?: AbortSignal,
): Promise<TripWeather> {
  const query = weatherSearchQuery(location);
  if (!query) throw new Error('天気を取得する場所が未設定です');

  const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geocodingUrl.searchParams.set('name', query);
  geocodingUrl.searchParams.set('count', '1');
  geocodingUrl.searchParams.set('language', 'ja');
  geocodingUrl.searchParams.set('format', 'json');

  const geocodingResponse = await fetch(geocodingUrl, { signal });
  if (!geocodingResponse.ok) throw new Error('場所を検索できませんでした');
  const geocoding = (await geocodingResponse.json()) as GeocodingResponse;
  const place = geocoding.results?.[0];
  if (!place) throw new Error(`「${query}」の場所を確認できませんでした`);

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.searchParams.set('latitude', String(place.latitude));
  forecastUrl.searchParams.set('longitude', String(place.longitude));
  forecastUrl.searchParams.set(
    'hourly',
    'temperature_2m,precipitation_probability,weather_code',
  );
  forecastUrl.searchParams.set('forecast_days', '16');
  forecastUrl.searchParams.set('timezone', 'auto');

  const forecastResponse = await fetch(forecastUrl, { signal });
  if (!forecastResponse.ok) throw new Error('天気予報を取得できませんでした');
  const forecast = (await forecastResponse.json()) as ForecastResponse;
  const hourly = forecast.hourly;
  if (
    !hourly?.time ||
    !hourly.temperature_2m ||
    !hourly.precipitation_probability ||
    !hourly.weather_code
  ) {
    throw new Error('天気予報の形式を確認できませんでした');
  }

  const periodDefinitions = [
    { key: 'morning', label: '朝', hour: '08:00' },
    { key: 'noon', label: '昼', hour: '13:00' },
    { key: 'night', label: '晩', hour: '19:00' },
  ] as const;

  const periods = periodDefinitions.map(({ key, label, hour }) => {
    const index = hourly.time!.indexOf(`${date}T${hour}`);
    if (index < 0) throw new Error('旅行日はまだ天気予報の対象期間外です');
    const weatherCode = hourly.weather_code![index];
    return {
      key,
      label,
      time: hour,
      temperature: Math.round(hourly.temperature_2m![index]),
      precipitationProbability: Math.round(hourly.precipitation_probability![index]),
      weatherCode,
      ...weatherCodeDetails(weatherCode),
    };
  });

  return {
    locationName: [place.name, place.admin1].filter(Boolean).join(' / '),
    date,
    periods,
  };
}
