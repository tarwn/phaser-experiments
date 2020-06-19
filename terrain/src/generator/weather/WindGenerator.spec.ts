import { calculateWindOutput, calculateNeighborStrengths, WindGenerator, applyInitialWind } from "./WindGenerator";
import { IMeshItem, MeshType, IWindMeasure } from "../../mesh/types";
import { getEmptyIO } from "../../mesh/Mesh";
import { IHexagonMeshItem, HexagonMesh } from "../../mesh/HexagonMesh";

const getSampleMeshItem = (overrides?: any): IHexagonMeshItem => {
  return {
    site: { x: 0, y: 0 },
    axial: { q: 0, r: 0 },
    isMapEdge: false,
    height: 1,
    input: getEmptyIO(),
    output: getEmptyIO(),
    type: MeshType.Land,
    neighbors: [],
    points: [],
    ...overrides
  } as IHexagonMeshItem;
};

const roundDirs = (dirs: { [key: string]: number }): { [key: string]: number } => {
  const res = { ...dirs };
  Object.keys(res).forEach(k => {
    res[k] = Math.round(res[k] * 100) / 100;
  });
  return res;
};

const getEmptyDirectionsWith = (overrides?: any): { [key: string]: number } => {
  const res = {
    0: 0,
    60: 0,
    120: 0,
    180: 0,
    240: 0,
    300: 0,
    ...overrides
  };
  return roundDirs(res);
};

describe("WindGenerator", () => {
  describe("calculateWindOutput", () => {
    it("returns single vector when provided", () => {
      const meshItem = getSampleMeshItem();
      meshItem.input.wind = [{
        degrees: 320,
        strength: 8.2
      }];

      const output = calculateWindOutput(meshItem, 1);

      expect(output?.degrees).toBe(320);
      expect(output?.strength).toBe(8.2);
    });

    it("returns empty set if no inputs", () => {
      const meshItem = getSampleMeshItem();
      meshItem.input.wind = [];

      const output = calculateWindOutput(meshItem, 1);

      expect(output).toEqual(undefined);
    });

    it("maintains the wind strength when travelling on level terrain", () => {
      // 10mps wind travelling SW 1km
      //  wind speed loss is a magic number
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: 1000, site: { x: 1, y: 0 } });
      meshItem.input.wind = [{
        degrees: 45,
        strength: 10
      }];
      meshItem.neighbors.push({
        // originating edge is uphill
        site: { x: 0, y: 0 },
        meshItem: getSampleMeshItem({ height: 1000, site: { x: 0, y: 0 } }),
        edge: { degrees: 45 + 180, q: 0, r: 0, points: [] }
      });

      const output = calculateWindOutput(meshItem, pxPerKilometer);

      expect(output?.degrees).toBe(45);
      expect(output?.strength).toBe(10);
      // console.log(output.strength);
    });

    it("treats water as level terrain", () => {
      // 10mps wind travelling SW 1km
      //  wind speed loss is a magic number
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: -1000, site: { x: 1, y: 0 }, type: MeshType.Ocean });
      meshItem.input.wind = [{
        degrees: 45,
        strength: 10
      }];
      meshItem.neighbors.push({
        // originating edge is uphill
        site: { x: 0, y: 0 },
        meshItem: getSampleMeshItem({ height: 0, site: { x: 0, y: 0 }, type: MeshType.Ocean }),
        edge: { degrees: 45 + 180, q: 0, r: 0, points: [] }
      });

      const output = calculateWindOutput(meshItem, pxPerKilometer);

      expect(output?.degrees).toBe(45);
      expect(output?.strength).toBe(10);
      // console.log(output.strength);
    });


    it("reduces the wind strength when travelling uphill", () => {
      // 10mps wind travelling SW 1km and uphill 1km
      //  wind speed loss is a magic number
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: 1000, site: { x: 1, y: 0 } });
      meshItem.input.wind = [{
        degrees: 45,
        strength: 10
      }];
      meshItem.neighbors.push({
        // originating edge is downhill
        site: { x: 0, y: 0 },
        meshItem: getSampleMeshItem({ height: 0, site: { x: 0, y: 0 } }),
        edge: { degrees: 45 + 180, q: 0, r: 0, points: [] }
      });

      const output = calculateWindOutput(meshItem, pxPerKilometer);

      expect(output?.degrees).toBe(45);
      expect(output?.strength).toBeLessThan(10);
      // console.log(output.strength);
    });

    it("increases the wind strength when travelling downhill", () => {
      // 10mps wind travelling SW 1km and downhill 1km
      //  wind speed loss is a magic number
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: 0, site: { x: 1, y: 0 } });
      meshItem.input.wind = [{
        degrees: 45,
        strength: 10
      }];
      meshItem.neighbors.push({
        // originating edge is uphill
        site: { x: 0, y: 0 },
        meshItem: getSampleMeshItem({ height: 1000, site: { x: 0, y: 0 } }),
        edge: { degrees: 45 + 180, q: 0, r: 0, points: [] }
      });

      const output = calculateWindOutput(meshItem, pxPerKilometer);

      expect(output?.degrees).toBe(45);
      expect(output?.strength).toBeGreaterThan(10);
      // console.log(output.strength);
    });

  });

  describe("calculateNeighborStrengths", () => {
    test.each`
      degrees   | strength | expected
      ${0}      | ${8.2}   | ${{ 0: 8.2 }}
      ${60}     | ${8.2}   | ${{ 60: 8.2 }}
      ${120}    | ${8.2}   | ${{ 120: 8.2 }}
      ${180}    | ${8.2}   | ${{ 180: 8.2 }}
      ${240}    | ${8.2}   | ${{ 240: 8.2 }}
      ${300}    | ${8.2}   | ${{ 300: 8.2 }}
    `("calculates a single vector to a single hex correctly", ({ degrees, strength, expected }) => {
      const input = {
        degrees,
        strength
      } as IWindMeasure;

      const output = calculateNeighborStrengths(input);

      expect(output).toStrictEqual(getEmptyDirectionsWith(expected));
    });

    test.each`
      degrees    | strength | expected
      ${30}      | ${8.2}   | ${{ 0: 4.1, 60: 4.1 }}
      ${90}      | ${8.2}   | ${{ 60: 4.1, 120: 4.1 }}
      ${150}     | ${8.2}   | ${{ 120: 4.1, 180: 4.1 }}
      ${210}     | ${8.2}   | ${{ 180: 4.1, 240: 4.1 }}
      ${270}     | ${8.2}   | ${{ 240: 4.1, 300: 4.1 }}
      ${330}     | ${8.2}   | ${{ 300: 4.1, 0: 4.1 }}
    `("calculates a single vector to an even split between hexes correctly", ({ degrees, strength, expected }) => {
      const input = {
        degrees,
        strength
      } as IWindMeasure;

      const output = calculateNeighborStrengths(input);

      expect(output).toStrictEqual(getEmptyDirectionsWith(expected));
    });

    test.each`
      degrees    | strength | expected
      ${45}      | ${8.2}   | ${{ 0: 15 / 60 * 8.2, 60: 45 / 60 * 8.2 }}
      ${22}      | ${8.2}   | ${{ 0: 38 / 60 * 8.2, 60: 22 / 60 * 8.2 }}
      ${123}     | ${8.2}   | ${{ 120: 57 / 60 * 8.2, 180: 3 / 60 * 8.2 }}
    `("calculates a single vector to uneven splits between hexes correctly", ({ degrees, strength, expected }) => {
      const input = {
        degrees,
        strength
      } as IWindMeasure;

      const output = calculateNeighborStrengths(input);

      expect(roundDirs(output)).toStrictEqual(getEmptyDirectionsWith(expected));
    });
  });

  describe("applyInitialWind", () => {
    it("applies 0 degree wind to west cells only", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 0, strength: 10 };

      applyInitialWind(mesh, initialWind);

      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      mesh.edges.west.forEach(m => {
        expect(m.input.wind).toStrictEqual([{ degrees: 0, strength: 10 }]);
        alreadyChecked.set(m.axial, true);
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toStrictEqual([]);
        }
      });
    });
    it("applies 60 degree wind to west + north cells only - but not NW corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 60, strength: 10 };

      applyInitialWind(mesh, initialWind);


      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      const corner = mesh.edges.north[0];
      if (corner) {
        expect(corner.input.wind).toEqual([]);
        alreadyChecked.set(corner.axial, true);
      }
      mesh.edges.west.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 60, strength: 10 }]);
        }
        alreadyChecked.set(m.axial, true);
      });
      mesh.edges.north.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 60, strength: 10 }]);
        }
        alreadyChecked.set(m.axial, true);
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([]);
        }
      });
    });
    it("applies 120 degree wind to east + north cells only - not not NE corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 120, strength: 10 };

      applyInitialWind(mesh, initialWind);

      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      const corner = mesh.edges.north[mesh.edges.north.length - 1];
      if (corner) {
        expect(corner.input.wind).toEqual([]);
        alreadyChecked.set(corner.axial, true);
      }
      mesh.edges.east.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 120, strength: 10 }]);
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.edges.north.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 120, strength: 10 }]);
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([]);
        }
      });
    });
    it("applies 180 degree wind to east cells only", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 180, strength: 10 };

      applyInitialWind(mesh, initialWind);

      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      mesh.edges.east.forEach(m => {
        expect(m.input.wind).toEqual([{ degrees: 180, strength: 10 }]);
        alreadyChecked.set(m.axial, true);
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([]);
        }
      });
    });
    it("applies 240 degree wind to east + south cells only - but not SE corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 240, strength: 10 };

      applyInitialWind(mesh, initialWind);

      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      const corner = mesh.edges.south[mesh.edges.south.length - 1];
      if (corner) {
        expect(corner.input.wind).toEqual([]);
        alreadyChecked.set(corner.axial, true);
      }
      mesh.edges.east.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 240, strength: 10 }]);
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.edges.south.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 240, strength: 10 }]);
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([]);
        }
      });
    });
    it("applies 300 degree wind to west + south cells only - but not SW corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 300, strength: 10 };

      applyInitialWind(mesh, initialWind);

      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      const corner = mesh.edges.south[0];
      if (corner) {
        expect(corner.input.wind).toEqual([]);
        alreadyChecked.set(corner.axial, true);
      }
      mesh.edges.west.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 300, strength: 10 }]);
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.edges.south.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 300, strength: 10 }]);
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([]);
        }
      });
    });
    it("applies 45 as 0 + 60 degree wind to west + north cells only", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 45, strength: 10 };

      applyInitialWind(mesh, initialWind);


      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      // TODO - what about NW corner?
      // const corner = mesh.edges.north[0];
      // if(corner){
      //   expect(corner.input.wind).toEqual([]);
      //   alreadyChecked.set(corner.axial, true);
      // }
      mesh.edges.west.forEach(m => {
        expect(m.input.wind).toEqual([{ degrees: 45, strength: 2.5 }, { degrees: 45, strength: 7.5 }]);
        alreadyChecked.set(m.axial, true);
      });
      mesh.edges.north.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([{ degrees: 45, strength: 7.5 }]);
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind).toEqual([]);
        }
      });
    });
  });


  describe("calculateWindEffect", () => {
    it("generates even initial wind for 0 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 0, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      mesh.meshItems.forEach(m => {
        expect(m.output.wind).toEqual([{ degrees: 0, strength: 10 }]);
      });
    });

    it("generates even initial wind for 60 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 60, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      mesh.meshItems.forEach(m => {
        // if (m.axial.r == 0 && m.axial.q == 0)
        //   expect(m.output.wind).toEqual([]);
        // else
        expect(m.output.wind).toEqual([{ degrees: 60, strength: 10 }]);
      });
    });

    it("generates even initial wind for 45 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 45, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      debugMesh(mesh);
      mesh.meshItems.forEach(m => {
        expect(m.output.wind).toEqual([{ degrees: 45, strength: 10 }]);
      });
    });
  });
});

function debugMesh(mesh: HexagonMesh) {
  console.log({
    mesh: mesh.meshItems.map(mi => JSON.stringify({
      axial: mi.axial,
      wind: mi.output.wind
    }))
  });
}
