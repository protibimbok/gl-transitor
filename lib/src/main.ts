import { easeOutSine } from './ease';

const VERTICES = new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]);
interface TextureInfo {
    texture: WebGLTexture;
    height: number;
    width: number;
}

type AnimateArg =
    | string
    | HTMLImageElement
    | {
          url: string;
      };

const vertex = `
precision highp float;

attribute vec2 pos;

uniform vec2 res;

varying vec2 vUv;
varying vec2 uv;

varying vec4 position;
varying vec2 resolution;


void main() {
  resolution = res;
  position = vec4(pos, 0, 1.0);

  
  vUv = (pos + 1.0) / 2.0;
  uv = vec2(vUv.x, 1.0 - vUv.y);

  gl_Position = position;
}
`;

const fragmentVars = `
precision highp float;
uniform float progress;
uniform sampler2D texture1;
uniform sampler2D texture2;
uniform vec2 size1;
uniform vec2 size2;

varying vec2 vUv;
varying vec2 uv;
varying vec4 position;

varying vec2 resolution;

vec2 getUv(vec2 imageSize, vec2 uv) {
    float tR = imageSize.x / imageSize.y;
    float vR = resolution.x / resolution.y;

    if (tR > vR) {
        float scale = (vR * imageSize.y) / imageSize.x;
        return vec2(uv.x * scale + (1.0 - scale) / 2.0, uv.y);
    } else {
        float scale = (imageSize.x / vR) / imageSize.y;
        return vec2(uv.x, uv.y * scale + (1.0 - scale) / 2.0);
    }
}

vec2 getUv1(vec2 uv) {
    return getUv(size1, uv);
}

vec2 getUv2(vec2 uv) {
    return getUv(size2, uv);
}
`;

export class GLTransitor {
    protected TEXTURE_CACHE = new Map<string, WebGLTexture>();

    protected gl: WebGLRenderingContext;
    protected program: WebGLProgram;

    protected canvas: HTMLCanvasElement;

    protected stopFrame = false;

    protected currentProgram = 0;
    protected programs: WebGLProgram[];
    /**
     * Configurations
     */
    protected DURATION = 1000;
    protected REVERSE = false;

    constructor(
        canvas: string | HTMLCanvasElement,
        effects: string | string[]
    ) {
        if (typeof canvas === 'string') {
            canvas = document.querySelector(canvas) as HTMLCanvasElement;
        }

        if (!canvas || canvas.tagName !== 'CANVAS') {
            throw new Error(
                "[gl-transitor]: 'canvas' argument does not point to an <canvas> element!"
            );
        }
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl') as WebGLRenderingContext;

        if (typeof effects === 'string') {
            effects = [effects];
        } else if (effects.length === 0) {
            throw new Error('[gl-transitor]: No effect is registered!');
        }

        this.programs = Array(effects.length);

        effects.forEach((effect, i) => {
            this.programs[i] = this.initProgram(effect);
        });

        this.program = this.programs[0];
        this.gl.useProgram(this.program);
    }

    public static init(
        canvas: string | HTMLCanvasElement,
        effects: string | string[]
    ): GLTransitor {
        return new GLTransitor(canvas, effects);
    }

    public animate(from: AnimateArg, to: AnimateArg) {
        //TODO: Implement this method;
        throw new Error('Not implemented yet!');
    }

    public animateTexture(from: TextureInfo, to: TextureInfo) {
        if (this.programs.length > 1) {
            // console.time('Finding Program:');
            this.currentProgram = Math.floor(
                Math.random() * this.programs.length
            );
            this.program = this.programs[this.currentProgram];
            this.gl.useProgram(this.program);
            // console.timeEnd('Finding Program:');
        }
        if (this.REVERSE) {
            const tmp = to;
            to = from;
            from = tmp;
        }
        return new Promise((resolve: (value?: unknown) => void) => {
            this.updateUniforms(from, to);
            this.render(this.REVERSE ? 1 : 0);
            const startTime = Date.now();
            let progress = 0.0;
            this.stopFrame = false;

            const frame = () => {
                this.render(this.REVERSE ? 1 - progress : progress);
                const timeProgress = (Date.now() - startTime) / this.DURATION;
                progress = easeOutSine(timeProgress);
                if (timeProgress <= 1) {
                    if (!this.stopFrame) {
                        requestAnimationFrame(frame);
                    }
                } else {
                    resolve();
                }
            };
            frame();
        });
    }

    public stop(): GLTransitor {
        this.stopFrame = true;
        return this;
    }

    public setDuration(duration: number): GLTransitor {
        this.DURATION = duration;
        return this;
    }

    public setReverse(reverse: boolean): GLTransitor {
        this.REVERSE = reverse;
        return this;
    }

    public createTexture(image: HTMLImageElement): TextureInfo {
        const gl = this.gl;
        const texture = gl.createTexture() as WebGLTexture;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        return {
            texture,
            height: image.naturalHeight,
            width: image.naturalWidth,
        };
    }

    protected initProgram(fragment: string): WebGLProgram {
        if (!this.gl) {
            throw new Error('[gl-transitor]: No canvas is provided!');
        }
        const gl = this.gl;
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, VERTICES, gl.STATIC_DRAW);

        // Compile the shaders

        const vertexShader = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
        gl.shaderSource(vertexShader, vertex);
        gl.compileShader(vertexShader);

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw new Error(
                '[gl-transitor]: Vertex Shader compilation error:\n' +
                    gl.getShaderInfoLog(vertexShader)
            );
        }

        const fragmentShader = gl.createShader(
            gl.FRAGMENT_SHADER
        ) as WebGLShader;
        gl.shaderSource(fragmentShader, fragmentVars + fragment);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw new Error(
                '[gl-transitor]: Fragment Shader compilation error:\n' +
                    gl.getShaderInfoLog(fragmentShader)
            );
        }

        const program = gl.createProgram() as WebGLProgram;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(
                '[gl-transitor]: Program error:\n' +
                    gl.getProgramInfoLog(program)
            );
        }

        return program;
    }

    protected updateUniforms(from: TextureInfo, to: TextureInfo) {
        // console.time('Uniforms:');
        const gl = this.gl;

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        const positionLocation = gl.getAttribLocation(this.program, 'pos');
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        const texture1L = gl.getUniformLocation(this.program, 'texture1');
        gl.uniform1i(texture1L, 0); // Texture unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, from.texture);

        const size1L = gl.getUniformLocation(this.program, 'size1');
        gl.uniform2f(size1L, from.width, from.height);

        const texture2L = gl.getUniformLocation(this.program, 'texture2');
        gl.uniform1i(texture2L, 1); // Texture unit 1
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, to.texture);

        const size2L = gl.getUniformLocation(this.program, 'size2');
        gl.uniform2f(size2L, to.width, to.height);

        const resolutionL = gl.getUniformLocation(this.program, 'res');
        gl.uniform2f(resolutionL, this.canvas.width, this.canvas.height);
        // console.timeEnd('Uniforms:');
    }

    protected render(progress: number) {
        const gl = this.gl;

        const progressL = gl.getUniformLocation(
            this.program as WebGLProgram,
            'progress'
        );
        gl.uniform1f(progressL, progress);

        // Draw our 3 VERTICES as 1 triangle
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

export class GLTransitorArray extends GLTransitor {
    protected textures: TextureInfo[] = [];

    protected active = 0;

    protected disposed = false;

    public static withImages(
        canvas: string | HTMLCanvasElement,
        effects: string | string[],
        images: HTMLImageElement[]
    ): GLTransitorArray {
        const ins = new GLTransitorArray(canvas, effects);
        ins.setImages(images);
        return ins;
    }

    public setImages(images: HTMLImageElement[]): GLTransitorArray {
        this.textures = Array(images.length);
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.height = rect.height;
        this.canvas.width = rect.width;

        images.forEach((img, i) => {
            const handleImageLoad = () => {
                if (this.disposed) {
                    return;
                }
                const texture = (this.textures[i] = this.createTexture(img));
                if (i === 0) {
                    this.stop();
                    this.updateUniforms(texture, texture);
                    this.render(0);
                }
            };
            if (img.complete && img.naturalHeight > 0) {
                handleImageLoad();
            } else {
                img.addEventListener('load', handleImageLoad, { once: true });
            }
        });

        return this;
    }

    public async toIndex(to: number): Promise<number> {
        const old = this.active;
        this.active = to % this.textures.length;
        if (this.active < 0) {
            this.active += this.textures.length;
        }
        this.setReverse(old > to);
        await this.animateTexture(
            this.textures[old],
            this.textures[this.active]
        );

        return this.active;
    }

    public next(): Promise<number> {
        return this.toIndex(this.active + 1);
    }

    public prev(): Promise<number> {
        return this.toIndex(this.active - 1);
    }

    public dispose() {
        this.stop();
        this.textures = [];
        this.disposed = true;
    }
}
