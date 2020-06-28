import * as Phaser from "phaser";

interface IStep {
  name: string;
  exec: () => any;
  repeatUntil: (i: number, out: any, prevOut: any) => boolean;
  outputLimit?: number;
};

const NEVER_REPEAT = () => true;

export interface ISimulationStepEvent {
  step: string,
  output: any,
  willRepeat: boolean,
  attemptNumber: number
}

export class Simulation {
  private steps = [] as IStep[];
  private stepIndex = -1;
  private stepAttempts = -1;
  private previousOutput: any;
  private isRunning = false;
  events: Phaser.Events.EventEmitter;

  constructor() {
    this.events = new Phaser.Events.EventEmitter();
  }

  queue(name: string, exec: () => void) {
    this.steps.push({ name, exec, repeatUntil: NEVER_REPEAT });
    return this;
  }

  repeat(name: string, exec: () => any, outputLimit?: number) {
    this.steps.push({ name, exec, repeatUntil: NEVER_REPEAT, outputLimit });
    return this;
  }

  until(repeatUntil: (i: number, out: any, prevOut: any) => boolean) {
    if (this.steps.length === 0) {
      throw new Error("Cannot add an until when there isn't a starting repeat");
    }

    const lastStep = this.steps[this.steps.length - 1];
    lastStep.repeatUntil = repeatUntil;
    return this;
  }

  complete() {
    if (this.steps.length === 0) {
      throw new Error("Cannot complete a simulation setup without at least on step");
    }

    this.stepIndex = 0;
    this.stepAttempts = 0;
    this.steps.push({
      name: "complete",
      exec: () => {
        console.timeEnd("simulation:total-time");
      },
      repeatUntil: NEVER_REPEAT
    });
    return this;
  }

  canRun() {
    return !this.isRunning && this.stepIndex > -1 && this.stepIndex < this.steps.length;
  }

  startOneStep() {
    if (this.steps.length <= this.stepIndex) {
      throw new Error("Cannot continue past the end of the defined simulation steps");
    }
    if (this.isRunning)
      return;
    this.isRunning = true;

    if (this.stepIndex == 0 && this.stepAttempts == 0) {
      console.time("simulation:total-time");
    }

    const step = this.steps[this.stepIndex];
    const count = ++this.stepAttempts;
    this.startLog(this.stepAttempts === 1, `Simulation:${step.name}`, count);
    try {
      const output = step.exec();
      const shouldRepeat = !step.repeatUntil(count, output, this.previousOutput);
      this.events.emit("stepComplete", {
        step: step.name,
        output,
        willRepeat: shouldRepeat,
        attemptNumber: count
      });
      if (shouldRepeat) {
        this.previousOutput = output;
        // stepAttempts is incremented already, we're just not resetting it
      }
      else {
        this.stepIndex++;
        this.stepAttempts = 0;
        this.previousOutput = undefined;
      }
    }
    catch (e) {
      console.log(`Simulation error on step ${this.stepIndex}, halting`);
      this.stepIndex = -1;
      console.error(e);
    }
    finally {
      if (step.outputLimit == undefined || this.stepAttempts % step.outputLimit === 0) {
        this.endLog(this.stepAttempts === 0, `Simulation:${step.name}`, count);
      }
    }
    this.isRunning = false;
  }


  startLog(showGrouped: boolean, group: string, count: number) {
    if (showGrouped) {
      console.group(group);
      console.log(`${group}:${count}`);
    }
    console.time(`${group}:${count}`);
  }

  endLog(showGrouped: boolean, group: string, count: number) {
    console.timeEnd(`${group}:${count}`);
    if (showGrouped) {
      console.groupEnd();
    }
    else { }
  }

}
