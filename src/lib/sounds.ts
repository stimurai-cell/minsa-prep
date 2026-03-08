// utils/sounds.ts
// Usamos a Web Audio API para não precisarmos de carregar ficheiros MP3/WAV pesados.

let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

export const playSuccessSound = () => {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        // Success Sound: DUAL NOTE (Harmonious)
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc2.type = 'sine';

        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5 (Major Third)

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc2.start();
        osc.stop(ctx.currentTime + 0.8);
        osc2.stop(ctx.currentTime + 0.8);
    } catch (e) {
        console.warn("Could not play sound:", e);
    }
};

export const playErrorSound = () => {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        // Error Sound: LOW FREQUENCY + SLIDE (Frustrating but clear)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
        osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.4); // Slide down to A2

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
        console.warn("Could not play sound:", e);
    }
};

export const playBooSound = () => {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        // Boo Sound: LOW, DISSONANT, DESCENDING
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc2.type = 'sawtooth';

        osc.frequency.setValueAtTime(110, ctx.currentTime); // A2
        osc2.frequency.setValueAtTime(116.54, ctx.currentTime); // Bb2 (Dissonant)

        osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 1.5);
        osc2.frequency.exponentialRampToValueAtTime(58.27, ctx.currentTime + 1.5);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc2.start();
        osc.stop(ctx.currentTime + 1.5);
        osc2.stop(ctx.currentTime + 1.5);
    } catch (e) {
        console.warn("Could not play sound:", e);
    }
};

export const playCountdownSound = () => {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        // Short Beep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.warn("Could not play sound:", e);
    }
};
