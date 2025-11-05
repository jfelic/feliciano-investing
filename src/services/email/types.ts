export interface ParsedProperty {
  // Location
  street: string;
  city: string;
  state: string;
  zip?: string;
  county?: string;

  // Listing Info
  source: string;
  sourceId: string;
  url: string;
  status?: string;

  // Pricing
  price: number;
  priceChange?: {
    amount: number;
    date: Date;
  };

  // Property Details
  propertyType?: "HOME" | "LAND" | "CONDO" | "TOWNHOUSE" | "MULTI_FAMILY";
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSize?: number;
  yearBuilt?: number;
  builder?: string;

  // Agent/Realtor
  agent?: string;

  // Media
  images: string[];
  description?: string;
}

export interface EmailParserResult {
  properties: ParsedProperty[];
  errors: string[];
}
