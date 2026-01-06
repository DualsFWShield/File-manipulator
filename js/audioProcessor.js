import { UIBuilder } from './ui/UIBuilder.js';

export class AudioProcessor {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.source = null;
        this.scriptNode = null;
        this.gainNode = null;
        this.distortionNode = null;
        this.filterNode = null;
        this.noiseNode = null;
        this.noiseGainNode = null;

        this.buffer = null;
        this.ui = new UIBuilder('modules-rack');

        this.params = {
            speed: 1.0,
            noise: 0.0,
            saturation: 0.0,
            cutoff: 20000,
            resonance: 0,
            bits: 8,
            normFreq: 0.5,
            gain: 0.8
        };

        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;

        // Generate Noise Buffer Once
        this.noiseBuffer = this.createNoiseBuffer();
    }

    createNoiseBuffer() {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const bufferSize = ctx.sampleRate * 2; // 2 seconds loop
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    loadAudio(file) {
        // Reset Context if needed
        if (this.audioCtx.state === 'closed') {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const arrayBuffer = e.target.result;
            this.audioCtx.decodeAudioData(arrayBuffer, (decodedBuffer) => {
                this.buffer = decodedBuffer;
                this.generateUI();

                // Don't auto-play, let user decide
                // this.play(); 

                document.getElementById('audio-visualizer').innerHTML = `
                    <div style="text-align:center; padding-top: 50px; color: var(--accent-primary);">
                        <h3>AUDIO LOADED</h3>
                        <p>${file.name}</p>
                        <p style="font-size: 0.8em; color: var(--text-dim);">${(this.buffer.duration).toFixed(2)}s</p>
                        <div class="visualizer-bars">||||| ||| |||||</div>
                    </div>
                `;
            }, (e) => alert("Error decoding audio: " + e.message));
        };
        reader.readAsArrayBuffer(file);
    }

    generateUI() {
        this.ui.clear();

        // --- MASTER CONTROLS ---
        const master = this.ui.createModuleGroup("AUDIO DECK");

        // Player Controls Container
        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '10px';
        controls.style.marginBottom = '10px';

        const mkBtn = (text, onClick, id) => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.className = 'btn btn-secondary';
            btn.style.flex = '1';
            if (id) btn.id = id;
            btn.onclick = onClick;
            return btn;
        };

        const playBtn = mkBtn('PLAY', () => this.play(), 'audio-play');
        const pauseBtn = mkBtn('PAUSE', () => this.pause(), 'audio-pause');
        const stopBtn = mkBtn('STOP', () => this.stop(), 'audio-stop');

        controls.appendChild(playBtn);
        controls.appendChild(pauseBtn);
        controls.appendChild(stopBtn);
        master.content.appendChild(controls);

        // Export Button
        const exportBtn = document.createElement('button');
        exportBtn.className = 'btn btn-primary';
        exportBtn.textContent = 'EXPORT AUDIO (.WAV)';
        exportBtn.style.width = '100%';
        exportBtn.style.marginTop = '10px';
        exportBtn.style.position = 'relative'; // For progress fill if needed
        exportBtn.onclick = () => this.exportOffline(exportBtn);
        master.content.appendChild(exportBtn);

        // --- NOISE & DISTORTION ---
        const distGroup = this.ui.createModuleGroup("NOISE & DISTORTION");

        distGroup.addSlider("NOISE LVL", 0, 0.5, this.params.noise, 0.01, (v) => {
            this.params.noise = v;
            if (this.noiseGainNode) this.noiseGainNode.gain.value = v;
        });

        distGroup.addSlider("SATURATION", 0, 1.0, this.params.saturation, 0.01, (v) => {
            this.params.saturation = v;
            if (this.distortionNode) this.distortionNode.curve = this.makeDistortionCurve(v * 100);
        });

        distGroup.addSlider("PLAYBACK SPEED", 0.1, 2.0, this.params.speed, 0.1, (v) => {
            this.params.speed = v;
            if (this.source && this.source.playbackRate) this.source.playbackRate.value = v;
        });

        // --- FILTER ---
        const filterGroup = this.ui.createModuleGroup("FILTER (LOWPASS)");

        filterGroup.addSlider("CUTOFF (Hz)", 20, 20000, this.params.cutoff, 100, (v) => {
            this.params.cutoff = v;
            if (this.filterNode) this.filterNode.frequency.value = v;
        });

        filterGroup.addSlider("RESONANCE", 0, 20, this.params.resonance, 0.5, (v) => {
            this.params.resonance = v;
            if (this.filterNode) this.filterNode.Q.value = v;
        });

        // --- BITCRUSHER ---
        const group = this.ui.createModuleGroup("BITCRUSHER CORE");

        group.addSlider("BIT DEPTH", 1, 16, this.params.bits, 1, (v) => {
            this.params.bits = v;
        });

        group.addSlider("SAMPLE RATE", 0.01, 1.0, this.params.normFreq, 0.01, (v) => {
            this.params.normFreq = v;
        });

        group.addSlider("OUTPUT VOL", 0, 1.0, this.params.gain, 0.05, (v) => {
            this.params.gain = v;
            if (this.gainNode) this.gainNode.gain.value = v;
        });
    }

    play() {
        if (this.isPlaying) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        this.source = this.audioCtx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = true; // Loop by default? User said "Stop the loop", but usually music loops unless it's a long track. 
        // Let's ask user? Or assume Loop is fine if we have Stop.
        // User said: "ça tourne en boucle. C'est inarrêtable."
        // So they want control. Loop is fine if controllable.

        this.setupGraph(this.audioCtx, this.source, this.audioCtx.destination);

        this.source.start(0, this.pauseTime);
        this.startTime = this.audioCtx.currentTime - this.pauseTime;
        this.isPlaying = true;
        this.isPaused = false;

        this.updateBtnState('PLAY');
    }

    pause() {
        if (!this.isPlaying) return;
        this.source.stop();
        this.pauseTime = this.audioCtx.currentTime - this.startTime;
        this.isPlaying = false;
        this.isPaused = true;
        this.updateBtnState('PAUSE');
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch (e) { }
            this.source.disconnect();
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.pauseTime = 0;
        this.updateBtnState('STOP');
    }

    updateBtnState(state) {
        const play = document.getElementById('audio-play');
        const pause = document.getElementById('audio-pause');
        const stop = document.getElementById('audio-stop');
        if (!play) return;

        play.classList.remove('active');
        pause.classList.remove('active');
        stop.classList.remove('active');

        if (state === 'PLAY') play.classList.add('active');
        if (state === 'PAUSE') pause.classList.add('active');
        if (state === 'STOP') stop.classList.add('active');
    }

    setupGraph(ctx, sourceNode, destination) {
        // NODES CREATION

        // 1. Mixer Nodes
        const preMix = ctx.createGain(); // Summing point

        // Noise Branch
        this.noiseNode = ctx.createBufferSource();
        this.noiseNode.buffer = this.noiseBuffer;
        this.noiseNode.loop = true;
        this.noiseGainNode = ctx.createGain();
        this.noiseGainNode.gain.value = this.params.noise;
        this.noiseNode.connect(this.noiseGainNode);
        this.noiseGainNode.connect(preMix);
        // Start Noise immediately (controlled by gain, but sync start is better in play())
        try { this.noiseNode.start(0); } catch (e) { }

        // Main Source Connection
        sourceNode.connect(preMix);
        // Apply Speed
        if (sourceNode.playbackRate) sourceNode.playbackRate.value = this.params.speed;

        // 2. Distortion
        this.distortionNode = ctx.createWaveShaper();
        this.distortionNode.curve = this.makeDistortionCurve(this.params.saturation * 100); // 0-100 amount
        this.distortionNode.oversample = '4x';

        // 3. Filter
        this.filterNode = ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = this.params.cutoff;
        this.filterNode.Q.value = this.params.resonance;

        // 4. Bitcrusher (ScriptProcessor)
        const bufferSize = 4096;
        this.scriptNode = ctx.createScriptProcessor(bufferSize, 1, 1);
        this.scriptNode.onaudioprocess = (e) => {
            const input = e.inputBuffer.getChannelData(0);
            const output = e.outputBuffer.getChannelData(0);

            const step = Math.pow(0.5, this.params.bits);
            const phaserStep = this.params.normFreq;
            let phaser = 0;
            let lastSample = 0;

            for (let i = 0; i < input.length; i++) {
                phaser += phaserStep;
                if (phaser >= 1.0) {
                    phaser -= 1.0;
                    lastSample = input[i];
                    lastSample = step * Math.floor(lastSample / step + 0.5);
                }
                output[i] = lastSample;
            }
        };

        // 5. Master Gain
        this.gainNode = ctx.createGain();
        this.gainNode.gain.value = this.params.gain;

        // CONNECTIONS: PreMix -> Distortion -> Filter -> Bitcrush -> Gain -> Dest
        preMix.connect(this.distortionNode);
        this.distortionNode.connect(this.filterNode);
        this.filterNode.connect(this.scriptNode);
        this.scriptNode.connect(this.gainNode);
        this.gainNode.connect(destination);
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;

        if (amount === 0) {
            for (let i = 0; i < n_samples; ++i) curve[i] = (i * 2) / n_samples - 1;
            return curve; // Linear
        }

        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    async exportOffline(btn) {
        if (!this.buffer) return;

        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = "PROCESSING... 0%";

        const offlineCtx = new OfflineAudioContext(
            1, // Mono for now due to ScriptProcessor logic simplicity (inputBuffer ch 0)
            this.buffer.length,
            this.buffer.sampleRate
        );

        const source = offlineCtx.createBufferSource();
        source.buffer = this.buffer;

        // ScriptProcessor is tricky in OfflineContext, but supported in many browsers.
        // However, it runs on main thread. Large files might freeze UI.
        // 'suspend' logic allows progress update? Not easily with ScriptProcessor.
        // We will simulate progress bar for short files, or standard wait.

        // NOTE: ScriptProcessor in OfflineAudioContext fires the entire buffer in chunks.

        this.setupGraph(offlineCtx, source, offlineCtx.destination);
        source.start(0);

        // Progress Simulation (since startRendering is promise based and doesn't always give progress)
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            if (progress > 95) progress = 95;
            this.updateProgress(btn, progress, "PROCESSING...");
        }, 100);

        try {
            const renderedBuffer = await offlineCtx.startRendering();
            clearInterval(interval);
            this.updateProgress(btn, 100, "DONE");

            const wav = this.bufferToWave(renderedBuffer, renderedBuffer.length);
            const blob = new Blob([wav], { type: "audio/wav" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `VOID_AUDIO_CRUSHED_${Date.now()}.wav`;
            a.click();

            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = originalText;
                btn.style.background = ''; // Reset
            }, 1000);

        } catch (err) {
            console.error(err);
            clearInterval(interval);
            btn.textContent = "ERROR";
            alert("Export Failed.");
            btn.disabled = false;
        }
    }

    updateProgress(btn, percent, text) {
        btn.textContent = `${text} ${percent}%`;
        // CSS Gradient for fill effect
        // Using accent-primary and button bg
        btn.style.background = `linear-gradient(90deg, var(--accent-primary) ${percent}%, var(--bg-surface) ${percent}%)`;
    }

    // Helper: AudioBuffer to WAV
    bufferToWave(abuffer, len) {
        let numOfChan = abuffer.numberOfChannels;
        let length = len * numOfChan * 2 + 44;
        let buffer = new ArrayBuffer(length);
        let view = new DataView(buffer);
        let channels = [], i, sample, offset = 0, pos = 0;

        // write WAVE header
        setUint32(0x46464952);                         // "RIFF"
        setUint32(length - 8);                         // file length - 8
        setUint32(0x45564157);                         // "WAVE"

        setUint32(0x20746d66);                         // "fmt " chunk
        setUint32(16);                                 // length = 16
        setUint16(1);                                  // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(abuffer.sampleRate);
        setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2);                      // block-align
        setUint16(16);                                 // 16-bit (hardcoded)

        setUint32(0x61746164);                         // "data" - chunk
        setUint32(length - pos - 4);                   // chunk length

        // write interleaved data
        for (i = 0; i < abuffer.numberOfChannels; i++)
            channels.push(abuffer.getChannelData(i));

        while (pos < length) {
            for (i = 0; i < numOfChan; i++) {             // interleave channels
                sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                view.setInt16(pos, sample, true);          // write 16-bit sample
                pos += 2;
            }
            offset++; // next source sample
        }

        return buffer;

        function setUint16(data) {
            view.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            view.setUint32(pos, data, true);
            pos += 4;
        }
    }
}
