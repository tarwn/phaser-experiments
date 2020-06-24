import * as Phaser from "phaser";
import { BasicScene } from "./Scenes/BasicScene";

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
        BasicScene
      ]
    });
  }
}

new Game();
