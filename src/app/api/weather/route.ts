export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { resolveLocation, reverseName, getWeather } from "@/lib/weather";

// GET /api/weather?location=London   or   /api/weather?lat=51.5&lon=-0.12
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  try {
    let coords: { name: string; country: string; latitude: number; longitude: number };

    if (lat && lon) {
      // "Use my location" path (browser geolocation)
      const la = parseFloat(lat);
      const lo = parseFloat(lon);
      if (Number.isNaN(la) || Number.isNaN(lo)) throw new Error("Invalid coordinates.");
      coords = { name: await reverseName(la, lo), country: "", latitude: la, longitude: lo };
    } else if (location) {
      const g = await resolveLocation(location);
      coords = { name: g.admin1 ? `${g.name}, ${g.admin1}` : g.name, country: g.country, latitude: g.latitude, longitude: g.longitude };
    } else {
      return NextResponse.json({ error: "Provide a `location` or `lat`/`lon`." }, { status: 400 });
    }

    const weather = await getWeather(coords.latitude, coords.longitude);
    return NextResponse.json({ place: coords, ...weather });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    // 404 for "not found", 502 for upstream failures, 400 otherwise
    const status = /not found/i.test(msg) ? 404 : /unavailable|failed/i.test(msg) ? 502 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
