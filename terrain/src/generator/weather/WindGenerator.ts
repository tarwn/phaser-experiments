
// the goal is to produce general wind patterns for biomes, specific/daily simulation is a different stage
// using the basic rules from https://heredragonsabound.blogspot.com/2016/10/is-it-windy-in-here.html
//  1. Wind slows down when going uphill
//  2. Wind speeds up when going downhill
//  3. Wind turns when met with an obstruction
import * as Phaser from "phaser";
import { IWindMeasure, MeshType } from "../../mesh/types";
import { HexagonMesh, IHexagonMeshItem } from "../../mesh/HexagonMesh";

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

export const calculateSlopeImpactOnWind = (source: IWindLocation, target: IWindLocation, strength: number): number => {
  const run = Phaser.Math.Distance.Between(source.xkm, source.ykm, target.xkm, target.ykm);
  const rise = target.heightkm - source.heightkm;
  const slope = rise / run;
  //call it 10% reduction per .5 slope
  const reduction = .1 * (slope / .5);
  return strength - reduction * strength;
};


// wind output of a particular mesh item
export const calculateWindOutput = (meshItem: IHexagonMeshItem, pxToKilometer: number): IWindMeasure => {
  // change strength
  //  up slope slows down
  //  down slope speeds up - but not really in the real world, eddies, etc but good enough
  const strengths = meshItem.input.wind.map(w => {
    const neighbor = meshItem.neighbors.find(n => n.edge.degrees === (w.degrees + 180) % 360);
    if (neighbor) {
      const source = {
        xkm: neighbor.meshItem.site.x * pxToKilometer,
        ykm: neighbor.meshItem.site.y * pxToKilometer,
        heightkm: neighbor.meshItem.type === MeshType.Ocean ? 0 : neighbor.meshItem.height / 1000
      };
      const target = {
        xkm: meshItem.site.x * pxToKilometer,
        ykm: meshItem.site.y * pxToKilometer,
        heightkm: meshItem.type === MeshType.Ocean ? 0 : meshItem.height / 1000
      };

      return {
        degrees: w.degrees,
        strength: calculateSlopeImpactOnWind(source, target, w.strength)
      };
    }
    else {
      return { ...w };
    }
  });

  // change strength
  //  more friction and obstructions reduces wind velocity

  // TODO combine the inputs to produce an output
  //  this would be easier with vectors
  const totalStrength = strengths.reduce((ttl, w) => ttl + w.strength, 0);
  const totalDegrees = strengths.reduce((ttl, w) => ttl + w.degrees * w.strength, 0);
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

export const applyInitialWind = (mesh: HexagonMesh, initialWind: IWindMeasure) => {
  const initialWinds = calculateNeighborStrengths(initialWind);
  console.log(initialWinds);

  // seed the sides that would be receiving initial wind with the percentage that they would receive
  const queue = [] as IHexagonMeshItem[];
  if (initialWinds[0] && initialWinds[0] > 0) {
    mesh.edges.west.forEach(m => {
      m.input.wind.push({ degrees: 0, strength: initialWinds[0] });
      if (m.input.wind.length < 2)
        queue.push(m);
    });
  }
  if (initialWinds[60] && initialWinds[60] > 0) {
    mesh.edges.west.forEach(m => {
      m.input.wind.push({ degrees: 60, strength: initialWinds[60] });
      if (m.input.wind.length < 2)
        queue.push(m);
    });
    mesh.edges.north.forEach(m => {
      // ensure we don't double add on corners
      if (!m.input.wind.find(w => w.degrees == 60)) {
        m.input.wind.push({ degrees: 60, strength: initialWinds[60] });
        if (m.input.wind.length < 2)
          queue.push(m);
      }
    });
  }
  if (initialWinds[120] && initialWinds[120] > 0) {
    mesh.edges.east.forEach(m => {
      m.input.wind.push({ degrees: 120, strength: initialWinds[120] });
      if (m.input.wind.length < 2)
        queue.push(m);
    });
    mesh.edges.north.forEach(m => {
      // ensure we don't double add on corners
      if (!m.input.wind.find(w => w.degrees == 120)) {
        m.input.wind.push({ degrees: 120, strength: initialWinds[120] });
        if (m.input.wind.length < 2)
          queue.push(m);
      }
    });
  }
  if (initialWinds[180] && initialWinds[180] > 0) {
    mesh.edges.east.forEach(m => {
      m.input.wind.push({ degrees: 180, strength: initialWinds[180] });
      if (m.input.wind.length < 2)
        queue.push(m);
    });
  }
  if (initialWinds[240] && initialWinds[240] > 0) {
    mesh.edges.east.forEach(m => {
      m.input.wind.push({ degrees: 240, strength: initialWinds[240] });
      if (m.input.wind.length < 2)
        queue.push(m);
    });
    mesh.edges.south.forEach(m => {
      // ensure we don't double add on corners
      if (!m.input.wind.find(w => w.degrees == 240)) {
        m.input.wind.push({ degrees: 240, strength: initialWinds[240] });
        if (m.input.wind.length < 2)
          queue.push(m);
      }
    });
  }
  if (initialWinds[300] && initialWinds[300] > 0) {
    mesh.edges.west.forEach(m => {
      m.input.wind.push({ degrees: 300, strength: initialWinds[300] });
      if (m.input.wind.length < 2)
        queue.push(m);
    });
    mesh.edges.south.forEach(m => {
      // ensure we don't double add on corners
      if (!m.input.wind.find(w => w.degrees == 300)) {
        m.input.wind.push({ degrees: 300, strength: initialWinds[300] });
        if (m.input.wind.length < 2)
          queue.push(m);
      }
    });
  }

  return queue;
};

export const WindGenerator = {
  calculateWindEffect: (mesh: HexagonMesh, initialWind: IWindMeasure) => {
    // seed the sides that would be receiving initial wind with the percentage that they would receive
    let queue = applyInitialWind(mesh, initialWind);
    let nextQueue = [] as IHexagonMeshItem[];

    let counter = 0;
    let numChanged = -1;
    while (counter < 200 && numChanged !== 0 && numChanged < 100000) {
      counter++;

      // add edge inputs on subsequent loops
      if (counter > 1) {
        applyInitialWind(mesh, initialWind);
      }

      // process all outputs into new inputs on neighbors
      for (let i = 0; i < queue.length; i++) {
        const output = calculateWindOutput(queue[i], mesh.pxToKilometer);
        const neighborShares = calculateNeighborStrengths(output);
        queue[i].neighbors.forEach(n => {
          if (neighborShares[n.edge.degrees]) {
            console.log(`applying ${neighborShares[n.edge.degrees]} at ${n.edge.degrees} degrees, from ${queue[i].axial.q},${queue[i].axial.r} to ${n.meshItem.axial.q},${n.meshItem.axial.r}`);
            n.meshItem.input.wind.push({ degrees: output.degrees, strength: neighborShares[n.edge.degrees] });
            if (n.meshItem.input.wind.length == 1) {
              nextQueue.push(n.meshItem);
            }
          }
        });
      }

      // apply received inputs to produce next output
      //  - clear input for next round (or no round if this is stable)
      //  - return num changed to see if we're stable yet
      numChanged = nextQueue.reduce((ttl, m) => {
        const original = m.output.wind;
        m.output.wind = [calculateWindOutput(m, mesh.pxToKilometer)];
        m.input.wind = [];
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
    // console.log(mesh);
  }
};


// TODO - wind is not adding up correctly when split between tiles
