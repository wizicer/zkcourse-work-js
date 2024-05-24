import { buildBn128, BigBuffer } from "ffjavascript";
import { assert } from "chai";

let logger = {
  debug: console.log,
};

let bn128;
bn128 = await buildBn128();
const Fr = bn128.Fr;
const G1 = bn128.G1;
const N = 1 << 10;

const scalars = new BigBuffer(N * bn128.Fr.n8);
const bases = new BigBuffer(N * G1.F.n8 * 2);
let acc = Fr.zero;
for (let i = 0; i < N; i++) {
  if (i % 100000 == 0) logger.debug(`setup ${i}/${N}`);
  const num = Fr.e(i + 1);
  scalars.set(Fr.fromMontgomery(num), i * bn128.Fr.n8);
  bases.set(G1.toAffine(G1.timesFr(G1.g, num)), i * G1.F.n8 * 2);
  acc = Fr.add(acc, Fr.square(num));
}

const accG = G1.timesFr(G1.g, acc);
const accG2 = await G1.multiExpAffine(bases, scalars, logger, "test");

assert(G1.eq(accG, accG2));

const a = [];
for (let i = 0; i < 8; i++) a[i] = Fr.e(i + 1);
const A = await bn128.Fr.fft(a);
console.log(bn128.Fr.toString(bn128.Fr.w[28]));

bn128.terminate();
