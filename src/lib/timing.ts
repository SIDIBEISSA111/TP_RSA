/** Exécute fn et renvoie son résultat avec la durée en millisecondes. */
export function timed<T>(fn: () => T): [T, number] {
  const t0 = performance.now();
  const result = fn();
  return [result, performance.now() - t0];
}
