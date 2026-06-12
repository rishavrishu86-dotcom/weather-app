export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { records } from "@/lib/db";
import { getRangeTemps } from "@/lib/weather";

type Ctx = { params: Promise<{ id: string }> };

// READ one
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rec = records.get(Number(id));
  if (!rec) return NextResponse.json({ error: "Record not found." }, { status: 404 });
  return NextResponse.json({ record: rec });
}

// UPDATE — can change the date range (re-fetches temps) and/or notes. Validated.
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const existing = records.get(Number(id));
  if (!existing) return NextResponse.json({ error: "Record not found." }, { status: 404 });

  let body: { start_date?: string; end_date?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const start_date = body.start_date ?? existing.start_date;
  const end_date = body.end_date ?? existing.end_date;
  const notes = body.notes ?? existing.notes;

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return NextResponse.json({ error: "Dates must be valid (YYYY-MM-DD)." }, { status: 400 });
  if (start > end)
    return NextResponse.json({ error: "Start date must be on or before the end date." }, { status: 400 });

  let temps_json = existing.temps_json;
  // if the range changed, re-fetch the historical temps for the new range
  if (body.start_date || body.end_date) {
    try {
      const temps = await getRangeTemps(existing.latitude, existing.longitude, start_date, end_date);
      temps_json = JSON.stringify(temps);
    } catch {
      /* keep old temps if the fetch fails */
    }
  }

  const updated = records.update(Number(id), { start_date, end_date, notes, temps_json });
  return NextResponse.json({ record: updated });
}

// DELETE
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const ok = records.remove(Number(id));
  if (!ok) return NextResponse.json({ error: "Record not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
