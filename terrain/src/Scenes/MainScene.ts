import * as Phaser from "phaser";
import Voronoi from "voronoi";
import { makeNoise2D } from "open-simplex-noise";
import seedrandom = require("seedrandom");

const INITIAL_HEIGHT_SCALE_M = 1000;
const MAX_HEIGHT_SCALE_M = 8000;

export enum Status {
  NotStarted = 0,
  VoronoiCalculated = 1,
  MeshCreated = 2,
  MeshDisplayed = 3,
  MeshNoised = 4
}

enum Direction {
  Left,
  Right
}

export interface IMeshItem {
  points: Voronoi.Vertex[];
  neighbors: IMeshNeighbor[];
  isMapEdge: boolean;
  site: Voronoi.Site;
  halfedges: Voronoi.Halfedge[];
  height: number;
}

export interface IMeshNeighbor {
  site: Voronoi.Site;
  dir: Direction;
}

export class MainScene extends Phaser.Scene {
  status = Status.NotStarted;
  width: number;
  height: number;
  siteCount: number;
  seed: string;
  voronoi!: Voronoi.VoronoiDiagram;
  meshNoiseSeed!: number;
  mesh!: IMeshItem[];
  meshLines!: Phaser.GameObjects.Group;
  heightMap!: Phaser.GameObjects.Polygon[];

  constructor() {
    super("MainScene");
    this.width = 600;
    this.height = 600;
    this.siteCount = 1000;
    this.seed = "1234567";
  }

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
        this.heightMap = this.drawHeightMap(3);
        this.status = Status.MeshNoised;
        break;
    }
  }

  createVoronoi(): Voronoi.VoronoiDiagram {
    const rng = seedrandom(this.seed);
    this.meshNoiseSeed = rng();
    const voronoi = new Voronoi();
    const boundingbox = { xl: 0, xr: this.width, yt: 0, yb: this.height };
    const sites = new Array(this.siteCount).fill(undefined).map(_ => ({
      x: Math.round(rng() * this.width),
      y: Math.round(rng() * this.height)
    }));
    return voronoi.compute(sites, boundingbox);
  }

  createMesh() {
    const mesh = this.voronoi.cells.map(c => ({
      ...c,
      points: c.halfedges.map(h => h.getStartpoint()),
      neighbors: c.halfedges.map(h => h.edge.lSite == c.site ? { site: h.edge.rSite, dir: Direction.Right } : { site: h.edge.lSite, dir: Direction.Left }).filter(n => n !== null),
      isMapEdge: false,
      height: 0
    }));
    mesh.forEach(m => {
      m.isMapEdge = m.points.some(m => m.x <= 0 || m.y <= 0 || m.x >= this.width || m.y >= this.height);
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
        lines.push(this.add.line(0, 0, m.site.x, m.site.y, n.site.x, n.site.y, 0x999933, 0.25)
          .setDepth(depth)
          .setOrigin(0, 0));
      });
    });
    return lines;
  }

  applyInitialNoise(mesh: IMeshItem[]) {
    const noise2D = makeNoise2D(this.meshNoiseSeed);
    mesh.forEach(m => {
      if (m.isMapEdge) {
        m.height = -1 * INITIAL_HEIGHT_SCALE_M;
      }
      else {
        m.height = INITIAL_HEIGHT_SCALE_M - (noise2D(m.site.x, m.site.y) * INITIAL_HEIGHT_SCALE_M * 2);
      }
    });
  }

  drawHeightMap(depth: number) {
    return this.mesh.map(m => {
      const color = m.height > 0 ? 0xffffff : 0x0000ff;
      const alpha = Math.abs(m.height) / MAX_HEIGHT_SCALE_M;
      return this.add.polygon(0, 0, m.points, color, alpha)
        .setDepth(depth)
        .setOrigin(0, 0);
    });
  }
}
