/**
 * Organiza LATAM ADM em:
 *   public/   → front-end (html, css, sync.js)
 *   main/     → latam-sync.js e dados
 *   electron/ → casca Electron
 */
const fs = require('fs');
const path = require('path');

function mv(src, destDir) {
  if (!fs.existsSync(src)) return;
  const dest = path.join(destDir, path.basename(src));
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir);
  fs.renameSync(src, dest);
  console.log('✔', src, '→', dest);
}

console.log('\n==> Organizando pastas…');

// front-end
['login.html','inicio.html','estoque.html','arquivos.html','mensagens.html','sync.js']
  .forEach(f => mv(f, 'public'));

// backend / dados
['latam-sync.js','latam-data.json'].forEach(f => mv(f, 'main'));

// cria casca Electron
if (!fs.existsSync('electron')) fs.mkdirSync('electron');
const mainJS = `
  const { app, BrowserWindow } = require('electron');
  const path  = require('path');
  const cp    = require('child_process');
  let syncProcess;

  function createWindow () {
    const win = new BrowserWindow({
      width: 1280, height: 800,
      webPreferences: { nodeIntegration:false, contextIsolation:true }
    });
    win.loadFile(path.join(__dirname, '..', 'public', 'login.html'));
  }

  app.whenReady().then(() => {
    syncProcess = cp.fork(path.join(__dirname,'..','main','latam-sync.js'), [], {detached:true});
    createWindow();
  });
  app.on('window-all-closed', () => { if (process.platform!=='darwin') app.quit(); });
  app.on('quit', () => { if(syncProcess) process.kill(-syncProcess.pid); });
`;
fs.writeFileSync('electron/main.js', mainJS.trimStart());
console.log('✔ electron/main.js criado');

console.log('\nPronto! Atualize o package.json conforme a nova estrutura.\n');
