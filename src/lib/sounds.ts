let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
};

const ensureContextReady = (ctx: AudioContext) => {
    if (ctx.state === 'suspended') {
        void ctx.resume();
    }
};

const createVoice = (
    ctx: AudioContext,
    {
        type,
        frequency,
        startAt,
        duration,
        gainPeak,
        endFrequency,
    }: {
        type: OscillatorType;
        frequency: number;
        startAt: number;
        duration: number;
        gainPeak: number;
        endFrequency?: number;
    }
) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration);
    }

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(gainPeak, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
};

export const playSuccessSound = () => {
    try {
        const ctx = getAudioContext();
        ensureContextReady(ctx);

        const start = ctx.currentTime;
        createVoice(ctx, { type: 'triangle', frequency: 659.25, startAt: start, duration: 0.18, gainPeak: 0.2, endFrequency: 783.99 });
        createVoice(ctx, { type: 'sine', frequency: 783.99, startAt: start + 0.08, duration: 0.22, gainPeak: 0.26, endFrequency: 987.77 });
        createVoice(ctx, { type: 'triangle', frequency: 987.77, startAt: start + 0.16, duration: 0.3, gainPeak: 0.34 });
    } catch (e) {
        console.warn('Could not play sound:', e);
    }
};

export const playErrorSound = () => {
    try {
        const ctx = getAudioContext();
        ensureContextReady(ctx);

        const start = ctx.currentTime;
        createVoice(ctx, { type: 'sawtooth', frequency: 220, startAt: start, duration: 0.18, gainPeak: 0.16, endFrequency: 160 });
        createVoice(ctx, { type: 'triangle', frequency: 180, startAt: start + 0.08, duration: 0.24, gainPeak: 0.22, endFrequency: 110 });
        createVoice(ctx, { type: 'square', frequency: 130.81, startAt: start + 0.14, duration: 0.32, gainPeak: 0.2, endFrequency: 82.41 });
    } catch (e) {
        console.warn('Could not play sound:', e);
    }
};

export const playBooSound = () => {
    try {
        const ctx = getAudioContext();
        ensureContextReady(ctx);

        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc2.type = 'sawtooth';

        osc.frequency.setValueAtTime(110, ctx.currentTime);
        osc2.frequency.setValueAtTime(116.54, ctx.currentTime);

        osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 1.5);
        osc2.frequency.exponentialRampToValueAtTime(58.27, ctx.currentTime + 1.5);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.26, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc2.start();
        osc.stop(ctx.currentTime + 1.5);
        osc2.stop(ctx.currentTime + 1.5);
    } catch (e) {
        console.warn('Could not play sound:', e);
    }
};

export const playCountdownSound = () => {
    try {
        const ctx = getAudioContext();
        ensureContextReady(ctx);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.warn('Could not play sound:', e);
    }
};
