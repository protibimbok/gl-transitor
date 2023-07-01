import { easeOutSine } from './ease';
import { fragment, vertex } from './shaders/gooey';

const VERTICES = new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]);

export class ShaderTransition {
    //@ts-expect-error idk
    private gl: WebGLRenderingContext;
    //@ts-expect-error idk
    private program: WebGLProgram;

    //@ts-expect-error idk
    private texture1: WebGLTexture;
    //@ts-expect-error idk
    private texture2: WebGLTexture;
    //@ts-expect-error idk
    private fromEl: HTMLImageElement;
    //@ts-expect-error idk
    private canvas: HTMLCanvasElement;

    private stopFrame = false;


    public static withCanvas(canvas: string | HTMLCanvasElement): ShaderTransition {
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
        
        const rect = this.fromEl.getBoundingClientRect();
        this.canvas.height = rect.height;
        this.canvas.width = rect.width;
        this.canvas.style.height = rect.height + 'px';
        this.canvas.style.width = rect.width + 'px';
        
        return this;
    }

    public to(image: string | HTMLImageElement) {
        if (!this.fromEl) {
            throw new Error('[shader-animation]: No initial image is given!');
        }

        return new Promise((resolve: (value?: unknown) => void) => {
            this.texture1 = this.imageToTexture(this.fromEl);
            this.gl.viewport(
                0,
                0,
                this.gl.drawingBufferWidth,
                this.gl.drawingBufferHeight
            );
            this.render(0);
            const duration = 1000;
            let startTime: number;
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

            if (typeof image === 'string') {
                this.loadTexture(image).then((res) => {
                    this.texture2 = res;
                    startTime = Date.now();
                    frame();
                });
            } else {
                this.texture2 = this.imageToTexture(image);
                startTime = Date.now();
                frame();
            }
        });
    }

    public stop(): ShaderTransition {
        this.stopFrame = true;
        return this;
    }

    private initProgram() {
        if (!this.gl) {
            throw new Error("[shader-animation]: No canvas is provided!");
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
        const compilationLog = gl.getShaderInfoLog(fragmentShader);
        console.log('Shader compiler log: ' + compilationLog);
        console.log(gl.getError());
        console.log(gl.getProgramInfoLog(program));
    }

    private render(progress: number) {
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

    private loadTexture(image: string): Promise<WebGLTexture> {
        return new Promise((resolve) => {
            this.fromEl.src = image;
            this.fromEl.onload = () => {
                resolve(this.imageToTexture(this.fromEl));
            };
        });
    }

    private imageToTexture(image: HTMLImageElement): WebGLTexture {
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
