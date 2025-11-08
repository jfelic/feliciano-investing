/**
 * Parse an address string into components
 * Handles formats:
 * - "1002 Pitty Pat Dr, Florence, SC" -> { street, city, state }
 * - "8007 Broadmead Ct, Spartanburg, SC 29307" -> { street, city, state, zip }
 * - "181 E Lanford St, Spartanburg, SC" -> { street, city, state }
 */
export function parseAddress(address: string): {
  street: string;
  city: string;
  state: string;
  zip?: string;
} {
  const trimmed = address.trim();
  const parts = trimmed.split(",").map((p) => p.trim());

  if (parts.length < 2) {
    throw new Error(`Invalid address format: ${address}`);
  }

  if (parts.length === 2) {
    // Format: "Street, City State" or "Street, City State Zip"
    const [street, cityStateZip] = parts as [string, string];
    const cityStateZipParts = cityStateZip.trim().split(/\s+/);

    // Check if last part is a zip code (5 digits)
    const lastPart = cityStateZipParts[cityStateZipParts.length - 1] || "";
    const zipMatch = lastPart.match(/^\d{5}$/);

    if (zipMatch) {
      // Has zip code
      const zip = cityStateZipParts.pop();
      const state = cityStateZipParts.pop() || "";
      const city = cityStateZipParts.join(" ");
      console.log(`✅ Parsed address with zip: ${street}, ${city}, ${state} ${zip}`);
      return { street, city, state, zip };
    } else {
      // No zip code
      const state = cityStateZipParts.pop() || "";
      const city = cityStateZipParts.join(" ");
      return { street, city, state };
    }
  }

  // Format: "Street, City, State" or "Street, City, State Zip"
  const [street, city, stateZip] = parts as [string, string, string];
  const stateZipParts = stateZip.trim().split(/\s+/);

  // Check if there's a zip code
  if (stateZipParts.length > 1) {
    const zipMatch = stateZipParts[stateZipParts.length - 1]?.match(/^\d{5}$/);
    if (zipMatch) {
      const zip = stateZipParts.pop();
      const state = stateZipParts.join(" ");
      console.log(`✅ Parsed address with zip: ${street}, ${city}, ${state} ${zip}`);
      return { street, city, state, zip };
    }
  }

  const state = stateZipParts.join(" ");
  return { street, city, state };
}

/**
 * Parse price string to number
 * Example: "$120,000" -> 120000
 */
export function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[$,]/g, "");
  return parseFloat(cleaned);
}

/**
 * Parse property specs string
 * Example: "3 bd | 2 ba | 1,075 sqft" or "3 Beds | 2 Baths | 1,075 Sq. Ft."
 */
export function parseSpecs(specsStr: string): {
  beds?: number;
  baths?: number;
  sqft?: number;
} {
  const result: { beds?: number; baths?: number; sqft?: number } = {};

  // Extract beds (supports: bd, beds, bedroom)
  const bedsMatch = specsStr.match(/(\d+)\s*(?:bd|beds?|bedrooms?)/i);
  if (bedsMatch) {
    result.beds = parseInt(bedsMatch[1] ?? "0", 10);
  }

  // Extract baths (can be decimal like 2.5, supports: ba, baths, bathroom)
  const bathsMatch = specsStr.match(/([\d.]+)\s*(?:ba|baths?|bathrooms?)/i);
  if (bathsMatch) {
    result.baths = parseFloat(bathsMatch[1] ?? "0");
  }

  // Extract sqft (supports: sqft, sq. ft., sq ft)
  const sqftMatch = specsStr.match(/([\d,]+)\s*(?:sqft|sq\.?\s*ft\.?)/i);
  if (sqftMatch) {
    result.sqft = parseInt((sqftMatch[1] ?? "0").replace(/,/g, ""), 10);
  }

  return result;
}

/**
 * Parse price change info
 * Example: "Price cut: $2K (11/5)"
 */
export function parsePriceChange(priceChangeStr: string): {
  amount: number;
  date: Date;
} | null {
  const match = priceChangeStr.match(/\$(\d+)K\s*\((\d+)\/(\d+)\)/);
  if (!match) return null;

  const amount = parseInt(match[1] ?? "0", 10) * 1000;
  const month = parseInt(match[2] ?? "0", 10);
  const day = parseInt(match[3] ?? "0", 10);
  const year = new Date().getFullYear();

  return {
    amount,
    date: new Date(year, month - 1, day),
  };
}

/**
 * Extract listing ID from URL
 * Zillow: https://www.zillow.com/homedetails/...-address.../12345678_zpid/
 * Redfin: https://redfin.com/SC/Florence/1002-Pitty-Pat-Dr-29501/home/12345678
 * Realtor: https://www.realtor.com/realestateandhomes-detail/...M12345-67890
 */
export function extractListingId(url: string, source: string): string {
  if (source === "zillow") {
    const match = url.match(/\/(\d+)_zpid/);
    return match?.[1] ?? url;
  }

  if (source === "redfin") {
    const match = url.match(/\/home\/(\d+)/);
    return match?.[1] ?? url;
  }

  if (source === "realtor") {
    const match = url.match(/M(\d+-\d+)/);
    return match?.[1] ?? url;
  }

  if (source === "land") {
    const match = url.match(/\/(\d+)\/?$/);
    return match?.[1] ?? url;
  }

  // Fallback: use the full URL as ID
  return url;
}

/**
 * Normalize street address for comparison
 * Converts common abbreviations and standardizes format
 */
export function normalizeAddress(
  street: string,
  city: string,
  state: string
): string {
  let normalized = street.toLowerCase().trim();

  // Common street type abbreviations
  const abbreviations: Record<string, string> = {
    street: "st",
    avenue: "ave",
    road: "rd",
    drive: "dr",
    court: "ct",
    circle: "cir",
    boulevard: "blvd",
    lane: "ln",
    way: "way",
    place: "pl",
    terrace: "ter",
    parkway: "pkwy",
    highway: "hwy",
    trail: "trl",
    square: "sq",
  };

  // Replace full names with abbreviations
  for (const [full, abbr] of Object.entries(abbreviations)) {
    normalized = normalized.replace(
      new RegExp(`\\b${full}\\b`, "g"),
      abbr
    );
  }

  // Remove common prefixes/suffixes
  normalized = normalized
    .replace(/\b(north|south|east|west|n|s|e|w)\b\.?/g, "")
    .replace(/\b(unit|apt|#)\b\.?\s*[\w\d-]*/gi, "") // Remove unit numbers
    .replace(/[.,]/g, "") // Remove periods and commas
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();

  // Combine with city and state for full normalized address
  return `${normalized}|${city.toLowerCase().trim()}|${state.toLowerCase().trim()}`;
}

/**
 * Determine source from email address or URL
 */
export function determineSource(email: string, url?: string): string {
  const lowerEmail = email.toLowerCase();
  const lowerUrl = url?.toLowerCase() || "";

  // Check email domains and URLs
  if (
    lowerEmail.includes("zillow") ||
    lowerEmail.includes("mail.zillow") ||
    lowerUrl.includes("zillow")
  ) {
    return "zillow";
  }
  if (
    lowerEmail.includes("redfin") ||
    lowerUrl.includes("redfin")
  ) {
    return "redfin";
  }
  if (
    lowerEmail.includes("realtor") ||
    lowerEmail.includes("notifications.realtor") ||
    lowerUrl.includes("realtor") ||
    lowerUrl.includes("move.com")
  ) {
    return "realtor";
  }
  if (
    lowerEmail.includes("land.com") ||
    lowerEmail.includes("land") ||
    lowerUrl.includes("land.com")
  ) {
    return "land";
  }

  return "unknown";
}
