// Software Update for Pets OS for Stephone: everything happens inside Pets OS.
//   Android (StepPhone test host): the phone's SystemUpdater checks a signed manifest, downloads the
//     package with progress and pause/resume, checks its SHA-256 against the signed manifest, and installs
//     it with Android's PackageInstaller (Android shows one Install confirmation; Pets OS restarts on the
//     new version with all data kept; if the install fails the old version stays).
//   iPhone / browser: the same signed manifest lists every file with its SHA-256; Pets OS downloads them,
//     checks each one, stores them as the next offline copy, and switches to it when you restart Pets OS.
// States: idle · checking · none · available · downloading · paused · interrupted · verifying · ready ·
//         permission · installing · confirm · installed · failed · offline
'use strict';
const SU = {
  st: { state: 'idle' }, info: null, listeners: [],
  history() { return Store.app('updates.history', []); },
  log(e) { const l = this.history(); l.unshift(Object.assign({ at: Date.now() }, e)); Store.setApp('updates.history', l.slice(0, 50)); },
  set(p) { this.st = Object.assign({}, this.st, p); this.listeners.forEach(f => { try { f(this.st); } catch (e) { /* ignore */ } }); },
  on(f) { this.listeners.push(f); return () => { this.listeners = this.listeners.filter(x => x !== f); }; },
  newer(a, b) { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; },
  // ---- web: signed version.json next to the web build
  webBase() { const o = Store.app('update.base', null); return o && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? o : './'; },
  async webCheck() {
    const base = this.webBase();
    const get = async (f, t) => { const r = await fetch(base + f + '?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return t ? r.text() : new Uint8Array(await r.arrayBuffer()); };
    const body = await get('version.json'), sig = await get('version.sig');
    let ok = false; try { ok = await PetStore.verify(body, sig); } catch (e) { ok = false; }
    if (!ok) throw Object.assign(new Error('The update information is not signed by Pets OS. Nothing was downloaded.'), { kind: 'unsigned' });
    const m = JSON.parse(new TextDecoder().decode(body));
    if (m.platform !== 'web') throw new Error('The update is for a different platform.');
    return Object.assign(m, { currentVersion: PETS_VERSION, available: this.newer(m.version, PETS_VERSION), signed: true, device: navigator.userAgent.match(/iPhone|iPad|Android|Mac|Windows/) ? RegExp.lastMatch : 'browser' });
  },
  async webDownload() {
    const m = this.info, base = new URL(m.filesBase || './', new URL(this.webBase(), location.href)).href;
    const total = m.files.reduce((n, f) => n + f.size, 0); let done = 0;
    this.set({ state: 'downloading', done, total });
    const cache = await caches.open(m.cache);
    for (const f of m.files) {
      if (this.pauseFlag) { this.set({ state: 'paused' }); return; }
      const key = new URL(f.path === 'index.html' ? './' : f.path, location.href).href;
      if (await cache.match(key)) { done += f.size; this.set({ done }); continue; }        // resume: already verified
      let buf;
      try { const r = await fetch(base + f.path + '?v=' + m.version, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); buf = await r.arrayBuffer(); }
      catch (e) { this.set({ state: 'interrupted', error: 'The download stopped (no connection). Tap Resume to carry on; ' + Math.round(done / 1024) + ' KB are kept.' }); return; }
      if ((await PetStore.sha256(buf)) !== f.sha256) { await caches.delete(m.cache); this.set({ state: 'failed', error: 'A downloaded file doesn\'t match the signed manifest (' + f.path + '), so the update was deleted and won\'t be installed.' }); return; }
      await cache.put(key, new Response(buf, { headers: { 'Content-Type': f.type || 'application/octet-stream' } }));
      done += f.size; this.set({ done });
    }
    this.set({ state: 'ready' });
  },
  async webInstall() {
    this.set({ state: 'installing' });
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) {
        await reg.update();
        const sw = reg.installing || reg.waiting;
        if (sw && sw.state !== 'activated') await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timed out')), 30000); sw.addEventListener('statechange', () => { if (sw.state === 'activated' || sw.state === 'installed') { clearTimeout(t); res(); } else if (sw.state === 'redundant') { clearTimeout(t); rej(new Error('the new version didn\'t install')); } }); });
      }
      S.updatePending = this.info.version; Store.save();
      this.set({ state: 'restart' });
    } catch (e) { this.set({ state: 'failed', error: 'Install failed: ' + e.message + '. Pets OS ' + PETS_VERSION + ' is still in use.' }); }
  },
  // ---- shared actions
  check(quiet) {
    S.lastUpdateCheck = Date.now(); Store.save();
    this.set({ state: 'checking', error: null });
    return new Promise(res => {
      this.waitCheck = res;
      if (onPhone) Phone.updateCheck();
      else this.webCheck().then(i => PetsOS.updateInfo(JSON.stringify(i))).catch(e => PetsOS.updateInfo(JSON.stringify({ error: e.kind === 'unsigned' ? e.message : navigator.onLine ? 'Couldn\'t check for updates: ' + e.message : 'Can\'t reach the update service. Check the internet connection.', kind: e.kind || (navigator.onLine ? 'check' : 'offline'), currentVersion: PETS_VERSION })));
    });
  },
  download() { this.pauseFlag = false; this.set({ error: null }); if (onPhone) Phone.updateDownload(); else this.webDownload(); },
  pause() { this.pauseFlag = true; if (onPhone) Phone.updatePause(); },
  install() { this.set({ error: null }); if (onPhone) Phone.updateInstall(); else this.webInstall(); },
  restart() { location.reload(); }
};
// Answers from the phone (Android) or the web check.
PetsOS.updateInfo = text => {
  const u = json(text, { error: 'bad answer' });
  SU.info = u.error ? SU.info : u;
  Updates.last = u;
  if (u.error) { SU.set({ state: u.kind === 'offline' ? 'offline' : 'failed', error: u.error }); }
  else if (u.available || u.versionCode > u.currentCode) {
    SU.set({ state: u.downloaded ? 'ready' : u.partial ? 'interrupted' : 'available', done: u.partial || 0, total: u.size || 0, error: u.partial ? 'A download was paused. Tap Resume to carry on.' : null });
    if (S.notifiedUpdate !== u.version) { S.notifiedUpdate = u.version; Store.save(); Shell.notify('Pets OS ' + u.version + ' is available', 'Open Settings › General › Software Update to install it.', { app: 'pets:settings', glyph: 'download' }); }
  } else SU.set({ state: 'none' });
  if (SU.waitCheck) { SU.waitCheck(u); SU.waitCheck = null; }
};
PetsOS.updateEvent = text => {
  const e = json(text, {});
  const p = { state: e.state, done: e.done, total: e.total, error: e.error || null };
  if (e.state === 'failed' || e.state === 'cancelled') SU.log({ version: e.version || (SU.info && SU.info.version), result: 'failed', detail: e.error });
  SU.set(p);
};
// Older pages call Updates.check(); keep it working with the new flow.
Updates.check = () => SU.check();
// After a restart: record an update that finished (or didn't).
(orig => { Shell.start = function () {
  orig.call(this);
  // The installed version: Android's own record on the phone, the web build's version elsewhere.
  const li = onPhone ? json(Phone.updateLastInstall(), {}) : {};
  const now = (onPhone && li.current) || PETS_VERSION;
  const prev = S.lastRunVersion;
  if (prev && prev !== now) {
    SU.log({ version: now, result: 'installed', detail: 'Updated from ' + prev });
    setTimeout(() => Shell.notify('Pets OS ' + now + ' is installed', 'Updated from ' + prev + '. Your settings and data are kept.', { app: 'pets:settings', glyph: 'circle-check' }), 2500);
  } else if (li.version && li.version !== now) {
    SU.log({ version: li.version, result: 'failed', detail: 'The install didn\'t finish; Pets OS ' + now + ' is still installed.' });
  }
  S.lastRunVersion = now; S.updatePending = null; Store.save();
}; })(Shell.start);

// ---------------------------------------------------------------- Settings › General › Software Update
(orig => { Apps.builtin['pets:settings'].open = function (w) {
  orig.call(this, w);
  Settings.pages.update = body => {
    const card = h('div', { class: 'card' });
    const head = h('div', { class: 'row', style: { padding: '16px' } }, h('div', { class: 'about-logo small' }),
      h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600, fontSize: '18px' }, text: 'Pets OS ' + PETS_VERSION }),
        h('div', { class: 'sub', text: (onPhone ? 'Installed on this phone' : 'Running on this ' + (/iPhone/.test(navigator.userAgent) ? 'iPhone' : 'device')) + (S.lastUpdateCheck ? ' · checked ' + Fmt.ago(S.lastUpdateCheck) : '') })));
    card.append(head);
    const box = h('div', { class: 'su-box' });
    body.append(card, box);
    const btn = (label, fn, cls) => { const b = h('button', { class: 'btn block ' + (cls || ''), html: label }); b.onclick = fn; return b; };
    const pct = s => s.total ? Math.min(100, Math.round(100 * (s.done || 0) / s.total)) : 0;
    const mb = n => (n / 1048576).toFixed(1) + ' MB';
    const render = s => {
      if (!box.isConnected) return;
      box.innerHTML = '';
      const i = SU.info;
      const notes = () => i && h('div', { class: 'card' }, h('div', { class: 'row', style: { display: 'block', padding: '16px', lineHeight: 1.5 } },
        h('div', { style: { fontWeight: 600, fontSize: '17px' }, text: 'Pets OS ' + i.version }),
        h('div', { class: 'sub', text: [i.size ? mb(i.size) : null, onPhone ? (i.restartRequired === false ? 'No restart needed' : 'Pets OS restarts to finish') : 'Pets OS restarts to finish', i.signed ? 'Signed by Should Be Media' : null].filter(Boolean).join(' · ') }),
        h('div', { class: 'su-notes', text: i.notes || '' })));
      const bar = () => h('div', { class: 'su-bar' }, h('i', { style: { width: pct(s) + '%' } }));
      switch (s.state) {
        case 'checking': box.append(h('div', { class: 'empty-state', style: { padding: '30px 20px' }, text: 'Checking for updates…' })); break;
        case 'none': box.append(h('div', { class: 'empty-state', style: { padding: '26px 20px' }, html: icon('circle-check') + '<br>Pets OS is up to date.' }), btn('Check again', () => SU.check(), 'secondary')); break;
        case 'available': box.append(notes(), btn(icon('download') + ' Download and install', () => SU.download())); break;
        case 'downloading': box.append(notes(), bar(), h('p', { class: 'set-note', style: { margin: '8px 6px 12px' }, text: 'Downloading… ' + pct(s) + '%' + (s.total ? ' (' + mb(s.done || 0) + ' of ' + mb(s.total) + ')' : '') + '. You can keep using the phone.' }), btn('Pause', () => SU.pause(), 'secondary')); break;
        case 'paused': case 'interrupted': box.append(notes(), bar(), h('p', { class: 'set-note', style: { margin: '8px 6px 12px' }, text: s.error || ('Paused at ' + pct(s) + '%.') }), btn('Resume', () => SU.download())); break;
        case 'verifying': box.append(notes(), bar(), h('p', { class: 'set-note', style: { margin: '8px 6px' }, text: 'Checking the update is genuine and complete…' })); break;
        case 'ready': box.append(notes(), h('p', { class: 'set-note', style: { margin: '0 6px 12px' }, text: onPhone ? 'Downloaded and checked. Android will ask you to confirm, then Pets OS restarts on the new version. Your data and settings are kept.' : 'Downloaded and checked. Pets OS restarts to finish; your data and settings are kept.' }), btn(icon('download') + ' Install now', () => SU.install())); break;
        case 'permission': box.append(notes(), h('p', { class: 'set-note', style: { margin: '0 6px 12px', color: 'var(--warn)' }, text: s.error }), btn('Install', () => SU.install())); break;
        case 'installing': case 'confirm': box.append(notes(), h('div', { class: 'empty-state', style: { padding: '24px 20px' }, text: s.state === 'confirm' ? 'Confirm the install in the Android window…' : 'Installing…' })); break;
        case 'restart': box.append(notes(), h('p', { class: 'set-note', style: { margin: '0 6px 12px' }, text: 'Pets OS ' + i.version + ' is ready. Restart to start using it.' }), btn('Restart Pets OS', () => SU.restart())); break;
        case 'installed': box.append(h('div', { class: 'empty-state', html: icon('circle-check') + '<br>Installed. Pets OS will restart.' })); break;
        case 'offline': case 'failed': case 'cancelled':
          box.append(h('div', { class: 'card su-error' }, h('div', { class: 'row', style: { display: 'block', padding: '14px 16px', lineHeight: 1.5 } }, h('b', { text: s.state === 'offline' ? 'You\'re offline' : s.state === 'cancelled' ? 'Install cancelled' : 'Update problem' }), h('div', { class: 'sub', text: s.error || '' }))));
          box.append(btn('Try again', () => SU.info && s.state !== 'offline' && /download|package|install|cancel/i.test(s.error || '') ? (/install|cancel/i.test(s.error) ? SU.install() : SU.download()) : SU.check())); break;
        default: box.append(btn('Check for updates', () => SU.check()));
      }
      const hist = SU.history();
      box.append(h('div', { class: 'label', text: 'Update history' }));
      const hc = h('div', { class: 'card' });
      if (!hist.length) hc.append(h('div', { class: 'row' }, h('div', { class: 'grow sub', text: 'No updates installed yet.' })));
      hist.slice(0, 10).forEach(e => hc.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { text: 'Pets OS ' + (e.version || '') + (e.result === 'installed' ? '' : ' (not installed)') }), h('div', { class: 'sub', text: e.detail || '' })), h('span', { class: 'val', text: new Date(e.at).toLocaleDateString() }))));
      box.append(hc);
      if (onPhone) box.append(h('p', { class: 'set-note', style: { marginTop: '10px' }, text: 'Updates are checked against Should Be Media\'s signature before they are installed. On this Android test phone, Android asks you to confirm each install (it does that for every app that isn\'t built into the phone).' }));
    };
    const off = SU.on(render);
    const obs = setInterval(() => { if (!box.isConnected) { off(); clearInterval(obs); } }, 1000);
    render(SU.st);
    if (['idle', 'none', 'offline', 'failed'].indexOf(SU.st.state) >= 0 && Date.now() - (S.lastUpdateCheck || 0) > 60000) SU.check();
  };
}; })(Apps.builtin['pets:settings'].open);
window.SU = SU;
