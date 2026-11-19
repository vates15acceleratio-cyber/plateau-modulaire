'use strict';
// Serveur local de test (outils/serveur.js) : lancé sur un port libre, interrogé, puis arrêté.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

function portLibre() {
  return new Promise((resoudre, rejeter) => {
    const s = net.createServer();
    s.on('error', rejeter);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resoudre(port)); });
  });
}

function demander(port, chemin, options) {
  return new Promise((resoudre, rejeter) => {
    const req = http.request(Object.assign({ host: '127.0.0.1', port: port, path: chemin, method: 'GET' }, options || {}), (res) => {
      res.resume();
      res.on('end', () => resoudre(res.statusCode));
    });
    req.on('error', rejeter);
    req.end();
  });
}

test('serveur local : sert l’atelier, refuse (403) toute barre oblique inversée, encodée ou non, et les fichiers cachés', async () => {
  const port = await portLibre();
  const enfant = spawn(process.execPath, [path.join(__dirname, '..', 'outils', 'serveur.js'), String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resoudre, rejeter) => {
      const delai = setTimeout(() => rejeter(new Error('le serveur ne démarre pas')), 10000);
      enfant.stdout.on('data', () => { clearTimeout(delai); resoudre(); });
      enfant.on('exit', (code) => { clearTimeout(delai); rejeter(new Error('serveur arrêté, code ' + code)); });
    });
    assert.strictEqual(await demander(port, '/'), 200);
    assert.strictEqual(await demander(port, '/index.html'), 200);
    assert.strictEqual(await demander(port, '/src/hex.js'), 200);
    assert.strictEqual(await demander(port, '/absent.js'), 404);
    const refuses = ['/%5c.git%5cconfig', '/%5C.git%5Cconfig', '/\\.git\\config', '/src%5chex.js', '/src\\hex.js', '/outils%5c..%5c..%5cCLAUDE.md', '/..%5c..%5cCLAUDE.md',
      '/%5c', '/index.html%5c', '/.git/config', '/src/../../CLAUDE.md', '/%2e%2e/CLAUDE.md', '/src/.cache'];
    for (const chemin of refuses) assert.strictEqual(await demander(port, chemin), 403, chemin);
    assert.strictEqual(await demander(port, '/index.html', { method: 'POST' }), 405);
    assert.strictEqual(await demander(port, '/index.html', { headers: { host: 'exemple.test' } }), 403);
  } finally {
    enfant.kill();
  }
});
