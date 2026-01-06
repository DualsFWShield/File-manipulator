/**
 * PreProcessEffect - Image preparation suite
 * Includes: Levels, Color (Hue/Sat/Bright/Invert), Sharpen, Noise, Blur
 */
export const PreProcessEffect = {
    name: "IMAGE PRE-PROCESS",
    id: "preprocess_v1",
    description: "Adjust Levels, Color Grading, Sharpen, and Noise.",

    params: {
        enabled: true,
        // Blur
        blurRadius: 0, // 0-20
        // Sharpen
        sharpenAmount: 0, // 0-100%
        // Noise
        noiseAmount: 0, // 0-100%
        // Levels
        levelBlack: 0, // 0-255
        levelWhite: 255, // 0-255
        gamma: 1.0, // 0.1 - 3.0
        // Color
        saturation: 100, // %
        brightness: 0,
        hue: 0, // -180 to 180
        invert: false
    },

    getControls: (builder, params, onUpdate) => {
        const group = builder.createModuleGroup("PRE-PROCESSING", (enabled) => onUpdate('enabled', enabled), PreProcessEffect.description);

        // LEVELS
        group.addSlider("LEVELS BLACK", 0, 255, params.levelBlack, 1, (v) => onUpdate('levelBlack', v));
        group.addSlider("LEVELS WHITE", 0, 255, params.levelWhite, 1, (v) => onUpdate('levelWhite', v));
        group.addSlider("GAMMA", 0.1, 3.0, params.gamma, 0.1, (v) => onUpdate('gamma', v));

        // COLOR
        group.addSlider("SATURATION %", 0, 200, params.saturation, 5, (v) => onUpdate('saturation', v));
        group.addSlider("BRIGHTNESS", -100, 100, params.brightness, 1, (v) => onUpdate('brightness', v));
        group.addSlider("HUE SHIFT", -180, 180, params.hue, 5, (v) => onUpdate('hue', v));
        group.addToggle("INVERT COLORS", params.invert, (v) => onUpdate('invert', v));

        // DETAIL
        group.addSlider("BLUR RADIUS", 0, 20, params.blurRadius, 0.5, (v) => onUpdate('blurRadius', v));
        group.addSlider("SHARPEN %", 0, 100, params.sharpenAmount, 5, (v) => onUpdate('sharpenAmount', v));
        group.addSlider("NOISE / GRAIN", 0, 100, params.noiseAmount, 1, (v) => onUpdate('noiseAmount', v));
    },

    process: (ctx, width, height, params, scaleFactor = 1.0) => {
        if (!params.enabled) return;

        // 1. BLUR (Context Filter - Fast)
        if (params.blurRadius > 0) {
            ctx.filter = `blur(${params.blurRadius * scaleFactor}px)`;
            ctx.drawImage(ctx.canvas, 0, 0);
            ctx.filter = 'none';
        }

        // 2. PIXEL MANIPULATION (Levels, Color, Noise)
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const len = data.length;

        // Optimization: Pre-calc Gamma LUT
        const gammaLUT = new Uint8Array(256);
        const black = params.levelBlack;
        const white = params.levelWhite;
        const gamma = params.gamma;

        for (let i = 0; i < 256; i++) {
            let n = (i - black) / (white - black);
            if (n < 0) n = 0; else if (n > 1) n = 1;
            n = Math.pow(n, 1 / gamma);
            gammaLUT[i] = Math.floor(n * 255);
        }

        const noise = params.noiseAmount * 2.55;
        const satMult = params.saturation / 100;
        const bright = params.brightness;
        const hueShift = params.hue;
        const invert = params.invert;

        // Hue rotation helper (approximate for speed or full RGB->HSL->RGB?)
        // Full HSL is better for "Hue Shift". 
        // We can pre-calculate a cos/sin matrix for Hue rotation if Saturation is also handled?
        // Let's use a per-pixel conversion for V1 correctness.

        for (let i = 0; i < len; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // 2a. Levels & Gamma
            r = gammaLUT[gammaLUT[r] ? r : r]; // Safety check if r out of bounds? No r is uint8.
            // Actually `r` is index. `gammaLUT[r]`
            r = gammaLUT[r];
            g = gammaLUT[g];
            b = gammaLUT[b];

            // 2b. Brightness
            r += bright; g += bright; b += bright;

            // 2c. Invert
            if (invert) {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
            }

            // 2d. Hue & Saturation
            // Only expensive math if needed
            if (hueShift !== 0 || satMult !== 1.0) {
                // RGB to HSL
                let R = r / 255, G = g / 255, B = b / 255;
                let max = Math.max(R, G, B), min = Math.min(R, G, B);
                let h, s, l = (max + min) / 2;

                if (max === min) {
                    h = s = 0;
                } else {
                    let d = max - min;
                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                    switch (max) {
                        case R: h = (G - B) / d + (G < B ? 6 : 0); break;
                        case G: h = (B - R) / d + 2; break;
                        case B: h = (R - G) / d + 4; break;
                    }
                    h /= 6;
                }

                // Modify H & S
                h += hueShift / 360;
                if (h > 1) h -= 1;
                if (h < 0) h += 1;
                s *= satMult;

                // HSL to RGB
                let r1, g1, b1;
                if (s === 0) {
                    r1 = g1 = b1 = l;
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1 / 6) return p + (q - p) * 6 * t;
                        if (t < 1 / 2) return q;
                        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                        return p;
                    };
                    let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    let p = 2 * l - q;
                    r1 = hue2rgb(p, q, h + 1 / 3);
                    g1 = hue2rgb(p, q, h);
                    b1 = hue2rgb(p, q, h - 1 / 3);
                }
                r = r1 * 255;
                g = g1 * 255;
                b = b1 * 255;
            }

            // 2e. Noise
            if (noise > 0) {
                const n = (Math.random() - 0.5) * noise;
                r += n; g += n; b += n;
            }

            // Clamp
            data[i] = r < 0 ? 0 : (r > 255 ? 255 : r);
            data[i + 1] = g < 0 ? 0 : (g > 255 ? 255 : g);
            data[i + 2] = b < 0 ? 0 : (b > 255 ? 255 : b);
        }

        ctx.putImageData(imageData, 0, 0);

        // 3. SHARPEN (Convolution)
        if (params.sharpenAmount > 0) {
            // Simple 3x3 Sharpen Kernel
            // [  0 -1  0 ]
            // [ -1  5 -1 ]
            // [  0 -1  0 ]
            // Weighted by strength

            const strength = params.sharpenAmount / 100;

            // To be faster in JS:
            // pixel = original + (original - blurry) * strength?
            // "Unsharp Mask" is usually cleaner than convolution kernel.
            // We can do Unsharp Mask using the same trick as before but correctly mixed.

            const temp = document.createElement('canvas');
            temp.width = width;
            temp.height = height;
            const tCtx = temp.getContext('2d', { willReadFrequently: true });

            // Draw current state (Original)
            tCtx.drawImage(ctx.canvas, 0, 0);

            const original = tCtx.getImageData(0, 0, width, height);

            // Blur it slightly
            tCtx.filter = `blur(1px)`; // Fixed radius 1px usually enough for fine sharpen
            tCtx.clearRect(0, 0, width, height);
            tCtx.drawImage(ctx.canvas, 0, 0);
            tCtx.filter = 'none';

            const blurred = tCtx.getImageData(0, 0, width, height);

            const oDat = original.data;
            const bDat = blurred.data;
            const resDat = ctx.getImageData(0, 0, width, height); // Target
            const rDat = resDat.data;

            for (let i = 0; i < oDat.length; i += 4) {
                // High Pass = Original - Blurred
                // Result = Original + HighPass * Strength

                let r = oDat[i];
                let g = oDat[i + 1];
                let b = oDat[i + 2];

                let rB = bDat[i];
                let gB = bDat[i + 1];
                let bB = bDat[i + 2];

                rDat[i] = r + (r - rB) * strength * 2.5; // Multiply for more "kick"
                rDat[i + 1] = g + (g - gB) * strength * 2.5;
                rDat[i + 2] = b + (b - bB) * strength * 2.5;
            }
            ctx.putImageData(resDat, 0, 0);
        }
    }
};
