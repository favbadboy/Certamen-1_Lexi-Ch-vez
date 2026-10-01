/**
 * Motor de Audio Sintetizado para el Gemelo Digital
 * Utiliza Web Audio API para reproducir sonido procedural sin requerir archivos mp3 externos
 * Incluye retroalimentación háptica sonora (Taptic Engine) y reproducción musical
 */

export class SynthesizedAudioEngine {
    constructor(state) {
        this.state = state;
        this.audioCtx = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.loopTimer = null;
        this.step = 0;

        // Escuchar cambios de estado
        this.state.on('audioChange', (audio) => this.handleAudioChange(audio));
        this.state.on('volumeChange', (vol) => this.handleVolumeChange(vol));
        this.state.on('powerChange', (power) => this.handlePowerChange(power));
        this.state.on('screenTouch', () => this.playHapticClick());
        this.state.on('findMyPing', () => this.playSonarPing());
    }

    initContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
            this.masterGain = this.audioCtx.createGain();
            this.masterGain.gain.setValueAtTime(this.state.audio.volume * 0.35, this.audioCtx.currentTime);
            this.masterGain.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    // Sonido háptico estilo Taptic Engine de Apple al tocar la pantalla
    playHapticClick() {
        try {
            this.initContext();
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + 0.045);
        } catch (e) {
            // Silencioso si el navegador bloquea audio antes de interacción
        }
    }

    handlePowerChange(power) {
        if (power === 'OFF') {
            this.stopMusic();
        } else if (power === 'BOOTING') {
            this.playChime();
        }
    }

    // Tono sutil de inicio
    playChime() {
        try {
            this.initContext();
            const now = this.audioCtx.currentTime;
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);

                gain.gain.setValueAtTime(0.08, now + i * 0.08);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.6);

                osc.connect(gain);
                gain.connect(this.masterGain);

                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.65);
            });
        } catch (e) {}
    }

    handleAudioChange(audio) {
        if (audio.isPlaying) {
            this.startMusic();
        } else {
            this.stopMusic();
        }
    }

    handleVolumeChange(vol) {
        if (this.masterGain && this.audioCtx) {
            this.masterGain.gain.setTargetAtTime(vol * 0.35, this.audioCtx.currentTime, 0.05);
        }
    }

    startMusic() {
        this.initContext();
        if (this.isPlaying) return;
        this.isPlaying = true;

        // Secuencia armónica ambiental suave (lo-fi synth)
        const chords = [
            [261.63, 329.63, 392.00, 493.88], // Cmaj7
            [220.00, 261.63, 329.63, 392.00], // Am7
            [174.61, 220.00, 261.63, 329.63], // Fmaj7
            [196.00, 246.94, 293.66, 392.00]  // G7
        ];

        this.step = 0;
        this.loopTimer = setInterval(() => {
            if (!this.isPlaying || !this.audioCtx) return;

            const chord = chords[Math.floor(this.step / 4) % chords.length];
            const note = chord[this.step % chord.length];
            this.playSynthNote(note, 0.3);

            // Línea de bajo cada 4 pulsos
            if (this.step % 4 === 0) {
                this.playBassNote(chord[0] / 2, 0.8);
            }

            this.step++;
        }, 350);
    }

    playSynthNote(freq, dur) {
        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const filter = this.audioCtx.createBiquadFilter();
            const gain = this.audioCtx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(900, now);
            filter.frequency.exponentialRampToValueAtTime(300, now + dur);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + dur + 0.05);
        } catch (e) {}
    }

    playBassNote(freq, dur) {
        try {
            const now = this.audioCtx.currentTime;
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(now);
            osc.stop(now + dur + 0.05);
        } catch (e) {}
    }

    playSonarPing() {
        try {
            this.initContext();
            const now = this.audioCtx.currentTime;
            [1200, 1600, 2400].forEach((freq, i) => {
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.12);
                gain.gain.setValueAtTime(0.3, now + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start(now + i * 0.12);
                osc.stop(now + i * 0.12 + 0.3);
            });
        } catch (e) {}
    }

    stopMusic() {
        this.isPlaying = false;
        if (this.loopTimer) {
            clearInterval(this.loopTimer);
            this.loopTimer = null;
        }
    }
}
