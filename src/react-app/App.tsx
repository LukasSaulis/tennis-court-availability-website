import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const REFRESH_OPTIONS = [
  { label: "5m", ms: 300000 },
  { label: "15m", ms: 900000 },
  { label: "30m", ms: 1800000 },
  { label: "1h", ms: 3600000 },
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

  controlHeight: 36,
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

type AvailabilitySlot = {
  time: string;
  date: string;
  count: number;
};

type GridResponse = {
  generated_at: string;
  days: Day[];
  slots: AvailabilitySlot[];
  venue_slots?: SlotDetail[];
};

type SlotDetail = {
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
  venues: SlotDetail[];
};

type HoverCell = { ti: number; di: number } | null;
type ActiveSlotDialog = { date: string; time: string; title: string } | null;

type IndoorsOption = "Yes" | "No";
type FloodlightsOption = "Yes" | "No";
type TravelDistanceBucket = "< 30m" | "30m - 45m" | "45m - 1h" | "1h+";
type TravelDifficultyOption = "Easy" | "Hard";
type TravelPriceBucket = "< 2" | "2 - 3" | "3 - 4" | "4+";
type FreeOption = "Yes" | "No";
type CourtQualityOption = "Great" | "Good" | "Bad" | "TBC";
type TowerHamletsOption = "Yes" | "No";


type Court = {
  id: string;
  label: string;
  indoors: boolean;
  floodlights: boolean;
  travelDistance: number;
  travelDifficulty: TravelDifficultyOption;
  travelPrice: number;
  free: boolean;
  courtQuality: CourtQualityOption;
  towerHamlets: boolean;
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

function formatSlotDialogTitle(dateISO: string, time: string) {
  const d = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return `${dateISO} @ ${time}`;
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${day} ${month} @ ${time}`;
}

function cellStyle(count: number, isHovered: boolean, hasStJohns: boolean) {
  const bgZero = "rgba(47, 35, 51, 1)";
  const bgZeroHovered = "rgba(65, 28, 32, 1)";
  const bgAvail = "rgba(16, 48, 56, 1)";
  const bgAvailHovered = "rgba(14, 59, 59, 1)";
  const bgAvailStJohns = "rgba(86, 52, 12, 1)";
  const bgAvailStJohnsHovered = "rgba(100, 61, 15, 1)";

  return {
    background: isHovered
      ? count > 0
        ? hasStJohns
          ? bgAvailStJohnsHovered
          : bgAvailHovered
        : bgZeroHovered
      : count > 0
        ? hasStJohns
          ? bgAvailStJohns
          : bgAvail
        : bgZero,
    transition: "background 120ms ease",
  } as const;
}

function matchesTravelDistance(bucket: TravelDistanceBucket, mins: number) {
  if (bucket === "< 30m") return mins < 30;
  if (bucket === "30m - 45m") return mins >= 30 && mins < 45;
  if (bucket === "45m - 1h") return mins >= 45 && mins < 60;
  return mins >= 60;
}

function matchesTravelPrice(bucket: TravelPriceBucket, price: number) {
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
  width = 140,
  showClear = false,
}: {
  title: string;
  options: Option[];
  selectedValues: string[];
  setSelectedValues: (values: string[]) => void;
  searchable?: boolean;
  width?: number;
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
    const selectedLabels = options.filter((o) => selectedValues.includes(o.value)).map((o) => o.label);

    if (selectedLabels.length <= 2) return selectedLabels.join(", ");
    return `${selectedLabels[0]}, ${selectedLabels[1]} + ${selectedLabels.length - 2} more`;
  }, [options, selectedValues]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <b>{title}:</b>
        <div
          onClick={() => setOpen((v) => !v)}
          style={{
            width,
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
            justifyContent: "flex-start",
            alignItems: "center",
            gap: 10,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              flex: 1,
              textAlign: "left",
            }}
          >
            {summary}
          </div>
          <div style={{ opacity: 0.8, flexShrink: 0, marginLeft: "auto" }}>▾</div>
        </div>
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: uiStyle.dropdownTop,
            left: 0,
            zIndex: 30,
            width: Math.max(width, 260),
            background: "rgba(15, 25, 45, 0.98)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
            boxSizing: "border-box",
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
                  minWidth: 0,
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
                  boxSizing: "border-box",
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
  { id: "bethnal_green_gardens", label: "Bethnal Green Gardens", indoors: false, floodlights: true, travelDistance: 35, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "Great", towerHamlets: true },
  { id: "king_edward_memorial_park", label: "King Edward Memorial Park", indoors: false, floodlights: false, travelDistance: 25, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "Great", towerHamlets: true },
  { id: "poplar_recreation_ground", label: "Poplar Recreation Ground", indoors: false, floodlights: false, travelDistance: 17, travelDifficulty: "Easy", travelPrice: 1.75, free: false, courtQuality: "Good", towerHamlets: true },
  { id: "ropemakers_fields", label: "Ropemakers Fields", indoors: false, floodlights: false, travelDistance: 19, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "Good", towerHamlets: true },
  { id: "st_johns_park", label: "St Johns Park", indoors: false, floodlights: true, travelDistance: 10, travelDifficulty: "Easy", travelPrice: 0.0, free: false, courtQuality: "Good", towerHamlets: true },
  { id: "victoria_park", label: "Victoria Park", indoors: false, floodlights: false, travelDistance: 48, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "Great", towerHamlets: true },
  { id: "wapping_gardens", label: "Wapping Gardens", indoors: false, floodlights: false, travelDistance: 31, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "Good", towerHamlets: true },
  { id: "alperton_sports_ground", label: "Alperton Sports Ground", indoors: false, floodlights: false, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 5.65, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "altash_gardens", label: "Altash Gardens", indoors: false, floodlights: false, travelDistance: 50, travelDifficulty: "Hard", travelPrice: 5.75, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "archbishops_park", label: "Archbishops Park", indoors: false, floodlights: false, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 3.1, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "avondale_park", label: "Avondale Park", indoors: false, floodlights: true, travelDistance: 55, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "barkingside_recreation_ground", label: "Barkingside Recreation Ground", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "barley_lane_rec_ground", label: "Barley Lane Rec Ground", indoors: false, floodlights: false, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "battersea_park", label: "Battersea Park", indoors: false, floodlights: true, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 4.85, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "belair_park", label: "Belair Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "blackheath_park", label: "Blackheath Park", indoors: false, floodlights: false, travelDistance: 35, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "bostall_gardens", label: "Bostall Gardens", indoors: false, floodlights: false, travelDistance: 45, travelDifficulty: "Easy", travelPrice: 3.2, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "britannia_leisure_centre", label: "Britannia Leisure Centre", indoors: false, floodlights: true, travelDistance: 45, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "bruce_castle", label: "Bruce Castle", indoors: false, floodlights: true, travelDistance: 75, travelDifficulty: "Easy", travelPrice: 7.0, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "brunswick_park", label: "Brunswick Park", indoors: false, floodlights: false, travelDistance: 55, travelDifficulty: "Hard", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "burgess_park", label: "Burgess Park", indoors: false, floodlights: true, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 4.65, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "canning_town_recreation_ground", label: "Canning Town Recreation Ground", indoors: false, floodlights: false, travelDistance: 30, travelDifficulty: "Easy", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "central_park", label: "Central Park", indoors: false, floodlights: false, travelDistance: 55, travelDifficulty: "Hard", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "chapmans_green", label: "Chapmans Green", indoors: false, floodlights: false, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 3.9, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "chelmsford_square", label: "Chelmsford Square", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "chestnuts_park", label: "Chestnuts Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 3.9, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "clapham_common", label: "Clapham Common", indoors: false, floodlights: true, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "clayhall_park", label: "Clayhall Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "clissold_park", label: "Clissold Park", indoors: false, floodlights: true, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "downhills_park", label: "Downhills Park", indoors: false, floodlights: false, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 3.9, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "down_lane_park", label: "Down Lane Park", indoors: false, floodlights: true, travelDistance: 45, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "dulwich_park", label: "Dulwich Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Hard", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "eel_brook_common", label: "Eel Brook Common", indoors: false, floodlights: false, travelDistance: 55, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "elmhurst_gardens", label: "Elmhurst Gardens", indoors: false, floodlights: false, travelDistance: 55, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "eton_grove", label: "Eton Grove", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 4.8, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "finsbury_park", label: "Finsbury Park", indoors: false, floodlights: true, travelDistance: 55, travelDifficulty: "Hard", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "geraldine_mary_harmsworth", label: "Geraldine Mary Harmsworth", indoors: false, floodlights: true, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 3.1, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "gladstone_park", label: "Gladstone Park", indoors: false, floodlights: true, travelDistance: 55, travelDifficulty: "Easy", travelPrice: 3.9, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "goodmayes_park", label: "Goodmayes Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "gooseley_playing_fields", label: "Gooseley Playing Fields", indoors: false, floodlights: false, travelDistance: 55, travelDifficulty: "Hard", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "hackney_downs_park", label: "Hackney Downs Park", indoors: false, floodlights: true, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "harold_wood_park", label: "Harold Wood Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.8, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "harrow_lodge_park", label: "Harrow Lodge Park", indoors: false, floodlights: false, travelDistance: 55, travelDifficulty: "Easy", travelPrice: 3.8, free: true, courtQuality: "Bad", towerHamlets: false },
  { id: "hermit_road", label: "Hermit Road", indoors: false, floodlights: false, travelDistance: 35, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "hillside_gardens_park", label: "Hillside Gardens Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "holland_park", label: "Holland Park", indoors: false, floodlights: true, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "honor_oak_recreation_ground", label: "Honor Oak Recreation Ground", indoors: false, floodlights: false, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "hurlingham_park", label: "Hurlingham Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "islington_tennis_centre_indoors", label: "Islington Tennis Centre (Indoors)", indoors: true, floodlights: true, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "islington_tennis_center_outdoors", label: "Islington Tennis Center (Outdoors)", indoors: false, floodlights: true, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "joe_white_gardens", label: "Joe White Gardens", indoors: false, floodlights: false, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 3.1, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "john_orwell_sports_centre", label: "John Orwell Sports Centre", indoors: false, floodlights: true, travelDistance: 30, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "Bad", towerHamlets: false },
  { id: "kennington_park", label: "Kennington Park", indoors: false, floodlights: true, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 3.1, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "kensington_memorial_park", label: "Kensington Memorial Park", indoors: false, floodlights: true, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 4.85, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "kidbrooke_green", label: "Kidbrooke Green", indoors: false, floodlights: false, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "king_edward_vii_park", label: "King Edward VII Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 4.8, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "ladywell_fields", label: "Ladywell Fields", indoors: false, floodlights: true, travelDistance: 35, travelDifficulty: "Easy", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "larkhall_park", label: "Larkhall Park", indoors: false, floodlights: true, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "lee_valley_hockey_and_tennis_centre_indoors", label: "Lee Valley Hockey and Tennis Centre (Indoors)", indoors: true, floodlights: true, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "lee_valley_hockey_and_tennis_centre_outdoors", label: "Lee Valley Hockey and Tennis Centre (Outdoors)", indoors: false, floodlights: true, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "linford_christie_sports_centre", label: "Linford Christie Sports Centre", indoors: false, floodlights: true, travelDistance: 70, travelDifficulty: "Easy", travelPrice: 3.6, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "little_ilford_park", label: "Little Ilford Park", indoors: false, floodlights: true, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.2, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "lodge_farm_park", label: "Lodge Farm Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.8, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "london_fields_park", label: "London Fields Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Hard", travelPrice: 1.75, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "loxford_park", label: "Loxford Park", indoors: false, floodlights: false, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "lyle_park", label: "Lyle Park", indoors: false, floodlights: true, travelDistance: 30, travelDifficulty: "Easy", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "manor_house_gardens", label: "Manor House Gardens", indoors: false, floodlights: false, travelDistance: 35, travelDifficulty: "Easy", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "maryon_park", label: "Maryon Park", indoors: false, floodlights: false, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "mayow_park", label: "Mayow Park", indoors: false, floodlights: false, travelDistance: 45, travelDifficulty: "Easy", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "millfields_park", label: "Millfields Park", indoors: false, floodlights: false, travelDistance: 55, travelDifficulty: "Hard", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "myatts_fields_park", label: "Myatts Fields Park", indoors: false, floodlights: false, travelDistance: 50, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "new_river_leisure_centre_indoors", label: "New River Leisure Centre (Indoors)", indoors: true, floodlights: true, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 3.9, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "new_river_leisure_centre_outdoors", label: "New River Leisure Centre (Outdoors)", indoors: false, floodlights: true, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 3.9, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "oliver_tambo_recreation_ground", label: "Oliver Tambo Recreation Ground", indoors: false, floodlights: true, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 7.7, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "parliament_hill_fields", label: "Parliament Hill Fields", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "plashet_park", label: "Plashet Park", indoors: false, floodlights: false, travelDistance: 45, travelDifficulty: "Easy", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "plumstead_common", label: "Plumstead Common", indoors: false, floodlights: false, travelDistance: 45, travelDifficulty: "Easy", travelPrice: 4.95, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "preston_park", label: "Preston Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 4.8, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "priory_park", label: "Priory Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 7.7, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "raphael_park", label: "Raphael Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Easy", travelPrice: 3.8, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "ray_park", label: "Ray Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "roe_green_park", label: "Roe Green Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Easy", travelPrice: 4.8, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "royal_victoria_gardens", label: "Royal Victoria Gardens", indoors: false, floodlights: false, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 2.5, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "ruskin_park", label: "Ruskin Park", indoors: false, floodlights: false, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 3, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "seven_kings_park", label: "Seven Kings Park", indoors: false, floodlights: false, travelDistance: 65, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "south_park", label: "South Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "southwark_park", label: "Southwark Park", indoors: false, floodlights: false, travelDistance: 25, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "spring_hill_recreation_ground", label: "Spring Hill Recreation Ground", indoors: false, floodlights: false, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "stationers_park", label: "Stationers Park", indoors: false, floodlights: false, travelDistance: 60, travelDifficulty: "Hard", travelPrice: 7.7, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "stratford_park", label: "Stratford Park", indoors: false, floodlights: true, travelDistance: 40, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "Good", towerHamlets: false },
  { id: "streatham_vale_park", label: "Streatham Vale Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 6.6, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "sydenham_wells_park", label: "Sydenham Wells Park", indoors: false, floodlights: false, travelDistance: 70, travelDifficulty: "Hard", travelPrice: 4.05, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "tanner_st_park", label: "Tanner St Park", indoors: false, floodlights: false, travelDistance: 35, travelDifficulty: "Easy", travelPrice: 3.1, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "vale_farm", label: "Vale Farm", indoors: false, floodlights: false, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 6.55, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "valentines_park", label: "Valentines Park", indoors: false, floodlights: false, travelDistance: 55, travelDifficulty: "Easy", travelPrice: 3.2, free: true, courtQuality: "TBC", towerHamlets: false },
  { id: "vauxhall_park", label: "Vauxhall Park", indoors: false, floodlights: false, travelDistance: 45, travelDifficulty: "Easy", travelPrice: 3.6, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "west_ham_park", label: "West Ham Park", indoors: false, floodlights: false, travelDistance: 45, travelDifficulty: "Easy", travelPrice: 2.3, free: false, courtQuality: "TBC", towerHamlets: false },
  { id: "woodcock_park", label: "Woodcock Park", indoors: false, floodlights: false, travelDistance: 80, travelDifficulty: "Hard", travelPrice: 6.55, free: true, courtQuality: "TBC", towerHamlets: false },
];

const indoorsOptions: Option[] = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

const floodlightsOptions: Option[] = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

const travelDistanceOptions: Option[] = [
  { value: "< 30m", label: "< 30m" },
  { value: "30m - 45m", label: "30m - 45m" },
  { value: "45m - 1h", label: "45m - 1h" },
  { value: "1h+", label: "1h+" },
];

const travelDifficultyOptions: Option[] = [
  { value: "Easy", label: "Easy" },
  { value: "Hard", label: "Hard" },
];

const travelPriceOptions: Option[] = [
  { value: "< 2", label: "< 2" },
  { value: "2 - 3", label: "2 - 3" },
  { value: "3 - 4", label: "3 - 4" },
  { value: "4+", label: "4+" },
];

const freeOptions: Option[] = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

const courtQualityOptions: Option[] = [
  { value: "Great", label: "Great" },
  { value: "Good", label: "Good" },
  { value: "Bad", label: "Bad" },
  { value: "TBC", label: "TBC" },
];

const towerHamletsOptions: Option[] = [
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

const defaultSelectedIndoors = indoorsOptions.map((o) => o.value);
const defaultSelectedFloodlights = floodlightsOptions.map((o) => o.value);
const defaultSelectedTravelDistances = travelDistanceOptions.map((o) => o.value);
const defaultSelectedTravelDifficulties = travelDifficultyOptions.map((o) => o.value);
const defaultSelectedTravelPrices = travelPriceOptions.map((o) => o.value);
const defaultSelectedFree = freeOptions.map((o) => o.value);
const defaultSelectedCourtQualities = courtQualityOptions.map((o) => o.value);
const defaultSelectedTowerHamlets = ["Yes"];

const SCRAPEABLE_VENUE_IDS = COURTS.map((court) => court.id);

function getDefaultMatchingVenueIds() {
  return ["st_johns_park"];
}

const INITIAL_SELECTED_VENUE_IDS = getDefaultMatchingVenueIds();

export default function App() {
  const [data, setData] = useState<GridResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverCell>(null);
  const [activeSlotDialog, setActiveSlotDialog] = useState<ActiveSlotDialog>(null);
  const [slotDetails, setSlotDetails] = useState<SlotDetail[]>([]);
  const [slotDetailsError, setSlotDetailsError] = useState<string | null>(null);
  const [slotDetailsLoading, setSlotDetailsLoading] = useState(false);
  const slotDetailsCache = useRef<Map<string, SlotDetail[]>>(new Map());

  const [selectedIndoors, setSelectedIndoors] = useState<string[]>(defaultSelectedIndoors);
  const [selectedFloodlights, setSelectedFloodlights] = useState<string[]>(defaultSelectedFloodlights);
  const [selectedTravelDistances, setSelectedTravelDistances] = useState<string[]>(defaultSelectedTravelDistances);
  const [selectedTravelDifficulties, setSelectedTravelDifficulties] = useState<string[]>(defaultSelectedTravelDifficulties);
  const [selectedTravelPrices, setSelectedTravelPrices] = useState<string[]>(defaultSelectedTravelPrices);
  const [selectedFree, setSelectedFree] = useState<string[]>(defaultSelectedFree);
  const [selectedCourtQualities, setSelectedCourtQualities] = useState<string[]>(defaultSelectedCourtQualities);
  const [selectedTowerHamlets, setSelectedTowerHamlets] = useState<string[]>(defaultSelectedTowerHamlets);
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>(INITIAL_SELECTED_VENUE_IDS);
  const [appliedVenueIds, setAppliedVenueIds] = useState<string[]>(INITIAL_SELECTED_VENUE_IDS);

  const [refreshMs, setRefreshMs] = useState<number>(900_000);
  const refreshTimerRef = useRef<number | null>(null);
  const hasFetchedInitiallyRef = useRef(false);

  const appliedScrapeableSelected = useMemo(
    () => SCRAPEABLE_VENUE_IDS.filter((id) => appliedVenueIds.includes(id)),
    [appliedVenueIds]
  );

  const fetchGrid = useCallback(async (venueIds: string[] = appliedVenueIds) => {
    const nextScrapeableSelected = SCRAPEABLE_VENUE_IDS.filter((id) => venueIds.includes(id));

    setAppliedVenueIds(venueIds);

    if (nextScrapeableSelected.length === 0) {
      setData(null);
      return;
    }
    try {
      setError(null);
      const res = await fetch(
        `/api/availability?venues=${nextScrapeableSelected.join(",")}&days=8`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as GridResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [appliedVenueIds]);

  useEffect(() => {
    if (hasFetchedInitiallyRef.current) {
      return;
    }

    hasFetchedInitiallyRef.current = true;
    void fetchGrid(INITIAL_SELECTED_VENUE_IDS);
  }, [fetchGrid]);

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
  }, [refreshMs, fetchGrid]);

  const updated = useMemo(() => {
    if (!data?.generated_at) return "—";
    return formatUpdatedLocal(data.generated_at);
  }, [data?.generated_at]);

  const courtById = useMemo(() => {
    return new Map(COURTS.map((court) => [court.id, court]));
  }, []);

  // Pre-populate slot details cache from the grid response so clicking any
  // available slot is instant — no extra API call needed.
  useEffect(() => {
    if (!data?.venue_slots) return;
    slotDetailsCache.current.clear();
    const grouped = new Map<string, SlotDetail[]>();
    for (const vs of data.venue_slots) {
      const key = `${appliedScrapeableSelected.join(",")}|${vs.date}|${vs.time}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(vs);
    }
    for (const [key, details] of grouped.entries()) {
      slotDetailsCache.current.set(
        key,
        details.sort((a, b) => {
          const left = courtById.get(a.venue_id)?.travelDistance ?? Infinity;
          const right = courtById.get(b.venue_id)?.travelDistance ?? Infinity;
          return left - right;
        })
      );
    }
  }, [data, appliedScrapeableSelected, courtById]);

  const courtsMatchingNonVenueFilters = useMemo(() => {
    return COURTS.filter((court) => {

      const indoorsValue: IndoorsOption = court.indoors ? "Yes" : "No";
      const indoorsMatches = selectedIndoors.length === 0 || selectedIndoors.includes(indoorsValue);

      const floodlightsValue: FloodlightsOption = court.floodlights ? "Yes" : "No";
      const floodlightsMatches = selectedFloodlights.length === 0 || selectedFloodlights.includes(floodlightsValue);
      
      const travelDistanceMatches =
        selectedTravelDistances.length === 0 ||
        selectedTravelDistances.length === travelDistanceOptions.length ||
        selectedTravelDistances.some((bucket) => matchesTravelDistance(bucket as TravelDistanceBucket, court.travelDistance));
      
      const travelDifficultyMatches = selectedTravelDifficulties.length === 0 || selectedTravelDifficulties.includes(court.travelDifficulty);
      
      const travelPriceMatches =
        selectedTravelPrices.length === 0 ||
        selectedTravelPrices.length === travelPriceOptions.length ||
        selectedTravelPrices.some((bucket) => matchesTravelPrice(bucket as TravelPriceBucket, court.travelPrice));
      
      const freeValue: FreeOption = court.free ? "Yes" : "No";
      const freeMatches = selectedFree.length === 0 || selectedFree.includes(freeValue);
      
      const courtQualityMatches = selectedCourtQualities.length === 0 || selectedCourtQualities.includes(court.courtQuality);
      
      const towerHamletsValue: TowerHamletsOption = court.towerHamlets ? "Yes" : "No";
      const towerHamletsMatches = selectedTowerHamlets.length === 0 || selectedTowerHamlets.includes(towerHamletsValue);
      
      return indoorsMatches && floodlightsMatches && travelDistanceMatches && travelDifficultyMatches && travelPriceMatches && freeMatches && courtQualityMatches && towerHamletsMatches;
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [selectedIndoors, selectedFloodlights, selectedTravelDistances, selectedTravelDifficulties, selectedTravelPrices, selectedFree, selectedCourtQualities, selectedTowerHamlets]);

  const venueOptions = useMemo<Option[]>(() => {
    return courtsMatchingNonVenueFilters.map((court) => ({
      value: court.id,
      label: court.label,
    }));
  }, [courtsMatchingNonVenueFilters]);

  useEffect(() => {
    const allIds = venueOptions.map((o) => o.value);
    const allIdsSet = new Set(allIds);

    setSelectedVenueIds((prev) => {
      const prevFiltered = prev.filter((id) => allIdsSet.has(id));

      if (prevFiltered.length > 0) {
        return prevFiltered;
      }

      if (allIdsSet.has("st_johns_park")) {
        return ["st_johns_park"];
      }

      if (allIds.length === 0) {
        return [];
      }

      return [allIds[0]];
    });
  }, [venueOptions]);

  const filteredCourts = useMemo(() => {
    if (selectedVenueIds.length === 0) return [];
    return courtsMatchingNonVenueFilters.filter((court) => selectedVenueIds.includes(court.id));
  }, [courtsMatchingNonVenueFilters, selectedVenueIds]);

  const openSlotDialog = useCallback(
    async (date: string, time: string, count: number) => {
      if (count <= 0 || appliedScrapeableSelected.length === 0) {
        return;
      }

      setActiveSlotDialog({ date, time, title: formatSlotDialogTitle(date, time) });
      setSlotDetailsError(null);

      const cacheKey = `${appliedScrapeableSelected.join(",")}|${date}|${time}`;
      const cached = slotDetailsCache.current.get(cacheKey);
      if (cached) {
        setSlotDetails(cached);
        setSlotDetailsLoading(false);
        return;
      }

      setSlotDetails([]);
      setSlotDetailsLoading(true);

      try {
        const res = await fetch(
          `/api/slot-details?venues=${appliedScrapeableSelected.join(",")}&date=${date}&time=${time}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const payload = (await res.json()) as SlotDetailsResponse;
        const sortedVenues = [...payload.venues].sort((a, b) => {
          const left = courtById.get(a.venue_id)?.travelDistance ?? Infinity;
          const right = courtById.get(b.venue_id)?.travelDistance ?? Infinity;
          return left - right;
        });

        slotDetailsCache.current.set(cacheKey, sortedVenues);
        setSlotDetails(sortedVenues);
      } catch (e) {
        setSlotDetailsError(e instanceof Error ? e.message : String(e));
      } finally {
        setSlotDetailsLoading(false);
      }
    },
    [appliedScrapeableSelected, courtById]
  );

  useEffect(() => {
    if (!activeSlotDialog) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveSlotDialog(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSlotDialog]);

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
            options={indoorsOptions}
            selectedValues={selectedIndoors}
            setSelectedValues={setSelectedIndoors}
            width={130}
          />

          <MultiSelectDropdown
            title="Floodlights"
            options={floodlightsOptions}
            selectedValues={selectedFloodlights}
            setSelectedValues={setSelectedFloodlights}
            width={130}
          />

          <MultiSelectDropdown
            title="Travel Distance"
            options={travelDistanceOptions}
            selectedValues={selectedTravelDistances}
            setSelectedValues={setSelectedTravelDistances}
            width={130}
          />

          <MultiSelectDropdown
            title="Travel Difficulty"
            options={travelDifficultyOptions}
            selectedValues={selectedTravelDifficulties}
            setSelectedValues={setSelectedTravelDifficulties}
            width={130}
          />

          <MultiSelectDropdown
            title="Travel Price (£)"
            options={travelPriceOptions}
            selectedValues={selectedTravelPrices}
            setSelectedValues={setSelectedTravelPrices}
            width={130}
          />

          <MultiSelectDropdown
            title="Free"
            options={freeOptions}
            selectedValues={selectedFree}
            setSelectedValues={setSelectedFree}
            width={130}
          />

          <MultiSelectDropdown
            title="Court Quality"
            options={courtQualityOptions}
            selectedValues={selectedCourtQualities}
            setSelectedValues={setSelectedCourtQualities}
            width={130}
          />

          <MultiSelectDropdown
            title="Tower Hamlets"
            options={towerHamletsOptions}
            selectedValues={selectedTowerHamlets}
            setSelectedValues={setSelectedTowerHamlets}
            width={130}
          />

          <MultiSelectDropdown
            title="Venues"
            options={venueOptions}
            selectedValues={selectedVenueIds}
            setSelectedValues={setSelectedVenueIds}
            searchable
            showClear
            width={460}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <b>Auto-refresh:</b>
            <select
              value={refreshMs}
              onChange={(e) => setRefreshMs(Number(e.target.value))}
              style={{
                width: 130,
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
                boxSizing: "border-box",
              }}
            >
              {REFRESH_OPTIONS.map((o) => (
                <option key={o.ms} value={o.ms} style={{ background: "#0b1220" }}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => void fetchGrid(selectedVenueIds)}
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
              boxSizing: "border-box",
            }}
          >
            Refresh
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <b>Last Refresh:</b> {updated}
          </div>

        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: uiStyle.errorMarginTop,
            padding: uiStyle.errorPadding,
            borderRadius: uiStyle.errorBorderRadius,
            border: "1px solid rgba(255,0,0,0.6)",
          }}
        >
          <b style={{ color: "red" }}>Error: {error}</b>
        </div>
      )}

      {!data && !error && <div style={{ marginTop: uiStyle.loadingMarginTop }}>Loading…</div>}

      {data && (() => {
        const slotMap = new Map<string, number>();
        for (const s of data.slots) slotMap.set(`${s.time}|${s.date}`, s.count);

        const stJohnsSlotSet = new Set<string>();
        for (const s of data.venue_slots ?? []) {
          if (s.venue_id === "st_johns_park" && s.count > 0) {
            stJohnsSlotSet.add(`${s.time}|${s.date}`);
          }
        }

        const times = [...new Set(data.slots.map((s) => s.time))].sort((a, b) => a.localeCompare(b));

        return (
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
            <table style={{ borderCollapse: "collapse", tableLayout: "fixed" }}>
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
                {times.map((t, ti) => (
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
                      const slotKey = `${t}|${d.date}`;
                      const count = slotMap.get(slotKey) ?? 0;
                      const hasStJohns = stJohnsSlotSet.has(slotKey);
                      const isHovered = hover?.ti === ti && hover?.di === di;
                      const displayCount = count > 9 ? "10+" : count;

                      return (
                        <td
                          key={`${t}_${d.date}`}
                          onMouseEnter={() => setHover({ ti, di })}
                          onMouseLeave={() => setHover(null)}
                          onClick={() => void openSlotDialog(d.date, t, count)}
                          style={{
                            ...cellStyle(count, isHovered, hasStJohns),
                            padding: tableStyle.cellPadding,
                            borderBottom: tableStyle.borderBottom,
                            textAlign: "center",
                            verticalAlign: "middle",
                            cursor: count > 0 ? "pointer" : "default",
                            fontSize: tableStyle.fontSize,
                            fontWeight: tableStyle.fontWeight,
                            width: tableStyle.columnWidth,
                          }}
                        >
                          {count > 0 ? (
                            <div
                              style={{
                                fontSize: tableStyle.numberFontSize,
                                fontWeight: tableStyle.numberFontWeight,
                                color: "rgba(0, 187, 99, 1)",
                              }}
                            >
                              {displayCount}
                            </div>
                          ) : (
                            <div style={{ opacity: 0.3, fontWeight: tableStyle.numberFontWeight }}>–</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {activeSlotDialog && (
        <div
          onClick={() => setActiveSlotDialog(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5, 10, 20, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 100,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              maxHeight: "80vh",
              overflowY: "auto",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(20, 31, 52, 0.98)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 18px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 600 }}>{activeSlotDialog.title}</div>
              <button
                onClick={() => setActiveSlotDialog(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(28, 40, 65, 1)",
                  color: "inherit",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  fontSize: 16,
                  marginTop: -5,
                }}
              >
                X
              </button>
            </div>

            <div style={{ padding: 18, display: "grid", gap: 12, fontSize: 16, fontWeight: 600 }}>
              {slotDetailsLoading && <div>Loading venue details…</div>}

              {!slotDetailsLoading && slotDetailsError && (
                <div style={{ color: "salmon", fontSize: 16, fontWeight: 600 }}>Error: Could not load slot details.</div>
              )}

              {!slotDetailsLoading && !slotDetailsError && slotDetails.length === 0 && (
                <div style={{ color: "salmon", fontSize: 16, fontWeight: 600 }}>No venue details available for this slot.</div>
              )}

              {!slotDetailsLoading && !slotDetailsError && slotDetails.map((detail) => {
                const court = courtById.get(detail.venue_id);
                const label = court ? `${court.label}` : detail.venue_id;

                return (
                  <div
                    key={`${detail.venue_id}_${detail.date}_${detail.time}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 16,
                      paddingBottom: 12,
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      fontSize: 16,
                      fontWeight: 600,
                    }}
                  >
                    <a
                      href={detail.booking_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: "rgba(0, 220, 255, 1)",
                        textDecoration: "none",
                      }}
                    >
                      {label}
                    </a>

                    <div
                      style={{
                        minWidth: 24,
                        textAlign: "right",
                        color: "rgba(0, 220, 140, 1)",
                        marginRight: 10,
                      }}
                    >
                      {detail.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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