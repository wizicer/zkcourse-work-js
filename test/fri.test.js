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

describe("galois", async function () {
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
    for (let i = 0; i < 1023; i++) {
      g_arr.push(field.exp(g, arr[i]));
    }

    let b = g;
    for (let i = 0; i < 1023; i++) {
      if (!b == g_arr[i]) {
        throw new Error(`The ${i}-th place in G is not equal to the ${i}-th power of g.`);
      }
      b = field.mul(b, g);
      let wrongOrder = i + 1;
      if (b == g) {
        throw new Error(`g is of order ${wrongOrder}`);
      }
    }

    if (field.mul(b, g) == g) {
      console.log("Success!");
    } else {
      console.log("g is of order > 1024");
    }

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
