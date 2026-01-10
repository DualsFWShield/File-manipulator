import { Palettes, getPaletteVec3 } from '../utils/Palettes.js';
import { ColorQuantizer } from '../utils/ColorQuantizer.js';

/**
 * DitherEffect - Optimized V2 with RGB support, Tonal & Grade Modes.
 */
export const DitherEffect = {
    name: "DITHER & TONE",
    id: "dither_v1",
    description: "Quantize colors and apply dithering patterns (Floyd-Steinberg, Bayer) with Retro Palettes.",

    params: {
        enabled: false,
        // Common
        resolution: 1.0,
        algorithm: 'floyd', // floyd, atkinson, sierra, bayer4, bayer8, modulation, stitched, thread, bitwave, grid
        resampling: 'nearest',

        // Mode: 'tonal' or 'grade'
        renderMode: 'tonal',

        // Tonal Mode Params
        // Custom 3-Stop Gradient or simple Threshold
        // New: Thresholding handles
        lumaLow: 60, // 0-255
        lumaHigh: 190, // 0-255
        colorShadow: '#000000',
        colorMid: '#808080',
        colorHighlight: '#ffffff',

        // Grade Mode Params
        // Color quantization
        palette: 'bw_1bit', // Key from Palettes.js
        colorSpace: 'palette', // 'palette', 'rgb'
        indexedCount: 16, // If auto-extract
        contrast: 0,

        // Algorithmic Tweaks
        spread: 1.0,
        bleeding: 0.0,
        roundness: 0.0, // Post-process blur+threshold

        // Advanced
        knockout: false,
    },

    getControls: (builder, params, onUpdate) => {
        const group = builder.createModuleGroup("DITHERING ENGINE", (enabled) => onUpdate('enabled', enabled), params.enabled, DitherEffect.description);

        group.addSelect("RENDER MODE", [
            { label: "TONAL (Luminance Gradient)", value: "tonal" },
            { label: "GRADE (Color Palette)", value: "grade" }
        ], params.renderMode, (v) => {
            onUpdate('renderMode', v);
            refreshUI(v); // Trigger Visibility toggle
        }, "Render Mode: Tonal (B&W Gradients) or Grade (Color Palettes).");

        group.addSelect("ALGORITHM", [
            { label: "None (Pixelate)", value: "none" },
            { label: "Floyd-Steinberg (Smooth)", value: "floyd" },
            { label: "Atkinson (High Contrast)", value: "atkinson" },
            { label: "Sierra Lite (Speed)", value: "sierra" },
            { label: "Bayer 4x4 (Grid)", value: "bayer4" },
            { label: "Bayer 8x8 (Fine)", value: "bayer8" },
            { label: "Thread (Linear)", value: "thread" },
            { label: "Bitwave (Sine)", value: "bitwave" },
            { label: "Grid Modulation (Cross)", value: "grid" },
            { label: "Stitched (Rug)", value: "stitched" }
        ], params.algorithm, (v) => onUpdate('algorithm', v), "Error Diffusion Algorithm used for dithering.");

        group.addSlider("RESOLUTION / DPI", 0.05, 1.0, params.resolution, 0.05, (v) => onUpdate('resolution', v), "Pixelation factor / Downsampling.");

        // --- CONTAINERS ---
        const tonalDiv = document.createElement('div');
        tonalDiv.className = 'sub-group_tonal';
        group.content.appendChild(tonalDiv);

        const gradeDiv = document.createElement('div');
        gradeDiv.className = 'sub-group_grade';
        group.content.appendChild(gradeDiv);

        const refreshUI = (mode) => {
            tonalDiv.style.display = mode === 'tonal' ? 'block' : 'none';
            gradeDiv.style.display = mode === 'grade' ? 'block' : 'none';
        };

        // --- POPULATE TONAL ---
        builder.addDescription(tonalDiv, "Map grayscale to gradient. Tweaking Mid-Points.");
        builder.addSlider(tonalDiv, "LUMA LOW (Shadow Cut)", 0, 255, params.lumaLow, 1, (v) => onUpdate('lumaLow', v), "Black point threshold (Clip Shadows).");
        builder.addSlider(tonalDiv, "LUMA HIGH (Highlight Cut)", 0, 255, params.lumaHigh, 1, (v) => onUpdate('lumaHigh', v), "White point threshold (Clip Highlights).");

        if (builder.addColor) {
            builder.addColor(tonalDiv, "HIGHLIGHT", params.colorHighlight, (v) => onUpdate('colorHighlight', v), "Color for highlights.");
            builder.addColor(tonalDiv, "MIDTONE", params.colorMid, (v) => onUpdate('colorMid', v), "Color for midtones.");
            builder.addColor(tonalDiv, "SHADOW", params.colorShadow, (v) => onUpdate('colorShadow', v), "Color for shadows.");
        }

        // --- POPULATE GRADE ---
        builder.addDescription(gradeDiv, "Quantize colors to a palette.");
        const palOptions = Object.keys(Palettes).map(k => ({ label: Palettes[k].name, value: k }));
        palOptions.unshift({ label: "AUTO (Extract 16)", value: 'extract_16' });
        palOptions.unshift({ label: "AUTO (Extract 4)", value: 'extract_4' });
        palOptions.unshift({ label: "AUTO (Extract 64)", value: 'extract_64' });

        builder.addSelect(gradeDiv, "PALETTE", palOptions, params.palette, (v) => onUpdate('palette', v), "Color palette used for quantization.");
        builder.addSlider(gradeDiv, "CONTRAST", -100, 100, params.contrast, 1, (v) => onUpdate('contrast', v), "Adjust contrast before reducing colors.");

        // Initial Visibility
        refreshUI(params.renderMode);

        // --- COMMON ADVANCED ---
        // Append to main group again
        group.addSlider("ROUNDING (Stylize)", 0.0, 1.0, params.roundness, 0.05, (v) => onUpdate('roundness', v), "Pixel shape rounding (Post-Blur).");

        if (['bayer4', 'bayer8', 'bitwave', 'grid', 'stitched', 'thread'].includes(params.algorithm)) {
            group.addSlider("SPREAD / BIAS", 0.1, 5.0, params.spread, 0.1, (v) => onUpdate('spread', v), "Dithering matrix spread/bias.");
        }

        group.addSlider("BLEEDING", 0.0, 1.0, params.bleeding, 0.05, (v) => onUpdate('bleeding', v), "Ink bleed simulation.");
        group.addToggle("KNOCKOUT BG", params.knockout, (v) => onUpdate('knockout', v), "Make background transparent (Removes black/white).");
    },

    process: (ctx, width, height, params, scaleFactor = 1.0) => {
        if (!params.enabled) return;

        // Resolution applies to the canvas size
        const w = Math.max(1, Math.floor(width * params.resolution));
        const h = Math.max(1, Math.floor(height * params.resolution));

        // 1. Downscale
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        const tCtx = tempCanvas.getContext('2d');

        tCtx.imageSmoothingEnabled = params.resampling === 'preserve';
        tCtx.drawImage(ctx.canvas, 0, 0, w, h);

        const imageData = tCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // PREPARE PALETTE (If Grade Mode)
        let activePalette = null;
        if (params.renderMode === 'grade') {
            if (params.palette.startsWith('extract')) {
                const count = parseInt(params.palette.split('_')[1]);
                activePalette = ColorQuantizer.extract(imageData, count, 'kmeans'); // Use K-Means
            } else {
                activePalette = getPaletteVec3(params.palette);
            }
        }

        const factorContrast = (259 * (params.contrast + 255)) / (255 * (259 - params.contrast));

        // Parse hex colors for Tonal Mode
        const palTonal = {
            shadow: hexToRgb(params.colorShadow || '#000000'),
            mid: hexToRgb(params.colorMid || '#808080'),
            high: hexToRgb(params.colorHighlight || '#ffffff'),
            lowCut: params.lumaLow,
            highCut: params.lumaHigh
        };

        // --- PROCESS LOOP ---
        applyEffectLoop(data, w, h, params, factorContrast, palTonal, activePalette);
        tCtx.putImageData(imageData, 0, 0);

        // --- ROUNDING (Post-Process) ---
        if (params.roundness > 0) {
            // "Gooey" effect: Blur -> Threshold
            // Radius depends on resolution. 1.0 = ~2px blur?
            const blurRad = params.roundness * 2 * params.resolution;
            if (blurRad > 0.2) {
                // We need to draw the dithered pixels, blur them, then threshold back.
                // Draw back to temp Canvas? tCtx already has data.
                // Draw to 'ctx' (dest) then blur?

                // 1. Blur
                // Need a fresh context to blur?
                // Use 'ctx' as scratch? No, 'ctx' is destination size.
                // Blur on tCtx (Downscaled) gives better rounding relative to pixel grid.

                tCtx.filter = `blur(${blurRad}px)`;
                tCtx.globalCompositeOperation = 'source-over';
                tCtx.drawImage(tempCanvas, 0, 0); // Self-draw to blur?
                tCtx.filter = 'none';

                // 2. Threshold (Cutoff to make sharp edges again)
                // Access pixels again
                const pData = tCtx.getImageData(0, 0, w, h);
                const d = pData.data;
                const thresh = 120; // Cutoff

                for (let i = 0; i < d.length; i += 4) {
                    // Alpha thresholding or Luma?
                    // If knockout, Alpha.
                    // If solid, Luma.
                    // Simple Hard Cut
                    if (d[i + 3] < thresh) d[i + 3] = 0;
                    else d[i + 3] = 255; // Full binary alpha?

                    // What about Color?
                    // Provide 'posterize' effect on rgb too?
                    // Just alpha threshold makes "blobs".
                    // If we want "Rounded Pixels" inside the image, we need to blur color too?
                    // Yes, blur mixes colors.
                    // We need to snap colors back to Palette?
                    // That's expensive.
                    // "Rounding" usually softens the harsh dither squares.

                    // Optimized: Just Blur is "Soft Dither".
                    // Blur + Threshold is "Metaballs".

                    // Ensure full opacity if not knockout
                    if (!params.knockout) d[i + 3] = 255;
                }
                tCtx.putImageData(pData, 0, 0);
            }
        }

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(tempCanvas, 0, 0, width, height);
    },

    // --- GPU Support (Only supports Bayer/Ordered/Modulation) ---
    isGPUSupported: (params) => {
        const algo = params.algorithm;
        // Disabled GPU for now as Algo logic significantly diverged. 
        // Need to update Shaders to match new Thread/Bitwave logic later.
        return false;
    },

    shaderSource: `#version 300 es
    precision mediump float;
    
    in vec2 v_uv;
    uniform sampler2D u_image;
    uniform vec2 u_resolution; // Canvas size
    uniform float u_pixelScale; // Resolution factor (0.05 - 1.0)
    
    // Params
    uniform int u_mode; // 0=Tonal, 1=Grade
    uniform vec3 u_palLow;
    uniform vec3 u_palMid;
    uniform vec3 u_palHigh;

    uniform float u_contrast;
    uniform float u_spread;
    uniform int u_algo; // 0=None, 1=Bayer4, 2=Bayer8, 3=Modulation, 4=Stitched

    out vec4 outColor;

    // Bayer Matrices (Hardcoded)
    float bayer4(vec2 uv) {
        int x = int(mod(uv.x, 4.0));
        int y = int(mod(uv.y, 4.0));
        int idx = y * 4 + x;
        // 0-15 map
        float m = 0.0;
        if (idx == 0) m = 0.0; else if (idx == 1) m = 8.0; else if (idx == 2) m = 2.0; else if (idx == 3) m = 10.0;
        if (idx == 4) m = 12.0; else if (idx == 5) m = 4.0; else if (idx == 6) m = 14.0; else if (idx == 7) m = 6.0;
        if (idx == 8) m = 3.0; else if (idx == 9) m = 11.0; else if (idx == 10) m = 1.0; else if (idx == 11) m = 9.0;
        if (idx == 12) m = 15.0; else if (idx == 13) m = 7.0; else if (idx == 14) m = 13.0; else if (idx == 15) m = 5.0;
        return m / 16.0;
    }

    // ApproximatedBayer8 (Too large to switch-case, use texture or simple recursive math? 
    // Just use Bayer4 repeatedly or Modulation for speed. Let's stick to Bayer4 for V1 GPU)
    
    float stitched(vec2 uv) {
        int x = int(mod(uv.x, 4.0));
        int y = int(mod(uv.y, 4.0));
        float m = 4.0;
        if ((x==0 && y==1) || (x==2 && y==3)) m = 0.0; // Pattern approx
        // ... simplified logic from js:
        // mapStitch = [[4,0,4,0],[0,4,0,4]...]
        // (m - 2) * 10 
        
        bool evenRow = (int(mod(float(y), 2.0)) == 0);
        bool evenCol = (int(mod(float(x), 2.0)) == 0);
        
        if (evenRow == evenCol) m = 4.0; else m = 0.0;
        
        return ((m - 2.0)/2.0); // -1 to 1
    }

    vec3 rgb2rgb(vec3 c) { return c; }

    void main() {
        // Pixelate Coords
        vec2 dims = u_resolution * u_pixelScale;
        vec2 pixUV = floor(v_uv * dims) / dims;
        
        // Pixel Coord (Screen space for dither pattern)
        vec2 p = v_uv * dims;
        
        vec4 color = texture(u_image, pixUV);
        vec3 c = color.rgb;

        // Contrast
        if (u_contrast != 0.0) {
            float f = (259.0 * (u_contrast + 255.0)) / (255.0 * (259.0 - u_contrast));
            c = clamp(f * (c - 0.5) + 0.5, 0.0, 1.0);
        }

        // Bias
        float bias = 0.0;
        if (u_algo == 1) { // Bayer4
            bias = (bayer4(p) - 0.5) * u_spread; 
        } else if (u_algo == 3) { // Modulation
            bias = (sin(p.x * 0.5) * cos(p.y * 0.5)) * 0.1 * u_spread;
        } else if (u_algo == 4) { // Stitched
           bias = stitched(p) * 0.1 * u_spread;
        }

        c += bias;
        c = clamp(c, 0.0, 1.0);

        // Map
        if (u_mode == 0) { // Tonal
            float luma = dot(c, vec3(0.299, 0.587, 0.114));
            
            vec3 final;
            if (luma < 0.5) {
                final = mix(u_palLow, u_palMid, luma * 2.0);
            } else {
                final = mix(u_palMid, u_palHigh, (luma - 0.5) * 2.0);
            }
            outColor = vec4(final, 1.0);
        } else {
             // Grade
             outColor = vec4(c, 1.0);
        }
    }`,

    getUniforms: (params, width, height, scaleFactor = 1.0) => {
        let algo = 0;
        if (params.algorithm === 'bayer4') algo = 1;
        if (params.algorithm === 'bayer8') algo = 1; // Fallback to 4 for now in GPU
        if (params.algorithm === 'modulation') algo = 3;
        if (params.algorithm === 'stitched') algo = 4;

        // Hex to Vec3 0-1
        const toVec = (hex) => {
            const rgb = hexToRgb(hex);
            return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
        };

        return {
            u_resolution: [width, height],
            u_pixelScale: params.resolution, // This is technically 1.0 usually? No params.resolution acts as Downscale factor.
            u_contrast: params.contrast,
            u_spread: params.spread,
            u_mode: params.renderMode === 'tonal' ? 0 : 1,
            u_palLow: toVec(params.colorShadow),
            u_palMid: toVec(params.colorMid),
            u_palHigh: toVec(params.colorHighlight),
            u_algo: algo
        };
    }
};

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}

function applyEffectLoop(data, w, h, params, contrastF, palTonal, activePalette) {

    // Choose Algo Type
    const algo = params.algorithm;

    if (algo === 'none') {
        processSimple(data, w, h, params, contrastF, palTonal, activePalette);
        return;
    }

    // Pattern Based (Bayer, Modulation, Stitched)
    if (algo.startsWith('bayer') || ['grid', 'stitched', 'thread', 'bitwave', 'modulation'].includes(algo)) {
        processPattern(data, w, h, params, contrastF, palTonal, activePalette);
        return;
    }

    // Error Diffusion (Floyd, Atkinson, Sierra)
    let kernel = [];
    if (algo === 'floyd') {
        kernel = [
            { x: 1, y: 0, f: 7 / 16 },
            { x: -1, y: 1, f: 3 / 16 },
            { x: 0, y: 1, f: 5 / 16 },
            { x: 1, y: 1, f: 1 / 16 }
        ];
    } else if (algo === 'atkinson') {
        kernel = [
            { x: 1, y: 0, f: 1 / 8 }, { x: 2, y: 0, f: 1 / 8 },
            { x: -1, y: 1, f: 1 / 8 }, { x: 0, y: 1, f: 1 / 8 }, { x: 1, y: 1, f: 1 / 8 },
            { x: 0, y: 2, f: 1 / 8 }
        ];
    } else { // Sierra Lite
        kernel = [
            { x: 1, y: 0, f: 2 / 4 },
            { x: -1, y: 1, f: 1 / 4 }, { x: 0, y: 1, f: 1 / 4 }
        ];
    }

    processErrDiff(data, w, h, params, contrastF, palTonal, activePalette, kernel);
}

// === LOGIC HANDLERS ===

function processSimple(data, w, h, params, contrastF, palTonal, activePalette) {
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        const c = mapColor(r, g, b, params, contrastF, palTonal, activePalette);
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
        if (params.knockout && isShadow(c, palTonal, activePalette)) data[i + 3] = 0;
    }
}

function processPattern(data, w, h, params, contrastF, palTonal, activePalette) {
    const spread = params.spread || 1.0;
    const algo = params.algorithm;

    // Bayer Maps
    const map4 = [
        [0, 8, 2, 10], [12, 4, 14, 6],
        [3, 11, 1, 9], [15, 7, 13, 5]
    ];
    const mapContainer = {
        map4: map4,
        map8: [
            [0, 48, 12, 60, 3, 51, 15, 63],
            [32, 16, 44, 28, 35, 19, 47, 31],
            [8, 56, 4, 52, 11, 59, 7, 55],
            [40, 24, 36, 20, 43, 27, 39, 23],
            [2, 50, 14, 62, 1, 49, 13, 61],
            [34, 18, 46, 30, 33, 17, 45, 29],
            [10, 58, 6, 54, 9, 57, 5, 53],
            [42, 26, 38, 22, 41, 25, 37, 21]
        ],
        stitch: [
            [4, 0, 4, 0], [0, 4, 0, 4], [4, 0, 4, 0], [0, 4, 0, 4]
        ],
        thread: [
            [10, 0, 10, 0], [0, 10, 0, 10], [10, 0, 10, 0], [0, 10, 0, 10]
        ]
    };

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            let r = data[i], g = data[i + 1], b = data[i + 2];

            // Calc Threshold Bias
            let bias = 0;

            if (algo === 'grid') { // Grid Modulation
                bias = (Math.sin(x * 0.8) + Math.cos(y * 0.8)); // Cross-hatchy
                bias = bias * 24 * spread;
            } else if (algo === 'bitwave') { // Bitwave
                // Use Sine logic but quantified to create "Bits" or steps
                const wv = Math.sin((x + y) * 0.2) * 5 + Math.cos(x * 0.1) * 3;
                bias = wv * 8 * spread;
            } else if (algo === 'modulation') {
                bias = Math.sin(x * 0.5) * Math.cos(y * 0.5);
                bias = bias * 32 * spread;
            } else if (algo === 'stitched') {
                let m = mapContainer.stitch[y % 4][x % 4];
                bias = (m - 2) * 10 * spread;
            } else if (algo === 'thread') {
                // Diagonal stripes or Linear lines
                let m = (x + y) % 4 === 0 ? 8 : -8;
                bias = m * 2 * spread;
            } else if (algo === 'bayer4') {
                let m = mapContainer.map4[y % 4][x % 4];
                bias = ((m / 16) - 0.5) * 64 * spread;
            } else if (algo === 'bayer8') {
                let m = mapContainer.map8[y % 8][x % 8];
                bias = ((m / 64) - 0.5) * 64 * spread;
            }

            const c = mapColor(r + bias, g + bias, b + bias, params, contrastF, palTonal, activePalette);

            data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
            if (params.knockout && isShadow(c, palTonal, activePalette)) data[i + 3] = 0;
        }
    }
}


function processErrDiff(data, w, h, params, contrastF, palTonal, activePalette, kernel) {
    const bleeding = params.bleeding || 0.0;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;

            let r = data[i], g = data[i + 1], b = data[i + 2];

            // Map Logic returns closest color
            const c = mapColor(r, g, b, params, contrastF, palTonal, activePalette);

            data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
            if (params.knockout && isShadow(c, palTonal, activePalette)) data[i + 3] = 0;

            // Error Diffusion
            const er = r - c[0];
            const eg = g - c[1];
            const eb = b - c[2];

            // If bleeding > 0, we can amplify error or smooth it.
            // Bleeding usually means ink spreading into neighbors.
            // In error diffusion, this might mean distributing MORE error or DISTRIBUTING to more pixels.
            // Simple approach: Amplify error by (1 + bleeding)
            // Or use a larger kernel?
            // "Bleed" in ink terms often means blurring. 
            // In Dither context, maybe it means Random Error?
            // Let's implement: Error Amplify.
            const factor = 1.0 + (bleeding * 0.5);

            for (let k = 0; k < kernel.length; k++) {
                distribute(data, x + kernel[k].x, y + kernel[k].y, er * factor, eg * factor, eb * factor, kernel[k].f, w);
            }
        }
    }
}

// === CORE MAPPING ===

function mapColor(r, g, b, params, contrastF, pal, activePalette) {
    // 1. GRADE MODE
    if (params.renderMode === 'grade' && activePalette) {
        // Find Closest in Palette
        if (params.contrast !== 0) {
            r = factor(r, contrastF);
            g = factor(g, contrastF);
            b = factor(b, contrastF);
        }
        return ColorQuantizer.findClosest([r, g, b], activePalette);
    }

    // 2. TONAL MODE
    if (params.renderMode === 'tonal') {
        let luma = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luma < 0) luma = 0; if (luma > 255) luma = 255;

        // Custom Thresholds from Luma Handles
        const low = pal.lowCut || 60;
        const high = pal.highCut || 190;

        // Split Range: 0 -> Low (Shadow), Low -> High (Mid), High -> 255 (High)

        if (luma < low) {
            // Lerp Shadow -> Mid
            let t = luma / low; // 0 to 1
            return lerpColor(pal.shadow, pal.mid, t);
        } else if (luma < high) {
            // Lerp Mid -> High
            let t = (luma - low) / (high - low);
            return lerpColor(pal.mid, pal.high, t);
        } else {
            // Solid Highlight (or lerp to white if we wanted 4 stops)
            // Currently just 3 stops: Shadow..Mid..Highlight
            // If we are above High, we essentially stay at Highlight or push to pure white?
            // "Highlights" -> pal.high
            // Actually usually Tone map is gradient. 
            // If luma > high, we just return pal.high
            return pal.high;
        }
    }
    return [r, g, b];
}

// Helpers
function lerpColor(c1, c2, t) {
    return [
        c1[0] + (c2[0] - c1[0]) * t,
        c1[1] + (c2[1] - c1[1]) * t,
        c1[2] + (c2[2] - c1[2]) * t
    ];
}

function distribute(data, x, y, er, eg, eb, f, w) {
    if (x < 0 || x >= w) return;
    const idx = (y * w + x) * 4;
    // Safe check
    if (idx >= data.length) return;
    data[idx] = clamp(data[idx] + er * f);
    data[idx + 1] = clamp(data[idx + 1] + eg * f);
    data[idx + 2] = clamp(data[idx + 2] + eb * f);
}

function factor(v, f) {
    return clamp(f * (v - 128) + 128);
}

function clamp(v) { return v < 0 ? 0 : (v > 255 ? 255 : v); }

function isShadow(c, pal, activePalette) {
    // In Grade mode, we can't easily guess shadow unless we mark it.
    // In Tonal, pal.shadow is defined.
    if (pal && pal.shadow) {
        return c[0] === pal.shadow[0] && c[1] === pal.shadow[1] && c[2] === pal.shadow[2];
    }
    return false;
}
