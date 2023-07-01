import { easeOutSine } from './ease';
import { fragment, vertex } from './shaders/gooey';

const VERTICES = new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]);

export class ShaderTransition {
    //@ts-expect-error idk
    protected gl: WebGLRenderingContext;
    //@ts-expect-error idk
    protected program: WebGLProgram;

    //@ts-expect-error idk
    protected texture1: WebGLTexture;
    //@ts-expect-error idk
    protected texture2: WebGLTexture;
    //@ts-expect-error idk
    protected fromEl: HTMLImageElement;
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

        this.fromEl = from;
        this.texture1 = this.imageToTexture(this.fromEl);

        const rect = this.fromEl.getBoundingClientRect();
        this.canvas.height = rect.height;
        this.canvas.width = rect.width;
        this.canvas.style.height = rect.height + 'px';
        this.canvas.style.width = rect.width + 'px';

        return this;
    }

    public toTexture(to: WebGLTexture) {
        this.texture2 = to;
        return new Promise((resolve: (value?: unknown) => void) => {
            this.gl.viewport(
                0,
                0,
                this.gl.drawingBufferWidth,
                this.gl.drawingBufferHeight
            );
            this.render(0);
            const duration = 1000;
            const startTime = Date.now();
            let progress = 0.0;
            this.stopFrame = false;

            const frame = () => {
                this.render(progress);
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

    public to(image: string | HTMLImageElement) {
        if (!this.fromEl) {
            throw new Error('[shader-animation]: No initial image is given!');
        }
        if (typeof image === 'string') {
            return new Promise((resolve) => {
                this.loadTexture(image).then((res) => {
                    this.toTexture(res).then(resolve);
                });
            });
        }
        return this.toTexture(this.imageToTexture(image));
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

        const fragmentShader = gl.createShader(
            gl.FRAGMENT_SHADER
        ) as WebGLShader;
        gl.shaderSource(fragmentShader, fragment);
        gl.compileShader(fragmentShader);

        const program = (this.program = gl.createProgram() as WebGLProgram);
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        gl.useProgram(program);
        
    }

    protected render(progress: number) {
        const gl = this.gl;
        const positionLocation = gl.getAttribLocation(this.program, 'position');
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        const texture1L = gl.getUniformLocation(this.program, 'texture1');
        const texture2L = gl.getUniformLocation(this.program, 'texture2');
        const progressL = gl.getUniformLocation(this.program, 'progress');
        gl.uniform1i(texture1L, 0); // Texture unit 0
        gl.uniform1i(texture2L, 1); // Texture unit 1
        gl.uniform1f(progressL, progress);

        // Bind the textures to the respective texture units
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.texture2);

        // Draw our 3 VERTICES as 1 triangle
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    protected loadTexture(image: string): Promise<WebGLTexture> {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = image;
            img.onload = () => {
                resolve(this.imageToTexture(img));
            };
        });
    }

    protected imageToTexture(image: HTMLImageElement): WebGLTexture {
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
        return texture;
    }
}

export class ShaderTransitionArray extends ShaderTransition {
    protected textures: WebGLTexture[] = [];

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
            instance.loadTexture(img.src).then((texture) => {
                if (instance.disposed) {
                    return;
                }
                instance.textures[i] = texture;
                if (i === 0 ) {
                    instance.stop();
                    instance.toIndex(0);
                }
            });
        });

        return instance;
    }

    public toIndex(to: number): Promise<unknown> {
        const old = this.active;
        this.active = to % this.textures.length;
        if (this.active < 0) {
            this.active += this.textures.length;
        }

        this.texture1 = this.textures[old];
        return this.toTexture(this.textures[this.active]);
    }

    public next(): Promise<unknown> {
        return this.toIndex(this.active + 1);
    }

    public prev(): Promise<unknown> {
        return this.toIndex(this.active - 1);
    }

    public dispose() {
        this.stop();
        this.textures = [];
        this.disposed = true;
    }
}
