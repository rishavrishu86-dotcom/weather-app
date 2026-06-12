export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { records } from "@/lib/db";
import { resolveLocation, getRangeTemps } from "@/lib/weather";

// READ — list all saved records
export async function GET() {
  return NextResponse.json({ records: records.all() });
}

// CREATE — { location, start_date, end_date, notes? }
// Validates the date range AND that the location really exists (via geocoding).
export async function POST(req: Request) {
  let body: { location?: string; start_date?: string; end_date?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { location, start_date, end_date, notes = "" } = body;
  if (!location || !start_date || !end_date)
    return NextResponse.json({ error: "location, start_date and end_date are required." }, { status: 400 });

  // --- validate date range ---
  const start = new Date(start_date);
  const end = new Date(end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return NextResponse.json({ error: "Dates must be valid (YYYY-MM-DD)." }, { status: 400 });
  if (start > end)
    return NextResponse.json({ error: "Start date must be on or before the end date." }, { status: 400 });
  // archive API only has data up to ~5 days ago; cap the end date there
  const maxEnd = new Date();
  maxEnd.setDate(maxEnd.getDate() - 5);
  if (end > maxEnd)
    return NextResponse.json(
      { error: "End date must be at least 5 days in the past (historical data source)." },
      { status: 400 }
    );

  try {
    // --- validate the location exists ---
    const geo = await resolveLocation(location);
    const temps = await getRangeTemps(geo.latitude, geo.longitude, start_date, end_date);
    const rec = records.create({
      location,
      resolved_name: geo.admin1 ? `${geo.name}, ${geo.admin1}, ${geo.country}` : `${geo.name}, ${geo.country}`,
      latitude: geo.latitude,
      longitude: geo.longitude,
      start_date,
      end_date,
      temps_json: JSON.stringify(temps),
      notes,
    });
    return NextResponse.json({ record: rec }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create record.";
    return NextResponse.json({ error: msg }, { status: /not found/i.test(msg) ? 404 : 502 });
  }
}
