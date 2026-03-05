import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";


const controlStyle: React.CSSProperties = {
  height: 45,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(22, 33, 53, 1)",
  color: "inherit",
  outline: "none",
  fontFamily: "system-ui, Arial",
  fontSize: 15,
  fontWeight: 500,
};

type Day = { date: string; label: string };

type GridResponse = {
  venue: string;
  generated_at: string;
  days: Day[];
  times: string[];
  counts: number[][]; // counts[timeIndex][dayIndex]
  maxCourts: number;
};

type HoverCell = { ti: number; di: number } | null;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatUpdatedLocal(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}:${pad2(d.getSeconds())}`;
}

function cellStyle(count: number, isHovered: boolean) {
  // Keep the "previous green" vibe: any availability > 0 uses same dark green.
  const bgZero = "rgba(47, 35, 51, 1)"; // purple-ish for none
  const bgAvail = "rgba(16, 48, 56, 1)"; // dark green for any available

  return {
    // background: isHovered ? "rgba(255, 255, 255, 0.06)" : count > 0 ? bgAvail : bgZero,
    // border: isHovered ? "1px solid rgba(255,255,255,0.22)" : "1px solid rgba(255,255,255,0.06)",
    // transition: "background 120ms ease, border-color 120ms ease",
	background: isHovered ? "rgba(14, 59, 59, 1)" : count > 0 ? bgAvail : bgZero,
	transition: "background 120ms ease",
  } as const;
}

type VenueOption = {
  id: string;
  label: string;
  group: "Indoor Courts" | "Outdoor Courts";
};

const VENUES: VenueOption[] = [
  { id: "islington_tennis_centre", label: "Islington Tennis Centre", group: "Indoor Courts" },
  { id: "lee_valley_tennis_centre", label: "Lee Valley Tennis Centre", group: "Indoor Courts" },

  { id: "st_johns_park", label: "St Johns Park (Tower Hamlets)", group: "Outdoor Courts" },
  { id: "bethnal_green_gardens", label: "Bethnal Green Gardens (Tower Hamlets)", group: "Outdoor Courts" },
  { id: "king_edward_memorial_park", label: "King Edward Memorial Park (Tower Hamlets)", group: "Outdoor Courts" },
  { id: "victoria_park", label: "Victoria Park (Tower Hamlets)", group: "Outdoor Courts" },
  { id: "poplar_rec", label: "Poplar Rec Ground (Tower Hamlets)", group: "Outdoor Courts" },
  { id: "ropemakers_field", label: "Ropemakers Field (Tower Hamlets)", group: "Outdoor Courts" },
  { id: "mile_end_park", label: "Mile End Park (Tower Hamlets)", group: "Outdoor Courts" },
];

const REFRESH_OPTIONS: Array<{ label: string; ms: number }> = [
  { label: "Off", ms: 0 },
  { label: "30s", ms: 30_000 },
  { label: "1m", ms: 60_000 },
  { label: "2m", ms: 120_000 },
  { label: "5m", ms: 300_000 },
  { label: "10m", ms: 600_000 },
];

export default function App() {
  const [data, setData] = useState<GridResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverCell>(null);

  // Venue selector (checkbox list in a dropdown panel)
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([
    "st_johns_park",
  ]);
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  const [venueSearch, setVenueSearch] = useState("");

  // Auto-refresh control
  const [refreshMs, setRefreshMs] = useState<number>(300_000);
  const refreshTimerRef = useRef<number | null>(null);

  const fetchGrid = async () => {
    try {
      setError(null);

      // For now backend is still returning a single-venue mock.
      // Later you will pass selected venues to backend (e.g. ?venues=a,b,c).
      const res = await fetch("/api/availability?venue=st_johns_park&days=7", { cache: "no-store" });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as GridResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Initial fetch + auto-refresh handling
  useEffect(() => {
    fetchGrid();
  }, []);

  useEffect(() => {
    // clear existing timer
    if (refreshTimerRef.current) {
      window.clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (refreshMs > 0) {
      refreshTimerRef.current = window.setInterval(fetchGrid, refreshMs);
    }
    return () => {
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshMs]);

  const updated = useMemo(() => {
    if (!data?.generated_at) return "—";
    return formatUpdatedLocal(data.generated_at);
  }, [data?.generated_at]);

  const selectedVenues = useMemo(() => {
    const map = new Map(VENUES.map((v) => [v.id, v]));
    return selectedVenueIds.map((id) => map.get(id)).filter(Boolean) as VenueOption[];
  }, [selectedVenueIds]);

  const venueSummary = useMemo(() => {
    if (selectedVenues.length === 0) return "Select venues";
    if (selectedVenues.length <= 2) return selectedVenues.map((v) => v.label).join(", ");
    return `${selectedVenues[0].label}, ${selectedVenues[1].label} + ${selectedVenues.length - 2} more`;
  }, [selectedVenues]);

  const filteredVenues = useMemo(() => {
    const q = venueSearch.trim().toLowerCase();
    if (!q) return VENUES;
    return VENUES.filter((v) => v.label.toLowerCase().includes(q));
  }, [venueSearch]);

  const grouped = useMemo(() => {
    const indoor = filteredVenues.filter((v) => v.group === "Indoor Courts");
    const outdoor = filteredVenues.filter((v) => v.group === "Outdoor Courts");
    return { indoor, outdoor };
  }, [filteredVenues]);

  // Close dropdown when clicking outside
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!venueDropdownOpen) return;
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setVenueDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [venueDropdownOpen]);

  return (
    <div
      style={{
        padding: 12,
        maxWidth: 2000,
        margin: 0, // remove "bunched in the middle"
        fontFamily: "system-ui, Arial",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 34, letterSpacing: 0.2 }}>Tennis Court Availability</h1>
      </div>

      {/* Controls row */}
      <div style={{ marginTop: 20, marginLeft: 10, display: "flex", gap: 40, flexWrap: "wrap", alignItems: "center" }}>
		<b>Venues:</b>
        {/* Venue dropdown */}
        <div ref={dropdownRef} style={{ position: "relative", minWidth: 500, maxWidth: 500, flex: "1 1 500px", marginLeft: -30 }}>
          <div
            onClick={() => setVenueDropdownOpen((v) => !v)}
            style={{
              ...controlStyle,
              cursor: "pointer",
              userSelect: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
			  height: 42,
            }}
          >
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{venueSummary}</div>
            <div style={{ opacity: 0.8 }}>▾</div>
          </div>

          {venueDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: 46,
                left: 0,
                right: 0,
                zIndex: 20,
                background: "rgba(15, 25, 45, 0.98)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
                <input
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  placeholder="Search venues..."
                  style={{
                    ...controlStyle,
                    width: 450,
                  }}
                />
              </div>

              <div style={{ maxHeight: 380, overflowY: "auto", padding: 10 }}>
                {(["Indoor Courts", "Outdoor Courts"] as const).map((groupName) => {
                  const list = groupName === "Indoor Courts" ? grouped.indoor : grouped.outdoor;
                  if (list.length === 0) return null;

                  return (
                    <div key={groupName} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700, margin: "6px 4px" }}>
                        {groupName}
                      </div>

                      {list.map((v) => {
                        const checked = selectedVenueIds.includes(v.id);
                        return (
                          <label
                            key={v.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 8px",
                              borderRadius: 10,
                              cursor: "pointer",
                              background: checked ? "rgba(0, 160, 140, 0.18)" : "transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedVenueIds((prev) => {
                                  if (e.target.checked) return Array.from(new Set([...prev, v.id]));
                                  return prev.filter((x) => x !== v.id);
                                });
                              }}
                              style={{ width: 16, height: 16 }}
                            />
                            <span style={{ opacity: 0.95 }}>{v.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Auto-refresh dropdown */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <b>Auto-refresh:</b>
          <select
            value={refreshMs}
            onChange={(e) => setRefreshMs(Number(e.target.value))}
            style={{
			  ...controlStyle,
              minWidth: 100,
              cursor: "pointer",
            }}
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.ms} value={o.ms} style={{ background: "#0b1220" }}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Updated */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <b>Last Refresh:</b> {updated}
        </div>

		{/* Refresh */}
		<button
          onClick={fetchGrid}
          style={{
			...controlStyle,
            cursor: "pointer",
			marginLeft: -20,
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,0,0,0.4)" }}>
          <b style={{ color: "crimson" }}>Error:</b> {error}
        </div>
      )}

      {!data && !error && <div style={{ marginTop: 20 }}>Loading…</div>}

      {data && (
        <div
          style={{
            marginTop: 20,
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(15, 23, 43, 0.9)",
            width: "fit-content", // prevents “bunched” look by letting table size itself
            maxWidth: "100%",
          }}
        >
          <table
            style={{
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr style={{ background: "rgba(15, 23, 43, 0.9)" }}>
                <th
                  style={{
                    padding: "12px 14px",
                    textAlign: "center",
					fontSize: 17,
                    fontWeight: 500,
                    borderBottom: "1px solid rgba(255,255,255,0.10)",
                    width: 170,
                  }}
                >
                  Time
                </th>

                {data.days.map((d) => (
                  <th
                    key={d.date}
                    style={{
                      padding: "12px 14px",
                      textAlign: "center",
					  fontSize: 17,
                      fontWeight: 500,
                      borderBottom: "1px solid rgba(255,255,255,0.10)",
                      whiteSpace: "nowrap",
                      width: 170,
                    }}
                  >
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {data.times.map((t, ti) => (
                <tr key={t}>
                  <td
                    style={{
                      padding: "14px",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(15, 23, 43, 0.9)",
                      fontVariantNumeric: "tabular-nums",
					  fontSize: 17,
                      fontWeight: 500,
                      textAlign: "center",
                      width: 170,
                    }}
                  >
                    {t}
                  </td>

                  {data.days.map((d, di) => {
                    const count = data.counts?.[ti]?.[di] ?? 0;
                    const plural = count === 1 ? "court" : "courts";
                    const isHovered = hover?.ti === ti && hover?.di === di;

                    return (
                      <td
                        key={`${t}_${d.date}`}
                        onMouseEnter={() => setHover({ ti, di })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          ...cellStyle(count, isHovered),
                          padding: "12px 10px",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                          textAlign: "center",
                          verticalAlign: "middle",
                          cursor: "default",
						  fontSize: 17,
						  fontWeight: 500,
                          width: 170,
                        }}
                      >
                        {count === 0 ? (
                          <div style={{ opacity: 0.75, fontWeight: 500 }}>–</div>
                        ) : (
                          <>
                            <div style={{ fontSize: 19, fontWeight: 500, color: "rgba(0, 187, 99, 1)" }}>
                              {count}
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 350, opacity: 0.9 }}>{plural}</div>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected venues aligned with left edge of the table */}
      <div style={{ marginTop: 15, marginLeft: 10, textAlign: "left" }}>
        <b>Selected venues:</b>{" "}
        {selectedVenues.length ? selectedVenues.map((v) => v.label).join(", ") : "None"}
      </div>
    </div>
  );
}