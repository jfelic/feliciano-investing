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
    }
  } catch (error) {
    errors.push(`Error parsing email: ${error}`);
  }

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

  // Zillow emails typically have property cards with links
  // Look for links that contain homedetails
  $('a[href*="homedetails"], a[href*="zillow.com"]').each((_, element) => {
    try {
      const $link = $(element);
      const url = $link.attr("href");
      if (!url || !url.includes("homedetails")) return;

      // Find the property card container (usually parent elements)
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
      const addressMatch = text.match(/\d+\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}/);
      if (!addressMatch) return;
      const address = parseAddress(addressMatch[0]);

      // Extract specs
      const specs = parseSpecs(text);

      // Extract listing ID
      const sourceId = extractListingId(url, source);

      // Extract agent (if available)
      const agentMatch = text.match(
        /(?:Assist|By:)\s*([^$\d\n]+?)(?:\s*\d|\s*$)/
      );
      const agent = agentMatch?.[1]?.trim();

      properties.push({
        ...address,
        source,
        sourceId,
        url,
        price,
        ...specs,
        images,
        agent,
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

      // Extract address
      const addressMatch = text.match(/\d+\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}/);
      if (!addressMatch) return;
      const address = parseAddress(addressMatch[0]);

      // Extract specs
      const specs = parseSpecs(text);

      // Extract builder (Redfin shows this for new construction)
      const builderMatch = text.match(/Builder:\s*([^\n$]+)/);
      const builder = builderMatch?.[1]?.trim();

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
        builder,
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

  // Realtor.com emails have similar structure to Redfin
  $('a[href*="realtor.com"], a[href*="move.com"]').each((_, element) => {
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
      const addressMatch = text.match(/\d+\s+[^,]+,\s*[^,]+,\s*[A-Z]{2}/);
      if (!addressMatch) return;
      const address = parseAddress(addressMatch[0]);

      // Extract specs
      const specs = parseSpecs(text);

      // Extract builder
      const builderMatch = text.match(/Builder:\s*([^\n$]+)/);
      const builder = builderMatch?.[1]?.trim();

      // Extract listing ID
      const sourceId = extractListingId(url, source);

      properties.push({
        ...address,
        source,
        sourceId,
        url,
        price,
        ...specs,
        builder,
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
