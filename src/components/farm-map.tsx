import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, hasMapsKey } from "@/lib/maps";
import type { Farm } from "@/lib/db";

type Props = {
  farms: Farm[];
  onSelectFarm?: (farm: Farm) => void;
  onPickLocation?: (lat: number, lng: number) => void;
  height?: string;
};

export function FarmMap({ farms, onSelectFarm, onPickLocation, height = "60vh" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasMapsKey) {
      setError("Google Maps API key not configured.");
      return;
    }
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !ref.current) return;
        const map = new g.maps.Map(ref.current, {
          center: farms[0] ? { lat: farms[0].lat, lng: farms[0].lng } : { lat: 20, lng: 0 },
          zoom: farms[0] ? 10 : 2,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        if (onPickLocation) {
          map.addListener("click", (e: any) => {
            onPickLocation(e.latLng.lat(), e.latLng.lng());
          });
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = (window as any).google;
    if (!g || !mapRef.current) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    farms.forEach((f) => {
      const marker = new g.maps.Marker({
        position: { lat: f.lat, lng: f.lng },
        map: mapRef.current,
        title: f.name,
      });
      marker.addListener("click", () => onSelectFarm?.(f));
      markersRef.current.push(marker);
    });
    if (farms.length > 1) {
      const bounds = new g.maps.LatLngBounds();
      farms.forEach((f) => bounds.extend({ lat: f.lat, lng: f.lng }));
      mapRef.current.fitBounds(bounds, 60);
    } else if (farms.length === 1) {
      mapRef.current.setCenter({ lat: farms[0].lat, lng: farms[0].lng });
    }
  }, [farms, onSelectFarm]);

  if (error) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-muted rounded-lg text-sm text-muted-foreground p-4 text-center">
        {error}
      </div>
    );
  }
  return <div ref={ref} style={{ height }} className="w-full rounded-lg overflow-hidden bg-muted" />;
}
