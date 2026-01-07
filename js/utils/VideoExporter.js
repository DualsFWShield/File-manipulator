/**
 * VideoExporter - Frame-by-frame offline rendering and encoding.
 * Uses WebCodecs API and webm-muxer (via CDN).
 */
import { Muxer, ArrayBufferTarget } from 'https://cdn.jsdelivr.net/npm/webm-muxer/+esm';
import { GIFEncoder, quantize, applyPalette } from 'https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js';

export class VideoExporter {
    constructor() {
        this.isProcessing = false;
        this.stopFlag = false;
    }

    /**
     * Render the processed video to a file (WebM or GIF).
     * @param {Object} processor - ImageProcessor instance
     * @param {HTMLVideoElement} video - Source video element
     * @param {Function} onProgress - Callback (percent, statusText)
     * @param {Boolean} isFullRes - If true, uses video natural dims
     * @param {String} format - 'webm' or 'gif'
     */
    async render(processor, video, onProgress, isFullRes = false, format = 'webm') {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.stopFlag = false;

        // Cleanup variables must be declared outside try/catch
        let originalW = processor.canvas.width;
        let originalH = processor.canvas.height;
        let resizeNeeded = false;

        try {
            const width = isFullRes ? video.videoWidth : processor.canvas.width;
            const height = isFullRes ? video.videoHeight : processor.canvas.height;
            const fps = format === 'gif' ? 15 : 30; // GIFs are heavy, 15fps is safer. WebM 30.
            const duration = video.duration;
            const totalFrames = Math.floor(duration * fps);

            console.log(`Starting Export [${format.toUpperCase()}]: ${width}x${height} @ ${fps}fps, ${totalFrames} frames`);

            // Setup Encoder
            let muxer, encoder, gif;

            if (format === 'webm') {
                muxer = new Muxer({
                    target: new ArrayBufferTarget(),
                    video: { codec: 'V_VP9', width, height, frameRate: fps }
                });
                encoder = new VideoEncoder({
                    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                    error: (e) => { throw e; }
                });
                encoder.configure({
                    codec: 'vp09.00.10.08', width, height, bitrate: 5_000_000, framerate: fps
                });
            } else {
                // GIF Setup
                gif = new GIFEncoder();
            }

            // Prepare Canvas
            const renderCanvas = document.createElement('canvas');
            renderCanvas.width = width;
            renderCanvas.height = height;
            const ctx = renderCanvas.getContext('2d', { willReadFrequently: true });

            // Resize Logic
            if (originalW !== width || originalH !== height) {
                resizeNeeded = true;
                processor.canvas.width = width;
                processor.canvas.height = height;
                if (processor.glManager) {
                    processor.gpuCanvas.width = width;
                    processor.gpuCanvas.height = height;
                    processor.glManager.gl.viewport(0, 0, width, height);
                }
            }

            // Frame Loop
            const timeStep = 1 / fps;
            video.pause();
            const originalTime = video.currentTime;

            for (let i = 0; i < totalFrames; i++) {
                if (this.stopFlag) break;

                const t = i * timeStep;
                video.currentTime = t;

                // Wait for seek
                await new Promise(r => {
                    const onSeek = () => { video.removeEventListener('seeked', onSeek); r(); };
                    video.addEventListener('seeked', onSeek);
                    if (Math.abs(video.currentTime - t) < 0.01) { video.removeEventListener('seeked', onSeek); r(); }
                });

                // DRAW & PROCESS
                // Render Frame
                if (processor.useGPU) {
                    processor.tryGPURender(video, isFullRes ? 1.0 : 1.0); // Scale factor 1.0 as we resized canvas
                    // Copy result to renderCanvas
                    ctx.drawImage(processor.canvas, 0, 0);
                } else {
                    // CPU Path - Manual Draw
                    // Handle Background
                    if (processor.backgroundMode === 'color') {
                        ctx.fillStyle = processor.backgroundColor;
                        ctx.fillRect(0, 0, width, height);
                    } else if (processor.backgroundMode === 'image') {
                        ctx.drawImage(video, 0, 0, width, height);
                    }
                    // Transparent: Do nothing

                    processor.pipeline.forEach(effect => {
                        effect.process(ctx, width, height, processor.state[effect.id], 1.0);
                    });
                }

                // ENCODE
                if (format === 'webm') {
                    const frame = new VideoFrame(renderCanvas, { timestamp: i * (1000000 / fps) });
                    encoder.encode(frame);
                    frame.close();
                } else {
                    // GIF
                    const data = ctx.getImageData(0, 0, width, height).data;
                    const palette = quantize(data, 256);
                    const index = applyPalette(data, palette);
                    gif.writeFrame(index, width, height, { palette, delay: (1000 / fps) });
                }

                // PROGRESS
                if (i % 5 === 0) {
                    onProgress((i / totalFrames) * 100, `RENDERING [${format}] ${i}/${totalFrames}`);
                    // Yield to UI
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            // Finish
            let blob;
            if (format === 'webm') {
                await encoder.flush();
                muxer.finalize();
                blob = new Blob([muxer.target.buffer], { type: 'video/webm' });
            } else {
                gif.finish();
                blob = new Blob([gif.bytes()], { type: 'image/gif' });
            }

            video.currentTime = originalTime;
            this.isProcessing = false;
            return blob;

        } catch (err) {
            this.isProcessing = false;
            console.error("Export Error:", err);
            throw err;
        } finally {
            // RESTORE Canvas size
            if (resizeNeeded) {
                processor.canvas.width = originalW;
                processor.canvas.height = originalH;
                if (processor.glManager) {
                    processor.gpuCanvas.width = originalW;
                    processor.gpuCanvas.height = originalH;
                    processor.glManager.gl.viewport(0, 0, originalW, originalH);
                }
            }
        }
    }

    cancel() {
        this.stopFlag = true;
    }
}
