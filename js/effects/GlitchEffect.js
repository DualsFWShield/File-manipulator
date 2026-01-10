/**
 * GlitchEffect - Digital distortion effects
 */
export const GlitchEffect = {
    name: "DIGITAL GLITCH",
    id: "glitch_v1",
    description: "Digital signal corruption, RGB shifting, and CRT scanlines.",

    params: {
        enabled: false,
        rgbShift: 0, // 0 - 50px
        scanlines: 0, // 0 - 1.0 opacity
        scanlineSize: 2, // px
        jitter: 0, // 0 - 1.0 probability
        pixelSort: 0 // 0 - 1.0 threshold (experimental)
    },

    getControls: (builder, params, onUpdate) => {
        const group = builder.createModuleGroup("ERROR CORRUPTION", (enabled) => onUpdate('enabled', enabled), params.enabled, GlitchEffect.description);

        if (true) {
            group.addSlider("RGB SHIFT", 0, 50, params.rgbShift, 1, (v) => onUpdate('rgbShift', v), "Red/Blue channel offset (Chromatic Aberration).");
            group.addSlider("SCANLINE OPACITY", 0, 1.0, params.scanlines, 0.05, (v) => onUpdate('scanlines', v), "Opacity of CRT-style scanlines.");
            group.addSlider("SCANLINE HEIGHT", 1, 10, params.scanlineSize, 1, (v) => onUpdate('scanlineSize', v), "Thickness of scanlines.");
            group.addSlider("H-JITTER", 0, 1.0, params.jitter, 0.01, (v) => onUpdate('jitter', v), "Horizontal random displacement probability.");
        }
    },

    process: (ctx, width, height, params, scaleFactor = 1.0) => {
        if (!params.enabled) return;

        const scaledShift = Math.floor(params.rgbShift * scaleFactor);
        const scaledScanSize = Math.max(1, Math.floor(params.scanlineSize * scaleFactor));

        // --- 1. RGB SHIFT ---
        if (scaledShift > 0.5) {
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            const copy = new Uint8ClampedArray(data);

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = (y * width + x) * 4;

                    // Red Left
                    const xL = x - scaledShift;
                    if (xL >= 0) data[i] = copy[(y * width + xL) * 4];
                    else data[i] = 0;

                    // Blue Right
                    const xR = x + scaledShift;
                    if (xR < width) data[i + 2] = copy[(y * width + xR) * 4 + 2];
                    else data[i + 2] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);
        }

        // --- 2. JITTER ---
        if (params.jitter > 0) {
            const slices = 20;
            const maxShift = width * 0.1;
            for (let i = 0; i < slices; i++) {
                if (Math.random() > params.jitter) continue;
                const hSlice = Math.floor(height / slices);
                const y = i * hSlice;
                const hActual = Math.min(hSlice, height - y);
                const xShift = (Math.random() - 0.5) * maxShift;
                const strip = ctx.getImageData(0, y, width, hActual);
                ctx.putImageData(strip, xShift, y);
            }
        }

        // --- 3. SCANLINES ---
        if (params.scanlines > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${params.scanlines})`;
            for (let y = 0; y < height; y += scaledScanSize * 2) {
                ctx.fillRect(0, y, width, scaledScanSize);
            }
        }
    }
};
