import Voronoi from "voronoi";
import { IMeshItem, Direction, MeshType, IVoronoiMeshItem, IVoronoiMeshNeighbor, IMesh, DirectionalIO, IWindMeasure, IWeatherState, IWaterState, IAxialPoint, IHumidityState, IRiverState } from "./types";

export const createVoronoi = (siteCount: number, width: number, height: number, rng: seedrandom.prng): Voronoi.VoronoiDiagram => {
  const voronoi = new Voronoi();
  const boundingbox = { xl: 0, xr: width, yt: 0, yb: height };
  const sites = new Array(siteCount).fill(undefined).map(() => ({
    x: Math.round(rng() * width),
    y: Math.round(rng() * height)
  }));
  return voronoi.compute(sites, boundingbox);
};

// export const getEmptyInput = (): IInput => {
//   return {
//     water: 0,
//     dirt: 0,
//     wind: new DirectionalIO<IWindMeasure>()
//   } as IInput;
// };
// export const getEmptyOutput = (): IOutput => {
//   return {
//     water: 0,
//     dirt: 0,
//     wind: []
//   } as IOutput;
// };

export const getEmptyWeather = (): IWeatherState => {
  return {
    wind: {
      input: new DirectionalIO<IWindMeasure>(),
      state: new Array<IWindMeasure>(),
      sources: new Map<IAxialPoint, IMeshItem>()
    }
  };
};

export const getEmptyWater = (): IWaterState => {
  return {
    state: 0,
    sim: {
      waterIn: 0,
      dirtIn: 0,
      dirtOut: 0
    }
  };
};

export const getEmptyHumidity = (): IHumidityState => {
  return {
    state: 0,
    sim: {
      humidityOut: 0,
      humidityIn: 0
    }
  };
};

export const getEmptyRiver = (): IRiverState => {
  return {
    pool: undefined,
    sim: {
      waterIn: 0,
      prevPool: undefined
    }
  };
};

// voronoi - refactor below

const createNeighbor = (site: Voronoi.Site, dir: Direction, meshItem: IMeshItem | null, halfEdge: Voronoi.Halfedge): IVoronoiMeshNeighbor => ({
  site,
  dir,
  meshItem,
  halfEdge
});


const createMesh = (voronoi: Voronoi.VoronoiDiagram): IVoronoiMeshItem[] => {
  const mesh = voronoi.cells.map(c => {
    const rawNeighbors = c.halfedges.map(h => h.edge.lSite == c.site
      ? createNeighbor(h.edge.rSite, Direction.Right, null, h)
      : createNeighbor(h.edge.lSite, Direction.Left, null, h)
    ).filter(n => n !== null && n.site !== null);
    const newItem = {
      ...c,
      points: c.halfedges.map(h => h.getStartpoint()),
      rawNeighbors,
      isMapEdge: false,
      height: 0,
      water: getEmptyWater(),
      weather: getEmptyWeather(),
      humidity: getEmptyHumidity(),
      river: getEmptyRiver(),
      biome: undefined,
      type: MeshType.Land
    };
    return newItem;
  });

  return mesh;
};

export class Mesh implements IMesh {
  meshItems: IVoronoiMeshItem[];
  hash = new Map<string, IMeshItem>();
  edges: { north: IMeshItem[]; east: IMeshItem[]; south: IMeshItem[]; west: IMeshItem[]; };
  width: number;
  height: number;

  constructor(voronoi: Voronoi.VoronoiDiagram, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.meshItems = createMesh(voronoi);
    this.edges = {
      north: [] as IMeshItem[],
      east: [] as IMeshItem[],
      south: [] as IMeshItem[],
      west: [] as IMeshItem[]
    };

    this.initializeHash();
    this.initializeEdges();
  }

  initializeHash() {
    this.apply(m => {
      this.hash.set(`${m.site.x},${m.site.y}`, m);
    });
  }

  initializeEdges() {
    this.apply(m => {
      const edgePoints = m.points.find(m => m.x <= 0 || m.y <= 0 || m.x >= this.width || m.y >= this.height);
      m.isMapEdge = edgePoints != null;
      m.rawNeighbors = m.rawNeighbors.map(n => {
        return {
          ...n,
          meshItem: this.hash.get(`${n.site.x},${n.site.y}`) as IMeshItem
        };
      });
      if (edgePoints) {
        if (edgePoints.x === 0) {
          this.edges.west.push(m);
        }
        else if (edgePoints.x === this.width) {
          this.edges.east.push(m);
        }
        if (edgePoints.y === 0) {
          this.edges.north.push(m);
        }
        else if (edgePoints.y === this.width) {
          this.edges.south.push(m);
        }
      }
    });
  }

  apply(method: (m: IVoronoiMeshItem) => void) {
    this.meshItems.forEach(method);
  }

  findClosest(x: number, y: number): IVoronoiMeshItem | undefined {
    return this.meshItems.reduce((prev, cur) => {
      if (prev == null) {
        return cur;
      }
      else if (Math.abs(Phaser.Math.Distance.Between(cur.site.x, cur.site.y, x, y)) < Math.abs(Phaser.Math.Distance.Between(prev.site.x, prev.site.y, x, y))) {
        return cur;
      }
      else {
        return prev;
      }
    });
  }

  reduce<T>(method: (prev: T, cur: IMeshItem) => T, initial: T): T {
    return this.meshItems.reduce((p, c) => method(p, c), initial);
  }

}
