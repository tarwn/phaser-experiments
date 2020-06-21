import * as Phaser from "phaser";
import { IWindMeasure } from "../../mesh/types";

export const combineWind = (wind: IWindMeasure[]): IWindMeasure => {
  const result = wind.reduce((v, w) => {
    const newVector = new Phaser.Math.Vector2(w.strength, 0)
      .setAngle(Phaser.Math.DegToRad(w.degrees));
    return v.add(newVector);
  }, new Phaser.Math.Vector2(0, 0));
  return {
    degrees: Phaser.Math.RadToDeg(result.angle()) % 360,
    strength: result.length(),
    source: "combined"
  };
};
