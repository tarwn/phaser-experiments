
// the goal is to produce general wind patterns for biomes, specific/daily simulation is a different stage
// using the basic rules from https://heredragonsabound.blogspot.com/2016/10/is-it-windy-in-here.html
//  1. Wind slows down when going uphill
//  2. Wind speeds up when going downhill
//  3. Wind turns when met with an obstruction

import { IMeshItem, IWindMeasure } from "../../mesh/types";
import { HexagonMesh, IHexagonMeshItem } from "../../mesh/HexagonMesh";

export enum Compass {
  North,
  South,
  East,
  West
}

// NOTE: this was in progress then I realized doing this on the voronoi mesh is going to suuuuuck



// wind output of a particular mesh item
export const calculateWindOutput = (meshItem: IMeshItem): IWindMeasure => {
  // TODO combine the inputs to produce an output
  //  this would be easier with vectors
  const totalStrength = meshItem.input.wind.reduce((ttl, w) => ttl + w.strength, 0);
  const totalDegrees = meshItem.input.wind.reduce((ttl, w) => ttl + w.degrees * w.strength, 0);
  const output = {
    degrees: totalDegrees / totalStrength,
    strength: totalStrength
  };
  return output;
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
  // for each neighbor, calculate percentage of share based on amont of shared side
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

export const WindGenerator = {
  calculateWindEffect: (mesh: HexagonMesh, initialWind: IWindMeasure) => {
    // the initial vector is applied to 2 edges
    // TODO: would be nice to quickly grab all cells on an edge instead of calculating it each time - from IMeshItem[] to Mesh?
    let queue = [] as IHexagonMeshItem[];
    console.log(initialWind);
    if (initialWind.degrees < 270 && initialWind.degrees > 90) {
      mesh.edges.east.forEach(m => queue.push(m));
    }
    else {
      mesh.edges.west.forEach(m => queue.push(m));
    }
    if (initialWind.degrees < 180) {
      mesh.edges.north.forEach(m => queue.push(m));
    }
    else {
      mesh.edges.south.forEach(m => queue.push(m));
    }

    // begin processing
    let nextQueue = [] as IHexagonMeshItem[];

    // initial step
    for (let i = 0; i < queue.length; i++) {
      queue[i].input.wind = [initialWind];
      nextQueue.push(queue[i]);
    }

    let counter = 0;
    let numChanged = -1;
    while (counter < 200 && numChanged !== 0 && numChanged < 100000) {
      counter++;
      // process affected items + queue next step
      for (let i = 0; i < queue.length; i++) {
        const output = calculateWindOutput(queue[i]);
        const neighborShares = calculateNeighborStrengths(output);
        queue[i].neighbors.forEach(n => {
          if (neighborShares[n.edge.degrees]) {
            n.meshItem.input.wind.push({ degrees: output.degrees, strength: neighborShares[n.edge.degrees] });
            if (n.meshItem.input.wind.length == 1) {
              nextQueue.push(n.meshItem);
            }
          }
        });
      }

      // apply the inputs to produce next output, collect the number who've changed
      numChanged = nextQueue.reduce((ttl, m) => {
        const original = m.output.wind;
        m.output.wind = [calculateWindOutput(m)];
        if (original.length !== m.output.wind.length || original[0].degrees !== m.output.wind[0].strength || original[0].degrees != m.output.wind[0].strength) {
          return 1 + ttl;
        }
        else {
          return ttl;
        }
      }, 0);
      console.log(`Wind simulation, loop ${counter} ${numChanged} hexes updated`);
      queue = nextQueue;
      nextQueue = [];
    }
    console.log(mesh);
  }
};


// TODO - wind is not adding up correctly when split between tiles
