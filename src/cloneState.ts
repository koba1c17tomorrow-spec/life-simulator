/** Deep copy of the plain data graph used by GameState (including undefined).
 * Keep aliases and cycles inside the copy, never share mutable nodes with the input.
 * Non-plain extension values retain the native structuredClone behavior.
 */
export function cloneState<T>(value: T): T {
  const nativeFallback = {};
  const seen = new Map<object, unknown>();
  function copy(value: unknown): unknown {
    if (typeof value === "function" || typeof value === "symbol")
      throw nativeFallback;
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      const result = new Array(value.length);
      seen.set(value, result);
      for (const key of Object.keys(value)) {
        const next = copy((value as unknown as Record<string, unknown>)[key]);
        if (key === "__proto__")
          Object.defineProperty(result, key, {
            value: next,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        else (result as unknown as Record<string, unknown>)[key] = next;
      }
      return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw nativeFallback;
    const result: Record<string, unknown> = {};
    seen.set(value, result);
    for (const key of Object.keys(value)) {
      // Assignment is substantially faster for ordinary save fields; preserve
      // an own __proto__ key without invoking Object.prototype's setter.
      const next = copy((value as Record<string, unknown>)[key]);
      if (key === "__proto__")
        Object.defineProperty(result, key, {
          value: next,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      else result[key] = next;
    }
    return result;
  }
  try {
    return copy(value) as T;
  } catch (error) {
    if (error !== nativeFallback) throw error;
    // Fall back for the whole graph so cross-references to extension objects
    // retain native semantics too. Ordinary persisted game data takes no fallback.
    return structuredClone(value);
  }
}
