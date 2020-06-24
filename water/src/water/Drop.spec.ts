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

  it("asas", () => {
    const x = [1, 2, 3];
    touchArray(x);
    console.log(x);

  });
});

function touchArray(ar: number[]) {
  ar.forEach((a, i) => ar[i] = a + 1);
}
