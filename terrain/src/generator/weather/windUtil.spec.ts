import { combineWind } from "./windUtil";

describe("combineWind", () => {
  it("averages correctly", () => {
    const wind = [
      { degrees: 0, strength: 10 },
      { degrees: 10, strength: 10 }
    ];

    const result = combineWind(wind);

    expect(result.degrees).toBeCloseTo(5, 2);
    expect(result.strength).toBeCloseTo(20, 0);
    expect(result.strength).toBeLessThan(20);
  });

  it("combines adjustments as expected", () => {
    const original = [
      { degrees: 22, strength: 2 },
      { degrees: 0, strength: 6 }
    ];

    const adjusted = [
      { degrees: 22, strength: 2 },
      { degrees: 0, strength: 6 },
      { degrees: 185, strength: 3.95 },
      { degrees: 15, strength: 3.95 }
    ];

    const originalResult = combineWind(original);
    const adjustedResult = combineWind(adjusted);
    console.log(original);
    console.log(adjusted);
    expect(originalResult.strength).toBeCloseTo(adjustedResult.strength);
  });
});
