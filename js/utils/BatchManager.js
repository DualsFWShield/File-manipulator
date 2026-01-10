/**
 * BatchManager.js
 * Handles multi-file processing (Batch Mode).
 * Uses the current ImageProcessor pipeline settings to process a queue of images.
 */

import { ImageProcessor } from '../imageProcessor.js';

export class BatchManager {
    constructor(imageProcessor) {
        this.processor = imageProcessor;
        this.queue = [];
        this.isProcessing = false;
        this.uiContainer = null;
    }

    // Initialize the Batch UI area (Drag & Drop zone)
    initUI(containerId) {
        let parent = document.getElementById(containerId);
        if (!parent) return;

        // Create Drop Zone
        const dropZone = document.createElement('div');
        dropZone.className = 'batch-drop-zone';
        dropZone.innerHTML = `
            <div class="batch-icon">📂</div>
            <h3>BATCH PROCESSING</h3>
            <p>Drag & Drop multiple images here to apply current effect chain.</p>
            <input type="file" id="batch-input" multiple accept="image/*" style="display:none">
            <button id="batch-select-btn" class="btn btn-secondary">SELECT FILES</button>
            <div id="batch-status" class="batch-status"></div>
        `;

        // Style
        dropZone.style.border = '2px dashed var(--accent-secondary)';
        dropZone.style.padding = '20px';
        dropZone.style.textAlign = 'center';
        dropZone.style.marginTop = '20px';
        dropZone.style.borderRadius = '8px';
        dropZone.style.background = 'rgba(255,255,255,0.05)';
        dropZone.style.transition = 'all 0.3s ease';

        parent.appendChild(dropZone);
        this.statusEl = dropZone.querySelector('#batch-status');

        // Events
        dropZone.ondragover = (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(255,255,255,0.1)';
            dropZone.style.borderColor = 'var(--accent-primary)';
        };
        dropZone.ondragleave = (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(255,255,255,0.05)';
            dropZone.style.borderColor = 'var(--accent-secondary)';
        };
        dropZone.ondrop = (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(255,255,255,0.05)';
            if (e.dataTransfer.files.length > 0) {
                this.handleFiles(e.dataTransfer.files);
            }
        };

        const input = dropZone.querySelector('#batch-input');
        const btn = dropZone.querySelector('#batch-select-btn');
        btn.onclick = () => input.click();
        input.onchange = (e) => {
            if (e.target.files.length > 0) this.handleFiles(e.target.files);
        };
    }

    async handleFiles(fileList) {
        if (this.isProcessing) return;
        this.queue = Array.from(fileList).filter(f => f.type.startsWith('image/'));

        if (this.queue.length === 0) {
            alert("No valid images found.");
            return;
        }

        if (!confirm(`Begin Batch Processing for ${this.queue.length} images using current settings?`)) return;

        this.startBatch();
    }

    async startBatch() {
        this.isProcessing = true;
        this.updateStatus(0, this.queue.length, "Starting...");

        if (!window.JSZip) {
            alert("JSZip not loaded. Cannot create archive.");
            this.isProcessing = false;
            return;
        }

        const zip = new JSZip();
        // Capture current state of params
        const stateSnapshot = JSON.parse(JSON.stringify(this.processor.state));
        const settings = this.processor.exportSettings;

        // Hidden Canvas for processing
        const workCanvas = document.createElement('canvas');
        const workCtx = workCanvas.getContext('2d');

        for (let i = 0; i < this.queue.length; i++) {
            const file = this.queue[i];
            this.updateStatus(i + 1, this.queue.length, `Processing ${file.name}...`);

            try {
                const img = await this.loadFile(file);

                // Determine Size
                let w = img.width, h = img.height;
                if (settings.resizeMode === 'custom') {
                    w = settings.customWidth;
                    h = settings.customHeight;
                    // Maintain aspect logic manual check here or assume custom is strict
                    if (settings.maintainAspect) {
                        // Ratio based on img
                        const r = img.width / img.height;
                        if (w / h > r) w = h * r; else h = w / r;
                        w = Math.round(w); h = Math.round(h);
                    }
                }

                workCanvas.width = w;
                workCanvas.height = h;

                // 1. Draw
                // Background
                if (this.processor.backgroundMode === 'color') {
                    workCtx.fillStyle = this.processor.backgroundColor;
                    workCtx.fillRect(0, 0, w, h);
                } else {
                    workCtx.drawImage(img, 0, 0, w, h);
                }

                // 2. Process
                // We need to temporally set processor scale for effects?
                // Pipeline process expects context.
                // We can reuse the pipeline objects but we must pass the stateSnapshot so we don't accidentally use mutated state (though state shouldn't mutate during process).

                // Scale factor for effects (Blur radius etc)
                // Assume Preview width was ~960. 
                // We need to calculate a scale factor relative to "Design Resolution".
                // ImageProcessor uses 'this.canvas.width' (preview) as base.
                // We don't have access to Preview Width here easily unless we ask processor.
                const previewW = this.processor.canvas.width || 800;
                const scale = w / previewW;

                this.processor.pipeline.forEach(effect => {
                    // Use Snapshot state
                    effect.process(workCtx, w, h, stateSnapshot[effect.id], scale);
                });

                // 3. Add to Zip
                const blob = await new Promise(r => workCanvas.toBlob(r, settings.format === 'jpg' ? 'image/jpeg' : 'image/png', settings.quality));
                // Rename
                const nameParts = file.name.split('.');
                const ext = nameParts.pop();
                const cleanName = nameParts.join('.');
                zip.file(`${cleanName}_VOID.${settings.format}`, blob);

            } catch (err) {
                console.error(`Error processing ${file.name}`, err);
                zip.file(`${file.name}_ERROR.txt`, err.message);
            }
        }

        this.updateStatus(this.queue.length, this.queue.length, "Finalizing Zip...");

        try {
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VOID_BATCH_${Date.now()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("Zip Error: " + e.message);
        }

        this.isProcessing = false;
        this.updateStatus(this.queue.length, this.queue.length, "Done!");
    }

    loadFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    updateStatus(current, total, msg) {
        if (!this.statusEl) return;
        this.statusEl.innerHTML = `
            <span>${msg}</span>
            <div style="background:#333; width:100%; height:4px; margin-top:5px;">
                <div style="background:var(--accent-primary); width:${(current / total) * 100}%; height:100%;"></div>
            </div>
            <small>${current} / ${total}</small>
        `;
    }
}
