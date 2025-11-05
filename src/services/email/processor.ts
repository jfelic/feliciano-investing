import { PrismaClient, Prisma } from "../../../generated/prisma";
import { fetchPropertyEmails, type ImapConfig } from "./fetcher";
import type { ParsedProperty } from "./types";

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
        await saveProperty(property);
        created++;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          // Unique constraint violation - property already exists
          try {
            await updateProperty(property);
            updated++;
          } catch (updateError) {
            errors.push(
              `Error updating property ${property.url}: ${updateError}`
            );
          }
        } else {
          errors.push(`Error saving property ${property.url}: ${error}`);
        }
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
 * Save a new property to database
 */
async function saveProperty(property: ParsedProperty): Promise<void> {
  const data: Prisma.PropertyCreateInput = {
    street: property.street,
    city: property.city,
    state: property.state,
    zip: property.zip,
    county: property.county,
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
    yearBuilt: property.yearBuilt,
    builder: property.builder,
    agent: property.agent,
    images: property.images,
    description: property.description,
  };

  const savedProperty = await prisma.property.create({ data });

  // If there's a price change, record it in history
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
}

/**
 * Update an existing property in database
 */
async function updateProperty(property: ParsedProperty): Promise<void> {
  // Find existing property
  const existing = await prisma.property.findUnique({
    where: {
      source_sourceId: {
        source: property.source,
        sourceId: property.sourceId,
      },
    },
  });

  if (!existing) {
    throw new Error("Property not found for update");
  }

  // Check if price changed
  const oldPrice = existing.price;
  const newPrice = new Prisma.Decimal(property.price);
  const priceChanged = !oldPrice.equals(newPrice);

  // Update property
  await prisma.property.update({
    where: { id: existing.id },
    data: {
      price: newPrice,
      status: property.status ? mapStatus(property.status) : existing.status,
      beds: property.beds ?? existing.beds,
      baths: property.baths
        ? new Prisma.Decimal(property.baths)
        : existing.baths,
      sqft: property.sqft ?? existing.sqft,
      images:
        property.images.length > 0 ? property.images : existing.images,
      agent: property.agent ?? existing.agent,
      builder: property.builder ?? existing.builder,
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
