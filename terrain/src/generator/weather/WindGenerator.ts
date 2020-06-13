
// the goal is to produce general wind patterns for biomes, specific/daily simulation is a different stage
// using the basic rules from https://heredragonsabound.blogspot.com/2016/10/is-it-windy-in-here.html
//  1. Wind slows down when going uphill
//  2. Wind speeds up when going downhill
//  3. Wind turns when met with an obstruction

// import { Mesh } from "../../mesh/Mesh";
// import { IMeshItem } from "../../mesh/types";

// export enum Compass {
//   North,
//   South,
//   East,
//   West
// }

// NOTE: this was in progress then I realized doing this on the voronoi mesh is going to suuuuuck



// // wind output of a particular mesh item
// const calculateWindOutput = (meshItem: IMeshItem): { x: number, y: number, strength: number } => {
//   return { ...meshItem.input.wind };
// };

// // wind output on neighbors
// const calculate;

// export const WindGenerator = {
//   calculateWindEffect: (mesh: Mesh, initialVector: { x: number, y: number, strength: number }) => {
//     // the initial vector is applied to 2 edges
//     // TODO: would be nice to quickly grab all cells on an edge instead of calculating it each time - from IMeshItem[] to Mesh?
//     const queue = [] as IMeshItem[];
//     const targetX = initialVector.x < 0 ? Compass.East : Compass.West;
//     const targetY = initialVector.y < 0 ? Compass.South : Compass.North;

//     if (targetX === Compass.East) {
//       mesh.edges.east.forEach(m => queue.push(m));
//     }
//     else {
//       mesh.edges.west.forEach(m => queue.push(m));
//     }
//     if (targetY === Compass.North) {
//       mesh.edges.north.forEach(m => queue.push(m));
//     }
//     else {
//       mesh.edges.south.forEach(m => queue.push(m));
//     }

//     // initial step
//     for (let i = 0; i < queue.length; i++) {
//       queue[i].input.wind = [initialVector];
//     }

//     // process affected items + queue next step
//     for (let i = 0; i < queue.length; i++) {
//       const output = calculateWindOutput(queue[i]);
//       // split it amongst neighbors
//       queue[i].neighbors.forEach(n=> {
//         const neighborWindInput = calculateWindInput(queue[i].site, n.site, output)
//       });
//       queue[i].input.wind = calculateWindOutput(queue[i]);
//       // analyze neighbors to see who will get some

//     }
//   }
// };
