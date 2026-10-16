// Check the published deployment, including its commit marker, after CDN propagation.
// No GitHub API token is needed; this makes ordinary public HTTPS requests.
const address = process.argv[2] ?? process.env.PAGE_URL;
const expectedCommit = process.argv[3] ?? process.env.EXPECTED_SHA;
if (!address || !expectedCommit)
  throw new Error("Supply the Pages URL and expected commit SHA");
const base = new URL(address);
if (!base.pathname.endsWith("/")) base.pathname += "/";
const attempts = Number(process.env.VERIFY_ATTEMPTS ?? 12);
if (!Number.isInteger(attempts) || attempts < 1 || attempts > 12)
  throw new Error("VERIFY_ATTEMPTS must be 1–12");

async function get(path) {
  const url = new URL(path, base);
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname))
    throw new Error("Resource escapes the published app");
  url.searchParams.set("deployment", expectedCommit);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`${url.pathname}: HTTP ${response.status}`);
  return response;
}
async function verify() {
  const metadata = await (await get("deployment.json")).json();
  if (metadata.commit !== expectedCommit)
    throw new Error("Pages is still serving another commit");
  const html = await (await get("./")).text();
  const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"/i)?.[1];
  const style = html.match(/<link\b[^>]*\bhref="([^"]+\.css)"/i)?.[1];
  if (
    !script ||
    !style ||
    !html.includes(`${base.pathname}manifest.webmanifest`)
  )
    throw new Error("Missing application assets or manifest in published HTML");
  for (const asset of [script, style]) {
    if (!new URL(asset, base).pathname.startsWith(base.pathname))
      throw new Error("Asset escapes Pages base path");
    const response = await get(asset);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes(asset.endsWith(".css") ? "text/css" : "javascript"))
      throw new Error(`${asset} has an incorrect MIME type`);
    if ((await response.arrayBuffer()).byteLength === 0)
      throw new Error(`${asset} is empty`);
  }
  const manifest = await (await get("manifest.webmanifest")).json();
  if (manifest.start_url !== base.pathname || manifest.scope !== base.pathname)
    throw new Error("Invalid PWA scope/start URL");
  for (const icon of manifest.icons) {
    const response = await get(icon.src);
    if ((await response.arrayBuffer()).byteLength === 0)
      throw new Error("Empty home-screen icon");
  }
  for (const id of ["modern", "coastal"]) {
    const world = await (await get(`worlds/${id}/manifest.json`)).json();
    if (world.id !== id || !/^[-\w]+\.json$/.test(world.events))
      throw new Error(`Invalid ${id} world manifest`);
    const events = await (await get(`worlds/${id}/${world.events}`)).json();
    if (!Array.isArray(events) || events.length < 50)
      throw new Error(`Invalid ${id} world events`);
  }
  const worker = await get("sw.js");
  if (!worker.headers.get("content-type")?.match(/javascript/))
    throw new Error("Service Worker has an incorrect MIME type");
  console.log(
    `Verified ${expectedCommit} at ${base.href}: HTML, JS/CSS, icons, PWA, both worlds and Service Worker`,
  );
}
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    await verify();
    break;
  } catch (error) {
    if (attempt === attempts) throw error;
    console.log(
      `Publication check ${attempt}/${attempts}: ${error.message}; waiting for Pages propagation`,
    );
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
