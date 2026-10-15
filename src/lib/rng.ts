/** Deterministic seeded PRNG (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;
export const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length) % arr.length];
export const range = (r: Rng, a: number, b: number) => a + r() * (b - a);
export const irange = (r: Rng, a: number, b: number) => Math.floor(a + r() * (b - a + 1));
/** approx normal via sum of uniforms */
export const gauss = (r: Rng) => (r() + r() + r() + r() + r() + r() - 3) / 1.0;
