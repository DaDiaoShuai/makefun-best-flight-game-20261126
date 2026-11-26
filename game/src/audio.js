/* Sound, synthesised live with WebAudio. One clear job: every sound
   the game makes is built here from oscillators and noise — no audio
   files, no network, nothing to load. */

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    windGain: null,
    started: false,
  };

  function ensure() {
    if (audio.ctx) return audio.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio.ctx = new AC();
      const ctx = audio.ctx;
      // Engine: a low sawtooth through a low-pass filter.
      audio.engineOsc = ctx.createOscillator();
      audio.engineOsc.type = "sawtooth";
      audio.engineOsc.frequency.value = 62;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 420;
      audio.engineGain = ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(filter);
      filter.connect(audio.engineGain);
      audio.engineGain.connect(ctx.destination);
      audio.engineOsc.start();
      // Wind: looped filtered noise.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 700;
      audio.windGain = ctx.createGain();
      audio.windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(audio.windGain);
      audio.windGain.connect(ctx.destination);
      noise.start();
      audio.started = true;
    } catch (err) {
      audio.ctx = null;
    }
    return audio.ctx;
  }

  audio.unlock = function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === "suspended") ctx.resume();
  };

  audio.setEngine = function setEngine(rpm01, speed01) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    audio.engineOsc.frequency.setTargetAtTime(52 + rpm01 * 68, t, 0.1);
    audio.engineGain.gain.setTargetAtTime(0.045 + rpm01 * 0.05, t, 0.1);
    audio.windGain.gain.setTargetAtTime(speed01 * speed01 * 0.05, t, 0.2);
  };

  audio.setMuted = function setMuted(muted) {
    audio.muted = muted;
    if (audio.ctx) {
      const t = audio.ctx.currentTime;
      if (audio.engineGain) audio.engineGain.gain.setTargetAtTime(0, t, 0.05);
      if (audio.windGain) audio.windGain.gain.setTargetAtTime(0, t, 0.05);
    }
  };

  function blip(freq, dur, type, vol, when = 0) {
    if (!audio.ctx || audio.muted) return;
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + when;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol || 0.16, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  audio.ring = function ring() {
    blip(880, 0.5, "sine", 0.2);
    blip(1318, 0.6, "sine", 0.14, 0.09);
  };
  audio.land = function land() {
    blip(220, 0.35, "triangle", 0.2);
    blip(330, 0.5, "sine", 0.16, 0.08);
  };
  audio.crash = function crash() {
    if (!audio.ctx || audio.muted) return;
    const ctx = audio.ctx;
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  };
  audio.click = function click() {
    blip(660, 0.08, "square", 0.06);
  };

  return audio;
}
