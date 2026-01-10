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
        const group = builder.createModuleGroup("CMYK HALFTONE", (enabled) => onUpdate('enabled', enabled), params.enabled, HalftoneEffect.description);

        if (true) {
            // Add controls for enabled state
            group.addSlider("DOT SIZE", 1, 20, params.scale, 1, (v) => onUpdate('scale', v), "Size of the halftone dots (DPI).");
            group.addSlider("OPACITY", 0, 1, params.opacity, 0.01, (v) => onUpdate('opacity', v), "Opacity of the halftone overlay.");
            group.addSlider("ANGLE CYAN", 0, 90, params.angleC, 1, (v) => onUpdate('angleC', v), "Screen angle for Cyan channel.");
            group.addSlider("ANGLE MAGENTA", 0, 90, params.angleM, 1, (v) => onUpdate('angleM', v), "Screen angle for Magenta channel.");
            group.addSlider("ANGLE YELLOW", 0, 90, params.angleY, 1, (v) => onUpdate('angleY', v), "Screen angle for Yellow channel.");
            group.addSlider("ANGLE BLACK", 0, 90, params.angleK, 1, (v) => onUpdate('angleK', v), "Screen angle for Black channel.");
        }
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
    },

    // --- GPU Support ---
    shaderSource: `#version 300 es
    precision mediump float;
    
    in vec2 v_uv;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    uniform float u_scale;
    uniform float u_opacity;
    uniform vec4 u_angles; // C, M, Y, K angles in degrees

    out vec4 outColor;

    #define PI 3.14159265359

    float pattern(vec2 uv, float angle, float scale) {
        float rad = radians(angle);
        float s = sin(rad);
        float c = cos(rad);
        vec2 point = vec2(
            uv.x * c - uv.y * s,
            uv.x * s + uv.y * c
        ) * scale;
        return (sin(point.x) * sin(point.y)) * 4.0; 
    }
    
    // Improved Dot Screen Function
    float dotScreen(vec2 uv, float angle, float scale) {
        float rad = radians(angle);
        float s = sin(rad);
        float c = cos(rad);
        vec2 p = (uv * u_resolution) - (u_resolution * 0.5); // Center
        
        // Rotate
        vec2 r = vec2(
            p.x * c - p.y * s,
            p.x * s + p.y * c
        );
        
        // Grid Cells
        vec2 nearest = floor(r / scale) * scale;
        vec2 dist = r - nearest; // -scale to scale? no 0 to scale
        vec2 center = vec2(scale * 0.5);
        
        // We need to sample color at the NEAREST grid center, but mapped back to UV
        vec2 unrotNearest = vec2(
            nearest.x * c + nearest.y * s,
             -nearest.x * s + nearest.y * c
        );
        vec2 samplePos = (unrotNearest + (u_resolution * 0.5)) / u_resolution;
        
        // Fix edges
        // samplePos = clamp(samplePos, 0.0, 1.0); // No, repeat 
        
        vec4 color = texture(u_image, samplePos);
        
        // Return channel intensity
        return 0.0; // Placeholder, logic below is cleaner
    }

    // Standard CMYK Halftone Shader Logic
    const vec2 center = vec2(0.5, 0.5);
    
    // Rotate 2D vector
    vec2 rotate(vec2 v, float a) {
        float s = sin(radians(a));
        float c = cos(radians(a));
        mat2 m = mat2(c, -s, s, c);
        return m * v;
    }

    void main() {
        vec4 color = texture(u_image, v_uv); // Current Pixel
        
        // CMYK Conversion
        float k = 1.0 - max(max(color.r, color.g), color.b);
        float c = (1.0 - color.r - k) / (1.0 - k);
        float m = (1.0 - color.g - k) / (1.0 - k);
        float y = (1.0 - color.b - k) / (1.0 - k);
        
        // Safety for pure black
        if (1.0 - k < 0.001) { c=0.0; m=0.0; y=0.0; }

        // Raster Pattern
        // Use fragCoord for pixel-perfect grids
        vec2 p = gl_FragCoord.xy; 
        
        float scale = max(2.0, u_scale); // Dot size in pixels
        
        // We evaluate Sine Dot Pattern: sin(x)*sin(y) > val means dot
        // Or Distance Field: length(fract(uv)-0.5) < val
        
        // Distance field approach gives cleaner dots
        
        // Process Cyan
        vec2 pC = rotate(p, u_angles.x);
        vec2 gridC = fract(pC / scale) - 0.5;
        float distC = length(gridC) * 2.0; // 0 to 1.414
        float dotC = (distC < (c * 0.9)) ? 1.0 : 0.0; // 0.9 to avoid touching
        
        // Process Magenta
        vec2 pM = rotate(p, u_angles.y);
        vec2 gridM = fract(pM / scale) - 0.5;
        float distM = length(gridM) * 2.0;
        float dotM = (distM < (m * 0.9)) ? 1.0 : 0.0;

        // Process Yellow
        vec2 pY = rotate(p, u_angles.z);
        vec2 gridY = fract(pY / scale) - 0.5;
        float distY = length(gridY) * 2.0;
        float dotY = (distY < (y * 0.9)) ? 1.0 : 0.0;
        
        // Process Black
        vec2 pK = rotate(p, u_angles.w);
        vec2 gridK = fract(pK / scale) - 0.5;
        float distK = length(gridK) * 2.0;
        float dotK = (distK < (k * 0.9)) ? 1.0 : 0.0;

        // Mix (Multiply)
        // Paper is white
        vec3 final = vec3(1.0);
        
        // Mix Cyan (0,1,1)
        if (dotC > 0.5) final *= vec3(0.0, 1.0, 1.0); 
        // Mix Magenta (1,0,1)
        if (dotM > 0.5) final *= vec3(1.0, 0.0, 1.0);
        // Mix Yellow (1,1,0)
        if (dotY > 0.5) final *= vec3(1.0, 1.0, 0.0);
        // Mix Black (0,0,0)
        if (dotK > 0.5) final *= vec3(0.0, 0.0, 0.0);
        
        // Opacity blend
        vec4 original = texture(u_image, v_uv);
        outColor = mix(original, vec4(final, 1.0), u_opacity);
    }`,

    getUniforms: (params, width, height, scaleFactor = 1.0) => {
        return {
            u_resolution: [width, height],
            u_scale: params.scale * scaleFactor,
            u_opacity: params.opacity,
            u_angles: [params.angleC, params.angleM, params.angleY, params.angleK]
        };
    }
};
