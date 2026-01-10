/**
 * Palettes.js
 * A collection of 20+ Retro and Stylistic Palettes for Dithering/Quantization.
 */

export const Palettes = {
    // --- MONOCHROME / 2-BIT ---
    'bw_1bit': {
        name: "1-Bit (Black & White)",
        colors: ['#000000', '#FFFFFF']
    },
    'gameboy': {
        name: "Gameboy (Original)",
        colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] // Darkest to Lighest
    },
    'gameboy_pocket': {
        name: "Gameboy Pocket",
        colors: ['#2e2e26', '#6e7b56', '#9bae76', '#c6d1a6']
    },
    'apple_ii_lo': {
        name: "Apple II (Lo-Res)",
        colors: ['#000000', '#7e2553', '#0000ab', '#ab00ab', '#00572e', '#5f574f', '#009aab', '#ab7d00', '#ab4d00', '#ba5f00', '#5f5f5f', '#ff7d7d', '#5fbe0d', '#ceff0d', '#00a3ff', '#ffffff']
        // Note: Apple II colors are complex artifacts, these are approximations.
    },

    // --- 3-BIT / 4-BIT RETRO ---
    'cga_0_low': {
        name: "CGA 0 (Low Intensity)",
        colors: ['#000000', '#00AA00', '#AA0000', '#AAAA00']
    },
    'cga_0_high': {
        name: "CGA 0 (High Intensity)",
        colors: ['#000000', '#55FF55', '#FF5555', '#FFFF55']
    },
    'cga_1_low': {
        name: "CGA 1 (Low Intensity)",
        colors: ['#000000', '#00AAAA', '#AA00AA', '#AAAAAA']
    },
    'cga_1_high': {
        name: "CGA 1 (High Intensity)",
        colors: ['#000000', '#55FFFF', '#FF55FF', '#FFFFFF']
    },
    'teletext': {
        name: "Teletext (BBC Micro)",
        colors: ['#000000', '#FF0000', '#00FF00', '#FFFF00', '#0000FF', '#FF00FF', '#00FFFF', '#FFFFFF']
    },
    'zx_spectrum': {
        name: "ZX Spectrum",
        colors: ['#000000', '#0000D7', '#D70000', '#D700D7', '#00D700', '#00D7D7', '#D7D700', '#D7D7D7',
            '#0000FF', '#FF0000', '#FF00FF', '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF'] // Brights included (actually 15 usually displayed)
    },
    'commodore_64': {
        name: "Commodore 64",
        colors: ['#000000', '#FFFFFF', '#880000', '#AAFFEE', '#CC44CC', '#00CC55', '#0000AA', '#EEEE77',
            '#DD8855', '#664400', '#FF7777', '#333333', '#777777', '#AAFF66', '#0088FF', '#BBBBBB']
    },
    'ega': {
        name: "EGA (Default)",
        colors: ['#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
            '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF']
    },
    'mac_system7': {
        name: "Mac System 7 (16)",
        colors: ['#FFFFFF', '#FCF305', '#FF6402', '#DD0806', '#F20884', '#4600A5', '#0000D4', '#02ABEA',
            '#1FB714', '#006411', '#562C05', '#90713A', '#C0C0C0', '#808080', '#404040', '#000000']
    },
    'msx': {
        name: "MSX",
        colors: ['#000000', '#000000', '#47b73b', '#74d07d', '#5955e0', '#8076f1', '#b95e51', '#65dbef',
            '#db6559', '#ff897d', '#ccc35e', '#ded087', '#3aa241', '#b766b5', '#cccccc', '#ffffff'] // Index 0 is transparent usually
    },

    // --- MODERN / FANTASY ---
    'pico8': {
        name: "PICO-8",
        colors: ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
            '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA']
    },
    'arne16': {
        name: "Arne 16",
        colors: ['#000000', '#9D9D9D', '#FFFFFF', '#BE2633', '#E06F8B', '#493C2B', '#A46422', '#EB8931',
            '#F7E26B', '#2F484E', '#44891A', '#A3CE27', '#1B2632', '#005784', '#31A2F2', '#B2DCEF']
    },
    'vaporwave': {
        name: "Vaporwave Aesthetic",
        colors: ['#000000', '#1c1137', '#2e2157', '#543685', '#b34ac2', '#e96dca', '#ff94e0', '#ffc7f1',
            '#00d2ff', '#3d6cb4', '#3192c7', '#63e2da', '#98ffcc', '#ffffff']
    },
    'cyberpunk': {
        name: "Cyberpunk Neon",
        colors: ['#06060c', '#131326', '#261836', '#59163e', '#9e0c39', '#ff003c', '#ff6e00', '#fcec0e',
            '#00ff66', '#00ccff', '#0022ff', '#6a00ff', '#bd00ff', '#ffffff']
    },
    'heatmap': {
        name: "Heatmap / Thermal",
        colors: ['#000000', '#000080', '#3e00b3', '#7e00db', '#be00cc', '#e6008a', '#ff1a40', '#ff6600', '#ffcc00', '#ffffcc', '#ffffff']
    },
    'blueprint': {
        name: "Blueprint",
        colors: ['#001133', '#002255', '#003377', '#004499', '#0055bb', '#0066dd', '#0077ff', '#4499ff', '#88bbff', '#ccddff', '#ffffff']
    },
    'sepia': {
        name: "Sepia / Old Photo",
        colors: ['#2e211b', '#4d3a2f', '#705746', '#8f7661', '#ad957e', '#ccb69e', '#ebd9c2', '#ffffff']
    },
    'matrix': {
        name: "Matrix Terminal",
        colors: ['#000000', '#0d3b0d', '#1a661a', '#299929', '#39cc39', '#4dff4d', '#ccffcc', '#ffffff']
    },
    'print_cmyk': {
        name: "CMYK (Process)",
        colors: ['#00ffff', '#ff00ff', '#ffff00', '#000000', '#ffffff']
    },
    'print_rgb': {
        name: "RGB (Primary)",
        colors: ['#ff0000', '#00ff00', '#0000ff', '#000000', '#ffffff']
    }
};

export const getPalette = (key) => Palettes[key] || Palettes['bw_1bit'];

export const hexToRgb = (hex) => {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
};

export const getPaletteVec3 = (key) => {
    const p = getPalette(key);
    return p.colors.map(hexToRgb);
}
