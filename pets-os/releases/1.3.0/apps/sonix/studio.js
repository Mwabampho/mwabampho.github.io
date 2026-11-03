// Artist Studio audio engine, ported from StudioAudioEngine in the Mac StudioView.swift:
// Record Vocal / Stop Recording, Play Last Take, Reveal Recordings, Save Project.
// Takes are recorded as 44.1 kHz stereo 16-bit WAV (the Mac writes AAC .m4a) and saved by
// node/main.js into Music/Sonix Studio.

export function encodeWav(left, right, sampleRate) {
  const frames = left.length;
  const buf = new ArrayBuffer(44 + frames * 4);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + frames * 4, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, frames * 4, true);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (const ch of [left, right]) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Uint8Array(buf);
}

const join = (parts, n) => {
  const out = new Float32Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export class StudioAudioEngine {
  constructor(onChange) {
    this.onChange = onChange;
    this.isRecording = false;
    this.isPlaying = false;
    this.status = "Ready";
    this.recordingPath = null;
    this.lastTakeSeconds = 0;
    // Where the microphone stream comes from. The self-test swaps this for a generated tone.
    this.getStream = () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    this.audio = null;
  }

  set(patch) { Object.assign(this, patch); this.onChange?.(); }

  async toggleRecord() {
    if (this.isRecording) return this.stopRecording();
    let stream;
    try {
      stream = await this.getStream();
    } catch {
      this.set({ status: "Microphone permission is required." });
      return;
    }
    try {
      await this.startRecording(stream);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      this.set({ status: `Recording failed: ${e.message || e}` });
    }
  }

  async startRecording(stream) {
    const ctx = new AudioContext({ sampleRate: 44100 });
    await ctx.audioWorklet.addModule("recorder-worklet.js");
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "sonix-recorder", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: "explicit" });
    const L = [], R = [];
    let frames = 0;
    node.port.onmessage = (e) => { L.push(e.data[0]); R.push(e.data[1]); frames += e.data[0].length; };
    const sink = ctx.createGain();
    sink.gain.value = 0; // keep the graph running without playing the mic back out loud
    src.connect(node).connect(sink).connect(ctx.destination);
    this.rec = { ctx, stream, node, L, R, get frames() { return frames; } };
    this.set({ isRecording: true, status: "Recording…" });
  }

  async stopRecording() {
    const rec = this.rec;
    if (!rec) return;
    this.rec = null;
    rec.stream.getTracks().forEach((t) => t.stop());
    await new Promise((r) => setTimeout(r, 60)); // let the last blocks arrive
    rec.node.port.onmessage = null;
    const n = rec.frames;
    const rate = rec.ctx.sampleRate;
    await rec.ctx.close();
    this.set({ isRecording: false });
    if (!n) { this.set({ status: this.recordingPath ? "Take saved to Music/Sonix Studio" : "Ready" }); return; }
    try {
      const wav = encodeWav(join(rec.L, n), join(rec.R, n), rate);
      const file = await window.shouldbe.invoke("studio.saveTake", wav);
      this.set({ recordingPath: file, lastTakeSeconds: n / rate, status: "Take saved to Music/Sonix Studio" });
    } catch (e) {
      this.set({ status: `Recording failed: ${e.message || e}` });
    }
  }

  async playLastTake() {
    if (!this.recordingPath) { this.set({ status: "Record a take first." }); return; }
    try {
      const bytes = await window.shouldbe.invoke("studio.readTake", this.recordingPath);
      const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      this.audio?.pause();
      const a = new Audio(url);
      this.audio = a;
      a.onended = () => { URL.revokeObjectURL(url); this.set({ isPlaying: false, status: "Ready" }); };
      await a.play();
      this.set({ isPlaying: true, status: "Playing last take" });
      return a;
    } catch (e) {
      this.set({ status: `Playback failed: ${e.message || e}` });
    }
  }

  revealRecordings() { return window.shouldbe.invoke("studio.reveal"); }

  saveProject(name) { return window.shouldbe.invoke("studio.saveProject", name); }
}
