/* LATAM ADM • Cliente de Sincronização
   –
   expõe:
     queueChange(type, payload)   → coloca mudança na fila + deixa botão vermelho
     syncNow()                    → força envio pendente
   dispara:
     window event 'latam-change'  → qualquer página pode escutar e aplicar
------------------------------------------------------ */
(() => {
  const SYNC_PORT   = 8585;
  const STORAGE_OUT = 'latam_outbox';
  const STORAGE_APL = 'latam_applied';
  let outbound  = JSON.parse(localStorage.getItem(STORAGE_OUT) || '[]');
  let applied   = new Set(JSON.parse(localStorage.getItem(STORAGE_APL) || '[]'));
  let socket    = null;

  /* ---------- helpers UI ---------- */
  function paint (flag) {
    const btns = document.querySelectorAll('#syncBtn');
    btns.forEach(b => b.classList.toggle('unsynced', flag));
    // se estiver em iframe, tenta pintar botão do topo
    if (window.parent && window.parent !== window) {
      try {
        const pBtns = window.parent.document.querySelectorAll('#syncBtn');
        pBtns.forEach(b => b.classList.toggle('unsynced', flag));
      } catch (_) {}
    }
  }

  /* ---------- fila ---------- */
  function persist () {
    localStorage.setItem(STORAGE_OUT, JSON.stringify(outbound));
  }
  function queueChange (type, payload) {
    const change = {
      id:   Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      type,
      ts:   new Date().toISOString(),
      payload
    };
    outbound.push(change);
    paint(true);
    persist();
    sendPending();
  }

  /* ---------- aplicar mudança recebida ---------- */
  function apply (change) {
    if (applied.has(change.id)) return;
    applied.add(change.id);
    localStorage.setItem(STORAGE_APL, JSON.stringify([...applied]));
    window.dispatchEvent(new CustomEvent('latam-change', { detail: change }));
    // espelha p/ iframe ou topo
    if (window.parent && window.parent !== window) {
      window.parent.dispatchEvent(new CustomEvent('latam-change', { detail: change }));
    } else {
      Array.from(document.querySelectorAll('iframe')).forEach(fr => {
        try { fr.contentWindow.dispatchEvent(new CustomEvent('latam-change', { detail: change })); } catch (_) {}
      });
    }
  }

  /* ---------- websocket ---------- */
  function connect () {
    let host = localStorage.getItem('latamSyncServer') || location.hostname;
    socket = io(`ws://${host}:${SYNC_PORT}`, { reconnectionDelay: 2000 });

    socket.on('connect', () => {
      localStorage.setItem('latamSyncServer', '192.168.1.42'); // IP do PC que fará o servidor
      sendPending();
    });
    socket.on('seed', list => list.forEach(apply));
    socket.on('change', apply);
    socket.on('ack', id => {
      outbound = outbound.filter(c => c.id !== id);
      persist();
      if (outbound.length === 0) paint(false);
    });
    socket.on('disconnect', () => {
      setTimeout(connect, 2000);
    });
    socket.on('connect_error', () => {
      setTimeout(connect, 3000);
    });
  }

  function sendPending () {
    if (!socket || !socket.connected) return;
    outbound.forEach(ch => {
      socket.emit('change', ch, ok => {
        if (ok) {
          outbound = outbound.filter(c => c.id !== ch.id);
          persist();
          if (outbound.length === 0) paint(false);
        }
      });
    });
  }

  /* ---------- API global ---------- */
  window.queueChange = queueChange;
  window.syncNow     = () => { sendPending(); };

  /* ---------- boot ---------- */
  connect();
})();
