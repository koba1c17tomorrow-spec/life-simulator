import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { AddressInfo } from "node:net";

// Serve the built artifact without modifying it. Changing only the SW bytes
// emulates the next deploy while retaining the same origin and save storage.
export async function updateSite() {
  let revision = 1;
  const root = resolve("dist");
  const base = "/life-simulator/";
  const types: Record<string, string> = {
    ".js": "application/javascript",
    ".html": "text/html",
    ".css": "text/css",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url!, "http://localhost").pathname;
      if (!pathname.startsWith(base)) throw Error("Outside app");
      const file = resolve(
        root,
        decodeURIComponent(pathname.slice(base.length)) || "index.html",
      );
      if (!file.startsWith(root + sep)) throw Error("Outside root");
      let data = await readFile(file);
      if (file === resolve(root, "sw.js"))
        data = Buffer.concat([
          data,
          Buffer.from(`\n// Deployment ${revision}\n`),
        ]);
      response.writeHead(200, {
        "Content-Type": types[extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}${base}`,
    publish: () => {
      revision++;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
