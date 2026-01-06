# VOID - Multimedia Manipulation Suite

**VOID** is a browser-based, offline-first creative tool for applying retro, glitch, and aesthetic effects to Images and Audio. Built with the "0$ Stack" philosophy: Vanilla JavaScript, HTML5, and CSS3. No servers, no subscriptions, no build steps.

## 🎛️ CORE FEATURES

*   **Local Processing**: All effects run deeply inside your browser. No files are uploaded to any server.
*   **Real-Time Preview**: Immediate visual feedback (debounced for performance).
*   **Sample Library**: Integrated drag-and-drop samples for quick testing.
*   **Responsive UI**: Modern "Rack" interface with collapsible modules.

---

## 🖼️ IMAGE PROCESSOR (V1)

A complete non-destructive pipeline for texture generation and aesthetic rendering.

### 1. Pre-Processing (Preparation)
Prepare your image before destruction.
*   **Levels**: Full control over Black Point, White Point, and Gamma.
*   **Color Grading**: Adjust Saturation and Brightness.
*   **Detail**:
    *   **Blur**: Smooth out details before dithering.
    *   **Sharpen**: Enhance edges.
    *   **Noise**: Add film grain/texture.

### 2. Offset Printer (Halftone)
Simulate CMYK offset printing imperfections.
*   **Dot Size (DPI)**: Adjustable halftone dot scale (Scaling inputs for High-Res export).
*   **CMYK Angles**: Custom rotation for Cyan, Magenta, Yellow, and Black channels.
*   **Opacity**: Blend the halftone effect with the original image.

### 3. Dither & Tone Engine (The Core)
Quantize colors and apply retro shading patterns.
*   **Algorithms**:
    *   *Floyd-Steinberg* (Smooth diffusion)
    *   *Atkinson* (High contrast, Macintosh style)
    *   *Sierra Lite* (Fast, structured)
    *   *Bayer 4x4* & *Bayer 8x8* (Ordered grid patterns)
*   **Palettes**:
    *   **Full RGB**: Dither without losing color.
    *   **1-Bit B/W**: Pure Black & White threshold.
    *   **Gameboy**: Classic 4-green tints.
    *   **CGA**: Cyan/Magenta retro palette.
    *   **Sepia / Night Vision**: Stylized monochromatic looks.
    *   **Custom Tonal (NEW)**: Define your own **Shadow** and **Highlight** colors for true duotone branding.
*   **Controls**:
    *   **Resolution**: Downscale/Pixelate slider.
    *   **Contrast**: Hard contrast adjustment pre-dither.
    *   **Force Grayscale**: Override color palettes.

### 4. Glitch / Corruption
Digital signal destruction.
*   **RGB Shift**: Chromatic aberration separation.
*   **Scanlines**: CTR styling with adjustable height and opacity.
*   **Jitter**: Horizontal logic failure simulation.

---

## 🔊 AUDIO CRUSHER (V1)

A dedicated deck for audio destruction and format conversion.

### Deck Controls
*   **Playback**: Complete Play / Pause / Stop controls.
*   **Visualizer**: Real-time frequency bar graph.

### Effects
*   **Bitcrusher**: Reduce Bit Depth (1-16 bits) for crunchy, lo-fi textures.
*   **Sample Rate**: Reduce frequency for "underwater" or "telephone" artifacts.
*   **Gain**: Master output volume.

### Export
*   **Offline Rendering**: Does not require real-time playback. Renders the effect to a **.WAV** file instantly.
*   **Progress Indicator**: Button fills to show export status.

---

## 💾 EXPORT WORKFLOW

Robust tools for getting your creations out.

### Image Export
*   **IMG QUICK**: instantly save the implementation of the preview canvas (960px max).
*   **IMG FULL RES**: Re-process the original source file at **Original Resolution** with properly scaled effects (Dots and Glitches scale with resolution).

### Video Export
*   **REC / STOP Strategy**: Record infinite animations.
*   **VID QUICK**: Record the screen preview to WebM.
*   **VID FULL**: Record high-quality stream (WebM).
*   **Visual Feedback**: Buttons display "RECORDING..." animation during capture.

---

## 🛠️ TECH STACK
*   **Language**: Vanilla ES6+ JavaScript.
*   **Style**: CSS Variables, Flexbox/Grid (No Frameworks).
*   **Audio**: Web Audio API (ScriptProcessor & OfflineAudioContext).
*   **Storage**: Browser Memory (Zero Persistence).

> **Note**: This software is intended for creative exploration. High-resolution exports of >50MP images may require significant RAM.
