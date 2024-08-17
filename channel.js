import crypto from "crypto";

export class Channel {
  constructor(modulus) {
    this.modulus = modulus;
    this.state = "0";
    this.proof = [];
  }

  static sha256(message) {
    return crypto.createHash("sha256").update(message).digest("hex");
  }

  send(s) {
    const currentState = this.state;
    this.state = Channel.sha256(currentState + s);
    this.proof.push(s);
  }

  receiveRandomFieldElement() {
    const num = this.receiveRandomInt(0n, this.modulus - 1n, false);
    this.proof.push(`${num}`);
    return num;
  }

  receiveRandomInt(min, max, showInProof) {
    const num = (BigInt(`0x${this.state}`) + BigInt(min)) % BigInt(max - min + 1n);
    this.state = Channel.sha256(this.state);
    if (showInProof) {
      this.proof.push(`${num}`);
    }
    return num;
  }
}

function example() {
  let channel = new Channel(3n * 2n ** 30n + 1n);
  let a0 = channel.receiveRandomFieldElement();
  console.log("a0:", a0);
  let a1 = channel.receiveRandomFieldElement();
  console.log("a1:", a1);
  let a2 = channel.receiveRandomFieldElement();
  console.log("a2:", a2);

  channel.send("some_string");
  let randomElement = channel.receiveRandomFieldElement();
  console.log(channel.proof);
}

// example();
