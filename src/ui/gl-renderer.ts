export class GLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private resolution: { w: number; h: number };
  private selection: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: 0, h: 0 };
  private isRecognizing: boolean = false;
  private distortionIntensity: number = 1.0;
  private positionBuffer: WebGLBuffer | null = null;
  private shaders: WebGLShader[] = [];

  // Cached locations
  private locations: {
    a_position: number;
    u_time: WebGLUniformLocation | null;
    u_resolution: WebGLUniformLocation | null;
    u_selection: WebGLUniformLocation | null;
    u_recognizing: WebGLUniformLocation | null;
    u_distortion_intensity: WebGLUniformLocation | null;
  } = {
    a_position: -1,
    u_time: null,
    u_resolution: null,
    u_selection: null,
    u_recognizing: null,
    u_distortion_intensity: null,
  };

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl");
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;
    this.resolution = { w: canvas.width, h: canvas.height };
    this.init();
  }

  public setSelection(x: number, y: number, w: number, h: number) {
    this.selection = { x, y, w, h };
  }

  public setRecognizing(state: boolean) {
    this.isRecognizing = state;
  }

  public setDistortionIntensity(intensity: number) {
    this.distortionIntensity = intensity;
  }

  private init() {
    const vsSource = `
            attribute vec2 a_position;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_position * 0.5 + 0.5;
                v_texCoord.y = 1.0 - v_texCoord.y;
            }
        `;

    const fsSource = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_time;
            uniform vec2 u_resolution;
            uniform vec4 u_selection;
            uniform bool u_recognizing;
            uniform float u_distortion_intensity;
            
            void main() {
                vec2 uv = v_texCoord;
                vec2 fragCoord = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
                
                bool hasSelection = u_selection.z > 0.0 && u_selection.w > 0.0;
                bool inSelection = false;
                
                if (hasSelection) {
                    if (fragCoord.x >= u_selection.x && fragCoord.x <= u_selection.x + u_selection.z &&
                        fragCoord.y >= u_selection.y && fragCoord.y <= u_selection.y + u_selection.w) {
                        inSelection = true;
                    }
                }
                
                if (hasSelection && !inSelection) {
                    // Outside selection: Darkened and slightly desaturated
                    vec4 color = texture2D(u_image, uv);
                    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    vec3 darkened = mix(color.rgb, vec3(gray), 0.5) * 0.3;
                    gl_FragColor = vec4(darkened, 1.0);
                } else {
                    vec2 distortedUv = uv;
                    
                    if (u_recognizing && inSelection && u_distortion_intensity > 0.0) {
                        // Liquid distortion during recognition based on intensity
                        float timeFactor = u_time * 3.0;
                        float distortion = sin(uv.y * 30.0 + timeFactor) * 0.015 * u_distortion_intensity +
                                           cos(uv.x * 20.0 - timeFactor) * 0.01 * u_distortion_intensity;
                        distortedUv += vec2(distortion, distortion * 0.5);
                    }
                    
                    // Chromatic Aberration
                    float offset = inSelection && u_recognizing ? 0.008 * u_distortion_intensity : 0.000;
                    float r = texture2D(u_image, distortedUv + vec2(offset, 0.0)).r;
                    float g = texture2D(u_image, distortedUv).g;
                    float b = texture2D(u_image, distortedUv - vec2(offset, 0.0)).b;
                    
                    vec3 color = vec3(r, g, b);
                    
                    // Glassmorphism highlight
                    if (inSelection) {
                        color *= 1.05; // Brighten slightly
                        // Neon border effect
                        float edgeDistX = min(fragCoord.x - u_selection.x, u_selection.x + u_selection.z - fragCoord.x);
                        float edgeDistY = min(fragCoord.y - u_selection.y, u_selection.y + u_selection.w - fragCoord.y);
                        float edgeDist = min(edgeDistX, edgeDistY);
                        
                        if (edgeDist < 3.0) {
                            color = mix(color, vec3(0.0, 0.95, 1.0), 0.8); // Static Neon Cyan
                        } else if (edgeDist < 8.0) {
                            color = mix(color, vec3(0.0, 0.95, 1.0), 0.3); // Static Glow
                        }
                    }
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            }
        `;

    this.program = this.createProgram(vsSource, fsSource);
    this.texture = this.gl.createTexture();

    // Cache locations
    this.locations.a_position = this.gl.getAttribLocation(this.program, "a_position");
    this.locations.u_time = this.gl.getUniformLocation(this.program, "u_time");
    this.locations.u_resolution = this.gl.getUniformLocation(this.program, "u_resolution");
    this.locations.u_selection = this.gl.getUniformLocation(this.program, "u_selection");
    this.locations.u_recognizing = this.gl.getUniformLocation(this.program, "u_recognizing");
    this.locations.u_distortion_intensity = this.gl.getUniformLocation(
      this.program,
      "u_distortion_intensity",
    );

    // Move buffer creation here to prevent per-frame leaks
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    );
  }

  private createShader(type: number, source: string) {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    this.shaders.push(shader);
    return shader;
  }

  private createProgram(vsSource: string, fsSource: string) {
    const vs = this.createShader(this.gl.VERTEX_SHADER, vsSource);
    const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSource);
    const program = this.gl.createProgram()!;
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    return program;
  }

  public updateBackground(image: HTMLImageElement) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  public resize(width: number, height: number) {
    this.resolution = { w: width, h: height };
    this.gl.viewport(0, 0, width, height);
  }

  public render(time: number) {
    if (!this.program || !this.positionBuffer) return;
    const gl = this.gl;
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.locations.a_position);
    gl.vertexAttribPointer(this.locations.a_position, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(this.locations.u_time, time * 0.001);
    gl.uniform2f(this.locations.u_resolution, this.resolution.w, this.resolution.h);
    gl.uniform4f(
      this.locations.u_selection,
      this.selection.x,
      this.selection.y,
      this.selection.w,
      this.selection.h,
    );

    gl.uniform1i(this.locations.u_recognizing, this.isRecognizing ? 1 : 0);
    gl.uniform1f(this.locations.u_distortion_intensity, this.distortionIntensity);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public destroy() {
    const gl = this.gl;
    // Detach shaders before deletion — required by WebGL spec for guaranteed VRAM reclamation
    if (this.program) {
      this.shaders.forEach((s) => gl.detachShader(this.program!, s));
      gl.deleteProgram(this.program);
    }
    this.shaders.forEach((s) => gl.deleteShader(s));
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    this.program = null;
    this.texture = null;
    this.positionBuffer = null;
    this.shaders = [];
    // Force GPU driver to reclaim all associated memory immediately
    const ext = gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
  }
}
