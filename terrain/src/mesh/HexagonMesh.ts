import { MeshType, IMeshItem, IMesh, IMeshNeighbor, IVertex } from "./types";
import { getEmptyIO } from "./Mesh";

export interface IHexagonMeshItem extends IMeshItem {
  points: IVertex[];
  neighbors: IHexagonMeshNeighbor[];
  // cube or axial coords also?
  axial: { q: number, r: number };
}

interface IHexagonMeshNeighbor extends IMeshNeighbor {
  meshItem: IHexagonMeshItem;
  edge: IHexagonEdge;
}

interface IHexagonEdge {
  q: number;
  r: number;
  points: IVertex[];
  degrees: number;
}

export class HexagonMesh implements IMesh {
  hexWidth: number;
  hexHeight: number;
  meshItems!: IHexagonMeshItem[];
  axialItems!: IHexagonMeshItem[][];
  axialColumnCount!: number;
  axialRowCount!: number;
  edges: {
    north: IHexagonMeshItem[],
    east: IHexagonMeshItem[],
    south: IHexagonMeshItem[],
    west: IHexagonMeshItem[]
  };
  pxToKilometer: number;

  constructor(hexWidth: number, hexHeight: number, width: number, height: number, pxToKilometer: number) {
    this.hexWidth = hexWidth;
    this.hexHeight = hexHeight;
    this.pxToKilometer = pxToKilometer;
    this.edges = {
      north: [] as IHexagonMeshItem[],
      east: [] as IHexagonMeshItem[],
      south: [] as IHexagonMeshItem[],
      west: [] as IHexagonMeshItem[]
    };
    this.createMeshItems(hexWidth, hexHeight, width, height);
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

    const halfHexWidth = hexWidth / 2;
    const quarterHexHeight = hexHeight / 4;
    const halfHexHeight = hexHeight / 2;
    const threeQuarterHexHeight = quarterHexHeight + halfHexHeight;
    const evenRowWidth = Math.ceil((width + halfHexWidth) / hexWidth);
    const oddRowWidth = Math.ceil(width / hexWidth);
    const rowCount = 1 + Math.floor(height / threeQuarterHexHeight);
    const bottomEdgeRow = ((-threeQuarterHexHeight + (rowCount * hexHeight)) - width) > threeQuarterHexHeight ? rowCount - 1 : rowCount;
    const meshItems = [] as IHexagonMeshItem[];

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

    for (let y = 0; y < rowCount; y++) {
      for (let x = 0; x < evenRowWidth; x++) {
        const isEvenRow = (y % 2 === 0);
        // skip the last tile on odd rows if it isn't needed
        if (isEvenRow && x === evenRowWidth) continue;
        const rowWidth = isEvenRow ? evenRowWidth : oddRowWidth;

        const site = {
          x: (x * hexWidth) + (isEvenRow ? 0 : halfHexWidth),
          y: quarterHexHeight + (y * threeQuarterHexHeight)
        };
        const axial = {
          q: -Math.floor(y / 2) + x,
          r: y
        };
        // points, clockwise from top
        const points = [
          { x: site.x, y: site.y - halfHexHeight },
          { x: site.x + halfHexWidth, y: site.y - quarterHexHeight },
          { x: site.x + halfHexWidth, y: site.y + quarterHexHeight },
          { x: site.x, y: site.y + halfHexHeight },
          { x: site.x - halfHexWidth, y: site.y + quarterHexHeight },
          { x: site.x - halfHexWidth, y: site.y - quarterHexHeight }
        ];
        const newItem = {
          site,
          axial,
          isMapEdge: (x === 0 || x === rowWidth - 1 || y === 0 || y >= bottomEdgeRow - 1),
          height: 0,
          input: getEmptyIO(),
          output: getEmptyIO(),
          type: MeshType.Land,
          // hex-specific, coming soon
          points,
          neighbors: [],
        };
        meshItems.push(newItem);
        this.axialSet(newItem.axial.q, newItem.axial.r, newItem);

        // add to edges list
        if (x === 0) {
          this.edges.west.push(newItem);
        }
        if (x === rowWidth - 1) {
          this.edges.east.push(newItem);
        }
        if (y === 0) {
          this.edges.north.push(newItem);
        }
        if (y >= bottomEdgeRow - 1) {
          this.edges.south.push(newItem);
        }
      }
    }
    this.meshItems = meshItems;

    // calculate neighbors
    this.apply(m => {
      const neighbors = [
        { neighbor: this.axialGet(m.axial.q + 1, m.axial.r - 1), edge: { q: 1, r: -1, points: [m.points[0], m.points[1]], degrees: 300 } },
        { neighbor: this.axialGet(m.axial.q + 1, m.axial.r + 0), edge: { q: 1, r: 0, points: [m.points[1], m.points[2]], degrees: 0 } },
        { neighbor: this.axialGet(m.axial.q + 0, m.axial.r + 1), edge: { q: 0, r: 1, points: [m.points[2], m.points[3]], degrees: 60 } },
        { neighbor: this.axialGet(m.axial.q - 1, m.axial.r + 1), edge: { q: -1, r: 1, points: [m.points[3], m.points[4]], degrees: 120 } },
        { neighbor: this.axialGet(m.axial.q - 1, m.axial.r + 0), edge: { q: -1, r: 0, points: [m.points[4], m.points[5]], degrees: 180 } },
        { neighbor: this.axialGet(m.axial.q + 0, m.axial.r - 1), edge: { q: 0, r: -1, points: [m.points[5], m.points[0]], degrees: 240 } },
      ].filter(n => n.neighbor !== undefined) as { neighbor: IHexagonMeshItem, edge: IHexagonEdge }[];
      m.neighbors = neighbors.map(n => ({
        site: n.neighbor.site,
        meshItem: n.neighbor,
        edge: n.edge
      }));
    });

    // debug output for storage of axial items
    // console.log(this.axialItems.map((r => {
    //   return r.map(q => {
    //     if (q == null)
    //       return " --- ";
    //     return `q${q.axial.q},r${q.axial.r}`;
    //   });
    // })));
  }

  axialSet(q: number, r: number, item: IHexagonMeshItem) {
    const mCol = q + Math.floor(this.axialRowCount / 2);
    const mRow = r;
    this.axialItems[mRow][mCol] = item;
  }

  axialGet(q: number, r: number): IHexagonMeshItem | undefined {
    if (r < 0 || r >= this.axialRowCount)
      return undefined;

    const mCol = q + Math.floor(this.axialRowCount / 2);
    const mRow = r;

    return this.axialItems[mRow][mCol];
  }

  apply(method: (m: IHexagonMeshItem) => void): void {
    this.meshItems.forEach(m => method(m));
  }

  findClosest(x: number, y: number): IHexagonMeshItem | undefined {
    // TODO: replace this with a direct lookup or something better to find item directly
    return this.meshItems.find(m => {
      // this is close, it's using circular radius instead of actual collision so iff on the edges
      return Math.abs(Phaser.Math.Distance.Between(x, y, m.site.x, m.site.y)) < this.hexHeight / 2;
    });
  }

  reduce<T>(method: (prev: T, cur: IMeshItem) => T, initial: T): T {
    return this.meshItems.reduce((p, c) => method(p, c), initial);
  }
}
