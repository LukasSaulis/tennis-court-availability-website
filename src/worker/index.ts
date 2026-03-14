import { Hono } from "hono";

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));

/**
 * Returns a week-grid of "available courts count" for a single venue.
 *
 * Shape:
 * {
 *   venue: "st_johns_park",
 *   generated_at: "...",
 *   days: [{ date: "2026-02-05", label: "Thu 05" }, ...],
 *   times: ["07:00","08:00",...,"22:00"],
 *   counts: number[][] // counts[timeIndex][dayIndex]
 * }
 *
 * For now this is MOCK data so the UI works.
 * Later your scraper will compute real counts and return the same shape.
 */
app.get("/api/availability", (c) => {
  const venue = c.req.query("venue") ?? "st_johns_park";

  // start date: either ?start=YYYY-MM-DD or default = today (UTC)
  const startParam = c.req.query("start");
  const start = startParam ? new Date(`${startParam}T00:00:00Z`) : new Date();
  const startUTC = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));

  const daysCount = Number(c.req.query("days") ?? "7");
  const days = Array.from({ length: Math.min(Math.max(daysCount, 1), 14) }, (_, i) => {
    const d = new Date(startUTC);
    d.setUTCDate(d.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const date = `${yyyy}-${mm}-${dd}`;
    const label = d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" }).replace(",", "");
    return { date, label };
  });

  // Choose the time range you want shown in the grid:
  const times = [
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
    "22:00",
  ];

  // St Johns Park has 2 courts => counts are 0..2
  // MOCK logic: creates a realistic-looking pattern, deterministic by date/time.
  const maxCourts = 2;
  const counts: number[][] = times.map((t) => {
    const [hh, mm] = t.split(":").map(Number);
    const minutes = hh * 60 + mm;

    return days.map((day) => {
      // deterministic pseudo-random seed from date+time
      const seed = Number(day.date.replaceAll("-", "")) + minutes;
      const x = Math.sin(seed * 0.01) * 10000;
      const r = x - Math.floor(x); // 0..1

      // bias: more availability early afternoon in this mock
      const bias =
        minutes >= 13 * 60 && minutes <= 17 * 60 ? 0.15 : minutes >= 7 * 60 && minutes <= 12 * 60 ? 0.05 : -0.1;

      const v = r + bias;

      if (v < 0.45) return 0;
      if (v < 0.78) return 1;
      return maxCourts;
    });
  });

  return c.json({
    venue,
    generated_at: new Date().toISOString(),
    days,
    times,
    counts,
    maxCourts,
  });
});

export default app;