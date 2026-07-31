export interface TrailerCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

export interface TrailerBuild {
  id: number;
  trailerTypeId: number;
  name: string;
  description: string;
  imageUrl?: string | null;
  basePrice: number;
  sortOrder: number;
}

export interface FeatureOption {
  id: number;
  featureGroupId: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  price: number;
  isIncluded: boolean;
  sortOrder: number;
}

export interface FeatureGroupWithOptions {
  id: number;
  trailerTypeId: number;
  name: string;
  description?: string | null;
  selectionType: "single" | "multiple";
  sortOrder: number;
  options: FeatureOption[];
}

export const TRAILER_CATEGORIES: TrailerCategory[] = [
  { id: 1, name: "Car Hauler", slug: "car-hauler", description: "Heavy-duty custom car haulers engineered for transporting all vehicle sizes securely.", sortOrder: 1 },
  { id: 2, name: "Enclosed Cargo", slug: "enclosed-cargo", description: "Fully weatherproof enclosed trailers built for maximum security and equipment transport.", sortOrder: 2 },
  { id: 3, name: "Flatbed Workhorse", slug: "flatbed", description: "Open flatbed decks designed for heavy timber, machinery, and oversized loads.", sortOrder: 3 },
  { id: 4, name: "Tilt Trailer", slug: "tilt-trailer", description: "Hydraulic tilt decks for fast ramp-free equipment and low-clearance vehicle loading.", sortOrder: 4 },
  { id: 5, name: "Boat Trailer", slug: "boat-trailer", description: "Marine-grade galvanized alloy skid and roller setups for safe boat launching.", sortOrder: 5 },
  { id: 6, name: "Horse Float", slug: "horse-float", description: "Spacious straight-load & angle-load floats built for maximum equine comfort and safety.", sortOrder: 6 },
  { id: 7, name: "Plant & Excavator", slug: "plant-trailer", description: "Ultra heavy-duty reinforced chassis trailers built to move excavators & compact machinery.", sortOrder: 7 },
  { id: 8, name: "Tradesman Special", slug: "tradesman-trailer", description: "Lockable side toolboxes, ladder racks, and heavy payload capacity for serious tradies.", sortOrder: 8 },
  { id: 9, name: "Hydraulic Tipper", slug: "tipper-trailer", description: "Electric hydraulic ram tipper decks for effortless landscaping & bulk gravel unloading.", sortOrder: 9 },
  { id: 10, name: "Heavy Tag Trailer", slug: "tag-trailer", description: "Commercial-grade tri-axle tag trailers for extreme construction and machinery transport.", sortOrder: 10 },
];

export const TRAILER_BUILDS: TrailerBuild[] = [
  // Car Hauler (1)
  { id: 101, trailerTypeId: 1, name: "16ft Single Axle Build", description: "Compact & agile car hauler for light track cars & sports vehicles", imageUrl: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&q=80", basePrice: 4850, sortOrder: 1 },
  { id: 102, trailerTypeId: 1, name: "18ft Tandem Axle Workhorse", description: "Our most popular heavy-duty car transporter with dual electric brakes", imageUrl: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80", basePrice: 7200, sortOrder: 2 },
  { id: 103, trailerTypeId: 1, name: "20ft Tandem Axle Pro-Spec", description: "Full-size deck designed for full-size SUVs, 4WDs and commercial utilities", imageUrl: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80", basePrice: 8900, sortOrder: 3 },
  { id: 104, trailerTypeId: 1, name: "24ft Gooseneck Heavy Rig", description: "Maximum stability gooseneck setup for dual vehicle or heavy track transport", imageUrl: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80", basePrice: 12900, sortOrder: 4 },

  // Enclosed Cargo (2)
  { id: 201, trailerTypeId: 2, name: "10ft Single Axle Box", description: "Compact enclosed van for tools, sound gear, or mobile workshop", imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80", basePrice: 6200, sortOrder: 1 },
  { id: 202, trailerTypeId: 2, name: "14ft Tandem Cargo Box", description: "Medium tandem box with side door access and rear ramp door", imageUrl: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800&q=80", basePrice: 8800, sortOrder: 2 },
  { id: 203, trailerTypeId: 2, name: "18ft Heavy Cargo Hauler", description: "Large enclosed cargo trailer for full payload protection", imageUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&q=80", basePrice: 12100, sortOrder: 3 },

  // Flatbed (3)
  { id: 301, trailerTypeId: 3, name: "12ft Flatdeck Utility", description: "Light utility flatbed with removable drop sides", imageUrl: "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80", basePrice: 3650, sortOrder: 1 },
  { id: 302, trailerTypeId: 3, name: "16ft Tandem Flatbed", description: "Standard flatbed for timber, pallets, and site gear", imageUrl: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80", basePrice: 6100, sortOrder: 2 },
  { id: 303, trailerTypeId: 3, name: "20ft Heavy Commercial Flatbed", description: "Extra wide flatbed with under-deck ramp storage", imageUrl: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800&q=80", basePrice: 8400, sortOrder: 3 },

  // Tilt Trailer (4)
  { id: 401, trailerTypeId: 4, name: "14ft Hydraulic Tilt Deck", description: "Single ram tilt deck for scissor lifts and lowered vehicles", imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80", basePrice: 7550, sortOrder: 1 },
  { id: 402, trailerTypeId: 4, name: "18ft Dual Ram Tandem Tilt", description: "Heavy-duty dual ram setup with remote wireless tilt valve", imageUrl: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&q=80", basePrice: 9950, sortOrder: 2 },

  // Boat Trailer (5)
  { id: 501, trailerTypeId: 5, name: "5.2m Alloy Skid Express", description: "Galvanized steel skid trailer for runabouts & tinny boats", imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80", basePrice: 5150, sortOrder: 1 },
  { id: 502, trailerTypeId: 5, name: "6.5m Tandem Roller Setup", description: "Multi-roller tandem trailer engineered for glass & alloy cabin boats", imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", basePrice: 8100, sortOrder: 2 },

  // Horse Float (6)
  { id: 601, trailerTypeId: 6, name: "2-Horse Straight Load Float", description: "Padded bays, front tack box, and non-slip rubber ramp", imageUrl: "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=800&q=80", basePrice: 13900, sortOrder: 1 },
  { id: 602, trailerTypeId: 6, name: "3-Horse Angle Load Deluxe", description: "Luxury angle load float with kitchen amenities and rug racks", imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&q=80", basePrice: 18500, sortOrder: 2 },

  // Plant & Excavator (7)
  { id: 701, trailerTypeId: 7, name: "10x5 Excavator Hauler", description: "Designed for 1.8T - 2.5T mini excavators with bucket rest", imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80", basePrice: 9400, sortOrder: 1 },
  { id: 702, trailerTypeId: 7, name: "14x6 Tandem Machinery Rig", description: "Rated for 3.5T GVM with heavy mesh spring-assisted loading ramps", imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800&q=80", basePrice: 13200, sortOrder: 2 },

  // Tradesman (8)
  { id: 801, trailerTypeId: 8, name: "8x5 Builder's Box Trailer", description: "Enclosed lockable canopy, ladder rack, and compressor slide", imageUrl: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&q=80", basePrice: 6500, sortOrder: 1 },
  { id: 802, trailerTypeId: 8, name: "10x6 Tradesman Tandem Canopy", description: "Dual side gullwing doors with heavy internal drawer systems", imageUrl: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&q=80", basePrice: 8900, sortOrder: 2 },

  // Tipper (9)
  { id: 901, trailerTypeId: 9, name: "8x5 Electric Hydraulic Tipper", description: "Deep 600mm sides with wireless remote hydraulic pump", imageUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800&q=80", basePrice: 10400, sortOrder: 1 },
  { id: 902, trailerTypeId: 9, name: "10x6 Tandem Heavy Duty Tipper", description: "Dual hydraulic rams for 3.5T bulk gravel & soil unloading", imageUrl: "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&q=80", basePrice: 14500, sortOrder: 2 },

  // Tag Trailer (10)
  { id: 1001, trailerTypeId: 10, name: "24ft Tri-Axle Commercial Tag", description: "Heavy commercial tag trailer with air brakes & hydraulic ramps", imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&q=80", basePrice: 17200, sortOrder: 1 },
  { id: 1002, trailerTypeId: 10, name: "28ft Heavy Payload Tag Rig", description: "Extreme duty chassis rated for heavy machinery transport", imageUrl: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800&q=80", basePrice: 20900, sortOrder: 2 },
];

export const FEATURE_GROUPS: FeatureGroupWithOptions[] = [
  {
    id: 1001,
    trailerTypeId: 1,
    name: "Deck Flooring Surface",
    description: "Choose the heavy-duty decking material for vehicle grip and rust prevention.",
    selectionType: "single",
    sortOrder: 1,
    options: [
      { id: 1, featureGroupId: 1001, name: "Standard 3mm Checker Plate Steel Deck", description: "Durable non-slip steel floor coated in anti-corrosion primer", imageUrl: "https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=500&q=80", price: 0, isIncluded: true, sortOrder: 1 },
      { id: 2, featureGroupId: 1001, name: "Aluminum Diamond Plate Upgrade", description: "Lightweight marine aluminum deck deck with polished diamond finish", imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&q=80", price: 480, isIncluded: false, sortOrder: 2 },
      { id: 3, featureGroupId: 1001, name: "Hardwood Timber Deck Insert", description: "Pressure-treated Australian hardwood timber for classic grip", imageUrl: "https://images.unsplash.com/photo-1546484475-7f7bd55792da?w=500&q=80", price: 390, isIncluded: false, sortOrder: 3 },
    ],
  },
  {
    id: 1002,
    trailerTypeId: 1,
    name: "Tie-Downs & Ramp Systems",
    description: "Secure your payload with heavy-duty anchors and effortless loading ramp options.",
    selectionType: "multiple",
    sortOrder: 2,
    options: [
      { id: 4, featureGroupId: 1002, name: "4x Standard Flush D-Ring Tie Downs", description: "Recessed flush mount tie down rings rated to 2,500kg", imageUrl: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80", price: 0, isIncluded: true, sortOrder: 1 },
      { id: 5, featureGroupId: 1002, name: "8x Heavy Duty Recessed D-Rings", description: "Forged steel 5.0T D-rings for multi-point vehicle tying", imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&q=80", price: 240, isIncluded: false, sortOrder: 2 },
      { id: 6, featureGroupId: 1002, name: "Full-Width Spring Assist Rear Ramp", description: "Heavy mesh ramp gate with dual counterbalanced helper springs", imageUrl: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=500&q=80", price: 720, isIncluded: false, sortOrder: 3 },
      { id: 7, featureGroupId: 1002, name: "Slide-Out Under-Deck Ramps (Pair)", description: "Lockable under-deck storage channels with lightweight alloy ramps", imageUrl: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&q=80", price: 540, isIncluded: false, sortOrder: 4 },
    ],
  },
  {
    id: 1003,
    trailerTypeId: 1,
    name: "Braking & Safety Control",
    description: "Advanced braking technology for highway towing control and load safety.",
    selectionType: "single",
    sortOrder: 3,
    options: [
      { id: 8, featureGroupId: 1003, name: "Electric Brakes (All Axles)", description: "4-wheel electric drum brakes with in-cab controller compatibility", imageUrl: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&q=80", price: 0, isIncluded: true, sortOrder: 1 },
      { id: 9, featureGroupId: 1003, name: "Hydraulic Surge Disc Brakes", description: "Self-contained hydraulic disc brake actuator system", imageUrl: "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=500&q=80", price: 790, isIncluded: false, sortOrder: 2 },
      { id: 10, featureGroupId: 1003, name: "Emergency Breakaway Safety Kit", description: "Automated emergency braking unit with built-in battery indicator", imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&q=80", price: 195, isIncluded: false, sortOrder: 3 },
    ],
  },
  {
    id: 1004,
    trailerTypeId: 1,
    name: "LED Lighting & Signal Package",
    description: "High-visibility lighting packages for night hauls and style.",
    selectionType: "multiple",
    sortOrder: 4,
    options: [
      { id: 11, featureGroupId: 1004, name: "Standard Waterproof LED Tail Lights", description: "IP67 sealed rear combination tail, brake and indicator lights", imageUrl: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=500&q=80", price: 0, isIncluded: true, sortOrder: 1 },
      { id: 12, featureGroupId: 1004, name: "Under-Frame Neon Pink/Cyan LED Strip", description: "Custom glow lighting along side rails with wireless controller", imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&q=80", price: 320, isIncluded: false, sortOrder: 2 },
      { id: 13, featureGroupId: 1004, name: "Side Clearance & Marker Lamp Kit", description: "Full perimeter amber & red LED marker lamps for wide loads", imageUrl: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=500&q=80", price: 145, isIncluded: false, sortOrder: 3 },
    ],
  },
  {
    id: 1005,
    trailerTypeId: 1,
    name: "Wheels & All-Terrain Tyres",
    description: "Heavy load-rated alloy wheels and commercial high-ply tyres.",
    selectionType: "single",
    sortOrder: 5,
    options: [
      { id: 14, featureGroupId: 1005, name: "Standard Black Steel Wheels", description: "Heavy-duty 15-inch steel rims with radial commercial tyres", imageUrl: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=500&q=80", price: 0, isIncluded: true, sortOrder: 1 },
      { id: 15, featureGroupId: 1005, name: "Pink/Black Sport Alloy Wheels", description: "Custom machined 16-inch alloy rims with high-speed rating", imageUrl: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=500&q=80", price: 680, isIncluded: false, sortOrder: 2 },
      { id: 16, featureGroupId: 1005, name: "Upgraded All-Terrain Load Range E Tyres", description: "10-ply rated all-terrain tyres for gravel roads and heavy loads", imageUrl: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=500&q=80", price: 420, isIncluded: false, sortOrder: 3 },
    ],
  },
  {
    id: 1006,
    trailerTypeId: 1,
    name: "Custom Trade Extras & Accessories",
    description: "Add-ons for gear storage, stone protection, and custom powdercoating.",
    selectionType: "multiple",
    sortOrder: 6,
    options: [
      { id: 17, featureGroupId: 1006, name: "Mounted Spare Wheel & Bracket", description: "Matching spare tyre mounted on drawbar for quick highway swaps", imageUrl: "https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=500&q=80", price: 165, isIncluded: false, sortOrder: 1 },
      { id: 18, featureGroupId: 1006, name: "Front Drawbar Aluminum Toolbox", description: "Lockable diamond plate box with gas struts and weather seal", imageUrl: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&q=80", price: 510, isIncluded: false, sortOrder: 2 },
      { id: 19, featureGroupId: 1006, name: "Heavy Duty Mesh Stoneguard", description: "Front-mounted angled mesh guard protecting towed vehicles from flying gravel", imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&q=80", price: 250, isIncluded: false, sortOrder: 3 },
      { id: 20, featureGroupId: 1006, name: "Hot Pink / Satin Black Powder Coat Finish", description: "Industrial electro-static powder coat finish in custom electric pink or dark satin", imageUrl: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=500&q=80", price: 380, isIncluded: false, sortOrder: 4 },
    ],
  },
];
