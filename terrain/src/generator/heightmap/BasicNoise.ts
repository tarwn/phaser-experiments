import { makeNoise2D } from "open-simplex-noise";
import { IMeshItem } from "../../mesh/types";

export const BasicNoiseGenerator = {
  createHeightMap: (mesh: IMeshItem[], heightRange: number, rng: seedrandom.prng) => {
    const noise2D = makeNoise2D(rng());
    mesh.forEach(m => {
      if (m.isMapEdge) {
        m.height = -1 * noise2D(m.site.x, m.site.y) * heightRange;
      }
      else {
        m.height = heightRange - (noise2D(m.site.x, m.site.y) * heightRange * 2);
      }
    });
  }
};
