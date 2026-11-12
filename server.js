const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, "public");
const API_BASE = "https://provinces.open-api.vn/api/v2/p";
const apiCache = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const renderPage = async () => {
  const [page, header, footer, communityFeed] = await Promise.all([
    fs.promises.readFile(path.join(ROOT, "index.html"), "utf8"),
    fs.promises.readFile(path.join(ROOT, "partials", "header.html"), "utf8"),
    fs.promises.readFile(path.join(ROOT, "partials", "footer.html"), "utf8"),
    fs.promises.readFile(path.join(ROOT, "partials", "community-feed.html"), "utf8"),
  ]);
  return page
    .replace('<div data-include="partials/header.html"></div>', header.trim())
    .replace('<div data-include="partials/footer.html"></div>', footer.trim())
    .replace('<div data-include="partials/community-feed.html"></div>', communityFeed.trim());
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const provinceRoute = requestUrl.pathname.match(/^\/api\/provinces(?:\/(\d+)\/wards)?$/);

  if (provinceRoute) {
    const provinceCode = provinceRoute[1];
    const cacheKey = provinceCode ? `wards:${provinceCode}` : "provinces";
    const cached = apiCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" });
      res.end(cached.body);
      return;
    }

    const endpoint = provinceCode
      ? `${API_BASE}/${provinceCode}/?depth=2`
      : `${API_BASE}/`;

    fetch(endpoint, { signal: AbortSignal.timeout(10000) })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Geography API returned ${response.status}`);
        const data = await response.json();
        const result = provinceCode
          ? data.wards?.map(({ code, name }) => ({ code, name }))
          : data.map(({ code, name }) => ({ code, name }));
        if (!Array.isArray(result)) throw new Error("Unexpected geography API response");

        const body = JSON.stringify(result);
        apiCache.set(cacheKey, { body, expiresAt: Date.now() + 60 * 60 * 1000 });
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600" });
        res.end(body);
      })
      .catch((error) => {
        console.error("Geography API error:", error.message);
        res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "Không tải được dữ liệu tỉnh/phường. Vui lòng thử lại." }));
      });
    return;
  }

  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/" || urlPath === "/index.html") {
    renderPage().then((html) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(html);
    }).catch((error) => {
      console.error("Page render error:", error.message);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Page render error");
    });
    return;
  }
  if (/^\/partials\/(header|footer|community-feed)\.html$/.test(urlPath)) {
    fs.readFile(path.resolve(ROOT, urlPath.slice(1)), (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Partial not found");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
      res.end(data);
    });
    return;
  }
  const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, relativePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
});
