
export enum Direction {
  Left,
  Right
}

export enum MeshType {
  Land,
  Ocean
}

export interface IO {
  wind: { x: number, y: number, strength: number }[];
  water: number;
  dirt: number;
}

export interface IMesh {
  findClosest(x: number, y: number): IMeshItem | undefined;
  apply(method: (m: IMeshItem) => void): void;
  reduce<T>(method: (prev: T, cur: IMeshItem) => T, initial: T): T
}

export interface IMeshItem {
  site: { x: number, y: number }
  isMapEdge: boolean;
  height: number;
  input: IO;
  output: IO;
  type: MeshType;
  neighbors: IMeshNeighbor[];
  points: IVertex[];
}

export interface IVertex {
  x: number;
  y: number;
}

export interface IMeshNeighbor {
  site: { x: number, y: number };
  meshItem: IMeshItem | null;
}

export interface IVoronoiMeshItem extends IMeshItem {
  points: Voronoi.Vertex[];
  neighbors: IVoronoiMeshNeighbor[];
  site: Voronoi.Site;
  halfedges: Voronoi.Halfedge[];
}

export interface IVoronoiMeshNeighbor extends IMeshNeighbor {
  dir: Direction;
  halfEdge: Voronoi.Halfedge;
}
