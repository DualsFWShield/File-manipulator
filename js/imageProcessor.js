import { PreProcessEffect } from './effects/PreProcessEffect.js';
import { UIBuilder } from './ui/UIBuilder.js';
import { DitherEffect } from './effects/DitherEffect.js';
import { GlitchEffect } from './effects/GlitchEffect.js';
import { HalftoneEffect } from './effects/HalftoneEffect.js';
import { Recorder } from './utils/Recorder.js';
import { Animator } from './animator/Animator.js';
import { VideoExporter } from './utils/VideoExporter.js';

export class ImageProcessor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.originalImage = null;
        this.videoElement = null;
        this.sourceType = 'image'; // image | video

        this.ui = new UIBuilder('modules-rack');

        // Pipeline Definition
        this.pipeline = [
            PreProcessEffect, // Levels, Blur, Noise, Sharpen
            HalftoneEffect,   // Print style
            DitherEffect,     // Quantize & Tone
            GlitchEffect      // Post-process corruption
        ];

        this.state = {};
        this.pipeline.forEach(effect => {
            this.state[effect.id] = { ...effect.params };
        });

        this.renderTimeout = null;
        this.previewScale = 1.0;

        // Recorder & Animator
        this.recorder = new Recorder(this.canvas);
        this.videoExporter = new VideoExporter();
        this.exportFormat = 'webm'; // Default
        this.animator = null; // Instantiated on load to access UI
    }

    loadImage(file) {
        this.sourceType = 'image';
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement = null; // Cleanup
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.setupPreview(img);
                this.initSystem();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    loadVideo(file) {
        this.sourceType = 'video';
        this.originalImage = null; // Cleanup image

        const url = URL.createObjectURL(file);

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = "";
        }
        this.videoElement = document.createElement('video');
        this.videoElement.src = url;
        this.videoElement.muted = true; // Auto-play requires mute often
        this.videoElement.loop = true;
        this.videoElement.playsInline = true;

        this.videoElement.onloadedmetadata = () => {
            this.setupPreview({ width: this.videoElement.videoWidth, height: this.videoElement.videoHeight });
            this.initSystem();

            // Auto Play
            this.videoElement.play();
            this.renderVideo();
        };
    }

    initSystem() {
        // UI & Animation
        this.generateUI();
        if (!this.animator) this.animator = new Animator(this);
        else this.animator.setupUI(); // Re-add animation controls

        // Controls
        document.getElementById('export-btn').disabled = false;
        this.setupRefreshedControls();

        // Initial Render
        this.requestRender();
    }

    setupRefreshedControls() {
        const header = document.querySelector('.header-controls');

        // Remove existing dynamic buttons to avoid duplicates
        ['record-btn', 'quick-btn', 'video-full-btn', 'video-quick-btn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // Image Section - Main Export Button is reused for IMG FULL
        const exportMain = document.getElementById('export-btn');
        exportMain.textContent = "IMG FULL RES";

        // Create new buttons
        const imgQuick = this.createBtn('IMG QUICK', 'quick-btn', () => this.exportResult(true));
        const videoFull = this.createBtn('VID FULL RES', 'video-full-btn', () => this.exportVideo(true, videoFull));
        const videoQuick = this.createBtn('VID QUICK', 'video-quick-btn', () => this.exportVideo(false, videoQuick));

        // Video Controls (If Video Mode)
        if (this.sourceType === 'video') {
            const togglePlay = this.createBtn('PAUSE', 'vid-toggle-btn', (e) => {
                if (this.videoElement.paused) {
                    this.videoElement.play();
                    this.renderVideo();
                    e.target.textContent = "PAUSE";
                } else {
                    this.videoElement.pause();
                    e.target.textContent = "PLAY";
                }
            });
            header.insertBefore(togglePlay, exportMain);

            // Format Selection Dropdown
            const formatSelect = document.createElement('select');
            formatSelect.id = 'format-select';
            formatSelect.className = 'btn btn-secondary'; // Recycle btn style
            formatSelect.style.marginLeft = '10px';
            formatSelect.style.padding = '5px';
            formatSelect.style.background = 'var(--bg-panel)';

            ['webm', 'gif'].forEach(fmt => {
                const opt = document.createElement('option');
                opt.value = fmt;
                opt.text = fmt.toUpperCase();
                formatSelect.appendChild(opt);
            });
            formatSelect.onchange = (e) => { this.exportFormat = e.target.value; };
            formatSelect.value = this.exportFormat; // Set initial value

            header.insertBefore(formatSelect, exportMain);
        }

        // Insert in order: VID QUICK | VID FULL | IMG QUICK | [IMG FULL (Existing)]
        header.insertBefore(videoQuick, exportMain);
        header.insertBefore(videoFull, exportMain);
        header.insertBefore(imgQuick, exportMain);
    }

    createBtn(text, id, onClick) {
        const btn = document.createElement('button');
        btn.id = id;
        btn.className = 'btn btn-secondary';
        btn.textContent = text;
        btn.style.marginRight = '10px';
        btn.onclick = onClick;
        return btn;
    }

    async exportVideo(isFullRes, btn) {
        if (this.sourceType !== 'video' || !this.videoElement) return;

        // Prevent double click
        if (this.videoExporter.isProcessing) return;

        // UI Feedback
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "INITIALIZING...";
        btn.classList.add('recording-active');

        try {
            const fmt = this.exportFormat || 'webm';
            const blob = await this.videoExporter.render(
                this,
                this.videoElement,
                (percent, text) => this.updateProgress(btn, percent, text),
                isFullRes,
                fmt
            );

            // Download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VOID_VIDEO_FX_${isFullRes ? 'FULL' : 'QUICK'}_${Date.now()}.${fmt}`;
            a.click();
            URL.revokeObjectURL(url);

        } catch (err) {
            console.error("Export Failed", err);
            alert("Video Export Failed: " + err.message);
        } finally {
            // Restore UI
            btn.textContent = originalText;
            btn.style.background = '';
            btn.disabled = false;
            btn.classList.remove('recording-active');

            // Resume play if was playing?
            this.videoElement.play();
            this.renderVideo();
        }
    }

    updateProgress(btn, percent, text) {
        btn.textContent = text || `${Math.round(percent)}%`;
        btn.style.background = `linear-gradient(90deg, var(--accent-primary) ${percent}%, var(--bg-surface) ${percent}%)`;
    }

    setupPreview(img) {
        // LIMIT PREVIEW SIZE FOR PERFORMANCE
        const maxPreview = 960;

        let w = img.width;
        let h = img.height;

        if (w > maxPreview || h > maxPreview) {
            const ratio = Math.min(maxPreview / w, maxPreview / h);
            this.previewScale = ratio;
            w *= ratio;
            h *= ratio;
        } else {
            this.previewScale = 1.0;
        }

        this.canvas.width = w;
        this.canvas.height = h;
    }

    generateUI() {
        this.ui.clear();
        this.pipeline.forEach(effect => {
            // Pass description if available in effect
            effect.getControls(this.ui, this.state[effect.id], (key, value) => {
                this.state[effect.id][key] = value;
                this.requestRender();
            });
        });
    }

    requestRender() {
        if (this.animator && this.animator.isPlaying) return;

        // Show Loading
        this.toggleLoading(true);

        if (this.renderTimeout) clearTimeout(this.renderTimeout);

        // Debounce 30ms for responsiveness
        this.renderTimeout = setTimeout(() => {
            requestAnimationFrame(() => {
                if (this.sourceType === 'video') this.renderVideo();
                else this.render();
                this.toggleLoading(false);
            });
        }, 30);
    }

    toggleLoading(show) {
        let loader = document.getElementById('proc-loader');
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'proc-loader';
            loader.innerHTML = `<div class="spinner"></div><span>PROCESSING...</span>`;
            // Inline styles for speed
            loader.style.position = 'absolute';
            loader.style.top = '10px';
            loader.style.right = '10px';
            loader.style.background = 'rgba(0,0,0,0.8)';
            loader.style.color = '#0f0';
            loader.style.padding = '5px 10px';
            loader.style.border = '1px solid #0f0';
            loader.style.fontFamily = 'monospace';
            loader.style.display = 'none';
            loader.style.pointerEvents = 'none';
            loader.style.zIndex = '1000';

            const container = document.querySelector('.preview-container');
            if (container) container.appendChild(loader);

            const style = document.createElement('style');
            style.textContent = `
            .spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid #0f0; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 5px; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `;
            document.head.appendChild(style);
        }
        loader.style.display = show ? 'flex' : 'none';
    }

    render() {
        if (!this.originalImage) return;

        // Draw scaled image to Preview Canvas
        this.ctx.drawImage(this.originalImage, 0, 0, this.canvas.width, this.canvas.height);

        // Run Pipeline on Preview
        // Explicitly pass scaleFactor=1.0 for Preview
        this.pipeline.forEach(effect => {
            effect.process(this.ctx, this.canvas.width, this.canvas.height, this.state[effect.id], 1.0);
        });
    }

    renderVideo() {
        if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) return;

        // Draw Video Frame
        this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

        // Run Pipeline
        this.pipeline.forEach(effect => {
            effect.process(this.ctx, this.canvas.width, this.canvas.height, this.state[effect.id], 1.0);
        });

        // Loop
        requestAnimationFrame(() => this.renderVideo());
    }

    exportResult(usePreviewRes = false) {
        if (this.sourceType === 'video') {
            alert("For video, use 'VID QUICK' or 'VID FULL RES' buttons!");
            return;
        }
        if (!this.originalImage) return;

        let w, h, exportScale;

        if (usePreviewRes) {
            w = this.canvas.width;
            h = this.canvas.height;
            exportScale = 1.0;
            console.log("Exporting Preview Resolution");
        } else {
            w = this.originalImage.naturalWidth || this.originalImage.width;
            h = this.originalImage.naturalHeight || this.originalImage.height;
            exportScale = w / this.canvas.width;
            console.log(`Exporting Full Res: ${w}x${h} (Scale: ${exportScale.toFixed(2)}x)`);
        }

        if (w * h > 50000000 && !usePreviewRes) {
            if (!confirm("Warning: Extremely large resolution. Continue?")) return;
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = w;
        exportCanvas.height = h;
        const eCtx = exportCanvas.getContext('2d');

        // Draw Source
        eCtx.drawImage(this.originalImage, 0, 0, w, h);

        this.toggleLoading(true);
        // Defer processing to let UI update
        setTimeout(() => {
            try {
                this.pipeline.forEach(effect => {
                    effect.process(eCtx, w, h, this.state[effect.id], exportScale);
                });

                const link = document.createElement('a');
                link.download = `VOID_EXPORT_${Date.now()}.png`;
                link.href = exportCanvas.toDataURL('image/png');
                link.click();

                exportCanvas.width = 1;
            } catch (err) {
                console.error(err);
                alert("Export Failed: " + err.message);
            } finally {
                this.toggleLoading(false);
            }
        }, 50);
    }
}
