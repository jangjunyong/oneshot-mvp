// geo.js 의 타입 표면.

export interface Projection {
  toM(lngLat: number[]): [number, number];
  toLngLat(xy: number[]): [number, number];
}
export function makeProjection(lng0: number, lat0: number): Projection;

export interface Attraction {
  id: string; kind: string; name: string; poly: [number, number][]; front: [number, number];
  servers?: number; serviceSec?: number; popularity?: number; cat?: string;
}
export interface Gate { id: string; name: string; poly: [number, number][]; share: number }
export interface Venue {
  sites: [number, number][][]; obstacles: [number, number][][]; soft: [number, number][][];
  corridors: { points: [number, number][]; width: number }[];
  gates: Gate[]; attractions: Attraction[];
}
export function venueFromGeoJSON(fc: GeoJSON.FeatureCollection, proj: Projection): Venue;
