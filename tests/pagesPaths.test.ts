import { afterEach, expect, it, vi } from "vitest";
import { loadWorld } from "../src/content";
import modern from "../public/worlds/modern/events.json";
import coastal from "../public/worlds/coastal/events.json";
import modernManifest from "../public/worlds/modern/manifest.json";
import coastalManifest from "../public/worlds/coastal/manifest.json";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each([
  ["modern", modern, modernManifest],
  ["coastal", coastal, coastalManifest],
])(
  "loads %s manifest and events under the Pages subpath",
  async (id, events, manifest) => {
    vi.stubEnv("BASE_URL", "/life-simulator/");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest)))
      .mockResolvedValueOnce(new Response(JSON.stringify(events)));
    vi.stubGlobal("fetch", fetch);
    expect(await loadWorld(id)).toEqual(events);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `/life-simulator/worlds/${id}/manifest.json`,
      `/life-simulator/worlds/${id}/events.json`,
    ]);
  },
);

it("rejects an unknown world before requesting any data", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(loadWorld("missing-world")).rejects.toThrow("未知のワールド");
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["manifest-http", "manifest-id", "events-http", "events-json"])(
  "does not accept a fallback HTML/error response as world data: %s",
  async (failure) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        failure === "manifest-http"
          ? new Response("not found", { status: 404 })
          : new Response(
              JSON.stringify(
                failure === "manifest-id" ? coastalManifest : modernManifest,
              ),
            ),
      )
      .mockResolvedValueOnce(
        failure === "events-http"
          ? new Response("unavailable", { status: 503 })
          : new Response("<!doctype html><html>fallback</html>"),
      );
    vi.stubEnv("BASE_URL", "/life-simulator/");
    vi.stubGlobal("fetch", fetch);
    await expect(loadWorld("modern")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(failure.startsWith("manifest") ? 1 : 2);
  },
);
