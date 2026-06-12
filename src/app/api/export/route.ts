export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { records, type WeatherRecord } from "@/lib/db";

// GET /api/export?format=json|csv|xml|md|pdf  — exports all saved records.
export async function GET(req: Request) {
  const format = (new URL(req.url).searchParams.get("format") || "json").toLowerCase();
  const rows = records.all();

  // Flatten + compute the temperature stats that are the point of each record.
  const flat = rows.map((r) => {
    let temps: { min?: number; max?: number; mean?: number }[] = [];
    try { temps = JSON.parse(r.temps_json); } catch {}
    const nums = (k: "min" | "max" | "mean") => temps.map((t) => t[k]).filter((n): n is number => typeof n === "number");
    const means = nums("mean");
    return {
      id: r.id,
      location: r.location,
      resolved_name: r.resolved_name,
      latitude: r.latitude,
      longitude: r.longitude,
      start_date: r.start_date,
      end_date: r.end_date,
      days: temps.length,
      avg_temp_c: means.length ? +(means.reduce((a, b) => a + b, 0) / means.length).toFixed(1) : null,
      min_temp_c: nums("min").length ? Math.min(...nums("min")) : null,
      max_temp_c: nums("max").length ? Math.max(...nums("max")) : null,
      notes: r.notes,
      created_at: r.created_at,
    };
  });

  const headers = (type: string, ext: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="weather-records.${ext}"`,
  });
  const cols = Object.keys(flat[0] ?? { id: "", location: "" });

  switch (format) {
    case "csv": {
      // Guard against CSV formula injection by prefixing values that start with = + - @
      const esc = (v: unknown) => {
        let s = String(v);
        // neutralize formula injection, but don't mangle plain negative numbers
        if (/^[=+@\t\r]/.test(s) || /^-[^0-9.]/.test(s)) s = "'" + s;
        return `"${s.replace(/"/g, '""')}"`;
      };
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
      const body =
        `# Weather Records\n\n| ${cols.join(" | ")} |\n| ${cols.map(() => "---").join(" | ")} |\n` +
        flat.map((row) => `| ${cols.map((c) => String((row as Record<string, unknown>)[c])).join(" | ")} |`).join("\n") +
        "\n";
      return new NextResponse(body, { headers: headers("text/markdown", "md") });
    }
    case "pdf": {
      const lines = ["Weather Records", `Exported ${new Date().toISOString().slice(0, 10)}`, ""];
      flat.forEach((r) =>
        lines.push(`#${r.id}  ${r.resolved_name}`, `   ${r.start_date} -> ${r.end_date}  |  avg ${r.avg_temp_c ?? "-"}C  min ${r.min_temp_c ?? "-"}C  max ${r.max_temp_c ?? "-"}C`, `   notes: ${r.notes || "-"}`, "")
      );
      if (flat.length === 0) lines.push("(no records)");
      return new NextResponse(toPdf(lines), { headers: headers("application/pdf", "pdf") });
    }
    case "json":
    default:
      return new NextResponse(JSON.stringify(rows as WeatherRecord[], null, 2), { headers: headers("application/json", "json") });
  }
}

/** Minimal dependency-free PDF: one page of monospaced text lines.
 *  Returns an ASCII string (a valid PDF body) — non-ASCII is stripped so the
 *  byte offsets in the xref table stay correct. */
function toPdf(lines: string[]): string {
  const escTxt = (s: string) => s.replace(/[^\x20-\x7E]/g, "?").replace(/[\\()]/g, "\\$&");
  const content = ["BT", "/F1 10 Tf", "13 TL", "1 0 0 1 40 800 Tm", ...lines.flatMap((l) => [`(${escTxt(l)}) Tj`, "T*"]), "ET"].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}
