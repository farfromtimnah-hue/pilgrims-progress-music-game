/**
 * Data loaders — the only place JSON content enters the engine.
 * Components and game logic never import data files directly; they receive
 * loaded, validated objects, so all content stays data-driven.
 *
 * Loaders are typed against the schema in engine/types once it lands (piece 2).
 */
export async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load data file ${path}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
