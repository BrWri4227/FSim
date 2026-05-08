// 1D linear interpolation in a table of breakpoints
export function interp1D(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]!) return ys[0]!
  if (x >= xs[xs.length - 1]!) return ys[ys.length - 1]!
  let lo = 0
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i]! && x <= xs[i + 1]!) { lo = i; break }
  }
  const t = (x - xs[lo]!) / (xs[lo + 1]! - xs[lo]!)
  return ys[lo]! + t * (ys[lo + 1]! - ys[lo]!)
}

// 2D bilinear interpolation: table[row=x][col=y]
export function interp2D(
  xs: number[], ys: number[],
  table: number[][],
  x: number, y: number
): number {
  // Clamp x
  const xi = clampIdx(xs, x)
  const yi = clampIdx(ys, y)
  const tx = (x - xs[xi]!) / ((xs[xi + 1] ?? xs[xi])! - xs[xi]! || 1)
  const ty = (y - ys[yi]!) / ((ys[yi + 1] ?? ys[yi])! - ys[yi]! || 1)

  const r0 = table[xi]!, r1 = table[Math.min(xi + 1, xs.length - 1)]!
  const v00 = r0[yi]!, v01 = r0[Math.min(yi + 1, ys.length - 1)]!
  const v10 = r1[yi]!, v11 = r1[Math.min(yi + 1, ys.length - 1)]!

  return (1 - tx) * ((1 - ty) * v00 + ty * v01) + tx * ((1 - ty) * v10 + ty * v11)
}

function clampIdx(xs: number[], x: number): number {
  if (x <= xs[0]!) return 0
  if (x >= xs[xs.length - 1]!) return xs.length - 2
  for (let i = 0; i < xs.length - 1; i++) {
    if (x >= xs[i]! && x <= xs[i + 1]!) return i
  }
  return xs.length - 2
}
