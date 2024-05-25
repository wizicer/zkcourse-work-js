import { buildBn128, BigBuffer, utils, Scalar } from "ffjavascript";
import { assert, expect } from "chai";
import * as galois from "@guildofweavers/galois";
// import Polynomial from "polynomial";
import Polynomial from "../lib/polynomial/polynomial.js";
import { secp256k1 } from "@noble/curves/secp256k1";
import EC from "elliptic";
import BN from "bn.js";

let log2 = utils.log2;
BigInt.prototype.toJSON = function () {
  return this.toString();
};

function assertBytes(expect, actual) {
  assert(expect.length == actual.length);
  for (let i = 0; i < expect.length; i++) {
    assert(expect[i] == actual[i]);
  }
}
describe("polynomial", async function () {
  this.timeout(0);

  it("interpolation test", async () => {
    let p = Polynomial.interpolate([
      [1, 1],
      [5, 4],
    ]);
    let d = p.eval(10);
    assert(p.toString() == "0.75x+0.25");
    assert(d == 7.75);

    Polynomial.setFiniteField(3n * 2n ** 30n + 1n);
    let pf = Polynomial.interpolate([
      [1, 1],
      [5, 4],
    ]);
    let df = pf.eval(10);
    assert(pf.toString() == "805306369x+2415919105");
    assert(df == 805306376n);
  });
});

describe("standard fri", async function () {
  this.timeout(0);

  it("fri test", async () => {
    const field = galois.createPrimeField(3n * 2n ** 30n + 1n);

    const c = field.add(3221225472n, 10n);
    assert(c == 9n);

    const arr = [1n, 3141592n];
    for (let i = 0; i < 1021; i++) {
      arr.push(field.add(field.mul(arr[i], arr[i]), field.mul(arr[i + 1], arr[i + 1])));
    }

    assert(arr[1022] == 2338775057n);

    const g = pow(field, 5n, 3n * 2n ** 20n);
    // console.log(g);

    const g_arr = [];
    for (let i = 0; i < 1024; i++) {
      g_arr.push(pow(field, g, BigInt(i)));
    }
    // console.log(g_arr.slice(0, 5));

    assert(isOrder(field, g, 1024), "g is not of order 1024");
    let b = field.one;
    for (let i = 0; i < 1023; i++) {
      assert(b == g_arr[i], `The ${i}-th place in G is not equal to the ${i}-th power of g.`);

      b = field.mul(b, g);
      let wrongOrder = i + 1;
      assert(b != field.one, `g is of order ${wrongOrder}`);
    }

    assert(field.mul(b, g) == field.one, "g is of order > 1024");
    // console.log(arr.length);

    const xs = g_arr.slice(0, g_arr.length - 1);
    // console.log(xs.length, xs.slice(0, 5));
    const points = xs.map((x, i) => [x, arr[i]]);
    // console.log(points.length, points.slice(0, 5));

    // const f = interpolate(field, points);
    // const v = f(2);

    const weights = barycentricWeights(points, field);
    const v = barycentricInterpolation(points, weights, 2, field);

    assert(BigInt(v) == 1302089273n);
  });
});

function pow(field, base, n) {
  let current_pow = base;
  let res = 1n;
  while (n > 0n) {
    if (n % 2n !== 0n) {
      res = field.mul(res, current_pow);
    }
    n = n / 2n;
    current_pow = field.mul(current_pow, current_pow);
  }

  return res;
}

function isOrder(field, g, n) {
  if (n < 1) {
    throw new Error("n must be greater than or equal to 1");
  }
  let h = field.one;
  for (let i = 1; i < n; i++) {
    h = field.mul(h, g);
    if (h == field.one) {
      return false;
    }
  }
  h = field.mul(h, g);
  return h == field.one;
}

// https://github.com/feklee/interpolating-polynomial/blob/master/node_main.js
// Neville's algorithm
// too slow, feasible for small number of points (<10)
function interpolate(field, points) {
  let n = points.length - 1,
    p;

  p = function (i, j, x) {
    console.log(i, j, x);
    if (i === j) {
      return points[i][1];
    }

    // return ((points[j][0] - x) * p(i, j - 1, x) +
    //         (x - points[i][0]) * p(i + 1, j, x)) /
    //     (points[j][0] - points[i][0]);
    const xb = BigInt(x);
    const xj = BigInt(points[j][0]);
    const xi = BigInt(points[i][0]);

    const numerator1 = field.mul(field.sub(xj, xb), p(i, j - 1, x));
    const numerator2 = field.mul(field.sub(xb, xi), p(i + 1, j, x));
    const denominator = field.sub(xj, xi);

    return field.div(field.add(numerator1, numerator2), denominator);
  };

  return function (x) {
    if (points.length === 0) {
      return 0;
    }
    return p(0, n, x);
  };
}

function barycentricWeights(points, field) {
  const n = points.length;
  const w = Array(n)
    .fill(1n)
    .map(() => BigInt(1));
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      if (j !== k) {
        w[j] = field.div(w[j], field.sub(BigInt(points[j][0]), BigInt(points[k][0])));
      }
    }
  }
  return w;
}

function barycentricInterpolation(points, weights, x, field) {
  const n = points.length;
  let numerator = 0n;
  let denominator = 0n;

  for (let j = 0; j < n; j++) {
    const term = field.div(weights[j], field.sub(BigInt(x), BigInt(points[j][0])));
    numerator = field.add(numerator, field.mul(term, BigInt(points[j][1])));
    denominator = field.add(denominator, term);
  }

  return field.div(numerator, denominator);
}
