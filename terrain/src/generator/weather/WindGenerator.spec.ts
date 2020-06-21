import { calculateWindOutput, calculateNeighborStrengths, WindGenerator, applyInitialWind } from "./WindGenerator";
import { MeshType, IWindMeasure } from "../../mesh/types";
import { HexagonMesh, HexagonMeshItem } from "../../mesh/HexagonMesh";

const getSampleMeshItem = (overrides?: any): HexagonMeshItem => {
  const item = new HexagonMeshItem(
    overrides?.axial ?? { q: 0, r: 0 },
    overrides?.site ?? { x: 0, y: 0 },
    overrides?.isMapEdge ?? false,
    overrides?.height ?? 0,
    overrides?.type ?? MeshType.Land,
    overrides?.points ?? []);
  item.output = overrides?.input ?? item.input;
  item.output = overrides?.output ?? item.output;
  return item;
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

function pad(str: string | number, num: number) {
  return `    ${("" + str).substr(0, num)}`.substr(-num, num);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function debugMesh(mesh: HexagonMesh) {
  // console.log({
  //   mesh: mesh.meshItems.map(mi => JSON.stringify({
  //     axial: mi.axial,
  //     wind: mi.output.wind
  //   }))
  // });
  console.log(mesh.axialItems.map((r, ri) => (ri % 2 == 1 ? "  " : "") + r.filter(c => c != null).map(c => `[${pad(c?.input.wind.getTotal() ?? "", 3)}]`).join(" ")).join("\n"));
  // console.log(mesh.axialItems.map((r, ri) => (ri % 2 == 1 ? "  " : "") + r.filter(c => c != null).map(c => `[${pad(c?.output.wind?.strength ?? "", 3)}]`).join(" ")).join("\n"));
}

export function debugMeshOutput(mesh: HexagonMesh) {
  console.log(mesh.axialItems.map((r, ri) => (ri % 2 == 1 ? "  " : "") + r.filter(c => c != null).map(c => `[${pad(c?.output.wind[0]?.strength ?? "", 3)}]`).join(" ")).join("\n"));
}

describe("WindGenerator", () => {
  describe("calculateWindOutput", () => {
    it("returns single vector when provided", () => {
      const meshItem = getSampleMeshItem();
      meshItem.input.wind.add(320, {
        degrees: 320,
        strength: 8.2
      });

      const outputs = calculateWindOutput(meshItem, 1);

      const output = outputs[0];
      expect(output?.degrees).toBe(320);
      expect(output?.strength).toBe(8.2);
    });

    it("returns empty set if no inputs", () => {
      const meshItem = getSampleMeshItem();

      const output = calculateWindOutput(meshItem, 1);

      expect(output).toEqual([]);
    });

    it("returns empty set if 0 strength inputs", () => {
      const meshItem = getSampleMeshItem();
      meshItem.input.wind.add(60, { degrees: 60, strength: 0 });

      const output = calculateWindOutput(meshItem, 1);

      expect(output).toEqual([]);
    });

    it("maintains the wind strength when travelling on level terrain", () => {
      // 10mps wind travelling SW 1km
      //  wind speed loss is a magic number
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: 1000, site: { x: 1, y: 0 } });
      meshItem.input.wind.add(45, {
        degrees: 45,
        strength: 10
      });
      meshItem.initNeighbor(getSampleMeshItem({ height: 1000, site: { x: 0, y: 0 } }), 0, 0, [], 45 + 180);

      const outputs = calculateWindOutput(meshItem, pxPerKilometer);

      const output = outputs[0];
      expect(output?.degrees).toBe(45);
      expect(output?.strength).toBe(10);
      // console.log(output.strength);
    });

    it("treats water as level terrain", () => {
      // 10mps wind travelling SW 1km
      //  wind speed loss is a magic number
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: -1000, site: { x: 1, y: 0 }, type: MeshType.Ocean });
      meshItem.input.wind.add(45, {
        degrees: 45,
        strength: 10
      });
      meshItem.initNeighbor(getSampleMeshItem({ height: 0, site: { x: 0, y: 0 }, type: MeshType.Ocean }), 0, 0, [], 45 + 180);

      const outputs = calculateWindOutput(meshItem, pxPerKilometer);

      const output = outputs[0];
      expect(output?.degrees).toBe(45);
      expect(output?.strength).toBe(10);
      // console.log(output.strength);
    });

    it("reduces the wind strength when travelling uphill", () => {
      // 10mps wind travelling SW 1km and uphill 1km
      //  wind speed loss is a magic number
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: 1000, site: { x: 1, y: 0 } });
      meshItem.input.wind.add(45, {
        degrees: 45,
        strength: 10
      });
      meshItem.initNeighbor(getSampleMeshItem({ height: 0, site: { x: 0, y: 0 } }), 0, 0, [], 45 + 180);

      const outputs = calculateWindOutput(meshItem, pxPerKilometer);

      const output = outputs[0];
      expect(output?.degrees).toBe(45);
      expect(output?.strength).toBeLessThan(10);
      // console.log(output.strength);
    });

    it("increases the wind strength when travelling downhill", () => {
      // 10mps wind travelling SW 1km and downhill 1km
      //  wind speed loss is a magic number
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: 0, site: { x: 1, y: 0 } });
      meshItem.input.wind.add(45, {
        degrees: 45,
        strength: 10
      });
      meshItem.initNeighbor(getSampleMeshItem({ height: 1000, site: { x: 0, y: 0 } }), 0, 0, [], 45 + 180);

      const outputs = calculateWindOutput(meshItem, pxPerKilometer);

      const output = outputs[0];
      expect(output?.degrees).toBe(45);
      expect(output?.strength).toBeGreaterThan(10);
      // console.log(output.strength);
    });

    it("turns slightly when travelling uphill and neighboring terrain is lower slope", () => {
      // 10mps wind travelling East 1km and uphill 1km
      //  neighboring slopes match, so it could shift SE or NE
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem({ height: 1000, site: { x: 1, y: 0 } });
      meshItem.input.wind.add(0, { degrees: 0, strength: 10 });
      // originating W edge is downhill at 0m
      meshItem.initNeighbor(getSampleMeshItem({ height: 0, site: { x: 0, y: 0 } }), 0, 0, [], 180);
      // NE edge is 800m
      meshItem.initNeighbor(getSampleMeshItem({ height: 800, site: { x: 0.5, y: 1 } }), 0, 0, [], 300);
      // SE edge is 900m (to force it to pick a testable direction, NE)
      meshItem.initNeighbor(getSampleMeshItem({ height: 900, site: { x: 0.5, y: -1 } }), 0, 0, [], 60);

      const outputs = calculateWindOutput(meshItem, pxPerKilometer);

      const output = outputs[0];
      expect(output?.degrees).toBeGreaterThan(300);
      expect(output?.degrees).toBeLessThan(360);
      expect(output?.strength).toBeLessThan(10);
      // console.log(output.strength);
    });

    it("averages the direction of winds together with some loss in strength", () => {
      // 10mps wind travelling SW
      // 10mps wind travelling S
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem();
      meshItem.input.wind.add(45, { degrees: 45, strength: 10 });
      meshItem.input.wind.add(90, { degrees: 90, strength: 10 });

      const outputs = calculateWindOutput(meshItem, pxPerKilometer);

      const expectedDirection = (90 + 45) / 2;
      const output = outputs[0];
      expect(output?.degrees).toBe(Math.round(expectedDirection));
      expect(output?.strength).toBeGreaterThan(17); // expect some reduction do to  vectors + combination reduction
      expect(output?.strength).toBeLessThan(20);
    });

    it("averages opposite but even wind - pretend this is convergence and air goes up?", () => {
      // 10mps wind travelling W
      // 10mps wind travelling E
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem();
      meshItem.input.wind.add(0, { degrees: 0, strength: 10 });
      meshItem.input.wind.add(180, { degrees: 180, strength: 10 });

      const outputs = calculateWindOutput(meshItem, pxPerKilometer);

      const output = outputs[0];
      expect(output?.degrees).toBe(90);
      expect(output?.strength).toBe(0);
    });

    it("combines uneven winds in new direction based on relative strengths, with some loss in overall strength", () => {
      // 5mps wind travelling S
      // 10mps wind travelling E
      const pxPerKilometer = 1;
      const meshItem = getSampleMeshItem();
      meshItem.input.wind.add(90, { degrees: 90, strength: 5 });
      meshItem.input.wind.add(0, { degrees: 0, strength: 10 });

      const outputs = calculateWindOutput(meshItem, pxPerKilometer);

      const output = outputs[0];
      // roughly close to 30 degrees
      expect(output?.degrees).toBeGreaterThan(25);
      expect(output?.degrees).toBeLessThan(30);
      // not much more than 10
      expect(output?.strength).toBeCloseTo(11, 0);
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


    it("splits 90 degree correctly", () => {
      const input = {
        degrees: 90,
        strength: 10,
        source: "test"
      };

      const output = calculateNeighborStrengths(input);

      expect(output).toStrictEqual(getEmptyDirectionsWith({ 60: 5, 120: 5 }));
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
        expect(m.input.wind.getLength()).toBe(1);
        expect(m.input.wind.getFirst()).toEqual({ degrees: 0, strength: 10, source: "initial" });
        alreadyChecked.set(m.axial, true);
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(0);
        }
      });
    });
    it("applies 60 degree wind to west + north cells only - but not NW corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 60, strength: 10 };

      applyInitialWind(mesh, initialWind);


      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      mesh.edges.west.forEach((m, i) => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          if (i % 2 == 0)
            expect(m.input.wind.getFirst()).toEqual({ degrees: 60, strength: 10, source: "initial" });
          else
            expect(m.input.wind.getFirst()).toEqual({ degrees: 60, strength: 0 });
        }
        alreadyChecked.set(m.axial, true);
      });
      mesh.edges.north.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          expect(m.input.wind.getFirst()).toEqual({ degrees: 60, strength: 10, source: "initial" });
        }
        alreadyChecked.set(m.axial, true);
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(0);
        }
      });
    });
    it("applies 120 degree wind to east + north cells only - not not NE corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 120, strength: 10 };

      applyInitialWind(mesh, initialWind);

      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      mesh.edges.east.forEach((m, i) => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          if (i % 2 == 0)
            expect(m.input.wind.getFirst()).toEqual({ degrees: 120, strength: 10, source: "initial" });
          else
            expect(m.input.wind.getFirst()).toEqual({ degrees: 120, strength: 0 });
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.edges.north.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          expect(m.input.wind.getFirst()).toEqual({ degrees: 120, strength: 10, source: "initial" });
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(0);
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
        expect(m.input.wind.getLength()).toBe(1);
        expect(m.input.wind.getFirst()).toEqual({ degrees: 180, strength: 10, source: "initial" });
        alreadyChecked.set(m.axial, true);
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(0);
        }
      });
    });
    it("applies 240 degree wind to east + south cells only - but not SE corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 240, strength: 10 };

      applyInitialWind(mesh, initialWind);

      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      mesh.edges.east.forEach((m, i) => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          if (i % 2 == 0)
            expect(m.input.wind.getFirst()).toEqual({ degrees: 240, strength: 10, source: "initial" });
          else
            expect(m.input.wind.getFirst()).toEqual({ degrees: 240, strength: 0, source: "initial" });
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.edges.south.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          expect(m.input.wind.getFirst()).toEqual({ degrees: 240, strength: 10, source: "initial" });
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(0);
        }
      });
    });
    it("applies 220 degree wind to east + south cells only - but not SE corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 220, strength: 10 };

      applyInitialWind(mesh, initialWind);

      debugMesh(mesh);
      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      mesh.edges.east.forEach((m, i) => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          if (i % 2 == 0)
            expect(m.input.wind.getFirst()).toEqual({ degrees: 220, strength: 10, source: "sum" });
          else {
            expect(m.input.wind.getFirst()?.degrees).toEqual(220);
            expect(m.input.wind.getFirst()?.strength).toBeCloseTo(3.33);
          }
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.edges.south.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          expect(m.input.wind.getFirst()?.degrees).toEqual(220);
          expect(m.input.wind.getFirst()?.strength).toBeCloseTo(6.666);
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(0);
        }
      });
    });
    it("applies 300 degree wind to west + south cells only - but not SW corner", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 300, strength: 10 };

      applyInitialWind(mesh, initialWind);

      const alreadyChecked = new Map<{ q: number, r: number }, boolean>();
      mesh.edges.west.forEach((m, i) => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          if (i % 2 == 0)
            expect(m.input.wind.getFirst()).toEqual({ degrees: 300, strength: 10, source: "initial" });
          else
            expect(m.input.wind.getFirst()).toEqual({ degrees: 300, strength: 0, source: "initial" });
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.edges.south.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(1);
          expect(m.input.wind.getFirst()).toEqual({ degrees: 300, strength: 10, source: "initial" });
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toBe(0);
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
        if (m.axial.r % 2 == 0) {
          expect(m.input.wind.getRaw(45)).toEqual([{ degrees: 45, strength: 2.5, source: "initial" }, { degrees: 45, strength: 7.5, source: "initial" }]);
          expect(m.input.wind.getLength()).toBe(1);
          expect(m.input.wind.getSum(45)).toEqual({ degrees: 45, strength: 10, source: "sum" });
          expect(m.input.wind.getRaw(45)).toEqual([{ degrees: 45, strength: 2.5, source: "initial" }, { degrees: 45, strength: 7.5, source: "initial" }]);
        }
        else if (m.axial.q > 0) {
          expect(m.input.wind.getRaw(45)).toEqual([{ degrees: 45, strength: 2.5, source: "initial" }, { degrees: 45, strength: 7.5, source: "initial" }]);
        }
        alreadyChecked.set(m.axial, true);
      });
      mesh.edges.north.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getSum(45)).toEqual({ degrees: 45, strength: 7.5, source: "initial" });
          alreadyChecked.set(m.axial, true);
        }
      });
      mesh.meshItems.forEach(m => {
        if (!alreadyChecked.has(m.axial)) {
          expect(m.input.wind.getLength()).toEqual(0);
        }
      });
    });
  });


  describe("calculateWindEffect", () => {
    it("generates even initial wind for 0 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 14, 20, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 0, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      debugMeshOutput(mesh);
      mesh.meshItems.forEach(m => {
        expect(m.output.wind).toEqual([{ degrees: 0, strength: 10, source: "combined" }]);
      });
    });

    it("generates even initial wind for 0 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 0, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      // debugMesh(mesh);
      mesh.meshItems.forEach(m => {
        expect(m.output.wind).toEqual([{ degrees: 0, strength: 10, source: "combined" }]);
      });
    });

    it("generates even initial wind for 60 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 60, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      //debugMesh(mesh);
      mesh.meshItems.forEach(m => {
        if (m.isMapEdge) {
          // complicated - some edge tiles will be 0's to prevent doubling up
        }
        else {
          expect(m.output.wind).toEqual([{ degrees: 60, strength: 10, source: "combined" }]);
        }
      });
    });

    it("generates even initial wind for 45 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 45, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      debugMesh(mesh);
      mesh.meshItems.forEach(m => {
        expect(m.output.wind).toEqual([{ degrees: 45, strength: 10, source: "combined" }]);
      });
    });

    // saw tooth edges on the sides need some values when wind is vertical
    it("generates even initial wind for 90 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 90, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      // debugMeshOutput(mesh);
      mesh.meshItems.forEach(m => {
        expect(m.output.wind).toEqual([{ degrees: 90, strength: 10, source: "combined" }]);
      });
    });

    // saw tooth edges on the sides need some values when wind is vertical
    it("generates even initial wind for 240 degrees", () => {
      const mesh = new HexagonMesh(7, 8, 70, 80, 1);
      mesh.apply(m => m.type = MeshType.Ocean);
      const initialWind = { degrees: 220, strength: 10 };

      WindGenerator.calculateWindEffect(mesh, initialWind);

      debugMeshOutput(mesh);
      mesh.meshItems.forEach(m => {
        expect(m.output.wind).toEqual([{ degrees: 220, strength: 10, source: "combined" }]);
      });
    });
  });
});

