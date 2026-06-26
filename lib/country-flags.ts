// ESPN's tennis feed returns 3-letter country codes (FRA, ITA, ESP). The flag
// emoji uses two regional-indicator symbols built from the 2-letter ISO code, so we
// map 3 → 2 then to emoji. Anything we don't recognize falls back to the raw text.
// Note: ESPN uses a few codes that aren't IOC (SER not SRB, ROM not ROU, and MON
// for Monaco) — those map alongside the standard ones below.

const ISO3_TO_ISO2: Record<string, string> = {
  AFG: "AF", ALB: "AL", ALG: "DZ", AND: "AD", ANG: "AO", ARG: "AR", ARM: "AM",
  AUS: "AU", AUT: "AT", AZE: "AZ", BAH: "BS", BAR: "BB", BEL: "BE", BEN: "BJ",
  BIH: "BA", BLR: "BY", BOL: "BO", BOT: "BW", BRA: "BR", BRN: "BN", BUL: "BG",
  CAM: "KH", CAN: "CA", CHI: "CL", CHN: "CN", CIV: "CI", CMR: "CM", COD: "CD",
  COL: "CO", CRC: "CR", CRO: "HR", CUB: "CU", CYP: "CY", CZE: "CZ", DEN: "DK",
  DOM: "DO", ECU: "EC", EGY: "EG", ESA: "SV", ESP: "ES", EST: "EE", ETH: "ET",
  FIJ: "FJ", FIN: "FI", FRA: "FR", GAB: "GA", GAM: "GM", GBR: "GB", GEO: "GE",
  GER: "DE", GHA: "GH", GRE: "GR", GUA: "GT", HAI: "HT", HKG: "HK", HON: "HN",
  HUN: "HU", INA: "ID", IND: "IN", IRI: "IR", IRL: "IE", IRQ: "IQ", ISL: "IS",
  ISR: "IL", ITA: "IT", JAM: "JM", JOR: "JO", JPN: "JP", KAZ: "KZ", KEN: "KE",
  KGZ: "KG", KOR: "KR", KOS: "XK", KSA: "SA", KUW: "KW", LAO: "LA", LAT: "LV",
  LBA: "LY", LBN: "LB", LIE: "LI", LTU: "LT", LUX: "LU", MAD: "MG", MAR: "MA",
  MAS: "MY", MDA: "MD", MEX: "MX", MGL: "MN", MKD: "MK", MLT: "MT", MNE: "ME",
  MON: "MC", MOZ: "MZ", NCA: "NI", NED: "NL", NEP: "NP", NGR: "NG", NOR: "NO", NZL: "NZ",
  OMA: "OM", PAK: "PK", PAN: "PA", PAR: "PY", PER: "PE", PHI: "PH", POL: "PL",
  POR: "PT", PRK: "KP", PUR: "PR", QAT: "QA", ROM: "RO", ROU: "RO", RSA: "ZA", RUS: "RU",
  SEN: "SN", SER: "RS", SGP: "SG", SLO: "SI", SMR: "SM", SRB: "RS", SRI: "LK", SUI: "CH",
  SVK: "SK", SWE: "SE", SYR: "SY", TJK: "TJ", THA: "TH", TKM: "TM", TPE: "TW",
  TTO: "TT", TUN: "TN", TUR: "TR", UAE: "AE", UGA: "UG", UKR: "UA", URU: "UY",
  USA: "US", UZB: "UZ", VEN: "VE", VIE: "VN", ZAM: "ZM", ZIM: "ZW"
};

export function countryCodeToFlagEmoji(country: string | null | undefined): string | null {
  if (!country) return null;
  const upper = country.trim().toUpperCase();
  const iso2 = upper.length === 3 ? ISO3_TO_ISO2[upper] : upper.length === 2 ? upper : null;
  if (!iso2 || iso2.length !== 2) return null;
  const base = 0x1f1e6 - "A".charCodeAt(0);
  return String.fromCodePoint(base + iso2.charCodeAt(0), base + iso2.charCodeAt(1));
}
