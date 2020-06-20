
// the goal is to produce general wind patterns for biomes, specific/daily simulation is a different stage
// using the basic rules from https://heredragonsabound.blogspot.com/2016/10/is-it-windy-in-here.html
//  1. Wind slows down when going uphill
//  2. Wind speeds up when going downhill
//  3. Wind turns when met with an obstruction
import * as Phaser from "phaser";
import { IWindMeasure, MeshType } from "../../mesh/types";
import { HexagonMesh, IHexagonMeshItem } from "../../mesh/HexagonMesh";
import { getNextHighestEvenEdge, getNextLowestEvenEdge } from "../hexUtils";

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

export const getUsableHeight = (meshItem: IHexagonMeshItem) => {
  return meshItem.type === MeshType.Ocean ? 0 : meshItem.height;
};

// wind output of a particular mesh item
export const calculateWindOutput = (meshItem: IHexagonMeshItem, pxToKilometer: number): IWindMeasure | undefined => {
  if (meshItem.input.wind.length == 0) {
    return undefined;
  }

  // 1a. Slopes change strength
  //  up slope slows down
  //  down slope speeds up - but not really in the real world, eddies, etc but good enough
  const strengths = meshItem.input.wind.map(w => {
    const neighbor = meshItem.neighbors.find(n => n.edge.degrees === (w.degrees + 180) % 360);
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
        const leftTarget = meshItem.neighbors.find(n => n.edge.degrees === leftTargetDegrees);
        const rightTargetDegrees = getNextHighestEvenEdge(w.degrees);
        const rightTarget = meshItem.neighbors.find(n => n.edge.degrees === rightTargetDegrees);
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
      return { ...w };
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

export const spreadWind = (source: IHexagonMeshItem, leftNeighborDegrees: number, rightNeighborDegrees: number) => {
  const leftNeighbor = source.neighbors.find(n => n.edge.degrees === leftNeighborDegrees);
  const rightNeighbor = source.neighbors.find(n => n.edge.degrees === rightNeighborDegrees);
  if (!leftNeighbor && !rightNeighbor) {
    return;
  }

  const roughInputs = source.input.wind.reduce((ttl, w) => ttl + w.strength, 0);
  let leftNeighborSize = roughInputs;
  if (leftNeighbor) {
    leftNeighborSize = leftNeighbor.meshItem.input.wind.reduce((ttl, w) => ttl + w.strength, 0);
  }
  let rightNeighborSize = roughInputs;
  if (rightNeighbor) {
    rightNeighborSize = rightNeighbor.meshItem.input.wind.reduce((ttl, w) => ttl + w.strength, 0);
  }

  if (leftNeighbor && leftNeighborSize < rightNeighborSize && leftNeighborSize < roughInputs * 8) {
    const percentage = (roughInputs - leftNeighborSize) / roughInputs;
    source.input.wind.forEach(w => {
      // give 25% of difference to neighbor + pretend 10% went higher
      const share = { strength: w.strength * (.25 * percentage), degrees: w.degrees };
      w.strength -= w.strength * (.35 * percentage);
      leftNeighbor.meshItem.input.wind.push(share);
    });
    return leftNeighbor;
  }
  else if (rightNeighbor && rightNeighborSize < roughInputs * 8) {
    const percentage = (roughInputs - rightNeighborSize) / roughInputs;
    source.input.wind.forEach(w => {
      // give 25% of difference to neighbor + pretend 10% went higher
      const share = { strength: w.strength * (.25 * percentage), degrees: w.degrees };
      w.strength -= w.strength * (.35 * percentage);
      rightNeighbor.meshItem.input.wind.push(share);
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
  const queue = [] as IHexagonMeshItem[];
  if (initialWinds[0] && initialWinds[0] > 0) {
    mesh.edges.west.forEach(m => {
      m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[0] });
      if (m.input.wind.length < 2)
        queue.push(m);
    });
  }
  if (initialWinds[60] && initialWinds[60] > 0) {
    // don't add NW corner if single direction, add once if initial wind is from diff direction
    const corner = mesh.edges.north[0];
    mesh.edges.west.forEach((m, i) => {
      if (i % 2 == 0) {
        m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[60] });
      }
      else {
        m.input.wind.push({ degrees: initialWind.degrees, strength: 0 });
      }
      if (m.input.wind.length < 2)
        queue.push(m);
    });
    mesh.edges.north.forEach(m => {
      if (m != corner) {
        m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[60] });
      }
      if (m.input.wind.length < 2)
        queue.push(m);
    });
  }
  if (initialWinds[120] && initialWinds[120] > 0) {
    // don't add NE corner if single direction, add once if initial wind is from diff direction
    const corner = mesh.edges.east[0];
    mesh.edges.east.forEach((m, i) => {
      if (i % 2 == 0) {
        m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[120] });
      }
      else {
        m.input.wind.push({ degrees: initialWind.degrees, strength: 0 });
      }
      if (m.input.wind.length < 2)
        queue.push(m);
    });
    mesh.edges.north.forEach(m => {
      if (m != corner) {
        m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[120] });
      }
      if (m.input.wind.length < 2)
        queue.push(m);
    });
  }
  if (initialWinds[180] && initialWinds[180] > 0) {
    // don't add corner if single direction wind, add once if initial wind is from diff direction
    mesh.edges.east.forEach(m => {
      m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[180] });
      if (m.input.wind.length < 2)
        queue.push(m);
    });
  }
  if (initialWinds[240] && initialWinds[240] > 0) {
    const corner = mesh.edges.south[mesh.edges.south.length - 1];
    mesh.edges.east.forEach((m, i) => {
      if (i % 2 == 0) {
        m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[240] });
      }
      else {
        m.input.wind.push({ degrees: initialWind.degrees, strength: 0 });
      }
      if (m.input.wind.length < 2)
        queue.push(m);
    });
    mesh.edges.south.forEach(m => {
      if (m != corner) {
        m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[240] });
      }
      if (m.input.wind.length < 2)
        queue.push(m);
    });
  }
  if (initialWinds[300] && initialWinds[300] > 0) {
    // don't add corner if single direction wind, add once if initial wind is from diff direction
    const corner = mesh.edges.south[0];
    mesh.edges.west.forEach((m, i) => {
      if (i % 2 == 0) {
        m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[300] });
      }
      else {
        m.input.wind.push({ degrees: initialWind.degrees, strength: 0 });
      }
      if (m.input.wind.length < 2)
        queue.push(m);
    });
    mesh.edges.south.forEach(m => {
      if (m != corner) {
        m.input.wind.push({ degrees: initialWind.degrees, strength: initialWinds[300] });
      }
      if (m.input.wind.length < 2)
        queue.push(m);
    });
  }

  return queue;
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
      // process all outputs into new inputs on neighbors
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].output.wind.length > 0) {
          // const output = calculateWindOutput(queue[i], mesh.pxToKilometer);
          const output = queue[i].output.wind[0];
          const neighborShares = calculateNeighborStrengths(output);
          queue[i].neighbors.forEach(n => {
            if (neighborShares[n.edge.degrees]) {
              // attempt to skip over edges that wil get doubled up inputs
              if (!n.meshItem.isMapEdge || !n.meshItem.input.wind.find(w => w.degrees == output.degrees && w.strength == output.strength)) {
                n.meshItem.input.wind.push({ degrees: output.degrees, strength: neighborShares[n.edge.degrees], source: queue[i].axial } as any);
              }
              if (!isIncluded.has(n.meshItem.axial)) {
                isIncluded.set(n.meshItem.axial, true);
                queue.push(n.meshItem);
              }
            }
          });
        }
      }

      // adjust inputs if neighboring cells are much weaker?
      for (let i = 0; i < queue.length; i++) {
        if (queue[i].input.wind.length > 0) {
          const leftNeighborDegrees = getNextLowestEvenEdge(queue[i].input.wind[0].degrees);
          const rightNeighborDegrees = getNextHighestEvenEdge(queue[i].input.wind[0].degrees);
          const n = spreadWind(queue[i], leftNeighborDegrees, rightNeighborDegrees);
          if (n && !isIncluded.has(n.meshItem.axial)) {
            isIncluded.set(n.meshItem.axial, true);
            queue.push(n.meshItem);
          }
          //
          // spreadWind(queue[i], rightNeighborDegrees, roughInputs);
        }
      }

      // apply received inputs to produce next output
      //  - calculate new output and apply if changed
      //  - clear input for next round (or no round if this is stable)
      //  - return num changed to see if we're stable yet
      numChanged = queue.reduce((ttl, m) => {
        const original = m.output.wind;
        const newOutput = calculateWindOutput(m, mesh.pxToKilometer);
        if (newOutput) {
          m.output.wind = [newOutput];
        }
        m.input.wind = [];
        if (original.length !== m.output.wind.length || original != m.output.wind) {
          return 1 + ttl;
        }
        else {
          return ttl;
        }
      }, 0);
      // console.log(mesh.meshItems.map(m => `${m.axial.r},${m.axial.q}: ${JSON.stringify(m.output.wind)}`).join("\n"));

      // console.log(`Wind simulation, loop ${counter} ${numChanged} hexes updated`);
    }
  }
};


// TODO - wind is not adding up correctly when split between tiles
