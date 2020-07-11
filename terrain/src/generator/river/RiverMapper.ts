import { HexagonMesh, HexagonMeshItem, IHexagonMeshItem, IHexagonMeshNeighbor } from "../../mesh/HexagonMesh";
import { MeshType, IAxialPoint } from "../../mesh/types";
import { Mesh } from "../../mesh/Mesh";

export const RiverMapper = {
  calculateRivers: (mesh: HexagonMesh, waterToHeightRatio: number) => {
    const getTrueHeight = (meshItem: HexagonMeshItem) => {
      return meshItem.height + (meshItem.river.pool ?? 0) * waterToHeightRatio;
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

        let trigger = false;

        // if it's an ocean, we're done?
        if (currentMeshItem.type == MeshType.Ocean) {
          remainingWater = 0;
          continue;
        }

        // if not pool, look for drain
        if (currentMeshItem.river.pool === undefined) {
          if (currentMeshItem.axial.q == 20 && currentMeshItem.axial.r == 35) {
            console.log({
              hasRiver: currentMeshItem.river.river != undefined,
              river: currentMeshItem.river
            });
            trigger = true;
          }

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

          if (currentMeshItem.axial.q == 20 && currentMeshItem.axial.r == 35) {
            console.log({
              lowestNeighbor,
              nIsOcean: (lowestNeighbor.meshItem.type == MeshType.Ocean),
              nIsDrain: (lowestNeighbor.meshItem.river.pool === undefined && (lowestNeighbor.meshItem.height < currentMeshItem.height)),
              nIsPool: (lowestNeighbor.meshItem.river.pool !== undefined && (lowestNeighbor.meshItem.height < currentMeshItem.height)),
              nRiver: lowestNeighbor.meshItem.river.river
            });
            trigger = true;
          }


          // the river flows into the ocean
          if (lowestNeighbor.meshItem.type == MeshType.Ocean) {
            lowestNeighbor.meshItem.river.sim.waterIn += remainingWater;
            currentMeshItem.river.river = {
              to: lowestNeighbor.meshItem,
              direction: lowestNeighbor.edge.degrees,
              amount: remainingWater
            };
            m.river.sim.waterIn = 0;
            currentMeshItem = lowestNeighbor.meshItem;
            remainingWater = 0;
            continue;
          }
          // the river drains
          if (lowestNeighbor.meshItem.river.pool === undefined && (lowestNeighbor.meshItem.height < currentMeshItem.height)) {
            lowestNeighbor.meshItem.river.sim.waterIn += remainingWater;
            currentMeshItem.river.river = {
              to: lowestNeighbor.meshItem,
              direction: lowestNeighbor.edge.degrees,
              amount: remainingWater
            };
            m.river.sim.waterIn = 0;
            // TODO - why are some rivers dead-ending?
            //remainingWater = 0;
            currentMeshItem = lowestNeighbor.meshItem;
            continue;
          }

          // drain to a pool
          if (lowestNeighbor.meshItem.river.pool !== undefined && (lowestNeighbor.meshItem.height < currentMeshItem.height)) {
            lowestNeighbor.meshItem.river.sim.waterIn += remainingWater;
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

          if (meshItem?.axial.q == 20 && meshItem.axial.r == 35) {
            console.log({
              lowestNeighbor: lowestNeighbor.meshItem.axial,
              queue: [...queue]
            });
            trigger = true;
          }

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


        if (trigger) {
          console.log({
            lowestNeighbor: lowestNeighbor.meshItem.axial,
            curHeight: getTrueHeight(currentMeshItem),
            lowestHeight: getTrueHeight(lowestNeighbor.meshItem),
            path: backtrackPath(lowestNeighbor.meshItem.axial, currentMeshItem.axial),
          });
          trigger = false;
        }

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

      //             // then pools get replaced by neighbors
      //             else if(lowestNeighbor.meshItem.river.pool !== undefined || pool.has(lowestNeighbor.meshItem.axial)) {
      //     lowestNeighbor = n;
      // lowestNeighborNeighbor = meshItem;
      //             }
      //             // if the neighbor is low enough to be flooded by filling the current pool w/ remaining water, add it to the pool
      //             else if (getTrueHeight(n.meshItem) < getTrueHeight(currentMeshItem) + (remainingWater * waterToHeightRatio) / pool.size) {
      //   // if it's a drain then treat it as lowest neighbor instead
      //   if (n.meshItem.river.river)


      //     // otherwise add it to the pool
      //     console.log({
      //       adding: n.meshItem.axial,
      //       origHeight: currentMeshItem.height,
      //       origTrueHeight: getTrueHeight(currentMeshItem),
      //       thisHeight: meshItem.height,
      //       thisTrueHeight: getTrueHeight(meshItem)
      //     });
      //   if (!pool.has(n.meshItem.axial)) {
      //     pool.set(n.meshItem.axial, n.meshItem);
      //     queue.push(n.meshItem);
      //   }
      // }
      // // then lowest actual neighbor that's not in the pool already
      // else if (!pool.has(n.meshItem.axial) && lowestNeighbor.meshItem.height > getTrueHeight(n.meshItem)) {
      //   lowestNeighbor = n;
      //   lowestNeighborNeighbor = meshItem;
      // }
      //           });
      //         }

      // // cheat - just fill in the hole up to the lowest neighbor height, if there's water left over it will drain out


      // console.log({
      //   axial: m.axial,
      //   i: currentMeshItem.axial,
      //   ht: currentMeshItem.height,
      //   remainingWater,
      //   floodWater,
      //   poolSize: pool.size,
      //   lowestNeighborHeight: lowestNeighbor.meshItem.height,
      //   lowestNeighbor: lowestNeighbor.meshItem.axial
      // });

      // if (lowestNeighbor === undefined) {
      //   continue;
      // }
      // // if we touched the ocean, this pool now part of it - may want to come back and do something with erosion and islands instead
      // if (lowestNeighbor.meshItem.type == MeshType.Ocean) {
      //   pool.forEach(p => {
      //     p.height = 0;
      //     p.type = MeshType.Ocean;
      //     p.river.pool = undefined;
      //   });
      //   remainingWater = 0;
      //   continue;
      // }

      // // does the lowest neighbor have a lower neighbor? it's a drain, add rivers and make it the selected item
      // const potentialDrain = lowestNeighbor.meshItem.rawNeighbors.find(n => n.meshItem.height < lowestNeighbor.meshItem.height && n.meshItem.river.pool === undefined);
      // if (potentialDrain) {
      //   console.log("drain to new river");
      //   lowestNeighborNeighbor.river.river = {
      //     to: lowestNeighbor.meshItem,
      //     direction: lowestNeighbor.edge.degrees,
      //     amount: remainingWater
      //   };
      //   lowestNeighbor.meshItem.river.river = {
      //     to: potentialDrain.meshItem,
      //     direction: potentialDrain.edge.degrees,
      //     amount: remainingWater
      //   };
      //   remainingWater = 0;
      //   currentMeshItem = potentialDrain.meshItem;
      //   continue;
      // }

      // // if we have water left, the lowest neighbor is the next mesh item to flood
      // currentMeshItem = lowestNeighbor.meshItem;
      //       }
      // if (attempts >= 20) {
      //   console.log(m.axial);
      //   console.log(currentMeshItem.axial);
      //   throw new Error("Failed in 20 attempts");
      // }

    });


    // Pass 2: apply results
    let numChanged = 0;
    mesh.apply(m => {
      if (m.river.pool !== m.river.sim.prevPool || m.river.river !== m.river.sim.prevRiver)
        numChanged++;
    });
    return numChanged;
  }
};
