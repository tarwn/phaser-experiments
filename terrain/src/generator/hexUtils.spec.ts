import { getNextHighestEvenEdge, getNextLowestEvenEdge } from "./hexUtils";

describe("hexUtils", () => {
  describe("getNextHighestEvenEdge", () => {
    it("returns 60 for 0 (on an even edge already)", () => {
      const res = getNextHighestEvenEdge(0);
      expect(res).toBe(60);
    });
    it("returns 60 for 1 (close to current edge)", () => {
      const res = getNextHighestEvenEdge(1);
      expect(res).toBe(60);
    });
    it("returns 60 for 59 (close to next edge)", () => {
      const res = getNextHighestEvenEdge(59);
      expect(res).toBe(60);
    });
    it("returns 0 for 300 (pass by 360)", () => {
      const res = getNextHighestEvenEdge(300);
      expect(res).toBe(0);
    });
  });
  describe("getNextLowestEvenEdge", () => {
    it("returns 240 for 300 (on an even edge already)", () => {
      const res = getNextLowestEvenEdge(300);
      expect(res).toBe(240);
    });
    it("returns 240 for 299 (close to current edge)", () => {
      const res = getNextLowestEvenEdge(299);
      expect(res).toBe(240);
    });
    it("returns 240 for 241 (close to next edge)", () => {
      const res = getNextLowestEvenEdge(241);
      expect(res).toBe(240);
    });
    it("returns 240 for 0 (pass by 360)", () => {
      const res = getNextLowestEvenEdge(300);
      expect(res).toBe(240);
    });
    it("returns 0 for 1 (why not)", () => {
      const res = getNextLowestEvenEdge(1);
      expect(res).toBe(0);
    });
  });
});
