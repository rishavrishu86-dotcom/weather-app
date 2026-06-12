"use client";

import { useEffect, useState, useCallback } from "react";

type Current = { temp: number; feelsLike: number; humidity: number; wind: number; precipitation: number; isDay: boolean; label: string; icon: string };
type Day = { date: string; max: number; min: number; rainChance: number; icon: string; label: string };
type Place = { name: string; country: string; latitude: number; longitude: number };
type Weather = { place: Place; current: Current; forecast: Day[]; units: { temp: string; wind: string } };
type Rec = { id: number; location: string; resolved_name: string; latitude: number; longitude: number; start_date: string; end_date: string; temps_json: string; notes: string; created_at: string };

const dayName = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export default function Home() {
  const [query, setQuery] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchWeather = useCallback(async (qs: string) => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/weather?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch weather.");
      setWeather(data);
    } catch (e) {
      setWeather(null);
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) { setError("Please enter a location (city, zip, landmark, or lat,lon)."); return; }
    fetchWeather(`location=${encodeURIComponent(query.trim())}`);
  };

  const useMyLocation = () => {
    setError("");
    if (!navigator.geolocation) { setError("Geolocation is not supported by your browser."); return; }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(`lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`),
      (err) => { setLoading(false); setError(`Location access denied: ${err.message}. Try typing a location instead.`); }
    );
  };

  const [records, setRecords] = useState<Rec[]>([]);
  const [form, setForm] = useState({ location: "", start_date: "", end_date: "", notes: "" });
  const [crudMsg, setCrudMsg] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editVals, setEditVals] = useState({ start_date: "", end_date: "", notes: "" });

  const loadRecords = useCallback(async () => {
    const res = await fetch("/api/records");
    const data = await res.json();
    setRecords(data.records || []);
  }, []);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const createRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setCrudMsg("Saving…");
    const res = await fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setCrudMsg("❌ " + data.error); return; }
    setCrudMsg("✅ Saved record #" + data.record.id);
    setForm({ location: "", start_date: "", end_date: "", notes: "" });
    loadRecords();
  };

  const saveEdit = async (id: number) => {
    const res = await fetch(`/api/records/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editVals) });
    const data = await res.json();
    if (!res.ok) { setCrudMsg("❌ " + data.error); return; }
    setEditId(null); setCrudMsg("✅ Updated #" + id); loadRecords();
  };

  const deleteRecord = async (id: number) => {
    if (!confirm(`Delete record #${id}?`)) return;
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    setCrudMsg("🗑️ Deleted #" + id); loadRecords();
  };

  const mapBbox = weather
    ? `${weather.place.longitude - 0.2},${weather.place.latitude - 0.15},${weather.place.longitude + 0.2},${weather.place.latitude + 0.15}`
    : "";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-5 py-10">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">🌦️ Weather Explorer</h1>
          <p className="mt-1 text-slate-400">Real-time weather, 5-day forecast, and a saved-query database — by <strong>Rishav Jamwal</strong>.</p>
        </header>

        <form onSubmit={onSearch} className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, zip code, landmark, or 'lat,lon' (e.g. 40.71,-74.00)"
            className="flex-1 min-w-[240px] rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 outline-none focus:border-sky-500"
          />
          <button type="submit" className="rounded-lg bg-sky-600 px-5 py-2.5 font-medium hover:bg-sky-500">Search</button>
          <button type="button" onClick={useMyLocation} className="rounded-lg border border-slate-700 px-4 py-2.5 hover:bg-slate-800">📍 My location</button>
        </form>

        {loading && <p className="mt-4 text-slate-400">Loading…</p>}
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-300" role="alert">
            ⚠️ {error}
          </div>
        )}

        {weather && (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{weather.place.name}{weather.place.country ? `, ${weather.place.country}` : ""}</h2>
                <p className="text-slate-400">{weather.current.label} · {weather.current.isDay ? "Day" : "Night"}</p>
              </div>
              <div className="text-6xl leading-none">{weather.current.icon}</div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Temperature" value={`${Math.round(weather.current.temp)}${weather.units.temp}`} />
              <Stat label="Feels like" value={`${Math.round(weather.current.feelsLike)}${weather.units.temp}`} />
              <Stat label="Humidity" value={`${weather.current.humidity}%`} />
              <Stat label="Wind" value={`${weather.current.wind} ${weather.units.wind}`} />
            </div>

            <h3 className="mt-7 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">5-Day Forecast</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {weather.forecast.map((d) => (
                <div key={d.date} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-center">
                  <p className="text-xs text-slate-400">{dayName(d.date)}</p>
                  <div className="my-1 text-3xl">{d.icon}</div>
                  <p className="text-sm font-medium">{Math.round(d.max)}° / {Math.round(d.min)}°</p>
                  <p className="text-xs text-sky-400">💧 {d.rainChance ?? 0}%</p>
                </div>
              ))}
            </div>

            <h3 className="mt-7 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Explore the location</h3>
            <iframe
              title="map"
              className="h-64 w-full rounded-xl border border-slate-800"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapBbox}&layer=mapnik&marker=${weather.place.latitude},${weather.place.longitude}`}
            />
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <a className="text-sky-400 hover:underline" target="_blank" rel="noreferrer" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(weather.place.name + " travel guide")}`}>▶️ YouTube videos of {weather.place.name}</a>
              <a className="text-sky-400 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${weather.place.latitude},${weather.place.longitude}`}>🗺️ Open in Google Maps</a>
            </div>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">📁 Saved weather queries (CRUD)</h2>
          <p className="mt-1 text-sm text-slate-400">Store a location + date range — temperatures are fetched from a historical weather source and saved to a SQLite database.</p>

          <form onSubmit={createRecord} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location (city / zip / lat,lon)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-sky-500" />
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-sky-500" />
            <label className="text-sm text-slate-400">Start date<input required type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-sky-500" /></label>
            <label className="text-sm text-slate-400">End date<input required type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-sky-500" /></label>
            <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500 sm:col-span-2">Create record</button>
          </form>
          {crudMsg && <p className="mt-3 text-sm">{crudMsg}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-400">Export all:</span>
            {["json", "csv", "xml", "md"].map((f) => (
              <a key={f} href={`/api/export?format=${f}`} className="rounded-md border border-slate-700 px-3 py-1 uppercase hover:bg-slate-800">{f}</a>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="py-2 pr-3">#</th><th className="pr-3">Location</th><th className="pr-3">Range</th><th className="pr-3">Avg temp</th><th className="pr-3">Notes</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && <tr><td colSpan={6} className="py-4 text-slate-500">No saved records yet.</td></tr>}
                {records.map((r) => {
                  const temps = (() => { try { return JSON.parse(r.temps_json) as { mean: number }[]; } catch { return []; } })();
                  const avg = temps.length ? (temps.reduce((s, t) => s + (t.mean ?? 0), 0) / temps.length).toFixed(1) : "—";
                  const editing = editId === r.id;
                  return (
                    <tr key={r.id} className="border-b border-slate-800/60 align-top">
                      <td className="py-2 pr-3">{r.id}</td>
                      <td className="pr-3">{r.resolved_name || r.location}</td>
                      <td className="pr-3">
                        {editing ? (
                          <div className="flex flex-col gap-1">
                            <input type="date" defaultValue={r.start_date} onChange={(e) => setEditVals((v) => ({ ...v, start_date: e.target.value }))} className="rounded border border-slate-700 bg-slate-950 px-1" />
                            <input type="date" defaultValue={r.end_date} onChange={(e) => setEditVals((v) => ({ ...v, end_date: e.target.value }))} className="rounded border border-slate-700 bg-slate-950 px-1" />
                          </div>
                        ) : `${r.start_date} → ${r.end_date}`}
                      </td>
                      <td className="pr-3">{avg}°C</td>
                      <td className="pr-3">
                        {editing ? <input defaultValue={r.notes} onChange={(e) => setEditVals((v) => ({ ...v, notes: e.target.value }))} className="rounded border border-slate-700 bg-slate-950 px-1" /> : (r.notes || "—")}
                      </td>
                      <td className="whitespace-nowrap">
                        {editing ? (
                          <>
                            <button onClick={() => saveEdit(r.id)} className="text-emerald-400 hover:underline">save</button>{" · "}
                            <button onClick={() => setEditId(null)} className="text-slate-400 hover:underline">cancel</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditId(r.id); setEditVals({ start_date: r.start_date, end_date: r.end_date, notes: r.notes }); }} className="text-sky-400 hover:underline">edit</button>{" · "}
                            <button onClick={() => deleteRecord(r.id)} className="text-red-400 hover:underline">delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">ℹ️ About</h2>
          <p className="mt-2 text-slate-300"><strong>Built by Rishav Jamwal</strong> — Full-Stack Developer (React · Next.js · Node · Python). Technical assessment submission.</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            <strong>PM Accelerator (Product Manager Accelerator)</strong> is a career-acceleration program and community that helps aspiring and current product managers and tech professionals break into and grow within top tech companies — through hands-on training, real-world projects, mentorship from industry leaders, and a supportive talent network. Learn more on their{" "}
            <a className="text-sky-400 hover:underline" target="_blank" rel="noreferrer" href="https://www.linkedin.com/school/pmaccelerator/">LinkedIn page</a>.
          </p>
        </section>

        <footer className="mt-8 text-center text-xs text-slate-600">Weather data: Open-Meteo (free, no API key) · Map: OpenStreetMap</footer>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
