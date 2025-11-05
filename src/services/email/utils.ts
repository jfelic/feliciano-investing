/**
 * Parse an address string into components
 * Example: "1002 Pitty Pat Dr, Florence, SC" -> { street, city, state }
 */
export function parseAddress(address: string): {
  street: string;
  city: string;
  state: string;
} {
  const trimmed = address.trim();
  const parts = trimmed.split(",").map((p) => p.trim());

  if (parts.length < 3) {
    // Handle format: "Street, City State"
    if (parts.length === 2) {
      const [street, cityState] = parts as [string, string];
      const cityStateParts = cityState.trim().split(/\s+/);
      const state = cityStateParts.pop() || "";
      const city = cityStateParts.join(" ");
      return { street, city, state };
    }
    throw new Error(`Invalid address format: ${address}`);
  }

  const [street, city, state] = parts as [string, string, string];
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
 * Example: "3 bd | 2 ba | 1,075 sqft"
 */
export function parseSpecs(specsStr: string): {
  beds?: number;
  baths?: number;
  sqft?: number;
} {
  const result: { beds?: number; baths?: number; sqft?: number } = {};

  // Extract beds
  const bedsMatch = specsStr.match(/(\d+)\s*bd/);
  if (bedsMatch) {
    result.beds = parseInt(bedsMatch[1] ?? "0", 10);
  }

  // Extract baths (can be decimal like 2.5)
  const bathsMatch = specsStr.match(/([\d.]+)\s*ba/);
  if (bathsMatch) {
    result.baths = parseFloat(bathsMatch[1] ?? "0");
  }

  // Extract sqft
  const sqftMatch = specsStr.match(/([\d,]+)\s*sqft/);
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
 * Determine source from email address or URL
 */
export function determineSource(email: string, url?: string): string {
  const lowerEmail = email.toLowerCase();
  const lowerUrl = url?.toLowerCase() || "";

  if (lowerEmail.includes("zillow") || lowerUrl.includes("zillow")) {
    return "zillow";
  }
  if (lowerEmail.includes("redfin") || lowerUrl.includes("redfin")) {
    return "redfin";
  }
  if (
    lowerEmail.includes("realtor") ||
    lowerUrl.includes("realtor") ||
    lowerUrl.includes("move.com")
  ) {
    return "realtor";
  }
  if (lowerEmail.includes("land.com") || lowerUrl.includes("land.com")) {
    return "land";
  }

  return "unknown";
}
