export interface Env {}

type Day = { date: string; label: string };

type AvailabilitySlot = {
  time: string;
  date: string;
  count: number;
};

type GridResponse = {
  generated_at: string;
  days: Day[];
  slots: AvailabilitySlot[];
  venue_slots: VenueAvailabilityDetail[];
};

type VenueAvailabilityDetail = {
  venue_id: string;
  date: string;
  time: string;
  count: number;
  booking_url: string;
};

type SlotDetailsResponse = {
  generated_at: string;
  date: string;
  time: string;
  venues: VenueAvailabilityDetail[];
};

type Slot = {
  time: string;
  court: string;
  status: "booked" | "available";
  price: number | null;
};

type VenueConfig = {
  id: string;
  path: string;
  maxCourts: number;
  courtPrefix: string;
};

const SCRAPE_CONCURRENCY = 1;
const SCRAPE_RETRIES = 2;
const LONDON_TIME_ZONE = "Europe/London";

const VENUES: Record<string, VenueConfig> = {
  st_johns_park: { id: "st_johns_park", path: "st-johns-park", maxCourts: 2, courtPrefix: "Court" },
  bethnal_green_gardens: { id: "bethnal_green_gardens", path: "bethnal-green-gardens", maxCourts: 4, courtPrefix: "Tennis court" },
  poplar_recreation_ground: { id: "poplar_recreation_ground", path: "poplar-rec-ground", maxCourts: 2, courtPrefix: "Court" },
  ropemakers_fields: { id: "ropemakers_fields", path: "ropemakers-field", maxCourts: 2, courtPrefix: "Court" },
  king_edward_memorial_park: { id: "king_edward_memorial_park", path: "king-edward-memorial-park", maxCourts: 2, courtPrefix: "Court" },
  wapping_gardens: { id: "wapping_gardens", path: "wapping-gardens", maxCourts: 1, courtPrefix: "Court" },
  victoria_park: { id: "victoria_park", path: "victoria-park", maxCourts: 4, courtPrefix: "Court" },
};

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        venues: Object.keys(VENUES),
        now: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/debug-scrape") {
      const venueId = url.searchParams.get("venue")?.trim().toLowerCase() ?? "";
      const dateISO = url.searchParams.get("date") ?? getTodayISOInLondon();
      const venue = VENUES[venueId];

      if (!venue) {
        return json({ error: `Unknown venue: ${venueId}` }, 400);
      }

      const upstreamUrl = buildVenueUrl(venue, dateISO);
      const upstreamRes = await fetch(upstreamUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      });
      const html = await upstreamRes.text();
      const slots = parseSlotsFromHTML(html, venue.courtPrefix);
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);

      return json({
        venue: venue.id,
        date: dateISO,
        upstreamUrl,
        upstreamStatus: upstreamRes.status,
        title: titleMatch ? titleMatch[1] : null,
        parsedSlotCount: slots.length,
        availableAt0900: slots.filter((slot) => slot.time === "09:00" && slot.status === "available").length,
        htmlPreview: html.slice(0, 1200),
      });
    }

    if (url.pathname === "/api/slot-details") {
      try {
        const venueParam = url.searchParams.get("venues") || Object.keys(VENUES).join(",");
        const dateISO = url.searchParams.get("date");
        const time = url.searchParams.get("time");

        if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
          return json({ error: "Expected date in YYYY-MM-DD format" }, 400);
        }

        if (!time || !/^\d{2}:\d{2}$/.test(time)) {
          return json({ error: "Expected time in HH:MM format" }, 400);
        }

        const validVenues = venueParam
          .split(",")
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean)
          .map((id) => VENUES[id])
          .filter((v): v is VenueConfig => Boolean(v));

        if (validVenues.length === 0) {
          return json(
            { error: `No valid venues. Available: ${Object.keys(VENUES).join(", ")}` },
            400
          );
        }

        const scrapeResults = await mapWithConcurrency(validVenues, SCRAPE_CONCURRENCY, async (venue) => {
          try {
            return await scrapeVenueForDateWithRetry(venue, dateISO, SCRAPE_RETRIES);
          } catch (error) {
            console.warn(`Failed to scrape ${venue.id} for ${dateISO}:`, error);
            return {
              venue: venue.id,
              date: dateISO,
              slots: [] as Slot[],
            };
          }
        });

        const venues: VenueAvailabilityDetail[] = scrapeResults
          .map((result) => {
            const count = result.slots.filter((slot) => slot.time === time && slot.status === "available").length;
            return {
              venue_id: result.venue,
              date: dateISO,
              time,
              count,
              booking_url: buildVenueBookingUrl(VENUES[result.venue], dateISO),
            };
          })
          .filter((venue) => venue.count > 0);

        const payload: SlotDetailsResponse = {
          generated_at: new Date().toISOString(),
          date: dateISO,
          time,
          venues,
        };

        return json(payload, 200, {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        });
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : String(error) },
          500,
          { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" }
        );
      }
    }

    if (url.pathname === "/api/availability") {
      try {
        const venueParam = url.searchParams.get("venues") || Object.keys(VENUES).join(",");
        const days = clampInt(url.searchParams.get("days"), 1, 14, 8);

        const validVenues = venueParam
          .split(",")
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean)
          .map((id) => VENUES[id])
          .filter((v): v is VenueConfig => Boolean(v));

        if (validVenues.length === 0) {
          return json(
            { error: `No valid venues. Available: ${Object.keys(VENUES).join(", ")}` },
            400
          );
        }

        const todayISO = getTodayISOInLondon();

        const dayList: Day[] = [];
        for (let i = 0; i < days; i++) {
          const dateISO = addDaysToISO(todayISO, i);
          dayList.push({ date: dateISO, label: formatDayLabelFromISO(dateISO) });
        }

        const scrapeTasks = validVenues.flatMap((venue) => dayList.map((day) => ({ venue, date: day.date })));

        // Scrape with a small concurrency limit and retries to avoid upstream throttling.
        const scrapeResults = await mapWithConcurrency(scrapeTasks, SCRAPE_CONCURRENCY, async (task) => {
          try {
            return await scrapeVenueForDateWithRetry(task.venue, task.date, SCRAPE_RETRIES);
          } catch (error) {
            console.warn(`Failed to scrape ${task.venue.id} for ${task.date}:`, error);
            return {
              venue: task.venue.id,
              date: task.date,
              slots: [] as Slot[],
            };
          }
        });

        // Collect all times seen and venue counts (venues with ≥1 available court) per (time, date)
        const allTimesSet = new Set<string>();
        const countMap = new Map<string, number>();
        for (const result of scrapeResults) {
          for (const [time, timeSlots] of groupSlotsByTime(result.slots).entries()) {
            allTimesSet.add(time);
            const available = timeSlots.filter((s) => s.status === "available").length;
            if (available > 0) {
              const key = `${time}|${result.date}`;
              countMap.set(key, (countMap.get(key) ?? 0) + 1);
            }
          }
        }

        // Emit every (time, date) pair for all observed times, count=0 when nothing available
        const slots: AvailabilitySlot[] = [];
        const sortedTimes = [...allTimesSet].sort(compareHHMM);
        for (const time of sortedTimes) {
          for (const day of dayList) {
            slots.push({ time, date: day.date, count: countMap.get(`${time}|${day.date}`) ?? 0 });
          }
        }

        // Build per-venue slot details so the frontend can pre-populate its cache
        const venueSlots: VenueAvailabilityDetail[] = [];
        for (const result of scrapeResults) {
          for (const [time, timeSlots] of groupSlotsByTime(result.slots).entries()) {
            const count = timeSlots.filter((s) => s.status === "available").length;
            if (count > 0) {
              venueSlots.push({
                venue_id: result.venue,
                date: result.date,
                time,
                count,
                booking_url: buildVenueBookingUrl(VENUES[result.venue], result.date),
              });
            }
          }
        }

        const payload: GridResponse = {
          generated_at: new Date().toISOString(),
          days: dayList,
          slots,
          venue_slots: venueSlots,
        };

        return json(payload, 200, {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        });
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : String(error) },
          500,
          { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" }
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
};

async function scrapeVenueForDate(venue: VenueConfig, dateISO: string): Promise<{
  venue: string;
  date: string;
  slots: Slot[];
}> {
  const url = buildVenueUrl(venue, dateISO);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!res.ok) {
    throw new Error(`Upstream fetch failed for ${dateISO}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const slots = parseSlotsFromHTML(html, venue.courtPrefix);

  if (slots.length === 0) {
    throw new Error(`No slot rows parsed for ${venue.id} on ${dateISO}`);
  }

  return {
    venue: venue.id,
    date: dateISO,
    slots,
  };
}

async function scrapeVenueForDateWithRetry(
  venue: VenueConfig,
  dateISO: string,
  retries: number
): Promise<{
  venue: string;
  date: string;
  slots: Slot[];
}> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await scrapeVenueForDate(venue, dateISO);
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
    }
  }

  throw lastError;
}

function buildVenueUrl(venue: VenueConfig, dateISO: string): string {
  const todayISO = getTodayISOInLondon();

  if (dateISO === todayISO) {
    return `https://tennistowerhamlets.com/book/courts/${venue.path}#book`;
  }

  return `https://tennistowerhamlets.com/book/courts/${venue.path}/${dateISO}#book`;
}

function buildVenueBookingUrl(venue: VenueConfig, dateISO: string): string {
  return `https://tennistowerhamlets.com/book/courts/${venue.path}/${dateISO}#book`;
}

function parseSlotsFromHTML(html: string, courtPrefix: string): Slot[] {
  const slots: Slot[] = [];
  const escapedPrefix = courtPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Each <tr> is one time slot row
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];

    const timeMatch = row.match(/<th[^>]*class="time"[^>]*>\s*([^<]+)\s*<\/th>/i);
    if (!timeMatch) continue;

    let time: string;
    try {
      time = to24Hour(timeMatch[1].trim());
    } catch {
      continue;
    }

    // Match each court span: <span class="button CLASSNAME">COURT_NAME...<span class="price">PRICE_HTML</span></span>
    const courtRegex = new RegExp(
      `<span[^>]+class="button\\s+(\\w+)"[^>]*>(${escapedPrefix}\\s+\\d+)[\\s\\S]*?<span[^>]*class="price"[^>]*>([\\s\\S]*?)<\\/span>`,
      "gi"
    );
    let courtMatch: RegExpExecArray | null;

    while ((courtMatch = courtRegex.exec(row)) !== null) {
      const buttonClass = courtMatch[1].toLowerCase();
      const court = courtMatch[2].trim();
      const priceHTML = courtMatch[3];

      if (buttonClass === "available") {
        const priceMatch = priceHTML.match(/(?:&pound;|£)(\d+(?:\.\d{1,2})?)/i);
        slots.push({ time, court, status: "available", price: priceMatch ? Number(priceMatch[1]) : null });
      } else {
        slots.push({ time, court, status: "booked", price: null });
      }
    }
  }

  return slots.sort((a, b) => {
    const t = compareHHMM(a.time, b.time);
    if (t !== 0) return t;
    return a.court.localeCompare(b.court);
  });
}

function groupSlotsByTime(slots: Slot[]): Map<string, Slot[]> {
  const map = new Map<string, Slot[]>();

  for (const slot of slots) {
    if (!map.has(slot.time)) {
      map.set(slot.time, []);
    }
    map.get(slot.time)!.push(slot);
  }

  return map;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}

function to24Hour(input: string): string {
  const s = input.trim().toLowerCase();
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);

  if (!m) {
    throw new Error(`Unrecognized time format: ${input}`);
  }

  let hour = Number(m[1]);
  const minute = Number(m[2] || "0");
  const ampm = m[3];

  if (ampm === "am") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayISOInLondon(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    return formatDateISO(new Date());
  }

  return `${year}-${month}-${day}`;
}

function addDaysToISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatDayLabelFromISO(dateISO: string): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: LONDON_TIME_ZONE });
  const dd = String(day).padStart(2, "0");
  return `${weekday} ${dd}`;
}

function compareHHMM(a: string, b: string): number {
  return a.localeCompare(b);
}

function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = raw ? Number(raw) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}