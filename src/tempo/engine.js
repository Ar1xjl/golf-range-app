// Motor de audio del Tempo Trainer - portado 1:1 desde
// legacy/tempo_trainer_doppler_prototipo.html (ya validado, sin cambios de
// comportamiento: mismas proporciones 3:1, curvas de tono/volumen, y los 3
// motores de sonido).
//
// Unico cambio real respecto al prototipo: en vez de un IIFE que vive para
// siempre en una pagina estatica, esto es una factory (createTempoEngine)
// con dispose() explicito. En nuestra app las pantallas se reemplazan por
// innerHTML sin recargar, asi que si el usuario sale del Tempo Trainer sin
// tocar "Detener", el setTimeout que encadena ciclos y el AudioContext
// seguirian corriendo en segundo plano para siempre si nadie los para. El
// screen (screens/tempo.js) llama a dispose() en cualquier camino de salida.
//
// El motor tampoco toca el DOM (a diferencia del prototipo, que hacia
// document.getElementById directo) - expone getCycleTiming()/getTempoPreset()
// para que la pantalla dibuje la barra y el marcador con su propio rAF.
// Separacion de responsabilidades, no un cambio de logica de audio.

const TEMPOS = {
  lento: { back: 0.90, pause: 0.08, down: 0.30, tail: 0.22, rest: 0.55 },
  medio: { back: 0.75, pause: 0.06, down: 0.25, tail: 0.18, rest: 0.42 },
  rapido: { back: 0.60, pause: 0.05, down: 0.20, tail: 0.15, rest: 0.32 },
};

function makeDistortionCurve(amount) {
  const n = 44100;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function buildNoiseBuffer(ctx, seconds) {
  const bufferSize = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// ---- Interpolation modes ----
// Linear: used for pitch (Hz) — a direct, proportional sweep.
// Exponential/geometric: used for loudness — the ear perceives loudness on a
// roughly logarithmic scale, so equal *perceptual* steps need exponential
// (not linear) steps in raw gain. This is what makes the quiet moment at the
// transition actually read as quiet, and the impact peak read as a real jump.
function linInterp(a, b, s) { return a + (b - a) * s; }
function expInterp(a, b, s) {
  const aa = Math.max(a, 0.0008), bb = Math.max(b, 0.0008);
  return aa * Math.pow(bb / aa, s);
}

// ---- Clubhead-speed-shaped curves ----
// Backswing: starts at ~0 speed, accelerates to a mid-swing peak, decelerates
// back toward ~0 at the top (the natural pause before transition). Symmetric arch.
function backswingCurve(fromV, peakV, steps, interp) {
  steps = steps || 48;
  interp = interp || linInterp;
  const arr = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    const shape = Math.sin(Math.PI * x); // 0 -> 1 (mid) -> 0
    arr[i] = interp(fromV, peakV, shape);
  }
  return arr;
}
// Downswing: speed builds slowly off the transition, then accelerates hard
// into impact (the "release"/whip). Ease-in curve, not linear.
function downswingCurve(fromV, peakV, steps, interp) {
  steps = steps || 40;
  interp = interp || linInterp;
  const arr = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    const shape = Math.pow(x, 2.3); // slow start, fast finish
    arr[i] = interp(fromV, peakV, shape);
  }
  return arr;
}
// Follow-through: rapid deceleration right after impact, then leveling off.
function tailCurve(fromV, toV, steps, interp) {
  steps = steps || 24;
  interp = interp || linInterp;
  const arr = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    const shape = 1 - Math.pow(1 - x, 2); // fast drop, then leveling
    arr[i] = interp(fromV, toV, shape);
  }
  return arr;
}

function scaleCurve(curve, factor) {
  const out = new Float32Array(curve.length);
  for (let i = 0; i < curve.length; i++) out[i] = curve[i] * factor;
  return out;
}

export function createTempoEngine(initial) {
  let audioCtx = null;
  let playing = false;
  let currentTempo = (initial && initial.tempo) || 'medio';
  let soundMode = (initial && initial.soundMode) || 'natural';
  let tickEnabled = !!(initial && initial.tickEnabled);
  let freqLow = (initial && initial.freqLow) || 260;
  let freqHigh = (initial && initial.freqHigh) || 950;

  let cycleTimeoutId = null;
  let cycleStartPerf = 0;
  let cycleDurationMs = 0;

  // Natural engine nodes
  let noiseSource = null, filter = null, naturalGain = null;
  // Star Wars engine nodes
  let carrier = null, ringMod = null, ringGain = null, waveshaper = null, starwarsGain = null;
  // Organ engine nodes
  let organFund = null, organH2 = null, organH3 = null, organGFund = null, organGH2 = null, organGH3 = null, organGain = null;
  // Shared
  let masterGain = null;
  let tickBuffer = null;

  function setupAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(audioCtx.destination);

    // Natural (filtered noise) chain
    noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buildNoiseBuffer(audioCtx, 2);
    noiseSource.loop = true;
    filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.1;
    filter.frequency.value = 500;
    naturalGain = audioCtx.createGain();
    naturalGain.gain.value = 0.0;
    noiseSource.connect(filter);
    filter.connect(naturalGain);
    naturalGain.connect(masterGain);
    noiseSource.start();

    // Star Wars (ring-modulated oscillator) chain
    carrier = audioCtx.createOscillator();
    carrier.type = 'sawtooth';
    carrier.frequency.value = 150;
    ringMod = audioCtx.createOscillator();
    ringMod.type = 'sine';
    ringMod.frequency.value = 34;
    ringGain = audioCtx.createGain();
    ringGain.gain.value = 0;
    waveshaper = audioCtx.createWaveShaper();
    waveshaper.curve = makeDistortionCurve(12);
    starwarsGain = audioCtx.createGain();
    starwarsGain.gain.value = 0.0;

    carrier.connect(ringGain);
    ringMod.connect(ringGain.gain);
    ringGain.connect(waveshaper);
    waveshaper.connect(starwarsGain);
    starwarsGain.connect(masterGain);
    carrier.start();
    ringMod.start();

    // Organ (additive harmonic synthesis) chain -- inspired by Sonic Golf's
    // MIDI/pipe-organ tone: a fundamental sine plus two harmonics (x2, x3)
    // at decreasing amplitude, all riding the same speed-mapped pitch curve.
    organFund = audioCtx.createOscillator();
    organFund.type = 'sine';
    organFund.frequency.value = 300;
    organH2 = audioCtx.createOscillator();
    organH2.type = 'sine';
    organH2.frequency.value = 600;
    organH3 = audioCtx.createOscillator();
    organH3.type = 'triangle';
    organH3.frequency.value = 900;
    organGFund = audioCtx.createGain(); organGFund.gain.value = 0.55;
    organGH2 = audioCtx.createGain(); organGH2.gain.value = 0.28;
    organGH3 = audioCtx.createGain(); organGH3.gain.value = 0.14;
    organGain = audioCtx.createGain(); organGain.gain.value = 0.0;

    organFund.connect(organGFund); organGFund.connect(organGain);
    organH2.connect(organGH2); organGH2.connect(organGain);
    organH3.connect(organGH3); organGH3.connect(organGain);
    organGain.connect(masterGain);
    organFund.start(); organH2.start(); organH3.start();

    // Tick (impact click) buffer
    tickBuffer = buildNoiseBuffer(audioCtx, 0.05);
  }

  function scheduleTick(tImpact) {
    if (!tickEnabled) return;
    const src = audioCtx.createBufferSource();
    src.buffer = tickBuffer;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2800;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, tImpact);
    g.gain.exponentialRampToValueAtTime(0.5, tImpact + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, tImpact + 0.05);
    src.connect(hp);
    hp.connect(g);
    g.connect(masterGain);
    src.start(tImpact);
    src.stop(tImpact + 0.06);
  }

  function scheduleCycle() {
    const t = TEMPOS[currentTempo];
    const lookahead = 0.05;
    const t0 = audioCtx.currentTime + lookahead;
    const tTop = t0 + t.back;
    const tPauseEnd = tTop + t.pause;
    const tImpact = tPauseEnd + t.down;
    const tTail = tImpact + t.tail;

    if (soundMode === 'natural') {
      naturalGain.gain.cancelScheduledValues(t0);
      filter.frequency.cancelScheduledValues(t0);

      const backPeakFreq = freqLow + (freqHigh - freqLow) * 0.55;
      filter.frequency.setValueCurveAtTime(backswingCurve(freqLow, backPeakFreq), t0, t.back);
      naturalGain.gain.setValueCurveAtTime(backswingCurve(0.02, 0.30, undefined, expInterp), t0, t.back);
      // holds at freqLow / 0.02 through the pause automatically

      filter.frequency.setValueCurveAtTime(downswingCurve(freqLow, freqHigh), tPauseEnd, t.down);
      naturalGain.gain.setValueCurveAtTime(downswingCurve(0.02, 0.65, undefined, expInterp), tPauseEnd, t.down);

      filter.frequency.setValueCurveAtTime(tailCurve(freqHigh, freqLow + (freqHigh - freqLow) * 0.12), tImpact, t.tail);
      naturalGain.gain.setValueCurveAtTime(tailCurve(0.65, 0.001, undefined, expInterp), tImpact, t.tail);

      starwarsGain.gain.cancelScheduledValues(t0);
      starwarsGain.gain.setValueAtTime(0.0, t0);
      organGain.gain.cancelScheduledValues(t0);
      organGain.gain.setValueAtTime(0.0, t0);
    } else if (soundMode === 'starwars') {
      starwarsGain.gain.cancelScheduledValues(t0);
      carrier.frequency.cancelScheduledValues(t0);

      const lowF = Math.max(40, freqLow * 0.4);
      const highF = Math.max(lowF + 20, freqHigh * 0.4);
      const backPeakF = lowF + (highF - lowF) * 0.55;

      carrier.frequency.setValueCurveAtTime(backswingCurve(lowF, backPeakF), t0, t.back);
      starwarsGain.gain.setValueCurveAtTime(backswingCurve(0.015, 0.22, undefined, expInterp), t0, t.back);

      carrier.frequency.setValueCurveAtTime(downswingCurve(lowF, highF), tPauseEnd, t.down);
      starwarsGain.gain.setValueCurveAtTime(downswingCurve(0.015, 0.42, undefined, expInterp), tPauseEnd, t.down);

      carrier.frequency.setValueCurveAtTime(tailCurve(highF, lowF + (highF - lowF) * 0.12), tImpact, t.tail);
      starwarsGain.gain.setValueCurveAtTime(tailCurve(0.42, 0.001, undefined, expInterp), tImpact, t.tail);

      naturalGain.gain.cancelScheduledValues(t0);
      naturalGain.gain.setValueAtTime(0.0, t0);
      organGain.gain.cancelScheduledValues(t0);
      organGain.gain.setValueAtTime(0.0, t0);
    } else if (soundMode === 'organ') {
      organGain.gain.cancelScheduledValues(t0);
      organFund.frequency.cancelScheduledValues(t0);
      organH2.frequency.cancelScheduledValues(t0);
      organH3.frequency.cancelScheduledValues(t0);

      const oLow = freqLow, oHigh = freqHigh;
      const oBackPeak = oLow + (oHigh - oLow) * 0.55;

      const backBase = backswingCurve(oLow, oBackPeak);
      organFund.frequency.setValueCurveAtTime(backBase, t0, t.back);
      organH2.frequency.setValueCurveAtTime(scaleCurve(backBase, 2), t0, t.back);
      organH3.frequency.setValueCurveAtTime(scaleCurve(backBase, 3), t0, t.back);
      organGain.gain.setValueCurveAtTime(backswingCurve(0.02, 0.28, undefined, expInterp), t0, t.back);

      const downBase = downswingCurve(oLow, oHigh);
      organFund.frequency.setValueCurveAtTime(downBase, tPauseEnd, t.down);
      organH2.frequency.setValueCurveAtTime(scaleCurve(downBase, 2), tPauseEnd, t.down);
      organH3.frequency.setValueCurveAtTime(scaleCurve(downBase, 3), tPauseEnd, t.down);
      organGain.gain.setValueCurveAtTime(downswingCurve(0.02, 0.60, undefined, expInterp), tPauseEnd, t.down);

      const tailBase = tailCurve(oHigh, oLow + (oHigh - oLow) * 0.12);
      organFund.frequency.setValueCurveAtTime(tailBase, tImpact, t.tail);
      organH2.frequency.setValueCurveAtTime(scaleCurve(tailBase, 2), tImpact, t.tail);
      organH3.frequency.setValueCurveAtTime(scaleCurve(tailBase, 3), tImpact, t.tail);
      organGain.gain.setValueCurveAtTime(tailCurve(0.60, 0.001, undefined, expInterp), tImpact, t.tail);

      naturalGain.gain.cancelScheduledValues(t0);
      naturalGain.gain.setValueAtTime(0.0, t0);
      starwarsGain.gain.cancelScheduledValues(t0);
      starwarsGain.gain.setValueAtTime(0.0, t0);
    }

    scheduleTick(tImpact);

    cycleStartPerf = performance.now() + lookahead * 1000;
    cycleDurationMs = (t.back + t.pause + t.down + t.tail) * 1000;

    const totalCycle = (t.back + t.pause + t.down + t.tail + t.rest) * 1000;
    cycleTimeoutId = setTimeout(scheduleCycle, totalCycle);
  }

  function start() {
    if (!audioCtx) setupAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    playing = true;
    scheduleCycle();
  }

  function stop() {
    playing = false;
    if (cycleTimeoutId) { clearTimeout(cycleTimeoutId); cycleTimeoutId = null; }
    if (audioCtx) {
      const now = audioCtx.currentTime;
      if (naturalGain) { naturalGain.gain.cancelScheduledValues(now); naturalGain.gain.linearRampToValueAtTime(0, now + 0.15); }
      if (starwarsGain) { starwarsGain.gain.cancelScheduledValues(now); starwarsGain.gain.linearRampToValueAtTime(0, now + 0.15); }
      if (organGain) { organGain.gain.cancelScheduledValues(now); organGain.gain.linearRampToValueAtTime(0, now + 0.15); }
    }
  }

  // Cierre completo del engine: para el audio y libera el AudioContext.
  // La pantalla del Tempo Trainer llama a esto en CUALQUIER camino de
  // salida (no solo el boton "Detener"), porque a diferencia del prototipo
  // (una pagina estatica) esta app intercambia pantallas sin recargar - si
  // nadie limpia esto, el ciclo de audio sigue sonando en segundo plano.
  function dispose() {
    stop();
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  }

  function setTempo(tempo) {
    currentTempo = tempo;
    if (playing) { if (cycleTimeoutId) clearTimeout(cycleTimeoutId); scheduleCycle(); }
  }

  function setSoundMode(mode) {
    soundMode = mode;
    if (playing) { if (cycleTimeoutId) clearTimeout(cycleTimeoutId); scheduleCycle(); }
  }

  // Los sliders de frecuencia son "vivos" en el sentido del prototipo: toman
  // efecto en el proximo ciclo agendado, sin cortar ni redibujar el ciclo
  // que ya esta sonando.
  function setFreqLow(v) { freqLow = v; }
  function setFreqHigh(v) { freqHigh = v; }
  function setTickEnabled(v) { tickEnabled = v; }

  function isPlaying() { return playing; }
  function getTempoPreset(tempo) { return TEMPOS[tempo || currentTempo]; }
  function getCycleTiming() { return { cycleStartPerf, cycleDurationMs }; }

  return {
    start, stop, dispose,
    setTempo, setSoundMode, setFreqLow, setFreqHigh, setTickEnabled,
    isPlaying, getTempoPreset, getCycleTiming,
  };
}
