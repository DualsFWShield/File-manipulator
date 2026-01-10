/**
 * SeparationExporter.js
 * Generates individual layer separation images (masks) for each color in the palette.
 * Used for Screen Printing / Risograph workflows.
 */

import { ColorQuantizer } from './ColorQuantizer.js';
import { Palettes, getPaletteVec3 } from './Palettes.js';

export class SeparationExporter {
    constructor() { }

    /**
     * Generate Separations
     * @param {HTMLCanvasElement} sourceCanvas - The processed Dithered/Quantized image
     * @param {Object} params - Dither Params (to know the palette)
     * @returns {Promise<Object>} Map of { colorName: Blob }
     */
    static async generate(sourceCanvas, params) {
        // 1. Identify Palette
        let paletteColors = [];
        let paletteName = "Separation";

        if (params.renderMode === 'grade' && params.palette) {
            paletteName = params.palette;
            if (params.palette.startsWith('extract')) {
                // If extraction was used, we need to Re-Extract or rely on mapped pixels?
                // Problem: The canvas pixels are already quantized. 
                // We should scan the canvas and find unique colors?
                paletteColors = SeparationExporter.scanUniqueColors(sourceCanvas);
            } else {
                paletteColors = getPaletteVec3(params.palette);
            }
        } else if (params.renderMode === 'tonal') {
            // Tonal has 3 colors: Shadow, Mid, High
            // We should scan unique colors to be safe because simple mapping might be noisy?
            // "Tonal" is strict map, so 3 colors.
            paletteColors = [
                hexToRgb(params.colorShadow),
                hexToRgb(params.colorMid),
                hexToRgb(params.colorHighlight)
            ];
            paletteName = "TonalSplit";
        } else {
            // Standard RGB or Unknown
            throw new Error("Separation requires Grade or Tonal mode.");
        }

        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        const ctx = sourceCanvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const results = {};

        // 2. Process each color
        // For each palette color, create a B&W mask where black = pigment present
        // (Usually print masks are positive black)

        for (let idx = 0; idx < paletteColors.length; idx++) {
            const pColor = paletteColors[idx];
            const pName = `Layer_${idx + 1}_Hex_${rgbToHex(pColor)}`;

            const sepCanvas = document.createElement('canvas');
            sepCanvas.width = width;
            sepCanvas.height = height;
            const sCtx = sepCanvas.getContext('2d');

            // Create Mask Data
            const sepData = sCtx.createImageData(width, height);
            const sDat = sepData.data;

            // Loop pixels
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];

                // Check match (Tolerance small due to quantization noise potentially?)
                // Dither engine outputs exact colors in Grade mode usually.
                // But let's use Euclidean dist < 5
                const dist = Math.abs(r - pColor[0]) + Math.abs(g - pColor[1]) + Math.abs(b - pColor[2]);

                if (dist < 10) {
                    // Match -> Draw BLACK (Ink)
                    sDat[i] = 0; sDat[i + 1] = 0; sDat[i + 2] = 0; sDat[i + 3] = 255;
                } else {
                    // No Match -> Draw WHITE (Paper) or Transparent?
                    // Screen Maps are usually Black on White or Black on Transparent.
                    // Let's do Black Ink on Transparent.
                    sDat[i] = 255; sDat[i + 1] = 255; sDat[i + 2] = 255; sDat[i + 3] = 0;
                }
            }

            sCtx.putImageData(sepData, 0, 0);

            // Convert to Blob
            const blob = await new Promise(r => sepCanvas.toBlob(r, 'image/png'));
            results[pName] = blob;
        }

        return results;
    }

    static scanUniqueColors(canvas) {
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const colors = new Set();
        const result = [];

        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] < 128) continue;
            const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
            if (!colors.has(key)) {
                colors.add(key);
                result.push([data[i], data[i + 1], data[i + 2]]);
                if (colors.size > 64) break; // Safety limit
            }
        }
        return result;
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
}

function rgbToHex(c) {
    return ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1).toUpperCase();
}
