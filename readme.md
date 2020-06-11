# What is this?

Experiments on different ideas in proecural generation to stretch my mind.

# How to run
_Future Eli, you are welcome_

This project has a number of things built-in:
* eslint: a mix of recommended and reasonable rules, autofix is on by default in vscode via settings
* typescript: 3.8.3+
* npm because I'm lazy
* editorconfig because vscode will autofix to standard stuff if you have the extension
* wallaby (Ctrl+R, R) for realtime test runner
* jest for tests
* phaser as the base engine

# Contents

## Top Level Commands
There are only two top-level commands at the moment:
* `npm test`
* `npm run lint`

## Voronoi Example

![Example of voronoi chart](./voronoi-example/example.png)

Uses the [Javascript-Voronoi](https://github.com/gorhill/Javascript-Voronoi) library and Phaser 3 polygons:
* A handwritten Typescript definition file, the hardest part: [see it here](./voronoi-example/src/typings/voronoi.d.ts)
* Turns out it's super important to `setOrigin(0,0)` when you're drawing polygons

1. `cd voronoi-example`
2. `npm i`
3. `npm run start`

Just ____?
* terrain: `cd terrain & npm run start`




