import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const REFRESH_OPTIONS = [
  { label: "Off", ms: 0 },
  { label: "5m", ms: 300000 },
  { label: "15m", ms: 900000 },
  { label: "30m", ms: 1800000 },
];

const uiStyle = {
  pagePadding: 0,
  pageMaxWidth: 2000,
  pageMargin: 0,

  controlsMarginTop: 20,
  controlsMarginLeft: 10,
  controlsGap: 20,
  controlsRowGap: 14,
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

  columnWidth: 140,
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

type IndoorOption = "Yes" | "No";
type FloodlightOption = "Yes" | "No";
type DistanceBucket = "< 30m" | "30m - 45m" | "45m - 1h" | "1h+";
type PriceBucket = "< 2" | "2 - 3" | "3 - 4" | "4+";

type Court = {
  id: string;
  label: string;
  indoor: boolean;
  floodlights: boolean;
  distanceMins: number;
  distanceLabel: string;
  difficulty: "Easy" | "Hard";
  travelPrice: number;
};

type Option = {
  value: string;
  label: string;
};

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

function matchesDistance(bucket: DistanceBucket, mins: number) {
  if (bucket === "< 30m") return mins < 30;
  if (bucket === "30m - 45m") return mins >= 30 && mins < 45;
  if (bucket === "45m - 1h") return mins >= 45 && mins < 60;
  return mins >= 60;
}

function matchesPrice(bucket: PriceBucket, price: number) {
  if (bucket === "< 2") return price < 2;
  if (bucket === "2 - 3") return price >= 2 && price < 3;
  if (bucket === "3 - 4") return price >= 3 && price < 4;
  return price >= 4;
}

function MultiSelectDropdown({
  title,
  options,
  selectedValues,
  setSelectedValues,
  searchable = false,
  minWidth = 140,
  showClear = false,
}: {
  title: string;
  options: Option[];
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
  searchable?: boolean;
  minWidth?: number;
  showClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    setSearch("");
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const summary = useMemo(() => {
    if (options.length > 0 && selectedValues.length === options.length) return "All";
    if (selectedValues.length === 0) return "None";
    const selectedLabels = options
      .filter((o) => selectedValues.includes(o.value))
      .map((o) => o.label);

    if (selectedLabels.length <= 2) return selectedLabels.join(", ");
    return `${selectedLabels[0]}, ${selectedLabels[1]} + ${selectedLabels.length - 2} more`;
  }, [options, selectedValues]);

  return (
    <div ref={ref} style={{ position: "relative", minWidth }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <b>{title}:</b>
        <div
          onClick={() => setOpen((v) => !v)}
          style={{
            minWidth,
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
          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{summary}</div>
          <div style={{ opacity: 0.8 }}>▾</div>
        </div>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: uiStyle.dropdownTop,
            left: 0,
            zIndex: 30,
            minWidth: Math.max(minWidth, 260),
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
              display: "flex",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {searchable ? (
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                style={{
                  flex: 1,
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
                }}
              />
            ) : (
              <div style={{ fontSize: uiStyle.labelFontSize, fontWeight: uiStyle.labelFontWeight }}>{title}</div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedValues(options.map((o) => o.value))}
                style={{
                  height: uiStyle.controlHeight,
                  padding: "0 10px",
                  borderRadius: uiStyle.controlBorderRadius,
                  border: uiStyle.controlBorder,
                  background: uiStyle.controlBackground,
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                All
              </button>

              {showClear && (
                <button
                  type="button"
                  onClick={() => setSelectedValues([])}
                  style={{
                    height: uiStyle.controlHeight,
                    padding: "0 10px",
                    borderRadius: uiStyle.controlBorderRadius,
                    border: uiStyle.controlBorder,
                    background: uiStyle.controlBackground,
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              maxHeight: uiStyle.dropdownMaxHeight,
              overflowY: "auto",
              padding: uiStyle.dropdownPadding,
            }}
          >
            {filteredOptions.map((o) => {
              const checked = selectedValues.includes(o.value);
              return (
                <label
                  key={o.value}
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
                      if (e.target.checked) {
                        setSelectedValues(Array.from(new Set([...selectedValues, o.value])));
                      } else {
                        setSelectedValues(selectedValues.filter((v) => v !== o.value));
                      }
                    }}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ opacity: 0.95 }}>{o.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const COURTS: Court[] = [
  { id: "battersea_park", label: "Battersea Park", indoor: false, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 4.85 },
  { id: "belair_park", label: "Belair Park", indoor: false, floodlights: false, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 3.95 },
  { id: "bethnal_green_gardens", label: "Bethnal Green Gardens", indoor: false, floodlights: true, distanceMins: 40, distanceLabel: "40 min", difficulty: "Easy", travelPrice: 1.75 },
  { id: "britannia_leisure_centre", label: "Britannia Leisure Centre", indoor: false, floodlights: false, distanceMins: 50, distanceLabel: "50 min", difficulty: "Hard", travelPrice: 4.85 },
  { id: "brockwell_park", label: "Brockwell Park", indoor: false, floodlights: false, distanceMins: 70, distanceLabel: "1h10", difficulty: "Hard", travelPrice: 4.85 },
  { id: "brunswick_park", label: "Brunswick Park", indoor: false, floodlights: false, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 3.95 },
  { id: "burgess_park", label: "Burgess Park", indoor: false, floodlights: true, distanceMins: 55, distanceLabel: "55 min", difficulty: "Hard", travelPrice: 4.85 },
  { id: "catford_bridge", label: "Catford Bridge", indoor: false, floodlights: false, distanceMins: 50, distanceLabel: "50 min", difficulty: "Hard", travelPrice: 3.0 },
  { id: "central_park", label: "Central Park", indoor: false, floodlights: false, distanceMins: 55, distanceLabel: "55 min", difficulty: "Easy", travelPrice: 1.75 },
  { id: "chinbrook_meadows", label: "Chinbrook Meadows", indoor: false, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 3.85 },
  { id: "clapham_common", label: "Clapham Common", indoor: false, floodlights: true, distanceMins: 45, distanceLabel: "45 min", difficulty: "Hard", travelPrice: 3.1 },
  { id: "clissold_park", label: "Clissold Park", indoor: false, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 4.85 },
  { id: "down_lane_park", label: "Down Lane Park", indoor: false, floodlights: true, distanceMins: 55, distanceLabel: "55 min", difficulty: "Hard", travelPrice: 3.95 },
  { id: "dulwich_park", label: "Dulwich Park", indoor: false, floodlights: false, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 3.95 },
  { id: "ealing_lawn_tennis_club", label: "Ealing Lawn Tennis Club (Indoors)", indoor: true, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Easy", travelPrice: 3.3 },
  { id: "finsbury_park", label: "Finsbury Park", indoor: false, floodlights: true, distanceMins: 55, distanceLabel: "55 min", difficulty: "Hard", travelPrice: 3.1 },
  { id: "geraldine_mary_harmsworth", label: "Geraldine Mary Harmsworth", indoor: false, floodlights: true, distanceMins: 40, distanceLabel: "40 min", difficulty: "Hard", travelPrice: 3.1 },
  { id: "gooseley_playing_fields", label: "Gooseley Playing Fields", indoor: false, floodlights: false, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 2.3 },
  { id: "hackney_downs", label: "Hackney Downs", indoor: false, floodlights: true, distanceMins: 65, distanceLabel: "1h5", difficulty: "Hard", travelPrice: 1.75 },
  { id: "haggerston_park", label: "Haggerston Park", indoor: false, floodlights: true, distanceMins: 40, distanceLabel: "40 min", difficulty: "Easy", travelPrice: 3.1 },
  { id: "hermit_road", label: "Hermit Road", indoor: false, floodlights: false, distanceMins: 40, distanceLabel: "40 min", difficulty: "Easy", travelPrice: 2.2 },
  { id: "highbury_fields", label: "Highbury Fields", indoor: false, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Easy", travelPrice: 3.0 },
  { id: "hillside_gardens_park", label: "Hillside Gardens Park", indoor: false, floodlights: false, distanceMins: 80, distanceLabel: "1h20", difficulty: "Hard", travelPrice: 3.95 },
  { id: "hilly_fields", label: "Hilly Fields", indoor: false, floodlights: true, distanceMins: 40, distanceLabel: "40 min", difficulty: "Easy", travelPrice: 2.2 },
  { id: "holland_park", label: "Holland Park", indoor: false, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Easy", travelPrice: 3.1 },
  { id: "honor_oak_recreation", label: "Honor Oak Recreation", indoor: false, floodlights: false, distanceMins: 50, distanceLabel: "50 min", difficulty: "Hard", travelPrice: 3.95 },
  { id: "hyde_park", label: "Hyde Park", indoor: false, floodlights: true, distanceMins: 55, distanceLabel: "55 min", difficulty: "Easy", travelPrice: 4.85 },
  { id: "islington_tennis_centre_indoors", label: "Islington Tennis Centre (Indoors)", indoor: true, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Easy", travelPrice: 3.1 },
  { id: "islington_tennis_centre_outdoors", label: "Islington Tennis Center (Outdoors)", indoor: false, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 3.1 },
  { id: "joe_white_gardens", label: "Joe White Gardens", indoor: false, floodlights: false, distanceMins: 40, distanceLabel: "40 min", difficulty: "Easy", travelPrice: 3.1 },
  { id: "john_orwell_sports_centre", label: "John Orwell Sports Centre", indoor: false, floodlights: true, distanceMins: 30, distanceLabel: "30 min", difficulty: "Easy", travelPrice: 2.2 },
  { id: "kennington_park", label: "Kennington Park", indoor: false, floodlights: true, distanceMins: 45, distanceLabel: "45 min", difficulty: "Easy", travelPrice: 3.1 },
  { id: "kensington_memorial_park", label: "Kensington Memorial Park", indoor: false, floodlights: false, distanceMins: 65, distanceLabel: "1h5", difficulty: "Hard", travelPrice: 4.85 },
  { id: "kilburn_grange_park", label: "Kilburn Grange Park", indoor: false, floodlights: false, distanceMins: 50, distanceLabel: "50 min", difficulty: "Easy", travelPrice: 3.1 },
  { id: "king_edward_memorial_park", label: "King Edward Memorial Park", indoor: false, floodlights: false, distanceMins: 25, distanceLabel: "25 min", difficulty: "Easy", travelPrice: 2.2 },
  { id: "ladywell_fields", label: "Ladywell Fields", indoor: false, floodlights: true, distanceMins: 40, distanceLabel: "40 min", difficulty: "Easy", travelPrice: 3.95 },
  { id: "larkhall_park", label: "Larkhall Park", indoor: false, floodlights: true, distanceMins: 50, distanceLabel: "50 min", difficulty: "Hard", travelPrice: 3.1 },
  { id: "lee_valley_hockey_tennis_centre", label: "Lee Valley Hockey and Tennis Centre (Indoors)", indoor: true, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 3.95 },
  { id: "lincolns_inn_fields", label: "Lincoln's Inn Fields", indoor: false, floodlights: false, distanceMins: 35, distanceLabel: "35 min", difficulty: "Easy", travelPrice: 3.1 },
  { id: "little_ilford_park", label: "Little Ilford Park", indoor: false, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 1.75 },
  { id: "london_fields", label: "London Fields", indoor: false, floodlights: false, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 1.75 },
  { id: "lyle_park", label: "Lyle Park", indoor: false, floodlights: true, distanceMins: 30, distanceLabel: "30 min", difficulty: "Easy", travelPrice: 2.3 },
  { id: "manor_house_gardens", label: "Manor House Gardens", indoor: false, floodlights: false, distanceMins: 35, distanceLabel: "35 min", difficulty: "Easy", travelPrice: 3.95 },
  { id: "mayow_park", label: "Mayow Park", indoor: false, floodlights: false, distanceMins: 55, distanceLabel: "55 min", difficulty: "Hard", travelPrice: 3.95 },
  { id: "millfields_park", label: "Millfields Park", indoor: false, floodlights: false, distanceMins: 65, distanceLabel: "1h5", difficulty: "Hard", travelPrice: 3.95 },
  { id: "new_river_sport_fitness", label: "New River Sport & Fitness (Indoors)", indoor: true, floodlights: true, distanceMins: 80, distanceLabel: "1h20", difficulty: "Hard", travelPrice: 3.95 },
  { id: "parliament_hill_fields", label: "Parliament Hill Fields", indoor: false, floodlights: false, distanceMins: 65, distanceLabel: "1h5", difficulty: "Hard", travelPrice: 4.85 },
  { id: "plashet_park", label: "Plashet Park", indoor: false, floodlights: false, distanceMins: 55, distanceLabel: "55 min", difficulty: "Hard", travelPrice: 1.75 },
  { id: "poplar_recreation_ground", label: "Poplar Recreation Ground", indoor: false, floodlights: false, distanceMins: 20, distanceLabel: "20 min", difficulty: "Easy", travelPrice: 1.75 },
  { id: "queens_park", label: "Queen's Park", indoor: false, floodlights: false, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 3.1 },
  { id: "ravenscourt_park", label: "Ravenscourt Park", indoor: false, floodlights: false, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 3.1 },
  { id: "ropemakers_fields", label: "Ropemakers Fields", indoor: false, floodlights: false, distanceMins: 20, distanceLabel: "20 min", difficulty: "Easy", travelPrice: 2.1 },
  { id: "rosemary_gardens", label: "Rosemary Gardens", indoor: false, floodlights: false, distanceMins: 50, distanceLabel: "50 min", difficulty: "Hard", travelPrice: 4.85 },
  { id: "royal_victoria_gardens", label: "Royal Victoria Gardens", indoor: false, floodlights: false, distanceMins: 40, distanceLabel: "40 min", difficulty: "Easy", travelPrice: 2.3 },
  { id: "ruskin_park", label: "Ruskin Park", indoor: false, floodlights: false, distanceMins: 45, distanceLabel: "45 min", difficulty: "Hard", travelPrice: 2.7 },
  { id: "southwark_park", label: "Southwark Park", indoor: false, floodlights: false, distanceMins: 30, distanceLabel: "30 min", difficulty: "Easy", travelPrice: 2.2 },
  { id: "spring_hill_park_tennis", label: "Spring Hill Park Tennis", indoor: false, floodlights: false, distanceMins: 80, distanceLabel: "1h20", difficulty: "Hard", travelPrice: 1.75 },
  { id: "st_johns_park", label: "St Johns Park", indoor: false, floodlights: true, distanceMins: 10, distanceLabel: "10 min", difficulty: "Easy", travelPrice: 0.0 },
  { id: "stratford_park", label: "Stratford Park", indoor: false, floodlights: true, distanceMins: 45, distanceLabel: "45 min", difficulty: "Easy", travelPrice: 2.2 },
  { id: "sydenham_wells_park", label: "Sydenham Wells Park", indoor: false, floodlights: false, distanceMins: 60, distanceLabel: "1h", difficulty: "Hard", travelPrice: 4.05 },
  { id: "tanner_street_park", label: "Tanner Street Park", indoor: false, floodlights: false, distanceMins: 35, distanceLabel: "35 min", difficulty: "Easy", travelPrice: 3.1 },
  { id: "telegraph_hill", label: "Telegraph Hill", indoor: false, floodlights: true, distanceMins: 45, distanceLabel: "45 min", difficulty: "Easy", travelPrice: 3.95 },
  { id: "tufnell_park", label: "Tufnell Park", indoor: false, floodlights: false, distanceMins: 50, distanceLabel: "50 min", difficulty: "Hard", travelPrice: 3.1 },
  { id: "vauxhall_park", label: "Vauxhall Park", indoor: false, floodlights: false, distanceMins: 50, distanceLabel: "50 min", difficulty: "Hard", travelPrice: 3.1 },
  { id: "victoria_park", label: "Victoria Park", indoor: false, floodlights: false, distanceMins: 50, distanceLabel: "50 min", difficulty: "Hard", travelPrice: 1.75 },
  { id: "wapping_gardens", label: "Wapping Gardens", indoor: false, floodlights: false, distanceMins: 30, distanceLabel: "30 min", difficulty: "Easy", travelPrice: 2.2 },
  { id: "waterlow_park", label: "Waterlow Park", indoor: false, floodlights: false, distanceMins: 65, distanceLabel: "1h5", difficulty: "Hard", travelPrice: 4.85 },
  { id: "westway_sports_fitness_centre", label: "Westway Sports & Fitness Centre (Indoors)", indoor: true, floodlights: true, distanceMins: 60, distanceLabel: "1h", difficulty: "Easy", travelPrice: 3.1 },
];

const indoorOptions: Option[] = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

const floodlightOptions: Option[] = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

const distanceOptions: Option[] = [
  { value: "< 30m", label: "< 30m" },
  { value: "30m - 45m", label: "30m - 45m" },
  { value: "45m - 1h", label: "45m - 1h" },
  { value: "1h+", label: "1h+" },
];

const difficultyOptions: Option[] = [
  { value: "Easy", label: "Easy" },
  { value: "Hard", label: "Hard" },
];

const priceOptions: Option[] = [
  { value: "< 2", label: "< 2" },
  { value: "2 - 3", label: "2 - 3" },
  { value: "3 - 4", label: "3 - 4" },
  { value: "4+", label: "4+" },
];

export default function App() {
  const [data, setData] = useState<GridResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverCell>(null);

  const [selectedIndoors, setSelectedIndoors] = useState<string[]>(indoorOptions.map((o) => o.value));
  const [selectedFloodlights, setSelectedFloodlights] = useState<string[]>(floodlightOptions.map((o) => o.value));
  const [selectedDistances, setSelectedDistances] = useState<string[]>(distanceOptions.map((o) => o.value));
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>(difficultyOptions.map((o) => o.value));
  const [selectedPrices, setSelectedPrices] = useState<string[]>(priceOptions.map((o) => o.value));

  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>(COURTS.map((c) => c.id));

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

  const courtsMatchingNonVenueFilters = useMemo(() => {
    return COURTS.filter((court) => {
      const indoorValue: IndoorOption = court.indoor ? "Yes" : "No";
      const floodlightValue: FloodlightOption = court.floodlights ? "Yes" : "No";

      const distanceMatches =
        selectedDistances.length === distanceOptions.length ||
        selectedDistances.some((bucket) => matchesDistance(bucket as DistanceBucket, court.distanceMins));

      const priceMatches =
        selectedPrices.length === priceOptions.length ||
        selectedPrices.some((bucket) => matchesPrice(bucket as PriceBucket, court.travelPrice));

      return (
        selectedIndoors.includes(indoorValue) &&
        selectedFloodlights.includes(floodlightValue) &&
        distanceMatches &&
        selectedDifficulties.includes(court.difficulty) &&
        priceMatches
      );
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedIndoors, selectedFloodlights, selectedDistances, selectedDifficulties, selectedPrices]);

  const venueOptions = useMemo<Option[]>(() => {
    return courtsMatchingNonVenueFilters.map((court) => ({
      value: court.id,
      label: court.label,
    }));
  }, [courtsMatchingNonVenueFilters]);

  useEffect(() => {
    const allowedIds = new Set(venueOptions.map((o) => o.value));
    setSelectedVenueIds((prev) => prev.filter((id) => allowedIds.has(id)));
  }, [venueOptions]);

  const filteredCourts = useMemo(() => {
    return courtsMatchingNonVenueFilters.filter((court) => selectedVenueIds.includes(court.id));
  }, [courtsMatchingNonVenueFilters, selectedVenueIds]);

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
          flexDirection: "column",
          gap: uiStyle.controlsRowGap,
          fontSize: uiStyle.controlsFontSize,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: uiStyle.controlsGap,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <MultiSelectDropdown
            title="Indoors"
            options={indoorOptions}
            selectedValues={selectedIndoors}
            setSelectedValues={setSelectedIndoors}
            minWidth={100}
          />

          <MultiSelectDropdown
            title="Floodlights"
            options={floodlightOptions}
            selectedValues={selectedFloodlights}
            setSelectedValues={setSelectedFloodlights}
            minWidth={100}
          />

          <MultiSelectDropdown
            title="Travel Distance"
            options={distanceOptions}
            selectedValues={selectedDistances}
            setSelectedValues={setSelectedDistances}
            minWidth={100}
          />

          <MultiSelectDropdown
            title="Travel Difficulty"
            options={difficultyOptions}
            selectedValues={selectedDifficulties}
            setSelectedValues={setSelectedDifficulties}
            minWidth={100}
          />

          <MultiSelectDropdown
            title="Travel Price (£)"
            options={priceOptions}
            selectedValues={selectedPrices}
            setSelectedValues={setSelectedPrices}
            minWidth={100}
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: uiStyle.controlsGap,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <MultiSelectDropdown
            title="Venues"
            options={venueOptions}
            selectedValues={selectedVenueIds}
            setSelectedValues={setSelectedVenueIds}
            searchable
            showClear
            minWidth={300}
          />

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
            }}
          >
            Refresh
          </button>
        </div>
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
        <b>Matching venues ({filteredCourts.length}):</b>{" "}
        {filteredCourts.length ? filteredCourts.map((court) => court.label).join(", ") : "None"}
      </div>
    </div>
  );
}