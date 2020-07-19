import { VoronoiDrivenScene } from "./Scenes/VoronoiDrivenScene";
import { HexagonDrivenScene } from "./Scenes/HexagonDrivenScene";
import { HybridScene } from "./Scenes/HybridScene";


class Game extends Phaser.Game {
  constructor() {
    super({
      type: Phaser.WEBGL,
      width: 900,
      height: 900,
      zoom: 1,
      physics: {
        default: 'arcade'
      },
      scene: [
        HybridScene,
        // VoronoiDrivenScene,
        // HexagonDrivenScene
      ]
    });
  }
}

new Game();
