// Copies every incoming audio block (stereo) to the page so it can be written as a WAV take.
class SonixRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length) {
      const l = input[0];
      const r = input[1] || input[0];
      this.port.postMessage([l.slice(0), r.slice(0)]);
    }
    return true;
  }
}
registerProcessor("sonix-recorder", SonixRecorder);
