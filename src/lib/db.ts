// SQLite persistence layer (better-sqlite3). One table of saved weather queries.
import Database from "better-sqlite3";
import path from "path";

// Lazy singleton — the DB file is only opened on first actual use (a request),
// not at import time. This avoids "database is locked" during the build, when
// Next evaluates route modules in parallel.
let _db: Database.Database | null = null;
function db(): Database.Database {
  if (_db) return _db;
  // On Vercel the deployment filesystem is read-only — /tmp is the only writable
  // path, so hosted records are ephemeral (documented in the README).
  _db = new Database(process.env.VERCEL ? "/tmp/weather.db" : path.join(process.cwd(), "weather.db"));
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      location      TEXT NOT NULL,
      resolved_name TEXT NOT NULL,
      latitude      REAL NOT NULL,
      longitude     REAL NOT NULL,
      start_date    TEXT NOT NULL,
      end_date      TEXT NOT NULL,
      temps_json    TEXT NOT NULL,
      notes         TEXT DEFAULT '',
      created_at    TEXT NOT NULL
    );
  `);
  return _db;
}

export type WeatherRecord = {
  id: number;
  location: string;
  resolved_name: string;
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
  temps_json: string;
  notes: string;
  created_at: string;
};

export const records = {
  all(): WeatherRecord[] {
    return db().prepare("SELECT * FROM records ORDER BY id DESC").all() as WeatherRecord[];
  },
  get(id: number): WeatherRecord | undefined {
    return db().prepare("SELECT * FROM records WHERE id = ?").get(id) as WeatherRecord | undefined;
  },
  create(r: Omit<WeatherRecord, "id" | "created_at">): WeatherRecord {
    const info = db()
      .prepare(
        `INSERT INTO records (location, resolved_name, latitude, longitude, start_date, end_date, temps_json, notes, created_at)
         VALUES (@location, @resolved_name, @latitude, @longitude, @start_date, @end_date, @temps_json, @notes, @created_at)`
      )
      .run({ ...r, created_at: new Date().toISOString() });
    return this.get(Number(info.lastInsertRowid))!;
  },
  update(id: number, fields: Partial<Pick<WeatherRecord, "start_date" | "end_date" | "notes" | "temps_json">>): WeatherRecord | undefined {
    const existing = this.get(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...fields };
    db().prepare(
      `UPDATE records SET start_date=@start_date, end_date=@end_date, notes=@notes, temps_json=@temps_json WHERE id=@id`
    ).run({ ...merged, id });
    return this.get(id);
  },
  remove(id: number): boolean {
    return db().prepare("DELETE FROM records WHERE id = ?").run(id).changes > 0;
  },
};
