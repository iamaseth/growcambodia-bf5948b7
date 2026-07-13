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
  const [mapReady, setMapReady] = useState(false);

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
          center: farms[0] ? { lat: farms[0].lat, lng: farms[0].lng } : { lat: 10.6, lng: 104.18 },
          zoom: farms[0] ? 12 : 8,
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
        setMapReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = (window as any).google;
    if (!g || !mapRef.current || !mapReady) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const valid = farms.filter(
      (f) => typeof f.lat === "number" && typeof f.lng === "number" && !Number.isNaN(f.lat) && !Number.isNaN(f.lng),
    );
    valid.forEach((f) => {
      const marker = new g.maps.Marker({
        position: { lat: Number(f.lat), lng: Number(f.lng) },
        map: mapRef.current,
        title: f.name,
      });
      marker.addListener("click", () => onSelectFarm?.(f));
      markersRef.current.push(marker);
    });
    if (valid.length > 1) {
      const bounds = new g.maps.LatLngBounds();
      valid.forEach((f) => bounds.extend({ lat: Number(f.lat), lng: Number(f.lng) }));
      mapRef.current.fitBounds(bounds, 60);
    } else if (valid.length === 1) {
      mapRef.current.setCenter({ lat: Number(valid[0].lat), lng: Number(valid[0].lng) });
      mapRef.current.setZoom(14);
    }
  }, [farms, onSelectFarm, mapReady]);

  if (error) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-muted rounded-lg text-sm text-muted-foreground p-4 text-center">
        {error}
      </div>
    );
  }
  return <div ref={ref} style={{ height }} className="w-full rounded-lg overflow-hidden bg-muted" />;
}
