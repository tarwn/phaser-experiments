import { HexagonMesh } from "../../../mesh/HexagonMesh";
import { MeshType } from "../../../mesh/types";
import { calculateSlope } from "../../heightmap/heightUtil";
import { HumidityGenerator } from "./HumidityGenerator";

// const getSampleMeshItem = (overrides?: any): HexagonMeshItem => {
//   const item = new HexagonMeshItem(
//     overrides?.axial ?? { q: 0, r: 0 },
//     overrides?.site ?? { x: 0, y: 0 },
//     overrides?.isMapEdge ?? false,
//     overrides?.height ?? 0,
//     overrides?.type ?? MeshType.Land,
//     overrides?.points ?? []);
//   item.weather.wind.input = overrides?.weather?.wind?.input ?? item.weather.wind.input;
//   item.weather.wind.state = overrides?.weather?.wind?.state ?? item.weather.wind.state;
//   return item;
// };

describe("HumidityGenerator", () => {
  describe("calculateHumidity", () => {
    const hexHeight = 8;
    const hexWidth = 7;
    const mesh = new HexagonMesh(hexWidth, hexHeight, 50, 50, 1, 1);
    mesh.apply(m => {
      m.height = 0;
    });
    mesh.apply(m => {
      m.rawNeighbors.forEach(n => {
        n.edge.slope = calculateSlope(m, n.meshItem, 1, 1);
      });
    });

    it("adds evaporation correctly", () => {
      mesh.apply(m => {
        m.water.state = 1;
        m.type = MeshType.Ocean;
      });
      HumidityGenerator.calculateHumidity(mesh, .5, 0, 0, 5);

      expect(mesh.meshItems[0].humidity.sim.humidityIn).toBe(0.5);
      expect(mesh.meshItems[0].humidity.sim.humidityOut).toBe(0);
      expect(mesh.meshItems[0].humidity.state).toBe(0.5);
    });

    it("adds transpiration correctly", () => {
      mesh.apply(m => {
        m.water.state = 0;
        m.type = MeshType.Land;
      });
      HumidityGenerator.calculateHumidity(mesh, 0, .5, 0, 5);

      expect(mesh.meshItems[0].humidity.sim.humidityIn).toBe(0.5);
      expect(mesh.meshItems[0].humidity.sim.humidityOut).toBe(0);
      expect(mesh.meshItems[0].humidity.state).toBe(0.5);
    });

    it("adds precipitation correctly", () => {
      mesh.apply(m => {
        m.water.state = 1;
        m.type = MeshType.Ocean;
      });
      HumidityGenerator.calculateHumidity(mesh, 1, 0, 0.5, 5);

      expect(mesh.meshItems[0].humidity.sim.humidityIn).toBe(1);
      expect(mesh.meshItems[0].humidity.sim.humidityOut).toBe(0.5);
      expect(mesh.meshItems[0].humidity.state).toBe(0.5);
    });
  });
});
