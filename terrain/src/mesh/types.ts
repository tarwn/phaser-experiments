import * as Phaser from "phaser";
import { combineWind } from "../generator/weather/wind/windUtil";

export enum Direction {
  Left,
  Right
}

export enum MeshType {
  Land,
  Ocean
}

export interface IWeatherState {
  wind: {
    input: DirectionalIO<IWindMeasure>;
    state: IWindMeasure[];
    sources: Map<IAxialPoint, IMeshItem>;
  }
}

export interface IWaterState {
  state: number;
  sim: {
    waterIn: number;
    dirtIn: number;
    dirtOut: number;
  }
}

export interface IRiverState {
  river?: { to: IMeshItem; direction: number; amount: number; };
  pool?: number;
  sim: {
    waterIn: number;
    prevRiver?: { to: IMeshItem; direction: number; amount: number; };
    prevPool?: number;
  }
}

export interface IHumidityState {
  state: number;
  sim: {
    humidityOut: number;
    humidityIn: number;
  };
}

// export interface IInput {
//   wind: DirectionalIO<IWindMeasure>;
//   water: number;
//   dirt: number;
// }

// export interface IOutput {
//   wind: IWindMeasure[];
//   water: number;
//   dirt: number;
// }

export class DirectionalIO<T extends IWindMeasure>{

  rawContents = new Map<number, T[]>();
  sumContents = new Map<number, T>();
  private _total = 0;
  private _averageDegrees?: number;

  add(degrees: number, item: T) {
    if (!this.sumContents.has(degrees)) {
      this.rawContents.set(degrees, [item]);
      this.sumContents.set(degrees, item);
    }
    else {
      const all = this.rawContents.get(degrees) ?? [];
      all.push(item);
      const newSum = {
        ...item,
        strength: all.reduce((ttl, a) => ttl + a.strength, 0),
        source: 'sum'
      };
      this.sumContents.set(degrees, newSum);
    }
    const total = combineWind(this.mapSum(w => w));
    this._total = Math.round(total.strength * 10) / 10;
    this._averageDegrees = Math.round(total.degrees);
  }

  hasAny() {
    return this.sumContents.size > 0;
  }

  getLength() {
    return this.rawContents.size;
  }

  getFirst() {
    return this.sumContents.values().next().value as T | undefined;
  }

  has(degrees: number) {
    return this.sumContents.has(degrees);
  }

  hasExactly(degrees: number, strength: number) {
    const items = this.rawContents.get(degrees);
    if (!items) {
      return false;
    }

    return items.find(i => i.strength === strength) !== undefined;
  }

  getSum(degrees: number) {
    return this.sumContents.get(degrees);
  }

  getTotal() {
    return this._total;
  }

  getAveragedDegrees() {
    return this._averageDegrees;
  }

  getRaw(degrees: number) {
    return this.rawContents.get(degrees) ?? new Array<T>();
  }

  isSame(other: DirectionalIO<T>) {
    // https://stackoverflow.com/questions/35948335/how-can-i-check-if-two-map-objects-are-equal
    if (this.rawContents.size !== other.rawContents.size) {
      return false;
    }
    for (const [key, val] of this.rawContents) {
      const testVal = other.rawContents.get(key);
      // in cases of an undefined value, make sure the key
      // actually exists on the object so there are no false positives
      if (testVal !== val || (testVal === undefined && !other.rawContents.has(key))) {
        return false;
      }
    }
    return true;
  }

  mapSum<TI>(method: (i: T) => TI) {
    const res = new Array<TI>();
    this.sumContents.forEach(v => {
      res.push(method(v));
    });
    return res;
  }

  forEachSum(method: (i: T) => void) {
    this.sumContents.forEach(v => {
      method(v);
    });
  }
}

export interface IWindMeasure {
  degrees: number;
  strength: number;
  source?: string
}

export interface IMesh {
  findClosest(x: number, y: number): IMeshItem | undefined;
  apply(method: (m: IMeshItem) => void): void;
  reduce<T>(method: (prev: T, cur: IMeshItem) => T, initial: T): T
}

export interface IMeshItem {
  site: IPixelPoint;
  isMapEdge: boolean;
  height: number;
  water: IWaterState;
  weather: IWeatherState;
  humidity: IHumidityState;
  river: IRiverState;
  type: MeshType;
  rawNeighbors: IMeshNeighbor[];
  points: IVertex[];
}

export interface IAxialPoint {
  q: number;
  r: number;
}

export interface IPixelPoint {
  x: number;
  y: number;
}

export interface IVertex {
  x: number;
  y: number;
}

export interface IMeshNeighbor {
  site: IPixelPoint;
  meshItem: IMeshItem | null;
}

export interface IVoronoiMeshItem extends IMeshItem {
  points: Voronoi.Vertex[];
  rawNeighbors: IVoronoiMeshNeighbor[];
  site: Voronoi.Site;
  halfedges: Voronoi.Halfedge[];
}

export interface IVoronoiMeshNeighbor extends IMeshNeighbor {
  dir: Direction;
  halfEdge: Voronoi.Halfedge;
}


