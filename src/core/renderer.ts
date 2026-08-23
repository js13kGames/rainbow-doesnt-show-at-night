const spriteVert = `#version 300 es
layout(location=0) in vec2 a_pos;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_size;
uniform float u_rotation;
uniform float u_flip;
uniform vec4 u_uvRect;
out vec2 v_uv;
void main() {
  vec2 pivotLocal = vec2(0.0, 0.0);
  vec2 local = vec2(a_pos.x * u_flip, a_pos.y) - pivotLocal;
  float c = cos(u_rotation), s = sin(u_rotation);
  vec2 rotated = mat2(c, s, -s, c) * (local * u_size);
  vec2 p = rotated + pivotLocal * u_size + u_center;
  vec2 clip = (p / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = mix(u_uvRect.xy, u_uvRect.zw, a_pos * 0.5 + 0.5);
}`

const spriteFrag = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_atlas;
uniform int u_useColor;
uniform vec3 u_color;
out vec4 outColor;
void main() {
  if (u_useColor == 1) {
    outColor = vec4(u_color, 1.0);
    return;
  }
  vec4 c = texture(u_atlas, v_uv);
  if (c.a < 0.5) discard;
  outColor = c;
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

function program(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string) {
  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vertSrc))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragSrc))
  gl.linkProgram(prog)
  return prog
}

function quadBuffer(gl: WebGL2RenderingContext) {
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  return buf
}

const CELL = 16
const SHEET = 64

export function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2')!

  const spriteProgram = program(gl, spriteVert, spriteFrag)
  const spriteUniforms = {
    resolution: gl.getUniformLocation(spriteProgram, 'u_resolution'),
    center: gl.getUniformLocation(spriteProgram, 'u_center'),
    size: gl.getUniformLocation(spriteProgram, 'u_size'),
    rotation: gl.getUniformLocation(spriteProgram, 'u_rotation'),
    flip: gl.getUniformLocation(spriteProgram, 'u_flip'),
    uvRect: gl.getUniformLocation(spriteProgram, 'u_uvRect'),
    atlas: gl.getUniformLocation(spriteProgram, 'u_atlas'),
    useColor: gl.getUniformLocation(spriteProgram, 'u_useColor'),
    color: gl.getUniformLocation(spriteProgram, 'u_color'),
  }

  const spriteQuad = gl.createVertexArray()
  gl.bindVertexArray(spriteQuad)
  quadBuffer(gl)

  const atlas = gl.createTexture()
  let atlasReady = false
  const img = new Image()
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, atlas)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    atlasReady = true
  }
  img.src = '/sprite-sheet.png'

  return {
    drawScene(
      sprites: {
        x: number
        y: number
        rotation: number
        r: number
        r2?: number
        flip: number
        cell?: { x: number; y: number; w?: number; h?: number }
        color?: [number, number, number]
      }[],
    ) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0x24 / 255, 0x9f / 255, 0xde / 255, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      if (!atlasReady || sprites.length === 0) return

      gl.useProgram(spriteProgram)
      gl.bindVertexArray(spriteQuad)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, atlas)
      gl.uniform1i(spriteUniforms.atlas, 0)
      gl.uniform2f(spriteUniforms.resolution, canvas.width, canvas.height)
      for (const s of sprites) {
        gl.uniform2f(spriteUniforms.center, s.x, s.y)
        gl.uniform2f(spriteUniforms.size, s.r, s.r2 ?? s.r)
        gl.uniform1f(spriteUniforms.rotation, s.rotation)
        gl.uniform1f(spriteUniforms.flip, s.flip)
        if (s.color) {
          gl.uniform1i(spriteUniforms.useColor, 1)
          gl.uniform3f(spriteUniforms.color, s.color[0], s.color[1], s.color[2])
        } else {
          gl.uniform1i(spriteUniforms.useColor, 0)
          const u0 = (s.cell!.x * CELL) / SHEET
          const v0 = (s.cell!.y * CELL) / SHEET
          const u1 = u0 + (CELL * (s.cell!.w ?? 1)) / SHEET
          const v1 = v0 + (CELL * (s.cell!.h ?? 1)) / SHEET
          gl.uniform4f(spriteUniforms.uvRect, u0, v0, u1, v1)
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
    },
  }
}
