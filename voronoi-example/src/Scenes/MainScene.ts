import * as Phaser from "phaser";
import Voronoi from "voronoi";



export enum Status {
  NotStarted = 0,
  BaseDiagramCreated = 1
}

export class MainScene extends Phaser.Scene {
  width: number;
  height: number;
  siteCount: number;
  voronoi: Voronoi.VoronoiDiagram;
  shapes: { center: any; polygon: any; }[];

  constructor() {
    super("MainScene");
    this.width = 600;
    this.height = 600;
    this.siteCount = 100;
  }

  create() {

  }

  update() {
    if (!this.voronoi) {
      this.voronoi = this.createVoronoi();
      this.shapes = this.drawVoronoi(this.voronoi);
    }
  }

  drawVoronoi(voronoi: Voronoi.VoronoiDiagram) {
    return voronoi.cells.map(c => {
      const polygon = this.add.polygon(0, 0, c.halfedges.map(h => h.getStartpoint()));
      polygon.setStrokeStyle(2, 0x1a65ac);
      polygon.setDepth(1);
      polygon.setOrigin(0, 0);
      const center = this.add.circle(c.site.x, c.site.y, 4, 0xff0000);
      center.setDepth(2);
      return {
        center,
        polygon
      };
    });
  }

  createVoronoi() {
    const voronoi = new Voronoi();
    const boundingbox = { xl: 0, xr: this.width, yt: 0, yb: this.height };
    const sites = new Array(this.siteCount).fill(undefined).map(_ => ({
      x: Math.round(Math.random() * this.width),
      y: Math.round(Math.random() * this.height)
    }));
    return voronoi.compute(sites, boundingbox);
  }
}
