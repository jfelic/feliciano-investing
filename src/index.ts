import { serve } from "bun";
import index from "./index.html";
import { PrismaClient } from "../generated/prisma";
import { setupEmailCron, getImapConfigFromEnv } from "./services/email";

const prisma = new PrismaClient();

// Start email cron job (runs every 4 hours by default)
// Set RUN_EMAIL_ON_STARTUP=true to run immediately on startup
if (process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
  try {
    const imapConfig = getImapConfigFromEnv();
    const runImmediately = process.env.RUN_EMAIL_ON_STARTUP === "true";
    setupEmailCron(imapConfig, "0 */4 * * *", runImmediately);
    console.log("📧 Email cron job scheduled (every 4 hours)");
    if (!runImmediately) {
      console.log("   To run immediately on startup, set RUN_EMAIL_ON_STARTUP=true");
    }
  } catch (error) {
    console.error("Failed to start email cron job:", error);
  }
} else {
  console.log("⚠️  IMAP credentials not configured - email cron job disabled");
}

const server = serve({
  idleTimeout: 255,

  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    // Get all properties with optional filters
    "/api/properties": {
      async GET(req) {
        try {
          const url = new URL(req.url);
          const city = url.searchParams.get("city");
          const state = url.searchParams.get("state");
          const source = url.searchParams.get("source");
          const minPrice = url.searchParams.get("minPrice");
          const maxPrice = url.searchParams.get("maxPrice");
          const propertyType = url.searchParams.get("type");

          const where: any = {};

          if (city) where.city = { contains: city, mode: "insensitive" };
          if (state) where.state = state.toUpperCase();
          if (source) where.source = source;
          if (propertyType) where.propertyType = propertyType.toUpperCase();
          if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
          }

          const properties = await prisma.property.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 500, // Increased limit
          });

          return Response.json(properties);
        } catch (error) {
          return Response.json(
            { error: "Failed to fetch properties" },
            { status: 500 }
          );
        }
      },
    },

    // Get single property by ID
    "/api/properties/:id": {
      async GET(req) {
        try {
          const property = await prisma.property.findUnique({
            where: { id: req.params.id },
            include: {
              priceHistory: {
                orderBy: { changeDate: "desc" },
                take: 10,
              },
            },
          });

          if (!property) {
            return Response.json(
              { error: "Property not found" },
              { status: 404 }
            );
          }

          return Response.json(property);
        } catch (error) {
          return Response.json(
            { error: "Failed to fetch property" },
            { status: 500 }
          );
        }
      },
    },

    // Get property statistics
    "/api/stats": {
      async GET(req) {
        try {
          const [totalCount, avgPrice, byCity, bySource] = await Promise.all([
            prisma.property.count(),
            prisma.property.aggregate({
              _avg: { price: true },
            }),
            prisma.property.groupBy({
              by: ["city", "state"],
              _count: true,
              orderBy: { _count: { city: "desc" } },
              take: 10,
            }),
            prisma.property.groupBy({
              by: ["source"],
              _count: true,
            }),
          ]);

          return Response.json({
            totalProperties: totalCount,
            averagePrice: avgPrice._avg.price?.toNumber() || 0,
            topCities: byCity,
            bySources: bySource,
          });
        } catch (error) {
          return Response.json(
            { error: "Failed to fetch statistics" },
            { status: 500 }
          );
        }
      },
    },

    // Manually trigger email processing
    "/api/process-emails": {
      async POST(req) {
        try {
          if (!process.env.IMAP_USER || !process.env.IMAP_PASSWORD) {
            return Response.json(
              { error: "IMAP not configured" },
              { status: 400 }
            );
          }

          const imapConfig = getImapConfigFromEnv();
          const { processPropertyEmails } = await import("./services/email");

          const result = await processPropertyEmails(imapConfig);

          return Response.json({
            success: true,
            created: result.created,
            updated: result.updated,
            errors: result.errors,
          });
        } catch (error) {
          return Response.json(
            { error: `Failed to process emails: ${error}` },
            { status: 500 }
          );
        }
      },
    },

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
