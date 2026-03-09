import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const uiStyle = {
  pagePadding: 0,
  pageMaxWidth: 2000,
  pageMargin: 0,

  controlsMarginTop: 20,
  controlsMarginLeft: 10,
  controlsGap: 40,
  controlsFontSize: 14,

  textFontFamily: "system-ui, Arial",
  textColor: "rgba(255,255,255,0.92)",
  textFontSize: 14,
  textFontWeight: 500,

  labelFontSize: 14,
  labelFontWeight: 700,

  selectedVenuesMarginTop: 15,
  selectedVenuesMarginLeft: 10,

  loadingMarginTop: 20,
  errorMarginTop: 12,
  errorPadding: 12,
  errorBorderRadius: 12,

  dropdownTop: 46,
  dropdownPadding: 10,
  dropdownMaxHeight: 380,
  dropdownItemPadding: "8px 8px",
  dropdownGroupMarginBottom: 12,
  searchWidth: 450,

  controlHeight: 40,
  controlPadding: "0 12px",
  controlBorderRadius: 10,
  controlBorder: "1px solid rgba(255,255,255,0.18)",
  controlBackground: "rgba(22, 33, 53, 1)",
  controlOutline: "none",
};

const tableStyle = {
  wrapperMarginTop: 20,
  wrapperBorderRadius: 14,
  wrapperWidth: "fit-content" as const,
  wrapperMaxWidth: "100%",
  wrapperBackground: "rgba(15, 23, 43, 0.9)",
  wrapperBorder: "1px solid rgba(255,255,255,0.10)",

  columnWidth: 130,
  headerPadding: "9px 9px",
  cellPadding: "9px 9px",
  timeCellPadding: "9px 9px",

  fontSize: 14,
  fontWeight: 500,
  numberFontSize: 14,
  numberFontWeight: 500,

  headerBackground: "rgba(15, 23, 43, 0.9)",
  timeColumnBackground: "rgba(15, 23, 43, 0.9)",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  headerBorderBottom: "1px solid rgba(255,255,255,0.10)",
};

type Day = { date: string; label: string };

type GridResponse = {
  venue: string;
  generated_at: string;
  days: Day[];
  times: string[];
  counts: number[][];
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
  const bgZero = "rgba(47, 35, 51, 1)";
  const bgAvail = "rgba(16, 48, 56, 1)";

  return {
    background: isHovered ? "rgba(14, 59, 59, 1)" : count > 0 ? bgAvail : bgZero,
    transition: "background 120ms ease",
  } as const;
}

type VenueOption = {
  id: string;
  label: string;
  group:
    | "Groups"
    | "With Floodlights (Close)"
    | "With Floodlights (Far)"
    | "Without Floodlights (Close)"
    | "Without Floodlights (Far)"
    | "Indoor Courts";
};

const VENUES: VenueOption[] = [
  { id: "all_courts", label: "All Courts", group: "Groups" },
  { id: "st_johns_park_group", label: "St Johns Park Only", group: "Groups" },
  { id: "with_floodlights_close", label: "With Floodlights (Close)", group: "Groups" },
  { id: "with_floodlights_far", label: "With Floodlights (Far)", group: "Groups" },
  { id: "without_floodlights_close", label: "Without Floodlights (Close)", group: "Groups" },
  { id: "without_floodlights_far", label: "Without Floodlights (Far)", group: "Groups" },

  { id: "bethnal_green_gardens", label: "Bethnal Green Gardens — 25m", group: "With Floodlights (Close)" },
  { id: "ladywell_fields", label: "Ladywell Fields — 40m", group: "With Floodlights (Close)" },
  { id: "st_johns_park", label: "St Johns Park — 10m", group: "With Floodlights (Close)" },
  { id: "stratford_park", label: "Stratford Park — 40m", group: "With Floodlights (Close)" },

  { id: "hermit_road_rec", label: "Hermit Rd Rec — 40m", group: "Without Floodlights (Close)" },
  { id: "king_edward_memorial_park", label: "King Edward Memorial Park — 25m", group: "Without Floodlights (Close)" },
  { id: "poplar_rec", label: "Poplar Recreation Ground — 20m", group: "Without Floodlights (Close)" },
  { id: "ropemakers_field", label: "Ropemakers Field — 20m", group: "Without Floodlights (Close)" },
  { id: "royal_victoria_gardens", label: "Royal Victoria Gardens — 40m", group: "Without Floodlights (Close)" },
  { id: "southwark_park", label: "Southwark Park — 30m", group: "Without Floodlights (Close)" },

  { id: "canning_town_rec_ground", label: "Canning Town Rec Ground — 40m", group: "With Floodlights (Far)" },
  { id: "little_ilford_park", label: "Little Ilford Park — 1h", group: "With Floodlights (Far)" },
  { id: "lyle_park", label: "Lyle Park — 30m", group: "With Floodlights (Far)" },

  { id: "central_park", label: "Central Park — 1h", group: "Without Floodlights (Far)" },
  { id: "gooseley_playing_fields", label: "Gooseley Playing Fields — 1h", group: "Without Floodlights (Far)" },
  { id: "plashet_park", label: "Plashet Park — 50m", group: "Without Floodlights (Far)" },

  { id: "ealing_lawn_tennis_club", label: "Ealing Lawn Tennis Club — 1h — £10/h", group: "Indoor Courts" },
  { id: "islington_tennis_centre_outdoors", label: "Islington Tennis Centre — 1h — £39/h", group: "Indoor Courts" },
  { id: "lee_valley_hockey_tennis_centre", label: "Lee Valley Hockey and Tennis Centre — 1h — £33/h", group: "Indoor Courts" },
  { id: "new_river_sport_fitness", label: "New River Sport & Fitness — 1h20 — £26/h", group: "Indoor Courts" },
  { id: "westway", label: "Westway — 55m — £37/h", group: "Indoor Courts" },
];

const REFRESH_OPTIONS: Array<{ label: string; ms: number }> = [
  { label: "Off", ms: 0 },
  { label: "5m", ms: 300_000 },
  { label: "15m", ms: 900_000 },
  { label: "30m", ms: 1_800_000 },
];

export default function App() {
  const [data, setData] = useState<GridResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverCell>(null);

  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>(["st_johns_park"]);
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  const [venueSearch, setVenueSearch] = useState("");

  const [refreshMs, setRefreshMs] = useState<number>(300_000);
  const refreshTimerRef = useRef<number | null>(null);

  const fetchGrid = async () => {
    try {
      setError(null);
      const res = await fetch("/api/availability?venue=st_johns_park&days=7", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as GridResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    fetchGrid();
  }, []);

  useEffect(() => {
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
    const groups = filteredVenues.filter((v) => v.group === "Groups");
    const with_floodlights_close = filteredVenues.filter((v) => v.group === "With Floodlights (Close)");
    const with_floodlights_far = filteredVenues.filter((v) => v.group === "With Floodlights (Far)");
    const without_floodlights_close = filteredVenues.filter((v) => v.group === "Without Floodlights (Close)");
    const without_floodlights_far = filteredVenues.filter((v) => v.group === "Without Floodlights (Far)");
    const indoor = filteredVenues.filter((v) => v.group === "Indoor Courts");
    return { groups, with_floodlights_close, with_floodlights_far, without_floodlights_close, without_floodlights_far, indoor };
  }, [filteredVenues]);

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
        padding: uiStyle.pagePadding,
        maxWidth: uiStyle.pageMaxWidth,
        margin: uiStyle.pageMargin,
        fontFamily: uiStyle.textFontFamily,
        color: uiStyle.textColor,
      }}
    >
      <div
        style={{
          marginTop: uiStyle.controlsMarginTop,
          marginLeft: uiStyle.controlsMarginLeft,
          display: "flex",
          gap: uiStyle.controlsGap,
          flexWrap: "wrap",
          alignItems: "center",
          fontSize: uiStyle.controlsFontSize,
        }}
      >
        <b>Venues:</b>

        <div
          ref={dropdownRef}
          style={{ position: "relative", minWidth: 500, maxWidth: 500, flex: "1 1 500px", marginLeft: -30 }}
        >
          <div
            onClick={() => setVenueDropdownOpen((v) => !v)}
            style={{
              height: uiStyle.controlHeight,
              padding: uiStyle.controlPadding,
              borderRadius: uiStyle.controlBorderRadius,
              border: uiStyle.controlBorder,
              background: uiStyle.controlBackground,
              color: "inherit",
              outline: uiStyle.controlOutline,
              fontFamily: uiStyle.textFontFamily,
              fontSize: uiStyle.textFontSize,
              fontWeight: uiStyle.textFontWeight,
              cursor: "pointer",
              userSelect: "none",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{venueSummary}</div>
            <div style={{ opacity: 0.8 }}>▾</div>
          </div>

          {venueDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: uiStyle.dropdownTop,
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
              <div
                style={{
                  padding: uiStyle.dropdownPadding,
                  borderBottom: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <input
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  placeholder="Search venues..."
                  style={{
                    height: uiStyle.controlHeight,
                    padding: uiStyle.controlPadding,
                    borderRadius: uiStyle.controlBorderRadius,
                    border: uiStyle.controlBorder,
                    background: uiStyle.controlBackground,
                    color: "inherit",
                    outline: uiStyle.controlOutline,
                    fontFamily: uiStyle.textFontFamily,
                    fontSize: uiStyle.textFontSize,
                    fontWeight: uiStyle.textFontWeight,
                    width: uiStyle.searchWidth,
                  }}
                />
              </div>

              <div
                style={{
                  maxHeight: uiStyle.dropdownMaxHeight,
                  overflowY: "auto",
                  padding: uiStyle.dropdownPadding,
                }}
              >
                {(
                  [
                    "Groups",
                    "With Floodlights (Close)",
                    "With Floodlights (Far)",
                    "Without Floodlights (Close)",
                    "Without Floodlights (Far)",
                    "Indoor Courts",
                  ] as const
                ).map((groupName) => {
                  const list =
                    groupName === "Groups"
                      ? grouped.groups
                      : groupName === "With Floodlights (Close)"
                      ? grouped.with_floodlights_close
                      : groupName === "With Floodlights (Far)"
                      ? grouped.with_floodlights_far
                      : groupName === "Without Floodlights (Close)"
                      ? grouped.without_floodlights_close
                      : groupName === "Without Floodlights (Far)"
                      ? grouped.without_floodlights_far
                      : grouped.indoor;

                  if (list.length === 0) return null;

                  return (
                    <div key={groupName} style={{ marginBottom: uiStyle.dropdownGroupMarginBottom }}>
                      <div
                        style={{
                          fontSize: uiStyle.labelFontSize,
                          opacity: 0.75,
                          fontWeight: uiStyle.labelFontWeight,
                          margin: "6px 4px",
                        }}
                      >
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
                              padding: uiStyle.dropdownItemPadding,
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

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <b>Auto-refresh:</b>
          <select
            value={refreshMs}
            onChange={(e) => setRefreshMs(Number(e.target.value))}
            style={{
              height: uiStyle.controlHeight,
              padding: uiStyle.controlPadding,
              borderRadius: uiStyle.controlBorderRadius,
              border: uiStyle.controlBorder,
              background: uiStyle.controlBackground,
              color: "inherit",
              outline: uiStyle.controlOutline,
              fontFamily: uiStyle.textFontFamily,
              fontSize: uiStyle.textFontSize,
              fontWeight: uiStyle.textFontWeight,
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

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <b>Last Refresh:</b> {updated}
        </div>

        <button
          onClick={fetchGrid}
          style={{
            height: uiStyle.controlHeight,
            padding: uiStyle.controlPadding,
            borderRadius: uiStyle.controlBorderRadius,
            border: uiStyle.controlBorder,
            background: uiStyle.controlBackground,
            color: "inherit",
            outline: uiStyle.controlOutline,
            fontFamily: uiStyle.textFontFamily,
            fontSize: uiStyle.textFontSize,
            fontWeight: uiStyle.textFontWeight,
            cursor: "pointer",
            marginLeft: -20,
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: uiStyle.errorMarginTop,
            padding: uiStyle.errorPadding,
            borderRadius: uiStyle.errorBorderRadius,
            border: "1px solid rgba(255,0,0,0.4)",
          }}
        >
          <b style={{ color: "crimson" }}>Error:</b> {error}
        </div>
      )}

      {!data && !error && <div style={{ marginTop: uiStyle.loadingMarginTop }}>Loading…</div>}

      {data && (
        <div
          style={{
            marginTop: tableStyle.wrapperMarginTop,
            borderRadius: tableStyle.wrapperBorderRadius,
            overflow: "hidden",
            border: tableStyle.wrapperBorder,
            background: tableStyle.wrapperBackground,
            width: tableStyle.wrapperWidth,
            maxWidth: tableStyle.wrapperMaxWidth,
          }}
        >
          <table
            style={{
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <thead>
              <tr style={{ background: tableStyle.headerBackground }}>
                <th
                  style={{
                    padding: tableStyle.headerPadding,
                    textAlign: "center",
                    fontSize: tableStyle.fontSize,
                    fontWeight: tableStyle.fontWeight,
                    borderBottom: tableStyle.headerBorderBottom,
                    width: tableStyle.columnWidth,
                  }}
                >
                  Time
                </th>

                {data.days.map((d) => (
                  <th
                    key={d.date}
                    style={{
                      padding: tableStyle.headerPadding,
                      textAlign: "center",
                      fontSize: tableStyle.fontSize,
                      fontWeight: tableStyle.fontWeight,
                      borderBottom: tableStyle.headerBorderBottom,
                      whiteSpace: "nowrap",
                      width: tableStyle.columnWidth,
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
                      padding: tableStyle.timeCellPadding,
                      borderBottom: tableStyle.borderBottom,
                      background: tableStyle.timeColumnBackground,
                      fontVariantNumeric: "tabular-nums",
                      fontSize: tableStyle.fontSize,
                      fontWeight: tableStyle.fontWeight,
                      textAlign: "center",
                      width: tableStyle.columnWidth,
                    }}
                  >
                    {t}
                  </td>

                  {data.days.map((d, di) => {
                    const count = data.counts?.[ti]?.[di] ?? 0;
                    const isHovered = hover?.ti === ti && hover?.di === di;
                    const displayCount = count > 10 ? "10+" : count;

                    return (
                      <td
                        key={`${t}_${d.date}`}
                        onMouseEnter={() => setHover({ ti, di })}
                        onMouseLeave={() => setHover(null)}
                        style={{
                          ...cellStyle(count, isHovered),
                          padding: tableStyle.cellPadding,
                          borderBottom: tableStyle.borderBottom,
                          textAlign: "center",
                          verticalAlign: "middle",
                          cursor: "default",
                          fontSize: tableStyle.fontSize,
                          fontWeight: tableStyle.fontWeight,
                          width: tableStyle.columnWidth,
                        }}
                      >
                        {count === 0 ? (
                          <div style={{ opacity: 0.75, fontWeight: tableStyle.numberFontWeight }}>–</div>
                        ) : (
                          <div
                            style={{
                              fontSize: tableStyle.numberFontSize,
                              fontWeight: tableStyle.numberFontWeight,
                              color: "rgba(0, 187, 99, 1)",
                            }}
                          >
                            {displayCount}
                          </div>
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

      <div
        style={{
          marginTop: uiStyle.selectedVenuesMarginTop,
          marginLeft: uiStyle.selectedVenuesMarginLeft,
          textAlign: "left",
          fontSize: uiStyle.textFontSize,
        }}
      >
        <b>Selected venues:</b> {selectedVenues.length ? selectedVenues.map((v) => v.label).join(", ") : "None"}
      </div>
    </div>
  );
}