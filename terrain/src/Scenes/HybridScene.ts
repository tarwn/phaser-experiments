import * as Phaser from "phaser";
import Voronoi from "voronoi";
import seedrandom = require("seedrandom");
import { Direction, MeshType, IMesh } from "../mesh/types";
import { createVoronoi, getEmptyIO, Mesh } from "../mesh/Mesh";
import { MountainIslandGenerator } from "../generator/heightmap/MountainIsland";
import { BasicNoiseGenerator } from "../generator/heightmap/BasicNoise";
import { ErosionSimulation } from "../generator/heightmap/ErosionSimulation";
import { Simulation, ISimulationStepEvent } from "../generator/Simulation";
import { HexagonMesh } from "../mesh/HexagonMesh";

const WIDTH = 600;
const HEIGHT = 600;
const SITECOUNT = 10000;
const SEED = "1234567";
const INITIAL_HEIGHT_SCALE_M = 500;
const MAX_HEIGHT_SCALE_M = 4000;
const PEAKS = [1, .4, .4, .5];
const HEIGHT_GEN_FALLOFF = .15;
const HEXAGON_WIDTH = 7 * 9 / 10;
const HEXAGON_HEIGHT = 8 * 9 / 10;

export class HybridScene extends Phaser.Scene {
  width: number;
  height: number;
  siteCount: number;
  seed: string;
  simulation!: Simulation;
  // mesh
  rng!: seedrandom.prng;
  voronoi!: Voronoi.VoronoiDiagram;
  mesh!: Mesh;
  hexMesh?: HexagonMesh;

  // graphics
  graphics = {} as {
    meshLines?: Phaser.GameObjects.Group;
    heightMap?: Phaser.GameObjects.Group;
    coastline?: any;
  };
  hexWidth: number;
  hexHeight: number;

  constructor() {
    super("HybridScene");
    this.width = WIDTH;
    this.height = HEIGHT;
    this.siteCount = SITECOUNT;
    this.seed = SEED;
    this.hexWidth = HEXAGON_WIDTH;
    this.hexHeight = HEXAGON_HEIGHT;
  }

  // stuck on erosion - hits a steady state too early

  create() {
    this.simulation = new Simulation()
      .queue("initializeState", () => this.initializeState())
      .queue("basic noise", () => BasicNoiseGenerator.createHeightMap(this.mesh, INITIAL_HEIGHT_SCALE_M, this.rng))
      .queue("mountain island", () => MountainIslandGenerator.adjustHeightMap(this.hexMesh || this.mesh, PEAKS, HEIGHT_GEN_FALLOFF, MAX_HEIGHT_SCALE_M, INITIAL_HEIGHT_SCALE_M, this.width, this.height, this.rng))
      .queue("convert to hexagonal", () => this.createHexagonalGrid())
      .queue("erosion start", () => ErosionSimulation.initialize(this.hexMesh || this.mesh, INITIAL_HEIGHT_SCALE_M))
      .repeat("erosion continue", () => ErosionSimulation.adjustHeightMap(this.hexMesh || this.mesh))
      .until((i, out, last) => i >= 10 && out != last)
      .queue("identify ocean", () => this.assignMeshType())
      .complete();

    this.simulation.events.on('stepComplete', this.updateGraphicsFromSimulation, this);
  }

  update() {
    if (this.simulation.canRun()) {
      this.simulation.startOneStep();
    }
  }

  updateGraphicsFromSimulation(args: ISimulationStepEvent) {
    switch (args.step) {
      case "initialize":
        break;
      case "basic noise":
        this.redrawMesh(0, this.hexMesh || this.mesh, true);
        break;
      case "mountain island":
        this.redrawHeightMap(1, this.hexMesh || this.mesh);
        break;
      case "erosion start":
        this.redrawHeightMap(1, this.hexMesh || this.mesh);
        break;
      case "erosion continue":
        if (args.attemptNumber % 4 === 0) {
          this.redrawHeightMap(1, this.hexMesh || this.mesh);
        }
        break;
      case "convert to hexagonal":
        this.redrawHeightMap(1, this.hexMesh || this.mesh);
        this.redrawMesh(0, this.hexMesh || this.mesh, false);
        break;
      case "identify ocean":
        this.redrawCoastline(2);
        break;
    }
  }

  initializeState() {
    console.log(`Creating voronoi: seed "${this.seed}"`);
    this.rng = seedrandom(this.seed);
    this.voronoi = createVoronoi(this.siteCount, this.width, this.height, this.rng);
    console.log('Calculating mesh');
    this.mesh = new Mesh(this.voronoi, this.width, this.height);
  }

  assignMeshType() {
    this.hexMesh?.apply(m => {
      if (m.height < 0) {
        m.type = MeshType.Ocean;
      }
      m.input = getEmptyIO();
      m.output = getEmptyIO();
    });
  }

  createHexagonalGrid() {
    this.hexMesh = new HexagonMesh(this.hexWidth, this.hexHeight, this.width, this.height);
    this.mesh.apply(m => {
      const hexM = this.hexMesh?.findClosest(m.site.x, m.site.y);
      if (hexM) {
        hexM.height = m.height;
      }
    });
    // fill in gaps
    let ctr = 0;
    this.hexMesh.apply(m => {
      if (m.height === 0) {
        ctr++;
        const nonZeroNeighbors = m.neighbors.filter(n => n.meshItem.height != 0);
        m.height = nonZeroNeighbors.reduce((ttl, n) => ttl + n.meshItem.height, 0) / nonZeroNeighbors.length;
      }
    });
    console.log(`${ctr} hex tiles had to be post-averaged from neighbors`);
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


  redrawMesh(depth: number, mesh: IMesh, centerOnly: boolean) {
    if (this.graphics.meshLines) {
      this.graphics.meshLines.clear(true, true);
    }
    if (centerOnly) {
      this.graphics.meshLines = this.add.group(this.drawCenterPointMesh(depth, mesh));
    }
    else {
      this.graphics.meshLines = this.add.group(this.drawPolyMesh(depth, mesh));
    }
  }
  drawCenterPointMesh(depth: number, mesh: IMesh): Phaser.GameObjects.Line[] {
    const lines = [] as Phaser.GameObjects.Line[];
    mesh.apply(m => {
      // the filter is so we only draw connections once, not once from each side (double draw)
      m.neighbors.filter(n => n.site.x > m.site.x || (m.site.x == n.site.x && n.site.y > m.site.y)).forEach(n => {
        lines.push(this.add.line(0, 0, m.site.x, m.site.y, n.site.x, n.site.y, 0x666633, 0.1)
          .setDepth(depth)
          .setOrigin(0, 0));
      });
    });
    return lines;
  }
  drawPolyMesh(depth: number, mesh: IMesh): Phaser.GameObjects.Polygon[] {
    const polygons = [] as Phaser.GameObjects.Polygon[];
    mesh.apply(m => {
      const p = this.add.polygon(0, 0, m.points)
        .setStrokeStyle(1, 0x666633, 0.1)
        .setOrigin(0, 0)
        .setDepth(depth);
      polygons.push(p);
    });
    return polygons;
  }

  redrawHeightMap(depth: number, mesh: IMesh) {
    if (this.graphics.heightMap) {
      this.graphics.heightMap.clear(true, true);
    }
    this.graphics.heightMap = this.add.group(this.drawHeightMap(depth, mesh));
  }
  getHeightMapColor(height: number) {
    if (height > 0) {
      const colorAdjust = .3 + .7 * (height / MAX_HEIGHT_SCALE_M);
      const color = Phaser.Display.Color.HSLToColor(.3, .32, colorAdjust);
      return {
        color: color.color,
        alpha: .5
      };
    }
    else {
      return {
        color: 0x222299,
        alpha: 1 - (Math.abs(height) / INITIAL_HEIGHT_SCALE_M) * .9
      };
    }
  }
  drawHeightMap(depth: number, mesh: IMesh) {
    const polygons = [] as Phaser.GameObjects.Polygon[];
    mesh.apply(m => {
      const color = this.getHeightMapColor(m.height);
      const p = this.add.polygon(0, 0, m.points, color.color, color.alpha)
        .setOrigin(0, 0)
        .setDepth(depth);
      polygons.push(p);
    });
    return polygons;
  }

  redrawCoastline(depth: number) {
    if (this.graphics.coastline) {
      this.graphics.coastline.clear(true, true);
    }
    this.graphics.coastline = this.add.group(this.drawCoastline(depth));
  }
  drawCoastline(depth: number): any {
    const coastline = [] as Phaser.GameObjects.Line[];
    this.hexMesh?.apply(m => {
      if (m.type === MeshType.Ocean) {
        m.neighbors.forEach(n => {
          if (n.meshItem?.type === MeshType.Land) {
            const line = this.add.line(0, 0, n.edge.points[0].x, n.edge.points[0].y, n.edge.points[1].x, n.edge.points[1].y, 0x000000, 0.3)
              .setOrigin(0, 0)
              .setDepth(depth)
              .setLineWidth(1);
            coastline.push(line);
          }
        });
      }
    });
    return coastline;
  }


}
