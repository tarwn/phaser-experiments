import Voronoi from "voronoi";
import { IMeshItem, Direction, IMeshNeighbor, MeshType, IO } from "./types";

export const createVoronoi = (siteCount: number, width: number, height: number, rng: seedrandom.prng): Voronoi.VoronoiDiagram => {
  const voronoi = new Voronoi();
  const boundingbox = { xl: 0, xr: width, yt: 0, yb: height };
  const sites = new Array(siteCount).fill(undefined).map(_ => ({
    x: Math.round(rng() * width),
    y: Math.round(rng() * height)
  }));
  return voronoi.compute(sites, boundingbox);
};

const getEmptyIO = (): IO => {
  return {
    water: 0,
    dirt: 0
  } as IO;
};

const createNeighbor = (site: Voronoi.Site, dir: Direction, meshItem: IMeshItem | null, halfEdge: Voronoi.Halfedge): IMeshNeighbor => ({
  site,
  dir,
  meshItem,
  halfEdge
});

export const createMesh = (voronoi: Voronoi.VoronoiDiagram, width: number, height: number): IMeshItem[] => {
  const hash = new Map<string, IMeshItem>();
  const mesh = voronoi.cells.map(c => {
    const neighbors = c.halfedges.map(h => h.edge.lSite == c.site
      ? createNeighbor(h.edge.rSite, Direction.Right, null, h)
      : createNeighbor(h.edge.lSite, Direction.Left, null, h)
    ).filter(n => n !== null && n.site !== null);
    const newItem = {
      ...c,
      points: c.halfedges.map(h => h.getStartpoint()),
      neighbors,
      isMapEdge: false,
      height: 0,
      input: getEmptyIO(),
      output: getEmptyIO(),
      type: MeshType.Land
    };
    hash.set(`${c.site.x},${c.site.y}`, newItem);
    return newItem;
  });

  mesh.forEach(m => {
    m.isMapEdge = m.points.some(m => m.x <= 0 || m.y <= 0 || m.x >= width || m.y >= height);
    m.neighbors = m.neighbors.map(n => {
      return {
        ...n,
        meshItem: hash.get(`${n.site.x},${n.site.y}`) as IMeshItem
      };
    });
  });
  return mesh;
};
