/* eslint-disable @typescript-eslint/interface-name-prefix */



declare namespace Voronoi {
  export interface VoronoiDiagram {
    vertices: Vertex[]; // x, y
    edges: Edge[];      // lSite, rSite, va, vb
    cells: Cell[];      // site, halfedges
    execTime: number;

  }

  export interface Vertex {
    x: number;
    y: number;
  }
  export interface Edge {
    lSite: Site;
    rSite: Site;
    va: Vertex;
    vb: Vertex;
  }
  export interface Cell {
    site: Site;
    halfedges: Halfedge[];
  }
  export interface SiteInput {
    x: number;
    y: number;
  }
  export interface Site {
    voronoiId: any;
    x: number;
    y: number;
  }
  export interface BoundingBox {
    xl: number;
    xr: number;
    yt: number;
    yb: number;
  }
  export interface Halfedge {
    site: Site;
    edge: Edge;
    getStartpoint: () => Vertex,
    getEndpoint: () => Vertex
  }
}

declare class Voronoi {
  compute: (sites: Voronoi.SiteInput[], boundingBox: Voronoi.BoundingBox) => Voronoi.VoronoiDiagram;
  recycle: (diagram: Voronoi.VoronoiDiagram) => void;
}

declare module 'voronoi' {
  // import * as Voronoi from 'voronoi';
  export default Voronoi;
}
