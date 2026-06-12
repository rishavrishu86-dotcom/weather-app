export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { records, type WeatherRecord } from "@/lib/db";

// GET /api/export?format=json|csv|xml|md   — exports all saved records.
export async function GET(req: Request) {
  const format = (new URL(req.url).searchParams.get("format") || "json").toLowerCase();
  const rows = records.all();

  const flat = rows.map((r) => ({
    id: r.id,
    location: r.location,
    resolved_name: r.resolved_name,
    latitude: r.latitude,
    longitude: r.longitude,
    start_date: r.start_date,
    end_date: r.end_date,
    notes: r.notes,
    created_at: r.created_at,
    days: (() => {
      try {
        return JSON.parse(r.temps_json).length;
      } catch {
        return 0;
      }
    })(),
  }));

  const headers = (type: string, ext: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="weather-records.${ext}"`,
  });

  switch (format) {
    case "csv": {
      const cols = Object.keys(flat[0] ?? { id: "", location: "" });
      const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      const body = [cols.join(","), ...flat.map((row) => cols.map((c) => esc((row as Record<string, unknown>)[c])).join(","))].join("\n");
      return new NextResponse(body, { headers: headers("text/csv", "csv") });
    }
    case "xml": {
      const esc = (v: unknown) => String(v).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
      const body =
        `<?xml version="1.0" encoding="UTF-8"?>\n<records>\n` +
        flat.map((row) => `  <record>\n` + Object.entries(row).map(([k, v]) => `    <${k}>${esc(v)}</${k}>`).join("\n") + `\n  </record>`).join("\n") +
        `\n</records>\n`;
      return new NextResponse(body, { headers: headers("application/xml", "xml") });
    }
    case "md":
    case "markdown": {
      const cols = Object.keys(flat[0] ?? { id: "", location: "" });
      const body =
        `# Weather Records\n\n| ${cols.join(" | ")} |\n| ${cols.map(() => "---").join(" | ")} |\n` +
        flat.map((row) => `| ${cols.map((c) => String((row as Record<string, unknown>)[c])).join(" | ")} |`).join("\n") +
        "\n";
      return new NextResponse(body, { headers: headers("text/markdown", "md") });
    }
    case "json":
    default:
      return new NextResponse(JSON.stringify(rows as WeatherRecord[], null, 2), { headers: headers("application/json", "json") });
  }
}
