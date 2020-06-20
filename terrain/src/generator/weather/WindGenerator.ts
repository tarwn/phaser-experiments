
// the goal is to produce general wind patterns for biomes, specific/daily simulation is a different stage
// using the basic rules from https://heredragonsabound.blogspot.com/2016/10/is-it-windy-in-here.html
//  1. Wind slows down when going uphill
//  2. Wind speeds up when going downhill
//  3. Wind turns when met with an obstruction
import * as Phaser from "phaser";
import { IWindMeasure, MeshType, DirectionalIO, IAxialPoint } from "../../mesh/types";
import { HexagonMesh, HexagonMeshItem } from "../../mesh/HexagonMesh";
import { getNextHighestEvenEdge, getNextLowestEvenEdge } from "../hexUtils";
import { debugMesh, debugMeshOutput } from "./WindGenerator.spec";

export enum Compass {
  North,
  South,
  East,
  West
}

// NOTE: this was in progress then I realized doing this on the voronoi mesh is going to suuuuuck

interface IWindLocation {
  xkm: number;
  ykm: number;
  heightkm: number;
}

export const calculateSlopeImpactOnWind = (source: IWindLocation, target: IWindLocation): number => {
  const run = Phaser.Math.Distance.Between(source.xkm, source.ykm, target.xkm, target.ykm);
  const rise = target.heightkm - source.heightkm;
  const slope = rise / run;
  //call it 10% reduction per 25% slope
  return .1 * (slope / .25);
};

export const getUsableHeight = (meshItem: HexagonMeshItem) => {
  return meshItem.type === MeshType.Ocean ? 0 : meshItem.height;
};

// wind output of a particular mesh item
export const calculateWindOutput = (meshItem: HexagonMeshItem, pxToKilometer: number): IWindMeasure | undefined => {
  if (!meshItem.input.wind.hasAny()) {
    return undefined;
  }

  // 1a. Slopes change strength
  //  up slope slows down
  //  down slope speeds up - but not really in the real world, eddies, etc but good enough
  const strengths = meshItem.input.wind.mapSum(w => {
    const neighbor = meshItem.getNeighbor((w.degrees + 180) % 360);
    if (neighbor) {
      const source = {
        xkm: neighbor.meshItem.site.x * pxToKilometer,
        ykm: neighbor.meshItem.site.y * pxToKilometer,
        heightkm: getUsableHeight(neighbor.meshItem) / 1000
      };
      const target = {
        xkm: meshItem.site.x * pxToKilometer,
        ykm: meshItem.site.y * pxToKilometer,
        heightkm: getUsableHeight(meshItem) / 1000
      };

      const slopeImpact = calculateSlopeImpactOnWind(source, target);

      // can we turn some towards another tile? up to 30 degrees
      let endDegrees = w.degrees;
      if (slopeImpact > .05) {
        // console.log({ slopeImpact });
        // const dirImpact = 100 * slopeImpact;
        const leftTargetDegrees = getNextLowestEvenEdge(w.degrees);
        const leftTarget = meshItem.getNeighbor(leftTargetDegrees);
        const rightTargetDegrees = getNextHighestEvenEdge(w.degrees);
        const rightTarget = meshItem.getNeighbor(rightTargetDegrees);
        if (leftTarget && (!rightTarget || getUsableHeight(leftTarget.meshItem) < getUsableHeight(rightTarget.meshItem)) && getUsableHeight(leftTarget.meshItem) < getUsableHeight(meshItem)) {
          endDegrees = (360 + w.degrees - 30) % 360;
        }
        else if (rightTarget && getUsableHeight(rightTarget.meshItem) < getUsableHeight(meshItem)) {
          endDegrees = (w.degrees + 30) % 360;
        }
      }

      return {
        degrees: endDegrees,
        strength: w.strength - slopeImpact * w.strength
      };
    }
    else {
      return {
        degrees: w.degrees,
        strength: w.strength,
        source: w.source
      };
    }
  });

  // 1b. Slope could change direction?

  // 2. Ground obstructions change strength
  //  TODO: more friction and obstructions reduces wind velocity

  // 3. Combining streams headed in different directions change direction + strength
  //  Make up a loss range based on difference between inputs, maybe 20% max?
  const totalStrength = strengths.reduce((ttl, w) => ttl + w.strength, 0);
  if (totalStrength == 0) {
    return undefined;
  }
  const totalDegrees = strengths.reduce((ttl, w) => ttl + w.degrees * w.strength, 0);
  const finalDegrees = totalDegrees / totalStrength;
  const finalStrength = strengths.reduce((ttl, w) => ttl + (1 + (Math.abs(w.degrees - finalDegrees) / 180 * -0.2)) * w.strength, 0);
  const output = {
    degrees: finalDegrees,
    strength: finalStrength
  };

  return output;
};

export const spreadWind = (source: HexagonMeshItem, windDegrees: number, leftNeighborDegrees: number, rightNeighborDegrees: number) => {
  const leftNeighbor = source.getNeighbor(leftNeighborDegrees);
  const rightNeighbor = source.getNeighbor(rightNeighborDegrees);
  if (!leftNeighbor && !rightNeighbor) {
    return;
  }

  const roughInputs = source.input.wind.getTotal();
  if (!roughInputs)
    return;
  let leftNeighborSize = roughInputs.strength;
  if (leftNeighbor) {
    leftNeighborSize = leftNeighbor.meshItem.input.wind.getTotal();
  }
  let rightNeighborSize = roughInputs.strength;
  if (rightNeighbor) {
    rightNeighborSize = rightNeighbor.meshItem.input.wind.getTotal();
  }

  if (leftNeighbor && leftNeighborSize < rightNeighborSize && leftNeighborSize < roughInputs.strength * 8) {
    const percentage = (roughInputs.strength - leftNeighborSize) / roughInputs.strength;
    source.input.wind.forEachSum(w => {
      // give 25% of difference to neighbor + pretend 10% went higher
      const share = { strength: w.strength * (.25 * percentage), degrees: w.degrees };
      source.input.wind.add(w.degrees, { degrees: w.degrees, strength: -w.strength * (.35 * percentage), source: "spread" });
      leftNeighbor.meshItem.input.wind.add(share.degrees, share);
    });
    return leftNeighbor;
  }
  else if (rightNeighbor && rightNeighborSize < roughInputs.strength * 8) {
    const percentage = (roughInputs.strength - rightNeighborSize) / roughInputs.strength;
    source.input.wind.forEachSum(w => {
      // give 25% of difference to neighbor + pretend 10% went higher
      const share = { strength: w.strength * (.25 * percentage), degrees: w.degrees };
      source.input.wind.add(w.degrees, { degrees: w.degrees, strength: -w.strength * (.35 * percentage), source: "spread" });
      rightNeighbor.meshItem.input.wind.add(share.degrees, share);
    });
    return rightNeighbor;
  }
  return;
};

// wind output on neighbors
export const calculateNeighborStrengths = (wind: IWindMeasure) => {
  // list of sides on hexagon
  const sides = [0, 60, 120, 180, 240, 300];
  const sideStrengths = {
    0: 0,
    60: 0,
    120: 0,
    180: 0,
    240: 0,
    300: 0
  } as { [key: number]: number };
  // for each neighbor, calculate percentage of share based on amount of shared side
  sides.forEach(side => {
    if (wind.degrees === side) {
      sideStrengths[side] = wind.strength;
    }
    else if (wind.degrees > side && wind.degrees < side + 60) {
      const nextSide = (side + 60) % 360;
      sideStrengths[side] = wind.strength * (side + 60 - wind.degrees) / 60;
      sideStrengths[nextSide] = wind.strength * (wind.degrees - side) / 60;
    }
  });
  return sideStrengths;
};

export const applyInitialWind = (mesh: HexagonMesh, initialWind: IWindMeasure) => {
  const initialWinds = calculateNeighborStrengths(initialWind);

  // seed the sides that would be receiving initial wind with the percentage that they would receive
  const queue = [] as HexagonMeshItem[];
  const hasAdded = new Map<IAxialPoint, boolean>();
  const queueOnce = (m: HexagonMeshItem) => {
    if (!hasAdded.has(m.axial)) {
      queue.push(m);
      hasAdded.set(m.axial, true);
    }
  };

  if (initialWinds[0] && initialWinds[0] > 0) {
    mesh.edges.west.forEach(m => {
      m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[0], source: "initial" } as any);
      queueOnce(m);
    });
  }
  if (initialWinds[60] && initialWinds[60] > 0) {
    // don't add NW corner if single direction, add once if initial wind is from diff direction
    const corner = mesh.edges.north[0];
    mesh.edges.west.forEach(m => {
      if (m.axial.r % 2 == 0) {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[60], source: "initial" } as any);
      }
      else {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: 0 });
      }
      queueOnce(m);
    });
    mesh.edges.north.forEach(m => {
      if (m != corner) {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[60], source: "initial" } as any);
      }
      queueOnce(m);
    });
  }
  if (initialWinds[120] && initialWinds[120] > 0) {
    // don't add NE corner if single direction, add once if initial wind is from diff direction
    const corner = mesh.edges.east[0];
    mesh.edges.east.forEach(m => {
      if (m.axial.r % 2 == 0) {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[120], source: "initial" } as any);
      }
      else {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: 0 });
      }
      queueOnce(m);
    });
    mesh.edges.north.forEach(m => {
      if (m != corner) {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[120], source: "initial" } as any);
      }
      queueOnce(m);
    });
  }
  if (initialWinds[180] && initialWinds[180] > 0) {
    // don't add corner if single direction wind, add once if initial wind is from diff direction
    mesh.edges.east.forEach(m => {
      m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[180], source: "initial" } as any);
      queueOnce(m);
    });
  }
  if (initialWinds[240] && initialWinds[240] > 0) {
    const corner = mesh.edges.south[mesh.edges.south.length - 1];
    mesh.edges.east.forEach(m => {
      if (m.axial.r % 2 == 0) {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[240], source: "initial" } as any);
      }
      else {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: 0, source: "initial" } as any);
      }
      queueOnce(m);
    });
    mesh.edges.south.forEach(m => {
      if (m != corner) {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[240], source: "initial" } as any);
      }
      queueOnce(m);
    });
  }
  if (initialWinds[300] && initialWinds[300] > 0) {
    // don't add corner if single direction wind, add once if initial wind is from diff direction
    const corner = mesh.edges.south[0];
    mesh.edges.west.forEach(m => {
      if (m.axial.r % 2 == 0) {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[300], source: "initial" } as any);
      }
      else {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: 0, source: "initial" } as any);
      }
      queueOnce(m);
    });
    mesh.edges.south.forEach(m => {
      if (m != corner) {
        m.input.wind.add(initialWind.degrees, { degrees: initialWind.degrees, strength: initialWinds[300], source: "initial" } as any);
      }
      queueOnce(m);
    });
  }

  return queue;
};

export const roughlySame = (a: IWindMeasure | undefined, b: IWindMeasure | undefined) => {
  if (a === undefined && b === undefined) {
    return true;
  }
  else if (a === undefined) {
    return false;
  }
  else if (b === undefined) {
    return false;
  }

  return Math.round(a.degrees) == Math.round(b.degrees) && Math.round(10 * a.strength) == Math.round(10 * b.strength);
};

export const WindGenerator = {
  calculateWindEffect: (mesh: HexagonMesh, initialWind: IWindMeasure) => {
    // seed the sides that would be receiving initial wind with the percentage that they would receive
    const queue = applyInitialWind(mesh, initialWind);
    const isIncluded = new Map<{ q: number, r: number }, boolean>();
    queue.forEach(m => isIncluded.set(m.axial, true));
    // console.log(mesh.meshItems.map(m => `${m.axial.r},${m.axial.q}: ${JSON.stringify(m.input.wind)}`).join("\n"));

    let counter = 0;
    let numChanged = -1;
    while (counter < 200 && numChanged !== 0 && numChanged < 100000) {
      counter++;

      // push outputs to next inputs (including initial edge from outside wind)
      if (counter > 1) {
        applyInitialWind(mesh, initialWind);
      }
      // debugMesh(mesh);

      // process all outputs into new inputs on neighbors
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].output.wind) {
          // const output = calculateWindOutput(queue[i], mesh.pxToKilometer);
          const output = queue[i].output.wind!;
          const neighborShares = calculateNeighborStrengths(output);

          if (false) {
            Object.keys(neighborShares).forEach(deg => {
              if (!neighborShares[deg as any]) {
                return;
              }

              const neighbor = queue[i].getNeighbor(parseInt(deg));
              if (!neighbor) {
                // console.log({
                //   "noneighbor": deg,
                //   actual: queue[i]._indexedNeighbors
                // });
                return;
              }

              if (!neighbor.meshItem.input.wind.hasExactly(output.degrees, neighborShares[neighbor.edge.degrees])) {
                neighbor.meshItem.input.wind.add(output.degrees, { degrees: output.degrees, strength: neighborShares[neighbor.edge.degrees], source: queue[i].axial } as any);
              }
              else {
                // console.log({
                //   "DOUBLED UP": JSON.stringify(neighbor.meshItem.input.wind.getRaw(output.degrees)),
                //   "windShare": { deg: neighbor.edge.degrees, str: neighborShares[neighbor.edge.degrees] },
                //   "source": queue[i].axial,
                //   sourceWind: output,
                //   "receiver": neighbor.meshItem.axial,
                // });
              }
              if (!isIncluded.has(neighbor.meshItem.axial)) {
                isIncluded.set(neighbor.meshItem.axial, true);
                queue.push(neighbor.meshItem);
              }
            });
          }
          else {
            queue[i].rawNeighbors.forEach(n => {
              if (neighborShares[n.edge.degrees]) {
                // attempt to skip over edges that wil get doubled up inputs
                if (!n.meshItem.input.wind.hasExactly(output.degrees, neighborShares[n.edge.degrees])) {
                  n.meshItem.input.wind.add(output.degrees, { degrees: output.degrees, strength: neighborShares[n.edge.degrees], source: queue[i].axial } as any);
                }
                else {
                  // console.log({
                  //   "DOUBLED UP": JSON.stringify(n.meshItem.input.wind.getRaw(output.degrees)),
                  //   "windShare": { deg: n.edge.degrees, str: neighborShares[n.edge.degrees] },
                  //   "source": queue[i].axial,
                  //   sourceWind: output,
                  //   "receiver": n.meshItem.axial,
                  // });
                }
                //}
                if (!isIncluded.has(n.meshItem.axial)) {
                  isIncluded.set(n.meshItem.axial, true);
                  queue.push(n.meshItem);
                }
              }
            });
          }
        }
      }
      // debugMesh(mesh);

      // adjust inputs if neighboring cells are much weaker?
      if (queue.length == mesh.meshItems.length) {
        for (let i = 0; i < queue.length; i++) {
          if (queue[i].output.wind) {
            const wind = queue[i].output.wind;
            const leftNeighborDegrees = getNextLowestEvenEdge(wind.degrees);
            const rightNeighborDegrees = getNextHighestEvenEdge(wind.degrees);
            const n = spreadWind(queue[i], wind.degrees, leftNeighborDegrees, rightNeighborDegrees);
            if (n && !isIncluded.has(n.meshItem.axial)) {
              isIncluded.set(n.meshItem.axial, true);
              queue.push(n.meshItem);
            }
          });
        }
      }
      // debugMesh(mesh);


      // apply received inputs to produce next output
      //  - calculate new output and apply if changed
      //  - clear input for next round (or no round if this is stable)
      //  - return num changed to see if we're stable yet

      numChanged = queue.reduce((ttl, m) => {
        const original = m.output.wind;
        const newOutput = calculateWindOutput(m, mesh.pxToKilometer);
        m.output.wind = newOutput;
        m.input.wind = new DirectionalIO<IWindMeasure>();
        if (counter == 3) {
          console.log({
            newOutput,
            original,
            diff: roughlySame(newOutput, original)
          });
        }
        if (!roughlySame(newOutput, original)) {
          return 1 + ttl;
        }
        else {
          return ttl;
        }
      }, 0);
      // debugMeshOutput(mesh);
      // console.log(mesh.meshItems.map(m => `${m.axial.r},${m.axial.q}: ${JSON.stringify(m.output.wind)}`).join("\n"));

      console.log(`Wind simulation, loop ${counter} ${numChanged} hexes updated`);
    }
  }
};


// TODO - wind is not adding up correctly when split between tiles
