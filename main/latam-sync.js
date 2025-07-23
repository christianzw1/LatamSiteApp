/* LATAM-Sync 2025-07-xx
   • primeiro tenta descobrir um servidor via mDNS
   • se não achar, cria o seu
   • guarda dados em %USERPROFILE%\.latam-adm\latam-data.json
----------------------------------------------------------- */
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const http = require('http');
const net  = require('net');
const express  = require('express');
const socketio = require('socket.io');
const ioClient = require('socket.io-client');
const bonjour  = require('bonjour')();

const PORT = 8585;

/* ---------- pasta de dados no perfil do usuário ---------- */
const DATA_DIR  = path.join(os.homedir(), '.latam-adm');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'latam-data.json');

let changes = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE)) : [];
const save   = () => fs.writeFileSync(DATA_FILE, JSON.stringify(changes));

/* ===========================================================
   PARTE 1 · Funções utilitárias
=========================================================== */
function applyChange(change, ackSocket = null) {
  if (changes.find(c => c.id === change.id)) return;
  changes.push(change);
  save();
  if (ioServer) ioServer.emit('change', change);
  if (ackSocket) ackSocket.emit('ack', change.id);
}

/* ===========================================================
   PARTE 2 · Servidor
=========================================================== */
let ioServer = null;
function startServer() {
  const app = express();
  const httpSrv = http.createServer(app);
  ioServer = socketio(httpSrv, { cors: { origin: '*' } });

  ioServer.on('connection', sock => {
    sock.emit('seed', changes);
    sock.on('change', c => applyChange(c, sock));
  });

  httpSrv.listen(PORT, () => {
    console.log('LATAM-Sync • SERVIDOR ativo em :' + PORT);
    bonjour.publish({ name: 'latamsync-' + os.hostname(),
                      type: 'latamsync', port: PORT });
  });
}

/* ===========================================================
   PARTE 3 · Cliente
=========================================================== */
function connectClient(url) {
  const sock = ioClient(url, { reconnectionDelay: 2000 });

  sock.on('connect', () =>
    console.log('LATAM-Sync • conectado ao servidor →', url)
  );
  sock.on('seed', list => list.forEach(applyChange));
  sock.on('change', applyChange);
  sock.on('disconnect', () => {
    console.log('LATAM-Sync • desconectou, procurando novo servidor…');
    discoverOrServe();                       // tenta outro / reeleição
  });
}

/* ===========================================================
   PARTE 4 · Eleição: descobrir primeiro, servir depois
=========================================================== */
function discoverOrServe() {
  let found = false;
  const browser = bonjour.find({ type: 'latamsync' }, svc => {
    found = true;
    const url = `ws://${svc.referer.address}:${svc.port}`;
    browser.stop();
    connectClient(url);
  });

  // se nada aparecer em 2 s → vira servidor
  setTimeout(() => {
    browser.stop();
    if (!found) startServer();
  }, 2000);
}

discoverOrServe();
