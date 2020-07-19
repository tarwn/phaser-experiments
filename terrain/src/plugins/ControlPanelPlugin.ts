import * as Phaser from "phaser";
import { CommandButton } from "./CommandButton";

export interface IOptions {
  depth: number;
  borderThickness: number;
  borderColor: number;
  borderAlpha: number;
  windowAlpha: number;
  windowColor: number;
  windowHeight: number;
  padding: number;
  font: string;
  buttonWidth: number;
  buttonPadding: number;
  buttonHeight: number;
}

interface IDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IControlStates {
  triggeringEvent: string;
  label: string;
  onClickEvent?: string;
}

export interface IControl {
  initialText: string;
  states: IControlStates[];
}

export class ControlPanelPlugin extends Phaser.Plugins.ScenePlugin {
  graphics!: Phaser.GameObjects.Graphics;
  options!: IOptions;
  display!: {
    controls: CommandButton[]
  };
  controls!: IControl[];

  constructor(scene: Phaser.Scene, pluginManager: Phaser.Plugins.PluginManager) {
    super(scene, pluginManager);

    if (!scene.sys.settings.isBooted) {
      this.systems.events.once("boot", this.boot, this);
    }
  }

  boot() {
    const emitter = this.systems.events;
    emitter.once("destroy", this.destroy, this);
    emitter.once('shutdown', this.shutdown, this);
  }

  init(opts: any, controls?: IControl[]) {
    this.options = {
      depth: 1,
      borderThickness: 1,
      borderColor: 0x907748,
      borderAlpha: 1,
      windowsAlpha: 0.8,
      windowColor: 0x303030,
      windowHeight: 150,
      padding: 6,
      buttonWidth: 150,
      buttonHeight: 40,
      buttonPadding: 2,
      font: 'bold 12px Arial',
      ...opts
    };

    this.graphics = this.scene.add.graphics();
    this.graphics.setDepth(this.options.depth);

    // Create command panel
    this.display = {
      controls: []
    };
    this.controls = controls ?? [];
    this._showContent(this.controls);
  }

  shutdown() {
    this.display.controls.forEach(c => c.destroy());
    this.display.controls = [];
  }

  destroy() {
    this.systems.events.off("boot", this.boot, this);
    this.display.controls.forEach(c => c.destroy());
    this.display.controls = [];
    super.destroy();
  }

  private _showContent(controls: IControl[]) {
    const { buttonWidth, buttonHeight, buttonPadding, padding } = this.options;
    const gameHeight = this._getGameHeight() - padding;
    const gameWidth = this._getGameWidth() - 2 * padding;

    const horizantalButtonCount = Math.floor(gameWidth / (buttonWidth + buttonPadding));
    const buttonRowCount = Math.ceil(controls.length / horizantalButtonCount);

    this.display.controls = controls.map((c, i) => {
      const x = padding + (i % horizantalButtonCount) * (buttonWidth + buttonPadding);
      const y = gameHeight - padding - (buttonRowCount - Math.floor(i / horizantalButtonCount)) * (buttonHeight + buttonPadding);
      const button = new CommandButton(this.scene, x, y, buttonWidth, buttonHeight, c.initialText);
      c.states.forEach(cs => {
        button.addState(cs.triggeringEvent, cs.label, cs.onClickEvent);
      });
      button.setDepth(this.options.depth);
      return button;
    });
  }

  private _getGameWidth() {
    return this.scene.sys.game.config.width as number;
  }

  private _getGameHeight() {
    return this.scene.sys.game.config.height as number;
  }

}
