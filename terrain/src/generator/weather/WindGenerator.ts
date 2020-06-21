
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
import { combineWind } from "./windUtil";

export enum Compass {
  North,
  South,
  East,
  West
}

interface IWindLocation {
  xkm: number;
  ykm: number;
  heightkm: number;
}

export const calculateSlopeImpactOnWind = (source: IWindLocation, target: IWindLocation): number => {
  const run = Phaser.Math.Distance.Between(source.xkm, source.ykm, target.xkm, target.ykm);
  const rise = target.heightkm - source.heightkm;
  const slope = rise / run;
  //call it 10% reduction per 40% slope
  return .1 * (slope / .25);
};

export const getUsableHeight = (meshItem: HexagonMeshItem) => {
  return meshItem.type === MeshType.Ocean ? 0 : meshItem.height;
};

// wind output of a particular mesh item
export const calculateWindOutput = (meshItem: HexagonMeshItem, pxToKilometer: number): IWindMeasure[] => {
  if (!meshItem.input.wind.hasAny()) {
    return [];
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

      let slopeImpact = calculateSlopeImpactOnWind(source, target);

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
          // reduce slope impact since we're turning too
          slopeImpact *= .7;
        }
        else if (rightTarget && getUsableHeight(rightTarget.meshItem) < getUsableHeight(meshItem)) {
          endDegrees = (w.degrees + 30) % 360;
          // reduce slope impact since we're turning too
          slopeImpact *= .7;
        }
      }

      // sources that start with "+" are adjustments that aren't impacted by slope
      if (w.source?.toString().startsWith("+")) {
        return w;
      }
      else {
        return {
          degrees: endDegrees,
          strength: w.strength - slopeImpact * w.strength
        };
      }
    }
    else {
      return {
        degrees: w.degrees,
        strength: w.strength,
        source: w.source
      };
    }
  });

  // group all non-adjustments in first slot, others on their own
  const groups = [[]] as Array<Array<IWindMeasure>>;
  strengths.forEach(s => {
    if (s.source?.toString().startsWith("+")) {
      groups.push([s]);
    }
    else {
      groups[0].push(s);
    }
  });
  const combinedWinds = groups.map(s => combineWind(s));
  if (combinedWinds[0].strength === 0) {
    return [];
  }

  // 2. Ground obstructions change strength
  //  TODO: more friction and obstructions reduces wind velocity

  // 3. Combining streams headed in different directions change direction + strength
  // going to apply a straight 5% loss if multiple angles, smarter change later
  // if (strengths.length > 1) {
  //   combinedWind.strength -= combinedWind.strength * 0.05;
  // }

  // Finish up
  return combinedWinds.map(c => {
    c.strength = Math.round(c.strength * 10) / 10;
    c.degrees = Math.round(c.degrees);
    return c;
  });
};

export const applyAdjustmentsForPressure = (queue: HexagonMeshItem[]) => {
  // scan all input/flow decisions and adjust the directions some to aim torwards lower pressure areas
  //  this is attempting to avoid issues like a venturi creating a hurricane streams surrounded by dead space
  //  and see if we can get some natural-ish looking flows behind hills
  queue.forEach(m => {
    if (m.isMapEdge) return;

    // consider left and right only for now
    const combinedDirection = m.input.wind.getAveragedDegrees();
    if (combinedDirection === undefined)
      return;
    const combinedStrength = m.input.wind.getTotal();

    const leftTargetDegrees = getNextLowestEvenEdge(combinedDirection);
    const leftTarget = m.getNeighbor(leftTargetDegrees);
    let leftMagnitude = leftTarget?.meshItem.input.wind.getTotal() ?? 0;
    const leftHeight = leftTarget ? getUsableHeight(leftTarget.meshItem) : 0;
    leftMagnitude += (leftHeight ?? 0 > getUsableHeight(m)) ? .15 * leftMagnitude : 0;
    const rightTargetDegrees = getNextHighestEvenEdge(combinedDirection);
    const rightTarget = m.getNeighbor(rightTargetDegrees);
    let rightMagnitude = rightTarget?.meshItem.input.wind.getTotal() ?? 0;
    const rightHeight = rightTarget ? getUsableHeight(rightTarget.meshItem) : 0;
    rightMagnitude += (rightHeight ?? 0 > getUsableHeight(m)) ? .15 * rightMagnitude : 0;

    // when I add +/- 10 degrees to amount of pressure direction it distorts bottom corner in ocean
    //  when using 0 degrees, when I don't add adjustment it's fine?
    //  - degrees aren't being calculated correctly and it's adjusting when I don think it is
    //  - border edges aren't being calculated correctly
    //  - original direction +/- 30 seems pretty good?

    // TODO - why is simulation loop going 200 steps on wind?

    // faking slope impact with a straight multiplier for now
    if (leftTarget && leftMagnitude < combinedStrength) {
      // apply adjustments to turn left more
      const strDiff = (combinedStrength - leftMagnitude) / 3;
      if (strDiff < 1) return;
      // const newDir = (360 + leftTarget.edge.degrees - 10) % 360; // magic number
      // const newDir = (360 + leftTarget.edge.degrees) % 360; // magic number
      const newDir = (360 + combinedDirection - 30) % 360; // magic number
      // remove input, add input
      const debitDirection = (combinedDirection + 180) % 360;
      m.input.wind.add(debitDirection, { degrees: debitDirection, strength: strDiff, source: "-pressure adj." });
      // TODO - affect neightbor or setup second output for self?
      m.input.wind.add(newDir, { degrees: newDir, strength: strDiff, source: "+pressure adj." });
    }
    if (rightTarget && rightMagnitude < combinedStrength) {
      // apply adjustments to turn right more
      const strDiff = (combinedStrength - rightMagnitude) / 3;
      if (strDiff < 1) return;
      // const newDir = (rightTarget.edge.degrees + 10) % 360; // magic number
      // const newDir = (rightTarget.edge.degrees) % 360; // magic number
      const newDir = (combinedDirection + 30) % 360; // magic number
      // remove input, add input
      const debitDirection = (combinedDirection + 180) % 360;
      m.input.wind.add(debitDirection, { degrees: debitDirection, strength: strDiff, source: "-pressure adj." });
      // TODO - affect neightbor or setup second output for self?
      m.input.wind.add(newDir, { degrees: newDir, strength: strDiff, source: "+pressure adj." });
    }
  });
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

export const setRoughlySame = (a: IWindMeasure[], b: IWindMeasure[]) => {
  return a.length === b.length &&
    (a.length < 1 || roughlySame(a[0], b[0])) &&
    (a.length < 2 || roughlySame(a[1], b[1])) &&
    (a.length < 3 || (a.length == 3 && roughlySame(a[2], b[2])));
};

export const applyOutputsToNeighborInputsA = (output: IWindMeasure, source: HexagonMeshItem, queueOnlyOnce: (m: HexagonMeshItem) => void) => {
  const neighborShares = calculateNeighborStrengths(output);
  Object.keys(neighborShares).forEach(deg => {
    if (!neighborShares[deg as any]) {
      return;
    }

    const neighbor = source.getNeighbor(parseInt(deg));
    if (!neighbor) {
      return;
    }

    if (!neighbor.meshItem.input.wind.hasExactly(output.degrees, neighborShares[neighbor.edge.degrees])) {
      neighbor.meshItem.input.wind.add(output.degrees, { degrees: output.degrees, strength: neighborShares[neighbor.edge.degrees], source: source.axial } as any);
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
    queueOnlyOnce(neighbor.meshItem);
  });
};

export const applyOutputsToNeighborInputsB = (output: IWindMeasure, source: HexagonMeshItem, queueOnlyOnce: (m: HexagonMeshItem) => void) => {
  const neighborShares = calculateNeighborStrengths(output);
  source.rawNeighbors.forEach(n => {
    if (neighborShares[n.edge.degrees]) {
      // if (!n.meshItem.input.wind.hasExactly(output.degrees, neighborShares[n.edge.degrees])) {
      n.meshItem.input.wind.add(output.degrees, { degrees: output.degrees, strength: neighborShares[n.edge.degrees], source: source.axial } as any);
      // }
      // else {
      //   console.log({
      //     "DOUBLED UP": JSON.stringify(n.meshItem.input.wind.getRaw(output.degrees)),
      //     "windShare": { deg: n.edge.degrees, str: neighborShares[n.edge.degrees] },
      //     "source": queue[i].axial,
      //     sourceWind: output,
      //     "receiver": n.meshItem.axial,
      //   });
      // }
      //}
      queueOnlyOnce(n.meshItem);
    }
  });
};

export const WindGenerator = {
  calculateWindEffect: (mesh: HexagonMesh, initialWind: IWindMeasure) => {
    // seed the sides that would be receiving initial wind with the percentage that they would receive
    const queue = applyInitialWind(mesh, initialWind);
    const isIncluded = new Map<{ q: number, r: number }, boolean>();
    queue.forEach(m => isIncluded.set(m.axial, true));

    const queueOnlyOnce = (meshItem: HexagonMeshItem) => {
      if (!isIncluded.has(meshItem.axial)) {
        isIncluded.set(meshItem.axial, true);
        queue.push(meshItem);
      }
    };

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
          const outputs = queue[i].output.wind!;
          outputs.forEach(output => {
            applyOutputsToNeighborInputsB(output, queue[i], queueOnlyOnce);
          });
        }
      }

      applyAdjustmentsForPressure(queue);

      // apply received inputs to produce next output
      //  - calculate new output and apply if changed
      //  - clear input for next round (or no round if this is stable)
      //  - return num changed to see if we're stable yet
      numChanged = queue.reduce((ttl, m) => {
        const original = m.output.wind;
        const newOutput = calculateWindOutput(m, mesh.pxToKilometer);
        m.output.wind = newOutput;
        m.input.wind = new DirectionalIO<IWindMeasure>();
        if (!setRoughlySame(newOutput, original)) {
          return 1 + ttl;
        }
        else {
          return ttl;
        }
      }, 0);
      // debugMeshOutput(mesh);
      // console.log(mesh.meshItems.map(m => `${m.axial.r},${m.axial.q}: ${JSON.stringify(m.output.wind)}`).join("\n"));

      // if (counter % 5 == 0 || numChanged == 0)
      console.log(`Wind simulation, loop ${counter} ${numChanged} hexes updated`);
    }
  }
};

