// import * as Phaser from "phaser";
import { MeshType, IMeshItem, IMesh, IMeshNeighbor, IVertex, IAxialPoint, IPixelPoint, IWeatherState, IWaterState, IHumidityState, IRiverState } from "./types";
import { getEmptyWeather, getEmptyWater, getEmptyHumidity, getEmptyRiver } from "./Mesh";
import { calculateSlope } from "../generator/heightmap/heightUtil";

export interface IHexagonMeshItem extends IMeshItem {
  points: IVertex[];
  hasNeighbor: (degrees: number) => boolean;
  getNeighbor: (degrees: number) => IHexagonMeshNeighbor | undefined;
  setNeighbor: (neighbor: IHexagonMeshNeighbor, degrees: number) => void;
  rawNeighbors: IHexagonMeshNeighbor[];
  // cube or axial coords also?
  axial: IAxialPoint;
}


export interface IHexagonMeshNeighbor extends IMeshNeighbor {
  meshItem: HexagonMeshItem;
  edge: IHexagonEdge;
}

interface IHexagonEdge {
  q: number;
  r: number;
  points: IVertex[];
  degrees: number;
  slope?: number;
}

export class HexagonMeshItem implements IHexagonMeshItem {
  private _indexedNeighbors = new Map<number, IHexagonMeshNeighbor>();
  points: IVertex[];
  rawNeighbors: IHexagonMeshNeighbor[];
  axial: IAxialPoint;
  site: IPixelPoint;
  isMapEdge: boolean;
  height: number;
  water: IWaterState;
  weather: IWeatherState;
  humidity: IHumidityState;
  river: IRiverState;
  type: MeshType;

  constructor(axial: IAxialPoint, site: IPixelPoint, isMapEdge: boolean, height: number, type: MeshType, points: IVertex[]) {
    this.axial = axial;
    this.site = site;
    this.isMapEdge = isMapEdge;
    this.height = height;
    this.type = type;
    this.points = points;
    this.water = getEmptyWater();
    this.weather = getEmptyWeather();
    this.humidity = getEmptyHumidity();
    this.river = getEmptyRiver();
    this.rawNeighbors = new Array<IHexagonMeshNeighbor>();
  }

  hasNeighbor(degrees: number): boolean {
    return this._indexedNeighbors.has(degrees);
  }
  getNeighbor(degrees: number): IHexagonMeshNeighbor | undefined {
    return this._indexedNeighbors.get(degrees);
  }
  setNeighbor(neighbor: IHexagonMeshNeighbor, degrees: number) {
    this._indexedNeighbors.set(degrees, neighbor);
    this.rawNeighbors.push(neighbor);
  }
  initNeighbor(neighbor: HexagonMeshItem | undefined, q: number, r: number, edgePoints: IVertex[], degrees: number, pxToKilometers: number) {
    if (!neighbor) return;
    const slope = calculateSlope(this, neighbor, pxToKilometers);
    this.setNeighbor({
      site: neighbor.site,
      meshItem: neighbor,
      edge: { q, r, points: edgePoints, degrees, slope }
    }, degrees);
  }

}

export class HexagonMesh implements IMesh {
  hexWidth: number;
  hexHeight: number;
  meshItems!: HexagonMeshItem[];
  axialItems!: HexagonMeshItem[][];
  axialColumnCount!: number;
  axialRowCount!: number;
  edges: {
    north: HexagonMeshItem[],
    east: HexagonMeshItem[],
    south: HexagonMeshItem[],
    west: HexagonMeshItem[]
  };
  pxToKilometer: number;

  private _d: {
    halfHexWidth: number;
    quarterHexHeight: number;
    halfHexHeight: number;
    threeQuarterHexHeight: number;
  }

  constructor(hexWidth: number, hexHeight: number, width: number, height: number, pxToKilometer: number) {
    this.hexWidth = hexWidth;
    this.hexHeight = hexHeight;
    this.pxToKilometer = pxToKilometer;
    this.edges = {
      north: [] as HexagonMeshItem[],
      east: [] as HexagonMeshItem[],
      south: [] as HexagonMeshItem[],
      west: [] as HexagonMeshItem[]
    };
    this._d = {
      halfHexWidth: hexWidth / 2,
      quarterHexHeight: hexHeight / 4,
      halfHexHeight: hexHeight / 2,
      threeQuarterHexHeight: hexHeight / 4 + hexHeight / 2
    };
    this.createMeshItems(hexWidth, hexHeight, width, height);
  }

  qToX(q: number, r: number) {
    return (q + Math.floor(r / 2)) * this.hexWidth + (r % 2 == 0 ? 0 : this._d.halfHexWidth);
  }

  xToQ(x: number, r: number) {
    return Math.round(((x - (r % 2 == 0 ? 0 : this._d.halfHexWidth)) / this.hexWidth) - Math.floor(r / 2));
  }

  rToY(r: number) {
    return this._d.quarterHexHeight + (r * this._d.threeQuarterHexHeight);
  }

  yToR(y: number) {
    return Math.round((y - this._d.quarterHexHeight) / this._d.threeQuarterHexHeight);
  }

  private createMeshItems(hexWidth: number, hexHeight: number, width: number, height: number) {
    // "odd-r" layout - odd rows are offset to the right
    //  [ ][ ][ ][ ]
    //   [ ][ ][ ][ ]
    //  [ ][ ][ ][ ]
    // in a perfect width:
    //    even rows start at 0 - 1/2 tile width and end at width - centers: 0 and width - 1/2
    //    odd rows start at 0 and end at width + 1/2 tile width - centers:  0 + 1/2 and width
    // in an imperfect width we need to overlap further to the right so we'd be looking at:
    //  count of tiles on row 0 = (width + 1/2 tile width) / tile width rounded up to ensure we at least meet the edge or overflow
    //  count of tiles on row 1 = width / tile width rounded up also
    // for row count, we want to overflow at top + bottom so we don't have serrated gaps
    //  Row 0 starts at -1/4 hex height
    //  Last row must be >= width - 1/4 hex height
    //  So sizing rows at 1/4 -> 1 since o displays at 1/4, we need N rows at 3/4 height + 1 row at 1/4 to 3/4 height to fill bottom
    //    Row count = 1 + floor of height / (3/4 * hexHeight)
    //  Edges:
    //    row 0, row N and/or row N-1?
    //    col 0, col N
    const { _d } = this;

    const evenRowWidth = Math.ceil((width + _d.halfHexWidth) / hexWidth);
    // const oddRowWidth = Math.ceil(width / hexWidth);
    const oddRowWidth = evenRowWidth;
    const rowCount = 1 + Math.floor(height / _d.threeQuarterHexHeight);
    const bottomEdgeRow = ((-_d.threeQuarterHexHeight + (rowCount * hexHeight)) - width) > _d.threeQuarterHexHeight ? rowCount - 1 : rowCount;
    const meshItems = new Array<HexagonMeshItem>();

    // for axial, row r matches y, but the further down the chart the earlier q/column we're starting
    //  row 0, tile 0: r = 0, q = 0
    //  row 1, tile 0: r = 1, q = 0
    //  row 2, tile 0: r = 2, q = -1
    //  row 3, tile 0: r = 3, q = -1
    //  so r <- y
    //  so q <- -floor(y/2) + x
    //
    const columnCount = Math.max(Math.floor(rowCount / 2) + 1, evenRowWidth, oddRowWidth);
    this.axialColumnCount = columnCount;
    this.axialRowCount = rowCount;
    this.axialItems = new Array(rowCount)
      .fill(undefined)
      .map(() => new Array(columnCount).fill(undefined));

    for (let r = 0; r < rowCount; r++) {
      for (let qish = 0; qish < evenRowWidth; qish++) {
        // qish is not q, it's 0 indexed which is useful, but true q will be calculated below

        const isEvenRow = (r % 2 === 0);
        // skip the last tile on odd rows if it isn't needed
        if (isEvenRow && qish === evenRowWidth) continue;
        const rowWidth = isEvenRow ? evenRowWidth : oddRowWidth;

        const axial = {
          q: -Math.floor(r / 2) + qish,
          r
        };
        const site = {
          x: this.qToX(axial.q, axial.r),
          y: this.rToY(axial.r)
        };


        // points, clockwise from top
        const points = [
          { x: site.x, y: site.y - _d.halfHexHeight },
          { x: site.x + _d.halfHexWidth, y: site.y - _d.quarterHexHeight },
          { x: site.x + _d.halfHexWidth, y: site.y + _d.quarterHexHeight },
          { x: site.x, y: site.y + _d.halfHexHeight },
          { x: site.x - _d.halfHexWidth, y: site.y + _d.quarterHexHeight },
          { x: site.x - _d.halfHexWidth, y: site.y - _d.quarterHexHeight }
        ];
        const isMapEdge = (qish === 0 || qish === rowWidth - 1 || r === 0 || r === bottomEdgeRow);
        const newItem = new HexagonMeshItem(axial, site, isMapEdge, 0, MeshType.Land, points);

        meshItems.push(newItem);
        this.axialSet(newItem.axial.q, newItem.axial.r, newItem);

        // add to edges list
        if (qish === 0) {
          this.edges.west.push(newItem);
        }
        if (qish === rowWidth - 1) {
          this.edges.east.push(newItem);
        }
        if (r === 0) {
          this.edges.north.push(newItem);
        }
        if (r === bottomEdgeRow) {
          this.edges.south.push(newItem);
        }
      }
    }
    this.meshItems = meshItems;

    // calculate neighbors
    this.apply(m => {
      m.initNeighbor(this.axialGet(m.axial.q + 1, m.axial.r - 1), 1, -1, [m.points[0], m.points[1]], 300, this.pxToKilometer);
      m.initNeighbor(this.axialGet(m.axial.q + 1, m.axial.r + 0), 1, 0, [m.points[1], m.points[2]], 0, this.pxToKilometer);
      m.initNeighbor(this.axialGet(m.axial.q + 0, m.axial.r + 1), 0, 1, [m.points[2], m.points[3]], 60, this.pxToKilometer);
      m.initNeighbor(this.axialGet(m.axial.q - 1, m.axial.r + 1), -1, 1, [m.points[3], m.points[4]], 120, this.pxToKilometer);
      m.initNeighbor(this.axialGet(m.axial.q - 1, m.axial.r + 0), -1, 0, [m.points[4], m.points[5]], 180, this.pxToKilometer);
      m.initNeighbor(this.axialGet(m.axial.q + 0, m.axial.r - 1), 0, -1, [m.points[5], m.points[0]], 240, this.pxToKilometer);
    });

    // make sure edges are populated correctly
    if (this.edges.west.length !== this.edges.east.length) {
      throw new Error(`East (${this.edges.east.length}) and West (${this.edges.west.length})edges are different sizes`);
    }
    if (this.edges.north.length !== this.edges.south.length) {
      throw new Error(`North (${this.edges.north.length}) and South (${this.edges.south.length})edges are different sizes`);
    }

    // debug output for storage of axial items
    // console.log(this.axialItems.map((r => {
    //   return r.map(q => {
    //     if (q == null)
    //       return " --- ";
    //     return `q${q.axial.q},r${q.axial.r}`;
    //   });
    // })));
  }

  axialSet(q: number, r: number, item: HexagonMeshItem) {
    const mCol = q + Math.floor(this.axialRowCount / 2);
    const mRow = r;
    this.axialItems[mRow][mCol] = item;
  }

  axialGet(q: number, r: number): HexagonMeshItem | undefined {
    if (r < 0 || r >= this.axialRowCount)
      return undefined;

    const mCol = q + Math.floor(this.axialRowCount / 2);
    const mRow = r;

    return this.axialItems[mRow][mCol];
  }

  apply(method: (m: HexagonMeshItem) => void): void {
    this.meshItems.forEach(m => method(m));
  }

  // findClosest(x: number, y: number): HexagonMeshItem | undefined {
  //   // TODO: replace this with a direct lookup or something better to find item directly
  //   return this.meshItems.find(m => {
  //     // this is close, it's using circular radius instead of actual collision so iff on the edges
  //     return Math.abs(Phaser.Math.Distance.Between(x, y, m.site.x, m.site.y)) < this.hexHeight / 2;
  //   });
  // }

  findClosest(x: number, y: number): HexagonMeshItem | undefined {
    const r = Math.round(this.yToR(y));
    const q = Math.round(this.xToQ(x, r));
    return this.axialGet(q, r);
  }

  reduce<T>(method: (prev: T, cur: IMeshItem) => T, initial: T): T {
    return this.meshItems.reduce((p, c) => method(p, c), initial);
  }
}
