import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Property {
  id: string;
  street: string;
  city: string;
  state: string;
  price: string | number;
  beds?: number | null;
  baths?: string | number | null;
  sqft?: number | null;
  source: string;
  url: string;
  images: string[];
  builder?: string | null;
  propertyType: string;
}

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(numPrice);
  };

  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case "zillow":
        return "bg-blue-500";
      case "redfin":
        return "bg-red-500";
      case "realtor":
        return "bg-green-500";
      case "land":
        return "bg-amber-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        {property.images[0] ? (
          <img
            src={property.images[0]}
            alt={`${property.street}, ${property.city}`}
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <span className="text-gray-400 text-4xl">🏠</span>
          </div>
        )}
        <div className={`absolute top-2 right-2 ${getSourceColor(property.source)} text-white text-xs px-2 py-1 rounded`}>
          {property.source}
        </div>
      </div>
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl font-bold">
          {formatPrice(property.price)}
        </CardTitle>
        <CardDescription className="text-base">
          {property.street}
          <br />
          {property.city}, {property.state}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
          {property.beds && <span>{property.beds} bd</span>}
          {property.baths && <span>{property.baths} ba</span>}
          {property.sqft && <span>{property.sqft.toLocaleString()} sqft</span>}
        </div>
        {property.builder && (
          <p className="text-sm text-muted-foreground mb-3">
            Builder: {property.builder}
          </p>
        )}
        <Button asChild className="w-full">
          <a href={property.url} target="_blank" rel="noopener noreferrer">
            View Listing
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
