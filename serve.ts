/* Serve game/ on http://localhost:8080 for local play-testing.
   One clear job: a tiny static file server, standard library only. */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "game");
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const server = createServer(async (req, res) => {
  try {
    const path = normalize(join(root, decodeURIComponent(req.url?.split("?")[0] || "/")));
    if (!path.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const file = path.endsWith("/") ? join(path, "index.html") : path;
    const data = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

server.listen(8080, () => console.log("Amber Isles Courier at http://localhost:8080"));
