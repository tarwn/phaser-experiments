import { HexagonMesh, HexagonMeshItem, IHexagonMeshNeighbor } from "../../mesh/HexagonMesh";
import { MeshType, IAxialPoint } from "../../mesh/types";
import { roundTo } from "../hexUtils";

// const debugLoc = { q: 39, r: 57 };

export const RiverMapper = {
  calculateRivers: (mesh: HexagonMesh, waterToHeightRatio: number) => {
    const getTrueHeight = (meshItem: HexagonMeshItem) => {
      return roundTo(meshItem.height + (meshItem.river.pool ?? 0) * waterToHeightRatio, 4);
    };

    mesh.apply(m => {
      if (m.type === MeshType.Ocean)
        return;

      m.river.sim.waterIn = m.humidity.state;
      m.river.sim.prevPool = m.river.pool;
      m.river.sim.prevRiver = m.river.river;
      // leave pools filled so we can continue to flood in later steps - consider emptying later if we add erosion
      //m.river.pool = undefined;
      m.river.river = undefined;
    });

    mesh.apply(m => {
      // console.log("starting " + JSON.stringify(m.axial));
      if (m.type === MeshType.Ocean)
        return;

      // either already is a pool or is becoming one, flood fill
      let remainingWater = m.river.sim.waterIn;
      let currentMeshItem = m;
      let attempts = 0;

      while (remainingWater > 0 && attempts < 20) {
        attempts++;

        // if it's an ocean, we're done?
        if (currentMeshItem.type == MeshType.Ocean) {
          remainingWater = 0;
          continue;
        }

        // if not pool, look for drain
        if (currentMeshItem.river.pool === undefined) {
          // already have a river? just fill it in and move on
          if (currentMeshItem.river.river) {
            currentMeshItem.river.river.amount += remainingWater;
            currentMeshItem = currentMeshItem.river.river.to as HexagonMeshItem;
            continue;
          }

          // consider moving lowestNeighbor to a pre-defined property
          const lowestNeighbor = currentMeshItem.rawNeighbors.reduce((lowest, n) => {
            // has a river pointing to me? skip
            if (n.meshItem.river.river?.to === currentMeshItem) {
              return lowest;
            }
            if (lowest.meshItem.river.river?.to === currentMeshItem) {
              return n;
            }
            // is ocean or pool (?)
            if (lowest.meshItem.type == MeshType.Ocean || lowest.meshItem.river.pool !== undefined) {
              return lowest;
            }
            if (n.meshItem.type == MeshType.Ocean || n.meshItem.river.pool !== undefined) {
              return n;
            }
            // is legitimately lowest
            if (getTrueHeight(lowest?.meshItem) > getTrueHeight(n.meshItem)) {
              return n;
            }
            return lowest;
          }, currentMeshItem.rawNeighbors[0]);

          // the river flows into the ocean
          if (lowestNeighbor.meshItem.type == MeshType.Ocean) {
            // lowestNeighbor.meshItem.river.sim.waterIn += remainingWater;
            currentMeshItem.river.river = {
              to: lowestNeighbor.meshItem,
              direction: lowestNeighbor.edge.degrees,
              amount: remainingWater
            };
            // m.river.sim.waterIn = 0;
            currentMeshItem = lowestNeighbor.meshItem;
            remainingWater = 0;
            continue;
          }
          // the river drains
          if (lowestNeighbor.meshItem.river.pool === undefined && (lowestNeighbor.meshItem.height < currentMeshItem.height)) {
            // lowestNeighbor.meshItem.river.sim.waterIn += remainingWater;
            currentMeshItem.river.river = {
              to: lowestNeighbor.meshItem,
              direction: lowestNeighbor.edge.degrees,
              amount: remainingWater
            };
            // m.river.sim.waterIn = 0;
            // TODO - why are some rivers dead-ending?
            //remainingWater = 0;
            currentMeshItem = lowestNeighbor.meshItem;
            continue;
          }

          // drain to a pool
          if (lowestNeighbor.meshItem.river.pool !== undefined && (lowestNeighbor.meshItem.height < currentMeshItem.height)) {
            // lowestNeighbor.meshItem.river.sim.waterIn += remainingWater;
            currentMeshItem.river.river = {
              to: lowestNeighbor.meshItem,
              direction: lowestNeighbor.edge.degrees,
              amount: remainingWater
            };
            currentMeshItem = lowestNeighbor.meshItem;
            continue;
          }
          // neighbor is too high or is a pool already, keep going
        }

        // console.log("FLOOD FILL from " + JSON.stringify(currentMeshItem.axial));
        // pool - flood fill as much water as possible until we find a new downhill neighbor
        const pool = new Map<IAxialPoint, HexagonMeshItem>();
        const pathTo = new Map<IAxialPoint, { meshItem: HexagonMeshItem, neighbor: IHexagonMeshNeighbor }>();
        pool.set(currentMeshItem.axial, currentMeshItem);
        const queue = [currentMeshItem];
        let lowestNeighbor = currentMeshItem.rawNeighbors[0];
        pathTo.set(lowestNeighbor.meshItem.axial, { meshItem: currentMeshItem, neighbor: lowestNeighbor });
        while (queue.length > 0) {
          const meshItem = queue.shift();

          meshItem?.rawNeighbors.forEach(n => {
            //-- expand the pool
            // if it's already a pool, add it - potential for mismatch heights?
            if (n.meshItem.river.pool !== undefined) {
              if (!pool.has(n.meshItem.axial)) {
                pool.set(n.meshItem.axial, n.meshItem);
                queue.push(n.meshItem);
                pathTo.set(n.meshItem.axial, { meshItem, neighbor: n });
              }
            }
            // if it's even with pool top, add it to pool as potential flood zone
            else if (getTrueHeight(n.meshItem) === getTrueHeight(currentMeshItem)) {
              if (!pool.has(n.meshItem.axial)) {
                pool.set(n.meshItem.axial, n.meshItem);
                queue.push(n.meshItem);
                pathTo.set(n.meshItem.axial, { meshItem, neighbor: n });
              }
            }
            //-- or look for drain points or lowest neighbor to fill to
            // ocean takes precedence as a drain point
            else if (lowestNeighbor.meshItem.type == MeshType.Ocean) {
              // do nothing, preserve the ocean item as lowest neighbor
            }
            else if (n.meshItem.type == MeshType.Ocean) {
              lowestNeighbor = n;
              pathTo.set(n.meshItem.axial, { meshItem, neighbor: n });
            }
            // initial lowest may be a pool, ditch it if so - that we can do height comparisons with rest
            else if (lowestNeighbor.meshItem.river.pool !== undefined) {
              lowestNeighbor = n;
              pathTo.set(n.meshItem.axial, { meshItem, neighbor: n });
            }
            // find next lowest from pool height - determines either flood height or drain
            else if (getTrueHeight(lowestNeighbor.meshItem) > getTrueHeight(n.meshItem)) {
              lowestNeighbor = n;
              pathTo.set(n.meshItem.axial, { meshItem, neighbor: n });
            }
          });
        }

        // console.log({
        //   poolSize: pool.size,
        //   remainingWater,
        //   lowestNeighborHeight: lowestNeighbor.meshItem.height,
        //   lowestNeighbor: lowestNeighbor.meshItem.axial,
        //   poolStartingHeight: getTrueHeight(currentMeshItem),
        //   start: currentMeshItem.axial
        // });
        // console.log(pathTo);

        const backtrackPath = (start: IAxialPoint, source: IAxialPoint) => {
          // console.log({
          //   start,
          //   source,
          //   pathTo
          // });
          const path = [pathTo.get(start)!];
          let pathAttempts = 0;
          while (path[0].meshItem.axial != source && pathAttempts < pathTo.size) {
            // console.log({
            //   to: path[0].neighbor.meshItem.axial,
            //   from: path[0].meshItem.axial,
            //   fromPool: path[0].meshItem.river.pool
            // });
            pathAttempts++;
            if (!pathTo.has(path[0].meshItem.axial)) {
              throw new Error(`Cannot backtrack from ${JSON.stringify(path[0].meshItem.axial)} towards source ${JSON.stringify(source)}`);
            }
            path.unshift(pathTo.get(path[0].meshItem.axial)!);
          }
          if (pathAttempts >= pathTo.size) {
            throw new Error(`Cannot backtrack from ${JSON.stringify(path[0].meshItem.axial)} towards source ${JSON.stringify(source)}`);
          }
          return path;
        };

        // touched the ocean? drain to 0 + continue
        if (lowestNeighbor.meshItem.type == MeshType.Ocean) {
          //console.log("Flood Drain to ocean");
          const path = backtrackPath(lowestNeighbor.meshItem.axial, currentMeshItem.axial);
          path.forEach(p => {
            if (p.meshItem.river.river && p.meshItem.river.river.direction === p.neighbor.edge.degrees) {
              p.meshItem.river.river.amount += remainingWater;
            }
            else {
              p.meshItem.river.river = {
                to: p.neighbor.meshItem,
                direction: p.neighbor.edge.degrees,
                amount: remainingWater
              };
            }
          });
          currentMeshItem = lowestNeighbor.meshItem;
          remainingWater = 0;
          continue;
        }

        // shorter neighbor? drain + continue
        if (lowestNeighbor.meshItem.height <= getTrueHeight(currentMeshItem)) {
          //console.log("Flood Drain to river");
          const path = backtrackPath(lowestNeighbor.meshItem.axial, currentMeshItem.axial);
          path.forEach(p => {
            if (p.meshItem.river.river && p.meshItem.river.river.direction === p.neighbor.edge.degrees) {
              p.meshItem.river.river.amount += remainingWater;
            }
            else {
              p.meshItem.river.river = {
                to: p.neighbor.meshItem,
                direction: p.neighbor.edge.degrees,
                amount: remainingWater
              };
            }
            if (p.neighbor.meshItem.river.river?.to == p.meshItem) {
              p.neighbor.meshItem.river.river = undefined;
            }
          });
          currentMeshItem = lowestNeighbor.meshItem;
          // remainingWater = 0 - leave the remaining water on lowest tile
          continue;
        }

        // taller neighbor? flood up to that point + continue from here for another pass
        if (lowestNeighbor.meshItem.height > getTrueHeight(currentMeshItem)) {
          //console.log("Flood fill some amount");
          let floodWater = 0;
          pool.forEach(p => {
            p.river.pool = (lowestNeighbor.meshItem.height - p.height) / waterToHeightRatio;
            floodWater += p.river.pool;
          });
          remainingWater = Math.max(0, remainingWater - floodWater);
          continue;
        }

        // should not be possible - same height should be part of drain above
        throw new Error("Impossible scenario?");
      }
    });


    // Pass 2: apply results
    let numChanged = 0;
    let changed = false;
    mesh.apply(m => {
      changed = false;
      // undefined's mismatch
      if (m.river.pool === undefined && m.river.sim.prevPool !== undefined ||
        m.river.pool !== undefined && m.river.sim.prevPool === undefined ||
        m.river.river === undefined && m.river.sim.prevRiver !== undefined ||
        m.river.river !== undefined && m.river.sim.prevRiver === undefined) {
        changed = true;
      }

      // pool mismatch
      else if (roundTo(m.river.pool ?? 0, 0) !== roundTo(m.river.sim.prevPool ?? 0, 0)) {
        changed = true;
      }

      // river amount/direction mismatch
      else if (m.river.river !== undefined && m.river.sim.prevRiver !== undefined) {
        if (roundTo(m.river.river.amount, 0) !== roundTo(m.river.sim.prevRiver.amount, 0) ||
          m.river.river.direction !== m.river.river.direction) {
          changed = true;
        }
      }

      if (changed) {
        numChanged++;
      }
    });
    return numChanged;
  }
};
