import * as Phaser from "phaser";

interface IState {
  label: string;
  eventToEmit: string | undefined;
}

export class CommandButton extends Phaser.GameObjects.Group {
  isEnabled = false;
  eventToEmit: string | undefined;
  states: { [key: string]: IState }
  text!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number, initialText: string) {
    super(scene);

    this.states = {};
    this.createButton(x, y, width, height, initialText);
  }

  destroy() {
    super.destroy(true);
  }

  createButton(x: number, y: number, width: number, height: number, initialText: string) {
    const style = {
      font: "bold 12px Arial",
      fill: "#333333"
    };
    const rect = this.scene.add.rectangle(x, y, width, height, 0xcccccc, 1)
      .setOrigin(0, 0);
    const text = this.scene.add.text(x + 4, y + 4, initialText, style)
      .setOrigin(0, 0)
      .setWordWrapWidth(width - 8);
    this.text = text;

    rect.setInteractive();
    rect.on("pointerover", () => {
      if (this.isEnabled && this.eventToEmit) {
        rect.fillColor = 0xdddddd;
      }
    });
    rect.on("pointerout", () => {
      rect.fillColor = 0xcccccc;
    });
    rect.on("pointerdown", () => {
      if (this.isEnabled && this.eventToEmit) {
        rect.fillColor = 0xaaaaaa;
        this.scene.events.emit(this.eventToEmit);
      }
    });
    rect.on("pointerup", () => {
      rect.fillColor = 0xcccccc;
    });

    this.add(rect);
    this.add(text);
  }

  public addState(triggeringEvent: string, label: string, eventToEmit?: string) {
    this.states[triggeringEvent] = {
      label,
      eventToEmit
    };
    this.scene.events.on(triggeringEvent, () => {
      this.updateState(triggeringEvent);
    });
  }

  updateState(triggeringEvent: string) {
    if (this.states[triggeringEvent]) {
      const { label, eventToEmit } = this.states[triggeringEvent];
      this.text.setText(label);
      this.isEnabled = (eventToEmit !== undefined);
      this.eventToEmit = eventToEmit;
    }
  }
}
