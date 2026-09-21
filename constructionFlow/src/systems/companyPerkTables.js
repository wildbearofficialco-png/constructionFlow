// The progression ladders: home offices, regional offices and properties.
//
// Extracted from ConstructionFlowScreen.js in Phase 5 so that `companyPerks.js` and the screen
// read ONE copy. They were previously declared inside the screen, which is how four of the six
// office perks came to be advertised on a button and read by nothing — the data lived in one
// place and the consumers were supposed to remember it existed.
//
// Every perk key declared here must be resolved in `companyPerks.js` and consumed by the game.
// `companyPerks.test.js` walks these tables and fails if a key goes unclaimed, which is the
// guard that stops a perk becoming decorative again.

export const OFFICES = [
  {
    id: 0, name: "Shed & Trailer", cost: 0, crewCap: 4, equipCap: 2, dailyRent: 50,
    perks: [],
    desc: "One phone, one whiteboard, unlimited ambition.",
  },
  {
    id: 1, name: "Rented Portakabin", cost: 3500, crewCap: 8, equipCap: 4, dailyRent: 160,
    perks: [{ key: "bidBonus", value: 0.05, label: "+5% bid win chance" }],
    desc: "A proper on-site office. Clients trust you more.",
  },
  {
    id: 2, name: "Small Site Office", cost: 15000, crewCap: 16, equipCap: 8, dailyRent: 420,
    perks: [{ key: "penaltyReduction", value: 0.10, label: "−10% delay penalties" }],
    desc: "Room to grow and plan bigger projects.",
  },
  {
    id: 3, name: "Project Office", cost: 45000, crewCap: 30, equipCap: 18, dailyRent: 1100,
    perks: [
      { key: "materialDiscount", value: 0.08, label: "−8% material costs" },
      { key: "penaltyReduction", value: 0.15, label: "−15% delay penalties" },
    ],
    desc: "A full project management hub.",
  },
  {
    id: 4, name: "HQ Tower Suite", cost: 110000, crewCap: 80, equipCap: 50, dailyRent: 2800,
    perks: [
      { key: "bidBonus", value: 0.12, label: "+12% bid win chance" },
      { key: "materialDiscount", value: 0.15, label: "−15% material costs" },
    ],
    desc: "When you sign contracts, people stand up.",
  },
];

// `contractSlots` is how many EXTRA contracts this office puts on the board.
//
// These numbers were 3 / 8 / 18 / 35 / 80 and were read by nothing. Delivering "+80 contract
// slots" literally would put eighty contracts in front of the player — unreadable, and a
// save-size problem earlier phases already fought. The honest fix for a promise that large
// and that false is to make the promise smaller and true. These are now delivered exactly.
export const REGIONAL_OFFICE_TYPES = [
  {
    id: "small_office", name: "Small Office", cost: 25000, dailyRent: 150,
    crewBonus: 5, contractSlots: 1,
    desc: "Covers a local area. Room for a small team.",
  },
  {
    id: "regional_office", name: "Regional Office", cost: 80000, dailyRent: 450,
    crewBonus: 15, contractSlots: 2,
    desc: "Multi-site coordination hub.",
  },
  {
    id: "corporate_office", name: "Corporate Office", cost: 200000, dailyRent: 1200,
    crewBonus: 30, contractSlots: 3,
    desc: "Full corporate presence in the city.",
  },
  {
    id: "state_hq", name: "State HQ", cost: 500000, dailyRent: 3000,
    crewBonus: 60, contractSlots: 4,
    desc: "Dominant player in the state.",
  },
  {
    id: "national_hq", name: "National HQ", cost: 1500000, dailyRent: 9000,
    crewBonus: 150, contractSlots: 5,
    desc: "Commands national market presence.",
  },
];

// `crewCapBonus` is new. `getTotalCrewCap` used to compute a property bonus from
// `equipCapBonus` — an equipment figure — and then return without using it at all. Crew space
// and machine space are now separate fields, and both are actually applied.
export const PROPERTY_TYPES = [
  {
    id: "equipment_yard", name: "Equipment Yard", cost: 40000, dailyCost: 120,
    weeklyIncome: 400, resaleRate: 0.80,
    equipCapBonus: 5, crewCapBonus: 0, materialDiscount: 0, eliminatesRent: false,
    desc: "Stores 5 extra machines and cuts maintenance fees.",
  },
  {
    id: "storage_lot", name: "Storage Lot", cost: 25000, dailyCost: 75,
    weeklyIncome: 250, resaleRate: 0.80,
    equipCapBonus: 0, crewCapBonus: 0, materialDiscount: 0.05, eliminatesRent: false,
    desc: "Bulk material storage. 5% off material orders.",
  },
  {
    id: "material_warehouse", name: "Material Warehouse", cost: 75000, dailyCost: 200,
    weeklyIncome: 750, resaleRate: 0.80,
    equipCapBonus: 0, crewCapBonus: 0, materialDiscount: 0.15, eliminatesRent: false,
    desc: "Full warehouse. 15% off all material purchases.",
  },
  {
    id: "office_property", name: "Office Property", cost: 120000, dailyCost: 0,
    weeklyIncome: 600, resaleRate: 0.85,
    // Room for staff you own rather than rent space for, and no more office rent — which is
    // the whole reason this costs $120,000 and was previously worth nothing.
    equipCapBonus: 0, crewCapBonus: 10, materialDiscount: 0, eliminatesRent: true,
    desc: "Own instead of rent. Eliminates home office rent and houses 10 more crew.",
  },
];
