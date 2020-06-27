import * as Phaser from "phaser";

describe("misc", () => {
  it("does math", () => {
    const vec = new Phaser.Math.Vector3(1, 2, 3);
    const x = vec.clone().scale(3);
    console.log(vec);
    console.log(x);
    x.add(vec);
    console.log(x);
    expect(vec).toEqual(new Phaser.Math.Vector3(3, 6, 9));
  });

  it("asas", () => {
    const x = [1, 2, 3];
    console.log(x);
    console.log(x.shift());
    console.log(x);
    console.log(x.shift());
    console.log(x);
    console.log(x.shift());

  });

  it("calculates incline acceleration correctly", () => {
    const p1 = { x: 0, y: 0, h: 1 };
    const px2 = { x: 1, y: 0, h: 0 };
    const py2 = { x: 0, y: 1, h: 2 };

    const opposite = px2.h - p1.h;
    const adjacent = px2.x - p1.x;
    const hypotenuse = Math.sqrt(Math.pow(adjacent, 2) + Math.pow(opposite, 2));
    const angle = Math.asin(opposite / hypotenuse);
    console.log(hypotenuse);
    //expect(angle).toBeCloseTo(.7854, 5);
    const accel = 9.807 * Math.sin(angle);
    //expect(accel).toBeCloseTo(6.9345, 3);

    const simpler = 9.807 * opposite / hypotenuse;
    expect(simpler).toBe(accel);

    const simplerY = 9.807 * (py2.h - p1.h) / Math.sqrt(Math.pow(py2.y - p1.y, 2) + Math.pow(py2.h - p1.h, 2));

    const accelX = new Phaser.Math.Vector2(accel, 0);
    const accelY = new Phaser.Math.Vector2(0, simplerY);
    console.log(accelX.add(accelY).length());
    console.log(accelX);
  });
});

function touchArray(ar: number[]) {
  ar.forEach((a, i) => ar[i] = a + 1);
}
