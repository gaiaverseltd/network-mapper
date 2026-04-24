import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAllProfiles } from "../hooks/queries";

const GOOGLE_MAPS_SRC = "https://maps.googleapis.com/maps/api/js";
const CACHE_KEY = "netmap_geocode_cache_v1";
const WORLD_BOUNDS = {
  north: 85,
  south: -85,
  west: -179.999,
  east: 179.999,
};
const MIN_WORLD_ZOOM = 2;

function getApiKey() {
  return (
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
    import.meta.env.VITE_GoogleMapsApiKey ||
    ""
  ).trim();
}

function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.reject(new Error("missing_api_key"));
  if (window.google?.maps) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () => reject(new Error("google_maps_load_failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = `${GOOGLE_MAPS_SRC}?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "1";
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("google_maps_load_failed"));
    document.head.appendChild(script);
  });
}

function profileLocation(profile) {
  const loc = profile?.location && typeof profile.location === "object" ? profile.location : null;
  const mdLoc =
    profile?.memberData?.location && typeof profile.memberData.location === "object"
      ? profile.memberData.location
      : null;
  const cf = profile?.customFields || {};
  const countries = Array.isArray(loc?.countries)
    ? loc.countries
    : Array.isArray(mdLoc?.countries)
      ? mdLoc.countries
      : [];
  const country = (countries[0] || cf.country || "").toString().trim();
  const state = (loc?.stateProvince || mdLoc?.stateProvince || cf.state || "").toString().trim();
  const city = (loc?.city || mdLoc?.city || cf.city || "").toString().trim();
  if (!country && !state && !city) return null;
  const query = [city, state, country].filter(Boolean).join(", ");
  return query ? { query, city, state, country } : null;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota/availability errors
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default function MapPage() {
  const apiKey = getApiKey();
  const { data: profiles = [] } = useAllProfiles();
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const points = useMemo(() => {
    const grouped = new Map();
    profiles.forEach((p) => {
      const loc = profileLocation(p);
      if (!loc) return;
      const key = loc.query.toLowerCase();
      const entry = grouped.get(key) || { ...loc, count: 0, names: [] };
      entry.count += 1;
      if ((p?.name || "").trim()) entry.names.push(p.name.trim());
      grouped.set(key, entry);
    });
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [profiles]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        setError("");
        const google = await loadGoogleMaps(apiKey);
        if (cancelled || !mapElRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(mapElRef.current, {
            center: { lat: 20, lng: 0 },
            zoom: MIN_WORLD_ZOOM,
            minZoom: MIN_WORLD_ZOOM,
            streetViewControl: false,
            mapTypeControl: true,
            restriction: {
              latLngBounds: WORLD_BOUNDS,
              strictBounds: true,
            },
          });
          // Explicitly clamp center to avoid infinite horizontal wrapping.
          mapRef.current.addListener("center_changed", () => {
            const center = mapRef.current?.getCenter();
            if (!center) return;
            const lat = center.lat();
            const lng = center.lng();
            const nextLat = Math.max(WORLD_BOUNDS.south, Math.min(WORLD_BOUNDS.north, lat));
            const nextLng = Math.max(WORLD_BOUNDS.west, Math.min(WORLD_BOUNDS.east, lng));
            if (nextLat !== lat || nextLng !== lng) {
              mapRef.current.setCenter({ lat: nextLat, lng: nextLng });
            }
          });
          mapRef.current.addListener("zoom_changed", () => {
            const z = mapRef.current?.getZoom();
            if (typeof z === "number" && z < MIN_WORLD_ZOOM) {
              mapRef.current.setZoom(MIN_WORLD_ZOOM);
            }
          });
        }

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const geocoder = new google.maps.Geocoder();
        const cache = readCache();
        const bounds = new google.maps.LatLngBounds();
        const info = new google.maps.InfoWindow();

        for (const p of points.slice(0, 500)) {
          const cached = cache[p.query];
          let position = cached && typeof cached.lat === "number" && typeof cached.lng === "number"
            ? cached
            : null;
          if (!position) {
            try {
              // eslint-disable-next-line no-await-in-loop
              const { results } = await geocoder.geocode({ address: p.query });
              if (results?.[0]?.geometry?.location) {
                const loc = results[0].geometry.location;
                position = { lat: loc.lat(), lng: loc.lng() };
                cache[p.query] = position;
              }
            } catch {
              // skip failed geocode
            }
          }
          if (!position) continue;

          const marker = new google.maps.Marker({
            map: mapRef.current,
            position,
            title: `${p.query} (${p.count})`,
            label:
              p.count > 1
                ? {
                    text: String(Math.min(p.count, 99)),
                    color: "#000000",
                    fontWeight: "700",
                    fontSize: "12px",
                  }
                : undefined,
          });
          marker.addListener("click", () => {
            const shownNames = p.names.slice(0, 10);
            const extraCount = Math.max(0, p.names.length - shownNames.length);
            const namesHtml = shownNames.length
              ? `<ul style="margin:8px 0 0 16px; padding:0; color:#111827;">${shownNames
                  .map((n) => `<li>${escapeHtml(n)}</li>`)
                  .join("")}</ul>`
              : "";
            const moreHtml = extraCount > 0 ? `<div style="margin-top:6px; color:#374151;">+${extraCount} more</div>` : "";
            info.setContent(
              `<div style="max-width:280px; color:#111827;"><strong>${escapeHtml(
                p.query
              )}</strong><br/>Profiles: ${p.count}${namesHtml}${moreHtml}</div>`
            );
            info.open({ map: mapRef.current, anchor: marker });
          });
          markersRef.current.push(marker);
          bounds.extend(position);
        }

        writeCache(cache);
        if (!bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, 40);
          google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
            const z = mapRef.current?.getZoom();
            if (typeof z === "number" && z < MIN_WORLD_ZOOM) {
              mapRef.current.setZoom(MIN_WORLD_ZOOM);
            }
          });
        }
      } catch (e) {
        setError(e?.message || "Could not load map.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [apiKey, points]);

  return (
    <div className="w-full h-full min-h-[70vh]">
      <Helmet>
        <title>Map | NetMap</title>
      </Helmet>
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-text-primary">Member Map</h1>
        <p className="text-sm text-text-secondary">
          Showing grouped markers from profile location data ({points.length} places).
        </p>
      </div>
      {!apiKey ? (
        <div className="p-4 rounded-xl border border-border-default bg-bg-tertiary text-text-secondary">
          Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your environment to enable the map.
        </div>
      ) : null}
      {error ? (
        <div className="p-4 rounded-xl border border-border-default bg-bg-tertiary text-status-error mb-3">
          {error}
        </div>
      ) : null}
      {loading ? <p className="text-sm text-text-secondary mb-2">Loading map…</p> : null}
      <div ref={mapElRef} className="w-full h-[70vh] rounded-2xl border border-border-default" />
    </div>
  );
}
