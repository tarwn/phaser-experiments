import { HexagonMesh } from "./HexagonMesh";

describe("HexagonMesh", () => {
  describe("coordinate mapping", () => {
    const hexHeight = 8;
    const hexWidth = 7;
    const mesh = new HexagonMesh(hexWidth, hexHeight, 50, 50, 1);

    it("all mesh items have matching axial/site conversions", () => {
      mesh.meshItems.forEach(m => {
        expect(m.axial.q).toBe(mesh.xToQ(m.site.x, m.axial.r));
        expect(m.axial.r).toBe(mesh.yToR(m.site.y));
        expect(m.site.x).toBe(mesh.qToX(m.axial.q, m.axial.r));
        expect(m.site.y).toBe(mesh.rToY(m.axial.r));
      });
    });

    describe("rToY", () => {
      it("first row r shifts hexes down 1/4 so only point is above window", () => {
        const y = mesh.rToY(0);
        expect(y).toBe(1 / 4 * hexHeight);
      });

      it("second row r is first row plus 3/4 hex height (ignore one of two points on each row)", () => {
        const y = mesh.rToY(1);
        expect(y).toBe(1 / 4 * hexHeight + 3 / 4 * hexHeight);
      });

      it("Nth row r is first row plus N * 3/4 hex height (ignore one of two points on each row)", () => {
        const n = 5;
        const y = mesh.rToY(n);
        expect(y).toBe(1 / 4 * hexHeight + n * 3 / 4 * hexHeight);
      });
    });
    describe("yToR", () => {
      it("1/4 hex height => 1st row", () => {
        const r = mesh.yToR(1 / 4 * hexHeight);
        expect(r).toBe(0);
      });

      it("1/4 + 3/4 hexh height => 2nd row", () => {
        const r = mesh.yToR(1 / 4 * hexHeight + 3 / 4 * hexHeight);
        expect(r).toBe(1);
      });

      it("1/4 + n 3/4 hex height => nth row", () => {
        const n = 5;
        const r = mesh.yToR(1 / 4 * hexHeight + n * 3 / 4 * hexHeight);
        expect(r).toBe(n);
      });
    });
    describe("qToX", () => {
      it("first column on first row is 0 (it shows left half in window)", () => {
        const x = mesh.qToX(0, 0);
        expect(x).toBe(0);
      });

      it("second column on first row is hex width", () => {
        const x = mesh.qToX(1, 0);
        expect(x).toBe(hexWidth);
      });

      it("nth column on first row is n * hex width", () => {
        const n = 5;
        const x = mesh.qToX(n, 0);
        expect(x).toBe(n * hexWidth);
      });

      it("0th column on second row is SE from 1st value (half width over)", () => {
        const x = mesh.qToX(0, 1);
        expect(x).toBe(1 / 2 * hexWidth);
      });

      it("0th column on third row is SE,SE from 1st value (half width x2 over)", () => {
        const x = mesh.qToX(0, 2);
        expect(x).toBe(2 * 1 / 2 * hexWidth);
      });

      it("-1st column on third row is on screen edge (0)", () => {
        const x = mesh.qToX(-1, 2);
        expect(x).toBe(0);
      });

      it("-1st column on fourth row is SE frm -1st,3", () => {
        const x = mesh.qToX(-1, 3);
        expect(x).toBe(1 / 2 * hexWidth);
      });
    });
    describe("xToQ", () => {
      it("x:0 on row 0 => column 0", () => {
        const q = mesh.xToQ(0, 0);
        expect(q).toBe(0);
      });

      it("x:hexWidth on row 0 => column 1", () => {
        const q = mesh.xToQ(hexWidth, 0);
        expect(q).toBe(1);
      });

      it("x:N*hexWidth on row 0 => column N", () => {
        const n = 5;
        const q = mesh.xToQ(n * hexWidth, 0);
        expect(q).toBe(n);
      });

      it("x:1/2 hexwidth on row 2 => column 0", () => {
        const q = mesh.xToQ(1 / 2 * hexWidth, 1);
        expect(q).toBe(0);
      });

      it("x:0 on row 3 => column -1", () => {
        const q = mesh.xToQ(0, 2);
        expect(q).toBe(-1);
      });

      it("x:1/2 hexwidth on row 4 => column -1", () => {
        const q = mesh.xToQ(1 / 2 * hexWidth, 3);
        expect(q).toBe(-1);
      });

      it("x:3 hexWidth on row 3 => column 2", () => {
        const q = mesh.xToQ(3 * hexWidth, 2);
        expect(q).toBe(2);
      });

      it("x:3.5 hexwidth on row 4 => column 2", () => {
        const q = mesh.xToQ(3.5 * hexWidth, 3);
        expect(q).toBe(2);
      });

    });

  });
  describe("findClosest", () => {
    const mesh = new HexagonMesh(7, 8, 50, 50, 1);
    it("finds closest for site that matches item coords", () => {
      const targetItem = mesh.meshItems[18];
      const closest = mesh.findClosest(targetItem.site.x, targetItem.site.y);
      expect(closest).not.toBeNull();
      expect(closest?.axial).toBe(targetItem.axial);
    });
    it("finds closest for site that is ~width/2 from item coords", () => {
      const targetItem = mesh.meshItems[18];
      const closest = mesh.findClosest(targetItem.site.x - 3.4, targetItem.site.y);
      expect(closest).not.toBeNull();
      expect(closest?.axial).toBe(targetItem.axial);
    });
    it("finds closest for site that is ~height/2 from item coords", () => {
      const targetItem = mesh.meshItems[18];
      const closest = mesh.findClosest(targetItem.site.x, targetItem.site.y - 3);
      expect(closest).not.toBeNull();
      expect(closest?.axial).toBe(targetItem.axial);
    });
    it("finds closest for site that is diagonally off from item coords", () => {
      const targetItem = mesh.meshItems[18];
      const closest = mesh.findClosest(targetItem.site.x - 3, targetItem.site.y - 3);
      expect(closest).not.toBeNull();
      expect(closest?.axial).toBe(targetItem.axial);
    });
  });
});
