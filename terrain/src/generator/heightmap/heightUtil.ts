import { IPixelPoint, IMeshItem, MeshType } from "../../mesh/types";
import { roundTo } from "../hexUtils";
import { HexagonMeshItem } from "../../mesh/HexagonMesh";


// minimal part of IMeshItem
interface IHeightPoint {
  site: IPixelPoint;
  height: number;
  type: MeshType;
}

export const getUsableHeight = (meshItem: IHeightPoint) => {
  return meshItem.type === MeshType.Ocean ? 0 : meshItem.height;
};

export const calculateSlope = (source: HexagonMeshItem, target: HexagonMeshItem, pxToKilometer: number, waterToHeightRation: number): number => {
  const getTrueHeight = (meshItem: HexagonMeshItem) => {
    if (meshItem.type == MeshType.Ocean) {
      return 0;
    }
    else {
      return roundTo(meshItem.height + (meshItem.river.pool ?? 0) * waterToHeightRation, 4);
    }
  };

  const sourceLoc = {
    xkm: source.site.x * pxToKilometer,
    ykm: source.site.y * pxToKilometer,
    heightkm: getTrueHeight(source) / 1000
  };
  const targetLoc = {
    xkm: target.site.x * pxToKilometer,
    ykm: target.site.y * pxToKilometer,
    heightkm: getTrueHeight(target) / 1000
  };

  const run = Math.abs(Phaser.Math.Distance.Between(sourceLoc.xkm, sourceLoc.ykm, targetLoc.xkm, targetLoc.ykm));
  const rise = targetLoc.heightkm - sourceLoc.heightkm;
  return rise / run;
};

export const inverseSlope = (slope: number) => {
  return -1 * slope;
};
