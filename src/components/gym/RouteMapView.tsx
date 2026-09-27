import { useTranslation } from "../../lib/gym/i18n";
import type { RouteMap } from "../../lib/gym/routeMap";
import { useRouteMap } from "../../lib/gym/routeMapStore";

/** Mask properties for filling a stored route PNG with a CSS colour. */
function maskStyle(url: string, size: "cover" | "contain") {
  return {
    maskImage: `url(${url})`,
    WebkitMaskImage: `url(${url})`,
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: "center",
    WebkitMaskPosition: "center",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  } as const;
}

/**
 * A route map in Forge's colours (see routeMap.ts): the grey map — stored
 * dark-style, inverted in light mode — with the route as a mask filled with
 * `bg-primary`, so it follows the chosen accent the moment it changes.
 */
export function RouteMapView({ map }: { map: RouteMap }) {
  const t = useTranslation();
  // Wide maps as they are; very tall or very flat ones are cropped to a
  // card-friendly shape (both layers cover the same box, so they stay aligned).
  const aspect = Math.min(2.2, Math.max(1.1, map.width / map.height));
  return (
    <div
      role="img"
      aria-label={t.watch.routeMap}
      className="relative overflow-hidden rounded-2xl bg-muted"
      style={{ aspectRatio: aspect }}
    >
      <img
        src={map.map}
        alt=""
        className="absolute inset-0 size-full object-cover opacity-60 invert dark:opacity-45 dark:invert-0"
      />
      {/* The glow sits on a wrapper: a filter on the masked element itself
          would be masked away with it. */}
      <div
        className="absolute inset-0"
        style={{
          filter: "drop-shadow(0 0 5px color-mix(in oklch, var(--primary) 70%, transparent))",
        }}
      >
        <div className="absolute inset-0 bg-primary" style={maskStyle(map.route, "cover")} />
      </div>
    </div>
  );
}

/** The route alone, small, for a list row. */
export function RouteThumb({ map, className = "" }: { map: RouteMap; className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative block shrink-0 overflow-hidden rounded-xl bg-muted ${className}`}
    >
      <span className="absolute inset-0 bg-primary" style={maskStyle(map.thumb, "contain")} />
    </span>
  );
}

/** A cardio session's stored map, once it has loaded; nothing without one. */
export function CardioRouteMap({ id }: { id: string }) {
  const map = useRouteMap(id);
  return map ? <RouteMapView map={map} /> : null;
}
