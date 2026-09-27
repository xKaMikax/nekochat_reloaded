// Collects microphone samples into 20 ms Opus frames (960 samples at 48 kHz) off the main
// thread; nekochat.js encodes each frame it receives on the port.
class NekoChatCapture extends AudioWorkletProcessor {
  constructor() { super(); this.frame = new Float32Array(960); this.length = 0; }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (input) {
      for (let index = 0; index < input.length; index += 1) {
        this.frame[this.length++] = input[index];
        if (this.length === 960) { this.port.postMessage(this.frame, [this.frame.buffer]); this.frame = new Float32Array(960); this.length = 0; }
      }
    }
    return true;
  }
}
registerProcessor('nekochat-capture', NekoChatCapture);
