import * as Phaser from "phaser";
import { BasicScene } from "./Scenes/BasicScene";
import { IsoScene } from "./Scenes/IsoScene";

class Game extends Phaser.Game {
  constructor() {
    super({
      type: Phaser.WEBGL,
      width: 900,
      height: 600,
      zoom: 1,
      physics: {
        default: 'arcade'
      },
      scene: [
        IsoScene,
        BasicScene
      ]
    });
  }
}

new Game();
