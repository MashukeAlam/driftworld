/* DRIFTWORLD — Road Graph
   Provides road-constrained movement. The hovercraft snaps to
   the nearest road and moves along road edges. */

import type { RoadSegment, Point } from './GeoParser';

export interface RoadEdge {
  points: Point[];
  length: number;     // total length in pixels
  cumLengths: number[]; // cumulative length at each point
  name: string;
  highway: string;
}

/**
 * Find the nearest point on any road segment to (px, py).
 * Returns the projected point, distance, segment index, and
 * the direction angle of the road at that point.
 */
export interface SnapResult {
  x: number;
  y: number;
  dist: number;
  segIndex: number;
  edgeParam: number;  // 0–1 along the edge
  angle: number;      // road direction at that point
  name: string;
}

export class RoadGraph {
  private edges: RoadEdge[] = [];
  private segments: RoadSegment[] = [];

  build(segments: RoadSegment[]) {
    this.segments = segments;
    this.edges = [];

    for (const seg of segments) {
      const cumLengths = [0];
      let total = 0;
      for (let i = 1; i < seg.points.length; i++) {
        const dx = seg.points[i].x - seg.points[i - 1].x;
        const dy = seg.points[i].y - seg.points[i - 1].y;
        total += Math.sqrt(dx * dx + dy * dy);
        cumLengths.push(total);
      }
      this.edges.push({
        points: seg.points,
        length: total,
        cumLengths,
        name: seg.name,
        highway: seg.highway,
      });
    }
  }

  /**
   * Snap a world position to the nearest road.
   */
  snap(px: number, py: number): SnapResult | null {
    if (this.edges.length === 0) return null;

    let bestDist = Infinity;
    let bestResult: SnapResult | null = null;

    for (let si = 0; si < this.edges.length; si++) {
      const edge = this.edges[si];
      for (let i = 0; i < edge.points.length - 1; i++) {
        const a = edge.points[i];
        const b = edge.points[i + 1];
        const proj = projectPointOnSegment(px, py, a.x, a.y, b.x, b.y);

        if (proj.dist < bestDist) {
          bestDist = proj.dist;
          const segLen = edge.cumLengths[i] + proj.t *
            (edge.cumLengths[i + 1] - edge.cumLengths[i]);
          const param = edge.length > 0 ? segLen / edge.length : 0;
          const angle = Math.atan2(b.y - a.y, b.x - a.x);

          bestResult = {
            x: proj.x,
            y: proj.y,
            dist: proj.dist,
            segIndex: si,
            edgeParam: param,
            angle,
            name: edge.name,
          };
        }
      }
    }

    return bestResult;
  }

  /**
   * Move along a road edge from current snap position.
   * Returns the new position and road info.
   */
  moveAlong(segIndex: number, edgeParam: number, distPixels: number): SnapResult | null {
    if (segIndex < 0 || segIndex >= this.edges.length) return null;
    const edge = this.edges[segIndex];
    if (edge.length === 0) return null;

    let newParam = edgeParam + distPixels / edge.length;

    // Clamp and handle edge transitions
    if (newParam > 1) {
      // Try to find a connected edge at the end
      const endPt = edge.points[edge.points.length - 1];
      const nextEdge = this.findConnectedEdge(segIndex, endPt, true);
      if (nextEdge !== null) {
        const overflow = (newParam - 1) * edge.length;
        return this.moveAlong(nextEdge.index, nextEdge.param, overflow);
      }
      newParam = 1;
    } else if (newParam < 0) {
      const startPt = edge.points[0];
      const nextEdge = this.findConnectedEdge(segIndex, startPt, false);
      if (nextEdge !== null) {
        const overflow = newParam * edge.length;
        return this.moveAlong(nextEdge.index, nextEdge.param, overflow);
      }
      newParam = 0;
    }

    return this.getPositionAtParam(segIndex, newParam);
  }

  /**
   * At an intersection, find the best connected edge given a desired turn direction.
   * turnBias: -1 (left), 0 (straight), +1 (right)
   */
  findBestTurn(segIndex: number, edgeParam: number, currentAngle: number, turnBias: number): { segIndex: number; edgeParam: number } | null {
    const edge = this.edges[segIndex];
    const atEnd = edgeParam > 0.5;
    const junctionPt = atEnd ? edge.points[edge.points.length - 1] : edge.points[0];

    const SNAP_DIST = 15;
    const candidates: { index: number; param: number; angle: number; angleDiff: number }[] = [];

    for (let i = 0; i < this.edges.length; i++) {
      if (i === segIndex) continue;
      const other = this.edges[i];

      // Check start
      const ds = dist(junctionPt, other.points[0]);
      if (ds < SNAP_DIST) {
        const a = Math.atan2(
          other.points[1].y - other.points[0].y,
          other.points[1].x - other.points[0].x
        );
        candidates.push({ index: i, param: 0, angle: a, angleDiff: angleDiffSigned(currentAngle, a) });
      }

      // Check end
      const de = dist(junctionPt, other.points[other.points.length - 1]);
      if (de < SNAP_DIST) {
        const last = other.points.length - 1;
        const a = Math.atan2(
          other.points[last - 1].y - other.points[last].y,
          other.points[last - 1].x - other.points[last].x
        );
        candidates.push({ index: i, param: 1, angle: a, angleDiff: angleDiffSigned(currentAngle, a) });
      }
    }

    if (candidates.length === 0) return null;

    if (turnBias === 0) {
      // Pick straightest
      candidates.sort((a, b) => Math.abs(a.angleDiff) - Math.abs(b.angleDiff));
    } else {
      // Pick the one most in the turn direction
      candidates.sort((a, b) => {
        const scoreA = turnBias > 0 ? a.angleDiff : -a.angleDiff;
        const scoreB = turnBias > 0 ? b.angleDiff : -b.angleDiff;
        // Prefer positive scores (turns in desired direction) but close to 90°
        if (scoreA > 0 && scoreB <= 0) return -1;
        if (scoreB > 0 && scoreA <= 0) return 1;
        return Math.abs(Math.abs(scoreA) - Math.PI / 2) - Math.abs(Math.abs(scoreB) - Math.PI / 2);
      });
    }

    return { segIndex: candidates[0].index, edgeParam: candidates[0].param };
  }

  getPositionAtParam(segIndex: number, param: number): SnapResult | null {
    const edge = this.edges[segIndex];
    if (!edge) return null;
    const targetDist = param * edge.length;

    for (let i = 0; i < edge.points.length - 1; i++) {
      if (edge.cumLengths[i + 1] >= targetDist || i === edge.points.length - 2) {
        const segStart = edge.cumLengths[i];
        const segEnd = edge.cumLengths[i + 1];
        const segLen = segEnd - segStart;
        const t = segLen > 0 ? (targetDist - segStart) / segLen : 0;
        const a = edge.points[i];
        const b = edge.points[i + 1];
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        const angle = Math.atan2(b.y - a.y, b.x - a.x);

        return {
          x, y,
          dist: 0,
          segIndex,
          edgeParam: param,
          angle,
          name: edge.name,
        };
      }
    }
    return null;
  }

  getEdge(index: number): RoadEdge | undefined {
    return this.edges[index];
  }

  private findConnectedEdge(fromIndex: number, pt: Point, fromEnd: boolean): { index: number; param: number } | null {
    const SNAP_DIST = 15;
    const fromEdge = this.edges[fromIndex];
    const fromAngle = fromEnd
      ? Math.atan2(
        fromEdge.points[fromEdge.points.length - 1].y - fromEdge.points[fromEdge.points.length - 2].y,
        fromEdge.points[fromEdge.points.length - 1].x - fromEdge.points[fromEdge.points.length - 2].x
      )
      : Math.atan2(
        fromEdge.points[0].y - fromEdge.points[1].y,
        fromEdge.points[0].x - fromEdge.points[1].x
      );

    let bestIndex = -1;
    let bestParam = 0;
    let bestAngleDiff = Infinity;

    for (let i = 0; i < this.edges.length; i++) {
      if (i === fromIndex) continue;
      const edge = this.edges[i];

      const ds = dist(pt, edge.points[0]);
      if (ds < SNAP_DIST) {
        const a = Math.atan2(edge.points[1].y - edge.points[0].y, edge.points[1].x - edge.points[0].x);
        const diff = Math.abs(angleDiffSigned(fromAngle, a));
        if (diff < bestAngleDiff) {
          bestAngleDiff = diff;
          bestIndex = i;
          bestParam = 0;
        }
      }

      const de = dist(pt, edge.points[edge.points.length - 1]);
      if (de < SNAP_DIST) {
        const last = edge.points.length - 1;
        const a = Math.atan2(edge.points[last - 1].y - edge.points[last].y, edge.points[last - 1].x - edge.points[last].x);
        const diff = Math.abs(angleDiffSigned(fromAngle, a));
        if (diff < bestAngleDiff) {
          bestAngleDiff = diff;
          bestIndex = i;
          bestParam = 1;
        }
      }
    }

    if (bestIndex >= 0 && bestAngleDiff < Math.PI * 0.7) {
      return { index: bestIndex, param: bestParam };
    }
    return null;
  }

  /**
   * Get all road points for artifact placement on roads.
   */
  getAllRoadPoints(): Point[] {
    const pts: Point[] = [];
    for (const edge of this.edges) {
      for (const p of edge.points) {
        pts.push(p);
      }
    }
    return pts;
  }
}

function projectPointOnSegment(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): { x: number; y: number; dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const d = Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    return { x: ax, y: ay, dist: d, t: 0 };
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const d = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  return { x: projX, y: projY, dist: d, t };
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function angleDiffSigned(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
