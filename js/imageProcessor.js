import { PreProcessEffect } from './effects/PreProcessEffect.js';
import { UIBuilder } from './ui/UIBuilder.js';
import { DitherEffect } from './effects/DitherEffect.js';
import { GlitchEffect } from './effects/GlitchEffect.js';
import { HalftoneEffect } from './effects/HalftoneEffect.js';
import { Recorder } from './utils/Recorder.js';
import { Animator } from './animator/Animator.js';
import { VideoExporter } from './utils/VideoExporter.js';
import { WebGLManager } from './webgl/WebGLManager.js';
import { SeparationExporter } from './utils/SeparationExporter.js';
import { BatchManager } from './utils/BatchManager.js';

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
        this.videoExporter = new VideoExporter();
        this.exportFormat = 'webm'; // Default
        this.exportFormat = 'webm'; // Default
        this.animator = null; // Instantiated on load to access UI

        // GPU Manager
        this.glManager = null;
        this.gpuCanvas = document.createElement('canvas'); // Offscreen canvas for WebGL
        this.useGPU = true;

        // Texture / Background Settings
        this.backgroundMode = 'image'; // 'image', 'color', 'transparent'
        this.backgroundColor = '#000000';

        // Export Settings
        this.exportSettings = {
            format: 'png',     // png, jpg, webp, ico
            quality: 0.9,      // 0.0 - 1.0 (JPG/WEBP)
            resizeMode: 'original', // original, screen, custom
            customWidth: 1920,
            customHeight: 1080,
            maintainAspect: true
        };
    }

    loadImage(file) {
        this.sourceType = 'image';
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.removeAttribute('src'); // clear source
            this.videoElement.load(); // stop download
            this.videoElement.remove(); // removes from DOM if appended
            this.videoElement = null; // cleanup
        }
        // Brute force cleanup of any rogue video elements overlaying
        document.querySelectorAll('video').forEach(v => {
            v.pause();
            v.remove();
        });

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

        // Batch Manager
        if (!this.batchManager) {
            this.batchManager = new BatchManager(this);
            this.batchManager.initUI('ui-container'); // Appends to main container
        }

        // Controls
        document.getElementById('export-btn').disabled = false;
        this.setupRefreshedControls();

        // Initial Render
        this.initWebGL();
        this.requestRender();
    }

    initWebGL() {
        if (!this.useGPU) return;
        this.glManager = new WebGLManager(this.gpuCanvas);
        if (!this.glManager.isSupported) {
            this.useGPU = false;
        }
    }

    setupRefreshedControls() {
        const header = document.querySelector('.header-controls');

        // Remove existing dynamic buttons to avoid duplicates
        ['record-btn', 'quick-btn', 'video-full-btn', 'video-quick-btn', 'vid-toggle-btn', 'format-select'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // Image Section - Main Export Button is reused for IMG FULL
        const exportMain = document.getElementById('export-btn');
        exportMain.textContent = "EXPORT"; // Uses Settings

        // Create new buttons
        const imgQuick = this.createBtn('IMG QUICK', 'quick-btn', () => this.exportResult(true)); // Forces Screen Res
        const videoFull = this.createBtn('VID FULL RES', 'video-full-btn', () => this.exportVideo(true, videoFull));
        const videoQuick = this.createBtn('VID QUICK', 'video-quick-btn', () => this.exportVideo(false, videoQuick));

        // Connect Main Export
        // FIXED: Do not assign onclick here, it creates a duplicate event because main.js already adds a listener.
        // exportMain.onclick = () => this.exportResult(false); 

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

            // Insert in order: VID QUICK | VID FULL 
            header.insertBefore(videoQuick, exportMain);
            header.insertBefore(videoFull, exportMain);
        }

        // Image controls (Only if Image)
        if (this.sourceType === 'image') {
            header.insertBefore(imgQuick, exportMain);
        }
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
        // Dynamic Mobile Optimization
        const isMobile = window.innerWidth <= 768;
        const maxPreview = isMobile ? 600 : 960; // Reduce load on mobile GPU

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

        // --- TEXTURE / BACKGROUND CONTROLS ---
        const bgGroup = this.ui.createModuleGroup("CANVAS / TEXTURE EXPORT", null, "Hide source image to export texture overlays.");
        bgGroup.addSelect("BACKGROUND", [
            { label: "SOURCE IMAGE", value: 'image' },
            { label: "SOLID COLOR", value: 'color' },
            { label: "TRANSPARENT", value: 'transparent' }
        ], this.backgroundMode, (v) => {
            this.backgroundMode = v;
            this.requestRender();
        });

        // Color Picker (Only if Color mode) - Dynamic UI updates not fully implemented in UIBuilder, 
        // so we just show it always or let user toggle. 
        // Showing always is simpler for V1.
        bgGroup.addColor("BG COLOR", this.backgroundColor, (v) => {
            this.backgroundColor = v;
            if (this.backgroundMode === 'color') this.requestRender();
        });

        // --- EXPORT SETTINGS ---
        const expGroup = this.ui.createModuleGroup("EXPORT SETTINGS", null, "Configure output format and dimensions.");

        expGroup.addSelect("FORMAT", [
            { label: 'PNG', value: 'png' },
            { label: 'JPG', value: 'jpg' },
            { label: 'WEBP', value: 'webp' },
            { label: 'ICO (Favicon)', value: 'ico' }
        ], this.exportSettings.format, (v) => {
            this.exportSettings.format = v;
        });

        // SEPARATION EXPORT
        expGroup.createButton("EXPORT SEPARATIONS (ZIP)", () => this.exportSeparations());

        expGroup.addSlider("QUALITY", 0.1, 1.0, this.exportSettings.quality, 0.1, (v) => {
            this.exportSettings.quality = v;
        });

        expGroup.addSelect("RESIZE", [
            { label: 'ORIGINAL SIZE', value: 'original' },
            { label: 'SCREEN / PREVIEW', value: 'screen' },
            { label: 'CUSTOM SIZE', value: 'custom' }
        ], this.exportSettings.resizeMode, (v) => {
            this.exportSettings.resizeMode = v;
            this.generateUI(); // Rebuild to toggle Custom inputs
        });

        if (this.exportSettings.resizeMode === 'custom') {
            const aspect = this.originalImage ? (this.originalImage.width / this.originalImage.height) : 1;

            // PRESETS
            expGroup.addSelect("PRESET SIZE", [
                { label: 'CUSTOM', value: 'custom' },
                { label: '144p (256x144)', value: '144p' },
                { label: '240p (426x240)', value: '240p' },
                { label: '480p (854x480)', value: '480p' },
                { label: '720p (1280x720)', value: '720p' },
                { label: '1080p (1920x1080)', value: '1080p' },
                { label: '1440p (2560x1440)', value: '1440p' },
                { label: '2K (2048x1080)', value: '2k' },
                { label: '4K (3840x2160)', value: '4k' },
                { label: '8K (7680x4320)', value: '8k' }
            ], 'custom', (v) => {
                if (v !== 'custom') this.applyPreset(v);
            });

            // RATIOS
            expGroup.addSelect("ASPECT RATIO", [
                { label: 'FREE / CUSTOM', value: 'custom' },
                { label: 'Original', value: 'original' },
                { label: '1:1 (Square)', value: '1:1' },
                { label: '4:3 (Standard)', value: '4:3' },
                { label: '16:9 (Widescreen)', value: '16:9' },
                { label: '9:16 (Vertical)', value: '9:16' },
                { label: '21:9 (Cinema)', value: '21:9' }
            ], 'custom', (v) => {
                if (v !== 'custom') this.applyRatio(v);
            });

            expGroup.addNumber("WIDTH (px)", this.exportSettings.customWidth, (v) => {
                this.exportSettings.customWidth = v;
                if (this.exportSettings.maintainAspect) {
                    // Recalculate Height based on current Ratio logic or just keep current ratio?
                    // Simplest: keep ratio of current width/height
                    const currentAspect = this.exportSettings.customWidth / this.exportSettings.customHeight;
                    // But if we just changed width, we want to update height to MATCH that ratio? 
                    // No, "Lock Aspect" usually means "Lock to Image Aspect" or "Lock to Current Ratio".
                    // Let's assume Lock to Current Ratio derived from w/h
                    // Actually, better: if lock is on, use the LAST known good aspect.
                    const r = this.exportSettings.customHeight / (this.exportSettings.customWidth === v ? (v + 1) : (this.exportSettings.customWidth)); // diff
                    // Re-generate UI to show update?
                    // We need a stable aspect ratio state if we want to support this fully. 
                    // For V1, let's just use the current W/H ratio.
                    // Wait, the user wants to CHANGE width and have height update.
                    // We need to know the Target Aspect Ratio.
                    // calculated from current values BEFORE change?
                    // Complex. Let's simplify:
                    // If Maintain Aspect is ON, we use the ratio defined by PRESET or RATIO or Original.
                }
                // Update UI visually? Requires re-generation or binding. 
                // UIBuilder is simple re-gen.
                // this.generateUI(); // Can cause input focus loss. 
                // We will leave it for now, user manually changes or uses presets.
                // Actually, let's just support presets well first.
                // Re-implement basic lock:
                if (this.exportSettings.maintainAspect) {
                    // Use the ratio of the PREVIOUS width/height? 
                    // Or the Original Image ratio?
                    // Standard behavior: Lock to Original Image Ratio.
                    const ratio = this.originalImage ? (this.originalImage.height / this.originalImage.width) : 1;
                    this.exportSettings.customHeight = Math.round(v * ratio);
                    this.generateUI();
                }
            });

            expGroup.addNumber("HEIGHT (px)", this.exportSettings.customHeight, (v) => {
                this.exportSettings.customHeight = v;
                if (this.exportSettings.maintainAspect) {
                    const ratio = this.originalImage ? (this.originalImage.width / this.originalImage.height) : 1;
                    this.exportSettings.customWidth = Math.round(v * ratio);
                    this.generateUI();
                }
            });

            expGroup.addToggle("LOCK TO ORIGINAL ASPECT", this.exportSettings.maintainAspect, (v) => {
                this.exportSettings.maintainAspect = v;
                if (v && this.originalImage) {
                    // Reset to match aspect immediately?
                    // Maybe.
                }
            });
        }

        this.pipeline.forEach(effect => {
            // Pass description if available in effect
            effect.getControls(this.ui, this.state[effect.id], (key, value) => {
                this.state[effect.id][key] = value;
                this.requestRender();
            });
        });

        // Re-attach Animation Controls if they exist
        if (this.animator) {
            this.animator.setupUI();
        }
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

        // Try GPU Render First
        if (this.tryGPURender(this.originalImage, 1.0)) return;

        // Fallback to CPU
        // 1. Clear / Setup Background
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        if (this.backgroundMode === 'color') {
            this.ctx.fillStyle = this.backgroundColor;
            this.ctx.fillRect(0, 0, w, h);
        } else if (this.backgroundMode === 'image') {
            this.ctx.drawImage(this.originalImage, 0, 0, w, h);
        }
        // If transparent, we already cleared.

        // Run Pipeline on Preview
        // Explicitly pass scaleFactor=1.0 for Preview
        this.pipeline.forEach(effect => {
            effect.process(this.ctx, this.canvas.width, this.canvas.height, this.state[effect.id], 1.0);
        });
    }

    tryGPURender(source, scaleFactor) {
        if (!this.useGPU || !this.glManager) return false;

        // Check if ALL enabled effects have WebGL support
        // Mixing CPU and GPU is expensive (readPixels), so we only use GPU if we can stay on GPU 
        // OR if the heavy effects are at the end? 
        // For V1, simplest is: if ANY heavy effect is on, try GPU for that, but we need to pass textures.

        // Let's iterate. 
        // If an effect has `shaderSource`, we can use GPU.
        // If it doesn't, we must use CPU.

        // Strategy: 
        // 1. Upload Source to GPU Texture
        // 2. Ping-Pong? Or just apply effects sequentially if they are all GPU.
        // 3. If we hit a CPU effect, we readPixels -> CPU process -> uploadTexture? Too slow.

        // Optimization: Only use GPU if Halftone or Dither(Bayer) is enabled.
        // PreProcess (Blur/Levels) is fast enough on CPU usually, BUT handling 4k video?
        // Let's implement partial GPU pipeline:
        // Render CPU effects first to a canvas, then upload to GPU for Halftone/Dither?

        const activeEffects = this.pipeline.filter(e => this.state[e.id].enabled);
        if (activeEffects.length === 0) return false; // Just draw image

        // Identifying split point
        // If we have CPU effects only -> CPU
        // If we have GPU effects -> Do we have CPU effects *after* GPU effects?

        // For this task, Halftone and Dither are the heavy ones and they correspond to the END of pipeline usually.
        // Pipeline: Pre(CPU) -> Halftone(GPU) -> Dither(GPU) -> Glitch(CPU/GPU)

        // 1. Execute CPU-only effects at the start on temp canvas or main canvas
        // Handle Background Logic
        // We draw to 'this.ctx' (Main Canvas) as a base.
        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.clearRect(0, 0, w, h);

        if (this.backgroundMode === 'color') {
            this.ctx.fillStyle = this.backgroundColor;
            this.ctx.fillRect(0, 0, w, h);
        } else if (this.backgroundMode === 'image') {
            this.ctx.drawImage(source, 0, 0, w, h);
        }
        // Transparent: Just clear (done)

        const gpuEffects = [];
        let cpuEnded = false;

        // Run CPU effects until we hit a GPU capable one?
        // Actually, let's just run PreProcess (always CPU for now)
        // Then run Halftone/Dither on GPU. 

        // This hybrid approach:
        // 1. Draw Source to Context.
        // 2. PreProcessEffect.process(ctx...) (CPU)
        // 3. Upload Context to GPU.
        // 4. Run Halftone/Dither on GPU.
        // 5. Draw GPU result back to Context.

        // Valid? Yes.

        // Run CPU Pre-pass
        const pre = this.pipeline.find(p => p.id === 'preprocess_v1');
        if (pre && this.state[pre.id].enabled) {
            pre.process(this.ctx, this.canvas.width, this.canvas.height, this.state[pre.id], scaleFactor);
        }
        const glitch = this.pipeline.find(p => p.id === 'glitch_v1'); // Post CPU for now

        // GPU Candidates
        const halftone = this.pipeline.find(p => p.id === 'halftone_v1');
        const dither = this.pipeline.find(p => p.id === 'dither_v1');

        const useHalftone = (halftone && this.state[halftone.id].enabled);
        const useDither = (dither && this.state[dither.id].enabled && dither.isGPUSupported && dither.isGPUSupported(this.state[dither.id]));

        if (!useHalftone && !useDither) {
            // All CPU or standard pipeline
            // Just run the rest on CPU
            // Dither might be enabled but not GPU supported (e.g. Floyd)
            if (dither && this.state[dither.id].enabled) {
                dither.process(this.ctx, this.canvas.width, this.canvas.height, this.state[dither.id], scaleFactor);
            }
            // Halftone is always GPU candidate but if we are here it's disabled.

            if (glitch && this.state[glitch.id].enabled) {
                glitch.process(this.ctx, this.canvas.width, this.canvas.height, this.state[glitch.id], scaleFactor);
            }
            return true; // We handled it
        }

        // --- GPU PASS ---
        this.gpuCanvas.width = this.canvas.width;
        this.gpuCanvas.height = this.canvas.height;
        this.glManager.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // Upload current state (with PreProcess applied)
        this.glManager.uploadTexture(this.canvas); // Texture0

        // Apply Halftone
        if (useHalftone) {
            const prog = 'halftone';
            if (!this.glManager.programs[prog]) {
                this.glManager.createProgram(prog, halftone.shaderSource);
            }
            this.glManager.useProgram(prog);
            const uniforms = halftone.getUniforms(this.state[halftone.id], this.canvas.width, this.canvas.height, scaleFactor);
            for (let k in uniforms) {
                const type = Array.isArray(uniforms[k]) ? (uniforms[k].length + 'f') : '1f';
                if (k === 'u_mode' || k === 'u_algo') this.glManager.setUniform(k, '1i', uniforms[k]);
                else this.glManager.setUniform(k, type, uniforms[k]);
            }

            // Draw to screen? Or to temp buffer?
            // Since we have multiple passes, we need Framebuffers (FBO).
            // For V1, if support multiple GPU effects, we need ping-pong.
            // If we limit to ONE heavy effect or chaining, we need FBO.

            // Quick hack for V1: 
            // If ONLY Halftone: Draw to Screen.
            // If ONLY Dither: Draw to Screen.
            // If Both: We need FBO.

            if (useHalftone && !useDither) {
                this.glManager.draw();
            } else if (useHalftone && useDither) {
                // Render Halftone to Texture (via FBO - unimplemented in manager for conciseness)
                // Implementing simple Copy:
                this.glManager.draw();
                // Read back? No, copy to texture.
                const gl = this.glManager.gl;
                gl.activeTexture(gl.TEXTURE0);
                gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, this.canvas.width, this.canvas.height, 0);
            }
        }

        if (useDither) {
            const prog = 'dither';
            if (!this.glManager.programs[prog]) {
                this.glManager.createProgram(prog, dither.shaderSource);
            }
            this.glManager.useProgram(prog);
            const uniforms = dither.getUniforms(this.state[dither.id], this.canvas.width, this.canvas.height, scaleFactor);
            for (let k in uniforms) {
                const type = Array.isArray(uniforms[k]) ? (uniforms[k].length + 'f') : '1f';
                if (k === 'u_mode' || k === 'u_algo') this.glManager.setUniform(k, '1i', uniforms[k]);
                else this.glManager.setUniform(k, type, uniforms[k]);
            }
            this.glManager.draw();
        }

        // Draw GPU Result back to Main Canvas
        this.ctx.drawImage(this.gpuCanvas, 0, 0);

        // CPU Post-Process (Glitch)
        if (glitch && this.state[glitch.id].enabled) {
            glitch.process(this.ctx, this.canvas.width, this.canvas.height, this.state[glitch.id], scaleFactor);
        }

        return true;
    }

    renderVideo() {
        if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) return;

        // Try GPU
        if (this.useGPU && this.glManager) {
            // GPU Path
            // Draw Video Frame to Context (Need simple blit)
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

            // Reuse the tryGPURender logic but we need to ensure it uses the context we just drew to
            // tryGPURender(source) uses source to draw to ctx initially.
            // We can pass videoElement as source.
            this.tryGPURender(this.videoElement, 1.0);

        } else {
            // CPU Legacy Path
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
            this.pipeline.forEach(effect => {
                effect.process(this.ctx, this.canvas.width, this.canvas.height, this.state[effect.id], 1.0);
            });
        }

        // Loop
        if (this.sourceType === 'video') {
            // Use requestVideoFrameCallback if available for smoother playback
            if ('requestVideoFrameCallback' in this.videoElement) {
                this.videoElement.requestVideoFrameCallback(() => this.renderVideo());
            } else {
                requestAnimationFrame(() => this.renderVideo());
            }
        }
    }

    applyPreset(p) {
        let w = 1920, h = 1080;
        switch (p) {
            case '144p': w = 256; h = 144; break;
            case '240p': w = 426; h = 240; break;
            case '480p': w = 854; h = 480; break;
            case '720p': w = 1280; h = 720; break;
            case '1080p': w = 1920; h = 1080; break;
            case '1440p': w = 2560; h = 1440; break;
            case '2k': w = 2048; h = 1080; break;
            case '4k': w = 3840; h = 2160; break;
            case '8k': w = 7680; h = 4320; break;
        }
        // If "Lock Aspect" is on, we might need to adjust H to match W using original aspect?
        // Or Preselects override "Lock Aspect" temporarily? 
        // Presets are explicit WxH usually. 
        // But 4K is 3840x2160 (16:9). If image is 4:3, forcing 16:9 stretches it.
        // Better: Set Largest Dimension, scale other?
        // User asked for "144p...". Usually implies height.
        // Let's implement: "Set Height to X, calc Width" logic for 'p' definitions.

        if (p.endsWith('p')) {
            h = parseInt(p); // 144, 240...
            // Calc W based on original aspect
            if (this.originalImage) {
                const r = this.originalImage.width / this.originalImage.height;
                w = Math.round(h * r);
            } else {
                w = Math.round(h * (16 / 9)); // Fallback
            }
        } else {
            // 2k, 4k... usually Width based?
            // 4K DCI is 4096, UHD is 3840.
            if (p === '2k') w = 2048;
            if (p === '4k') w = 3840;
            if (p === '8k') w = 7680;

            if (this.originalImage) {
                const r = this.originalImage.height / this.originalImage.width;
                h = Math.round(w * r);
            }
        }

        this.exportSettings.customWidth = w;
        this.exportSettings.customHeight = h;
        this.generateUI();
    }

    applyRatio(r) {
        if (!this.originalImage) return;
        let targetRatio = 1;
        if (r === 'original') targetRatio = this.originalImage.width / this.originalImage.height;
        else if (r === '1:1') targetRatio = 1;
        else if (r === '4:3') targetRatio = 4 / 3;
        else if (r === '16:9') targetRatio = 16 / 9;
        else if (r === '9:16') targetRatio = 9 / 16;
        else if (r === '21:9') targetRatio = 21 / 9;

        // Adjust Height to match Width
        // Or Adjust Width? 
        // Let's adjust Height to match current Width * (1/Ratio)

        this.exportSettings.customHeight = Math.round(this.exportSettings.customWidth / targetRatio);
        this.generateUI();
    }

    exportResult(usePreviewRes = false) {
        if (this.sourceType === 'video') {
            alert("For video, use 'VID QUICK' or 'VID FULL RES' buttons!");
            return;
        }
        if (!this.originalImage) return;

        // Determine Dimensions based on Settings
        let w, h;
        const set = this.exportSettings;

        if (usePreviewRes) {
            // Quick Export (ignores settings, uses screen res & png)
            w = this.canvas.width;
            h = this.canvas.height;
            console.log("Exporting Preview Resolution (Quick)");
        } else {
            // Settings Export
            if (set.resizeMode === 'original') {
                w = this.originalImage.naturalWidth || this.originalImage.width;
                h = this.originalImage.naturalHeight || this.originalImage.height;
            } else if (set.resizeMode === 'screen') {
                w = this.canvas.width;
                h = this.canvas.height;
            } else if (set.resizeMode === 'custom') {
                w = set.customWidth || 100;
                h = set.customHeight || 100;
            }
        }

        const exportScale = w / this.canvas.width; // Scale effects relative to current preview
        console.log(`Exporting: ${w}x${h} [${set.format.toUpperCase()}] (Scale: ${exportScale.toFixed(2)}x)`);

        if (w * h > 50000000 && !usePreviewRes) {
            if (!confirm("Warning: Extremely large resolution. Continue?")) return;
        }

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = w;
        exportCanvas.height = h;
        const eCtx = exportCanvas.getContext('2d');

        // Draw Source based on Background Mode
        // ... (Existing export code handled by simple logic below)

        // RE-RUN PIPELINE FOR EXPORT RESOLUTION
        // This ensures effects scale properly.

        // 1. Clear
        if (this.backgroundMode === 'color') {
            eCtx.fillStyle = this.backgroundColor;
            eCtx.fillRect(0, 0, w, h);
        } else if (this.backgroundMode === 'image') {
            eCtx.drawImage(this.originalImage, 0, 0, w, h);
        }

        // 2. Process
        this.pipeline.forEach(effect => {
            // Need to adjust params if they scale?
            // Most params are relative or pixel based. 
            // e.g. defined DPI/Resolution in Dither is factor of size.
            // But PreProcess Blur is px. 
            // We pass 'exportScale' to process() so effects can scale their px values.
            effect.process(eCtx, w, h, this.state[effect.id], exportScale);
        });

        // 3. Download
        const format = set.format === 'jpg' ? 'image/jpeg' : (set.format === 'webp' ? 'image/webp' : 'image/png');
        const ext = set.format === 'ico' ? 'png' : set.format; // ico is just weird png here

        const dataURL = exportCanvas.toDataURL(format, set.quality);
        const link = document.createElement('a');
        link.download = `VOID_EXPORT_${Date.now()}.${ext}`;
        link.href = dataURL;
        link.click();
    }

    async exportSeparations() {
        if (!this.originalImage) return;

        const ditherState = this.state['dither_v1'];
        if (!ditherState || !ditherState.enabled) {
            alert("Please enable Dither Engine (Grade or Tonal) to export separations.");
            return;
        }

        this.toggleLoading(true);

        try {
            // 1. Prepare Full Res Canvas
            const w = this.originalImage.naturalWidth;
            const h = this.originalImage.naturalHeight;
            const cvs = document.createElement('canvas');
            cvs.width = w; cvs.height = h;
            const ctx = cvs.getContext('2d');

            // Draw Source
            ctx.drawImage(this.originalImage, 0, 0, w, h);

            // Apply Pipeline (Same as Export) to get the final Dithered look
            // But we might want ONLY the dither effect? 
            // Usually separation is based on the FINAL look.
            // So Apply PreProcess -> Halftone -> Dither
            // But NOT Glitch? Glitch ruins separation usually.
            // Let's ask pipeline to process up to Dither.

            const scale = w / this.canvas.width;

            for (let effect of this.pipeline) {
                if (effect.id === 'glitch_v1') continue; // Skip Glitch for separation safety? User might want it though.
                // Let's include everything that affects color.
                effect.process(ctx, w, h, this.state[effect.id], scale);
            }

            // 2. Generate Maps
            const layers = await SeparationExporter.generate(cvs, ditherState); // returns { filename: blob }

            // 3. Zip
            if (!window.JSZip) throw new Error("JSZip library not loaded.");
            const zip = new JSZip();

            // Add files
            for (let [name, blob] of Object.entries(layers)) {
                zip.file(`${name}.png`, blob);
            }

            const content = await zip.generateAsync({ type: "blob" });

            // 4. Download
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VOID_SEPARATIONS_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);

        } catch (e) {
            alert("Separation Export Failed: " + e.message);
            console.error(e);
        } finally {
            this.toggleLoading(false);
        }
    }
}

