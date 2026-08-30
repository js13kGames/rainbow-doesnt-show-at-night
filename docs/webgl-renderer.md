# 효율적인 WebGL 렌더러 구조

## 개요

js13k처럼 전체 코드가 13KB(gzip) 이하여야 하는 제약 하에서는, 렌더러가 셰이더 개수·draw call·유틸리티 코드량을 얼마나 적게 유지하느냐가 곧 예산과 직결된다. `verybomb/soulsurf-js13k`(2022 js13k 출품작)의 렌더러(`src/webgl.ts`, `src/renderer.ts`, `src/glsl/*`)를 실제로 클론해 읽고, 이 프로젝트의 `src/renderer.ts`와 비교하며 얻은 내용을 정리한다.

## 이 프로젝트(`src/renderer.ts`)의 현재 구조

- WebGL2(`#version 300 es`), 셰이더 2개(sprite/post)를 TS 파일 안에 템플릿 리터럴로 직접 보관.
- 원(circle) 하나만 그리는 전용 스프라이트 셰이더 — `discard`로 원형 마스킹.
- FBO에 씬을 그린 뒤 풀스크린 쿼드로 post-process(파형 왜곡) 합성.
- 빌드 결과 gzip 2.47KB / 13KB 예산 — 여유 충분, 현재 규모에서 추가 최적화는 불필요.

## soulsurf-js13k 렌더러에서 확인한 기법

### 1. WebGL1 + 최소 attribute/uniform

`webgl2`가 아니라 `webgl`(WebGL1) 컨텍스트를 사용한다. `attribute`/`varying` 문법은 `in`/`out`보다 짧고, `#version 300 es` 헤더도 없앨 수 있다. 오브젝트 형태가 다양하지 않은 소규모 게임에서는 WebGL2의 신기능이 크게 필요하지 않으므로, WebGL1이 바이트 절약 면에서 유리하다.

### 2. 텍스처 아틀라스 + uniform 오프셋으로 스프라이트 표현

도형마다 별도 지오메트리나 셰이더를 두지 않고, 16×16 타일시트 텍스처 하나(`tileTexture`)와 `u_tile`(xx, yy, tw, th) uniform으로 어느 타일을 샘플링할지 프래그먼트 셰이더에서 결정한다.

```glsl
// main.frag
uniform vec4 u_tile;
uniform sampler2D tex;

void main() {
  vec2 uv = (v_uv.xy * u_tile.zw + u_tile.xy) / vec2(16);
  vec4 col = texture2D(tex, uv);
  if (col.a < 1.) discard;
  gl_FragColor = vec4(vec3(col.rgb), 1.);
}
```

오브젝트 종류가 늘어나도(`SPRITE_SOUL`, `SPRITE_SKULL`, `SPRITE_DOOR` ...) 셰이더나 draw call 로직은 그대로이고, 상수 배열만 추가된다. **셰이더 코드량이 오브젝트 종류 수와 무관해진다.**

### 3. 버텍스 버퍼 1개를 프로그램 생성 시 한 번만 생성

```typescript
// webgl.ts
const setupBuffers = (gl, shader) => {
  const buffer = gl.createBuffer()
  const positionLocation = gl.getAttribLocation(shader, 'a_pos')
  const vertices = new Float32Array([0,1, 1,0, 0,0, 0,1, 1,1, 1,0])
  gl.enableVertexAttribArray(positionLocation)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)
}
```

`createProgram` 내부에서 자동 호출되어 프로그램마다 정확히 한 번만 버퍼가 만들어진다. (참고: 우리 `renderer.ts`는 `quadBuffer(gl)`를 sprite/post 두 곳에서 각각 호출해 동일 데이터를 담은 버퍼를 중복 생성한다 — 재사용해도 무방한 부분.)

### 4. CPU-side 3×3 행렬로 스프라이트별 변환 합성

`gl-matrix` 같은 라이브러리 없이 자체 구현(`matrix.ts`)한 9-float 배열 기반 3×3 행렬로 pivot·회전·스케일·이동을 합성한다.

```typescript
const mat = matrix(
  translate(-cx, -cy),   // pivot 기준 이동
  rotate(rotation),
  scale(w * xscale, h * yscale),
  translate(w * cx, h * cy),
  translate(x, y),
)
```

버텍스 셰이더는 `u_mat`(mat3) 하나만 받아 곱하면 되므로, uniform 개수가 늘지 않고도 임의의 pivot·회전·스케일 조합을 표현할 수 있다. 우리 셰이더는 원만 그리므로 `mat2(c,s,-s,c)`를 인라인으로 바로 계산 — 지금은 이쪽이 더 가볍지만, pivot이 있는 스프라이트가 필요해지면 이 방식이 필요해진다.

### 5. Post-process: FBO → 풀스크린 쿼드 (동일 패턴)

```typescript
// renderer.ts
export const begin = (game) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.clear(gl.COLOR_BUFFER_BIT)
  // ... u_cam 등 uniform 설정
}
export const end = () => {
  gl.useProgram(programs[SHADER_SCREEN])
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, fboTexture)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 6)
}
```

CRT curvature, scanline, chromatic bleed 등 여러 이펙트를 **하나의 프래그먼트 셰이더**(`screen.frag`)에 몰아넣어, 이펙트 개수가 늘어도 프로그램 수(2개: `SHADER_MAIN`, `SHADER_SCREEN`)와 draw call 수는 늘지 않는다. 우리 `drawScene`/`applyPostProcess` 구조와 근본적으로 동일한 아이디어.

### 6. minify 친화적 코드 스타일

- `for (let i = NUM_SHADERS; i--;)` 역방향 루프 — 변수 비교 대상 제거.
- 프로그램을 이름이 아니라 `programs[SHADER_MAIN]`처럼 인덱스 상수로 관리 — terser mangle과 결합 시 더 짧아짐.
- `vite.config.js`: `terser` + `mangle.properties: true`로 프로퍼티명까지 압축, `vite-plugin-glsl`의 `compress: true`로 `.vert`/`.frag` 파일 자체도 빌드 시 압축. 셰이더를 별도 파일로 분리해 관리성은 유지하면서 번들엔 압축된 문자열만 남긴다.

## 비교 요약

| 항목 | 이 프로젝트 (`src/renderer.ts`) | soulsurf-js13k |
|---|---|---|
| WebGL 버전 | WebGL2 (`#version 300 es`) | WebGL1 |
| 그리는 대상 | 원(circle) 전용, discard로 마스킹 | 텍스처 아틀라스 + uniform 오프셋 스프라이트 |
| 변환 | 셰이더 내 `mat2` 인라인 (회전만) | CPU-side 3×3 행렬 (pivot·회전·스케일) |
| 셰이더 소스 위치 | TS 템플릿 리터럴 | 별도 `.vert`/`.frag` + glsl 플러그인 압축 |
| 버텍스 버퍼 | quad별로 2회 생성 (중복) | 프로그램당 1회 |
| Post-process | FBO → 풀스크린 쿼드, 파형 왜곡 1가지 | FBO → 풀스크린 쿼드, CRT curvature+scanline+bleed 통합 |
| 빌드 gzip 크기 | 2.47KB / 13KB | (README 기준 최종 출품 용량, 별도 확인 필요) |

## 핵심 원칙 정리

**셰이더 프로그램 수는 오브젝트 종류가 아니라 "그리는 방식"의 종류에 비례해야 한다.** 텍스처 아틀라스 + uniform 오프셋 패턴을 쓰면 스프라이트가 몇 종류든 프로그램은 늘지 않는다.

**GPU 버퍼·텍스처 같은 리소스는 정확히 필요한 개수만 생성한다.** 같은 데이터를 담는 버퍼를 여러 번 만들지 않는다 — 재사용 가능한 것은 재사용한다.

**이펙트가 늘어도 draw call은 늘리지 않는다.** post-process 이펙트를 프래그먼트 셰이더 하나에 누적시키는 편이, 이펙트마다 별도 pass를 추가하는 것보다 draw call·프로그램 전환 비용이 적다.

**규모에 맞는 버전을 선택한다.** WebGL2의 `in/out`, named VAO 등은 편의 기능이지 필수가 아니다 — js13k 규모에서는 WebGL1이 바이트 예산상 더 유리할 수 있다. 다만 현재 이 프로젝트는 gzip 2.47KB로 예산에 여유가 커서, 당장 WebGL1로 다운그레이드하거나 아틀라스 패턴을 도입할 필요는 없다.

skipped: 텍스처 아틀라스·CPU 행렬 유틸 실제 도입, add when 스프라이트 이미지나 pivot이 있는 다중 오브젝트 종류가 실제로 필요해질 때.
