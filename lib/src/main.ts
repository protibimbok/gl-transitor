import { easeOutSine } from './ease';
import { fragment } from './shaders/fly-eye';

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
uniform vec2 tSize1;
uniform vec2 tSize2;

varying vec2 vUv;
varying vec2 uv;
varying vec2 uv1;
varying vec2 uv2;

varying vec2 size1;
varying vec2 size2;

varying vec4 position;
varying vec2 resolution;

vec2 fittedUv(vec2 imageSize, vec2 uv, vec2 resolution) {
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

void main() {
  vUv = (pos + 1.0) / 2.0;
  uv = vec2(vUv.x, 1.0 - vUv.y);
  uv1 = fittedUv(tSize1, uv, res);
  uv2 = fittedUv(tSize2, uv, res);

  size1 = tSize1;
  size2 = tSize2;

  resolution = res;
  position = vec4(pos, 0, 1.0);

  gl_Position = position;
}
`;

const fragmentVars = `
precision highp float;
uniform float progress;
uniform sampler2D texture1;
uniform sampler2D texture2;

varying vec2 vUv;
varying vec2 uv;
varying vec2 uv1;
varying vec2 uv2;
varying vec2 size1;
varying vec2 size2;
varying vec4 position;

varying vec2 resolution;

vec2 fittedUv(vec2 imageSize, vec2 uv, vec2 resolution) {
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


`;

export class ShaderTransition {
    //@ts-expect-error idk
    protected gl: WebGLRenderingContext;
    //@ts-expect-error idk
    protected program: WebGLProgram;

    //@ts-expect-error idk
    protected texture1: TextureInfo;
    //@ts-expect-error idk
    protected texture2: TextureInfo;
    //@ts-expect-error idk
    protected canvas: HTMLCanvasElement;

    protected stopFrame = false;

    public static withCanvas(
        canvas: string | HTMLCanvasElement
    ): ShaderTransition {
        return new ShaderTransition().setCanvas(canvas);
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
        this.initProgram();
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

        this.texture1 = this.imageToTexture(from);

        const rect = from.getBoundingClientRect();
        this.canvas.height = rect.height;
        this.canvas.width = rect.width;
        this.canvas.style.height = rect.height + 'px';
        this.canvas.style.width = rect.width + 'px';

        return this;
    }

    public toTexture(to: TextureInfo, duration = 1000, reverse = false) {
        if (reverse) {
            this.texture2 = this.texture1;
            this.texture1 = to;
        } else {
            this.texture2 = to;
        }
        return new Promise((resolve: (value?: unknown) => void) => {
            this.updateUniforms();
            this.render(reverse?1:0);
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

    public to(image: string | HTMLImageElement, duration = 1000, reverse = false) {
        if (!this.texture1) {
            throw new Error('[shader-animation]: No initial image is given!');
        }
        if (typeof image === 'string') {
            return new Promise((resolve) => {
                this.loadTexture(image).then((res) => {
                    this.toTexture(res).then(resolve);
                });
            });
        }
        return this.toTexture(this.imageToTexture(image), duration, reverse);
    }

    public stop(): ShaderTransition {
        this.stopFrame = true;
        return this;
    }

    protected initProgram() {
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
            throw new Error('Shader compilation error:\n' + gl.getShaderInfoLog(vertexShader));
        }

        const fragmentShader = gl.createShader(
            gl.FRAGMENT_SHADER
        ) as WebGLShader;
        gl.shaderSource(fragmentShader, fragmentVars + fragment);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw new Error('Shader compilation error:\n' + gl.getShaderInfoLog(fragmentShader));
        }


        const program = (this.program = gl.createProgram() as WebGLProgram);
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Shader compilation error:\n' + gl.getProgramInfoLog(program));
        }


        gl.useProgram(program);
    }

    protected updateUniforms() {
        const gl = this.gl;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        const positionLocation = gl.getAttribLocation(this.program, 'pos');
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        const texture1L = gl.getUniformLocation(this.program, 'texture1');
        gl.uniform1i(texture1L, 0); // Texture unit 0
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture1.texture);

        const size1L = gl.getUniformLocation(this.program, 'tSize1');
        gl.uniform2f(size1L, this.texture1.width, this.texture1.height);

        const texture2L = gl.getUniformLocation(this.program, 'texture2');
        gl.uniform1i(texture2L, 1); // Texture unit 1
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.texture2.texture);

        const size2L = gl.getUniformLocation(this.program, 'tSize2');
        gl.uniform2f(size2L, this.texture2.width, this.texture2.height);

        const resolutionL = gl.getUniformLocation(this.program, 'res');
        gl.uniform2f(resolutionL, this.canvas.width, this.canvas.height);
    }

    protected render(progress: number) {
        const gl = this.gl;

        const progressL = gl.getUniformLocation(this.program, 'progress');
        gl.uniform1f(progressL, progress);

        // Draw our 3 VERTICES as 1 triangle
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    protected loadTexture(image: string): Promise<TextureInfo> {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = image;
            img.onload = () => {
                resolve(this.imageToTexture(img));
            };
        });
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
    protected textures: TextureInfo[] = [];

    protected active = 0;

    protected disposed = false;

    public static init(
        canvas: string | HTMLCanvasElement,
        images: HTMLImageElement[]
    ): ShaderTransitionArray {
        const instance = new ShaderTransitionArray();
        instance.setCanvas(canvas);

        instance.textures = Array(images.length);
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
                instance.textures[i] = instance.imageToTexture(img);
                if (i === 0) {
                    instance.stop();
                    instance.texture1 = instance.textures[0];
                    instance.texture2 = instance.textures[0];
                    instance.updateUniforms();
                    instance.render(1);
                }
            }
        });

        return instance;
    }

    public async toIndex(to: number, duration = 1000): Promise<number> {
        const old = this.active;
        this.active = to % this.textures.length;
        if (this.active < 0) {
            this.active += this.textures.length;
        }

        this.texture1 = this.textures[old];
        await this.toTexture(this.textures[this.active], duration, old > to);

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
