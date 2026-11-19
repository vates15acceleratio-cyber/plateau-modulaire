/*
 * serveur.js : petit serveur statique local pour afficher l'atelier dans un navigateur
 * (l'atelier lui-même n'en a pas besoin : index.html s'ouvre directement par double-clic).
 * Usage : node outils/serveur.js [port]   (8770 par défaut ; écoute seulement sur 127.0.0.1)
 * Ne sert que le dossier atelier/, en lecture seule.
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.resolve(__dirname, '..');
const demande = Number(process.argv[2]);
const port = Number.isInteger(demande) && demande > 0 && demande < 65536 ? demande : 8770;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8'
};

http.createServer((req, res) => {
  const refuser = (code, texte) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(texte); };
  // Seul l'hôte local est accepté (protection contre le « DNS rebinding ») ; lecture seule.
  if (req.headers.host !== '127.0.0.1:' + port && req.headers.host !== 'localhost:' + port) return refuser(403, 'Hôte refusé');
  if (req.method !== 'GET' && req.method !== 'HEAD') return refuser(405, 'Méthode refusée');
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { return refuser(400, 'Requête invalide'); }
  // Aucune barre oblique inversée, écrite telle quelle ou encodée (%5c) : sous Windows elle sépare aussi les dossiers
  // et contournerait le filtre des fichiers cachés ci-dessous.
  if (req.url.includes('\\') || url.includes('\\')) return refuser(403, 'Interdit');
  if (url.includes('\0') || /(^|\/)\./.test(url)) return refuser(403, 'Interdit');      // ni octet nul, ni fichier ou dossier caché, ni « .. »
  const fichier = path.resolve(racine, '.' + (url.endsWith('/') ? url + 'index.html' : url));
  if (!fichier.startsWith(racine + path.sep)) return refuser(403, 'Interdit');
  fs.readFile(fichier, (err, data) => {
    if (err) return refuser(404, 'Introuvable');
    res.writeHead(200, { 'Content-Type': types[path.extname(fichier).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : data);
  });
}).listen(port, '127.0.0.1', () => console.log('Atelier du plateau : http://127.0.0.1:' + port + '/'));
