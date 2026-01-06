/**
 * HalftoneEffect - CMYK Offset Printing Effect
 */
export const HalftoneEffect = {
    name: "OFFSET_PRINT",
    id: "halftone_v1",
    description: "Simulate CMYK Offset Printing with adjustable dot size and angles.",

    params: {
        enabled: false,
        scale: 4, // Dot size
        angleC: 15,
        angleM: 75,
        angleY: 0,
        angleK: 45,
        opacity: 0.8
    },

    getControls: (builder, params, onUpdate) => {
        const group = builder.createModuleGroup("OFFSET PRINTER (CMYK)", (enabled) => onUpdate('enabled', enabled), HalftoneEffect.description);

        group.addSlider("DOT SIZE (DPI)", 1, 20, params.scale, 0.5, (v) => onUpdate('scale', v));
        group.addSlider("OPACITY", 0, 1.0, params.opacity, 0.05, (v) => onUpdate('opacity', v));

        group.addSlider("ANGLE CYAN", 0, 90, params.angleC, 1, (v) => onUpdate('angleC', v));
        group.addSlider("ANGLE MAGENTA", 0, 90, params.angleM, 1, (v) => onUpdate('angleM', v));
        group.addSlider("ANGLE YELLOW", 0, 90, params.angleY, 1, (v) => onUpdate('angleY', v));
        group.addSlider("ANGLE BLACK", 0, 90, params.angleK, 1, (v) => onUpdate('angleK', v));
    },

    process: (ctx, width, height, params, scaleFactor = 1.0) => {
        if (!params.enabled) return;

        // 1. Get Source Data
        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = width;
        srcCanvas.height = height;
        const sCtx = srcCanvas.getContext('2d');
        sCtx.drawImage(ctx.canvas, 0, 0);
        const imageData = sCtx.getImageData(0, 0, width, height);

        // 2. Clear Destination
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.globalCompositeOperation = 'multiply';

        const channels = [
            { color: '#00FFFF', angle: params.angleC, getVal: (r, g, b) => 255 - r },
            { color: '#FF00FF', angle: params.angleM, getVal: (r, g, b) => 255 - g },
            { color: '#FFFF00', angle: params.angleY, getVal: (r, g, b) => 255 - b },
            { color: '#000000', angle: params.angleK, getVal: (r, g, b) => (255 - Math.max(r, g, b)) }
        ];

        // Apply scaleFactor to the step for High-Res export consistency
        const scaledStep = params.scale * scaleFactor;
        const step = Math.max(2, scaledStep);

        channels.forEach(ch => {
            const layer = document.createElement('canvas');
            layer.width = width;
            layer.height = height;
            const lCtx = layer.getContext('2d');

            const rad = ch.angle * (Math.PI / 180);
            const sin = Math.sin(rad);
            const cos = Math.cos(rad);

            const diag = Math.sqrt(width * width + height * height);

            lCtx.fillStyle = ch.color;
            lCtx.globalAlpha = params.opacity;

            for (let y = -diag; y < diag; y += step) {
                for (let x = -diag; x < diag; x += step) {
                    const srcX = Math.floor(x * cos - y * sin + width / 2);
                    const srcY = Math.floor(x * sin + y * cos + height / 2);

                    if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
                        const i = (srcY * width + srcX) * 4;
                        const r = imageData.data[i];
                        const g = imageData.data[i + 1];
                        const b = imageData.data[i + 2];

                        const val = ch.getVal(r, g, b);

                        if (val > 10) {
                            const radius = (val / 255) * (step / 1.2);

                            const drawX = x * cos - y * sin + width / 2;
                            const drawY = x * sin + y * cos + height / 2;

                            lCtx.beginPath();
                            lCtx.arc(drawX, drawY, radius, 0, Math.PI * 2);
                            lCtx.fill();
                        }
                    }
                }
            }
            ctx.drawImage(layer, 0, 0);
        });

        ctx.globalCompositeOperation = 'source-over';
    }
};
