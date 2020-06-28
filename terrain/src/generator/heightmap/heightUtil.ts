import { IPixelPoint, IMeshItem, MeshType } from "../../mesh/types";


// minimal part of IMeshItem
interface IHeightPoint {
  site: IPixelPoint;
  height: number;
  type: MeshType;
}

export const getUsableHeight = (meshItem: IHeightPoint) => {
  return meshItem.type === MeshType.Ocean ? 0 : meshItem.height;
};

export const calculateSlope = (source: IHeightPoint, target: IHeightPoint, pxToKilometer: number): number => {
  const sourceLoc = {
    xkm: source.site.x * pxToKilometer,
    ykm: source.site.y * pxToKilometer,
    heightkm: getUsableHeight(source) / 1000
  };
  const targetLoc = {
    xkm: target.site.x * pxToKilometer,
    ykm: target.site.y * pxToKilometer,
    heightkm: getUsableHeight(target) / 1000
  };

  const run = Math.abs(Phaser.Math.Distance.Between(sourceLoc.xkm, sourceLoc.ykm, targetLoc.xkm, targetLoc.ykm));
  const rise = targetLoc.heightkm - sourceLoc.heightkm;
  return rise / run;
};

export const inverseSlope = (slope: number) => {
  return -1 * slope;
};
