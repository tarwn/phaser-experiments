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

  export class IsoScene extends Phaser.Scene {
    constructor(config: string | Phaser.Types.Scenes.SettingsConfig);
    iso: {
      projector: {
        origin: {
          setTo: (x: number, y: number) => void;
        }
      }
    };
    add: IsoSpriteFactory;
  }

  export class IsoSpriteFactory extends Phaser.GameObjects.GameObjectFactory {
    isoSprite: (x: number, y: number, z: number, key: string | Phaser.GameObjects.RenderTexture, frame?: string | number) => IsoSprite;
  }

  export const IsoPlugin: () => {}
}
