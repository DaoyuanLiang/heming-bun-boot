/** GeoJSON coordinate: [longitude, latitude] or [x, y, z] */
export type Position = number[];

/** GeoJSON CRS (coordinate reference system) */
export interface GeoJsonCrs {
  type: "name";
  properties: { name: string };
}

export interface Point {
  type: "Point";
  coordinates: Position;
  crs?: GeoJsonCrs;
}

export interface MultiPoint {
  type: "MultiPoint";
  coordinates: Position[];
  crs?: GeoJsonCrs;
}

export interface LineString {
  type: "LineString";
  coordinates: Position[];
  crs?: GeoJsonCrs;
}

export interface MultiLineString {
  type: "MultiLineString";
  coordinates: Position[][];
  crs?: GeoJsonCrs;
}

export interface Polygon {
  type: "Polygon";
  coordinates: Position[][];
  crs?: GeoJsonCrs;
}

export interface MultiPolygon {
  type: "MultiPolygon";
  coordinates: Position[][][];
  crs?: GeoJsonCrs;
}

export interface GeometryCollection {
  type: "GeometryCollection";
  geometries: Geometry[];
  crs?: GeoJsonCrs;
}

export type Geometry =
  | Point
  | MultiPoint
  | LineString
  | MultiLineString
  | Polygon
  | MultiPolygon
  | GeometryCollection;
