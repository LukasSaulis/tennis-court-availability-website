export interface Env {}

type Day = { date: string; label: string };

type GridResponse = {
  venue: string;
  generated_at: string;
  days: Day[];
  times: string[];
  counts: number[][];
  maxCourts: number;
};

type Slot = {
  time: string;   // HH:MM
  court: string;  // "Court 1"
  status: "booked" | "available";
  price: number | null;
};

const VENUE_ID = "st_johns_park";
const VENUE_PATH = "st-johns-park";
const MAX_COURTS = 2;

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({
        ok: true,
        venue: VENUE_ID,
        now: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/availability") {
      try {
        const venue = (url.searchParams.get("venue") || VENUE_ID).toLowerCase();
        const days = clampInt(url.searchParams.get("days"), 1, 14, 7);

        if (venue !== VENUE_ID) {
          return json(
            {
              error: `Only ${VENUE_ID} is implemented right now.`,
            },
            400
          );
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dayList: Day[] = [];
        const slotMaps: Map<string, Slot[]>[] = [];

        for (let i = 0; i < days; i++) {
          const d = addDays(today, i);
          const iso = formatDateISO(d);

          const scraped = await scrapeStJohnsForDate(iso);

          dayList.push({
            date: iso,
            label: formatDayLabel(d),
          });

          slotMaps.push(groupSlotsByTime(scraped.slots));
        }

        const allTimes = Array.from(
          new Set(slotMaps.flatMap((m) => Array.from(m.keys())))
        ).sort(compareHHMM);

        const counts = allTimes.map((time) =>
          slotMaps.map((slotMap) => {
            const slots = slotMap.get(time) || [];
            return slots.filter((s) => s.status === "available").length;
          })
        );

        const payload: GridResponse = {
          venue: VENUE_ID,
          generated_at: new Date().toISOString(),
          days: dayList,
          times: allTimes,
          counts,
          maxCourts: MAX_COURTS,
        };

        return json(payload, 200, {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        });
      } catch (error) {
        return json(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          500,
          {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          }
        );
      }
    }

    return new Response("Not found", { status: 404 });
  },
};

async function scrapeStJohnsForDate(dateISO: string): Promise<{
  venue: string;
  date: string;
  slots: Slot[];
}> {
  const url = buildVenueUrl(dateISO);

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    cf: {
      cacheEverything: false,
      cacheTtl: 0,
      cacheKey: undefined,
    },
  });

  if (!res.ok) {
    throw new Error(`Upstream fetch failed for ${dateISO}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const text = htmlToSearchableText(html);
  const slots = parseSlotsFromText(text);

  return {
    venue: VENUE_ID,
    date: dateISO,
    slots,
  };
}

function buildVenueUrl(dateISO: string): string {
  const todayISO = formatDateISO(new Date());

  if (dateISO === todayISO) {
    return `https://tennistowerhamlets.com/book/courts/${VENUE_PATH}#book`;
  }

  return `https://tennistowerhamlets.com/book/courts/${VENUE_PATH}/${dateISO}#book`;
}

function htmlToSearchableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(div|p|li|tr|section|article|h1|h2|h3|h4|h5|h6)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&pound;/gi, "£")
    .replace(/&#163;/gi, "£")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSlotsFromText(text: string): Slot[] {
  const slots: Slot[] = [];

  const rowRegex =
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s+Court\s+1\s+(booked|£\s*\d+(?:\.\d{1,2})?)\s+Court\s+2\s+(booked|£\s*\d+(?:\.\d{1,2})?)/gi;

  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(text)) !== null) {
    const rawTime = match[1];
    const court1State = match[2];
    const court2State = match[3];
    const time = to24Hour(rawTime);

    slots.push(parseCourtState(time, "Court 1", court1State));
    slots.push(parseCourtState(time, "Court 2", court2State));
  }

  return slots.sort((a, b) => {
    const t = compareHHMM(a.time, b.time);
    if (t !== 0) return t;
    return a.court.localeCompare(b.court);
  });
}

function parseCourtState(time: string, court: string, state: string): Slot {
  const s = state.trim().toLowerCase();

  if (s.includes("booked")) {
    return {
      time,
      court,
      status: "booked",
      price: null,
    };
  }

  const priceMatch = state.match(/£\s*(\d+(?:\.\d{1,2})?)/i);

  return {
    time,
    court,
    status: "available",
    price: priceMatch ? Number(priceMatch[1]) : null,
  };
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

function formatDayLabel(d: Date): string {
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const dd = String(d.getDate()).padStart(2, "0");
  return `${weekday} ${dd}`;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
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