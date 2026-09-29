export function percent(v: number): string {
  return `${Math.round(v * 100)}%`
}

/** Seed из текущего момента — для нового одиночного матча. */
export function freshSeed(): number {
  return (Date.now() ^ (performance.now() * 1000)) >>> 0
}
