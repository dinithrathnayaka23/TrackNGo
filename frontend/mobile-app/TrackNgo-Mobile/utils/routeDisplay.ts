export type RouteStopForDisplay = {
  name: string;
  priority: number;
};

type BusRouteDisplaySource = {
  busRouteName?: string | null;
  routeStartLocation?: string | null;
  routeEndLocation?: string | null;
  routeName?: string | null;
  routeStops?: RouteStopForDisplay[] | null;
};

type BusRouteDisplayOptions = {
  segmentFrom?: string | null;
  segmentTo?: string | null;
};

function clean(value?: string | null) {
  return value?.trim() ?? '';
}

function normalizeStopKey(value?: string | null) {
  return clean(value).toLowerCase().replace(/[-\s]+/g, '');
}

function routePair(start?: string | null, end?: string | null) {
  const cleanStart = clean(start);
  const cleanEnd = clean(end);
  if (cleanStart && cleanEnd && normalizeStopKey(cleanStart) !== normalizeStopKey(cleanEnd)) {
    return `${cleanStart} to ${cleanEnd}`;
  }
  return cleanStart || cleanEnd;
}

function isSegmentLabel(label: string, options?: BusRouteDisplayOptions) {
  const from = clean(options?.segmentFrom);
  const to = clean(options?.segmentTo);
  if (!from || !to) return false;

  const normalizedLabel = normalizeStopKey(label.replace(/->/g, ' ').replace(/\bto\b/gi, ' '));
  const forward = normalizeStopKey(`${from}${to}`);
  const reverse = normalizeStopKey(`${to}${from}`);
  return normalizedLabel === forward || normalizedLabel === reverse;
}

export function getBusRouteLabel(source: BusRouteDisplaySource, options?: BusRouteDisplayOptions) {
  const explicit = clean(source.busRouteName);
  if (explicit && !isSegmentLabel(explicit, options)) return explicit;

  const endpointLabel = routePair(source.routeStartLocation, source.routeEndLocation);
  if (endpointLabel) return endpointLabel;

  const sortedStops = [...(source.routeStops ?? [])].sort((a, b) => a.priority - b.priority);
  const stopLabel = routePair(sortedStops[0]?.name, sortedStops[sortedStops.length - 1]?.name);
  if (stopLabel) return stopLabel;

  const routeName = clean(source.routeName);
  return routeName && !isSegmentLabel(routeName, options) ? routeName : '';
}

export function getBusRouteWithSuffix(source: BusRouteDisplaySource, options?: BusRouteDisplayOptions) {
  const label = getBusRouteLabel(source, options);
  if (!label) return '';
  return /\bbus$/i.test(label) ? label : `${label} Bus`;
}

export function getJourneyRouteStops<T extends RouteStopForDisplay>(
  stops: T[],
  from: string,
  to: string,
) {
  const sortedStops = [...stops].sort((a, b) => a.priority - b.priority);
  const fromStop = sortedStops.find((stop) => normalizeStopKey(stop.name) === normalizeStopKey(from));
  const toStop = sortedStops.find((stop) => normalizeStopKey(stop.name) === normalizeStopKey(to));

  if (!fromStop || !toStop) {
    return sortedStops;
  }

  const minPriority = Math.min(fromStop.priority, toStop.priority);
  const maxPriority = Math.max(fromStop.priority, toStop.priority);
  const segmentStops = sortedStops.filter(
    (stop) => stop.priority >= minPriority && stop.priority <= maxPriority,
  );

  return fromStop.priority <= toStop.priority ? segmentStops : segmentStops.reverse();
}
