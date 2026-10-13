'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.PORT, 10) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.obj': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8' });
  res.end(body);
}

const server = http.createServer(function (req, res) {
  var url = decodeURIComponent((req.url || '/').split('?')[0]);
  var rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  var file = path.resolve(ROOT, rel);
  if (file !== ROOT && file.indexOf(ROOT + path.sep) !== 0) return send(res, 403, 'Forbidden');
  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    var type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});

function openBrowser(url) {
  var cmd = process.platform === 'win32' ? 'start "" "' + url + '"'
    : process.platform === 'darwin' ? 'open "' + url + '"'
      : 'xdg-open "' + url + '"';
  exec(cmd, function () { });
}

server.on('error', function (e) {
  if (e.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' deja utilise. Essaie un autre port, ex: set PORT=8090 && npm run serve');
  } else {
    console.error(e.message);
  }
  process.exit(1);
});

server.listen(PORT, function () {
  var url = 'http://localhost:' + PORT + '/';
  console.log('AstralBlender -> ' + url);
  console.log('Ctrl+C pour arreter.');
  if (!process.env.NO_OPEN) openBrowser(url);
});
