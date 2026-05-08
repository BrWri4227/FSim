export const MS_TO_KTS = 1.94384
export const KTS_TO_MS = 1 / 1.94384
export const M_TO_FT = 3.28084
export const FT_TO_M = 1 / 3.28084
export const KG_TO_LB = 2.20462
export const N_TO_LBF = 0.224809

export const msToKts = (v: number) => v * MS_TO_KTS
export const ktsToMs = (v: number) => v * KTS_TO_MS
export const mToFt = (v: number) => v * M_TO_FT
export const ftToM = (v: number) => v * FT_TO_M
export const nmToM = (nm: number) => nm * 1852
export const mToNm = (m: number) => m / 1852
