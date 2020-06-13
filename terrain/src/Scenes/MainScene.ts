import * as Phaser from "phaser";
import Voronoi from "voronoi";
import { makeNoise2D } from "open-simplex-noise";
import seedrandom = require("seedrandom");

const INITIAL_HEIGHT_SCALE_M = 500;
const MAX_HEIGHT_SCALE_M = 8000;
const PEAKS = [1, .4, .4, .5];
const HEIGHT_GEN_FALLOFF = .25;

export enum Status {
  NotStarted = 0,
  VoronoiCalculated = 1,
  MeshCreated = 2,
  MeshDisplayed = 3,
  MeshNoised = 4,
  HeightMapComplete = 5,
  SimulatingErosion = 6,
  ErosionDone = 7
}

enum Direction {
  Left,
  Right
}

enum MeshType {
  Land,
  Ocean
}

export interface IO {
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
}


function getEmptyIO(): IO {
  return {
    water: 0,
    dirt: 0
  };
}

export class MainScene extends Phaser.Scene {
  status = Status.NotStarted;
  width: number;
  height: number;
  siteCount: number;
  seed: string;
  voronoi!: Voronoi.VoronoiDiagram;
  mesh!: IMeshItem[];
  meshLines!: Phaser.GameObjects.Group;
  heightMap!: Phaser.GameObjects.Group;
  rng!: seedrandom.prng;
  simulationState: any;

  constructor() {
    super("MainScene");
    this.width = 600;
    this.height = 600;
    this.siteCount = 10000;
    this.seed = "1234567";
  }

  // stuck on erosion - hits a steady state too early

  update() {
    switch (this.status) {
      case Status.NotStarted:
        console.log(`Creating voronoi: seed "${this.seed}"`);
        this.voronoi = this.createVoronoi();
        this.status = Status.VoronoiCalculated;
        break;
      case Status.VoronoiCalculated:
        console.log('Calculating mesh');
        this.mesh = this.createMesh();
        this.status = Status.MeshCreated;
        break;
      case Status.MeshCreated:
        console.log('Drawing mesh');
        // this.drawVoronoi();
        this.meshLines = this.add.group(this.drawMesh(2));
        this.status = Status.MeshDisplayed;
        break;
      case Status.MeshDisplayed:
        console.log('Noising mesh (initial heightmap noise)');
        this.applyInitialNoise(this.mesh);
        this.heightMap = this.add.group(this.drawHeightMap(3));
        this.status = Status.MeshNoised;
        break;
      case Status.MeshNoised:
        console.log('Generating height map');
        const oldHeightMap = this.heightMap;
        this.calculateNewHeightMap();
        this.heightMap = this.add.group(this.drawHeightMap(3));
        oldHeightMap.clear(true, true);
        this.status = Status.HeightMapComplete;
        break;
      case Status.HeightMapComplete:
        console.log('Seeding initial erosion');
        this.seedInitialErosionSimulation();
        this.simulationState = {
          counter: 0,
          remaining: 0
        };
        this.status = Status.SimulatingErosion;
        break;
      case Status.SimulatingErosion:
        console.log("Simulating initial erosion");
        this.simulationState.counter += 1;
        const remaining = this.simulateInitialErosion();
        if (this.simulationState.counter > 100 || (this.simulationState.remaining == remaining && this.simulationState.counter >= 10)) {
          this.heightMap.clear(true, true);
          this.heightMap = this.add.group(this.drawHeightMap(3));
          this.status = Status.ErosionDone;
        }
        this.simulationState.remaining = remaining;
        break;
    }
  }

  createVoronoi(): Voronoi.VoronoiDiagram {
    const rng = seedrandom(this.seed);
    const voronoi = new Voronoi();
    const boundingbox = { xl: 0, xr: this.width, yt: 0, yb: this.height };
    const sites = new Array(this.siteCount).fill(undefined).map(_ => ({
      x: Math.round(rng() * this.width),
      y: Math.round(rng() * this.height)
    }));
    this.rng = rng;
    return voronoi.compute(sites, boundingbox);
  }

  createMesh() {
    const tempHash = {} as { [key: string]: IMeshItem };
    const mesh = this.voronoi.cells.map(c => {
      const neighbors = c.halfedges.map(h => h.edge.lSite == c.site
        ? { site: h.edge.rSite, dir: Direction.Right, meshItem: null } as IMeshNeighbor
        : { site: h.edge.lSite, dir: Direction.Left, meshItem: null } as IMeshNeighbor
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
      tempHash[`${c.site.x},${c.site.y}`] = newItem;
      return newItem;
    });

    mesh.forEach(m => {
      m.isMapEdge = m.points.some(m => m.x <= 0 || m.y <= 0 || m.x >= this.width || m.y >= this.height);
      m.neighbors = m.neighbors.map(n => {
        return {
          ...n,
          meshItem: tempHash[`${n.site.x},${n.site.y}`] as IMeshItem
        };
      });
    });
    return mesh;
  }

  drawVoronoi(depth: number) {
    return this.voronoi.cells.map(c => {
      const poly = this.add.polygon(0, 0, c.halfedges.map(h => h.getStartpoint()));
      poly.setStrokeStyle(2, 0x1a65ac);
      poly.setDepth(depth);
      poly.setOrigin(0, 0);
      const center = this.add.circle(c.site.x, c.site.y, 2, 0x660000, 0.25);
      center.setDepth(2);
      return {
        center,
        polygon: poly
      };
    });
  }

  drawMesh(depth: number): Phaser.GameObjects.Line[] {
    const lines = [] as Phaser.GameObjects.Line[];
    this.mesh.forEach(m => {
      // the filter is so we only draw connections once, not once from each side (double draw)
      m.neighbors.filter(n => n.dir === Direction.Left).forEach(n => {
        lines.push(this.add.line(0, 0, m.site.x, m.site.y, n.site.x, n.site.y, 0x666633, 0.1)
          .setDepth(depth)
          .setOrigin(0, 0));
      });
    });
    return lines;
  }

  applyInitialNoise(mesh: IMeshItem[]) {
    const noise2D = makeNoise2D(this.rng());
    mesh.forEach(m => {
      if (m.isMapEdge) {
        m.height = -1 * noise2D(m.site.x, m.site.y) * INITIAL_HEIGHT_SCALE_M;
      }
      else {
        m.height = INITIAL_HEIGHT_SCALE_M - (noise2D(m.site.x, m.site.y) * INITIAL_HEIGHT_SCALE_M * 2);
      }
    });
  }

  drawHeightMap(depth: number) {
    return this.mesh.map(m => {
      if (m.height > 0) {
        const color = 0xddffdd;
        const alpha = m.height / MAX_HEIGHT_SCALE_M;
        return this.add.polygon(0, 0, m.points, color, alpha)
          .setDepth(depth)
          .setOrigin(0, 0);
      }
      else {
        const color = 0x222299;
        const alpha = 1 - Math.abs(m.height) / INITIAL_HEIGHT_SCALE_M;
        return this.add.polygon(0, 0, m.points, color, alpha)
          .setDepth(depth)
          .setOrigin(0, 0);
      }
    });
  }

  calculateNewHeightMap() {
    const peaks = PEAKS.map(p => {
      const margin = 200 * p / 1;
      return {
        x: Math.floor(this.rng() * (this.width - margin * 2)) + margin,
        y: Math.floor(this.rng() * (this.height - margin * 2)) + margin,
        height: p * MAX_HEIGHT_SCALE_M
      };
    });

    const queue = [] as IMeshItem[];
    let lowestPoint = peaks[0].height;
    // seed heights from closest mesh nodes to peaks + add their neighbors to queue
    peaks.forEach(p => {
      const closest = this.mesh.reduce((prev, cur) => {
        if (prev == null) {
          return cur;
        }
        else if (Math.abs(Phaser.Math.Distance.Between(cur.site.x, cur.site.y, p.x, p.y)) < Math.abs(Phaser.Math.Distance.Between(prev.site.x, prev.site.y, p.x, p.y))) {
          return cur;
        }
        else {
          return prev;
        }
      });
      if (closest) {
        queue.push(closest);
        closest.height = p.height;
        // using input water as a flag that we have adjusted the height already
        closest.input.water = 1;
      }
    });

    for (let i = 0; i < queue.length; i++) {
      const height = queue[i].height * (1 - this.rng() * HEIGHT_GEN_FALLOFF);
      queue[i].neighbors.forEach((n, i) => {
        if (n != null && n.meshItem != null) {
          if (n.meshItem.input.water === 0) {
            queue.push(n.meshItem);
            n.meshItem.height = height * (1 - i / 100); // just a little bit of differentiation of heights
            n.meshItem.input.water = 1;
          }
          else if (n.meshItem.height < height) {
            n.meshItem.height = (n.meshItem.height + height + height) / 3;
          }
        }
      });
      if (queue[i].height < lowestPoint) {
        lowestPoint = queue[i].height;
      }
    }

    // re-height based on range
    const totalRange = MAX_HEIGHT_SCALE_M - lowestPoint;
    const oceanDepth = INITIAL_HEIGHT_SCALE_M;
    const newRange = MAX_HEIGHT_SCALE_M + oceanDepth;
    this.mesh.forEach(m => {
      m.height = (m.height - lowestPoint) / totalRange * newRange - oceanDepth;
      if (m.height < oceanDepth) {
        m.type = MeshType.Ocean;
      }
    });
  }

  seedInitialErosionSimulation() {
    // dump a bunch of dirt, water, and erosion on it
    this.mesh.forEach(m => {
      m.output.water = 40;
      m.input.water = 0;
      m.output.dirt = 0;
      m.input.dirt = 0;

      if (m.isMapEdge) {
        m.height = -1 * INITIAL_HEIGHT_SCALE_M;
      }
    });
  }

  simulateInitialErosion() {
    //return 0;
    // erosion loop
    this.mesh.forEach(m => {
      const lowest = m.neighbors.reduce((prev, n) => {
        if (prev === null || prev.meshItem === null) {
          return n;
        }
        else if (n.meshItem && n.meshItem.height < prev.meshItem.height && n.meshItem.output.water < m.output.water) {
          return n;
        }
        else {
          return prev;
        }
      });
      if (lowest && lowest.meshItem) {
        if (m.output.water > 0 && lowest.meshItem.height < m.height) {
          // move a unit of water + up to 5% difference of dirt
          m.output.water = -1;
          lowest.meshItem.input.water += 1;
          m.output.dirt = -.1 * (m.height - lowest.meshItem.height);
          // if it's a map edge, skip: dirt erodes into the broader ocean
          if (!lowest.meshItem.isMapEdge) {
            lowest.meshItem.input.dirt += m.output.dirt;
          }
        }
      }
    });

    // apply step + return outstanding water
    return this.mesh.reduce((total, m) => {
      if (m.isMapEdge) {
        m.output.water = 0;
        m.input.water = 0;
        m.input.dirt = 0;
        m.output.dirt = 0;
      }
      else {
        m.output.water += m.input.water;
        m.input.water = 0;
        m.height += m.output.dirt;
        m.height += m.input.dirt;
        m.input.dirt = 0;
        m.output.dirt = 0;
      }
      return total + m.output.water;
    }, 0);
  }

}
