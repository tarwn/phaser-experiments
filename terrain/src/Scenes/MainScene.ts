import * as Phaser from "phaser";
import Voronoi from "voronoi";



export enum Status {
  NotStarted = 0,
  BaseDiagramCreated = 1
}

export class MainScene extends Phaser.Scene {
  status = Status.NotStarted;
  width: number;
  height: number;
  siteCount: number;
  voronoi!: Voronoi.VoronoiDiagram;

  constructor() {
    super("MainScene");
    this.width = 600;
    this.height = 600;
    this.siteCount = 100;
  }

  create() {

  }

  update() {
    switch (this.status) {
      case Status.NotStarted:
        const voronoi = new Voronoi();
        const boundingbox = { xl: 0, xr: this.width, yt: 0, yb: this.height };
        const sites = new Array(this.siteCount).fill(undefined).map(_ => ({
          x: Math.round(Math.random() * this.width),
          y: Math.round(Math.random() * this.height)
        }));
        this.voronoi = voronoi.compute(sites, boundingbox);
        this.status = Status.BaseDiagramCreated;

        // draw it
        const polygons = this.voronoi.cells.map(c => {
          const poly = this.add.polygon(0, 0, c.halfedges.map(h => h.getStartpoint()));
          poly.setStrokeStyle(2, 0x1a65ac);
          poly.setDepth(1);
          poly.setOrigin(0, 0);
          const center = this.add.circle(c.site.x, c.site.y, 4, 0xff0000);
          center.setDepth(2);
          return poly;
        });

        break;
    }
  }
}
