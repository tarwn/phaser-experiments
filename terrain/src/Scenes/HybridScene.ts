import * as Phaser from "phaser";
import Voronoi from "voronoi";
import seedrandom = require("seedrandom");
import { MeshType, IMesh, IWindMeasure, IHumidityState, IAxialPoint, BiomeClassification } from "../mesh/types";
import { createVoronoi, Mesh, getEmptyWeather } from "../mesh/Mesh";
import { MountainIslandGenerator } from "../generator/heightmap/MountainIsland";
import { BasicNoiseGenerator } from "../generator/heightmap/BasicNoise";
import { ErosionSimulation } from "../generator/heightmap/ErosionSimulation";
import { Simulation, ISimulationStepEvent } from "../generator/Simulation";
import { HexagonMesh, HexagonMeshItem } from "../mesh/HexagonMesh";
import { WindGenerator } from "../generator/weather/wind/WindGenerator";
import { calculateSlope } from "../generator/heightmap/heightUtil";
import { HumidityGenerator } from "../generator/weather/humidity/HumidityGenerator";
import { RiverMapper } from "../generator/river/RiverMapper";
import { roundTo } from "../generator/hexUtils";
import { BiomeAssigner } from "../generator/biome/BiomeAssigner";
import { mapBiomeToColor } from "../generator/biome/Maps";
import { ShadowMapper, getConstants, ILightMapItem } from "../generator/shadowmap/ShadowMapper";

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
const EVAPORATION_RATE = 0.50;
const TRANSPIRATION_RATE = 0.01;
const PRECIPITATION_RATE = 0.025;
const PRECIPITATION_SLOPE_MULTIPLIER = 8; // magic number for more rain going uphill
const WATER_TO_HEIGHT_RATIO = 10;  // units of water to meters in height
const TEMP_AT_SEALEVEL = 18;

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
  shadowMap?: Set<IAxialPoint>;
  vShadowMap?: Array<Voronoi.Vertex[]>
  highlightMap?: Array<ILightMapItem>

  // graphics
  graphics = {} as {
    meshLines?: Phaser.GameObjects.Group;
    heightMap?: Phaser.GameObjects.Group;
    ocean?: Phaser.GameObjects.Group;
    coastline?: Phaser.GameObjects.Group;
    shadows?: Phaser.GameObjects.Group;
    lights?: Phaser.GameObjects.Group;
    windmap?: Phaser.GameObjects.Group;
    humidityMap?: Phaser.GameObjects.Group;
    rivers?: Phaser.GameObjects.Group;
    drainage?: Phaser.GameObjects.Group;
    biome?: Phaser.GameObjects.Group;
    highlightHex?: Phaser.GameObjects.Polygon;
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
    const sunPositionNW = new Phaser.Math.Vector3(this.width * 1 / 5, 0, 6000);
    const sunPositionN = new Phaser.Math.Vector3(this.width / 2, 0, 6000);

    this.simulation = new Simulation()
      .queue("initializeState", () => this.initializeState())
      .queue("basic noise", () => BasicNoiseGenerator.createHeightMap(this.mesh, INITIAL_HEIGHT_SCALE_M, this.rng))
      .queue("mountain island", () => MountainIslandGenerator.adjustHeightMap(this.hexMesh || this.mesh, PEAKS, HEIGHT_GEN_FALLOFF, MAX_HEIGHT_SCALE_M, INITIAL_HEIGHT_SCALE_M, this.width, this.height, this.width / 3, this.rng))
      .queue("convert to hexagonal", () => this.createHexagonalGrid())
      // .queue("erosion start", () => ErosionSimulation.initialize(this.hexMesh || this.mesh))
      // .repeat("erosion continue", () => ErosionSimulation.adjustHeightMap(this.hexMesh || this.mesh))
      // .until((i, out, last) => i >= 10 && out != last)
      .queue("recalculate slopes", () => this.recalculateSlopes())
      .queue("identify ocean & initialize weather", () => this.assignMeshType())
      .queue("calculate initial winds", () => WindGenerator.calculateWindEffect(this.hexMesh as HexagonMesh, this.initialWind))
      .repeat("calculate humidity & precipitation", () => HumidityGenerator.calculateHumidity(this.hexMesh as HexagonMesh, EVAPORATION_RATE, TRANSPIRATION_RATE, PRECIPITATION_RATE, PRECIPITATION_SLOPE_MULTIPLIER), 5)
      .until((i, out) => i >= 50 || out === 0)
      .repeat("calculate rivers", () => RiverMapper.calculateRivers(this.hexMesh!, WATER_TO_HEIGHT_RATIO), 5)
      .until((i, out) => i >= 5 || out === 0)
      .queue("recalculate slopes", () => this.recalculateSlopes())
      .repeat("calculate addtl humidity & precipitation", () => HumidityGenerator.calculateHumidity(this.hexMesh as HexagonMesh, EVAPORATION_RATE, TRANSPIRATION_RATE, PRECIPITATION_RATE, PRECIPITATION_SLOPE_MULTIPLIER), 5)
      .until((i, out) => i >= 20 || out === 0)
      .queue("recalculate rivers", () => RiverMapper.calculateRivers(this.hexMesh!, WATER_TO_HEIGHT_RATIO))
      .queue("calculate biomes", () => BiomeAssigner.assignBiomes(this.hexMesh!, TEMP_AT_SEALEVEL))
      .queue("calculate shadows", () => {
        this.vShadowMap = ShadowMapper.castVoronoiShadows(this.mesh, this.hexMesh!, WATER_TO_HEIGHT_RATIO, sunPositionNW);
        this.vShadowMap?.concat(ShadowMapper.castVoronoiShadows(this.mesh, this.hexMesh!, WATER_TO_HEIGHT_RATIO, sunPositionN));
      })
      .queue("calculate highlights", () => {
        this.highlightMap = ShadowMapper.castHighlights(this.mesh, this.hexMesh!, WATER_TO_HEIGHT_RATIO);
      })
      .complete();

    this.simulation.events.on('stepComplete', this.updateGraphicsFromSimulation, this);
    this.input.on('pointerdown', () => {
      if (this.hexMesh) {
        const { x, y } = this.game.input.mousePointer;
        const r = this.hexMesh.yToR(y);
        const q = this.hexMesh.xToQ(x, r);
        const hex = this.hexMesh.axialGet(q, r);
        console.log({
          axial: hex?.axial,
          river: hex?.river.river,
          height: hex?.height,
          pool: hex?.river.pool,
          biome: hex?.biome,
          biomeC: BiomeClassification[hex?.biome?.classification ?? 0],
          hex
        });
      }
    });
  }

  update() {
    if (this.simulation.canRun()) {
      this.simulation.startOneStep();
    }

    if (this.hexMesh) {
      const { x, y } = this.game.input.mousePointer;
      const r = this.hexMesh.yToR(y);
      const q = this.hexMesh.xToQ(x, r);
      const hex = this.hexMesh.axialGet(q, r);
      if (hex) {
        if (this.graphics.highlightHex) {
          this.graphics.highlightHex.destroy();
        }
        this.graphics.highlightHex = this.add.polygon(0, 0, hex.points, 0xffffff, 0)
          .setDepth(10)
          .setOrigin(0, 0)
          .setStrokeStyle(1, 0xffffff);
      }
    }
  }

  updateGraphicsFromSimulation(args: ISimulationStepEvent) {
    const DEPTH = {
      MESH_BOTTOM: 0,
      HEIGHTMAP: 1,

      BIOME_CLASSIFICATION: 3,

      HEIGHT_SHADOWS: 4,
      HEIGHT_LIGHT: 5,

      OCEAN: 6,
      COASTLINE: 7,
      RIVERS: 8,
      DRAINAGE: 9,

      BIOME_HUMIDITY: 12,
      BIOME_PRECIPITATION: 13,
      HUMIDITY: 14,
      WINDMAP: 15,
      MESH_OVERLAY: 20
    };
    switch (args.step) {
      case "initialize":
        break;
      case "basic noise":
        this.redrawMesh(DEPTH.MESH_BOTTOM, this.hexMesh || this.mesh, true);
        break;
      case "mountain island":
        this.redrawHeightMap(DEPTH.HEIGHTMAP, DEPTH.OCEAN, this.hexMesh || this.mesh);
        break;
      case "erosion start":
        this.redrawHeightMap(DEPTH.HEIGHTMAP, DEPTH.OCEAN, this.hexMesh || this.mesh);
        break;
      case "erosion continue":
        // console.log(args);
        if (args.attemptNumber % 4 === 0) {
          this.redrawHeightMap(DEPTH.HEIGHTMAP, DEPTH.OCEAN, this.hexMesh || this.mesh);
        }
        break;
      case "convert to hexagonal":
        this.redrawHeightMap(DEPTH.HEIGHTMAP, DEPTH.OCEAN, this.hexMesh || this.mesh);
        // this.redrawMesh(0, this.hexMesh || this.mesh, false);
        this.redrawMesh(DEPTH.MESH_OVERLAY, this.mesh, true);
        break;
      case "identify ocean & initialize weather":
        this.redrawHeightMap(DEPTH.HEIGHTMAP, DEPTH.OCEAN, this.hexMesh || this.mesh);
        this.redrawCoastline(DEPTH.COASTLINE);
        break;
      case "calculate initial winds":
        //this.redrawWindMap(DEPTH.WINDMAP);
        break;
      case "calculate humidity & precipitation":
      case "calculate addtl humidity & precipitation":
        if (args.attemptNumber % 5 == 0) {
          //this.redrawHumidity(DEPTH.HUMIDITY);
        }
        break;
      case "calculate rivers":
      case "recalculate rivers":
        this.redrawRivers(DEPTH.RIVERS);
        //this.redrawDrainage(DEPTH.DRAINAGE);
        break;
      case "calculate biomes":
        //this.redrawBiomeHumidity(DEPTH.BIOME_HUMIDITY);
        //this.redrawBiomePrecipitation(DEPTH.BIOME_PRECIPITATION);
        this.redrawBiomeClassifications(DEPTH.BIOME_CLASSIFICATION);
        break;
      case "calculate shadows":
      case "calculate highlights":
        this.redrawShadows(DEPTH.HEIGHT_SHADOWS, DEPTH.HEIGHT_LIGHT);
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

  recalculateSlopes() {
    this.hexMesh?.apply(m => {
      m.height = roundTo(m.height, 4);
    });
    this.hexMesh?.apply(m => {
      m.rawNeighbors.forEach(n => {
        n.edge.slope = calculateSlope(m, n.meshItem, this.pxToKilometers, WATER_TO_HEIGHT_RATIO);
      });
    });
  }

  assignMeshType() {
    const queue = [this.hexMesh?.axialGet(0, 0)!];
    const seen = new Set<IAxialPoint>();
    seen.add(queue[0].axial);
    while (queue.length > 0) {
      const item = queue.shift()!;
      if (item.height < 0) {
        item.type = MeshType.Ocean;
        item.water.state = 1;
        // set river pool?
        item.rawNeighbors.forEach(n => {
          if (!seen.has(n.meshItem.axial)) {
            seen.add(n.meshItem.axial);
            queue.push(n.meshItem);
          }
        });
      }
    }
    this.hexMesh?.apply(m => {
      if (m.water.state != 1) {
        m.type = MeshType.Land;
        if (m.height < 0) {
          m.river.pool = (-1 * m.height) / WATER_TO_HEIGHT_RATIO;
          m.water.state = 1;
        }
        else {
          m.water.state = 0;
        }
      }
      m.weather = getEmptyWeather();
    });
  }

  createHexagonalGrid() {
    this.hexMesh = new HexagonMesh(this.hexWidth, this.hexHeight, this.width, this.height, this.pxToKilometers, WATER_TO_HEIGHT_RATIO);
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
        const nonZeroNeighbors = m.rawNeighbors.filter(n => n.meshItem.height != 0);
        m.height = nonZeroNeighbors.reduce((ttl, n) => ttl + n.meshItem.height, 0) / nonZeroNeighbors.length;
      }
    });
    console.log(this.hexMesh);
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
      m.rawNeighbors.filter(n => n.site.x > m.site.x || (m.site.x == n.site.x && n.site.y > m.site.y)).forEach(n => {
        // lines.push(this.add.line(0, 0, m.site.x, m.site.y, n.site.x, n.site.y, 0x666633, 0.1)
        //   .setDepth(depth)
        //   .setOrigin(0, 0));
        lines.push(this.add.line(0, 0, m.site.x, m.site.y, n.site.x, n.site.y, 0xCCCC77, 0.025)
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

  redrawHeightMap(depth: number, depthOcean: number, mesh: IMesh) {
    if (this.graphics.heightMap) {
      this.graphics.heightMap.clear(true, true);
    }
    this.graphics.heightMap = this.add.group(this.drawHeightMap(depth, depthOcean, mesh));
  }
  getHeightMapColor(height: number) {
    if (height > 0) {
      //  more distinct bands
      // const colorAdjust = .3 + .7 * (height / MAX_HEIGHT_SCALE_M);
      // const color = Phaser.Display.Color.HSLToColor(.3, .32, colorAdjust);
      const colorAdjust = .9 + .1 * (height / MAX_HEIGHT_SCALE_M);
      const color = Phaser.Display.Color.HSLToColor(.05833, 1, colorAdjust);
      return {
        color: color.color,
        alpha: .5
      };
    }
    else {
      // return {
      //   color: 0x222299,
      //   alpha: 1 - (Math.abs(height) / INITIAL_HEIGHT_SCALE_M) * .9
      // };
      const heightMod = .05 + (1 - (Math.abs(height) / INITIAL_HEIGHT_SCALE_M)) * .3;
      return {
        color: Phaser.Display.Color.HSLToColor(.67, .64, heightMod).color,
        alpha: 1
      };
    }
  }
  drawHeightMap(depth: number, depthOcean: number, mesh: IMesh) {
    const polygons = [] as Phaser.GameObjects.Polygon[];
    mesh.apply(m => {
      // const color = m.isMapEdge ? { color: 0xff0000, alpha: 1 } : this.getHeightMapColor(m.height);
      const color = this.getHeightMapColor(m.height);
      const p = this.add.polygon(0, 0, m.points, color.color, color.alpha)
        .setOrigin(0, 0)
        .setDepth(m.type == MeshType.Ocean ? depthOcean : depth);
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
        m.rawNeighbors.forEach(n => {
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

  redrawShadows(shadowDepth: number, lightDepth: number) {
    if (this.graphics.shadows) {
      this.graphics.shadows.clear(true, true);
    }
    if (this.shadowMap) {
      this.graphics.shadows = this.add.group(this.drawShadows(shadowDepth));
    }
    else if (this.vShadowMap) {
      this.graphics.shadows = this.add.group(this.drawVShadows(shadowDepth));
    }

    if (this.graphics.lights) {
      this.graphics.lights.clear(true, true);
    }
    if (this.highlightMap) {
      this.graphics.lights = this.add.group(this.drawLightMap(lightDepth));
    }
  }
  drawShadows(depth: number): any {
    const shadows = new Phaser.GameObjects.Group(this);
    this.hexMesh?.apply(m => {
      if (this.shadowMap?.has(m.axial)) {
        const shadow = this.add.polygon(0, 0, m.points, 0x000000, 0.05)
          .setOrigin(0, 0)
          .setDepth(depth);
        shadows.add(shadow);
      }
    });
    return shadows;
  }
  drawVShadows(depth: number): any {
    const shadows = new Phaser.GameObjects.Group(this);
    this.vShadowMap?.forEach(v => {
      const shadow = this.add.polygon(0, 0, v, 0x000000, 0.05)
        .setOrigin(0, 0)
        .setDepth(depth);
      shadows.add(shadow);
    });
    return shadows;
  }
  drawLightMap(depth: number): any {
    const lights = new Phaser.GameObjects.Group(this);
    // magic numbers
    const azimuth = 330;
    const elevation = 45;
    const { a1, a2, a3 } = getConstants(azimuth, elevation);
    const z = 0.015;
    // end magic numbers
    this.highlightMap?.forEach(v => {
      const luminance = (a1 - a2 * (v.dzdx * z) - a3 * (v.dzdy * z)) / Math.sqrt(1 + (v.dzdx * z) ** 2 + (v.dzdy * z) ** 2);
      const shade = Phaser.Display.Color.HSLToColor(0, 0, luminance);
      const light = this.add.polygon(0, 0, v.points, shade.color, 0.15)
        .setOrigin(0, 0)
        .setDepth(depth);
      lights.add(light);
    });
    return lights;
  }

  redrawWindMap(depth: number) {
    if (this.graphics.windmap) {
      this.graphics.windmap.clear(true, true);
    }
    this.graphics.windmap = this.drawWindMap(depth);
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
        return { color: 0xccffff, alpha: 0.3 }; // 4. Moderate Breeze
      case strength <= 10.7:
        return { color: 0xccffff, alpha: 0.3 }; // 5. Fresh breeze
      case strength <= 13.8:
        return { color: 0xccffff, alpha: 0.4 }; // 6. Strong breeze
      case strength < 17.1:
        return { color: 0xffffcc, alpha: 0.5 }; // 7. High Wind
      case strength <= 20.7:
        return { color: 0xff9999, alpha: 0.5 }; // 8. Gale
      case strength <= 24.4:
        return { color: 0xff9999, alpha: 0.7 }; // 9. Strong Gale
      case strength <= 28.4:
        return { color: 0xff3333, alpha: 0.7 }; // 10. Storm
      case strength <= 32.6:
        return { color: 0xff3333, alpha: 0.7 }; // 11. Violent Storm
      default:
        return { color: 0xFF0000, alpha: .9 }; // 12. Hurricane
    }
    // w.strength > 50 ? 0xff9999 : 0xccccff;
  }
  drawWindMap(depth: number): any {
    // const windmap = [] as Phaser.GameObjects.Line[];
    // this.hexMesh?.apply(m => {
    //   if (m.weather.wind.state.length > 0) {
    //     m.weather.wind.state.forEach(w => {
    //       const wind = this.add.line(m.site.x, m.site.y, 0, 0, (this.hexWidth + this.hexHeight) / 2, 0)
    //         .setOrigin(0, 0)
    //         .setDepth(depth)
    //         .setRotation(Phaser.Math.DegToRad(w.degrees))
    //         .setStrokeStyle(w.strength, 0x660099, .25);
    //       windmap.push(wind);
    //     });
    //   }
    // });
    const windmap = this.add.group();
    this.hexMesh?.apply(m => {
      if (m.axial.q % 3 == 0 && m.axial.r % 3 == 0) {
        m.weather.wind.state.forEach((w, i) => {
          if (w.strength > .25) {
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
            const wind = this.add.polygon(m.site.x + i * 3, m.site.y + i * 3, points, color.color, color.alpha)
              .setOrigin(0, 0)
              .setDepth(depth)
              .setRotation(Phaser.Math.DegToRad(w.degrees));
            windmap.add(wind);

            // const text = this.add.text(m.site.x, m.site.y, Math.round(w.strength).toString())
            //   .setOrigin(0, 0)
            //   .setDepth(depth + 1)
            //   .setFontSize(8)
            //   .setAlpha(color.alpha + .2)
            //   .setStroke(color.color.toString(), 1);
            // windmap.add(text);
          }
        });
      }
    });
    // console.log(windmap);
    return windmap;
  }

  redrawHumidity(depth: number) {
    if (this.graphics.humidityMap) {
      this.graphics.humidityMap.clear(true, true);
    }
    this.graphics.humidityMap = this.drawHumidity(depth, this.hexMesh!);
  }
  getHumidityColor(humidity: IHumidityState) {
    const color = Phaser.Display.Color.HSLToColor(0, 0, 1 - humidity.sim.humidityOut / .5);
    return {
      color,
      alpha: Math.max(0.3, humidity.state / 3)
    };
    // return {
    //   color: 0xFF0000,
    //   alpha: 1
    // };
  }
  drawHumidity(depth: number, mesh: HexagonMesh) {
    const polygons = new Phaser.GameObjects.Group(this);
    mesh.apply(m => {
      if (m.humidity.state > 0) {
        // const color = m.isMapEdge ? { color: 0xff0000, alpha: 1 } : this.getHeightMapColor(m.height);
        const color = this.getHumidityColor(m.humidity);
        const p = this.add.circle(m.site.x, m.site.y, 2, color.color.color, color.alpha)
          .setOrigin(0, 0)
          .setDepth(depth);
        polygons.add(p);

        // if (m.axial.q % 3 == 0 && m.axial.r % 3 == 0 && m.type == MeshType.Land) {
        //   const text = this.add.text(m.site.x - 3.5, m.site.y - 4, Math.round(m.humidity.state * 100).toString())
        //     .setOrigin(0, 0)
        //     .setDepth(depth + 1)
        //     .setFontSize(8)
        //     .setAlpha(1)
        //     .setStroke("0xff0000", 1);
        //   polygons.add(text);
        // }

      }
    });
    return polygons;
  }

  redrawRivers(depth: number) {
    if (this.graphics.rivers) {
      this.graphics.rivers.clear(true, true);
    }
    this.graphics.rivers = this.drawRivers(depth, this.hexMesh!);
  }
  drawRivers(depth: number, mesh: HexagonMesh) {
    const polygons = new Phaser.GameObjects.Group(this);
    // const hasDrawnRiver = new Map<IAxialPoint, boolean>();
    mesh.apply(m => {
      if ((m.river.pool ?? 0) > 0) {
        const color = this.getHeightMapColor(-1 * (m.river.pool ?? 0) * WATER_TO_HEIGHT_RATIO);
        const lake = this.add.polygon(0, 0, m.points, color.color, 0.9)
          .setOrigin(0, 0)
          .setDepth(depth);
        polygons.add(lake);
      }

      if (m.river.river !== undefined && m.river.river.amount >= 1 &&
        (m.river.pool === undefined || m.river.river.to.river.pool === undefined)) {
        // const amount = Math.min(m.river.river.amount / 2, 10);
        let distance = Phaser.Math.Distance.Between(m.site.x, m.site.y, m.river.river.to.site.x, m.river.river.to.site.y);
        let start = 0;
        if (m.river.pool !== undefined) {
          start = distance / 2;
        }
        else if (m.river.river.to.river.pool !== undefined) {
          distance = distance / 2;
        }
        let width = 2;
        if (m.river.river.amount < 4) {
          width = 1;
        }
        const points = [
          start, -1 * width / 2,
          distance, -1 * width / 2,
          distance, 1 * width / 2,
          start, 1 * width / 2
        ];
        const color = this.getHeightMapColor(-50);
        const river = this.add.polygon(m.site.x, m.site.y, points, color.color, 0.9)
          .setOrigin(0, 0)
          .setDepth(depth)
          .setRotation(Phaser.Math.DegToRad(m.river.river.direction));
        polygons.add(river);
      }

    });
    return polygons;
  }
  redrawDrainage(depth: number) {
    if (this.graphics.drainage) {
      this.graphics.drainage.clear(true, true);
    }
    this.graphics.drainage = this.drawDrainage(depth, this.hexMesh!);
  }
  drawDrainage(depth: number, mesh: HexagonMesh) {
    const polygons = new Phaser.GameObjects.Group(this);
    mesh.apply(m => {
      if (m.river.river !== undefined) {
        const points = [
          { x: 8, y: 0 },
          { x: 5, y: 3 },
          { x: 5, y: 1 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
          { x: 5, y: -1 },
          { x: 5, y: -3 }
        ];
        const river = this.add.polygon(m.site.x, m.site.y, points, 0xff00ff, 0.9)
          .setOrigin(0, 0)
          .setDepth(depth + 1)
          .setRotation(Phaser.Math.DegToRad(m.river.river.direction));
        polygons.add(river);
      }
    });
    return polygons;
  }


  redrawBiomeHumidity(depth: number) {
    if (this.graphics.biome) {
      this.graphics.biome.clear(true, true);
    }
    this.graphics.biome = this.drawBiomeHumidity(depth, this.hexMesh!);
  }
  drawBiomeHumidity(depth: number, mesh: HexagonMesh) {
    const polygons = new Phaser.GameObjects.Group(this);
    const textStyle = {
      fontFamily: "Arial",
      fontSize: 8,
      color: "red"
    };
    mesh.apply(m => {
      if (m.biome) {
        const color = m.biome.humidity <= 1
          ? Phaser.Display.Color.HSLToColor(0.8, 100, 1 - .5 * m.biome.humidity)
          : Phaser.Display.Color.HSLToColor(.1, 100, .5);
        const p = this.add.polygon(0, 0, m.points, color.color, 0.75)
          .setOrigin(0, 0)
          .setDepth(depth);
        polygons.add(p);

        if (m.axial.q % 3 == 0 && m.axial.r % 3 == 0) {
          const text = this.add.text(m.site.x - 3.5, m.site.y - 4, Math.round(m.humidity.state * 100).toString(), textStyle)
            .setOrigin(0, 0)
            .setDepth(depth + 1)
            .setAlpha(1);
          polygons.add(text);
        }
      }
    });
    return polygons;
  }

  redrawBiomePrecipitation(depth: number) {
    if (this.graphics.biome) {
      this.graphics.biome.clear(true, true);
    }
    this.graphics.biome = this.drawBiomePrecipitation(depth, this.hexMesh!);
  }
  drawBiomePrecipitation(depth: number, mesh: HexagonMesh) {
    const polygons = new Phaser.GameObjects.Group(this);
    const textStyle = {
      fontFamily: "Arial",
      fontSize: 8,
      color: "red"
    };
    mesh.apply(m => {
      if (m.biome) {
        const color = m.river.sim.waterIn < 0
          ? Phaser.Display.Color.HSLToColor(0.8, 100, 1 - .5 * m.river.sim.waterIn)
          : Phaser.Display.Color.HSLToColor(.1, 100, .5);
        const p = this.add.polygon(0, 0, m.points, color.color, 0.75)
          .setOrigin(0, 0)
          .setDepth(depth);
        polygons.add(p);

        if (m.axial.q % 3 == 0 && m.axial.r % 3 == 0) {
          const text = this.add.text(m.site.x - 3.5, m.site.y - 4, Math.round(m.river.sim.waterIn * 100).toString(), textStyle)
            .setOrigin(0, 0)
            .setDepth(depth + 1)
            .setAlpha(1);
          polygons.add(text);
        }
      }
    });
    return polygons;
  }

  redrawBiomeClassifications(depth: number) {
    if (this.graphics.biome) {
      this.graphics.biome.clear(true, true);
    }
    this.graphics.biome = this.drawBiomeClassifications(depth, this.hexMesh!);
  }
  drawBiomeClassifications(depth: number, mesh: HexagonMesh) {
    const polygons = new Phaser.GameObjects.Group(this);
    mesh.apply(m => {
      if (m.biome && m.river.pool === undefined && m.type !== MeshType.Ocean) {
        const color = Phaser.Display.Color.ValueToColor(mapBiomeToColor(m.biome.classification));
        const p = this.add.polygon(0, 0, m.points, color.color, 0.5)
          .setOrigin(0, 0)
          .setDepth(depth);
        polygons.add(p);
      }
    });
    return polygons;
  }

}
