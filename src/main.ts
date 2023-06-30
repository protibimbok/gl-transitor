import { easeOutSine } from "./ease";
import { fragment, vertex } from "./shaders/gooey";
import "./style.css";

const VERTICES = new Float32Array([-1, -1, -1, 1, 1, 1, -1, -1, 1, 1, 1, -1]);

class ShaderTransition {
  //@ts-ignore
  private gl: WebGLRenderingContext;
  //@ts-ignore
  private program: WebGLProgram;
  //@ts-ignore

  //@ts-ignore
  private texture1: WebGLTexture;
  //@ts-ignore
  private texture2: WebGLTexture;
  //@ts-ignore
  private fromEl: HTMLImageElement;
  //@ts-ignore
  private canvas: HTMLCanvasElement;

  constructor(from: string | HTMLImageElement) {
    // Ensure the from argument is an <img> element
    if (typeof from === "string") {
      from = document.querySelector(from) as HTMLImageElement;
    }
    if (!from || from.tagName !== "IMG") {
      console.error(
        "[shader-animation]: 'from' argument does not point to an <img> element!"
      );
      return;
    }

    let canvas: HTMLCanvasElement =
      from.previousElementSibling as HTMLCanvasElement;
    if (!canvas || canvas.tagName !== "CANVAS") {
      canvas = document.createElement("canvas") as HTMLCanvasElement;
    }

    this.fromEl = from;
    this.canvas = canvas;
    this.canvas.style.display = "none";

    // Insert the canvas element

    from.parentElement?.insertBefore(canvas, from);

    const gl = (this.gl = canvas.getContext("webgl") as WebGLRenderingContext);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, VERTICES, gl.STATIC_DRAW);

    // Compile the shaders

    const vertexShader = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
    gl.shaderSource(vertexShader, vertex);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
    gl.shaderSource(fragmentShader, fragment);
    gl.compileShader(fragmentShader);

    const program = (this.program = gl.createProgram() as WebGLProgram);
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.useProgram(program);
    const compilationLog = gl.getShaderInfoLog(fragmentShader);
    console.log("Shader compiler log: " + compilationLog);
    console.log(gl.getError());
    console.log(gl.getProgramInfoLog(program));
  }

  public to(image: string) {
    const rect = this.fromEl.getBoundingClientRect();
    this.canvas.height = rect.height;
    this.canvas.width = rect.width;
    this.canvas.style.height = rect.height + "px";
    this.canvas.style.width = rect.width + "px";

    return new Promise(async (resolve: any) => {
      this.texture1 = this.imageToTexture(this.fromEl);
      this.canvas.style.display = "block";
      this.fromEl.style.display = "none";
      this.gl.viewport(
        0,
        0,
        this.gl.drawingBufferWidth,
        this.gl.drawingBufferHeight
      );
      this.render(0);

      this.texture2 = await this.loadTexture(image);

      const duration = 1000;
      const startTime = Date.now();
      let progress = 0.0;

      const frame = () => {
        this.render(progress);
        const timeProgress = (Date.now() - startTime) / duration;
        progress = easeOutSine(timeProgress);
        if (timeProgress <= 1) {
          requestAnimationFrame(frame);
        } else {
          this.canvas.style.display = "none";
          this.fromEl.style.display = "block";
          resolve();
        }
      };
      frame();
    });
  }

  private render(progress: number) {
    const gl = this.gl;
    const positionLocation = gl.getAttribLocation(this.program, "position");
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);

    const texture1L = gl.getUniformLocation(this.program, "texture1");
    const texture2L = gl.getUniformLocation(this.program, "texture2");
    const progressL = gl.getUniformLocation(this.program, "progress");
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

  private imageToTexture(image: HTMLImageElement) : WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture() as WebGLTexture;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return texture;
  }
}

function main() {
  const animator = new ShaderTransition("#image");
  const IMAGES = ["image-1.jpg", "image-2.jpg"];
  let index = 0;

  const next = () => {
    index++;
    index = index % IMAGES.length;
    animator.to(`/images/${IMAGES[index]}`);
  };
  window.addEventListener("click", next);
}

main();
