import { UIBuilder } from './ui/UIBuilder.js';

// --- AUDIO WORKLET SOURCE ---
const BITCRUSHER_WORKLET = `
class BitcrusherProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'bitDepth', defaultValue: 8, minValue: 1, maxValue: 16 },
            { name: 'frequency', defaultValue: 0.5, minValue: 0.01, maxValue: 1.0 }
        ];
    }

    constructor() {
        super();
        this.phaser = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        const bitDepth = parameters.bitDepth;
        const frequency = parameters.frequency;

        for (let channel = 0; channel < input.length; ++channel) {
            const inputChannel = input[channel];
            const outputChannel = output[channel];

            if (bitDepth.length === 1 && frequency.length === 1) {
                // Optimized case: no automation within block
                const step = Math.pow(0.5, bitDepth[0]);
                const phaserStep = frequency[0];
                let lastSample = 0;

                for (let i = 0; i < inputChannel.length; ++i) {
                    this.phaser += phaserStep;
                    if (this.phaser >= 1.0) {
                        this.phaser -= 1.0;
                        lastSample = step * Math.floor(inputChannel[i] / step + 0.5);
                    }
                    outputChannel[i] = lastSample;
                }
            } else {
                // Automation case (less likely here but good practice)
                for (let i = 0; i < inputChannel.length; ++i) {
                     const bd = bitDepth.length > 1 ? bitDepth[i] : bitDepth[0];
                     const fq = frequency.length > 1 ? frequency[i] : frequency[0];
                     const step = Math.pow(0.5, bd);
                     
                     this.phaser += fq;
                     if (this.phaser >= 1.0) {
                        this.phaser -= 1.0;
                        // Use raw input sample here to hold
                        // Actually standard bitcrusher sample-and-hold logic requires storing the held sample.
                        // Simplified:
                     }
                     // Re-implementing simplified logic matching original
                     // Original looked at input[i] ONLY when phaser ticked.
                     // That implies Sample & Hold.
                     // The previous code was: lastSample = input[i]; ... output[i] = lastSample;
                     // So we need state.
                     // But AudioWorklet state persists across blocks.
                     // We need 'this.lastSample' separate per channel if we wanted perfection, 
                     // but mono processing is fine for now or shared.
                     // Let's stick to the previous logic structure.
                }
            }
        }
        
        // RE-IMPLEMENTING EXACT LOGIC FROM BEFORE BUT CORRECTED FOR WORKLET
        // Only 1 channel supported in previous code? createScriptProcessor(bufferSize, 1, 1).
        // Yes. So inputs[0][0] is the data.
        
        const inputData = input[0];
        const outputData = output[0];
        
        // Fallback if no input
        if (!inputData || !outputData) return true;

        const bd = bitDepth.length === 1 ? bitDepth[0] : bitDepth[0]; 
        const fq = frequency.length === 1 ? frequency[0] : frequency[0];
        
        const step = Math.pow(0.5, bd);
        const phaserStep = fq;

        // We need to store lastSample in 'this' to persist across blocks for Sample & Hold
        if (this.lastSample === undefined) this.lastSample = 0;

        for (let i = 0; i < inputData.length; i++) {
            this.phaser += phaserStep;
            if (this.phaser >= 1.0) {
                this.phaser -= 1.0;
                this.lastSample = step * Math.floor(inputData[i] / step + 0.5);
            }
            outputData[i] = this.lastSample;
        }

        return true;
    }
}
registerProcessor('bitcrusher-processor', BitcrusherProcessor);
`;

export class AudioProcessor {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.workletCodeUrl = null; // Store URL for reuse
        this.initWorklet(this.audioCtx);

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

    async initWorklet(ctx) {
        if (!ctx.audioWorklet) return;

        // Create Blob URL only once
        if (!this.workletCodeUrl) {
            const blob = new Blob([BITCRUSHER_WORKLET], { type: 'application/javascript' });
            this.workletCodeUrl = URL.createObjectURL(blob);
        }

        try {
            await ctx.audioWorklet.addModule(this.workletCodeUrl);
            if (ctx === this.audioCtx) {
                this.workletReady = true;
                console.log("AudioWorklet 'bitcrusher-processor' loaded main context.");
            }
        } catch (e) {
            console.error("Failed to load AudioWorklet:", e);
        }
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

                document.getElementById('audio-visualizer').innerHTML = ''; // Clear
                this.renderPlayer(file.name);
            }, (e) => alert("Error decoding audio: " + e.message));
        };
        reader.readAsArrayBuffer(file);
    }

    renderPlayer(filename) {
        const container = document.getElementById('audio-visualizer');
        container.hidden = false;
        container.classList.add('visualizer-container');

        // Standard, robust HTML structure
        container.innerHTML = `
            <div class="audio-player-container">
                <button class="player-btn btn-main-play" id="ap-play">▶</button>
                <div class="player-time" id="ap-time">00:00 / 00:00</div>
                
                <div class="player-slider-container">
                    <input type="range" class="player-range" id="ap-seek" min="0" max="100" value="0">
                </div>
                
                <div class="player-controls-right">
                    <span class="volume-icon">🔊</span>
                    <input type="range" class="player-range vol-slider" id="ap-vol" min="0" max="1" step="0.05" value="${this.params.gain}">
                </div>
            </div>
            <div style="margin-top:5px; color:var(--text-muted); font-size:0.75rem; text-align:center;">${filename}</div>
        `;

        // Bind Events
        const playBtn = document.getElementById('ap-play');
        const seek = document.getElementById('ap-seek');
        const vol = document.getElementById('ap-vol');

        if (playBtn) playBtn.onclick = () => this.toggleIconPlay();

        if (seek) {
            seek.oninput = (e) => {
                if (!this.buffer) return;
                const pct = e.target.value / 100;
                const time = pct * this.buffer.duration;
                this.seekTo(time);
            };
        }

        if (vol) {
            vol.oninput = (e) => {
                this.params.gain = parseFloat(e.target.value);
                if (this.gainNode) this.gainNode.gain.value = this.params.gain;
            };
        }

        this.updatePlayerUI();
    }

    toggleIconPlay() {
        if (this.isPlaying) this.pause();
        else this.play();
    }

    seekTo(time) {
        const wasPlaying = this.isPlaying;
        if (this.isPlaying) this.stop();

        this.pauseTime = time;
        // startTime is no longer used for tracking, pauseTime is master.

        if (wasPlaying) this.play();
        else this.updatePlayerUI();
    }

    updatePlayerUI() {
        if (!this.buffer) return;
        requestAnimationFrame(() => this.updatePlayerUI());

        const playBtn = document.getElementById('ap-play');
        const seek = document.getElementById('ap-seek');
        const timeDisplay = document.getElementById('ap-time');

        if (playBtn) playBtn.textContent = this.isPlaying ? "II" : "▶";

        // Delta Time Tracking for accurate Speed/Loop handling
        const now = performance.now() / 1000;
        if (!this.lastFrameTime) this.lastFrameTime = now;
        const dt = now - this.lastFrameTime;
        this.lastFrameTime = now;

        if (this.isPlaying) {
            // Accumulate time based on speed
            this.pauseTime += dt * this.params.speed;

            // Loop Logic
            if (this.pauseTime >= this.buffer.duration) {
                if (this.params.loop !== false) { // Default loop true unless explicitly false? 
                    // Actually source.loop handles audio. We just match UI.
                    this.pauseTime = this.pauseTime % this.buffer.duration;
                } else {
                    this.pauseTime = this.buffer.duration;
                    this.stop();
                }
            }
        }

        let current = this.pauseTime;

        // UI Updates
        if (seek && document.activeElement !== seek) {
            const pct = (current / this.buffer.duration) * 100;
            seek.value = isNaN(pct) ? 0 : pct;
        }

        if (timeDisplay) {
            timeDisplay.textContent = `${this.fmtTime(current)} / ${this.fmtTime(this.buffer.duration)}`;
        }
    }

    fmtTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    restart() {
        if (this.isPlaying) {
            this.stop();
            this.play();
        }
    }

    generateUI() {
        this.ui.clear();

        // Header Export Button
        const header = document.querySelector('.header-controls');
        // Remove old audio buttons if any
        const oldExp = document.getElementById('audio-export-btn');
        if (oldExp) oldExp.remove();

        const exportBtn = document.createElement('button');
        exportBtn.id = 'audio-export-btn';
        exportBtn.className = 'btn btn-primary';
        exportBtn.textContent = 'EXPORT .WAV';
        exportBtn.style.marginLeft = '10px';
        exportBtn.onclick = () => this.exportOffline(exportBtn);

        // Find existing Export Image and hide/replace?
        // Main.js hides 'export-btn'. We insert this one.
        header.appendChild(exportBtn);


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
            if (this.workletNode) {
                const p = this.workletNode.parameters.get('bitDepth');
                if (p) p.value = v;
            }
        });

        group.addSlider("SAMPLE RATE", 0.01, 1.0, this.params.normFreq, 0.01, (v) => {
            this.params.normFreq = v;
            if (this.workletNode) {
                const p = this.workletNode.parameters.get('frequency');
                if (p) p.value = v;
            }
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
        this.source.loop = true;
        // Sync playback rate immediately
        if (this.source.playbackRate) this.source.playbackRate.value = this.params.speed;

        this.setupGraph(this.audioCtx, this.source, this.audioCtx.destination);

        // Start from current pauseTime
        // We must handle the offset for the Source Node. 
        // Source node 'offset' parameter does NOT account for speed, it is buffer time.
        // So this is correct:
        this.source.start(0, this.pauseTime % this.buffer.duration);

        this.lastFrameTime = performance.now() / 1000;
        this.isPlaying = true;
        this.isPaused = false;

        this.updateBtnState('PLAY');
    }

    pause() {
        if (!this.isPlaying) return;

        try { if (this.source) this.source.stop(); } catch (e) { }
        try { if (this.noiseNode) this.noiseNode.stop(); } catch (e) { }

        // pauseTime is already updated by updatePlayerUI frame-by-frame
        this.isPlaying = false;
        this.isPaused = true;
        this.updateBtnState('PAUSE');
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch (e) { }
            this.source.disconnect();
        }
        if (this.noiseNode) {
            try { this.noiseNode.stop(); } catch (e) { }
            this.noiseNode.disconnect();
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
        const isLive = (ctx === this.audioCtx);

        // 1. Mixer Nodes
        const preMix = ctx.createGain(); // Summing point

        // Noise Branch
        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = this.noiseBuffer;
        noiseNode.loop = true;
        const noiseGainNode = ctx.createGain();
        noiseGainNode.gain.value = this.params.noise;
        noiseNode.connect(noiseGainNode);
        noiseGainNode.connect(preMix);

        try { noiseNode.start(0); } catch (e) { }

        // Store references only if LIVE context
        if (isLive) {
            this.noiseNode = noiseNode;
            this.noiseGainNode = noiseGainNode;
        }

        // Main Source Connection
        sourceNode.connect(preMix);
        // Apply Speed
        if (sourceNode.playbackRate) sourceNode.playbackRate.value = this.params.speed;

        // 2. Distortion
        const distortionNode = ctx.createWaveShaper();
        distortionNode.curve = this.makeDistortionCurve(this.params.saturation * 100);
        distortionNode.oversample = '4x';

        if (isLive) this.distortionNode = distortionNode;

        // 3. Filter
        const filterNode = ctx.createBiquadFilter();
        filterNode.type = 'lowpass';
        filterNode.frequency.value = this.params.cutoff;
        filterNode.Q.value = this.params.resonance;

        if (isLive) this.filterNode = filterNode;

        // 4. Bitcrusher (AudioWorklet)
        let scriptNode;
        let useWorklet = false;

        // Check availability
        if (isLive && this.workletReady) useWorklet = true;
        else if (ctx instanceof OfflineAudioContext) useWorklet = true; // Assumed 

        if (useWorklet) {
            try {
                const workletNode = new AudioWorkletNode(ctx, 'bitcrusher-processor');
                const bitParam = workletNode.parameters.get('bitDepth');
                const freqParam = workletNode.parameters.get('frequency');
                if (bitParam) bitParam.value = this.params.bits;
                if (freqParam) freqParam.value = this.params.normFreq;

                scriptNode = workletNode;
                if (isLive) {
                    this.workletNode = workletNode;
                    this.scriptNode = workletNode;
                }
            } catch (e) {
                console.warn("Worklet failed", e);
                scriptNode = ctx.createGain();
                if (isLive) this.scriptNode = scriptNode;
            }
        } else {
            scriptNode = ctx.createGain();
            if (isLive) this.scriptNode = scriptNode;
        }

        // 5. Master Gain
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.params.gain;

        if (isLive) this.gainNode = gainNode;

        // CONNECTIONS
        preMix.connect(distortionNode);
        distortionNode.connect(filterNode);
        filterNode.connect(scriptNode);
        scriptNode.connect(gainNode);
        gainNode.connect(destination);
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
            1, // Mono
            this.buffer.length,
            this.buffer.sampleRate
        );

        // Load Worklet into Offline Context
        await this.initWorklet(offlineCtx);

        const source = offlineCtx.createBufferSource();
        source.buffer = this.buffer;

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
