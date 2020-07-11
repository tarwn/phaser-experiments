import { HexagonMesh } from "../../../mesh/HexagonMesh";
import { MeshType } from "../../../mesh/types";

export const HumidityGenerator = {
  calculateHumidity: (mesh: HexagonMesh, evaporationRate: number, transpirationRate: number, precipitationLossRate: number, slopeMultiplier: number) => {
    // Pass 1: gain humidity from sources
    mesh.apply(m => {
      m.humidity.sim.humidityIn = 0;
      m.humidity.sim.humidityOut = 0;

      // evaporation - not actually removing water, just simulating part of the cycle
      if (m.water.state > 0) {
        m.humidity.sim.humidityIn += evaporationRate;
      }
      // transpiration - temporary
      if (m.type == MeshType.Land) {
        m.humidity.sim.humidityIn += transpirationRate;
      }
      // upwind neighbors - take % of humidity if it's upwind
      m.weather.wind.sources.forEach((n) => {
        m.humidity.sim.humidityIn += n.humidity.state / m.weather.wind.sources.size;
      });

      // lose some of current humidity
      // precipitation - x% over flat, ++x% on uphills
      let loss = precipitationLossRate;
      m.rawNeighbors.forEach(n => {
        if (n.edge.slope !== undefined && n.edge.slope > 0) {
          loss += precipitationLossRate * slopeMultiplier * n.edge.slope;
        }
      });

      m.humidity.sim.humidityIn = Math.min(1.0, m.humidity.sim.humidityIn);
      m.humidity.sim.humidityOut = Math.min(1.0, loss, m.humidity.sim.humidityIn);
    });

    // Pass 2: apply results
    let numChanged = 0;
    mesh.apply(m => {
      const newState = m.humidity.sim.humidityIn - m.humidity.sim.humidityOut;
      if (newState != m.humidity.state) {
        numChanged++;
        m.humidity.state = newState;
      }
    });
    return numChanged;
  }
};
