// Motor de audio del Tempo Trainer.
//
// Base portada 1:1 desde legacy/tempo_trainer_doppler_prototipo.html (curvas
// de tono/volumen, relacion 3:1, motores Natural/GolfSaber). Reverb,
// contraste dinamico, los 6 presets de velocidad estilo Garmin y el motor
// Relax (cuenco tibetano) se disenaron y probaron en un artifact aparte
// ("Tempo Sound Lab") antes de llevarlos aca - ver comentarios puntuales.
//
// Factory (createTempoEngine) con dispose() explicito: a diferencia del
// prototipo (pagina estatica), esta app intercambia pantallas sin recargar,
// asi que el AudioContext y el setTimeout que encadena ciclos necesitan un
// cierre manual o quedan sonando en segundo plano para siempre.
//
// El motor tampoco toca el DOM - expone getCycleTiming()/getTempoPreset()
// para que la pantalla dibuje la barra y el marcador con su propio rAF.

// 6 presets de velocidad (proporcion 3:1 backswing:downswing en los 6),
// tomados de los stop points del Garmin Tempo Trainer Pro (back/down en
// segundos). Garmin no publica pausa/tail/rest, asi que esos 3 valores se
// derivan proporcionalmente a como ya escalaban los presets originales
// (pausa ~8% del backswing, tail ~73% del downswing, rest ~43% del ciclo
// activo) - confirmado contra el preset "Lento" original (0.90/0.30), que
// coincide casi exacto con "Pro Lento" de Garmin.
const TEMPOS = {
  'am-slow':    { back: 1.20, pause: 0.10, down: 0.40, tail: 0.29, rest: 0.67 },
  'am-medium':  { back: 1.10, pause: 0.09, down: 0.37, tail: 0.27, rest: 0.62 },
  'am-fast':    { back: 1.00, pause: 0.08, down: 0.33, tail: 0.24, rest: 0.56 },
  'pro-slow':   { back: 0.90, pause: 0.07, down: 0.30, tail: 0.22, rest: 0.50 },
  'pro-medium': { back: 0.80, pause: 0.06, down: 0.27, tail: 0.19, rest: 0.45 },
  'pro-fast':   { back: 0.70, pause: 0.06, down: 0.23, tail: 0.17, rest: 0.39 },
};

export const TEMPO_ORDER = ['am-slow', 'am-medium', 'am-fast', 'pro-slow', 'pro-medium', 'pro-fast'];
export const TEMPO_LABELS = {
  'am-slow': 'Amateur Lento', 'am-medium': 'Amateur Medio', 'am-fast': 'Amateur Rapido',
  'pro-slow': 'Pro Lento', 'pro-medium': 'Pro Medio', 'pro-fast': 'Pro Rapido',
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
// (not linear) steps in raw gain.
function linInterp(a, b, s) { return a + (b - a) * s; }
function expInterp(a, b, s) {
  const aa = Math.max(a, 0.0008), bb = Math.max(b, 0.0008);
  return aa * Math.pow(bb / aa, s);
}

function backswingCurve(fromV, peakV, steps, interp) {
  steps = steps || 48;
  interp = interp || linInterp;
  const arr = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    arr[i] = interp(fromV, peakV, Math.sin(Math.PI * x));
  }
  return arr;
}
function downswingCurve(fromV, peakV, steps, interp) {
  steps = steps || 40;
  interp = interp || linInterp;
  const arr = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    arr[i] = interp(fromV, peakV, Math.pow(x, 2.3));
  }
  return arr;
}
function tailCurve(fromV, toV, steps, interp) {
  steps = steps || 24;
  interp = interp || linInterp;
  const arr = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    arr[i] = interp(fromV, toV, 1 - Math.pow(1 - x, 2));
  }
  return arr;
}
function scaleCurve(curve, factor) {
  const out = new Float32Array(curve.length);
  for (let i = 0; i < curve.length; i++) out[i] = curve[i] * factor;
  return out;
}

export function createTempoEngine(initial) {
  initial = initial || {};
  let audioCtx = null;
  let playing = false;
  let currentTempo = initial.tempo || 'pro-medium';
  let soundMode = initial.soundMode || 'natural';
  let tickEnabled = !!initial.tickEnabled;
  let freqLow = initial.freqLow != null ? initial.freqLow : 260;
  let freqHigh = initial.freqHigh != null ? initial.freqHigh : 950;
  let reverbWet = initial.reverbWet != null ? initial.reverbWet : 0; // 0-100
  let reverbDecay = initial.reverbDecay != null ? initial.reverbDecay : 45; // 0-100
  let dynamics = initial.dynamics != null ? initial.dynamics : 1.0; // ~0.6 - 1.7

  let cycleTimeoutId = null;
  let cycleStartPerf = 0;
  let cycleDurationMs = 0;

  // Bus: cada motor conecta a preFx; preFx reparte a dryGain (siempre full)
  // y a un send de reverb (4 lineas delay+feedback+lowpass en paralelo,
  // sin archivo de impulso externo - probado en el Sound Lab).
  let masterGain, preFx, dryGain, wetGain, reverbInput, reverbOutput;
  const reverbFeedbackGains = [];

  // Natural
  let noiseSource, filter, naturalGain;
  // GolfSaber (ring-modulation + waveshaper) - antes "Star Wars"/"Sintetico"
  let carrier, ringMod, ringGain, waveshaper, saberGain;
  // Relax (cuenco tibetano): 3 parciales inarmonicos, cada uno un par de
  // senos levemente destemplados (beating) en vez de armonicos limpios.
  const bowlRatios = [1.0, 2.42, 4.87];
  const bowlDetuneCents = [4, 3, 5];
  const bowlAmp = [0.50, 0.20, 0.09];
  const bowlOscA = [], bowlOscB = [];
  let relaxGain;

  let tickBuffer;

  // Contraste dinamico: escala los picos hacia arriba y el piso hacia abajo,
  // asi el rango quiet/loud se percibe mas (o menos) marcado sin tocar el
  // timing de las curvas.
  function dPeak(v) { return Math.min(0.92, v * dynamics); }
  function dFloor(v) { return Math.max(0.0006, v / dynamics); }

  function buildReverb(ctx) {
    const input = ctx.createGain();
    const output = ctx.createGain();
    [0.029, 0.037, 0.041, 0.053].forEach((t) => {
      const d = ctx.createDelay(1.0); d.delayTime.value = t;
      const fb = ctx.createGain(); fb.gain.value = 0.5;
      const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 3200;
      input.connect(d); d.connect(damp); damp.connect(fb); fb.connect(d); damp.connect(output);
      reverbFeedbackGains.push(fb);
    });
    return { input, output };
  }

  function applyReverbParams() {
    if (!audioCtx) return;
    wetGain.gain.setTargetAtTime((reverbWet / 100) * 0.9, audioCtx.currentTime, 0.05);
    const fb = 0.25 + (reverbDecay / 100) * 0.5;
    reverbFeedbackGains.forEach((g) => g.gain.setTargetAtTime(fb, audioCtx.currentTime, 0.05));
  }

  function setupAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    masterGain = audioCtx.createGain(); masterGain.gain.value = 1.0;
    masterGain.connect(audioCtx.destination);

    dryGain = audioCtx.createGain(); dryGain.gain.value = 1.0; dryGain.connect(masterGain);
    wetGain = audioCtx.createGain(); wetGain.gain.value = 0.0; wetGain.connect(masterGain);
    const rv = buildReverb(audioCtx);
    reverbInput = rv.input; reverbOutput = rv.output;
    reverbOutput.connect(wetGain);

    preFx = audioCtx.createGain(); preFx.gain.value = 1.0;
    preFx.connect(dryGain);
    preFx.connect(reverbInput);

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
    naturalGain.connect(preFx);
    noiseSource.start();

    // GolfSaber (ring-modulated oscillator) chain
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
    saberGain = audioCtx.createGain();
    saberGain.gain.value = 0.0;
    carrier.connect(ringGain);
    ringMod.connect(ringGain.gain);
    ringGain.connect(waveshaper);
    waveshaper.connect(saberGain);
    saberGain.connect(preFx);
    carrier.start();
    ringMod.start();

    // Relax (cuenco tibetano)
    relaxGain = audioCtx.createGain(); relaxGain.gain.value = 0.0; relaxGain.connect(preFx);
    for (let bi = 0; bi < bowlRatios.length; bi++) {
      const oa = audioCtx.createOscillator(); oa.type = 'sine';
      const ob = audioCtx.createOscillator(); ob.type = 'sine'; ob.detune.value = bowlDetuneCents[bi];
      const pg = audioCtx.createGain(); pg.gain.value = bowlAmp[bi];
      oa.connect(pg); ob.connect(pg); pg.connect(relaxGain);
      oa.start(); ob.start();
      bowlOscA.push(oa); bowlOscB.push(ob);
    }

    tickBuffer = buildNoiseBuffer(audioCtx, 0.05);
    applyReverbParams();
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
    g.connect(preFx);
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
    const tTail = tImpact;

    [naturalGain, saberGain, relaxGain].forEach((g) => { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0, t0); });
    filter.frequency.cancelScheduledValues(t0);
    carrier.frequency.cancelScheduledValues(t0);
    bowlOscA.concat(bowlOscB).forEach((o) => o.frequency.cancelScheduledValues(t0));

    if (soundMode === 'natural') {
      const backPeakFreq = freqLow + (freqHigh - freqLow) * 0.55;
      filter.frequency.setValueCurveAtTime(backswingCurve(freqLow, backPeakFreq), t0, t.back);
      naturalGain.gain.setValueCurveAtTime(backswingCurve(dFloor(0.02), dPeak(0.30), undefined, expInterp), t0, t.back);
      filter.frequency.setValueCurveAtTime(downswingCurve(freqLow, freqHigh), tPauseEnd, t.down);
      naturalGain.gain.setValueCurveAtTime(downswingCurve(dFloor(0.02), dPeak(0.65), undefined, expInterp), tPauseEnd, t.down);
      filter.frequency.setValueCurveAtTime(tailCurve(freqHigh, freqLow + (freqHigh - freqLow) * 0.12), tImpact, t.tail);
      naturalGain.gain.setValueCurveAtTime(tailCurve(dPeak(0.65), 0.001, undefined, expInterp), tImpact, t.tail);
    } else if (soundMode === 'saber') {
      const lowF = Math.max(40, freqLow * 0.4), highF = Math.max(lowF + 20, freqHigh * 0.4);
      const backPeakF = lowF + (highF - lowF) * 0.55;
      carrier.frequency.setValueCurveAtTime(backswingCurve(lowF, backPeakF), t0, t.back);
      saberGain.gain.setValueCurveAtTime(backswingCurve(dFloor(0.015), dPeak(0.22), undefined, expInterp), t0, t.back);
      carrier.frequency.setValueCurveAtTime(downswingCurve(lowF, highF), tPauseEnd, t.down);
      saberGain.gain.setValueCurveAtTime(downswingCurve(dFloor(0.015), dPeak(0.42), undefined, expInterp), tPauseEnd, t.down);
      carrier.frequency.setValueCurveAtTime(tailCurve(highF, lowF + (highF - lowF) * 0.12), tImpact, t.tail);
      saberGain.gain.setValueCurveAtTime(tailCurve(dPeak(0.42), 0.001, undefined, expInterp), tImpact, t.tail);
    } else if (soundMode === 'relax') {
      const xBack = backswingCurve(freqLow, freqLow + (freqHigh - freqLow) * 0.55);
      bowlRatios.forEach((ratio, i) => {
        const c = scaleCurve(xBack, ratio);
        bowlOscA[i].frequency.setValueCurveAtTime(c, t0, t.back);
        bowlOscB[i].frequency.setValueCurveAtTime(c, t0, t.back);
      });
      relaxGain.gain.setValueCurveAtTime(backswingCurve(dFloor(0.02), dPeak(0.26), undefined, expInterp), t0, t.back);

      const xDown = downswingCurve(freqLow, freqHigh);
      bowlRatios.forEach((ratio, i) => {
        const c = scaleCurve(xDown, ratio);
        bowlOscA[i].frequency.setValueCurveAtTime(c, tPauseEnd, t.down);
        bowlOscB[i].frequency.setValueCurveAtTime(c, tPauseEnd, t.down);
      });
      relaxGain.gain.setValueCurveAtTime(downswingCurve(dFloor(0.02), dPeak(0.55), undefined, expInterp), tPauseEnd, t.down);

      const xTail = tailCurve(freqHigh, freqLow + (freqHigh - freqLow) * 0.12);
      bowlRatios.forEach((ratio, i) => {
        const c = scaleCurve(xTail, ratio);
        bowlOscA[i].frequency.setValueCurveAtTime(c, tImpact, t.tail);
        bowlOscB[i].frequency.setValueCurveAtTime(c, tImpact, t.tail);
      });
      relaxGain.gain.setValueCurveAtTime(tailCurve(dPeak(0.55), 0.001, undefined, expInterp), tImpact, t.tail);
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
      [naturalGain, saberGain, relaxGain].forEach((g) => {
        if (!g) return;
        g.gain.cancelScheduledValues(now);
        g.gain.linearRampToValueAtTime(0, now + 0.15);
      });
    }
  }

  // Cierre completo del engine: para el audio y libera el AudioContext.
  // La pantalla del Tempo Trainer llama a esto en CUALQUIER camino de
  // salida (no solo el boton "Detener").
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
  // Frecuencias, reverb y dinamica son "vivos": toman efecto en el proximo
  // ciclo agendado (o inmediatamente via setTargetAtTime para reverb), sin
  // cortar el ciclo que ya esta sonando.
  function setFreqLow(v) { freqLow = v; }
  function setFreqHigh(v) { freqHigh = v; }
  function setTickEnabled(v) { tickEnabled = v; }
  function setReverbWet(v) { reverbWet = v; applyReverbParams(); }
  function setReverbDecay(v) { reverbDecay = v; applyReverbParams(); }
  function setDynamics(v) { dynamics = v; }

  function isPlaying() { return playing; }
  function getTempoPreset(tempo) { return TEMPOS[tempo || currentTempo]; }
  function getCycleTiming() { return { cycleStartPerf, cycleDurationMs }; }

  return {
    start, stop, dispose,
    setTempo, setSoundMode, setFreqLow, setFreqHigh, setTickEnabled,
    setReverbWet, setReverbDecay, setDynamics,
    isPlaying, getTempoPreset, getCycleTiming,
  };
}
