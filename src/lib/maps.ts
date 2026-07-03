// Google Maps JS loader (singleton)
const KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let loadPromise: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if ((window as any).google?.maps) return Promise.resolve((window as any).google);
  if (loadPromise) return loadPromise;
  if (!KEY) return Promise.reject(new Error("Google Maps key missing"));
  loadPromise = new Promise((resolve, reject) => {
    (window as any).__initGmap = () => resolve((window as any).google);
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: KEY,
      loading: "async",
      callback: "__initGmap",
      libraries: "places",
    });
    if (CHANNEL) params.set("channel", CHANNEL);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loadPromise;
}

export const hasMapsKey = !!KEY;
