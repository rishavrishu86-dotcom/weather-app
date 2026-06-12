# 🌦️ Weather Explorer — Technical Assessment

**By Rishav Jamwal** · Full-Stack submission (Tech Assessment **#1 frontend** + **#2 backend**) for the **PM Accelerator** AI Engineer Intern assessment.

A full-stack weather app: enter any location (city, zip/postal code, landmark, or GPS coordinates) or use your current location to get **real-time weather + a 5-day forecast**, plus a **SQLite-backed CRUD** system for saving location/date-range weather queries, **data export** (JSON/CSV/XML/Markdown), and **extra API integrations** (interactive map, YouTube, Google Maps).

> Weather data comes from the free **[Open-Meteo](https://open-meteo.com/)** API — **no API key required**, so it runs out of the box.

---

## ✅ What it does (mapped to the assessment)

### Tech Assessment #1 — Frontend
- **Location input** — accepts city, zip/postal code, landmark, town, or `lat,lon` GPS coordinates.
- **Current location** — "📍 My location" uses the browser Geolocation API.
- **Clear weather display** — temperature, feels-like, humidity, wind, condition, day/night, with **emoji weather icons**.
- **5-day forecast** — responsive grid with high/low and rain probability per day.
- **Error handling** — graceful messages for *city not found* (404), *API failure* (502), empty input, and denied geolocation.
- **Responsive** — Tailwind CSS, web-first, adapts from desktop → tablet → mobile (CSS grid + flex with breakpoints).

### Tech Assessment #2 — Backend (Next.js API routes + SQLite)
- **CRUD** on saved weather queries (`records` table):
  - **CREATE** — location + **date range**; validates the date range *and* that the location really exists (geocoding), then stores historical daily temperatures.
  - **READ** — list all saved records (and per-record GET).
  - **UPDATE** — change the date range (re-fetches temps) and/or notes, re-validated.
  - **DELETE** — remove a record.
- **RESTful API** — clean JSON endpoints with proper status codes (200/201/400/404/502).
- **Data export** — `/api/export?format=json|csv|xml|md`.
- **Extra API integration (2.2)** — OpenStreetMap interactive map of the location, plus YouTube and Google Maps links.

---

## 🧱 Tech stack
- **Next.js 16** (App Router) — React frontend **and** Node.js API routes in one app *(satisfies "JS framework for frontend; no Python/Java frontend")*.
- **TypeScript**, **Tailwind CSS**
- **better-sqlite3** — local SQLite persistence
- **Open-Meteo** — geocoding, forecast & historical weather (no key)

---

## ▶️ How to run

> Requires **Node.js 20+**.

```bash
npm install
npm run dev
# open http://localhost:3000
```

Production build:
```bash
npm run build && npm start
```

A `weather.db` SQLite file is created automatically at the project root on first write (git-ignored).
Dependencies are listed in **`package.json`** (the requirements file for this Node project).

---

## 🔌 API reference

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/weather?location=London` | Current + 5-day forecast by name/zip/coords |
| `GET` | `/api/weather?lat=51.5&lon=-0.12` | Same, by coordinates (geolocation) |
| `GET` | `/api/records` | List all saved records |
| `POST` | `/api/records` | Create `{ location, start_date, end_date, notes? }` (validated) |
| `GET` | `/api/records/:id` | Read one |
| `PUT` | `/api/records/:id` | Update date range / notes (validated) |
| `DELETE` | `/api/records/:id` | Delete |
| `GET` | `/api/export?format=json\|csv\|xml\|md` | Export all records |

---

## 💡 "Think like a user" — non-obvious things considered
- Travelers often know a **landmark or zip**, not exact coordinates → input accepts all of them, plus raw `lat,lon`.
- **Feels-like** temperature, **humidity**, and **rain probability** matter more than the raw number when deciding what to pack.
- **Day/night** context helps trip planning.
- **Ambiguous place names** → the geocoder returns the most relevant match and shows the region/country so the user can confirm.
- **Historical date ranges** let a user check typical weather for travel dates they're considering.

---

*Built by Rishav Jamwal · Weather: Open-Meteo · Maps: OpenStreetMap.*
