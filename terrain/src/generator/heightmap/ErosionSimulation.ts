import { IMesh } from "../../mesh/types";

export const ErosionSimulation = {
  initialize: (mesh: IMesh, maxDepth: number) => {
    // dump a bunch of dirt, water, and erosion on it
    mesh.apply(m => {
      m.output.water = 40;
      m.input.water = 0;
      m.output.dirt = 0;
      m.input.dirt = 0;

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
        else if (n.meshItem && n.meshItem.height < prev.meshItem.height && n.meshItem.output.water < m.output.water) {
          return n;
        }
        else {
          return prev;
        }
      });
      if (lowest && lowest.meshItem) {
        if (m.output.water > 0 && lowest.meshItem.height < m.height) {
          // move a unit of water + up to 5% difference of dirt
          m.output.water = -1;
          lowest.meshItem.input.water += 1;
          m.output.dirt = -.1 * (m.height - lowest.meshItem.height);
          // if it's a map edge, skip: dirt erodes into the broader ocean
          if (!lowest.meshItem.isMapEdge) {
            lowest.meshItem.input.dirt += m.output.dirt;
          }
        }
      }
    });

    // apply step + return outstanding water
    const waterRemaining = mesh.reduce((total, m) => {
      if (m.isMapEdge) {
        m.output.water = 0;
        m.input.water = 0;
        m.input.dirt = 0;
        m.output.dirt = 0;
      }
      else {
        m.output.water += m.input.water;
        m.input.water = 0;
        m.height += m.output.dirt;
        m.height += m.input.dirt;
        m.input.dirt = 0;
        m.output.dirt = 0;
      }
      return total + m.output.water;
    }, 0);

    return { waterRemaining };
  }
};
