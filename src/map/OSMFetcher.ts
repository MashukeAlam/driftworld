/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — OSM Fetcher
   
   Fetches road data from the Overpass API.
   Only queries highway=* ways and amenity nodes.
   Caches responses in localStorage with LRU eviction.
   ═══════════════════════════════════════════════════════ */

import { OVERPASS_URL, OVERPASS_TIMEOUT } from '../config/constants';

export interface OSMNode {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

export interface OSMWay {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

export interface OSMData {
  nodes: Map<number, OSMNode>;
  ways: OSMWay[];
}

const CACHE_PREFIX = 'dw_osm_';
const MAX_CACHE_ENTRIES = 20;

/**
 * Fetch OSM road data for a bounding box.
 */
export async function fetchOSMData(
  south: number, west: number, north: number, east: number
): Promise<OSMData> {
  const bboxKey = `${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`;
  const cacheKey = CACHE_PREFIX + bboxKey;

  // ─── Check cache ───
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return deserializeOSMData(JSON.parse(cached));
    } catch {
      localStorage.removeItem(cacheKey);
    }
  }

  // ─── Build Overpass query ───
  const query = `
    [out:json][timeout:${OVERPASS_TIMEOUT}];
    (
      way["highway"](${bboxKey});
      node["amenity"](${bboxKey});
    );
    out body;
    >;
    out skel qt;
  `;

  // ─── Fetch with retry ───
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (response.ok) break;
    } catch {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  if (!response || !response.ok) {
    throw new Error(`Overpass API request failed for bbox: ${bboxKey}`);
  }

  const json = await response.json();
  const data = parseOverpassResponse(json);

  // ─── Cache with LRU eviction ───
  try {
    evictOldCache();
    const serialized = serializeOSMData(data);
    localStorage.setItem(cacheKey, JSON.stringify(serialized));
  } catch {
    // Storage full — clear old entries and retry
    clearOldestCache();
    try {
      const serialized = serializeOSMData(data);
      localStorage.setItem(cacheKey, JSON.stringify(serialized));
    } catch {
      // Give up caching silently
    }
  }

  return data;
}

function parseOverpassResponse(json: { elements: Array<Record<string, unknown>> }): OSMData {
  const nodes = new Map<number, OSMNode>();
  const ways: OSMWay[] = [];

  for (const el of json.elements) {
    if (el.type === 'node') {
      nodes.set(el.id as number, {
        id: el.id as number,
        lat: el.lat as number,
        lon: el.lon as number,
        tags: el.tags as Record<string, string> | undefined,
      });
    } else if (el.type === 'way') {
      ways.push({
        id: el.id as number,
        nodes: el.nodes as number[],
        tags: (el.tags as Record<string, string>) || {},
      });
    }
  }

  return { nodes, ways };
}

interface SerializedOSMData {
  nodes: Array<[number, OSMNode]>;
  ways: OSMWay[];
  timestamp: number;
}

function serializeOSMData(data: OSMData): SerializedOSMData {
  return {
    nodes: Array.from(data.nodes.entries()),
    ways: data.ways,
    timestamp: Date.now(),
  };
}

function deserializeOSMData(serialized: SerializedOSMData): OSMData {
  return {
    nodes: new Map(serialized.nodes),
    ways: serialized.ways,
  };
}

function evictOldCache() {
  const keys: { key: string; timestamp: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        keys.push({ key, timestamp: data.timestamp || 0 });
      } catch {
        localStorage.removeItem(key);
      }
    }
  }

  if (keys.length >= MAX_CACHE_ENTRIES) {
    keys.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES + 1);
    for (const item of toRemove) {
      localStorage.removeItem(item.key);
    }
  }
}

function clearOldestCache() {
  const keys: { key: string; timestamp: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        keys.push({ key, timestamp: data.timestamp || 0 });
      } catch {
        localStorage.removeItem(key);
      }
    }
  }
  keys.sort((a, b) => a.timestamp - b.timestamp);
  const half = Math.ceil(keys.length / 2);
  for (let i = 0; i < half; i++) {
    localStorage.removeItem(keys[i].key);
  }
}

/**
 * Compute a bounding box around a center point with a given radius in meters.
 */
export function computeBBox(lat: number, lng: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
  return {
    south: lat - latDelta,
    west: lng - lngDelta,
    north: lat + latDelta,
    east: lng + lngDelta,
  };
}
