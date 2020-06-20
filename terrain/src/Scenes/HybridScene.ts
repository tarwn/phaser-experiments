import * as Phaser from "phaser";
import Voronoi from "voronoi";
import seedrandom = require("seedrandom");
import { MeshType, IMesh, IWindMeasure } from "../mesh/types";
import { createVoronoi, getEmptyIO, Mesh } from "../mesh/Mesh";
import { MountainIslandGenerator } from "../generator/heightmap/MountainIsland";
import { BasicNoiseGenerator } from "../generator/heightmap/BasicNoise";
import { ErosionSimulation } from "../generator/heightmap/ErosionSimulation";
import { Simulation, ISimulationStepEvent } from "../generator/Simulation";
import { HexagonMesh } from "../mesh/HexagonMesh";
import { WindGenerator } from "../generator/weather/WindGenerator";

const WIDTH = 900;
const HEIGHT = 900;
const SITECOUNT = 10000;
const SEED = "1234567";
const INITIAL_HEIGHT_SCALE_M = 500;
const MAX_HEIGHT_SCALE_M = 4000;
const PEAKS = [1, .4, .4, .5];
const HEIGHT_GEN_FALLOFF = .2;
const HEXAGON_WIDTH = 7 * 1.2;
const HEXAGON_HEIGHT = 8 * 1.2;
const PX_TO_KM = 0.5; // horizantal/hex pixels per km
const INITIAL_WIND_SPEED_MPS = 6;
const INITIAL_WIND_DIR = 0;

export class HybridScene extends Phaser.Scene {
  width: number;
  height: number;
  siteCount: number;
  initialWind: IWindMeasure;
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
    coastline?: Phaser.GameObjects.Group;
    windmap?: Phaser.GameObjects.Group;
  };
  hexWidth: number;
  hexHeight: number;
  pxToKilometers: number;

  constructor() {
    super("HybridScene");
    this.width = WIDTH;
    this.height = HEIGHT;
    this.siteCount = SITECOUNT;
    this.seed = SEED;
    this.hexWidth = HEXAGON_WIDTH;
    this.hexHeight = HEXAGON_HEIGHT;
    this.initialWind = { degrees: INITIAL_WIND_DIR, strength: INITIAL_WIND_SPEED_MPS };
    this.pxToKilometers = PX_TO_KM;
  }

  // stuck on erosion - hits a steady state too early

  create() {
    this.simulation = new Simulation()
      .queue("initializeState", () => this.initializeState())
      .queue("basic noise", () => BasicNoiseGenerator.createHeightMap(this.mesh, INITIAL_HEIGHT_SCALE_M, this.rng))
      .queue("mountain island", () => MountainIslandGenerator.adjustHeightMap(this.hexMesh || this.mesh, PEAKS, HEIGHT_GEN_FALLOFF, MAX_HEIGHT_SCALE_M, INITIAL_HEIGHT_SCALE_M, this.width, this.height, this.width / 3, this.rng))
      .queue("convert to hexagonal", () => this.createHexagonalGrid())
      .queue("erosion start", () => ErosionSimulation.initialize(this.hexMesh || this.mesh, INITIAL_HEIGHT_SCALE_M))
      .repeat("erosion continue", () => ErosionSimulation.adjustHeightMap(this.hexMesh || this.mesh))
      .until((i, out, last) => i >= 10 && out != last)
      .queue("identify ocean", () => this.assignMeshType())
      .queue("calculate initial winds", () => WindGenerator.calculateWindEffect(this.hexMesh as HexagonMesh, this.initialWind))
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
        // console.log(args);
        if (args.attemptNumber % 4 === 0) {
          this.redrawHeightMap(1, this.hexMesh || this.mesh);
        }
        break;
      case "convert to hexagonal":
        this.redrawHeightMap(1, this.hexMesh || this.mesh);
        // this.redrawMesh(0, this.hexMesh || this.mesh, false);
        this.redrawMesh(0, this.mesh, true);
        break;
      case "identify ocean":
        this.redrawCoastline(2);
        break;
      case "calculate initial winds":
        this.redrawWindMap(3);
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
    this.hexMesh = new HexagonMesh(this.hexWidth, this.hexHeight, this.width, this.height, this.pxToKilometers);
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
        // lines.push(this.add.line(0, 0, m.site.x, m.site.y, n.site.x + (m.site.x - n.site.x) / 2, n.site.y + (m.site.y - n.site.y) / 2, 0x333333, 0.1)
        //   .setDepth(depth)
        //   .setOrigin(0, 0));
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
      //  more distinct bands
      // const colorAdjust = Math.floor(height / MAX_HEIGHT_SCALE_M * 20);
      // const color = Phaser.Display.Color.HSLToColor(.3, .32, .3 + colorAdjust * 2.5 / 100);
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
      // const color = m.isMapEdge ? { color: 0xff0000, alpha: 1 } : this.getHeightMapColor(m.height);
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


  redrawWindMap(depth: number) {
    if (this.graphics.windmap) {
      this.graphics.windmap.clear(true, true);
    }
    this.graphics.windmap = this.add.group(this.drawWindMap(depth));
  }
  getColorFromScale(strength: number) {
    switch (true) {
      case strength < 0.5:
        return { color: 0xcccccc, alpha: 0.1 }; // 0, Calm
      case strength <= 1.5:
        return { color: 0xccccff, alpha: 0.2 }; // 1, Light Air
      case strength <= 3.3:
        return { color: 0xccccff, alpha: 0.2 }; // 2, Light Breeze
      case strength <= 5.5:
        return { color: 0xccccff, alpha: 0.2 }; // 3. Gentle Breeze
      case strength <= 7.9:
        return { color: 0xccffff, alpha: 0.2 }; // 4. Moderate Breeze
      case strength <= 10.7:
        return { color: 0xccffff, alpha: 0.3 }; // 5. Fresh breeze
      case strength <= 13.8:
        return { color: 0xccffff, alpha: 0.3 }; // 6. Strong breeze
      case strength < 17.1:
        return { color: 0xffffcc, alpha: 0.3 }; // 7. High Wind
      case strength <= 20.7:
        return { color: 0xff9999, alpha: 0.5 }; // 8. Gale
      case strength <= 24.4:
        return { color: 0xff9999, alpha: 0.5 }; // 9. Strong Gale
      case strength <= 28.4:
        return { color: 0xff3333, alpha: 0.5 }; // 10. Storm
      case strength <= 32.6:
        return { color: 0xff3333, alpha: 0.5 }; // 11. Violent Storm
      default:
        return { color: 0xFF0000, alpha: .9 }; // 12. Hurricane
    }
    // w.strength > 50 ? 0xff9999 : 0xccccff;
  }
  drawWindMap(depth: number): any {
    // const windmap = [] as Phaser.GameObjects.Line[];
    // this.hexMesh?.apply(m => {
    //   if (m.output.wind.length > 0) {
    //     m.output.wind.forEach(w => {
    //       const wind = this.add.line(m.site.x, m.site.y, 0, 0, (this.hexWidth + this.hexHeight) / 2, 0)
    //         .setOrigin(0, 0)
    //         .setDepth(depth)
    //         .setRotation(Phaser.Math.DegToRad(w.degrees))
    //         .setStrokeStyle(w.strength, 0x660099, .25);
    //       windmap.push(wind);
    //     });
    //   }
    // });
    const windmap = [] as Phaser.GameObjects.Polygon[];
    this.hexMesh?.apply(m => {
      if (m.output.wind.length > 0 && m.axial.q % 3 == 0 && m.axial.r % 3 == 0) {
        m.output.wind.forEach(w => {
          if (w.strength > .1) {
            const points = [
              { x: 0, y: 0 },
              { x: -3, y: 3 },
              { x: -3, y: 1 },
              { x: -w.strength * 1.5, y: 1 },
              { x: -w.strength * 1.5, y: -1 },
              { x: -3, y: -1 },
              { x: -3, y: -3 }
            ];
            const color = this.getColorFromScale(w.strength);
            const wind = this.add.polygon(m.site.x, m.site.y, points, color.color, color.alpha)
              .setOrigin(0, 0)
              .setDepth(depth)
              .setRotation(Phaser.Math.DegToRad(w.degrees));
            windmap.push(wind);
          }
        });
      }
    });
    // console.log(windmap);
    return windmap;
  }
}
