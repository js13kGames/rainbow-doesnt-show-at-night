// uniform names are kept to 1 char: GLSL source is a JS string, so terser can't mangle it —
// every char here is a byte in the final bundle, unlike normal identifiers which get minified for free
// horizontal flip is done via UV swap on the JS side (drawScene), not a shader uniform —
// keeps rotation as a single float instead of a vec2
const spriteVert = `#version 300 es
layout(location=0)in vec2 a;uniform vec2 r;uniform vec4 x,u;uniform float o;out vec2 v;void main(){float k=cos(o),n=sin(o);vec2 q=mat2(k,n,-n,k)*(a*x.zw)+x.xy;vec2 e=q/r*2.-1.;gl_Position=vec4(e.x,-e.y,0,1);v=mix(u.xy,u.zw,a*.5+.5);}`

const spriteFrag = `#version 300 es
precision mediump float;in vec2 v;uniform sampler2D t;out vec4 o;void main(){vec4 c=texture(t,v);if(c.a<.5)discard;o=c;}`

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

// atlas cell / sheet are both powers of 2 (16, 64) — collapses to one constant ratio
const STEP = 0.25

export function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2')!

  const spriteProgram = program(gl, spriteVert, spriteFrag)
  const U = {
    res: gl.getUniformLocation(spriteProgram, 'r'),
    xform: gl.getUniformLocation(spriteProgram, 'x'), // vec4(x, y, sizeX, sizeY)
    rf: gl.getUniformLocation(spriteProgram, 'o'), // vec2(rotation, flip)
    uv: gl.getUniformLocation(spriteProgram, 'u'),
  }

  // this app only ever has one program/VAO/texture unit in use, so program/VAO binding,
  // the default-framebuffer bind, and the texture unit/sampler setup all happen once here
  // instead of every frame — adding a 2nd program, VAO, or render target later needs those back
  gl.useProgram(spriteProgram)
  gl.bindVertexArray(gl.createVertexArray())
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
        rotation?: number
        r: number
        r2?: number
        flip?: number
        cell?: { x: number; y: number; w?: number; h?: number }
      }[],
      colorT = 0, // 0=day sky, 1=night — lerped for a smooth background transition
    ) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      const day = [0x24, 0x9f, 0xde]
      const nightCol = [0x14, 0x10, 0x13]
      const [cr, cg, cb] = day.map((d, i) => d + (nightCol[i]! - d) * colorT)
      gl.clearColor(cr! / 255, cg! / 255, cb! / 255, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      if (!atlasReady) return

      gl.uniform2f(U.res, canvas.width, canvas.height)
      for (const s of sprites) {
        // flip mirrors via a negative width scale instead of a separate shader uniform
        gl.uniform4f(U.xform, s.x, s.y, s.r * (s.flip ?? 1), s.r2 ?? s.r)
        gl.uniform1f(U.rf, s.rotation ?? 0)
        const { x, y, w = 1, h = 1 } = s.cell!
        const u0 = x * STEP
        const v0 = y * STEP
        gl.uniform4f(U.uv, u0, v0, u0 + w * STEP, v0 + h * STEP)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
    },
  }
}
