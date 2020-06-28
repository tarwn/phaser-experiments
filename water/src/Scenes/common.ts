import { IPosition } from "../water/types";
import { DIM, MAX_HEIGHT } from "./settings";

export const getIndex = (x: number, y: number): number => {
  return Math.round(x) + DIM.x * Math.round(y);
};

export const getLocation = (index: number): IPosition => {
  return {
    x: index % DIM.x,
    y: Math.floor(index / DIM.x)
  };
};


export const getColorFromHeight = (height: number): Phaser.Display.Color => {
  if (height > MAX_HEIGHT) {
    const colorAdjust = .1 + .8 * ((height - MAX_HEIGHT) / MAX_HEIGHT);
    const color2Adjust = .3 + .4 * ((height - MAX_HEIGHT) / MAX_HEIGHT);
    return Phaser.Display.Color.HSLToColor(.3, color2Adjust, colorAdjust);
  }
  else {
    const colorAdjust = 0.2 + .6 * (height / MAX_HEIGHT);
    return Phaser.Display.Color.HSLToColor(.3, .2, colorAdjust);
  }
};

export const getWaterColorFromHeight = (height: number): Phaser.Display.Color => {
  const colorAdjust = 1 - (.2 + .4 * (height / (2 * MAX_HEIGHT)));
  return Phaser.Display.Color.HSLToColor(.65, .6, colorAdjust);
};
