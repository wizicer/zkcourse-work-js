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

describe("bn128", async function () {
  this.timeout(0);

  const logger = {
    error: (msg) => {
      console.log("ERROR: " + msg);
    },
    warning: (msg) => {
      console.log("WARNING: " + msg);
    },
    info: (msg) => {
      console.log("INFO: " + msg);
    },
    debug: (msg) => {
      console.log("DEBUG: " + msg);
    },
  };

  let bn128;
  before(async () => {
  });
  after(async () => {
  });

  it("polynomial", async () => {
    // Polynomial.setField(("Z" + bn128.r.toString()));
    // Polynomial.setField(("Z11"));
    Polynomial.setField("R");
    let p = new Polynomial("3x^2").add("-x^2");
    // console.log(p.toString());
    let p1 = new Polynomial([40, 44, -16, 111, 32, -21]);
    // console.log("p1",p1)
    let p2 = new Polynomial([8, -4, 8, 7]);
    // console.log("p2",p2)
    let p3 = p1.div(p2);
    // console.log("p3",p3.toString())
    assert.equal("-3x^2+8x+5" , p3.toString());
  });

  it("kzg", async () => {
    bn128 = await buildBn128();
    // console.log(bn128.Fr.toString(bn128.Fr.w[28]));
    // console.log(bn128.r);
    Polynomial.setFiniteField(bn128.r);

    const Fr = bn128.Fr;
    // const field = galois.createPrimeField(Fr);
    // 0. prepare
    const fDegree = 10;
    // const f = [8,0,-2,5].map((fi) => Fr.e(fi,10));
    const f = Array.from({ length: fDegree }, () => Fr.random());
    const fPoly = new Polynomial(f.map((fi) => Fr.toString(fi, 10)));
    // console.log("f",f);

    // 1. setup
    // const alpha = field.rand();
    const alpha = Fr.random();
    // console.log(alpha)
    // const ck = Array.from({ length: fDegree }, () => bn128.G1.timesFr(bn128.G1.g, alpha));
    const ck = new Array(fDegree);
    let temp = bn128.G1.g;
    for (let i = 0; i < fDegree; i++) {
        ck[i] = temp;
        temp = bn128.G1.timesFr(temp, alpha);
    }
    const vk = bn128.G2.timesFr(bn128.G2.g, alpha);
    // console.log(ck)

    // 2. commit

    /**
     * @param {Polynomial} poly
     * @returns {*}
     */
    function commit(poly) {
      return poly
        .toArray()
        .map((fi, i) => bn128.G1.timesFr(ck[i], Fr.e(fi, 10)))
        .reduce((a, b) => bn128.G1.add(a, b), bn128.G1.zero);
    }
    const c = commit(fPoly);
    // console.log(c)

    // 3. prove
    const z = Fr.random();
    // const z = Fr.e(2,10);
    // ∑_(𝑖=0)^(𝑑−1) 𝑓_𝑖 𝑋^𝑖
    // const y = f.map((fi, i) => Fr.mul(fi, Fr.pow(z, i))).reduce((a, b) => Fr.add(a, b), Fr.zero);
    const y2 = f.reduce((pv, fi) => [Fr.add(Fr.mul(fi, pv[1]), pv[0]), Fr.mul(pv[1], z)], [Fr.zero, Fr.one])[0];
    // console.log("eval fpoly", fPoly, Fr.toString(z, 10))
    const y = fPoly.eval(Fr.toString(z, 10));
    assert.equal(y.toString() ,Fr.toString(y2, 10));
    // console.log(y,Fr.toString(y2,10));
    // const q =

    const dPoly = new Polynomial([Fr.toString(Fr.neg(z), 10), 1]);
    // console.log(fPoly, y, dPoly)
    // const qPoly = fPoly.sub(Fr.toString(y)).div(dPoly);
    const qPoly = fPoly.sub(y).div(dPoly);
    // console.log(qPoly.toArray(), qPoly.coeff);
    const pi = commit(qPoly);
    // console.log("pi", pi);

    // 4. verify
    const z2 = bn128.G2.timesFr(bn128.G2.g, z);
    const az = bn128.G2.sub(vk, z2);
    const az2 = bn128.G2.timesFr(bn128.G2.g, Fr.sub(alpha, z)); // az2 cannot be retrieved due to alpha is get rid after generation
    // console.log(bn128.G2.eq(az, az2), az, az2); // QUESTION: why not same but equal?
    assert(bn128.G2.eq(az, az2), "az!=az2");
    const cy = bn128.G1.sub(c, bn128.G1.timesFr(bn128.G1.g, Fr.e(y, 10)));
    const cy2 = bn128.G1.timesFr(bn128.G1.g, Fr.e(fPoly.eval(Fr.toString(alpha, 10)) - y, 10));
    assert(bn128.G1.eq(cy, cy2), "cy!=cy2");

    const pleft = bn128.pairing(cy, bn128.G2.g);
    const pright = bn128.pairing(pi, az);

    // console.log(bn128.F12.eq(pleft, pright), pleft.slice(0, 8), pright.slice(0, 8));
    assert(bn128.F12.eq(pleft, pright));

    const G1 = bn128.G1;
    const N = 1 << 10;

    const scalars = new BigBuffer(N * bn128.Fr.n8);
    const bases = new BigBuffer(N * G1.F.n8 * 2);
    let acc = Fr.zero;
    for (let i = 0; i < N; i++) {
      // if (i%100000 == 0) logger.debug(`setup ${i}/${N}`);
      const num = Fr.e(i + 1);
      scalars.set(Fr.fromMontgomery(num), i * bn128.Fr.n8);
      bases.set(G1.toAffine(G1.timesFr(G1.g, num)), i * G1.F.n8 * 2);
      acc = Fr.add(acc, Fr.square(num));
    }

    const accG = G1.timesFr(G1.g, acc);
    // const accG2 = await G1.multiExpAffine(bases, scalars, logger, "test");
    const accG2 = await G1.multiExpAffine(bases, scalars); //, logger, "test");

    assert(G1.eq(accG, accG2));

    bn128.terminate();
  });

  //   it("group property", async () => {
  //     const curve = bn128.G1;

  //     const G = curve.timesFr(curve.g, bn128.Fr.random());

  //     const sG2 = curve.timesScalar(G, Scalar.fromArray([2], 10));
  //     const sG2b = curve.timesFr(G, 2); // not equal to curve.add(G, G)
  //     const sG3 = curve.timesScalar(G, Scalar.fromArray([3], 10));
  //     const sG3b = curve.timesScalar(G, 3);
  //     assertBytes(sG3, sG3b);
  //     const sG4 = curve.timesScalar(G, Scalar.fromArray([4], 10));
  //     const sG4b = curve.timesScalar(sG2, Scalar.fromArray([2], 10));
  //     assertBytes(sG4, sG4b);
  //     const sG5 = curve.timesScalar(G, Scalar.fromArray([5], 10));
  //     //   const sG3 = curve.timesFr(G, 3);
  //     //   const sG5 = curve.timesFr(G, 5);
  //     const dG2 = curve.add(G, G);
  //     const dG3b = curve.add(G, curve.add(G, G));
  //     const dG3 = curve.add(G, dG2);
  //     assertBytes(dG3, dG3b);
  //     const dG2b = curve.sub(dG3, G);
  //     // console.log("2b", dG2, dG2b);
  //     assertBytes(dG2, dG2b);

  //     const dG4 = curve.add(G, dG3);
  //     const dG4b = curve.add(dG2, dG2);
  //     const dG4c = curve.double(dG2);
  //     assertBytes(dG4b, dG4c);
  //     console.log("4b", dG4, dG4b, dG4c);
  //     assertBytes(dG4, dG4b);
  //     const dG5 = curve.add(G, dG4);
  //     const dG52 = curve.add(G, curve.add(G, curve.add(G, curve.add(G, G))));

  //     const sse = Scalar.toLEBuff(Scalar.e(2));
  //     const ssa = Scalar.toArray([2], 32);

  //     //   console.log("ss", sse, ssa);

  //     //   console.log(2, sG2, dG2, sG2b);
  //     assertBytes(sG2, dG2);

  //     console.log(4, sG4, dG4);
  //     assertBytes(sG4, dG4);

  //     console.log(3, sG3, dG3);
  //     assertBytes(sG3, dG3);

  //     console.log(5, sG5, dG5);
  //     assertBytes(sG5, dG5);
  //   });

  //   it("Pedersen and its homomorphism 2", async () => {
  //     const curve = bn128.G1;

  //     // 0. prepare
  //     const m1 = Scalar.fromArray( bn128.Fr.random(),32);
  //     const m2 = Scalar.fromArray( bn128.Fr.random(),32);

  //     // 1. setup
  //     const G = curve.timesFr(curve.g, bn128.Fr.random());
  //     const H = curve.timesFr(curve.g, bn128.Fr.random());

  //     // 2. commit
  //     const r1 = Scalar.fromArray( bn128.Fr.random(),32);
  //     const c1 = curve.add(curve.timesScalar(H, r1), curve.timesScalar(G, m1));
  //     const r2 = Scalar.fromArray( bn128.Fr.random(),32);
  //     const c2 = curve.add(curve.timesScalar(H, r2), curve.timesScalar(G, m2));

  //     // 3. homomorphic property
  //     const c = bn128.Scalar.add(c1, c2);
  //     const r = bn128.Scalar.add(r1, r2);
  //     const m = bn128.Scalar.add(m1, m2);
  //     const c3 = curve.add(curve.timesScalar(H, r), curve.timesScalar(G, m));

  //     console.log("commitment c: ", c, c3);
  //     assert(c == c3);
  //   });
  //   it("Pedersen and its homomorphism 2", async () => {
  //     const curve = bn128.G1;

  //     // 0. prepare
  //     const m1 = bn128.Fr.random();
  //     const m2 = bn128.Fr.random();

  //     // 1. setup
  //     const G = curve.timesFr(curve.g, bn128.Fr.random());
  //     const H = curve.timesFr(curve.g, bn128.Fr.random());

  //     // 2. commit
  //     const r1 = bn128.Fr.random();
  //     const c1 = curve.add(curve.timesFr(H, r1), curve.timesFr(G, m1));
  //     const r2 = bn128.Fr.random();
  //     const c2 = curve.add(curve.timesFr(H, r2), curve.timesFr(G, m2));

  //     // 3. homomorphic property
  //     const c = curve.add(c1, c2);
  //     const r = bn128.Fr.add(r1, r2);
  //     const m = bn128.Fr.add(m1, m2);
  //     const c3 = curve.add(curve.timesFr(H, r), curve.timesFr(G, m));

  //     console.log("commitment c: ", c, c3);
  //     assert(c == c3);
  //   });

  it("field mul vs scalar mul", async () => {
    const curve = bn128.G1;

    const f = bn128.Fr.random();
    const fm = curve.timesFr(curve.g, f);

    const s = Scalar.fromArray(bn128.Fr.random(), 32);
    const sm = curve.timesScalar(curve.g, s);

    assert(fm != sm);

    // console.log(fm, sm);
  });
});

describe("galois", async function () {
  this.timeout(0);

  it("Pedersen for vector", async () => {
    // create a prime field with a large modulus
    const field = galois.createPrimeField(2n ** 256n - 351n * 2n ** 32n + 1n);

    const msgLength = 10;
    function fillArrayWithRandomNumbers(n) {
      const arr = Array.from({ length: n }, () => field.rand());
      return arr;
    }
    // 0. prepare
    const m = fillArrayWithRandomNumbers(msgLength);

    // 1. setup
    const G = fillArrayWithRandomNumbers(msgLength);
    const H = field.rand();

    // 2. commit
    const r = field.rand();
    const cH = field.exp(H, r);
    const cG = G.map((g, i) => field.exp(g, m[i])).reduce((a, b) => field.add(a, b), field.zero);
    const c = field.add(cH, cG);

    // console.log("commitment c: ", c);

    // 3. open
    const cH2 = field.exp(H, r);
    const cG2 = G.map((g, i) => field.exp(g, m[i])).reduce((a, b) => field.add(a, b), field.zero);
    const c2 = field.add(cH2, cG2);

    assert(c == c2);
  });

  //   it("Pedersen and its homomorphism", async () => {
  //     // create a prime field with a large modulus
  //     const field = galois.createPrimeField(2n ** 256n - 351n * 2n ** 32n + 1n);

  //     // 0. prepare
  //     const m1 = field.rand();
  //     const m2 = field.rand();

  //     // 1. setup
  //     const G = field.rand();
  //     const H = field.rand();

  //     // 2. commit
  //     const r1 = field.rand();
  //     const c1 = field.add(field.exp(H, r1), field.exp(G, m1));
  //     const r2 = field.rand();
  //     const c2 = field.add(field.exp(H, r2), field.exp(G, m2));

  //     // 3. homomorphic property
  //     const c = field.add(c1, c2);
  //     const r = field.add(r1, r2);
  //     const m = field.add(m1, m2);
  //     const c3 = field.add(field.exp(H, r), field.exp(G, m));

  //     // console.log("commitment c: ", c, c3);
  //     assert(c == c3);
  //   });
});
