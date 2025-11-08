export interface ParsedProperty {
  // Location
  street: string;
  city: string;
  state: string;
  zip?: string;

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

  // Media
  images: string[];
}

export interface EmailParserResult {
  properties: ParsedProperty[];
  errors: string[];
}
