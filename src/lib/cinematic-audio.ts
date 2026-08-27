// Web Audio API based cinematic sound synthesizer for the intro animation
// Generates a deep, rich, multi-layered cinematic chord ("Ta-dum" sub-bass + shimmer) without external audio assets.

export function playCinematicSound(volume = 0.8) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const startTime = ctx.currentTime + 0.05;

    // 1. Deep Sub-Bass Impact (The "Boom")
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(80, startTime);
    subOsc.frequency.exponentialRampToValueAtTime(32, startTime + 1.2);

    subGain.gain.setValueAtTime(0, startTime);
    subGain.gain.linearRampToValueAtTime(1.0, startTime + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.5);

    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(startTime);
    subOsc.stop(startTime + 2.6);

    // 2. Heavy Brass/Saw Punch (Mid-body)
    const midOsc1 = ctx.createOscillator();
    const midOsc2 = ctx.createOscillator();
    const midFilter = ctx.createBiquadFilter();
    const midGain = ctx.createGain();

    midOsc1.type = "sawtooth";
    midOsc2.type = "sawtooth";
    midOsc1.frequency.setValueAtTime(110, startTime); // A2
    midOsc2.frequency.setValueAtTime(110.5, startTime); // Slight detune for thick width
    midOsc1.frequency.exponentialRampToValueAtTime(55, startTime + 1.8);
    midOsc2.frequency.exponentialRampToValueAtTime(55.2, startTime + 1.8);

    midFilter.type = "lowpass";
    midFilter.frequency.setValueAtTime(150, startTime);
    midFilter.frequency.exponentialRampToValueAtTime(1800, startTime + 0.15);
    midFilter.frequency.exponentialRampToValueAtTime(120, startTime + 2.0);
    midFilter.Q.setValueAtTime(4, startTime);

    midGain.gain.setValueAtTime(0, startTime);
    midGain.gain.linearRampToValueAtTime(0.7, startTime + 0.08);
    midGain.gain.exponentialRampToValueAtTime(0.001, startTime + 2.2);

    midOsc1.connect(midFilter);
    midOsc2.connect(midFilter);
    midFilter.connect(midGain);
    midGain.connect(masterGain);

    midOsc1.start(startTime);
    midOsc2.start(startTime);
    midOsc1.stop(startTime + 2.3);
    midOsc2.stop(startTime + 2.3);

    // 3. Second Chord Hit (The "DUM" in Ta-Dum at +0.45s)
    const hit2Time = startTime + 0.42;
    const hit2Sub = ctx.createOscillator();
    const hit2Saw = ctx.createOscillator();
    const hit2Gain = ctx.createGain();
    const hit2Filter = ctx.createBiquadFilter();

    hit2Sub.type = "triangle";
    hit2Sub.frequency.setValueAtTime(65, hit2Time);
    hit2Sub.frequency.exponentialRampToValueAtTime(28, hit2Time + 2.2);

    hit2Saw.type = "sawtooth";
    hit2Saw.frequency.setValueAtTime(164.81, hit2Time); // E3
    hit2Saw.frequency.exponentialRampToValueAtTime(82.4, hit2Time + 2.0);

    hit2Filter.type = "lowpass";
    hit2Filter.frequency.setValueAtTime(80, hit2Time);
    hit2Filter.frequency.exponentialRampToValueAtTime(2800, hit2Time + 0.1);
    hit2Filter.frequency.exponentialRampToValueAtTime(180, hit2Time + 2.5);

    hit2Gain.gain.setValueAtTime(0, hit2Time);
    hit2Gain.gain.linearRampToValueAtTime(1.0, hit2Time + 0.05);
    hit2Gain.gain.exponentialRampToValueAtTime(0.0001, hit2Time + 3.0);

    hit2Sub.connect(hit2Gain);
    hit2Saw.connect(hit2Filter);
    hit2Filter.connect(hit2Gain);
    hit2Gain.connect(masterGain);

    hit2Sub.start(hit2Time);
    hit2Saw.start(hit2Time);
    hit2Sub.stop(hit2Time + 3.1);
    hit2Saw.stop(hit2Time + 3.1);

    // 4. Ethereal High Shimmer / Laser Sparkle
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    const shimmerFilter = ctx.createBiquadFilter();

    shimmerOsc.type = "sine";
    shimmerOsc.frequency.setValueAtTime(880, hit2Time);
    shimmerOsc.frequency.exponentialRampToValueAtTime(1760, hit2Time + 0.6);
    shimmerOsc.frequency.exponentialRampToValueAtTime(440, hit2Time + 2.5);

    shimmerFilter.type = "bandpass";
    shimmerFilter.frequency.setValueAtTime(1200, hit2Time);
    shimmerFilter.Q.setValueAtTime(8, hit2Time);

    shimmerGain.gain.setValueAtTime(0, hit2Time);
    shimmerGain.gain.linearRampToValueAtTime(0.25, hit2Time + 0.2);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, hit2Time + 2.8);

    shimmerOsc.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(masterGain);

    shimmerOsc.start(hit2Time);
    shimmerOsc.stop(hit2Time + 2.9);

    return () => {
      try {
        ctx.close();
      } catch {}
    };
  } catch (err) {
    // AudioContext blocked or not supported
    console.debug("Cinematic audio unavailable:", err);
  }
}
