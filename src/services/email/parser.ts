import * as cheerio from "cheerio";
import type { ParsedProperty, EmailParserResult } from "./types";
import {
  parseAddress,
  parsePrice,
  parseSpecs,
  parsePriceChange,
  extractListingId,
  determineSource,
} from "./utils";

/**
 * Parse a real estate alert email HTML and extract property listings
 */
export function parsePropertyEmail(
  htmlContent: string,
  fromEmail: string
): EmailParserResult {
  const $ = cheerio.load(htmlContent);
  const properties: ParsedProperty[] = [];
  const errors: string[] = [];

  // Determine the source
  const source = determineSource(fromEmail);
  console.log(`🔍 Parsing email from: ${fromEmail} (detected source: ${source})`);

  try {
    if (source === "zillow") {
      properties.push(...parseZillowEmail($, source));
    } else if (source === "redfin") {
      properties.push(...parseRedfinEmail($, source));
    } else if (source === "realtor") {
      properties.push(...parseRealtorEmail($, source));
    } else if (source === "land") {
      properties.push(...parseLandEmail($, source));
    } else {
      errors.push(`Unknown email source: ${fromEmail}`);
      console.log(`❌ Unknown source for email: ${fromEmail}`);
    }
  } catch (error) {
    errors.push(`Error parsing email: ${error}`);
    console.error(`❌ Error parsing email from ${fromEmail}:`, error);
  }

  console.log(`✅ Parsed ${properties.length} properties from ${source} email`);
  return { properties, errors };
}

/**
 * Parse Zillow email format
 */
function parseZillowEmail(
  $: cheerio.CheerioAPI,
  source: string
): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  const seenUrls = new Set<string>();

  // Zillow uses click-tracking URLs, so we need to look for ANY zillow.com link
  // and extract data from larger containers
  const links = $('a[href*="zillow.com"]');
  console.log(`  Found ${links.length} Zillow links in email`);

  $('a[href*="zillow.com"]').each((_, element) => {
    try {
      const $link = $(element);
      const url = $link.attr("href");
      if (!url) return;

      // Skip footer/settings links
      if (url.includes('unsubscribe') || url.includes('settings') || url.includes('_web_')) {
        return;
      }

      // Skip if we've already processed this URL
      if (seenUrls.has(url)) return;

      // Find a larger container - go up several levels
      const $card = $link.closest("table[role='presentation'], table").first();
      if (!$card.length) return;

      // Extract text content
      const text = $card.text();

      // Must have both price and address to be a property card
      const priceMatch = text.match(/\$[\d,]+/);
      const addressMatch = text.match(/\d+\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}(?:\s+\d{5})?/);

      if (!priceMatch || !addressMatch) {
        return;
      }

      seenUrls.add(url);
      console.log(`    ✓ Processing Zillow property from URL: ${url.substring(0, 80)}`);

      const price = parsePrice(priceMatch[0]);
      console.log(`    💰 Found price: ${priceMatch[0]}`);

      // Clean up address - remove common prefixes like sqft, bd/ba specs
      let cleanAddress = addressMatch[0]
        .replace(/^\d+\s*sqft\s*/i, '') // Remove leading sqft
        .replace(/^\d+\s*\n+/g, '') // Remove leading numbers with newlines
        .replace(/^\d+\s*bd.*?sqft\s*/is, '') // Remove bed/bath/sqft prefix with newlines
        .replace(/^.*?(\d+\s+[A-Za-z])/s, '$1') // Find first street number followed by letter
        .trim();

      console.log(`    📍 Raw address from email: "${cleanAddress}"`);
      const address = parseAddress(cleanAddress);

      // Extract image
      const images: string[] = [];
      const $img = $card.find("img").first();
      const imgSrc = $img.attr("src");
      if (imgSrc && !imgSrc.includes('spacer') && !imgSrc.includes('pixel')) {
        images.push(imgSrc);
      }

      // Extract specs
      const specs = parseSpecs(text);

      // For click-tracking URLs, use the full URL as sourceId
      const sourceId = url;

      properties.push({
        ...address,
        source,
        sourceId,
        url,
        price,
        ...specs,
        images,
      });
    } catch (error) {
      console.error("Error parsing Zillow property:", error);
    }
  });

  return properties;
}

/**
 * Parse Redfin email format
 */
function parseRedfinEmail(
  $: cheerio.CheerioAPI,
  source: string
): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  // Redfin emails have property cards with links
  const links = $('a[href*="redfin.com"]');
  console.log(`  Found ${links.length} Redfin links in email`);

  $('a[href*="redfin.com"]').each((_, element) => {
    try {
      const $link = $(element);
      const url = $link.attr("href");
      if (!url || !url.includes("/home/")) return;

      // Find the property card container
      const $card = $link.closest("table, div, td").first();

      // Extract image
      const images: string[] = [];
      const $img = $card.find("img").first();
      const imgSrc = $img.attr("src");
      if (imgSrc) images.push(imgSrc);

      // Extract text content
      const text = $card.text();

      // Extract price
      const priceMatch = text.match(/\$[\d,]+/);
      if (!priceMatch) return;
      const price = parsePrice(priceMatch[0]);

      // Check for price change
      const priceChangeMatch = text.match(/Price cut:\s*\$\d+K\s*\(\d+\/\d+\)/);
      let priceChange;
      if (priceChangeMatch) {
        priceChange = parsePriceChange(priceChangeMatch[0]) || undefined;
      }

      // Extract address - clean up any sqft prefix and newlines
      let addressMatch = text.match(/\d+\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}/);
      if (!addressMatch) return;

      // Clean up the address - remove sqft prefix if present
      let addressStr = addressMatch[0].replace(/^\d+\s*Sq\.\s*Ft\.\s*/i, "").trim();
      addressStr = addressStr.replace(/\n+/g, " ").replace(/\s+/g, " "); // Normalize whitespace and newlines

      const address = parseAddress(addressStr);

      // Extract specs
      const specs = parseSpecs(text);

      // Extract listing ID
      const sourceId = extractListingId(url, source);

      // Check for "New construction" status
      const isNewConstruction = text.toLowerCase().includes("new construction");

      properties.push({
        ...address,
        source,
        sourceId,
        url,
        price,
        priceChange,
        ...specs,
        images,
        status: isNewConstruction ? "New construction" : undefined,
      });
    } catch (error) {
      console.error("Error parsing Redfin property:", error);
    }
  });

  return properties;
}

/**
 * Parse Realtor.com email format
 */
function parseRealtorEmail(
  $: cheerio.CheerioAPI,
  source: string
): ParsedProperty[] {
  const properties: ParsedProperty[] = [];
  const seenUrls = new Set<string>();

  // Realtor.com emails split property data across multiple links
  // We need to find larger containers that have ALL the data
  const links = $('a[href*="realtor.com"], a[href*="move.com"]');
  console.log(`  Found ${links.length} Realtor links in email`);

  $('a[href*="realtor.com"], a[href*="move.com"]').each((_, element) => {
    try {
      const $link = $(element);
      const url = $link.attr("href");
      if (!url) return;

      // Skip footer/utility links
      if (url.includes('unsubscribe') || url.includes('privacy') || url.toLowerCase().includes('keep searching')) {
        return;
      }

      // Skip if we've already processed this URL
      if (seenUrls.has(url)) return;

      // Find the largest property card container
      // Realtor.com typically uses nested tables
      const $card = $link.closest("table[role='presentation'], table").first();
      if (!$card.length) return;

      // Extract text content from the entire card
      const text = $card.text();

      // Must have both price and address to be a property card
      const priceMatch = text.match(/\$[\d,]+/);
      const addressMatch = text.match(/\d+\s+[^,\n]+(?:,|\n)\s*[^,\n]+(?:,|\n)\s*[A-Z]{2}(?:\s+\d{5})?/);

      if (!priceMatch || !addressMatch) {
        return;
      }

      seenUrls.add(url);
      console.log(`    ✓ Processing Realtor property from URL: ${url.substring(0, 80)}`);

      const price = parsePrice(priceMatch[0]);
      console.log(`    💰 Found price: ${priceMatch[0]}`);

      // Clean up address - remove newlines and specs prefix
      let addressStr = addressMatch[0]
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^\d+\s*bed.*?sqft\s*/i, '') // Remove bed/bath/sqft prefix
        .replace(/^.*?(\d+\s+[A-Za-z])/s, '$1') // Find first street number followed by letter
        .trim();

      // Fix missing comma between street and city (e.g., "305 Sunridge DrSpartanburg" -> "305 Sunridge Dr, Spartanburg")
      // Look for pattern: Street abbreviation followed by capital letter (city name)
      addressStr = addressStr.replace(
        /\b(St|Ave|Rd|Dr|Ct|Ln|Blvd|Way|Pl|Cir|Ter|Pkwy|Trl)([A-Z][a-z]+)/,
        '$1, $2'
      );

      console.log(`    📍 Raw address from email: "${addressStr}"`);
      const address = parseAddress(addressStr);

      // Extract image
      const images: string[] = [];
      const $img = $card.find("img").first();
      const imgSrc = $img.attr("src");
      if (imgSrc && !imgSrc.includes('spacer') && !imgSrc.includes('pixel')) {
        images.push(imgSrc);
      }

      // Extract specs
      const specs = parseSpecs(text);

      // Extract listing ID (use full URL as sourceId for tracking links)
      const sourceId = url;

      properties.push({
        ...address,
        source,
        sourceId,
        url,
        price,
        ...specs,
        images,
      });
    } catch (error) {
      console.error("Error parsing Realtor.com property:", error);
    }
  });

  return properties;
}

/**
 * Parse Land.com email format
 */
function parseLandEmail(
  $: cheerio.CheerioAPI,
  source: string
): ParsedProperty[] {
  const properties: ParsedProperty[] = [];

  // Land.com emails - look for property listings
  $('a[href*="land.com"]').each((_, element) => {
    try {
      const $link = $(element);
      const url = $link.attr("href");
      if (!url) return;

      // Find the property card container
      const $card = $link.closest("table, div, td").first();

      // Extract image
      const images: string[] = [];
      const $img = $card.find("img").first();
      const imgSrc = $img.attr("src");
      if (imgSrc) images.push(imgSrc);

      // Extract text content
      const text = $card.text();

      // Extract price
      const priceMatch = text.match(/\$[\d,]+/);
      if (!priceMatch) return;
      const price = parsePrice(priceMatch[0]);

      // Extract address
      const addressMatch = text.match(/[^,]+,\s*[^,]+,\s*[A-Z]{2}/);
      if (!addressMatch) return;
      const address = parseAddress(addressMatch[0]);

      // Extract lot size (common for land)
      const lotSizeMatch = text.match(/([\d.]+)\s*acres?/i);
      const lotSize = lotSizeMatch ? parseFloat(lotSizeMatch[1] ?? "0") : undefined;

      // Extract listing ID
      const sourceId = extractListingId(url, source);

      properties.push({
        ...address,
        source,
        sourceId,
        url,
        price,
        lotSize,
        images,
        propertyType: "LAND",
      });
    } catch (error) {
      console.error("Error parsing Land.com property:", error);
    }
  });

  return properties;
}
