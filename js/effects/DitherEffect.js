/**
 * DitherEffect - Optimized V2 with RGB support, Tonal & Grade Modes.
 */
export const DitherEffect = {
    name: "DITHER & TONE",
    id: "dither_v1",
    description: "Quantize colors and apply dithering patterns (Floyd-Steinberg, Bayer) with Retro Palettes.",

    params: {
        enabled: true,
        // Common
        resolution: 1.0,
        algorithm: 'floyd', // floyd, atkinson, sierra, bayer4, bayer8, modulation, stitched
        resampling: 'nearest', // 'nearest', 'preserve'

        // Mode: 'tonal' or 'grade'
        renderMode: 'tonal',

        // Tonal Mode Params
        // Luminance-based mapping
        // Logic: 3-Stop Gradient Map. Luma < 128 (Shadow->Mid), Luma > 128 (Mid->Highlight)
        colorShadow: '#000000',
        colorMid: '#808080',
        colorHighlight: '#ffffff',

        // Grade Mode Params
        // Color quantization
        colorSpace: 'indexed', // 'indexed', 'rgb'
        indexedCount: 16, // 2-64
        contrast: 0,

        // Algorithmic Tweaks
        spread: 1.0,  // For Grid/Pattern algorithms
        bleeding: 0.0, // Spread error deeper (for err diff) or blur dots (for pattern)
        roundness: 0.0, // Shaping for patterns (Not easily doable in 2D array loop, simulation via pre-blur of source?)

        // Advanced
        knockout: false, // Make background (Shadow color?) transparent
    },

    getControls: (builder, params, onUpdate) => {
        const group = builder.createModuleGroup("DITHERING ENGINE", (enabled) => onUpdate('enabled', enabled), DitherEffect.description);

        // --- MAIN RENDER SETTINGS ---
        group.addSelect("RENDER MODE", [
            { label: "TONAL (Luminance Map)", value: "tonal" },
            { label: "GRADE (Color Palette)", value: "grade" }
        ], params.renderMode, (v) => onUpdate('renderMode', v));

        group.addSelect("ALGORITHM", [
            { label: "None (Pixelate)", value: "none" },
            { label: "Floyd-Steinberg (Smooth)", value: "floyd" },
            { label: "Atkinson (High Contrast)", value: "atkinson" },
            { label: "Sierra Lite (Speed)", value: "sierra" },
            { label: "Bayer 4x4 (Grid)", value: "bayer4" },
            { label: "Bayer 8x8 (Fine)", value: "bayer8" },
            { label: "Modulation (Sine)", value: "modulation" },
            { label: "Stitched (Fabric)", value: "stitched" }
        ], params.algorithm, (v) => onUpdate('algorithm', v));

        group.addSlider("RESOLUTION / DPI", 0.05, 1.0, params.resolution, 0.05, (v) => onUpdate('resolution', v));
        // group.addSelect("RESAMPLING", [{label:"Nearest", value:'nearest'}, {label:"Preserve", value:'preserve'}], params.resampling, v=>onUpdate('resampling', v));

        // --- DYNAMIC CONTROLS ---
        if (params.renderMode === 'tonal') {
            // TONAL CONTROLS
            group.addDescription(group.content, "Map grayscale values to a custom 3-color gradient.");
            if (builder.addColor) {
                group.addColor("HIGHLIGHT (Light)", params.colorHighlight, (v) => onUpdate('colorHighlight', v));
                group.addColor("MIDTONE (Mid)", params.colorMid, (v) => onUpdate('colorMid', v));
                group.addColor("SHADOW (Dark)", params.colorShadow, (v) => onUpdate('colorShadow', v));
            }
        } else {
            // GRADE CONTROLS
            group.addDescription(group.content, "Reduce colors to a palette or RGB quantization.");
            group.addSelect("d-cs", [ // d-cs id helps avoiding key clashes? no UIBuilder doesn't use IDs
                { label: "INDEXED (Limited Palette)", value: 'indexed' },
                { label: "RGB (Channel Quant)", value: 'rgb' }
            ], params.colorSpace, (v) => onUpdate('colorSpace', v));

            if (params.colorSpace === 'indexed') {
                group.addSlider("COLORS COUNT", 2, 64, params.indexedCount, 1, (v) => onUpdate('indexedCount', v));
            }

            group.addSlider("CONTRAST", -100, 100, params.contrast, 1, (v) => onUpdate('contrast', v));
        }

        // --- ADVANCED ---
        if (params.algorithm.startsWith('bayer') || params.algorithm === 'modulation' || params.algorithm === 'stitched') {
            group.addSlider("SPREAD / BIAS", 0.1, 5.0, params.spread, 0.1, (v) => onUpdate('spread', v));
        }

        group.addToggle("KNOCKOUT BG", params.knockout, (v) => onUpdate('knockout', v));
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

        tCtx.imageSmoothingEnabled = params.resampling === 'preserve'; // "Preserve" ~ Bilinear? or Smart? Nearest is standard.
        tCtx.drawImage(ctx.canvas, 0, 0, w, h);

        const imageData = tCtx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const factorContrast = (259 * (params.contrast + 255)) / (255 * (259 - params.contrast));

        // Parse hex colors for Tonal Mode
        const palTonal = {
            shadow: hexToRgb(params.colorShadow || '#000000'),
            mid: hexToRgb(params.colorMid || '#808080'),
            high: hexToRgb(params.colorHighlight || '#ffffff')
        };

        // --- PROCESS LOOP ---
        applyEffectLoop(data, w, h, params, factorContrast, palTonal);

        tCtx.putImageData(imageData, 0, 0);

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(tempCanvas, 0, 0, width, height);
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

function applyEffectLoop(data, w, h, params, contrastF, palTonal) {

    // Choose Algo Type
    const algo = params.algorithm;

    if (algo === 'none') {
        processSimple(data, w, h, params, contrastF, palTonal);
        return;
    }

    // Pattern Based (Bayer, Modulation, Stitched)
    if (algo.startsWith('bayer') || algo === 'modulation' || algo === 'stitched') {
        processPattern(data, w, h, params, contrastF, palTonal);
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

    processErrDiff(data, w, h, params, contrastF, palTonal, kernel);
}

// === LOGIC HANDLERS ===

function processSimple(data, w, h, params, contrastF, palTonal) {
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        const c = mapColor(r, g, b, params, contrastF, palTonal);
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
        if (params.knockout && isShadow(c, palTonal)) data[i + 3] = 0;
    }
}

function processPattern(data, w, h, params, contrastF, palTonal) {
    const spread = params.spread || 1.0;
    const algo = params.algorithm;

    // Bayer Maps
    const map4 = [
        [0, 8, 2, 10], [12, 4, 14, 6],
        [3, 11, 1, 9], [15, 7, 13, 5]
    ];
    const map8 = [
        [0, 48, 12, 60, 3, 51, 15, 63],
        [32, 16, 44, 28, 35, 19, 47, 31],
        [8, 56, 4, 52, 11, 59, 7, 55],
        [40, 24, 36, 20, 43, 27, 39, 23],
        [2, 50, 14, 62, 1, 49, 13, 61],
        [34, 18, 46, 30, 33, 17, 45, 29],
        [10, 58, 6, 54, 9, 57, 5, 53],
        [42, 26, 38, 22, 41, 25, 37, 21]
    ];
    // Stitched Map (Approximation of woven lattice)
    const mapStitch = [
        [4, 0, 4, 0],
        [0, 4, 0, 4],
        [4, 0, 4, 0],
        [0, 4, 0, 4]
    ];

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            let r = data[i], g = data[i + 1], b = data[i + 2];

            // Calc Threshold Bias
            let bias = 0;

            if (algo === 'modulation') {
                // Sine Wave Pattern
                // Vertical lines modulated? Or Circular? Usually Frequency Modulation.
                // Simple version: Horiz Sine
                bias = Math.sin(x * 0.5) * Math.cos(y * 0.5);
                // Normalize -1 to 1 to dither range
                bias = bias * 32 * spread;
            } else if (algo === 'stitched') {
                let m = mapStitch[y % 4][x % 4]; // 0-4
                bias = (m - 2) * 10 * spread;
            } else if (algo === 'bayer4') {
                let m = map4[y % 4][x % 4]; // 0-15
                bias = ((m / 16) - 0.5) * 64 * spread;
            } else if (algo === 'bayer8') {
                let m = map8[y % 8][x % 8]; // 0-63
                bias = ((m / 64) - 0.5) * 64 * spread;
            }

            const c = mapColor(r + bias, g + bias, b + bias, params, contrastF, palTonal);

            data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
            if (params.knockout && isShadow(c, palTonal)) data[i + 3] = 0; // Simple knockout
        }
    }
}


function processErrDiff(data, w, h, params, contrastF, palTonal, kernel) {
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;

            let r = data[i], g = data[i + 1], b = data[i + 2];

            // Map Logic returns closest color
            const c = mapColor(r, g, b, params, contrastF, palTonal);

            data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
            if (params.knockout && isShadow(c, palTonal)) data[i + 3] = 0;

            const er = r - c[0];
            const eg = g - c[1];
            const eb = b - c[2];

            // Distribute
            for (let k = 0; k < kernel.length; k++) {
                distribute(data, x + kernel[k].x, y + kernel[k].y, er, eg, eb, kernel[k].f, w);
            }
        }
    }
}

// === CORE MAPPING ===

function mapColor(r, g, b, params, contrastF, pal) {
    // 1. Apply Contrast (only in Grade mode? Tonal maps luminance directly)
    // Actually Contrast helps define edges before dithering in both.
    if (params.renderMode === 'grade' && contrastF !== 0) {
        r = factor(r, contrastF);
        g = factor(g, contrastF);
        b = factor(b, contrastF);
    }

    // 2. TONAL MODE
    if (params.renderMode === 'tonal') {
        // Luminance map
        let luma = 0.299 * r + 0.587 * g + 0.114 * b;

        // Clamp input
        if (luma < 0) luma = 0; if (luma > 255) luma = 255;

        // Tri-color mapping: Shadow (0) <-> Mid (128) <-> High (255)
        // Lerp based on Luma
        if (luma < 128) {
            // Shadow -> Mid
            let t = luma / 128;
            return lerpColor(pal.shadow, pal.mid, t);
        } else {
            // Mid -> High
            let t = (luma - 128) / 127;
            return lerpColor(pal.mid, pal.high, t);
        }
    }

    // 3. GRADE MODE
    if (params.renderMode === 'grade') {
        if (params.colorSpace === 'indexed') {
            // Indexed Quantization (Poor man's palette generation)
            // Divide spectrum into N distinct values per channel?
            // No, "Indexed Colors" usually implies total palette size.
            // Fast "Posterize" approach:

            // Total colors = params.indexedCount.
            // We can quantize luminance? No, it's color.
            // Naive per-channel quantization to fit count^1/3?

            // Improved: Uniform Quantization (Posterize)
            // Levels = Cbrt(Count)? 
            // Let's just use strict stepping for R,G,B based on count to simulate palette.
            // 8 Colors = 2 levels per channel (2x2x2).
            // 27 Colors = 3 levels.
            // 64 Colors = 4 levels.

            let levels = Math.floor(Math.pow(params.indexedCount, 1 / 3));
            if (levels < 2) levels = 2;

            const step = 255 / (levels - 1);

            return [
                Math.round(r / step) * step,
                Math.round(g / step) * step,
                Math.round(b / step) * step
            ];
        } else {
            // RGB Mode - Full RGB but maybe dithered?
            // Just return color, dither engine adds noise/bias before this call usually.
            // Verify: mapColor is called AFTER adding bias in Pattern modes.
            // But in Error Diffusion, mapColor is the quantizer.

            // If algorithm is 'floyd' and palette is RGB... error diffusion in RGB?
            // Usually needs some quantization to make sense (e.g. Web Safe Colors, or 5-bit).
            // Let's quantize to 5-5-5 (32 levels) for "High Color" dither look.

            const step = 8; // 32 steps
            return [
                Math.round(r / step) * step,
                Math.round(g / step) * step,
                Math.round(b / step) * step
            ];
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

function isShadow(c, pal) {
    // Heuristic: Is strict equal to shadow color?
    return c[0] === pal.shadow[0] && c[1] === pal.shadow[1] && c[2] === pal.shadow[2];
}
