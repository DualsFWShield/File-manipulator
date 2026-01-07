/**
 * WebGLManager - Handles GL Context, Shader Compilation, and Basic Quad Rendering.
 */
export class WebGLManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, alpha: false });
        
        if (!this.gl) {
            console.warn("WebGL2 not supported, falling back to CPU.");
            this.isSupported = false;
            return;
        }

        this.isSupported = true;
        this.programs = {};
        this.currentProgram = null;
        
        // Setup simple Quad
        this.initQuad();
    }

    initQuad() {
        const gl = this.gl;
        // Full screen triangle strip quad
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1,
        ]);
        
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }

    createProgram(name, fragSource) {
        const gl = this.gl;
        
        // Standard Vertex Shader (Pass-through with UV calc)
        const vertSource = `#version 300 es
        in vec2 a_position;
        out vec2 v_uv;
        void main() {
            v_uv = a_position * 0.5 + 0.5;
            // Flip Y for standard texture coords if needed, usually webgl matches logic
            v_uv.y = 1.0 - v_uv.y; 
            gl_Position = vec4(a_position, 0.0, 1.0);
        }`;

        const vert = this.compileShader(gl.VERTEX_SHADER, vertSource);
        const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSource);

        if (!vert || !frag) return false;

        const program = gl.createProgram();
        gl.attachShader(program, vert);
        gl.attachShader(program, frag);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(`Program Link Error (${name}):`, gl.getProgramInfoLog(program));
            return false;
        }

        this.programs[name] = program;
        return true;
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error("Shader Compile Error:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    useProgram(name) {
        if (this.programs[name]) {
            this.currentProgram = this.programs[name];
            this.gl.useProgram(this.currentProgram);
            
            // Bind Quad
            const posLoc = this.gl.getAttribLocation(this.currentProgram, "a_position");
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
            this.gl.enableVertexAttribArray(posLoc);
            this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);
            return true;
        }
        return false;
    }

    setUniform(name, type, value) {
        if (!this.currentProgram) return;
        const gl = this.gl;
        const loc = gl.getUniformLocation(this.currentProgram, name);
        if (loc === null) return; // Warning optimized out

        switch(type) {
            case '1f': gl.uniform1f(loc, value); break;
            case '2f': gl.uniform2f(loc, value[0], value[1]); break;
            case '3f': gl.uniform3f(loc, value[0], value[1], value[2]); break;
            case '1i': gl.uniform1i(loc, value); break;
        }
    }

    uploadTexture(imageOrVideo) {
        const gl = this.gl;
        if (!this.texture) {
            this.texture = gl.createTexture();
        }
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        
        // Parameters
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        // Upload
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageOrVideo);
    }

    draw() {
        const gl = this.gl;
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
