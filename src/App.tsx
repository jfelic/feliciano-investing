import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyCard } from "@/components/PropertyCard";
import { useState, useEffect } from "react";
import "./index.css";

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

export function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await fetch("/api/properties");
      const data = await response.json();
      setProperties(data);
    } catch (error) {
      console.error("Failed to fetch properties:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Property Listings Dashboard</h1>
        <p className="text-muted-foreground">
          Showing {properties.length} properties
        </p>
      </header>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading properties...</p>
        </div>
      ) : properties.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No properties found</CardTitle>
            <p className="text-muted-foreground">
              Email alerts will appear here once the cron job processes them.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
