import { expect, it } from "vitest";
import { cloneState } from "../src/cloneState";
import { newGame, advanceMonth, autoResolve } from "../src/engine";
import fixture from "./fixtures/p3-2-coastal-observed.json";

it("matches native copy for existing save data, including independent nested NPC and knowledge state", () => {
  const copy = cloneState(fixture);
  expect(copy).toStrictEqual(structuredClone(fixture));
  const visit = (a: unknown, b: unknown) => {
    if (a && typeof a === "object") {
      expect(b).not.toBe(a);
      for (const key of Object.keys(a))
        visit(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        );
    }
  };
  visit(fixture, copy);
});
it("preserves undefined, special numbers, sparse arrays, aliases and cycles without prototype pollution", () => {
  const shared = { value: undefined, n: NaN, z: -0, infinity: Infinity };
  const input = {
    shared,
    alias: shared,
    sparse: [, , shared],
    unsafe: JSON.parse('{"__proto__":{"polluted":true}}'),
    self: null as unknown,
  };
  input.self = input;
  const actual = cloneState(input);
  expect(actual).toStrictEqual(structuredClone(input));
  expect(actual.shared).toBe(actual.alias);
  expect(actual.self).toBe(actual);
  expect(Object.getPrototypeOf(actual.unsafe)).toBe(Object.prototype);
  expect(Object.hasOwn(actual.unsafe, "__proto__")).toBe(true);
});
it("uses native semantics for non-plain extension graphs and unsupported values", () => {
  const shared = { n: 1 };
  const input = { shared, map: new Map([["key", shared]]), date: new Date(0) };
  const actual = cloneState(input);
  expect(actual).toStrictEqual(structuredClone(input));
  expect(actual.map.get("key")).toBe(actual.shared);
  expect(() => cloneState({ callback: () => 0 })).toThrow();
});
it("month and event resolution keep their input state immutable", () => {
  let s = newGame(7919);
  for (let i = 0; i < 24; i++) {
    const before = structuredClone(s);
    const next = advanceMonth(s, []);
    expect(s).toStrictEqual(before);
    const waiting = structuredClone(next);
    s = autoResolve(next, []);
    expect(next).toStrictEqual(waiting);
  }
});
