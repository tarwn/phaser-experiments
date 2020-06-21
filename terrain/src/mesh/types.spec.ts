import { IWindMeasure, DirectionalIO } from "./types";

describe("DirectionalIO", () => {
  describe("add", () => {
    it("averages even additions correctly", () => {
      const d = new DirectionalIO<IWindMeasure>();
      d.add(30, { degrees: 30, strength: 10 });
      d.add(50, { degrees: 50, strength: 10 });
      const avg = d.getAveragedDegrees();
      expect(avg).toBe(40);
    });

    it("averages uneven additions correctly", () => {
      const d = new DirectionalIO<IWindMeasure>();
      d.add(30, { degrees: 30, strength: 30 });
      d.add(50, { degrees: 50, strength: 10 });
      const avg = d.getAveragedDegrees();
      expect(avg).toBe(35);
    });

    it("averages values that cross 360 correctly", () => {
      const d = new DirectionalIO<IWindMeasure>();
      d.add(350, { degrees: 350, strength: 10 });
      d.add(10, { degrees: 10, strength: 10 });
      const avg = d.getAveragedDegrees();
      expect(avg).toBe(0);
    });

    it("averages values near 180 correctly", () => {
      const d = new DirectionalIO<IWindMeasure>();
      d.add(190, { degrees: 190, strength: 10 });
      d.add(170, { degrees: 170, strength: 10 });
      const avg = d.getAveragedDegrees();
      expect(avg).toBe(180);
    });

  });
});
