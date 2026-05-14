const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const port = 5500;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
};

const server = http.createServer((req, res) => {
  const url = req.url === "/" ? "/index.html" : req.url;
  const file = path.join(root, decodeURIComponent(url.split("?")[0]));

  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const extension = path.extname(file);
    const headers = { "Content-Type": types[extension] || "application/octet-stream" };
    if (extension === ".mp3") {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    }

    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MCQ Platform running at http://127.0.0.1:${port}/`);
});
