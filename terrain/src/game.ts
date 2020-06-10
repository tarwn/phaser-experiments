import { MainScene } from "./Scenes/MainScene";


class Game extends Phaser.Game {
  constructor() {
    super({
      type: Phaser.WEBGL,
      width: 600,
      height: 600,
      zoom: 5,
      physics: {
        default: 'arcade'
      },
      scene: [MainScene]
    });
  }
}

new Game();
