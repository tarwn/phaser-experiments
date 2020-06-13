
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

export interface IMeshItem {
  points: Voronoi.Vertex[];
  neighbors: IMeshNeighbor[];
  isMapEdge: boolean;
  site: Voronoi.Site;
  halfedges: Voronoi.Halfedge[];
  height: number;
  input: IO;
  output: IO;
  type: MeshType;
}

export interface IMeshNeighbor {
  site: Voronoi.Site;
  dir: Direction;
  meshItem: IMeshItem | null;
  halfEdge: Voronoi.Halfedge;
}
