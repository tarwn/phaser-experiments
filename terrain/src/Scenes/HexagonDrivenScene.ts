import * as Phaser from "phaser";
import seedrandom = require("seedrandom");
import { MeshType } from "../mesh/types";
import { BasicNoiseGenerator } from "../generator/heightmap/BasicNoise";
import { Simulation, ISimulationStepEvent } from "../generator/Simulation";
import { HexagonMesh } from "../mesh/HexagonMesh";
import { getEmptyIO } from "../mesh/Mesh";
import { MountainIslandGenerator } from "../generator/heightmap/MountainIsland";
import { ErosionSimulation } from "../generator/heightmap/ErosionSimulation";

const WIDTH = 900;
const HEIGHT = 900;
const SITECOUNT = 10000;
// assumes pointy top/horizantal row layout, size is roughly "4" in a 7:8: https://www.redblobgames.com/grids/hexagons/
const HEXAGON_WIDTH = 7 * 1.2;
const HEXAGON_HEIGHT = 8 * 1.2;
const SEED = "1234567";
const INITIAL_HEIGHT_SCALE_M = 500;
const MAX_HEIGHT_SCALE_M = 4000;
const PEAKS = [1, .4, .4, .5];
const HEIGHT_GEN_FALLOFF = .15;

function wasteRandomNumbers(rng: seedrandom.prng) {
  // wasting randomg numbers to match voronoi island for now
  new Array(SITECOUNT).fill(undefined).map(() => ({
    x: Math.round(rng() * WIDTH),
    y: Math.round(rng() * HEIGHT)
  }));
}

export class HexagonDrivenScene extends Phaser.Scene {
  width: number;
  height: number;
  hexWidth: number;
  hexHeight: number;
  seed: string;
  simulation!: Simulation;
  // mesh
  rng!: seedrandom.prng;
  mesh!: HexagonMesh;
  // graphics
  graphics = {} as {
    mesh?: Phaser.GameObjects.Group;
    heightMap?: Phaser.GameObjects.Group;
    coastline?: Phaser.GameObjects.Group;
  };

  constructor() {
    super("HexagonDrivenScene");
    this.width = WIDTH;
    this.height = HEIGHT;
    this.hexWidth = HEXAGON_WIDTH;
    this.hexHeight = HEXAGON_HEIGHT;
    this.seed = SEED;
  }

  // stuck on erosion - hits a steady state too early

  create() {
    this.simulation = new Simulation()
      .queue("initializeState", () => this.initializeState())
      .queue("basic noise", () => BasicNoiseGenerator.createHeightMap(this.mesh, INITIAL_HEIGHT_SCALE_M, this.rng))
      .queue("mountain island", () => MountainIslandGenerator.adjustHeightMap(this.mesh, PEAKS, HEIGHT_GEN_FALLOFF, MAX_HEIGHT_SCALE_M, INITIAL_HEIGHT_SCALE_M, this.width, this.height, this.width / 3, this.rng))
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
    console.log(`Creating, seed "${this.seed}"`);
    this.rng = seedrandom(this.seed);
    // use up same number of cycles the other one did temporarily
    wasteRandomNumbers(this.rng);
    console.log('Calculating mesh');
    this.mesh = new HexagonMesh(this.hexWidth, this.hexHeight, this.width, this.height);
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

  redrawMesh(depth: number) {
    if (this.graphics.mesh) {
      this.graphics.mesh.clear(true, true);
    }
    this.graphics.mesh = this.add.group(this.drawMesh(depth));
  }
  drawMesh(depth: number): Phaser.GameObjects.Polygon[] {
    const polygons = [] as Phaser.GameObjects.Polygon[];
    this.mesh.apply(m => {
      const p = this.add.polygon(0, 0, m.points)
        .setStrokeStyle(1, 0x666633, 0.1)
        .setOrigin(0, 0)
        .setDepth(depth);
      polygons.push(p);
    });
    return polygons;
  }

  redrawHeightMap(depth: number) {
    if (this.graphics.heightMap) {
      this.graphics.heightMap.clear(true, true);
    }
    this.graphics.heightMap = this.add.group(this.drawHeightMap(depth));
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
  drawHeightMap(depth: number) {
    const polygons = [] as Phaser.GameObjects.Polygon[];
    this.mesh.apply(m => {
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
    this.mesh.apply(m => {
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


  drawDebug(depth: number) {
    this.mesh.apply(m => {
      if (m.isMapEdge) {
        this.add.polygon(0, 0, m.points, 0x0ff000, 1)
          .setOrigin(0, 0)
          .setDepth(depth + 1);
        m.neighbors.forEach(n => {
          if (n.meshItem?.type === MeshType.Land) {
            this.add.polygon(0, 0, n.meshItem.points, 0xff0000, .1)
              .setOrigin(0, 0)
              .setDepth(depth);
          }
        });
      }
    });
  }
}
