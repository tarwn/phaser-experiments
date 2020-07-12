import { HexagonMesh, HexagonMeshItem } from "../../mesh/HexagonMesh";
import { IAxialPoint, MeshType, IPixelPoint } from "../../mesh/types";
import { roundTo } from "../hexUtils";
import { Mesh } from "../../mesh/Mesh";

export interface ILightMapItem {
  points: IPixelPoint[];
  dzdx: number;
  dzdy: number;
  slope: number;
  aspect: number;
};

export const getConstants = (azimuth: number, elevation: number) => {
  // convert to radians
  const alpha = Math.PI / 180 * (azimuth - 90);
  const beta = Math.PI / 180 * elevation;

  const a1 = Math.sin(beta);
  const a2 = Math.cos(beta) * Math.sin(alpha);
  const a3 = Math.cos(beta) * Math.cos(alpha);

  return {
    a1,
    a2,
    a3
  };
};


export const ShadowMapper = {
  castHexShadows: (hexMesh: HexagonMesh, waterToHeightRatio: number, sunPosition: Phaser.Math.Vector3) => {
    const getTrueHeight = (meshItem: HexagonMeshItem) => {
      if (meshItem.type == MeshType.Ocean) {
        return 0;
      }
      else {
        return roundTo(meshItem.height + (meshItem.river.pool ?? 0) * waterToHeightRatio, 4);
      }
    };

    const shadowMap = new Set<IAxialPoint>();
    hexMesh.apply(m => {
      const currentPos = new Phaser.Math.Vector3(m.site.x, m.site.y, getTrueHeight(m));
      const lightDir = sunPosition.clone().subtract(currentPos);
      lightDir.normalize();

      while (currentPos.x > 0 && currentPos.x < hexMesh.width &&
        currentPos.y > 0 && currentPos.y < hexMesh.height &&
        !currentPos.equals(sunPosition) && currentPos.z < 4000 /* max height on maps */) {

        currentPos.add(lightDir);
        const r = hexMesh.yToR(currentPos.y);
        const q = hexMesh.xToQ(currentPos.x, r);
        const meshItem = hexMesh.axialGet(q, r)!;
        if (meshItem !== m && getTrueHeight(meshItem) >= currentPos.z) {
          shadowMap.add(m.axial);
          break;
        }
      }
    });
    return shadowMap;
  },
  castVoronoiShadows: (mesh: Mesh, hexMesh: HexagonMesh, waterToHeightRatio: number, sunPosition: Phaser.Math.Vector3) => {
    const getTrueHeight = (meshItem: HexagonMeshItem) => {
      if (meshItem.type == MeshType.Ocean) {
        return 0;
      }
      else {
        return roundTo(meshItem.height + (meshItem.river.pool ?? 0) * waterToHeightRatio, 4);
      }
    };

    const shadowMap = new Array<Voronoi.Vertex[]>();
    mesh.apply(m => {
      const hexItem = hexMesh.findClosest(m.site.x, m.site.y)!;
      const currentPos = new Phaser.Math.Vector3(m.site.x, m.site.y, getTrueHeight(hexItem));
      const lightDir = sunPosition.clone().subtract(currentPos);
      lightDir.normalize();

      while (currentPos.x > 0 && currentPos.x < hexMesh.width &&
        currentPos.y > 0 && currentPos.y < hexMesh.height &&
        !currentPos.equals(sunPosition) && currentPos.z < 4000 /* max height on maps */) {

        currentPos.add(lightDir);
        const meshItem = hexMesh.findClosest(currentPos.x, currentPos.y)!;
        if (meshItem !== hexItem && getTrueHeight(meshItem) >= currentPos.z) {
          shadowMap.push(m.points);
          break;
        }
      }
    });
    return shadowMap;
  },
  castHighlights: (mesh: Mesh, hexMesh: HexagonMesh, waterToHeightRatio: number) => {
    const getTrueHeight = (meshItem: HexagonMeshItem) => {
      if (meshItem.type == MeshType.Ocean) {
        return 0;
      }
      else {
        return roundTo(meshItem.height + (meshItem.river.pool ?? 0) * waterToHeightRatio, 4);
      }
    };

    const lightMap = new Array<ILightMapItem>();
    const halfpi = Math.PI / 2;
    mesh.apply(m => {
      const hexItem = hexMesh.findClosest(m.site.x, m.site.y)!;
      const xNeighbors = [hexItem.getNeighbor(180), hexItem.getNeighbor(0)];
      const yNeighbors = [hexItem.getNeighbor(240), hexItem.getNeighbor(60)];
      if (xNeighbors[0] === undefined || xNeighbors[1] === undefined || yNeighbors[0] === undefined || yNeighbors[1] === undefined) {
        // skip, it's at the edge anyway
        return;
      }

      const dzdx = (getTrueHeight(xNeighbors[1].meshItem) - getTrueHeight(xNeighbors[0].meshItem)) / 2;
      const dzdy = (getTrueHeight(yNeighbors[1].meshItem) - getTrueHeight(yNeighbors[0].meshItem)) / 2;
      const aspect = halfpi - Math.atan2(dzdx, -dzdy);
      const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
      lightMap.push({ points: m.points, dzdx, dzdy, aspect, slope });
    });
    return lightMap;
  }
};
