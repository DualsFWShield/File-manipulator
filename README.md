# VOID - Multimedia Manipulation Suite

**VOID** is a browser-based, offline-first creative tool for applying retro, glitch, and aesthetic effects to Images, Textures, Videos, and Audio. Built with the "0$ Stack" philosophy: Vanilla JavaScript, HTML5, and CSS3. No servers, no subscriptions, no build steps.

## 🎛️ CORE FEATURES

*   **Local Processing**: All effects run deeply inside your browser. No files are uploaded to any server.
*   **Real-Time Preview**: Immediate visual feedback (debounced for performance).
*   **Sample Library**: Integrated drag-and-drop samples for quick testing.
*   **Responsive UI**: Modern "Rack" interface with collapsible modules.

---

## 🖼️ IMAGE & VIDEO PROCESSOR (V1)

A complete non-destructive pipeline for texture generation, aesthetic rendering, and video processing.

### 1. Pre-Processing (Preparation)
Prepare your image before destruction.
*   **Levels**: Full control over Black Point, White Point, and Gamma.
*   **Color Grading**: Adjust Saturation, Brightness, and Hue Shift.
*   **Detail**:
    *   **Blur**: Smooth out details before dithering.
    *   **Sharpen**: Enhance edges.
    *   **Noise**: Add film grain/texture.

### 2. Offset Printer (Halftone)
Simulate CMYK offset printing imperfections.
*   **Dot Size (DPI)**: Adjustable halftone dot scale (Scaling inputs for High-Res export).
*   **CMYK Angles**: Custom rotation for Cyan, Magenta, Yellow, and Black channels.
*   **Opacity**: Blend the halftone effect with the original image.

### 3. Dither & Tone Engine (V1.5)
Quantize colors and apply retro shading patterns.
*   **Render Modes**:
    *   **TONAL (Luminance Map)**: Map brightness to 3 custom colors (Shadow, Midtone, Highlight).
    *   **GRADE (Color Palette)**: Quantize colors to specific palettes.
*   **Algorithms**:
    *   *Floyd-Steinberg* (Smooth diffusion)
    *   *Atkinson* (High contrast, Macintosh style)
    *   *Sierra Lite* (Fast, structured)
    *   *Bayer 4x4* & *8x8* (Ordered grid patterns)
    *   *Modulation* (Sine wave bands)
    *   *Stitched* (Cross-stitch fabric pattern)
*   **Advanced Controls**:
    *   **Spread**: Bias the dithering threshold.
    *   **Knockout**: Make background transparent.

### 4. Glitch / Corruption
Digital signal destruction.
*   **RGB Shift**: Chromatic aberration separation.
*   **Scanlines**: CTR styling with adjustable height and opacity.
*   **Jitter**: Horizontal logic failure simulation.

---

## �️ VIDEO & GIF SUPPORT

Apply the entire Image Processor pipeline to moving pictures.
*   **Formats**: Supports `.mp4` and `.gif` input.
*   **Playback**: Loop with Play / Pause controls.
*   **Frame-by-Frame Export**: 
    *   **WebM (VP9)**: High-quality, smooth 30 FPS export.
    *   **GIF**: Quantized 15 FPS export (256 colors).
    *   **Offline Rendering**: The system pauses playback and renders every frame sequentially, ensuring perfect fluidity regardless of your computer's speed.

---

## �🔊 AUDIO PROCESSOR (V2)

A dedicated deck for audio destruction and format conversion.

### Deck Controls
*   **Playback**: Complete Play / Pause / Stop controls.
*   **Visualizer**: Real-time frequency bar graph.

### Effects Chain
(Signal flows top to bottom)
1.  **Noise**: Additive White Noise generator with gain control.
2.  **Speed**: Playback rate / pitch control (0.1x - 2.0x).
3.  **Distortion**: Sigmoid wave shaper for aggressive saturation/overdrive.
4.  **Filter**: Resonant Lowpass Filter (Cutoff Hz & Resonance).
5.  **Bitcrusher**: 
    *   **Bit Depth**: 1-16 bits (Lo-fi crunch).
    *   **Sample Rate**: Frequency decimation (Aliasing artifacts).
6.  **Gain**: Master output volume.

### Export
*   **Offline Rendering**: Renders the complete effect chain to a **.WAV** file instantly.
*   **Progress Indicator**: Visual feedback during processing.

---

## 💾 EXPORT WORKFLOW

Robust tools for getting your creations out.

### Image Export
*   **IMG QUICK**: instantly save the implementation of the preview canvas.
*   **IMG FULL RES**: Re-process the original source file at **Original Resolution**.

### Video / GIF Export
Select your format via the dropdown: **[WEBM | GIF]**.
*   **VID QUICK**: Render at preview resolution.
*   **VID FULL RES**: Render at source video resolution (if possible) or high-quality canvas.
*   **Process**: Buttons show "RENDERING [FORMAT] frame X/Y..." during background export.

---

## 🛠️ TECH STACK
*   **Language**: Vanilla ES6+ JavaScript.
*   **Libraries (via CDN)**: 
    *   `webm-muxer` (WebM assembly)
    *   `gifenc` (GIF encoding)
*   **Audio**: Web Audio API (Nodes & OfflineContext).
*   **Video**: WebCodecs API (VideoEncoder).
*   **Storage**: Browser Memory (Zero Persistence).

> **Note**: This software is intended for creative exploration. High-resolution exports or long videos may require significant RAM.
