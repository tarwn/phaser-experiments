import { IMesh } from "../../mesh/types";

export const ErosionSimulation = {
  initialize: (mesh: IMesh, maxDepth: number) => {
    // dump a bunch of dirt, water, and erosion on it
    mesh.apply(m => {
      m.water.state = 40;
      m.water.sim.waterIn = 0;
      m.water.sim.dirtOut = 0;
      m.water.sim.dirtIn = 0;

      if (m.isMapEdge) {
        // m.height = -1 * maxDepth;
      }
    });
  },

  adjustHeightMap: (mesh: IMesh): { waterRemaining: number } => {
    //return 0;
    // erosion loop
    mesh.apply(m => {
      const lowest = m.rawNeighbors.reduce((prev, n) => {
        if (prev === null || prev.meshItem === null) {
          return n;
        }
        else if (n.meshItem && n.meshItem.height < prev.meshItem.height && n.meshItem.water.state < m.water.state) {
          return n;
        }
        else {
          return prev;
        }
      });
      if (lowest && lowest.meshItem) {
        if (m.water.state > 0 && lowest.meshItem.height < m.height) {
          // move a unit of water + up to 5% difference of dirt
          m.water.state = -1;
          lowest.meshItem.water.sim.waterIn += 1;
          m.water.sim.dirtOut = -.1 * (m.height - lowest.meshItem.height);
          // if it's a map edge, skip: dirt erodes into the broader ocean
          if (!lowest.meshItem.isMapEdge) {
            lowest.meshItem.water.sim.dirtIn += m.water.sim.dirtOut;
          }
        }
      }
    });

    // apply step + return outstanding water
    const waterRemaining = mesh.reduce((total, m) => {
      if (m.isMapEdge) {
        m.water.state = 0;
        m.water.sim.waterIn = 0;
        m.water.sim.dirtIn = 0;
        m.water.sim.dirtOut = 0;
      }
      else {
        m.water.state += m.water.sim.waterIn;
        m.water.sim.waterIn = 0;
        m.height += m.water.sim.dirtOut;
        m.height += m.water.sim.dirtIn;
        m.water.sim.dirtIn = 0;
        m.water.sim.dirtOut = 0;
      }
      return total + m.water.state;
    }, 0);

    return { waterRemaining };
  }
};
