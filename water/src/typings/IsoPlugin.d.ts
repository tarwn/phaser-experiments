declare module 'phaser3-plugin-isometric' {
  import * as Phaser from "phaser";
  export default IsoPlugin;
  export class IsoSprite extends Phaser.GameObjects.Sprite {
    get isoX(): number;
    set isoX(value: number);
    get isoY(): number;
    set isoY(value: number);
    get isoZ(): number;
    set isoZ(value: number);
  }
}
