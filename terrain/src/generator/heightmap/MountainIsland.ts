import { IMeshItem, IMesh } from "../../mesh/types";


export const MountainIslandGenerator = {
  adjustHeightMap: (mesh: IMesh, peakHeights: number[], peakFalloffRate: number, maxHeight: number, maxDepth: number, width: number, height: number, margin: number, rng: seedrandom.prng) => {
    const peaks = peakHeights.map(p => {
      const marginFactor = margin * p / 1;
      return {
        x: Math.floor(rng() * (width - marginFactor * 2)) + marginFactor,
        y: Math.floor(rng() * (height - marginFactor * 2)) + marginFactor,
        height: p * maxHeight
      };
    });

    const queue = [] as IMeshItem[];
    let lowestPoint = peaks[0].height;
    // seed heights from closest mesh nodes to peaks + add their neighbors to queue
    peaks.forEach(p => {
      const closest = mesh.findClosest(p.x, p.y);
      if (closest) {
        queue.push(closest);
        closest.height = p.height;
        // using input water as a flag that we have adjusted the height already
        closest.input.water = 1;
      }
    });

    for (let i = 0; i < queue.length; i++) {
      const height = queue[i].height * (1 - rng() * peakFalloffRate);
      queue[i].rawNeighbors.forEach((n, i) => {
        if (n != null && n.meshItem != null) {
          if (n.meshItem.input.water === 0) {
            queue.push(n.meshItem);
            n.meshItem.height = height * (1 - i / 100); // just a little bit of differentiation of heights
            n.meshItem.input.water = 1;
          }
          else if (n.meshItem.height < height) {
            n.meshItem.height = (n.meshItem.height + height + height) / 3;
          }
        }
      });
      if (queue[i].height < lowestPoint) {
        lowestPoint = queue[i].height;
      }
    }

    // re-height based on range
    const totalRange = maxHeight - lowestPoint;
    const oceanDepth = maxDepth;
    const newRange = maxHeight + oceanDepth;
    mesh.apply(m => {
      m.height = (m.height - lowestPoint) / totalRange * newRange - oceanDepth;
    });
  }
};
