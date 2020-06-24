
export class Drop {
  position: Phaser.Math.Vector2;
  volume: number;
  speed: Phaser.Math.Vector2;
  sediment: number;

  // parameters
  dt = 1.2;
  density = 1.0;  //This gives varying amounts of inertia and stuff...
  evapRate = 0.001;
  depositionRate = 0.08;
  minVol = 0.01;
  friction = 0.1;
  volumeFactor = 100.0; //"Water Deposition Rate"

  constructor(x: number, y: number) {
    this.position = new Phaser.Math.Vector2(x, y);
    this.volume = 1.0;
    this.speed = new Phaser.Math.Vector2(0.0);
    this.sediment = 0.0;
  };

  getSurfaceNormal(index: number, heightMap: number[], dim: { x: number, y: number }, scale: number) {
    const a = new Phaser.Math.Vector3(0.0, scale * (heightMap[index + 1] - heightMap[index - 1]), 1.0)
      .cross(new Phaser.Math.Vector3(1.0, scale * (heightMap[index + dim.y] - heightMap[index]), 0.0));
    const b = new Phaser.Math.Vector3(0.0, scale * (heightMap[index - 1] - heightMap[index]), -1.0)
      .cross(new Phaser.Math.Vector3(-1.0, scale * (heightMap[index - dim.y] - heightMap[index]), 0.0));
    const c = new Phaser.Math.Vector3(1.0, scale * (heightMap[index + dim.y] - heightMap[index]), 0.0)
      .cross(new Phaser.Math.Vector3(0.0, scale * (heightMap[index - 1] - heightMap[index]), -1.0));
    const d = new Phaser.Math.Vector3(-1.0, scale * (heightMap[index - dim.y] - heightMap[index]), 0.0)
      .cross(new Phaser.Math.Vector3(0.0, scale * (heightMap[index + 1] - heightMap[index]), 1.0));
    return a.add(b).add(c).add(d)
      .normalize();
  }

  descend(heightMap: number[], waterPath: number[], waterPool: number[], track: boolean[], getIndex: (x: number, y: number) => number, dim: { x: number, y: number }, scale: number) {
    // console.group("Drop.descend");
    // console.log(`I am at ${JSON.stringify(this.position)} and my volume is ${this.volume}`);
    while (this.volume > this.minVol) {
      // console.log("Starting a loop");
      const initialPosition = { ...this.position };
      const initialIndex = getIndex(initialPosition.x, initialPosition.y);
      track[initialIndex] = true;
      const n = this.getSurfaceNormal(initialIndex, heightMap, dim, scale);
      // console.log(`Surface normal is ${JSON.stringify(n)}`);

      // lower friction, lower evap in streams
      const effDeposition = this.depositionRate * Math.max(0.0, 1.0 - 0 /* plant var */);
      const effFriction = this.friction * (1.0 - 0.5 * waterPath[initialIndex]);
      const effEvap = this.evapRate * (1.0 - 0.2 * waterPath[initialIndex]);

      //Newtonian Mechanics
      const acceleration = new Phaser.Math.Vector2(n.x, n.z).scale(1 / (this.volume * this.density));
      this.speed.add(acceleration.clone().scale(this.dt));
      this.position.add(this.speed.clone().scale(this.dt));
      this.speed.scale(1.0 - this.dt * effFriction);
      // console.log(`Accel is ${JSON.stringify(acceleration)} (${acceleration.length()}) and speed is ${JSON.stringify(this.speed)} (${this.speed.length()})`);
      // console.log(`I am now at ${JSON.stringify(this.position)}`);

      const newIndex = getIndex(this.position.x, this.position.y);
      // bounds check - hardcoded for now
      if (this.position.x < 0 || this.position.y < 0 || this.position.x > dim.x - 1 || this.position.y > dim.y - 1) {
        this.volume = 0.0;
        // console.log("exiting: out of bounds");
        break;
      }

      // has not accelerated
      if (waterPath[newIndex] > 0.3 && acceleration.length() < 0.01) {
        // console.log("exiting: has not accelerated");
        break;
      }

      // Entered pool
      if (waterPool[newIndex] > 0.0) {
        // console.log("exiting: has entered pool");
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
    // if (this.volume <= this.minVol) {
    //   console.log("exiting: out of volume");
    // }
    // console.groupEnd();
  }

  flood(heightMap: number[], waterPool: number[], getIndex: (x: number, y: number) => number, dim: { x: number, y: number }) {
    const index = getIndex(this.position.x, this.position.y);
    let plane = heightMap[index] + waterPool[index];
    let initialPlane = plane;

    // Floodset
    let set = new Array<number>();
    let fail = 10;

    while (this.volume > this.minVol && fail > 0) {
      set = new Array<number>();
      const size = dim.x * dim.y;

      const tried = new Array<boolean>(size).fill(false);
      let drain = 0;
      let drainFound = false;

      const fills = [index];
      while (fills.length > 0) {
        const i = fills.shift();
        if (i == undefined) break;

        if (i < 0 || i >= size - 1) {
          return;
        }

        if (tried[i]) {
          return;
        }
        tried[i] = true;

        // wall / boundary
        if (plane < heightMap[i] + waterPool[i]) {
          if (!drainFound) {
            drain = i;
          }

          else if (waterPool[drain] + heightMap[drain] < waterPool[i] + heightMap[i]) {
            drain = i;
          }

          drainFound = true;
          return;
        }

        // Part of the pool (?)
        set.push(i);
        fills.push(i + dim.y);
        fills.push(i - dim.y);
        fills.push(i + 1);
        fills.push(i - 1);
        fills.push(i + dim.y + 1);
        fills.push(i - dim.y - 1);
        fills.push(i + dim.y - 1);
        fills.push(i - dim.y + 1);
      }

      // perform flood
      // fill(index);

      // drainage point
      if (drainFound) {
        // set the drop position and evaporate
        // - this originally did the positioning differently
        this.position = new Phaser.Math.Vector2(drain % dim.y, Math.floor(drain / dim.y));

        // Set the new waterlevel (slowly)
        const drainage = 0.001;
        plane = (1.0 - drainage) * initialPlane + drain * (heightMap[drain] + waterPool[drain]);

        // Compute the height
        set.forEach(s => {
          waterPool[s] = (plane > heightMap[s]) ? (plane - heightMap[s]) : 0.0;
        });

        // Remove sediment
        this.sediment *= 0.1;
      }

      // Get volume under plane
      let tVol = set.reduce((ttl, s) => ttl + this.volumeFactor * (plane - (heightMap[s] - waterPool[s])), 0);

      // Partially fill the volumne
      if (tVol <= this.volume && initialPlane < plane) {
        // raise water level to plane height
        set.forEach(s => waterPool[s] = plane - heightMap[s]);

        // Adjust Drop volume
        this.volume -= tVol;
        tVol = 0.0; //?
      }
      else {
        // Plane was too high
        fail--;
      }

      // Adjust planes
      initialPlane = plane > initialPlane ? plane : initialPlane;
      plane += 0.5 * (this.volume - tVol) / set.length / this.volumeFactor; //?
    }

    // Couldn't place the volume (for some reason) so ignore this drop
    if (fail == 0)
      this.volume = 0.0;
  }
}
