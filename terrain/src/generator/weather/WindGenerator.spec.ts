import { calculateWindOutput, calculateNeighborStrengths } from "./WindGenerator";
import { IMeshItem, MeshType, IWindMeasure } from "../../mesh/types";
import { getEmptyIO } from "../../mesh/Mesh";

const getSampleMeshItem = (overrides?: any): IMeshItem => {
  return {
    site: { x: 0, y: 0 },
    isMapEdge: false,
    height: 1,
    input: getEmptyIO(),
    output: getEmptyIO(),
    type: MeshType.Land,
    neighbors: [],
    points: [],
    ...overrides
  } as IMeshItem;
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

      const output = calculateWindOutput(meshItem);

      expect(output.degrees).toBe(320);
      expect(output.strength).toBe(8.2);
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
});
