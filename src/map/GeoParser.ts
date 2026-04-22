/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Geo Parser
   
   Converts OSM lat/lng coordinates to screen pixel
   coordinates using a Mercator projection centered
   on the player's starting position.
   ═══════════════════════════════════════════════════════ */

import { PIXELS_PER_METER } from '../config/constants';
import type { OSMData, OSMWay, OSMNode } from './OSMFetcher';

export interface Point {
  x: number;
  y: number;
}

export interface RoadSegment {
  points: Point[];
  highway: string;
  wayId: number;
  name: string;
}

/**
 * Geo projection utility — converts between lat/lng and pixel space.
 * All coordinates are relative to a center point (the starting location).
 */
export class GeoProjection {
  private centerLat: number;
  private centerLng: number;
  private metersPerDegreeLat: number;
  private metersPerDegreeLng: number;

  constructor(centerLat: number, centerLng: number) {
    this.centerLat = centerLat;
    this.centerLng = centerLng;
    // Approximate conversion factors at this latitude
    this.metersPerDegreeLat = 111320;
    this.metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
  }

  /**
   * Convert lat/lng to pixel coordinates.
   * X increases to the right (east), Y increases downward (south).
   */
  toPixel(lat: number, lng: number): Point {
    const dx = (lng - this.centerLng) * this.metersPerDegreeLng * PIXELS_PER_METER;
    const dy = -(lat - this.centerLat) * this.metersPerDegreeLat * PIXELS_PER_METER;
    return { x: dx, y: dy };
  }

  /**
   * Convert pixel coordinates back to lat/lng.
   */
  toLatLng(x: number, y: number): { lat: number; lng: number } {
    const lng = this.centerLng + x / (this.metersPerDegreeLng * PIXELS_PER_METER);
    const lat = this.centerLat - y / (this.metersPerDegreeLat * PIXELS_PER_METER);
    return { lat, lng };
  }

  /**
   * Convert meters to pixels.
   */
  metersToPixels(meters: number): number {
    return meters * PIXELS_PER_METER;
  }

  /**
   * Convert pixels to meters.
   */
  pixelsToMeters(pixels: number): number {
    return pixels / PIXELS_PER_METER;
  }
}

/**
 * Parse OSM data into renderable road segments.
 */
export function parseRoads(osmData: OSMData, projection: GeoProjection): RoadSegment[] {
  const segments: RoadSegment[] = [];

  for (const way of osmData.ways) {
    const highway = way.tags?.highway;
    if (!highway) continue;

    const points: Point[] = [];
    for (const nodeId of way.nodes) {
      const node = osmData.nodes.get(nodeId);
      if (node) {
        points.push(projection.toPixel(node.lat, node.lon));
      }
    }

    if (points.length >= 2) {
      segments.push({
        points,
        highway,
        wayId: way.id,
        name: way.tags?.name || '',
      });
    }
  }

  return segments;
}

/**
 * Find road intersections (nodes referenced by multiple ways).
 * Returns pixel coordinates of intersection points.
 */
export function findIntersections(osmData: OSMData, projection: GeoProjection): Point[] {
  const nodeCounts = new Map<number, number>();

  for (const way of osmData.ways) {
    if (!way.tags?.highway) continue;
    for (const nodeId of way.nodes) {
      nodeCounts.set(nodeId, (nodeCounts.get(nodeId) || 0) + 1);
    }
  }

  const intersections: Point[] = [];
  for (const [nodeId, count] of nodeCounts) {
    if (count >= 2) {
      const node = osmData.nodes.get(nodeId);
      if (node) {
        intersections.push(projection.toPixel(node.lat, node.lon));
      }
    }
  }

  return intersections;
}

/**
 * Find midpoints of road segments for artifact spawning.
 */
export function findRoadMidpoints(segments: RoadSegment[]): Point[] {
  const midpoints: Point[] = [];

  for (const segment of segments) {
    if (segment.points.length >= 2) {
      const midIdx = Math.floor(segment.points.length / 2);
      midpoints.push(segment.points[midIdx]);
    }
  }

  return midpoints;
}
