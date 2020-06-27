import * as Phaser from "phaser";
import IsoPlugin, { IsoSprite, IsoScene } from "phaser3-plugin-isometric";
import seedrandom = require("seedrandom");
import { makeNoise2D } from "open-simplex-noise";
import { Simulation, ISimulationStepEvent } from "../Simulation";
import { Drop } from "../water/Drop";

const WIDTH = 600;
const HEIGHT = 600;
const SCALE = 4; // how much scale to apply to tile x/y when calculating slope/accel
const NOISE_SCALE = 1;
const SEED = "abc";
// const DIM = { x: 256, y: 256 };
const DIM = { x: 40, y: 40 };
const TILE_SIZE = 20;
const MAX_HEIGHT = 40;
// how much height does 1 drop add to a tile if it pools
const DROP_VOLUME_TO_HEIGHT_FACTOR = 1;
// how much sediment can wash away rom a single tile as drop moves
const SEDIMENT_EROSION_AS_HEIGHT_FACTOR = 0.18;
// how many drops to generate
const LOOP_COUNT = 10000;
// frequency to log output - larger is less frequenct is faster
const LOOP_LOG_COUNT = 1000;
// frequency to update graphics
const LOOP_GRAPHICS_COUNT = 10;

export class BasicScene extends Phaser.Scene {
  heightMap!: number[];
  originalHeightMap!: number[];
  waterPath!: number[];
  waterPool!: number[];
  track!: boolean[];
  erodedCount = 0;
  simulation!: Simulation;
  graphics = {
    heightMap: new Array<IsoSprite>(DIM.x * DIM.y),
    waterPool: new Array<IsoSprite | undefined>(DIM.x * DIM.y),
    waterPath: new Array<IsoSprite | undefined>(DIM.x * DIM.y)
  };
  isoGroup!: Phaser.GameObjects.Group;
  rng!: seedrandom.prng;

  constructor() {
    super({
      key: "BasicScene",
      mapAdd: { isoPlugin: "iso" }
    });
  }

  preload() {
    this.load.scenePlugin({
      key: 'IsoPlugin',
      url: IsoPlugin,
      sceneKey: 'iso'
    });
    this.load.spritesheet("blank", "assets/blank.png", {
      frameWidth: 4,
      frameHeight: 4,
      startFrame: 0
    });
  }

  create() {
    this.isoGroup = this.add.group();
    this.iso.projector.origin.setTo(0.5, -0.25);
    this.cameras.main.setZoom(.5);

    this.rng = seedrandom(SEED);
    this.heightMap = new Array(DIM.x * DIM.y).fill(20.0);
    // console.log(this.heightMap);
    this.waterPath = new Array(DIM.x * DIM.y).fill(0.0);
    this.waterPool = new Array(DIM.x * DIM.y).fill(0.0);
    this.track = new Array(DIM.x * DIM.y).fill(false);

    this.graphics.waterPath = new Array(DIM.x * DIM.y);

    this.simulation = new Simulation()
      .queue("generate noise", () => this.generateNoise())
      .repeat("apply erosion", () => this.applyErosion(), LOOP_LOG_COUNT)
      .until((i, out, last) => i >= LOOP_COUNT)
      .queue("adjustWaterPathAfterErosion", () => this.adjustWaterPathAfterErosion())
      .complete();

    this.simulation.events.on('stepComplete', this.updateGraphicsFromSimulation, this);
  }

  update() {
    if (this.simulation.canRun()) {
      this.simulation.startOneStep();
    }
  }

  generateNoise() {
    const maxHeight = MAX_HEIGHT;
    const peaks = [
      { x: 0, y: 0, h: MAX_HEIGHT, falloff: 0.5 },
      { x: 39, y: 39, h: MAX_HEIGHT, falloff: 0.5 },
      { x: 0, y: 39, h: MAX_HEIGHT, falloff: 0.5 },
      { x: 39, y: 0, h: MAX_HEIGHT, falloff: 0.5 }
      // { x: Math.floor(this.rng() * DIM.x), y: Math.floor(this.rng() * DIM.y), h: Math.floor(this.rng() * maxHeight) },
      // { x: Math.floor(this.rng() * DIM.x), y: Math.floor(this.rng() * DIM.y), h: Math.floor(this.rng() * maxHeight) },
      // { x: Math.floor(this.rng() * DIM.x), y: Math.floor(this.rng() * DIM.y), h: Math.floor(this.rng() * maxHeight) },
      // { x: Math.floor(this.rng() * DIM.x), y: Math.floor(this.rng() * DIM.y), h: Math.floor(this.rng() * maxHeight) },
      // { x: Math.floor(this.rng() * DIM.x), y: Math.floor(this.rng() * DIM.y), h: Math.floor(this.rng() * maxHeight) }
    ];
    const noise2D = makeNoise2D(this.rng());

    for (let x = 0; x < DIM.x; x++) {
      for (let y = 0; y < DIM.y; y++) {
        // if (x === 0 || x === DIM.x - 1) {
        //   this.heightMap[this.getIndex(x, y)] = 0;
        // }
        // else {
        const ph = peaks.map(p => MAX_HEIGHT + ((p.h / p.falloff) - Phaser.Math.Distance.Between(p.x, p.y, x, y)) / (p.h / p.falloff) * p.h)
          .reduce((max, p) => p > max ? p : max, 0);
        this.heightMap[this.getIndex(x, y)] = noise2D(x, y) * NOISE_SCALE + ph;
        // }
      }
    }
    // console.log(this.heightMap);
  }

  getIndex(x: number, y: number) {
    return Math.round(x) + DIM.x * Math.round(y);
  }

  applyErosion() {
    // console.group("Drop");
    const particle = { x: Math.floor(this.rng() * DIM.x), y: Math.floor(this.rng() * DIM.y) };
    const drop = new Drop(particle.x, particle.y, DROP_VOLUME_TO_HEIGHT_FACTOR, SEDIMENT_EROSION_AS_HEIGHT_FACTOR);
    let spill = 5;
    while (drop.volume > drop.minVol && spill > 0) {
      // console.group("Drop.descend");
      drop.descend(this.heightMap, this.waterPath, this.waterPool, this.track, this.getIndex, DIM, SCALE);
      // console.groupEnd();
      if (drop.volume > drop.minVol) {
        // console.group("flood");
        drop.flood(this.heightMap, this.waterPool, this.getIndex, DIM);
        // console.groupEnd();
      }
      spill--;
    }
    // apply the tracks to the waterpath every once in a while
    this.erodedCount++;
    if (this.erodedCount >= 10) {
      this.adjustWaterPathAfterErosion();
      this.erodedCount = 0;
    }
    // console.groupEnd();
  }

  adjustWaterPathAfterErosion() {
    const lrate = 0.05; //0.01;
    for (let i = 0; i < DIM.x * DIM.y; i++) {
      this.waterPath[i] = Math.max((1.0 - lrate) * this.waterPath[i] + (this.track[i] ? 0.5 : 0.0), this.track[i] ? 0.25 : 0.0);
    }
    this.track = new Array(DIM.x * DIM.y).fill(false);
  }



  updateGraphicsFromSimulation(args: ISimulationStepEvent) {

    switch (args.step) {
      case "generate noise":
        this.originalHeightMap = [...this.heightMap];
        this.heightMap.forEach((h, i) => {
          const x = TILE_SIZE * (i % DIM.x);
          const y = TILE_SIZE * (Math.floor(i / DIM.x));
          this.graphics.heightMap[i] = this.add.isoSprite(x, y, h, 'blank');
          if (i == 0) {
            this.graphics.heightMap[i].setTint(0xff0000);
          }
          else if (i == 39) {
            this.graphics.heightMap[i].setTint(0x990000);
          }
          else if (i == DIM.x * DIM.y - DIM.x) {
            this.graphics.heightMap[i].setTint(0xffff00);
          }
          else {
            this.graphics.heightMap[i].setTint(this.getColorFromHeight(h).color);
          }
          this.graphics.heightMap[i].setScale(TILE_SIZE / 4);
          this.graphics.heightMap[i]!.setDepth(1);
        });
        this.waterPath.forEach((h, i) => {
          if (this.waterPath[i] > 0) {
            const x = TILE_SIZE * (i % DIM.x);
            const y = TILE_SIZE * (Math.floor(i / DIM.x));
            this.graphics.waterPath[i] = this.add.isoSprite(x, y, (this.heightMap[i] ?? 0) + 0.1, 'blank');
            this.graphics.waterPath[i]!.setTint(0x0055BB);
            this.graphics.waterPath[i]!.setScale(TILE_SIZE / 4);
            this.graphics.waterPath[i]!.setDepth(2);
          }
        });
        this.waterPool.forEach((h, i) => {
          if (this.waterPool[i] > 0) {
            const x = TILE_SIZE * (i % DIM.x);
            const y = TILE_SIZE * (Math.floor(i / DIM.x));
            this.graphics.waterPool[i] = this.add.isoSprite(x, y, (this.heightMap[i] ?? 0) + h, 'blank');
            this.graphics.waterPool[i]!.setTint(0xBB00BB);
            this.graphics.waterPool[i]!.setScale(TILE_SIZE / 4);
            this.graphics.waterPool[i]!.setDepth(3);
          }
        });

        break;
      case "apply erosion":
        if (args.attemptNumber % LOOP_GRAPHICS_COUNT == 0) {
          this.updateGraphics();
        }
        break;
      case "adjustWaterPathAfterErosion":
        this.updateGraphics();
        break;
    }

  }

  getColorFromHeight(height: number) {
    const colorAdjust = .2 + .2 * (height / MAX_HEIGHT);
    return Phaser.Display.Color.HSLToColor(.3, .6, colorAdjust);
  }

  updateGraphics() {
    // heightmap
    this.heightMap.forEach((h, i) => {
      if (this.originalHeightMap[i] != h) {
        if (this.graphics.heightMap[i] !== undefined) {
          this.graphics.heightMap[i].setZ(h);
          this.graphics.heightMap[i].isoZ = h;
          this.graphics.heightMap[i].setTint(this.getColorFromHeight(h).color);
          this.graphics.heightMap[i]!.setDepth(1);
          this.graphics.heightMap[i]!.setScale(TILE_SIZE / 4);
        }
      }
      this.graphics.heightMap[i]!.setAlpha(0.5);
      this.graphics.heightMap[i].setZ(h);
      this.graphics.heightMap[i].isoZ = h;
    });
    // waterpath
    this.waterPath.forEach((h, i) => {
      if (this.graphics.waterPool[i] !== undefined && this.graphics.waterPool[i] > 0) {
        // do nothing
      }
      else
        if (this.waterPath[i] > 0 && this.graphics.waterPath[i] === undefined) {
          const x = TILE_SIZE * (i % DIM.x);
          const y = TILE_SIZE * (Math.floor(i / DIM.x));
          this.graphics.waterPath[i] = this.add.isoSprite(x, y, (this.heightMap[i] ?? 0) + 0.1, 'blank');
          this.graphics.waterPath[i]?.setAlpha(h);
          this.graphics.waterPath[i]!.isoZ = (this.heightMap[i] ?? 0) + 0.1;
          this.graphics.waterPath[i]!.setTint(0x0055BB);
          this.graphics.waterPath[i]!.setDepth(2);
          this.graphics.waterPath[i]!.setScale(TILE_SIZE / 4);
        }
        else if (this.waterPath[i] > 0) {
          this.graphics.waterPath[i]!.setZ((this.heightMap[i] ?? 0) + 0.1);
          this.graphics.waterPath[i]!.isoZ = (this.heightMap[i] ?? 0) + 0.1;
          this.graphics.waterPath[i]?.setAlpha(h);
        }
        else if (this.waterPath[i] <= 0 && this.graphics.waterPath[i] !== undefined) {
          this.graphics.waterPath[i]!.destroy();
          this.graphics.waterPath[i] = undefined;
        }
      this.graphics.heightMap[i]!.setAlpha(0.5);
    });
    // waterpool
    this.waterPool.forEach((h, i) => {
      if (this.waterPool[i] > 0 && this.graphics.waterPool[i] === undefined) {
        const x = TILE_SIZE * (i % DIM.x);
        const y = TILE_SIZE * (Math.floor(i / DIM.x));
        this.graphics.waterPool[i] = this.add.isoSprite(x, y, (this.heightMap[i] ?? 0) + h, 'blank');
        this.graphics.waterPool[i]!.setTint(0x0000BB);
        this.graphics.waterPool[i]!.setDepth(3);
        this.graphics.waterPool[i]!.setScale(TILE_SIZE / 4);
      }
      else if (this.waterPool[i] > 0) {
        this.graphics.waterPool[i]!.setZ((this.heightMap[i] ?? 0) + h);
        this.graphics.waterPool[i]!.isoZ = (this.heightMap[i] ?? 0) + h;
      }
      else if (this.graphics.waterPool[i] !== undefined) {
        this.graphics.waterPool[i]!.destroy();
        this.graphics.waterPool[i] = undefined;
      }
    });
  }
}
