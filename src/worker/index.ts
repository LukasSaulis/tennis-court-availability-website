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
  towerHamlets: boolean;
  courtNum: number;
  courtPrefix: string;
  courtTime: string;
};

const SCRAPE_CONCURRENCY = 1;
const SCRAPE_RETRIES = 2;
const LONDON_TIME_ZONE = "Europe/London";
const BETTER_RENDER_PROXY_PREFIX = "https://r.jina.ai/http://";
const BETTER_SLOTS_CACHE_TTL_MS = 2 * 60 * 1000;
const BETTER_FETCH_RETRIES = 3;
const BETTER_BASE_RETRY_DELAY_MS = 800;
const CLUBSPARK_GUEST_BOOKING_WINDOW_CACHE = new Map<string, number | null>();
const BETTER_SLOTS_CACHE = new Map<string, { expiresAt: number; slots: Slot[] }>();
const CLUBSPARK_GUEST_BOOKING_WINDOW_OVERRIDES: Record<string, number> = {
  oliver_tambo_recreation_ground: 3,
  parliament_hill_fields: 1,
  west_ham_park: 1,
};

const VENUES: Record<string, VenueConfig> = {
  st_johns_park: { id: "st_johns_park", path: "st-johns-park", towerHamlets: true, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  bethnal_green_gardens: { id: "bethnal_green_gardens", path: "bethnal-green-gardens", towerHamlets: true, courtNum: 4, courtPrefix: "Tennis court", courtTime: "1h" },
  poplar_recreation_ground: { id: "poplar_recreation_ground", path: "poplar-rec-ground", towerHamlets: true, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  ropemakers_fields: { id: "ropemakers_fields", path: "ropemakers-field", towerHamlets: true, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  king_edward_memorial_park: { id: "king_edward_memorial_park", path: "king-edward-memorial-park", towerHamlets: true, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  wapping_gardens: { id: "wapping_gardens", path: "wapping-gardens", towerHamlets: true, courtNum: 1, courtPrefix: "Court", courtTime: "1h" },
  victoria_park: { id: "victoria_park", path: "victoria-park", towerHamlets: true, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  alperton_sports_ground: { id: "alperton_sports_ground", path: "https://clubspark.lta.org.uk/AlpertonSportsGround/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 5, courtPrefix: "Court", courtTime: "1h" },
  altash_gardens: { id: "altash_gardens", path: "https://clubspark.lta.org.uk/altash-gardens/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  archbishops_park: { id: "archbishops_park", path: "https://clubspark.lta.org.uk/ArchbishopsParkLambethNorth/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  avondale_park: { id: "avondale_park", path: "https://clubspark.lta.org.uk/AvondalePark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  barkingside_recreation_ground: { id: "barkingside_recreation_ground", path: "https://clubspark.lta.org.uk/BarkingsideRec/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 1, courtPrefix: "Court", courtTime: "1h" },
  barley_lane_rec_ground: { id: "barley_lane_rec_ground", path: "https://clubspark.lta.org.uk/BarleyLaneRecGround/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  battersea_park: { id: "battersea_park", path: "https://clubspark.lta.org.uk/BatterseaParkTennisCourts/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 7, courtPrefix: "Court", courtTime: "1h" },
  belair_park: { id: "belair_park", path: "https://clubspark.lta.org.uk/BelairPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "30m" },
  blackheath_park: { id: "blackheath_park", path: "https://clubspark.lta.org.uk/BlackheathPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  bostall_gardens: { id: "bostall_gardens", path: "https://clubspark.lta.org.uk/bostallgardens/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  britannia_leisure_centre: { id: "britannia_leisure_centre", path: "https://bookings.better.org.uk/location/britannia-leisure-centre/tennis-court-outdoor/2026-03-31/by-time", towerHamlets: false, courtNum: 2, courtPrefix: "-", courtTime: "1h" },
  bruce_castle: { id: "bruce_castle", path: "https://clubspark.lta.org.uk/BruceCastlePark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  brunswick_park: { id: "brunswick_park", path: "https://clubspark.lta.org.uk/BrunswickPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "30m" },
  burgess_park: { id: "burgess_park", path: "https://clubspark.lta.org.uk/BurgessParkSouthwark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 6, courtPrefix: "Crt", courtTime: "30m" },
  canning_town_recreation_ground: { id: "canning_town_recreation_ground", path: "https://canning.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  central_park: { id: "central_park", path: "https://central.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  chapmans_green: { id: "chapmans_green", path: "https://clubspark.lta.org.uk/ChapmansGreen/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  chelmsford_square: { id: "chelmsford_square", path: "https://clubspark.lta.org.uk/ChelmsfordSquare/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  chestnuts_park: { id: "chestnuts_park", path: "https://clubspark.lta.org.uk/ChestnutsPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  clapham_common: { id: "clapham_common", path: "https://clubspark.lta.org.uk/ClaphamCommon/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 7, courtPrefix: "Court", courtTime: "1h" },
  clayhall_park: { id: "clayhall_park", path: "https://clubspark.lta.org.uk/ClayhallPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 6, courtPrefix: "Court", courtTime: "1h" },
  clissold_park: { id: "clissold_park", path: "https://clubspark.lta.org.uk/ClissoldParkHackney/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 7, courtPrefix: "Court", courtTime: "1h" },
  downhills_park: { id: "downhills_park", path: "https://clubspark.lta.org.uk/DownhillsParkTennisClub/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  down_lane_park: { id: "down_lane_park", path: "https://clubspark.lta.org.uk/DownLanePark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  dulwich_park: { id: "dulwich_park", path: "https://clubspark.lta.org.uk/DulwichPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "30m" },
  eel_brook_common: { id: "eel_brook_common", path: "https://clubspark.lta.org.uk/EelBrookCommon/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  elmhurst_gardens: { id: "elmhurst_gardens", path: "https://clubspark.lta.org.uk/ElmhurstGardens/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  eton_grove: { id: "eton_grove", path: "https://clubspark.lta.org.uk/EtonGrove/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  finsbury_park: { id: "finsbury_park", path: "https://clubspark.lta.org.uk/FinsburyPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 7, courtPrefix: "Court", courtTime: "1h" },
  geraldine_mary_harmsworth: { id: "geraldine_mary_harmsworth", path: "https://clubspark.lta.org.uk/GeraldineMaryHarmsworth/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "30m" },
  gladstone_park: { id: "gladstone_park", path: "https://clubspark.lta.org.uk/GladstoneParkTennis/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 7, courtPrefix: "Court", courtTime: "1h" },
  goodmayes_park: { id: "goodmayes_park", path: "https://clubspark.lta.org.uk/GoodmayesPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  gooseley_playing_fields: { id: "gooseley_playing_fields", path: "https://gooseley.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  hackney_downs_park: { id: "hackney_downs_park", path: "https://clubspark.lta.org.uk/HackneyDowns/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  harold_wood_park: { id: "harold_wood_park", path: "https://clubspark.lta.org.uk/HaroldWoodPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  harrow_lodge_park: { id: "harrow_lodge_park", path: "https://clubspark.lta.org.uk/harrow-lodge-park/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  hermit_road: { id: "hermit_road", path: "https://hermit.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  hillside_gardens_park: { id: "hillside_gardens_park", path: "https://clubspark.lta.org.uk/HillsideGardensPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  holland_park: { id: "holland_park", path: "https://clubspark.lta.org.uk/HollandPark2/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 6, courtPrefix: "Court", courtTime: "1h" },
  honor_oak_recreation_ground: { id: "honor_oak_recreation_ground", path: "https://clubspark.lta.org.uk/HonorOakRecreationGround/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "30m" },
  hurlingham_park: { id: "hurlingham_park", path: "https://clubspark.lta.org.uk/HurlinghamPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  islington_tennis_centre_indoors: { id: "islington_tennis_centre_indoors", path: "https://bookings.better.org.uk/location/islington-tennis-centre/tennis-court-indoor/2026-03-31/by-time", towerHamlets: false, courtNum: 6, courtPrefix: "-", courtTime: "1h" },
  islington_tennis_centre_outdoors: { id: "islington_tennis_centre_outdoors", path: "https://bookings.better.org.uk/location/islington-tennis-centre/tennis-court-outdoor/2026-03-31/by-time", towerHamlets: false, courtNum: 2, courtPrefix: "-", courtTime: "1h" },
  joe_white_gardens: { id: "joe_white_gardens", path: "https://clubspark.lta.org.uk/AskeGardens/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 1, courtPrefix: "Court", courtTime: "1h" },
  john_orwell_sports_centre: { id: "john_orwell_sports_centre", path: "https://towerhamletscouncil.gladstonego.cloud/book/calendar/JACT000030?activityDate=2026-03-31T00:00:00.000Z&previousActivityDate=2026-03-31T00:00:00.000Z", towerHamlets: false, courtNum: 1, courtPrefix: "-", courtTime: "1h" },
  kennington_park: { id: "kennington_park", path: "https://clubspark.lta.org.uk/KenningtonPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 5, courtPrefix: "Court", courtTime: "1h" },
  kensington_memorial_park: { id: "kensington_memorial_park", path: "https://clubspark.lta.org.uk/KensingtonMemorialPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  kidbrooke_green: { id: "kidbrooke_green", path: "https://clubspark.lta.org.uk/KidbrookeGreen/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  king_edward_vii_park: { id: "king_edward_vii_park", path: "https://clubspark.lta.org.uk/KingEdwardVIIPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  ladywell_fields: { id: "ladywell_fields", path: "https://clubspark.lta.org.uk/LadywellFields/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 5, courtPrefix: "Court", courtTime: "1h" },
  larkhall_park: { id: "larkhall_park", path: "https://clubspark.lta.org.uk/LarkhallPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  lee_valley_hockey_and_tennis_centre_indoors: { id: "lee_valley_hockey_and_tennis_centre_indoors", path: "https://bookings.better.org.uk/location/lee-valley-hockey-and-tennis-centre/tennis-court-indoor/2026-03-31/by-time", towerHamlets: false, courtNum: 3, courtPrefix: "-", courtTime: "1h" },
  lee_valley_hockey_and_tennis_centre_outdoors: { id: "lee_valley_hockey_and_tennis_centre_outdoors", path: "https://bookings.better.org.uk/location/lee-valley-hockey-and-tennis-centre/tennis-court-outdoor/2026-03-31/by-time", towerHamlets: false, courtNum: 6, courtPrefix: "-", courtTime: "1h" },
  linford_christie_sports_centre: { id: "linford_christie_sports_centre", path: "https://clubspark.lta.org.uk/LinfordChristieStadium/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  little_ilford_park: { id: "little_ilford_park", path: "https://littlellford.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  lodge_farm_park: { id: "lodge_farm_park", path: "https://clubspark.lta.org.uk/lodge-farm-park/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  london_fields_park: { id: "london_fields_park", path: "https://clubspark.lta.org.uk/LondonFieldsPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  loxford_park: { id: "loxford_park", path: "https://clubspark.lta.org.uk/Loxford/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 1, courtPrefix: "Resource", courtTime: "1h" },
  lyle_park: { id: "lyle_park", path: "https://lyle.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  manor_house_gardens: { id: "manor_house_gardens", path: "https://clubspark.lta.org.uk/ManorHouseGds/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  maryon_park: { id: "maryon_park", path: "https://clubspark.lta.org.uk/MaryonPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  mayow_park: { id: "mayow_park", path: "https://clubspark.lta.org.uk/MayowPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  millfields_park: { id: "millfields_park", path: "https://clubspark.lta.org.uk/MillfieldsParkMiddlesex/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  myatts_fields_park: { id: "myatts_fields_park", path: "https://clubspark.lta.org.uk/MyattsFieldsPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  new_river_leisure_centre_indoors: { id: "new_river_leisure_centre_indoors", path: "https://haringeyactivewellbeing.bookings.flow.onl/location/new-river-leisure-centre/indoor-tennis/2026-03-31/by-time", towerHamlets: false, courtNum: 4, courtPrefix: "-", courtTime: "1h" },
  new_river_leisure_centre_outdoors: { id: "new_river_leisure_centre_outdoors", path: "https://haringeyactivewellbeing.bookings.flow.onl/location/new-river-leisure-centre/outdoor-tennis/2026-03-31/by-time", towerHamlets: false, courtNum: 4, courtPrefix: "-", courtTime: "1h" },
  oliver_tambo_recreation_ground: { id: "oliver_tambo_recreation_ground", path: "https://clubspark.lta.org.uk/PavilionTennis/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 6, courtPrefix: "Court", courtTime: "1h" },
  parliament_hill_fields: { id: "parliament_hill_fields", path: "https://clubspark.lta.org.uk/ParliamentHillFieldsTennisCourts/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 7, courtPrefix: "Court", courtTime: "1h" },
  plashet_park: { id: "plashet_park", path: "https://plashet.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  plumstead_common: { id: "plumstead_common", path: "https://clubspark.lta.org.uk/PlumsteadCommon/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  preston_park: { id: "preston_park", path: "https://clubspark.lta.org.uk/PrestonPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 6, courtPrefix: "Court", courtTime: "1h" },
  priory_park: { id: "priory_park", path: "https://clubspark.lta.org.uk/PrioryPark2/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  raphael_park: { id: "raphael_park", path: "https://clubspark.lta.org.uk/RaphaelPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 7, courtPrefix: "Court", courtTime: "1h" },
  ray_park: { id: "ray_park", path: "https://clubspark.lta.org.uk/RayPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  roe_green_park: { id: "roe_green_park", path: "https://clubspark.lta.org.uk/RoeGreenPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  royal_victoria_gardens: { id: "royal_victoria_gardens", path: "https://royalvictoria.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  ruskin_park: { id: "ruskin_park", path: "https://clubspark.lta.org.uk/RuskinPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
  seven_kings_park: { id: "seven_kings_park", path: "https://clubspark.lta.org.uk/SevenKingsPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  south_park: { id: "south_park", path: "https://clubspark.lta.org.uk/SouthPark4/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  southwark_park: { id: "southwark_park", path: "https://clubspark.lta.org.uk/SouthwarkPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "30m" },
  spring_hill_recreation_ground: { id: "spring_hill_recreation_ground", path: "https://clubspark.lta.org.uk/SpringHillParkTennis/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 3, courtPrefix: "Court", courtTime: "1h" },
  stationers_park: { id: "stationers_park", path: "https://clubspark.lta.org.uk/StationersPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  stratford_park: { id: "stratford_park", path: "https://stratford.newhamparkstennis.org.uk/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 6, courtPrefix: "Court", courtTime: "1h" },
  streatham_vale_park: { id: "streatham_vale_park", path: "https://clubspark.lta.org.uk/StreathamValePark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  sydenham_wells_park: { id: "sydenham_wells_park", path: "https://clubspark.lta.org.uk/SydenhamWellPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  tanner_st_park: { id: "tanner_st_park", path: "https://clubspark.lta.org.uk/TannerStPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "30m" },
  vale_farm: { id: "vale_farm", path: "https://clubspark.lta.org.uk/ValeFarm/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  valentines_park: { id: "valentines_park", path: "https://clubspark.lta.org.uk/ValentinesPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  vauxhall_park: { id: "vauxhall_park", path: "https://clubspark.lta.org.uk/VauxhallPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 2, courtPrefix: "Court", courtTime: "1h" },
  west_ham_park: { id: "west_ham_park", path: "https://clubspark.lta.org.uk/WestHamPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 7, courtPrefix: "Court", courtTime: "1h" },
  woodcock_park: { id: "woodcock_park", path: "https://clubspark.lta.org.uk/WoodcockPark/Booking/BookByDate#?date=2026-03-31&role=guest", towerHamlets: false, courtNum: 4, courtPrefix: "Court", courtTime: "1h" },
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
      const venueId = normalizeVenueId(url.searchParams.get("venue") ?? "");
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
          .map((v) => normalizeVenueId(v))
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
              booking_url: buildVenueUrl(VENUES[result.venue], dateISO),
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
          .map((v) => normalizeVenueId(v))
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
                booking_url: buildVenueUrl(VENUES[result.venue], result.date),
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

function normalizeVenueId(raw: string): string {
  return raw.trim().toLowerCase().replace(/['’]/g, "");
}

function detectScraperType(venue: VenueConfig): "tower_hamlets" | "clubspark_lta" | "clubspark_newham" | "better_bookings" | "gladstone_calendar" | "unsupported" {
  if (venue.towerHamlets) return "tower_hamlets";
  const path = venue.path;
  if (path.includes("bookings.better.org.uk") || path.includes("bookings.flow.onl")) return "better_bookings";
  if (path.includes("gladstonego.cloud/book/calendar")) return "gladstone_calendar";
  if (path.includes("clubspark.lta.org.uk")) return "clubspark_lta";
  if (path.includes("newhamparkstennis.org.uk")) return "clubspark_newham";
  return "unsupported";
}

function buildBetterRenderedUrl(venueUrl: string): string {
  return `${BETTER_RENDER_PROXY_PREFIX}${venueUrl.replace(/^https?:\/\//i, "")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBetterRenderedMarkdown(renderedUrl: string): Promise<string> {
  let lastStatus: number | null = null;
  let lastBody = "";

  for (let attempt = 0; attempt <= BETTER_FETCH_RETRIES; attempt++) {
    const res = await fetch(renderedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/plain,text/markdown,text/html;q=0.8,*/*;q=0.5",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    lastStatus = res.status;
    const body = await res.text();
    lastBody = body;

    if (res.ok) {
      return body;
    }

    if (attempt === BETTER_FETCH_RETRIES) {
      break;
    }

    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const retryDelay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? Math.floor(retryAfterSeconds * 1000)
      : BETTER_BASE_RETRY_DELAY_MS * (attempt + 1);

    await sleep(retryDelay);
  }

  throw new Error(`Better rendered fetch failed: HTTP ${lastStatus ?? "unknown"}, body=${lastBody.slice(0, 200)}`);
}

function parseBetterMarkdownSlots(markdown: string): Slot[] {
  const slots: Slot[] = [];
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let pendingTime: string | null = null;

  const pushFromSpaces = (time: string, spaces: number): void => {
    if (!Number.isFinite(spaces) || spaces < 0) {
      return;
    }

    if (spaces === 0) {
      slots.push({
        time,
        court: "Space 1",
        status: "booked",
        price: null,
      });
      return;
    }

    for (let i = 1; i <= spaces; i++) {
      slots.push({
        time,
        court: `Space ${i}`,
        status: "available",
        price: null,
      });
    }
  };

  for (const line of lines) {
    // Only match standalone time rows (not times embedded in URLs like /slot/07:00-08:00/...)
    const timeMatch = line.match(/^\**\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\**$/);
    if (timeMatch) {
      // If we encounter a new time while another is still pending, keep the old one as unavailable.
      if (pendingTime !== null) {
        pushFromSpaces(pendingTime, 0);
      }
      pendingTime = timeMatch[1];
      continue;
    }

    if (pendingTime === null) {
      continue;
    }

    const spacesMatch = line.match(/^(\d+)\s+spaces?\s+available$/i);
    if (spacesMatch) {
      pushFromSpaces(pendingTime, Number(spacesMatch[1]));
      pendingTime = null;
      continue;
    }

    // Some Better pages use non-numeric wording for zero availability.
    if (/^fully booked$/i.test(line) || /^no spaces? available$/i.test(line)) {
      pushFromSpaces(pendingTime, 0);
      pendingTime = null;
      continue;
    }
  }

  // Keep trailing unmatched time rows visible as unavailable.
  if (pendingTime !== null) {
    pushFromSpaces(pendingTime, 0);
  }

  return slots.sort((a, b) => {
    const t = compareHHMM(a.time, b.time);
    if (t !== 0) return t;
    return a.court.localeCompare(b.court);
  });
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function mergeSlotPrices(left: number | null, right: number | null): number | null {
  if (left === null && right === null) {
    return null;
  }

  return (left ?? 0) + (right ?? 0);
}

type ClubSparkSession = {
  Category: number;
  StartTime: number;
  EndTime: number;
  Interval: number;
  Cost?: number;
  Capacity?: number;
  Restrictions?: string[] | null;
};

type ClubSparkDay = {
  Date: string;
  Sessions: ClubSparkSession[];
};

type ClubSparkResource = {
  Name: string;
  Days: ClubSparkDay[];
};

type ClubSparkResponse = {
  Resources: ClubSparkResource[];
};

function buildClubSparkApiUrl(venue: VenueConfig, dateISO: string): string {
  const path = venue.path;

  // clubspark.lta.org.uk/SomeSlug/Booking/... → slug = SomeSlug
  const ltaMatch = path.match(/clubspark\.lta\.org\.uk\/([^/]+)\//);
  if (ltaMatch) {
    return `https://clubspark.lta.org.uk/v0/VenueBooking/${ltaMatch[1]}/GetVenueSessions?startDate=${dateISO}&endDate=${dateISO}`;
  }

  // Newham sites use a host-derived booking key
  const newhamMatch = path.match(/https?:\/\/([^.]+)\.newhamparkstennis\.org\.uk\//);
  if (newhamMatch) {
    const sub = newhamMatch[1];
    const host = `${sub}.newhamparkstennis.org.uk`;
    const bookingKey = host.replace(/\./g, "_");
    return `https://${host}/v0/VenueBooking/${bookingKey}/GetVenueSessions?startDate=${dateISO}&endDate=${dateISO}`;
  }

  throw new Error(`Cannot build ClubSpark API URL for venue ${venue.id}`);
}

async function getClubSparkGuestAdvanceBookingDays(venue: VenueConfig): Promise<number | null> {
  const override = CLUBSPARK_GUEST_BOOKING_WINDOW_OVERRIDES[venue.id];
  if (override !== undefined) {
    return override;
  }

  if (CLUBSPARK_GUEST_BOOKING_WINDOW_CACHE.has(venue.id)) {
    return CLUBSPARK_GUEST_BOOKING_WINDOW_CACHE.get(venue.id) ?? null;
  }

  try {
    const res = await fetch(buildVenueUrl(venue, getTodayISOInLondon()), {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();
    const days = inferGuestAdvanceBookingDaysFromHtml(html);
    CLUBSPARK_GUEST_BOOKING_WINDOW_CACHE.set(venue.id, days);
    return days;
  } catch (error) {
    console.warn(`Could not infer guest booking window for ${venue.id}:`, error);
    CLUBSPARK_GUEST_BOOKING_WINDOW_CACHE.set(venue.id, null);
    return null;
  }
}

function inferGuestAdvanceBookingDaysFromHtml(html: string): number | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  const candidates: number[] = [];

  for (const match of text.matchAll(/current day\s*\+\s*(\d{1,2})/gi)) {
    candidates.push(Number(match[1]));
  }

  for (const match of text.matchAll(
    /(?:book|booking|reserve|reserved)[^.]{0,120}?(?:up to\s*)?(\d{1,2})\s*(day|days|week|weeks)\s+in\s+advance/gi
  )) {
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    candidates.push(unit.startsWith("week") ? Math.max(0, value * 7 - 1) : value);
  }

  if (candidates.length === 0) {
    return null;
  }

  return Math.min(...candidates);
}

function parseClubSparkResponse(data: ClubSparkResponse, courtPrefix: string, dateISO: string): Slot[] {
  const slots: Slot[] = [];
  const escapedPrefix = courtPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const todayISO = getTodayISOInLondon();
  const currentLondonMinutes = dateISO === todayISO ? getCurrentMinutesInLondon() : null;

  for (const resource of (data.Resources ?? [])) {
    const name: string = resource.Name ?? "";

    // Filter by court prefix (skip resources that don't match)
    if (courtPrefix !== "-" && !new RegExp(`^${escapedPrefix}\\s+\\d+`, "i").test(name)) {
      continue;
    }

    for (const day of (resource.Days ?? [])) {
      for (const session of (day.Sessions ?? [])) {
        // ClubSpark still returns some guest-greyed sessions as Category 0,
        // so also respect role restrictions and zero-capacity sessions.
        if (session.Category !== 0) continue;
        if ((session.Capacity ?? 1) <= 0) continue;
        if (Array.isArray(session.Restrictions) && session.Restrictions.length > 0) continue;

        const interval = session.Interval;
        if (!interval || interval <= 0) continue;

        // Generate one available slot per booking interval inside the open window
        for (let t = session.StartTime; t + interval <= session.EndTime; t += interval) {
          if (currentLondonMinutes !== null && t <= currentLondonMinutes) {
            continue;
          }

          slots.push({
            time: minutesToTime(t),
            court: name,
            status: "available",
            price: session.Cost ?? null,
          });
        }
      }
    }
  }

  return slots.sort((a, b) => {
    const t = compareHHMM(a.time, b.time);
    if (t !== 0) return t;
    return a.court.localeCompare(b.court);
  });
}

async function scrapeClubSparkVenue(venue: VenueConfig, dateISO: string): Promise<{
  venue: string;
  date: string;
  slots: Slot[];
}> {
  const guestAdvanceBookingDays = await getClubSparkGuestAdvanceBookingDays(venue);
  const daysAhead = daysBetweenISO(getTodayISOInLondon(), dateISO);

  if (guestAdvanceBookingDays !== null && daysAhead > guestAdvanceBookingDays) {
    return { venue: venue.id, date: dateISO, slots: [] };
  }

  const apiUrl = buildClubSparkApiUrl(venue, dateISO);

  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  });

  if (!res.ok) {
    throw new Error(`ClubSpark API failed for ${venue.id} on ${dateISO}: HTTP ${res.status}`);
  }

  const data = (await res.json()) as ClubSparkResponse;
  const slots = normalizeSlotsForVenue(venue, parseClubSparkResponse(data, venue.courtPrefix, dateISO));

  return { venue: venue.id, date: dateISO, slots };
}

async function scrapeBetterVenue(venue: VenueConfig, dateISO: string): Promise<{
  venue: string;
  date: string;
  slots: Slot[];
}> {
  const cacheKey = `${venue.id}|${dateISO}`;
  const cached = BETTER_SLOTS_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { venue: venue.id, date: dateISO, slots: cached.slots };
  }

  const venueUrl = buildVenueUrl(venue, dateISO);
  const renderedUrl = buildBetterRenderedUrl(venueUrl);

  try {
    const markdown = await fetchBetterRenderedMarkdown(renderedUrl);
    const slots = normalizeSlotsForVenue(venue, parseBetterMarkdownSlots(markdown));

    if (slots.length === 0) {
      throw new Error(`No Better slot rows parsed for ${venue.id} on ${dateISO}`);
    }

    BETTER_SLOTS_CACHE.set(cacheKey, {
      expiresAt: Date.now() + BETTER_SLOTS_CACHE_TTL_MS,
      slots,
    });

    return { venue: venue.id, date: dateISO, slots };
  } catch (error) {
    if (cached) {
      console.warn(`Using stale Better cache for ${venue.id} on ${dateISO}:`, error);
      return { venue: venue.id, date: dateISO, slots: cached.slots };
    }

    throw error;
  }
}

async function scrapeGladstoneCalendarVenue(venue: VenueConfig, dateISO: string): Promise<{
  venue: string;
  date: string;
  slots: Slot[];
}> {
  const venueUrl = buildVenueUrl(venue, dateISO);
  const renderedUrl = buildBetterRenderedUrl(venueUrl);
  const markdown = await fetchBetterRenderedMarkdown(renderedUrl);
  const slots = normalizeSlotsForVenue(venue, parseGladstoneMarkdownSlots(markdown));

  if (slots.length === 0) {
    throw new Error(`No Gladstone slot rows parsed for ${venue.id} on ${dateISO}`);
  }

  return { venue: venue.id, date: dateISO, slots };
}

async function scrapeVenueForDate(venue: VenueConfig, dateISO: string): Promise<{
  venue: string;
  date: string;
  slots: Slot[];
}> {
  const scraperType = detectScraperType(venue);

  if (scraperType === "clubspark_lta" || scraperType === "clubspark_newham") {
    return await scrapeClubSparkVenue(venue, dateISO);
  }

  if (scraperType === "better_bookings") {
    return await scrapeBetterVenue(venue, dateISO);
  }

  if (scraperType === "gladstone_calendar") {
    return await scrapeGladstoneCalendarVenue(venue, dateISO);
  }

  if (scraperType === "unsupported") {
    // Platform not yet implemented — return empty gracefully
    return { venue: venue.id, date: dateISO, slots: [] };
  }

  // Tower Hamlets HTML scraping
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
  const slots = normalizeSlotsForVenue(venue, parseSlotsFromHTML(html, venue.courtPrefix));

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
  if (venue.towerHamlets) {
    return `https://tennistowerhamlets.com/book/courts/${venue.path}/${dateISO}#book`;
  }
  // Non-Tower Hamlets paths are full URLs with a placeholder date (2026-03-31)
  return venue.path.replace("2026-03-31", dateISO);
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

function normalizeSlotsForVenue(venue: VenueConfig, slots: Slot[]): Slot[] {
  if (venue.courtTime !== "30m") {
    return slots;
  }

  const availableByCourt = new Map<string, Map<string, Slot>>();

  for (const slot of slots) {
    if (slot.status !== "available") continue;

    if (!availableByCourt.has(slot.court)) {
      availableByCourt.set(slot.court, new Map<string, Slot>());
    }

    availableByCourt.get(slot.court)!.set(slot.time, slot);
  }

  const normalized: Slot[] = [];

  for (const [court, timeMap] of availableByCourt.entries()) {
    const sortedTimes = [...timeMap.keys()].sort(compareHHMM);

    for (const time of sortedTimes) {
      const startMinutes = timeToMinutes(time);

      // Only allow hour-long starts on the hour: 09:00, 18:00, etc.
      if (startMinutes % 60 !== 0) continue;

      const current = timeMap.get(time);
      const next = timeMap.get(minutesToTime(startMinutes + 30));

      if (!current || !next) continue;

      normalized.push({
        time,
        court,
        status: "available",
        price: mergeSlotPrices(current.price, next.price),
      });
    }
  }

  return normalized.sort((a, b) => {
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

function getCurrentMinutesInLondon(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
}

function addDaysToISO(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function daysBetweenISO(startISO: string, endISO: string): number {
  const [startYear, startMonth, startDay] = startISO.split("-").map(Number);
  const [endYear, endMonth, endDay] = endISO.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((end - start) / 86400000);
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

function parseGladstoneMarkdownSlots(markdown: string): Slot[] {
  const slots: Slot[] = [];
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let currentTime: string | null = null;
  let currentCourt: string | null = null;
  let currentCardUnavailable = false;
  let currentSectionUnavailable = false;

  const flushCard = (): void => {
    if (!currentTime || !currentCourt) {
      return;
    }

    slots.push({
      time: currentTime,
      court: currentCourt,
      status: currentCardUnavailable ? "booked" : "available",
      price: null,
    });

    currentCourt = null;
    currentCardUnavailable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const timeHeader = line.match(/^##\s*(\d{2}:\d{2})$/);
    if (timeHeader) {
      flushCard();
      // Gladstone calendar sections appear one hour behind the actual slot window.
      // Example: section "## 20:00" corresponds to bookable window "21:00 - 22:00".
      currentTime = minutesToTime(timeToMinutes(timeHeader[1]) + 60);
      currentCardUnavailable = currentSectionUnavailable;
      currentSectionUnavailable = false;
      continue;
    }

    const courtHeader = line.match(/###\s+(.+)$/);
    if (courtHeader) {
      flushCard();
      currentCourt = courtHeader[1].trim();
      currentCardUnavailable = currentSectionUnavailable;
      continue;
    }

    if (/^this slot is unavailable$/i.test(line)) {
      currentSectionUnavailable = true;
      currentCardUnavailable = true;
    }
  }

  flushCard();

  return slots.sort((a, b) => {
    const t = compareHHMM(a.time, b.time);
    if (t !== 0) return t;
    return a.court.localeCompare(b.court);
  });
}