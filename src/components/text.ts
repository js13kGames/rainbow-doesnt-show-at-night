import { idleFrame, IDLE_STEP } from '../systems/wobble.ts'

// alphabet region of sprite-sheet.png — see scripts/alphabet.ts for the declared glyph size/grid.
// glyphs are 3x5px but columns sit on a 4px pitch (1px transparent gap between letters) while
// rows sit on a flush 5px pitch (no vertical gap) — found by pixel-dumping the atlas, since
// alphabet.ts's constants describe glyph size only, not the sheet's actual column spacing
const GLYPH_X = 16, GLYPH_Y = 48, GLYPH_W = 3, GLYPH_H = 5, GLYPH_COL_PITCH = 4, GLYPH_COLS = 12

type Cell = { x: number; y: number; w?: number; h?: number }

// undefined for anything outside A-Z (space, digits, punctuation) — caller just skips the glyph
export function charCell(ch: string): Cell | undefined {
  const i = ch.toUpperCase().charCodeAt(0) - 65
  if (i < 0 || i > 25) return undefined
  const col = i % GLYPH_COLS
  const row = (i / GLYPH_COLS) | 0
  return { x: (GLYPH_X + col * GLYPH_COL_PITCH) / 16, y: (GLYPH_Y + row * GLYPH_H) / 16, w: GLYPH_W / 16, h: GLYPH_H / 16 }
}

// pushes one { x, y, r, r2, cell } sprite per supported glyph into `sprites`, left-to-right from
// top-left corner (x, y); unsupported chars (space, digits, ...) just advance the cursor.
// each glyph gets the same idle wiggle as the player (see wobble.ts's idleFrame), phase-offset
// per character index so the word ripples rather than pulsing in lockstep
export function pushText<T extends { x: number; y: number; r: number; r2?: number; rotation?: number; cell?: Cell }>(
  sprites: T[],
  text: string,
  x: number,
  y: number,
  scale = 2.5,
  spacing = 1,
) {
  const gw = GLYPH_W * scale
  const gh = GLYPH_H * scale
  const t = performance.now() * 0.001
  let cursor = x
  let i = 0
  for (const ch of text) {
    const cell = charCell(ch)
    if (cell) {
      const frame = idleFrame(t + i * IDLE_STEP)
      sprites.push({ x: cursor + gw / 2, y: y + gh / 2, r: gw / 2, r2: (gh / 2) * frame.sy, rotation: frame.rot, cell } as T)
    }
    cursor += gw + spacing * scale
    i++
  }
}

// total width a `pushText` call with these args would occupy — lets a caller center the block
// without duplicating pushText's own advance math
export const textWidth = (text: string, scale = 2.5, spacing = 1): number => [...text].length * (GLYPH_W * scale + spacing * scale)
