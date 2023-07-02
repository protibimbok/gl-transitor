import { easeOutSine } from './ease';

const VERTICES = new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]);
interface TextureInfo {
    texture: WebGLTexture;
    height: number;
    width: number;
}

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

export class ShaderTransition {
    protected TEXTURE_CACHE = new Map<string, WebGLTexture>();

    //@ts-expect-error idk
    protected gl: WebGLRenderingContext;
    protected program?: WebGLProgram;

    protected fromImage?: HTMLImageElement;
    protected toImage?: HTMLImageElement;

    // @ts-expect-error saad
    protected canvas: HTMLCanvasElement;

    protected stopFrame = false;

    protected currentProgram = 0;
    protected programs: WebGLProgram[];
    protected effects: string[];

    constructor(effects: string | string[]) {
        if (typeof effects === 'string') {
            this.effects = [effects];
        } else {
            if (effects.length === 0) {
                throw new Error('[shader-animation]: No effect is registered!');
            }
            this.effects = effects;
        }
        this.programs = Array(this.effects.length);
    }

    public static withCanvas(
        canvas: string | HTMLCanvasElement,
        effects: string | string[]
    ): ShaderTransition {
        return new ShaderTransition(effects).setCanvas(canvas);
    }

    public setCanvas(canvas: string | HTMLCanvasElement): ShaderTransition {
        if (typeof canvas === 'string') {
            canvas = document.querySelector(canvas) as HTMLCanvasElement;
        }

        if (!canvas || canvas.tagName !== 'CANVAS') {
            throw new Error(
                "[shader-animation]: 'canvas' argument does not point to an <canvas> element!"
            );
        }
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl') as WebGLRenderingContext;
        this.effects.forEach((effect, i) => {
            this.programs[i] = this.initProgram(effect);
        });
        this.program = this.programs[0];
        return this;
    }

    public from(from: string | HTMLImageElement): ShaderTransition {
        // Ensure the from argument is an <img> element
        if (typeof from === 'string') {
            from = document.querySelector(from) as HTMLImageElement;
        }
        if (!from || from.tagName !== 'IMG') {
            throw new Error(
                "[shader-animation]: 'from' argument does not point to an <img> element!"
            );
        }

        this.fromImage = from;

        const rect = from.getBoundingClientRect();
        this.canvas.height = rect.height;
        this.canvas.width = rect.width;
        this.canvas.style.height = rect.height + 'px';
        this.canvas.style.width = rect.width + 'px';

        return this;
    }

    public to(to: HTMLImageElement, duration = 1000, reverse = false) {
        if (!this.fromImage) {
            throw new Error('[shader-animation]: Invalid from image!');
        }
        if (!to.complete || to.naturalHeight === 0) {
            throw new Error('[shader-animation]: Invalid to image!');
        }
        return this.animate(
            this.imageToTexture(this.fromImage),
            this.imageToTexture(to),
            duration,
            reverse
        );
    }

    public animate(
        from: TextureInfo,
        to: TextureInfo,
        duration = 1000,
        reverse = false
    ) {
        if (this.programs.length > 1) {
            // console.time('Finding Program:');
            this.currentProgram = Math.floor(
                Math.random() * this.programs.length
            );
            this.program = this.programs[this.currentProgram];
            this.gl.useProgram(this.program);
            // console.timeEnd('Finding Program:');
        }
        if (reverse) {
            const tmp = to;
            to = from;
            from = tmp;
        }
        return new Promise((resolve: (value?: unknown) => void) => {
            this.updateUniforms(from, to);
            this.render(reverse ? 1 : 0);
            const startTime = Date.now();
            let progress = 0.0;
            this.stopFrame = false;

            const frame = () => {
                this.render(reverse ? 1 - progress : progress);
                const timeProgress = (Date.now() - startTime) / duration;
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

    public stop(): ShaderTransition {
        this.stopFrame = true;
        return this;
    }

    protected initProgram(fragment: string): WebGLProgram {
        if (!this.gl) {
            throw new Error('[shader-animation]: No canvas is provided!');
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
                '[shader-animation]: Vertex Shader compilation error:\n' +
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
                '[shader-animation]: Fragment Shader compilation error:\n' +
                    gl.getShaderInfoLog(fragmentShader)
            );
        }

        const program = gl.createProgram() as WebGLProgram;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(
                '[shader-animation]: Program error:\n' +
                    gl.getProgramInfoLog(program)
            );
        }

        return program;
    }

    protected updateUniforms(from: TextureInfo, to: TextureInfo) {
        // console.time('Uniforms:');
        if (!this.program) {
            throw new Error('[shader-animation]: No program is set!');
        }

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

    protected imageToTexture(image: HTMLImageElement): TextureInfo {
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
}

export class ShaderTransitionArray extends ShaderTransition {
    protected textures = new Map<string, TextureInfo>();
    protected images: HTMLImageElement[] = [];

    protected active = 0;

    protected disposed = false;

    public static init(
        canvas: string | HTMLCanvasElement,
        effects: string | string[],
        images: HTMLImageElement[]
    ): ShaderTransitionArray {
        const instance = new ShaderTransitionArray(effects);
        instance.setCanvas(canvas);

        instance.images = Array(images.length);
        const rect = instance.canvas.getBoundingClientRect();
        instance.canvas.height = rect.height;
        instance.canvas.width = rect.width;

        images.forEach((img, i) => {
            if (img.complete && img.naturalHeight > 0) {
                handleImageLoad();
            } else {
                img.addEventListener('load', handleImageLoad, { once: true });
            }

            function handleImageLoad() {
                if (instance.disposed) {
                    return;
                }
                instance.images[i] = img;
                if (i === 0) {
                    instance.stop();
                    instance.from(img).to(img);
                }
            }
        });

        return instance;
    }

    public async toIndex(to: number, duration = 1000): Promise<number> {
        const old = this.active;
        this.active = to % this.images.length;
        if (this.active < 0) {
            this.active += this.images.length;
        }

        const fKey = `${old}-${this.currentProgram}`;
        const tKey = `${this.active}-${this.currentProgram}`;
        let from = this.textures.get(fKey);
        if (!from) {
            from = this.imageToTexture(this.images[old]);
            this.textures.set(fKey, from);
        }
        let toTex = this.textures.get(tKey);
        if (!toTex) {
            toTex = this.imageToTexture(this.images[this.active]);
            this.textures.set(tKey, toTex);
        }

        await this.animate(from, toTex, duration, old > to);

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
        this.images = [];
        this.textures.clear();
        this.disposed = true;
    }
}
