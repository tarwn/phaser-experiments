import { VoronoiDrivenScene } from "./Scenes/VoronoiDrivenScene";
import { HexagonDrivenScene } from "./Scenes/HexagonDrivenScene";
import { HybridScene } from "./Scenes/HybridScene";


class Game extends Phaser.Game {
  constructor() {
    super({
      type: Phaser.WEBGL,
      width: 600,
      height: 600,
      zoom: 1.5,
      physics: {
        default: 'arcade'
      },
      scene: [
        //VoronoiDrivenScene,
        // HexagonDrivenScene,
        HybridScene
      ]
    });
  }
}

new Game();
