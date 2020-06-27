// Heavily adapted from:
//  https://github.com/weigert/SimpleHydrology
// - I wasn't able to port the surface normal approach over well
// - scaling acceleration for density/volumne didn't work weel either for some reason
import { IPosition, IDimensions } from "./types";

export class Drop {
  position: Phaser.Math.Vector2;
  volume: number;
  speed: Phaser.Math.Vector2;
  sediment: number;

  // external parameters
  depositionRate: number; // originally 0.08
  volumeFactor: number; // originally 100.0; //"Water Deposition Rate"

  // parameters
  dt = 1.0; // originally 1.2
  density = 1.0;  //This gives varying amounts of inertia and stuff...
  evapRate = 0.001; // temp to evap faster, was 0.001
  minVol = 0.01;
  friction = 0.1;

  constructor(x: number, y: number, waterVolumeToHeight: number, sedimentErosionRate: number) {
    this.position = new Phaser.Math.Vector2(x, y);
    this.volume = 1.0;
    this.speed = new Phaser.Math.Vector2(0.0);
    this.sediment = 0.0;
    this.volumeFactor = waterVolumeToHeight;
    this.depositionRate = sedimentErosionRate;
  };

  getSurfaceNormal(position: IPosition, heightMap: number[], dim: IPosition, scale: number, getIndex: (x: number, y: number) => number) {
    const { x, y } = position;
    // const cur = getIndex(x, y);
    const minusX = getIndex(x - 1 > 0 ? x - 1 : x, y);
    const plusX = getIndex(x + 1 < dim.x ? x + 1 : x, y);
    const minusY = getIndex(x, y - 1 > 0 ? y - 1 : y);
    const plusY = getIndex(x, y + 1 < dim.y ? y + 1 : y);

    const oppositeX = heightMap[plusX] - heightMap[minusX];
    const adjacentX = scale - -scale;
    const hypotenuseX = Math.sqrt(Math.pow(adjacentX, 2) + Math.pow(oppositeX, 2));
    const accelX = 9.807 * oppositeX / hypotenuseX;

    const oppositeY = heightMap[plusY] - heightMap[minusY];
    const adjacentY = scale - -scale;
    const hypotenuseY = Math.sqrt(Math.pow(adjacentY, 2) + Math.pow(oppositeY, 2));
    const accelY = 9.807 * oppositeY / hypotenuseY;

    return new Phaser.Math.Vector2(-accelX, 0).add(new Phaser.Math.Vector2(0, -accelY));

    // old method - accelerates wierdly
    // //  +X -> +Y
    // const a = new Phaser.Math.Vector3(1.0, 0.0, scale * (heightMap[plusX] - heightMap[cur]))
    //   .cross(new Phaser.Math.Vector3(0.0, 1.0, scale * (heightMap[plusY] - heightMap[cur])));
    // //  -X -> -Y
    // const b = new Phaser.Math.Vector3(-1.0, 0.0, scale * (heightMap[minusX] - heightMap[cur]))
    //   .cross(new Phaser.Math.Vector3(0.0, -1.0, scale * (heightMap[minusY] - heightMap[cur])));
    // // +Y -> -X
    // const c = new Phaser.Math.Vector3(0.0, 1.0, scale * (heightMap[plusY] - heightMap[cur]))
    //   .cross(new Phaser.Math.Vector3(-1.0, 0.0, scale * (heightMap[minusX] - heightMap[cur])));
    // // -Y -> + X
    // const d = new Phaser.Math.Vector3(0.0, -1.0, scale * (heightMap[minusY] - heightMap[cur]))
    //   .cross(new Phaser.Math.Vector3(1.0, 0.0, scale * (heightMap[plusX] - heightMap[cur])));
    // return a.add(b) //.add(c).add(d)
    //   .normalize();
  }

  descend(heightMap: number[], waterPath: number[], waterPool: number[], track: boolean[], getIndex: (x: number, y: number) => number, dim: IDimensions, scale) {
    // console.log(`I am at ${JSON.stringify(this.position)}, h=${heightMap[getIndex(this.position.x, this.position.y)]} and my volume is ${this.volume}`);
    while (this.volume > this.minVol) {
      // console.log("Starting a loop");
      const initialPosition = { ...this.position };
      const initialIndex = getIndex(initialPosition.x, initialPosition.y);
      track[initialIndex] = true;
      const n = this.getSurfaceNormal(initialPosition, heightMap, dim, scale, getIndex);
      // console.log(`Surface normal is ${JSON.stringify(n)}`);

      // lower friction, lower evap in streams
      const effDeposition = this.depositionRate * Math.max(0.0, 1.0 - 0 /* plant var */);
      const effFriction = this.friction * (1.0 - 0.5 * waterPath[initialIndex]);
      const effEvap = this.evapRate * (1.0 - 0.2 * waterPath[initialIndex]);

      //Newtonian Mechanics
      // console.log(`Accel1: ${JSON.stringify(n)} (${n.length()})`);
      // console.log(`Volume: ${this.volume}`);
      // console.log(`Fricti: ${this.dt * effFriction}`);
      const acceleration = new Phaser.Math.Vector2(n.x, n.y).scale(this.volume * this.density);
      //const acceleration = new Phaser.Math.Vector2(n.x, n.y);
      this.speed.add(acceleration.clone().scale(this.dt));
      this.position.add(this.speed.clone().scale(this.dt));
      this.speed.scale(1.0 - this.dt * effFriction);
      // console.log(`Accel2: ${JSON.stringify(acceleration)} (${acceleration.length()})`);
      // console.log(`Speed:  ${JSON.stringify(this.speed)} (${this.speed.length()})`);
      // console.log(`NewLoc: ${JSON.stringify(this.position)}, h=${heightMap[getIndex(this.position.x, this.position.y)]}`);

      const newIndex = getIndex(this.position.x, this.position.y);
      // bounds check - hardcoded for now
      if (this.position.x < 0 || this.position.y < 0 || this.position.x > dim.x - 1 || this.position.y > dim.y - 1) {
        this.volume = 0.0;
        // console.log(`EXIT: out of bounds: accel: ${JSON.stringify(acceleration)} (${acceleration.length()})`);
        break;
      }

      // has not accelerated
      if (/*waterPath[newIndex] > 0.1 &&*/ acceleration.length() < 0.01) {
        // console.log("EXIT: has not accelerated");
        break;
      }

      // Entered pool
      if (waterPool[newIndex] > 0.0) {
        // console.log("EXIT: has entered pool");
        break;
      }

      // Mass transfer
      const cEq = Math.max(0.0, this.speed.length() * (heightMap[initialIndex] - heightMap[newIndex]));
      const cDiff = cEq - this.sediment;
      this.sediment += this.dt * effDeposition * cDiff;
      heightMap[initialIndex] -= this.volume * this.dt * effDeposition * cDiff;
      // console.log(`sediment is now ${this.sediment} which reduced height by ${this.volume * this.dt * effDeposition * cDiff} to ${heightMap[initialIndex]}`);

      // Evaporate
      this.sediment /= 1.0 - this.dt * effEvap;
      this.volume *= 1.0 - this.dt * effEvap;
      // console.log(`evaporating, volume is now ${this.volume} and sediment at ${this.sediment}`);
    }
    if (this.volume <= this.minVol) {
      // console.log("EXIT: out of volume");
    }
  }

  flood(heightMap: number[], waterPool: number[], getIndex: (x: number, y: number) => number, dim: IDimensions) {
    const index = getIndex(this.position.x, this.position.y);
    let planeHeight = heightMap[index] + waterPool[index];
    let initialPlaneHeight = planeHeight;

    // Floodset
    let set = new Array<number>();
    let fail = 10;

    // console.log(`Volume:  ${this.volume}`);
    // console.log(`Plane H: ${planeHeight}`);
    while (this.volume > this.minVol && fail > 0) {
      set = new Array<number>();
      const size = dim.x * dim.y;

      const tried = new Array<boolean>(size).fill(false);
      let drain = undefined as IPosition | undefined;

      // console.log(`Looking for Drain`);
      // console.log(`Volume:  ${this.volume}`);
      // console.log(`Plane H: ${planeHeight}`);
      // console.log(`Cur height:  ${heightMap[index] + waterPool[index]}`);
      // console.log(`Loc:  ${JSON.stringify(this.position)}`);

      const fills: IPosition[] = [this.position];
      while (fills.length > 0) {
        const loc = fills.shift();
        if (loc == undefined) continue;
        const i = getIndex(loc.x, loc.y);

        // out of bounds: exit
        if (loc.x < 0 || loc.y < 0 || loc.x >= dim.x || loc.y >= dim.y) {
          continue;
        }

        // already tried: exit
        if (tried[i]) {
          continue;
        }
        tried[i] = true;

        // wall / boundary: exit
        if (planeHeight < heightMap[i] + waterPool[i]) {
          continue;
        }

        // Drainage point
        if (initialPlaneHeight > heightMap[i] + waterPool[i]) {
          const drainIndex = drain != undefined ? getIndex(drain.x, drain.y) : undefined;
          if (drain === undefined) {
            // no drain yet, this is the drain
            drain = loc;
          }
          else if (waterPool[drainIndex!] + heightMap[drainIndex!] < waterPool[i] + heightMap[i]) {
            // potential drain already found, but this one is lower
            drain = loc;
          }
          continue;
        }

        // This loc is part of the pool
        set.push(i);

        // Look at neighbors next
        fills.push({ x: loc.x, y: loc.y + 1 });
        fills.push({ x: loc.x, y: loc.y - 1 });
        fills.push({ x: loc.x + 1, y: loc.y + 1 });
        fills.push({ x: loc.x + 1, y: loc.y });
        fills.push({ x: loc.x + 1, y: loc.y - 1 });
        fills.push({ x: loc.x - 1, y: loc.y + 1 });
        fills.push({ x: loc.x - 1, y: loc.y });
        fills.push({ x: loc.x - 1, y: loc.y - 1 });
      }

      // perform flood
      // fill(index);

      // drainage point
      if (drain !== undefined) {
        // set the drop position and evaporate
        // - this originally did the positioning differently
        this.position = new Phaser.Math.Vector2(drain.x, drain.y);
        const drainIndex = getIndex(drain.x, drain.y);
        // console.log(`Found Drain: ${JSON.stringify(drain)} at height ${heightMap[drainIndex] + waterPool[drainIndex]}`);

        // Set the new waterlevel (slowly)
        const drainage = 0.001;
        planeHeight = (1.0 - drainage) * initialPlaneHeight + drainage * (heightMap[drainIndex] + waterPool[drainIndex]);

        // Compute the height
        set.forEach(s => {
          waterPool[s] = (planeHeight > heightMap[s]) ? (planeHeight - heightMap[s]) : 0.0;
        });

        // Remove sediment
        this.sediment *= 0.1;
        break;
      }
      else {
        // console.log("No drain found, increasing pool size");
      }

      // Get volume under plane
      let tVol = set.reduce((ttl, s) => ttl + this.volumeFactor * (planeHeight - (heightMap[s] + waterPool[s])), 0);
      // console.log(`Available volume to fill: ${tVol} from ${set.length} tiles in pool`);
      // console.log(` - Heights are ${set.map(s => heightMap[s] + waterPool[s]).join(",")}`);

      // if it's one tile, fill what's available
      // if (set.length === 1) {
      //   console.log(" - Single tile escape clause");
      //   tVol = Math.min(tVol, this.volume);
      // }

      // Partially fill the volume
      if (planeHeight == initialPlaneHeight) {
        // this is initial run - do first plane attempt
        planeHeight = initialPlaneHeight + 0.5 * (this.volume * this.volumeFactor) / set.length;
        // console.log(`Plane height init increase, now from ${initialPlaneHeight} to ${planeHeight}`);
      }
      else if (tVol <= this.volume) {
        // console.log(`!! Partial filling ${set.length} tiles with ${tVol} volume, ${tVol * this.volume} height`);
        // raise water level to plane height
        set.forEach(s => waterPool[s] = planeHeight - heightMap[s]);

        // Adjust Drop volume
        this.volume -= tVol;
        tVol = 0.0;

        // Adjust planes
        initialPlaneHeight = planeHeight > initialPlaneHeight ? planeHeight : initialPlaneHeight;
        planeHeight = initialPlaneHeight + 0.5 * (this.volume * this.volumeFactor) / set.length;
        // console.log(`Plane height increased, now from ${initialPlaneHeight} to ${planeHeight}`);
      }
      else {
        fail--;
        // console.log(`!! Plane was too high, only have ${this.volume} volume to fill with`);
        // Plane was too high, try lower plane/fraction of water volume
        //  let's try lower of a reduced value and straight math
        planeHeight = Math.min(
          planeHeight - 0.75 * Math.abs(planeHeight - initialPlaneHeight),
          initialPlaneHeight + 0.5 * (this.volume / this.volumeFactor) / set.length
        );
        // planeHeight -= 0.75 * Math.abs(planeHeight - initialPlaneHeight);  // abs is just in case this goes negative - which shouldn't happen
        // console.log(`Plane height decreased, now from ${initialPlaneHeight} to ${planeHeight}`);
      }

      // planeHeight += 0.5 * (this.volume - tVol) / set.length / this.volumeFactor; //?

    }

    // Couldn't place the volume (for some reason) so ignore this drop
    if (fail == 0) {
      // console.log("Fail: ignoring drop");
      this.volume = 0.0;
    }
  }
}
