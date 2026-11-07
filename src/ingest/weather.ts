import { sql } from '@/lib/db';

// Open-Meteo: free, no API key. 16-day daily forecast per region.
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max';

interface Daily {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  snowfall_sum: number[];
  wind_speed_10m_max: number[];
}

async function regions() {
  return (await sql()`select id, lat, lon from regions`) as { id: string; lat: string; lon: string }[];
}

export async function fetchWeatherForecast() {
  const db = sql();
  let items = 0;
  for (const r of await regions()) {
    const url = `${FORECAST}?latitude=${r.lat}&longitude=${r.lon}&daily=${DAILY}&timezone=Europe%2FLondon&forecast_days=16`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status} for ${r.id}`);
    const d = ((await res.json()) as { daily: Daily }).daily;
    for (let i = 0; i < d.time.length; i++) {
      if (d.temperature_2m_max[i] == null) continue; // the last forecast day is sometimes empty
      await db`
        insert into weather_daily (region_id, date, t_min, t_max, precip_mm, snow_cm, wind_max_kph, is_forecast, fetched_at)
        values (${r.id}, ${d.time[i]}, ${d.temperature_2m_min[i]}, ${d.temperature_2m_max[i]}, ${d.precipitation_sum[i]},
                ${d.snowfall_sum[i]}, ${d.wind_speed_10m_max[i]}, true, now())
        on conflict (region_id, date) do update set
          t_min = excluded.t_min, t_max = excluded.t_max, precip_mm = excluded.precip_mm,
          snow_cm = excluded.snow_cm, wind_max_kph = excluded.wind_max_kph, fetched_at = now()
        where weather_daily.is_forecast`;
      items++;
    }
  }
  return { items };
}

/**
 * Monthly normals from ten years of history: average temperature, rain,
 * rainy days and heating degree days (how much heating a month needs).
 */
export async function buildWeatherNormals(fromYear = 2016, toYear = 2025) {
  const db = sql();
  let items = 0;
  for (const r of await regions()) {
    const url = `${ARCHIVE}?latitude=${r.lat}&longitude=${r.lon}&start_date=${fromYear}-01-01&end_date=${toYear}-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=Europe%2FLondon`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo archive ${res.status} for ${r.id}`);
    const d = ((await res.json()) as { daily: { time: string[]; temperature_2m_mean: number[]; precipitation_sum: number[] } }).daily;
    const years = toYear - fromYear + 1;
    const acc = Array.from({ length: 12 }, () => ({ t: 0, n: 0, rain: 0, rainDays: 0, hdd: 0 }));
    d.time.forEach((date, i) => {
      const t = d.temperature_2m_mean[i];
      const p = d.precipitation_sum[i];
      if (t == null || p == null) return;
      const a = acc[Number(date.slice(5, 7)) - 1];
      a.t += t;
      a.n++;
      a.rain += p;
      if (p >= 1) a.rainDays++;
      a.hdd += Math.max(0, 15.5 - t);
    });
    for (let m = 0; m < 12; m++) {
      const a = acc[m];
      await db`
        insert into weather_normals (region_id, month, t_mean, precip_mm, heating_degree_days, rain_days)
        values (${r.id}, ${m + 1}, ${a.t / a.n}, ${a.rain / years}, ${a.hdd / years}, ${a.rainDays / years})
        on conflict (region_id, month) do update set t_mean = excluded.t_mean, precip_mm = excluded.precip_mm,
          heating_degree_days = excluded.heating_degree_days, rain_days = excluded.rain_days`;
      items++;
    }
  }
  return { items };
}
