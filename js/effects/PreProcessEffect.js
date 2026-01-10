/**
 * PreProcessEffect - Image preparation suite
 * Includes: Levels, Color (Hue/Sat/Bright/Invert), Sharpen, Noise, Blur
 */
export const PreProcessEffect = {
    name: "IMAGE PRE-PROCESS",
    id: "preprocess_v1",
    description: "Adjust Levels, Color Grading, Sharpen, and Noise.",

    params: {
        enabled: false,
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
        invert: false,
        invertMode: 'normal', // 'normal', 'luma', 'hue'
        intensity: 0, // Vibrance/Pop -100 to 100
    },

    getControls: (builder, params, onUpdate) => {
        const group = builder.createModuleGroup("IMAGE PRE-PROCESS", (enabled) => onUpdate('enabled', enabled), params.enabled, PreProcessEffect.description);

        if (true) {
            group.addSlider("BLUR RADIUS", 0, 20, params.blurRadius, 0.5, (v) => onUpdate('blurRadius', v), "Softens image details (Blur).");
            group.addSlider("SHARPEN %", 0, 100, params.sharpenAmount, 1, (v) => onUpdate('sharpenAmount', v), "Enhances edge definition.");
            group.addSlider("NOISE / GRAIN", 0, 100, params.noiseAmount, 1, (v) => onUpdate('noiseAmount', v), "Adds film grain texture.");

            group.addDescription("LEVELS ADJUSTMENT");
            group.addSlider("LEVELS BLACK", 0, 255, params.levelBlack, 1, (v) => onUpdate('levelBlack', v), "Sets the black point threshold (Darkens).");
            group.addSlider("LEVELS WHITE", 0, 255, params.levelWhite, 1, (v) => onUpdate('levelWhite', v), "Sets the white point threshold (Brightens).");
            group.addSlider("GAMMA", 0.1, 5.0, params.gamma, 0.1, (v) => onUpdate('gamma', v), "Adjusts mid-tone brightness.");

            group.addDescription("COLOR GRADING");
            group.addSlider("SATURATION %", 0, 200, params.saturation, 1, (v) => onUpdate('saturation', v), "Color intensity (0 = B&W).");
            group.addSlider("BRIGHTNESS", -100, 100, params.brightness, 1, (v) => onUpdate('brightness', v), "Global image brightness.");
            group.addSlider("HUE SHIFT", -180, 180, params.hue, 1, (v) => onUpdate('hue', v), "Rotates colors around the wheel.");
            group.addSlider("INTENSITY (Vibrance)", -100, 100, params.intensity, 1, (v) => onUpdate('intensity', v), "Smart saturation protecting skin tones.");

            group.addToggle("INVERT ENABLED", params.invert, (v) => onUpdate('invert', v), "Invert colors (Negative).");
            if (params.invert) {
                group.addSelect("INVERT MODE", [
                    { label: "Normal (Negative)", value: 'normal' },
                    { label: "Smart Luma (Preserve Color)", value: 'luma' },
                    { label: "Smart Hue (Complementary)", value: 'hue' }
                ], params.invertMode, (v) => onUpdate('invertMode', v), "Inversion Mode: Negative, Luma only, or Hue.");
            }
        }
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
        const invMode = params.invertMode || 'normal';
        const intensity = params.intensity; // Logic: Adaptive Saturation adjustment

        // Helpers for HSL
        const rgbToHsl = (r, g, b) => {
            r /= 255; g /= 255; b /= 255;
            let max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;
            if (max == min) h = s = 0;
            else {
                let d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            return [h, s, l];
        };

        const hslToRgb = (h, s, l) => {
            let r, g, b;
            if (s === 0) r = g = b = l;
            else {
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
                r = hue2rgb(p, q, h + 1 / 3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1 / 3);
            }
            return [r * 255, g * 255, b * 255];
        };

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

            // 2c. Invert & Color Logic
            // Complex color ops require HSL conversion
            // Trigger if: Hue, Saturation, Invert (Smart), or Intensity

            let needsHSL = (hueShift !== 0 || satMult !== 1.0 || (invert && invMode !== 'normal') || intensity !== 0);

            if (invert && invMode === 'normal') {
                r = 255 - r;
                g = 255 - g;
                b = 255 - b;
            }

            if (needsHSL) {
                let [h, s, l] = rgbToHsl(r, g, b);

                // Hue Shift
                if (hueShift !== 0) {
                    h += hueShift / 360;
                    if (h > 1) h -= 1; else if (h < 0) h += 1;
                }

                // Saturation (Global)
                s *= satMult;

                // Intensity / Vibrance
                // Vibrance boosts lower saturation colors more than high saturation
                if (intensity !== 0) {
                    const v = intensity / 100;
                    if (v > 0) {
                        s += (1 - s) * v * 0.5; // Boost
                    } else {
                        s += s * v; // Reduce
                    }
                }

                // Smart Invert
                if (invert) {
                    if (invMode === 'luma') {
                        l = 1.0 - l; // Invert Lightness, Keep Hue/Sat
                    } else if (invMode === 'hue') {
                        h = (h + 0.5) % 1.0; // Rotate Hue 180, Keep Lightness
                        // Usually complementary colors
                    }
                }

                // Clamp
                s = Math.max(0, Math.min(1, s));
                l = Math.max(0, Math.min(1, l));

                let rgb = hslToRgb(h, s, l);
                r = rgb[0]; g = rgb[1]; b = rgb[2];
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
