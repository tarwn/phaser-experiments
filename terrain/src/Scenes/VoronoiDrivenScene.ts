import * as Phaser from "phaser";
import Voronoi from "voronoi";
import seedrandom = require("seedrandom");
import { Direction, MeshType } from "../mesh/types";
import { createVoronoi, getEmptyIO, Mesh } from "../mesh/Mesh";
import { MountainIslandGenerator } from "../generator/heightmap/MountainIsland";
import { BasicNoiseGenerator } from "../generator/heightmap/BasicNoise";
import { ErosionSimulation } from "../generator/heightmap/ErosionSimulation";
import { Simulation, ISimulationStepEvent } from "../generator/Simulation";

const WIDTH = 600;
const HEIGHT = 600;
const SITECOUNT = 10000;
const SEED = "1234567";
const INITIAL_HEIGHT_SCALE_M = 500;
const MAX_HEIGHT_SCALE_M = 4000;
const PEAKS = [1, .4, .4, .5];
const HEIGHT_GEN_FALLOFF = .15;

export class VoronoiDrivenScene extends Phaser.Scene {
  width: number;
  height: number;
  siteCount: number;
  seed: string;
  simulation!: Simulation;
  // mesh
  rng!: seedrandom.prng;
  voronoi!: Voronoi.VoronoiDiagram;
  mesh!: Mesh;
  // graphics
  graphics = {} as {
    meshLines?: Phaser.GameObjects.Group;
    heightMap?: Phaser.GameObjects.Group;
    coastline?: any;
  };

  constructor() {
    super("VoronoiDrivenScene");
    this.width = WIDTH;
    this.height = HEIGHT;
    this.siteCount = SITECOUNT;
    this.seed = SEED;
  }

  // stuck on erosion - hits a steady state too early

  create() {
    this.simulation = new Simulation()
      .queue("initializeState", () => this.initializeState())
      .queue("basic noise", () => BasicNoiseGenerator.createHeightMap(this.mesh, INITIAL_HEIGHT_SCALE_M, this.rng))
      .queue("mountain island", () => MountainIslandGenerator.adjustHeightMap(this.mesh, PEAKS, HEIGHT_GEN_FALLOFF, MAX_HEIGHT_SCALE_M, INITIAL_HEIGHT_SCALE_M, this.width, this.height, this.rng))
      .queue("erosion start", () => ErosionSimulation.initialize(this.mesh, INITIAL_HEIGHT_SCALE_M))
      .repeat("erosion continue", () => ErosionSimulation.adjustHeightMap(this.mesh))
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
        this.redrawMesh(0);
        break;
      case "mountain island":
        this.redrawHeightMap(1);
        break;
      case "erosion start":
        this.redrawHeightMap(1);
        break;
      case "erosion continue":
        if (args.attemptNumber % 4 === 0) {
          this.redrawHeightMap(1);
        }
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
    this.mesh.apply(m => {
      if (m.height < 0) {
        m.type = MeshType.Ocean;
      }
      m.input = getEmptyIO();
      m.output = getEmptyIO();
    });
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


  redrawMesh(depth: number) {
    if (this.graphics.meshLines) {
      this.graphics.meshLines.clear(true, true);
    }
    this.graphics.meshLines = this.add.group(this.drawMesh(depth));
  }
  drawMesh(depth: number): Phaser.GameObjects.Line[] {
    const lines = [] as Phaser.GameObjects.Line[];
    this.mesh.apply(m => {
      // the filter is so we only draw connections once, not once from each side (double draw)
      m.neighbors.filter(n => n.dir === Direction.Left).forEach(n => {
        lines.push(this.add.line(0, 0, m.site.x, m.site.y, n.site.x, n.site.y, 0x666633, 0.1)
          .setDepth(depth)
          .setOrigin(0, 0));
      });
    });
    return lines;
  }

  redrawHeightMap(depth: number) {
    if (this.graphics.heightMap) {
      this.graphics.heightMap.clear(true, true);
    }
    this.graphics.heightMap = this.add.group(this.drawHeightMap(depth));
  }
  drawHeightMap(depth: number) {
    // return this.mesh.map(m => {
    //   if (m.height > 0) {
    //     const color = 0xddffdd;
    //     const alpha = m.height / MAX_HEIGHT_SCALE_M;
    //     return this.add.polygon(0, 0, m.points, color, alpha)
    //       .setDepth(depth)
    //       .setOrigin(0, 0);
    //   }
    //   else {
    //     const color = 0x222299;
    //     const alpha = 1 - Math.abs(m.height) / INITIAL_HEIGHT_SCALE_M;
    //     return this.add.polygon(0, 0, m.points, color, alpha)
    //       .setDepth(depth)
    //       .setOrigin(0, 0);
    //   }
    // });
    return this.mesh.meshItems.map(m => {
      if (m.height > 0) {
        const colorAdjust = .3 + .7 * (m.height / MAX_HEIGHT_SCALE_M);
        const color = Phaser.Display.Color.HSLToColor(.3, .32, colorAdjust);
        return this.add.polygon(0, 0, m.points, color.color, .5)
          .setDepth(depth)
          .setOrigin(0, 0);
      }
      else {
        const color = 0x222299;
        const alpha = 1 - (Math.abs(m.height) / INITIAL_HEIGHT_SCALE_M) * .9;
        return this.add.polygon(0, 0, m.points, color, alpha)
          .setDepth(depth)
          .setOrigin(0, 0);
      }
    });
  }

  redrawCoastline(depth: number) {
    if (this.graphics.coastline) {
      this.graphics.coastline.clear(true, true);
    }
    this.graphics.coastline = this.add.group(this.drawCoastline(depth));
  }
  drawCoastline(depth: number): any {
    const edges = [] as Voronoi.Halfedge[];
    this.mesh.apply(m => {
      if (m.type === MeshType.Ocean) {
        m.neighbors.forEach(n => {
          if (n.meshItem?.type === MeshType.Land) {
            edges.push(n.halfEdge);
          }
        });
      }
    });
    return edges.map(e => {
      const start = e.getStartpoint();
      const end = e.getEndpoint();
      return this.add.line(0, 0, start.x, start.y, end.x, end.y, 0x000000, .3)
        .setOrigin(0, 0)
        .setDepth(depth);
    });
  }

}
