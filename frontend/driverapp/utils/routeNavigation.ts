export interface RouteStop {
  name: string;
  latitude: number | null;
  longitude: number | null;
  priority?: number | null;
  estimatedArrivalMins?: number | null;
}

export interface RouteGeometry {
  routeId: number;
  routeName: string;
  startLocation: string;
  endLocation: string;
  stops: RouteStop[];
}

export function getOrderedStops(stops: RouteStop[]) {
  return [...stops].sort((a, b) => {
    const aPriority = typeof a.priority === 'number' ? a.priority : Number.MAX_SAFE_INTEGER;
    const bPriority = typeof b.priority === 'number' ? b.priority : Number.MAX_SAFE_INTEGER;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    return a.name.localeCompare(b.name);
  });
}

export function getStopsWithCoordinates(stops: RouteStop[]) {
  return getOrderedStops(stops).filter(isCoordinate);
}

export function isCoordinate<T extends { latitude: number | null; longitude: number | null }>(
  value: T | null | undefined
): value is T & { latitude: number; longitude: number } {
  return typeof value?.latitude === 'number' && typeof value.longitude === 'number';
}

export function buildGoogleMapsDirectionsUrl(routeGeometry: RouteGeometry): string {
  const stopsWithCoordinates = getStopsWithCoordinates(routeGeometry.stops ?? []);
  const params = ['api=1', 'travelmode=driving'];

  if (stopsWithCoordinates.length >= 2) {
    const origin = formatCoordinate(stopsWithCoordinates[0]);
    const destination = formatCoordinate(stopsWithCoordinates[stopsWithCoordinates.length - 1]);
    const waypoints = stopsWithCoordinates.slice(1, -1).map(formatCoordinate);

    params.push(`origin=${encodeURIComponent(origin)}`);
    params.push(`destination=${encodeURIComponent(destination)}`);

    if (waypoints.length > 0) {
      params.push(`waypoints=${encodeURIComponent(waypoints.join('|'))}`);
    }
  } else {
    params.push(`origin=${encodeURIComponent(routeGeometry.startLocation)}`);
    params.push(`destination=${encodeURIComponent(routeGeometry.endLocation)}`);
  }

  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

export function formatStopEta(stop: RouteStop) {
  if (typeof stop.estimatedArrivalMins !== 'number') {
    return null;
  }

  const hours = Math.floor(stop.estimatedArrivalMins / 60);
  const minutes = stop.estimatedArrivalMins % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatCoordinate(coordinate: { latitude: number; longitude: number }) {
  return `${coordinate.latitude},${coordinate.longitude}`;
}
