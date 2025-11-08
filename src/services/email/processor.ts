import { PrismaClient, Prisma } from "../../../generated/prisma";
import { fetchPropertyEmails, type ImapConfig } from "./fetcher";
import type { ParsedProperty } from "./types";
import { normalizeAddress } from "./utils";

const prisma = new PrismaClient();

/**
 * Process emails and save properties to database
 */
export async function processPropertyEmails(
  config: ImapConfig
): Promise<{ created: number; updated: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  try {
    // Fetch emails from inbox
    const properties = await fetchPropertyEmails(config);

    console.log(`Processing ${properties.length} properties...`);

    // Process each property
    for (const property of properties) {
      try {
        const result = await upsertProperty(property);
        if (result === "created") {
          created++;
        } else if (result === "updated") {
          updated++;
        }
      } catch (error) {
        errors.push(`Error processing property ${property.url}: ${error}`);
      }
    }

    console.log(
      `Processed ${properties.length} properties: ${created} created, ${updated} updated`
    );
  } catch (error) {
    errors.push(`Error fetching emails: ${error}`);
  }

  return { created, updated, errors };
}

/**
 * Upsert a property - create if new, update if exists
 * Checks both by source+sourceId AND by normalized address to prevent duplicates
 */
async function upsertProperty(
  property: ParsedProperty
): Promise<"created" | "updated"> {
  // Try to find existing property by source + sourceId
  let existing = await prisma.property.findUnique({
    where: {
      source_sourceId: {
        source: property.source,
        sourceId: property.sourceId,
      },
    },
  });

  // If not found by source+ID, check by normalized address
  if (!existing) {
    const normalized = normalizeAddress(
      property.street,
      property.city,
      property.state
    );

    const allProperties = await prisma.property.findMany({
      where: {
        city: { equals: property.city, mode: "insensitive" },
        state: { equals: property.state, mode: "insensitive" },
      },
    });

    // Check if any match the normalized address
    existing = allProperties.find((p) => {
      const existingNormalized = normalizeAddress(p.street, p.city, p.state);
      return existingNormalized === normalized;
    }) || null;
  }

  const data = {
    street: property.street,
    city: property.city,
    state: property.state,
    zip: property.zip,
    source: property.source,
    sourceId: property.sourceId,
    url: property.url,
    status: property.status ? mapStatus(property.status) : "ACTIVE",
    price: new Prisma.Decimal(property.price),
    propertyType: property.propertyType || "HOME",
    beds: property.beds,
    baths: property.baths ? new Prisma.Decimal(property.baths) : undefined,
    sqft: property.sqft,
    lotSize: property.lotSize
      ? new Prisma.Decimal(property.lotSize)
      : undefined,
    images: property.images,
  };

  if (existing) {
    // Update existing property
    const oldPrice = existing.price;
    const newPrice = new Prisma.Decimal(property.price);
    const priceChanged = !oldPrice.equals(newPrice);

    await prisma.property.update({
      where: { id: existing.id },
      data: {
        ...data,
        // Keep existing values if new data is missing
        beds: property.beds ?? existing.beds,
        baths: property.baths
          ? new Prisma.Decimal(property.baths)
          : existing.baths,
        sqft: property.sqft ?? existing.sqft,
        images:
          property.images.length > 0 ? property.images : existing.images,
      },
    });

    // Record price change if detected
    if (priceChanged) {
      await prisma.priceHistory.create({
        data: {
          propertyId: existing.id,
          oldPrice,
          newPrice,
          changeDate: new Date(),
        },
      });
    }

    console.log(`Updated property: ${property.street}, ${property.city}`);
    return "updated";
  } else {
    // Create new property
    const savedProperty = await prisma.property.create({ data });

    // If there's a price change from the email, record it
    if (property.priceChange) {
      await prisma.priceHistory.create({
        data: {
          propertyId: savedProperty.id,
          oldPrice: new Prisma.Decimal(
            property.price + property.priceChange.amount
          ),
          newPrice: new Prisma.Decimal(property.price),
          changeDate: property.priceChange.date,
        },
      });
    }

    console.log(`Created property: ${property.street}, ${property.city}`);
    return "created";
  }
}

/**
 * Map status string to enum value
 */
function mapStatus(status: string): "ACTIVE" | "PENDING" | "SOLD" | "OFF_MARKET" {
  const lower = status.toLowerCase();
  if (lower.includes("pending")) return "PENDING";
  if (lower.includes("sold")) return "SOLD";
  if (lower.includes("off")) return "OFF_MARKET";
  return "ACTIVE";
}

/**
 * Cleanup function
 */
export async function cleanup() {
  await prisma.$disconnect();
}
