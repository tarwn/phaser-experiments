import { HexagonMesh, HexagonMeshItem } from "../../mesh/HexagonMesh";
import { MeshType } from "../../mesh/types";
import { pad } from "../../utils/testUtils";
import { RiverMapper } from "./RiverMapper";

const hexWidth = 7;
const hexHeight = 8;

function debugMesh(mesh: HexagonMesh) {
  const output = (meshItem: HexagonMeshItem) => {
    const label = [];
    if (meshItem.type == MeshType.Ocean) {
      label.push("~W~");
    }
    label.push(`h:${meshItem.height ?? "-"}`);
    if (meshItem.river.river) {
      label.push(`r:${meshItem.river.river.direction}`);
    }
    if (meshItem.river.pool) {
      label.push(`p:${meshItem.river.pool}`);
    }

    return pad(label.join("|"), 14);
  };
  console.log(mesh.axialItems.map((r, ri) => (ri % 2 == 1 ? "     " : "") + r.filter(c => c != null).map(c => `[${output(c)}]`).join(" ")).join("\n"));
}

describe("RiverMapper", () => {
  describe("calculateRivers", () => {
    it("generates water for a straightforward downhill-to-the-ocean setup", () => {
      const mesh = new HexagonMesh(hexWidth, hexHeight, hexWidth * 3, hexHeight * 3, 1);
      mesh.apply(m => {
        if (m.axial.q <= 0 && m.isMapEdge) {
          m.height = 0;
          m.type = MeshType.Ocean;
        }
        else if (m.axial.r == 2) {
          m.height = 10 + m.axial.q;
          m.type = MeshType.Land;
          m.humidity.state = 1;
        }
        else {
          m.height = 20 + m.axial.q + Math.abs(m.axial.r - 2);
          m.type = MeshType.Land;
          m.humidity.state = 0;
        }
      });

      RiverMapper.calculateRivers(mesh, 5);

      mesh.apply(m => {
        if (m.axial.r == 2 && m.type == MeshType.Land) {
          expect(m.river.river).toBeDefined();
        }
      });
    });

    it("generates water for an L-shape", () => {
      const mesh = new HexagonMesh(hexWidth, hexHeight, hexWidth * 3, hexHeight * 3, 1);
      const bottomRow = mesh.edges.south[0].axial.r;
      mesh.apply(m => {
        if (m.axial.r == bottomRow) {
          m.height = 0;
          m.type = MeshType.Ocean;
        }
        else {
          m.height = 20 + m.axial.q + Math.abs(m.axial.r - 2);
          m.type = MeshType.Land;
          m.humidity.state = 0;
        }
      });
      const river = [
        mesh.axialGet(3, 1),
        mesh.axialGet(2, 1),
        mesh.axialGet(1, 1),
        mesh.axialGet(0, 2),
        mesh.axialGet(0, 3)
      ];
      river.forEach((r, i) => {
        if (r) {
          r.height = 5 - i;
          r.humidity.state = 1;
        }
      });

      RiverMapper.calculateRivers(mesh, 5);

      debugMesh(mesh);
      river.forEach(r => {
        expect(r?.river.river).toBeDefined();
      });
    });

    it("generates pool for a hole", () => {
      const mesh = new HexagonMesh(hexWidth, hexHeight, hexWidth * 3, hexHeight * 3, 1);
      mesh.apply(m => {
        m.height = 20;
        m.type = MeshType.Land;
      });
      const hole = mesh.axialGet(1, 2)!;
      hole.height = 1;
      hole.humidity.state = 1;

      debugMesh(mesh);
      RiverMapper.calculateRivers(mesh, 1);

      debugMesh(mesh);
      // fills up to closest next neighbor in one shot
      expect(hole.river.pool).toBe(20 - 1);
    });

    it("generates multi-item pool for a flooded hole", () => {
      const mesh = new HexagonMesh(hexWidth, hexHeight, hexWidth * 3, hexHeight * 3, 1);
      mesh.apply(m => {
        m.height = 20;
        m.type = MeshType.Land;
      });
      const hole = [
        mesh.axialGet(1, 2),
        mesh.axialGet(1, 3),
      ];
      hole.forEach((h, i) => {
        h!.height = 1 + i;
        h!.humidity.state = 1;
      });

      debugMesh(mesh);
      RiverMapper.calculateRivers(mesh, 1);

      debugMesh(mesh);
      // fills up both to closest next neighbor due to 2nd humidityIn
      expect(hole[0]?.river.pool).toBe(20 - 1);
      expect(hole[1]?.river.pool).toBe(20 - 2);
    });

    it("overflows a hole to create a river on multiple passes", () => {
      const mesh = new HexagonMesh(hexWidth, hexHeight, hexWidth * 3, hexHeight * 3, 1);
      const bottomRow = mesh.edges.south[0].axial.r;
      mesh.apply(m => {
        if (m.axial.r == bottomRow) {
          m.height = 0;
          m.type = MeshType.Ocean;
        }
        else {
          m.height = 20;
          m.type = MeshType.Land;
          m.humidity.state = 0;
        }
      });
      const river = [
        mesh.axialGet(3, 1),
        mesh.axialGet(2, 1),
        mesh.axialGet(1, 1),
        mesh.axialGet(0, 2),
        mesh.axialGet(0, 3)
      ];
      river.forEach((r, i) => {
        if (r) {
          if (i < 2) {
            r.height = 1 + i;
            r.humidity.state = 1;
          }
          else {
            r.height = 2 + 5 - i;
          }
        }
      });

      debugMesh(mesh);
      RiverMapper.calculateRivers(mesh, 1);
      debugMesh(mesh);
      RiverMapper.calculateRivers(mesh, 1);

      debugMesh(mesh);
      // fills up both to closest next neighbor due to 2nd humidityIn
      expect(river[0]?.river.pool).toBe(river[2]?.height! - 1);
      expect(river[1]?.river.pool).toBe(river[2]?.height! - 2);
      expect(river[2]?.river.river?.amount ?? 0).toBeGreaterThan(1);
      expect(river[3]?.river.river?.amount ?? 0).toBeGreaterThan(1);
      expect(river[4]?.river.river?.amount ?? 0).toBeGreaterThan(1);
    });
  });
});
