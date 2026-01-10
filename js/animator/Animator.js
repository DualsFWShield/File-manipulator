import { GIFEncoder, quantize, applyPalette } from 'https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js';

/**
 * Animator - Handles automation of parameters.
 */
export class Animator {
    constructor(imageProcessor) {
        this.processor = imageProcessor;
        this.automations = []; // { id, target, type, speed, amp, base }
        this.startTime = Date.now();
        this.isPlaying = false;

        // Global Animation Settings
        this.globalSpeed = 1.0;
        this.exportDuration = 3; // Seconds
        this.exportFPS = 30;

        this.setupUI();
    }

    /**
     * Define which parameters are safe/useful to animate
     */
    getAnimatableParameters() {
        return [
            // PRE-PROCESS
            { label: "PRE: Blur Radius", value: "preprocess_v1.blurRadius" },
            { label: "PRE: Sharpen Amount", value: "preprocess_v1.sharpenAmount" },
            { label: "PRE: Noise Amount", value: "preprocess_v1.noiseAmount" },
            { label: "PRE: Saturation", value: "preprocess_v1.saturation" },
            { label: "PRE: Hue Shift", value: "preprocess_v1.hue" },
            { label: "PRE: Brightness", value: "preprocess_v1.brightness" },

            // HALFTONE
            { label: "CMYK: Dot Size", value: "halftone_v1.scale" },
            { label: "CMYK: Opacity", value: "halftone_v1.opacity" },
            { label: "CMYK: Angle Cyan", value: "halftone_v1.angleC" },
            { label: "CMYK: Angle Magenta", value: "halftone_v1.angleM" },
            { label: "CMYK: Angle Yellow", value: "halftone_v1.angleY" },
            { label: "CMYK: Angle Black", value: "halftone_v1.angleK" },

            // DITHER
            { label: "DITHER: Contrast", value: "dither_v1.contrast" },
            { label: "DITHER: Resolution/DPI", value: "dither_v1.resolution" },
            { label: "DITHER: Spread", value: "dither_v1.spread" },
            { label: "DITHER: Bleeding", value: "dither_v1.bleeding" },

            // GLITCH
            { label: "GLITCH: RGB Shift", value: "glitch_v1.rgbShift" },
            { label: "GLITCH: Scanline Opacity", value: "glitch_v1.scanlines" },
            { label: "GLITCH: Scanline Height", value: "glitch_v1.scanlineSize" },
            { label: "GLITCH: Jitter", value: "glitch_v1.jitter" }
        ];
    }

    setupUI() {
        const ui = this.processor.ui;
        // Use params.enabled logic ? No, direct toggle.
        const group = ui.createModuleGroup("ANIMATION STATION", (enabled) => {
            this.isPlaying = enabled;
            if (enabled) {
                this.loop();
            }
        }, this.isPlaying, "Automate parameters with LFOs and export clips.");

        this.uiGroup = group; // Store definition to add LFOs later

        // --- GLOBAL CONTROLS ---
        group.addSlider("GLOBAL SPEED (Multiplier)", 0.1, 5.0, this.globalSpeed, 0.1, (v) => {
            this.globalSpeed = v;
        }, "Multiplies the speed of all active LFOs.");

        // --- ADD LFO BUTTON ---
        group.addButton("+ ADD NEW AUTOMATION (LFO)", () => {
            this.addLFO(group);
        });

        // --- EXPORT SECTION ---
        group.addDescription("EXPORT ANIMATION");

        group.addSelect("FORMAT", [
            { label: "WEBM (Video)", value: "webm" },
            { label: "GIF (Animated)", value: "gif" }
        ], this.processor.exportFormat, (v) => {
            this.processor.exportFormat = v;
        }, "Choose export format.");

        group.addSlider("DURATION (Seconds)", 1, 10, this.exportDuration, 1, (v) => {
            this.exportDuration = v;
        }, "Length of the exported animation.");

        group.addButton("RENDER & EXPORT", () => {
            this.startExport();
        });
    }

    addLFO(group, config = null) {
        const animId = Date.now();

        // Default Config
        const auto = config || {
            id: animId,
            target: "glitch_v1.rgbShift", // Default
            type: "sine",
            speed: 1.0,
            amp: 50, // 50%
            offset: 0, // Not used yet, maybe later if needed
            baseValue: null // Captured on first run
        };

        if (!config) this.automations.push(auto);

        // CREATE SUB-CONTAINER using a style hook or just a div
        const container = document.createElement('div');
        container.className = 'control-item';
        container.style.background = 'rgba(0,0,0,0.2)';
        container.style.border = '1px solid var(--border-light)';
        container.style.borderRadius = '4px';
        container.style.padding = '10px';
        container.style.marginBottom = '10px';
        container.style.marginTop = '10px';

        const ui = this.processor.ui;

        // Header with Delete
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.marginBottom = '5px';

        const title = document.createElement('span');
        title.textContent = "LFO MODULE";
        title.style.color = "var(--accent-secondary)";
        title.style.fontSize = "0.7rem";
        title.style.fontWeight = "bold";

        const delBtn = document.createElement('button');
        delBtn.textContent = "×";
        delBtn.style.background = "transparent";
        delBtn.style.border = "none";
        delBtn.style.color = "var(--accent-alert)";
        delBtn.style.cursor = "pointer";
        delBtn.onclick = () => {
            container.remove();
            this.automations = this.automations.filter(a => a.id !== auto.id);
        };

        header.appendChild(title);
        header.appendChild(delBtn);
        container.appendChild(header);

        // 1. TARGET SELECT
        const targets = this.getAnimatableParameters();
        ui.addSelect(container, "TARGET PARAMETER", targets, auto.target, (v) => {
            auto.target = v;
            auto.baseValue = null; // Reset base
        }, "Parameter to animate.");

        // 2. FORM SELECT
        const shapes = [
            { label: "SINE (Smooth)", value: "sine" },
            { label: "TRIANGLE (Linear)", value: "triangle" },
            { label: "SQUARE (Pulse)", value: "square" },
            { label: "NOISE (Random)", value: "noise" }
        ];
        ui.addSelect(container, "WAVEFORM", shapes, auto.type, (v) => auto.type = v, "Shape of the modulation.");

        // 3. SPEED SLIDER
        ui.addSlider(container, "SPEED (Hz)", 0.1, 5.0, auto.speed, 0.1, (v) => auto.speed = v, "Oscillation speed.");

        // 4. DEPTH SLIDER
        ui.addSlider(container, "DEPTH %", 0, 100, auto.amp, 1, (v) => auto.amp = v, "Intensity of the effect variation.");

        // Append to main group content
        group.content.appendChild(container);
    }

    async startExport() {
        if (this.isExporting) return;
        this.isExporting = true;

        const durationMs = this.exportDuration * 1000;
        const format = this.processor.exportFormat;
        const fps = format === 'gif' ? 15 : 30; // GIF lower FPS

        const btn = document.activeElement;
        const originalText = btn ? btn.textContent : "EXPORT";
        if (btn && btn.tagName === 'BUTTON') btn.textContent = `RECORDING (${this.exportDuration}s)...`;

        if (format === 'webm') {
            // WEB M RECORDING
            const recorder = this.processor.recorder;
            recorder.start();

            setTimeout(async () => {
                const blob = await recorder.stop();
                this.download(blob, `animation_${Date.now()}.webm`);
                this.isExporting = false;
                if (btn && btn.tagName === 'BUTTON') btn.textContent = originalText;
                alert("WebM Export Finished!");
            }, durationMs);

        } else if (format === 'gif') {
            // GIF RECORDING
            const gif = new GIFEncoder();
            const width = this.processor.canvas.width;
            const height = this.processor.canvas.height;

            // Allow GPU read
            const ctx = this.processor.canvas.getContext('2d', { willReadFrequently: true });

            const frameInterval = 1000 / fps;
            const totalFrames = this.exportDuration * fps;
            let frameCount = 0;

            const captureInterval = setInterval(() => {
                if (frameCount >= totalFrames) {
                    clearInterval(captureInterval);
                    gif.finish();
                    const blob = new Blob([gif.bytes()], { type: 'image/gif' });
                    this.download(blob, `animation_${Date.now()}.gif`);
                    this.isExporting = false;
                    if (btn && btn.tagName === 'BUTTON') btn.textContent = originalText;
                    alert("GIF Export Finished!");
                    return;
                }

                // Capture Frame
                const data = ctx.getImageData(0, 0, width, height).data;
                const palette = quantize(data, 256);
                const index = applyPalette(data, palette);
                gif.writeFrame(index, width, height, { palette, delay: frameInterval });

                frameCount++;
            }, frameInterval);
        }
    }

    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    loop() {
        if (!this.isPlaying) return;

        const now = (Date.now() - this.startTime) / 1000;

        this.automations.forEach(auto => {
            if (!auto.target) return;

            const [effId, param] = auto.target.split('.');
            if (!this.processor.state[effId]) return;

            if (auto.baseValue === null) {
                auto.baseValue = this.processor.state[effId][param];
            }

            const base = auto.baseValue;

            let wave = 0;
            const s = auto.speed * this.globalSpeed;

            if (auto.type === 'sine') wave = Math.sin(now * s);
            else if (auto.type === 'triangle') wave = Math.abs((now * s) % 2 - 1) * 2 - 1; // -1 to 1
            else if (auto.type === 'square') wave = Math.sin(now * s) > 0 ? 1 : -1;
            else if (auto.type === 'noise') wave = (Math.random() * 2) - 1;

            const strength = auto.amp / 100;

            let range = 1.0;
            if (param.includes('shift') || param.includes('Shift')) range = 50;
            if (param.includes('angle')) range = 90;
            if (param.includes('Size') || param.includes('Radius')) range = 20;
            if (param.includes('contrast')) range = 100;
            if (param.includes('luma') || param.includes('level')) range = 255;
            if (param.includes('hue')) range = 180;

            const delta = wave * strength * range;
            let newVal = base + delta;

            // Clamp positive for most values
            if (newVal < 0 && !param.includes('hue') && !param.includes('contrast')) newVal = 0;

            this.processor.state[effId][param] = newVal;
        });

        this.processor.render();
        requestAnimationFrame(() => this.loop());
    }
}
