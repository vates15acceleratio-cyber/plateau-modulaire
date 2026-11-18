/*
 * serveur.js : petit serveur statique local pour tester l'interface dans un navigateur
 * (l'application elle-même n'en a pas besoin : elle s'ouvre directement en file://).
 * Usage : node outils/serveur.js [port]   (défaut 8765, écoute seulement sur 127.0.0.1)
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.resolve(__dirname, '..');
const port = Number(process.argv[2]) || 8765;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  // Audit de sécurité : URL mal encodée → 400 (au lieu d'un plantage) ; octet nul refusé ;
  // seul l'hôte local est accepté (protection contre le DNS rebinding) ; .git et .claude ne sont pas servis.
  if (req.headers.host !== '127.0.0.1:' + port && req.headers.host !== 'localhost:' + port) { res.writeHead(403); res.end('Hôte refusé'); return; }
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400); res.end('Requête invalide'); return; }
  if (url.includes('\0') || /^\/\.(git|claude)(\/|$)/i.test(url)) { res.writeHead(403); res.end('Interdit'); return; }
  const fichier = path.resolve(racine, '.' + (url === '/' ? '/index.html' : url));
  if (!fichier.startsWith(racine + path.sep) && fichier !== racine) { res.writeHead(403); res.end('Interdit'); return; }
  fs.readFile(fichier, (err, data) => {
    if (err) { res.writeHead(404); res.end('Introuvable'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('Plateau modulaire : http://127.0.0.1:' + port + '/'));
