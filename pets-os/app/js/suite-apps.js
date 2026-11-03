// StepOS app suite: the new apps (Atlas, Nudge, Screenroom, Voice Pin, PocketPay, Beacon, Dropzone,
// Scanwise, Lingua, Assist, SafeLine, Step Update, Capture, Torch, and Burrow where Android Files can't run).
// Rule for every app: real data or a plain "not available here" panel; nothing is faked.
'use strict';

// ================================================================ Vault: files made inside Pets OS
// Voice pins, scans, downloads and videos live in IndexedDB on this device (never uploaded).
const Vault = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('petsos-vault', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  run(mode, fn) { return this.open().then(db => new Promise((res, rej) => { const q = fn(db.transaction('files', mode).objectStore('files')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); })); },
  all(kind) { return this.run('readonly', s => s.getAll()).then(l => l.filter(f => !kind || f.kind === kind).sort((a, b) => b.added - a.added)).catch(() => []); },
  get(id) { return this.run('readonly', s => s.get(id)).catch(() => null); },
  put(f) { return this.run('readwrite', s => s.put(f)); },
  del(id) { return this.run('readwrite', s => s.delete(id)).catch(() => {}); },
  async add(blob, name, kind, extra) {
    const f = Object.assign({ id: uid(), name, kind, type: blob.type || 'application/octet-stream', size: blob.size, blob, folder: '', added: Date.now() }, extra || {});
    try { await this.put(f); } catch (e) { throw new Error(/quota/i.test(String(e && e.name)) ? 'There isn\'t enough space for this file.' : 'The file couldn\'t be saved.'); }
    return f;
  }
};

// ================================================================ Downloads (Dropzone's records)
const Downloads = {
  list() { return Store.app('dropzone', []); },
  save(l) { Store.setApp('dropzone', l.slice(0, 200)); },
  record(o) { const l = this.list(); const e = Object.assign({ id: uid(), at: Date.now(), status: 'done' }, o); l.unshift(e); this.save(l); return e; },
  update(id, p) { const l = this.list(); const e = l.find(x => x.id === id); if (e) Object.assign(e, p); this.save(l); this.changed(); return e; },
  changed() { const w = Shell.windows.find(x => x.id === 'pets:dropzone'); if (w && !w.stack.length && !w.el.classList.contains('hidden')) w.refresh(); },
  // A download from a web address into Pets OS storage, with progress. Sites must allow it (CORS).
  async fetch(url) {
    let name = (url.split('?')[0].split('/').filter(Boolean).pop() || 'download').slice(0, 80);
    const e = this.record({ name, url, status: 'active', done: 0, total: 0, from: url.replace(/^https?:\/\//, '').split('/')[0] });
    this.changed();
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) throw new Error('The server answered ' + r.status + '.');
      const total = +r.headers.get('content-length') || 0;
      const cd = r.headers.get('content-disposition'); const m = cd && /filename="?([^";]+)/i.exec(cd); if (m) name = m[1];
      let blob;
      if (r.body && r.body.getReader) {
        const rd = r.body.getReader(), parts = []; let done = 0, last = 0;
        for (;;) { const { done: fin, value } = await rd.read(); if (fin) break; parts.push(value); done += value.length; if (Date.now() - last > 250) { last = Date.now(); this.update(e.id, { done, total }); } }
        blob = new Blob(parts, { type: r.headers.get('content-type') || '' });
      } else blob = await r.blob();
      const f = await Vault.add(blob, name, 'download', { url });
      this.update(e.id, { status: 'done', name, size: blob.size, type: blob.type, vault: f.id, path: 'Pets OS storage', done: blob.size, total: blob.size });
      Shell.notify('Download finished', name, { app: 'pets:dropzone' });
    } catch (err) {
      const why = err && err.message && !/Failed to fetch|NetworkError|Load failed/i.test(err.message) ? err.message : (navigator.onLine ? 'The site didn\'t allow Pets OS to download it, or it couldn\'t be reached.' : 'You\'re offline.');
      this.update(e.id, { status: 'failed', error: why });
    }
  }
};

// File preview shared by Burrow, Dropzone and Voice Pin.
const Preview = {
  open(w, f) {
    w.push(f.name, body => {
      const u = URL.createObjectURL(f.blob);
      const t = f.type || '';
      let el;
      if (t.startsWith('image/')) el = h('img', { src: u, alt: f.name, class: 'st-preview-img' });
      else if (t.startsWith('audio/') || f.kind === 'voice') el = h('audio', { src: u, controls: true, class: 'st-preview-media' });
      else if (t.startsWith('video/')) el = h('video', { src: u, controls: true, playsinline: true, class: 'st-preview-media' });
      else if (/^text\/|json|xml|csv|vcard/.test(t) || /\.(txt|md|csv|json|vcf)$/i.test(f.name)) { el = h('pre', { class: 'st-preview-text' }); f.blob.text().then(s => { el.textContent = s.slice(0, 20000); }); }
      else el = Ui.unavailable('file', 'No preview for this kind of file', (t || 'Unknown type') + ' · ' + Files.size(f.size || 0));
      body.append(el, Ui.card(Ui.row('Size', null, null, { val: Files.size(f.size || 0) }), Ui.row('Added', null, null, { val: new Date(f.added).toLocaleString() }), f.folder ? Ui.row('Folder', null, null, { val: f.folder }) : null));
      body.append(Ui.btn(icon('download') + ' Save to ' + (onPhone ? 'phone Downloads' : 'your downloads'), () => Ui.saveFile(f.blob, f.name), 'secondary'));
      const obs = setInterval(() => { if (!body.isConnected) { URL.revokeObjectURL(u); clearInterval(obs); } }, 2000);
    });
  }
};

// ================================================================ map (OpenStreetMap tiles) for Atlas and Beacon
const OSM = {
  tile: (z, x, y) => 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png',
  px(lat, lon, z) { const n = 256 * Math.pow(2, z), s = Math.sin(lat * Math.PI / 180); return { x: (lon + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n }; },
  ll(x, y, z) { const n = 256 * Math.pow(2, z); const lon = x / n * 360 - 180; const k = Math.PI - 2 * Math.PI * y / n; return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(k) - Math.exp(-k))), lon }; },
  // A draggable, zoomable map. Returns { el, set(lat,lon,z), marker(lat,lon,kind), route(coords), center() }.
  map(opts) {
    let lat = opts.lat, lon = opts.lon, z = opts.z || 13, markers = [], line = null;
    const el = h('div', { class: 'st-map', role: 'img', 'aria-label': 'Map' });
    const tiles = h('div', { class: 'st-map-tiles' }), over = h('canvas', { class: 'st-map-over' }), pins = h('div', { class: 'st-map-pins' });
    const attr = h('div', { class: 'st-map-attr', text: '© OpenStreetMap contributors' });
    const zin = h('button', { class: 'st-map-btn', html: icon('plus'), 'aria-label': 'Zoom in' }), zout = h('button', { class: 'st-map-btn', html: icon('minus'), 'aria-label': 'Zoom out' });
    el.append(tiles, over, pins, h('div', { class: 'st-map-zoom' }, zin, zout), attr);
    const draw = () => {
      const W = el.clientWidth, H = el.clientHeight; if (!W) return;
      const c = this.px(lat, lon, z), x0 = c.x - W / 2, y0 = c.y - H / 2, max = Math.pow(2, z);
      tiles.innerHTML = '';
      for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + W) / 256); tx++) for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + H) / 256); ty++) {
        if (ty < 0 || ty >= max) continue;
        const img = h('img', { src: this.tile(z, ((tx % max) + max) % max, ty), alt: '', draggable: 'false', style: { left: (tx * 256 - x0) + 'px', top: (ty * 256 - y0) + 'px' } });
        img.onerror = () => { img.style.visibility = 'hidden'; el.classList.add('st-map-offline'); };
        tiles.append(img);
      }
      pins.innerHTML = '';
      markers.forEach(m => { const p = this.px(m.lat, m.lon, z); pins.append(h('div', { class: 'st-pin ' + (m.kind || ''), style: { left: (p.x - x0) + 'px', top: (p.y - y0) + 'px' }, title: m.label || '' })); });
      over.width = W * 2; over.height = H * 2; over.style.width = W + 'px'; over.style.height = H + 'px';
      const g = over.getContext('2d'); g.scale(2, 2); g.clearRect(0, 0, W, H);
      if (line && line.length) { g.strokeStyle = '#2f7cf6'; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); line.forEach(([lo, la], i) => { const p = this.px(la, lo, z); i ? g.lineTo(p.x - x0, p.y - y0) : g.moveTo(p.x - x0, p.y - y0); }); g.stroke(); }
    };
    const setZ = nz => { z = Math.max(2, Math.min(18, nz)); draw(); };
    zin.onclick = () => setZ(z + 1); zout.onclick = () => setZ(z - 1);
    // Drag to pan, two fingers to zoom, double tap to zoom in.
    const pts = new Map(); let startD = 0, startZ = z, lastTap = 0;
    el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; startD = Math.hypot(a.x - b.x, a.y - b.y); startZ = z; } if (Date.now() - lastTap < 300) setZ(z + 1); lastTap = Date.now(); });
    el.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      if (pts.size === 1) { const c = this.px(lat, lon, z); const n = this.ll(c.x - (e.clientX - p.x), c.y - (e.clientY - p.y), z); lat = Math.max(-85, Math.min(85, n.lat)); lon = n.lon; draw(); }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && startD) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const nz = Math.round(startZ + Math.log2(d / startD)); if (nz !== z) setZ(nz); }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) startD = 0; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { e.preventDefault(); setZ(z + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
    setTimeout(draw, 0);
    return {
      el, draw,
      set(a, b, nz) { lat = a; lon = b; if (nz) z = nz; draw(); },
      marker(a, b, kind, label) { markers = markers.filter(m => m.kind !== kind); if (a != null) markers.push({ lat: a, lon: b, kind, label }); draw(); },
      route(c) { line = c; draw(); },
      fit(coords) { if (!coords || !coords.length) return; let [mnx, mny, mxx, mxy] = [180, 90, -180, -90]; coords.forEach(([x, y]) => { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }); lat = (mny + mxy) / 2; lon = (mnx + mxx) / 2; const W = el.clientWidth || 360, H = el.clientHeight || 300; for (z = 17; z > 2; z--) { const a = OSM.px(mxy, mnx, z), b = OSM.px(mny, mxx, z); if (b.x - a.x < W * 0.8 && b.y - a.y < H * 0.8) break; } draw(); },
      center() { return { lat, lon, z }; }
    };
  }
};
// Where this phone is (only after permission; the browser or Android asks).
const Locate = {
  async here() {
    if (!navigator.geolocation) throw new Error('This device doesn\'t share its location with Pets OS.');
    if (onPhone && !(await Need.ask('location'))) throw new Error('Location permission wasn\'t given. You can allow it in Settings › Apps.');
    return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, at: p.timestamp || Date.now() }),
      e => rej(new Error(e.code === 1 ? 'Location access was not allowed.' : e.code === 3 ? 'Finding the location took too long. Try again outside or near a window.' : 'The location isn\'t available right now.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }));
  }
};

// ================================================================ 9 Atlas (maps)
const Atlas = {
  data() { return Store.app('atlas', { saved: [], recent: [], last: null }); },
  save(d) { Store.setApp('atlas', d); },
  async search(q, near) {
    const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=' + encodeURIComponent(q) + (near ? '&viewbox=' + (near.lon - 1) + ',' + (near.lat + 1) + ',' + (near.lon + 1) + ',' + (near.lat - 1) : '');
    const r = await fetch(u, { headers: { 'Accept-Language': navigator.language || 'en' } });
    if (!r.ok) throw new Error('Place search answered ' + r.status);
    return (await r.json()).map(p => ({ name: p.name || p.display_name.split(',')[0], addr: p.display_name, lat: +p.lat, lon: +p.lon }));
  },
  async route(a, b, mode) {
    const prof = { car: 'routed-car', foot: 'routed-foot', bike: 'routed-bike' }[mode];
    const r = await fetch('https://routing.openstreetmap.de/' + prof + '/route/v1/driving/' + a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=full&geometries=geojson&steps=true');
    if (!r.ok) throw new Error('Route service answered ' + r.status);
    const j = await r.json();
    if (!j.routes || !j.routes.length) throw new Error('No route was found between these places.');
    return j.routes[0];
  },
  step(s) {
    const m = s.maneuver || {}, road = s.name ? ' onto ' + s.name : '';
    const mod = m.modifier ? m.modifier.replace('slight ', 'slightly ') : '';
    switch (m.type) {
      case 'depart': return 'Start' + (s.name ? ' on ' + s.name : '');
      case 'arrive': return 'Arrive at your destination';
      case 'roundabout': case 'rotary': return 'At the roundabout, take exit ' + (m.exit || 1) + road;
      case 'turn': case 'end of road': case 'fork': return 'Turn ' + mod + road;
      case 'merge': return 'Merge' + road;
      case 'new name': case 'continue': return 'Continue' + road;
      default: return (m.type ? m.type[0].toUpperCase() + m.type.slice(1) : 'Go') + (mod ? ' ' + mod : '') + road;
    }
  },
  dist: m => m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km' : Math.round(m / 10) * 10 + ' m',
  time: s => s >= 3600 ? Math.floor(s / 3600) + ' h ' + Math.round(s % 3600 / 60) + ' min' : Math.max(1, Math.round(s / 60)) + ' min'
};
Apps.register({
  id: 'pets:atlas', name: 'Atlas', cat: 'StepOS', keywords: 'maps',
  open(w) {
    const d0 = Atlas.data();
    let here = null, dest = null, mode = 'car';
    w.root(body => {
      body.classList.add('st-mapbody');
      const d = Atlas.data();
      const start = d.last || { lat: 51.5072, lon: -0.1276, z: 11 };
      const map = OSM.map({ lat: start.lat, lon: start.lon, z: start.z || 12 });
      w.map = map;
      const f = h('input', { class: 'field', type: 'search', placeholder: 'Search places', enterkeyhint: 'search', 'aria-label': 'Search places' });
      const results = h('div', { class: 'card hidden' });
      const panel = h('div', { class: 'st-sheet' });
      const status = h('div', { class: 'st-map-status', text: navigator.onLine ? 'Maps need the internet: map pictures from OpenStreetMap, search from Nominatim and routes from FOSSGIS.' : 'You\'re offline. Atlas needs the internet for maps, search and routes; there are no offline maps on this phone yet.' });
      const locBtn = h('button', { class: 'st-map-btn st-map-loc', html: icon('locate'), 'aria-label': 'Show my location' });
      map.el.append(locBtn);
      const remember = () => { const c = map.center(); const dd = Atlas.data(); dd.last = c; Atlas.save(dd); };
      locBtn.onclick = async () => {
        locBtn.classList.add('busy');
        try { here = await Locate.here(); map.set(here.lat, here.lon, 15); map.marker(here.lat, here.lon, 'me', 'You are here'); remember(); Shell.toast('Accurate to about ' + Atlas.dist(here.acc)); }
        catch (e) { Dialog.menu('Location unavailable', e.message, []); }
        locBtn.classList.remove('busy');
      };
      const showPlace = p => {
        dest = p; results.classList.add('hidden'); f.value = p.name;
        map.set(p.lat, p.lon, 15); map.marker(p.lat, p.lon, 'dest', p.name); map.route(null); remember();
        const dd = Atlas.data(); dd.recent = [p].concat(dd.recent.filter(x => x.addr !== p.addr)).slice(0, 12); Atlas.save(dd);
        panel.innerHTML = '';
        const saved = Atlas.data().saved.some(x => x.addr === p.addr);
        const go = h('button', { class: 'btn', html: icon('navigation') + ' Directions' }); go.onclick = () => directions();
        const sv = h('button', { class: 'btn secondary', html: icon('star') + (saved ? ' Saved' : ' Save') }); sv.onclick = () => { const dd = Atlas.data(); if (saved) dd.saved = dd.saved.filter(x => x.addr !== p.addr); else dd.saved.unshift(p); Atlas.save(dd); showPlace(p); };
        panel.append(h('b', { class: 'st-sheet-t', text: p.name }), h('div', { class: 'sub', text: p.addr }), h('div', { class: 'st-btnrow' }, go, sv));
      };
      const directions = async () => {
        if (!dest) return;
        panel.innerHTML = ''; panel.append(h('div', { class: 'sub', text: 'Finding where you are…' }));
        try { if (!here) here = await Locate.here(); } catch (e) { panel.innerHTML = ''; panel.append(h('b', { class: 'st-sheet-t', text: 'Directions need your starting point' }), h('div', { class: 'sub', text: e.message })); return; }
        map.marker(here.lat, here.lon, 'me');
        const modes = Ui.seg([['car', 'Drive'], ['foot', 'Walk'], ['bike', 'Cycle']], mode, v => { mode = v; directions(); });
        panel.innerHTML = ''; panel.append(modes, h('div', { class: 'sub', text: 'Planning the route…' }));
        try {
          const r = await Atlas.route(here, dest, mode);
          map.route(r.geometry.coordinates); map.fit(r.geometry.coordinates);
          panel.innerHTML = '';
          panel.append(modes, h('b', { class: 'st-sheet-t', text: Atlas.time(r.duration) + ' · ' + Atlas.dist(r.distance) }), h('div', { class: 'sub', text: 'To ' + dest.name + '. Route overview from OpenStreetMap data; there is no spoken turn-by-turn guidance.' }));
          const steps = h('div', { class: 'card st-steps' });
          r.legs[0].steps.forEach(s => steps.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { text: Atlas.step(s) })), h('span', { class: 'val', text: s.distance ? Atlas.dist(s.distance) : '' }))));
          panel.append(steps);
        } catch (e) { panel.innerHTML = ''; panel.append(modes, h('b', { class: 'st-sheet-t', text: 'No route' }), h('div', { class: 'sub', text: navigator.onLine ? e.message : 'You\'re offline.' })); }
      };
      const doSearch = async () => {
        const q = f.value.trim(); if (!q) return;
        results.innerHTML = ''; results.classList.remove('hidden');
        results.append(h('div', { class: 'row sub', text: 'Searching…' }));
        try {
          const l = await Atlas.search(q, here || map.center());
          results.innerHTML = '';
          if (!l.length) results.append(h('div', { class: 'row sub', text: 'No places match "' + q + '"' }));
          l.forEach(p => { const r = Ui.row(p.name, p.addr, () => showPlace(p)); results.append(r); });
        } catch (e) { results.innerHTML = ''; results.append(h('div', { class: 'row sub', text: navigator.onLine ? 'Search isn\'t available right now (' + e.message + ').' : 'You\'re offline. Search needs the internet.' })); }
      };
      f.addEventListener('keydown', e => { if (e.key === 'Enter') { f.blur(); doSearch(); } });
      const quick = () => {
        panel.innerHTML = '';
        const dd = Atlas.data();
        if (dd.saved.length) { panel.append(h('div', { class: 'label', text: 'Saved places' })); const c = h('div', { class: 'card' }); dd.saved.slice(0, 6).forEach(p => c.append(Ui.row(p.name, p.addr, () => showPlace(p), { glyph: 'star', colour: '#227a6f' }))); panel.append(c); }
        if (dd.recent.length) { panel.append(h('div', { class: 'label', text: 'Recent' })); const c = h('div', { class: 'card' }); dd.recent.slice(0, 5).forEach(p => c.append(Ui.row(p.name, p.addr, () => showPlace(p), { glyph: 'clock', colour: '#4a5162' }))); panel.append(c); }
        panel.append(status);
      };
      body.append(h('div', { class: 'st-mapsearch' }, f), results, map.el, panel);
      quick();
      w.onBack = () => { if (dest) { dest = null; f.value = ''; map.marker(null, null, 'dest'); map.route(null); quick(); return true; } return false; };
    });
    void d0;
    w.onShow = () => { if (w.map) w.map.draw(); };
  }
});

// ================================================================ 16 Nudge (reminders and tasks)
const Nudge = {
  data() { return Store.app('nudge', { lists: [{ id: 'inbox', name: 'Reminders' }], tasks: [] }); },
  save(d) { Store.setApp('nudge', d); },
  add(t) { const d = this.data(); const x = Object.assign({ id: uid(), title: '', notes: '', due: null, repeat: 'none', done: false, list: 'inbox', created: Date.now(), flag: false }, t); d.tasks.unshift(x); this.save(d); return x; },
  next(due, rep) { const d = new Date(due); if (rep === 'daily') d.setDate(d.getDate() + 1); else if (rep === 'weekly') d.setDate(d.getDate() + 7); else if (rep === 'monthly') d.setMonth(d.getMonth() + 1); else if (rep === 'weekdays') { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); } return d.getTime(); },
  // Completing a repeating task moves it to its next date instead of closing it.
  complete(id, on) {
    const d = this.data(), t = d.tasks.find(x => x.id === id); if (!t) return null;
    if (on && t.repeat !== 'none' && t.due) { t.due = this.next(t.due, t.repeat); t.notified = false; t.lastDone = Date.now(); }
    else { t.done = !!on; t.doneAt = on ? Date.now() : null; }
    this.save(d); return t;
  },
  // Due reminders alert once (also as an Android notification when Pets OS isn't on screen).
  tick() {
    const d = this.data(), now = Date.now(); let ch = false;
    d.tasks.forEach(t => { if (!t.done && t.due && t.due <= now && !t.notified) { t.notified = true; ch = true; Shell.notify(t.title || 'Reminder', 'Nudge · due ' + Fmt.time(new Date(t.due)), { app: 'pets:nudge', system: true }); } });
    if (ch) { this.save(d); const w = Shell.windows.find(x => x.id === 'pets:nudge'); if (w && !w.stack.length) w.refresh(); }
  },
  whenText(t) {
    if (!t.due) return '';
    const d = new Date(t.due), k = Calendar.key(d), today = Calendar.key(new Date()), tom = Calendar.key(new Date(Date.now() + 864e5));
    return (k === today ? 'Today' : k === tom ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })) + ' ' + Fmt.time(d) + (t.repeat !== 'none' ? ' · repeats ' + t.repeat : '');
  }
};
setInterval(() => Nudge.tick(), 15000);
Apps.register({
  id: 'pets:nudge', name: 'Nudge', cat: 'StepOS', keywords: 'reminders',
  badge: () => { const n = Nudge.data().tasks.filter(t => !t.done && t.due && t.due <= Date.now()).length; return n || null; },
  open(w) {
    let view = 'today';
    const local = ts => { if (!ts) return ''; const d = new Date(ts); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
    const edit = t => w.push(t ? 'Edit Reminder' : 'New Reminder', body => {
      const d = Nudge.data();
      const x = t ? d.tasks.find(y => y.id === t.id) : { title: '', notes: '', due: null, repeat: 'none', list: view.startsWith('list:') ? view.slice(5) : 'inbox' };
      const title = h('input', { class: 'field', placeholder: 'Title', value: x.title, 'aria-label': 'Title' });
      const notes = h('textarea', { class: 'field st-ta', placeholder: 'Notes', 'aria-label': 'Notes' }); notes.value = x.notes || '';
      const due = h('input', { class: 'field', type: 'datetime-local', value: local(x.due), 'aria-label': 'Due date and time' });
      const rep = h('select', { class: 'field', 'aria-label': 'Repeat' }); [['none', 'Never'], ['daily', 'Every day'], ['weekdays', 'Weekdays'], ['weekly', 'Every week'], ['monthly', 'Every month']].forEach(([v, l]) => rep.append(h('option', { value: v, text: l, selected: x.repeat === v ? true : null })));
      const list = h('select', { class: 'field', 'aria-label': 'List' }); d.lists.forEach(l => list.append(h('option', { value: l.id, text: l.name, selected: x.list === l.id ? true : null })));
      body.append(Ui.label('Reminder'), h('div', { class: 'st-form' }, title, notes), Ui.label('When'), h('div', { class: 'st-form' }, due, rep), Ui.label('List'), h('div', { class: 'st-form' }, list));
      const save = () => {
        if (!title.value.trim()) { Shell.toast('Give the reminder a title'); return; }
        const dd = Nudge.data(); const v = { title: title.value.trim(), notes: notes.value, due: due.value ? new Date(due.value).getTime() : null, repeat: due.value ? rep.value : 'none', list: list.value, notified: false };
        if (t) Object.assign(dd.tasks.find(y => y.id === t.id), v), Nudge.save(dd); else Nudge.add(v);
        if (v.due && onPhone && !Phone.hasPermission('notifications') && Phone.askPermission) Phone.askPermission('notifications');
        w.back(); w.refresh();
      };
      w.actions([{ label: 'Save', fn: save }]);
      if (t) { const del = h('button', { class: 'btn block secondary', text: 'Delete Reminder', style: { color: 'var(--danger)', marginTop: '18px' } }); del.onclick = async () => { if (await Dialog.confirm('Delete this reminder?', null, 'Delete', true)) { const dd = Nudge.data(); dd.tasks = dd.tasks.filter(y => y.id !== t.id); Nudge.save(dd); w.back(); w.refresh(); } }; body.append(del); }
      body.append(Ui.note('Reminders alert while Pets OS is running; it\'s the Home app on a Stephone, so normally always. On Android they also appear as notifications.'));
      if (!t) setTimeout(() => title.focus(), 200);
    });
    w.root(body => {
      const d = Nudge.data(), now = Date.now(), endToday = new Date(); endToday.setHours(23, 59, 59, 999);
      w.actions([{ icon: 'plus', label: 'New reminder', fn: () => edit(null) }]);
      const filters = { today: t => !t.done && t.due && t.due <= endToday.getTime(), scheduled: t => !t.done && t.due, all: t => !t.done, done: t => t.done };
      const counts = k => d.tasks.filter(filters[k]).length;
      const tiles = h('div', { class: 'st-smarts' });
      [['today', 'Today', 'sun', '#2f7cf6'], ['scheduled', 'Scheduled', 'calendar', '#d8434f'], ['all', 'All', 'inbox', '#4a5162'], ['done', 'Completed', 'check', '#2e9b6a']].forEach(([k, l, g, c]) => {
        const b = h('button', { class: 'st-smart' + (view === k ? ' on' : ''), 'aria-label': l + ', ' + counts(k) }, h('span', { class: 'sq', style: { background: c }, html: icon(g) }), h('b', { text: String(counts(k)) }), h('span', { text: l }));
        b.onclick = () => { view = k; w.refresh(); }; tiles.append(b);
      });
      body.append(tiles);
      let items = view.startsWith('list:') ? d.tasks.filter(t => t.list === view.slice(5) && !t.done) : d.tasks.filter(filters[view]);
      items = items.sort((a, b) => (a.due || 9e15) - (b.due || 9e15));
      const titleOf = { today: 'Today', scheduled: 'Scheduled', all: 'All', done: 'Completed' }[view] || (d.lists.find(l => 'list:' + l.id === view) || {}).name;
      body.append(Ui.label(titleOf || 'Reminders'));
      if (!items.length) body.append(Ui.empty('list-checks', view === 'done' ? 'Nothing completed yet.' : 'Nothing here.', view === 'done' ? null : 'Tap + to add a reminder.'));
      else {
        const card = h('div', { class: 'card' });
        items.slice(0, 200).forEach(t => {
          const late = !t.done && t.due && t.due < now;
          const chk = h('button', { class: 'st-check' + (t.done ? ' on' : ''), role: 'checkbox', 'aria-checked': t.done ? 'true' : 'false', 'aria-label': 'Complete ' + t.title, html: t.done ? icon('check') : '' });
          chk.onclick = e => { e.stopPropagation(); const r = Nudge.complete(t.id, !t.done); if (r && r.repeat !== 'none' && !r.done) Shell.toast('Next: ' + Nudge.whenText(r)); w.refresh(); };
          const r = h('div', { class: 'row' }, chk, h('div', { class: 'grow' }, h('div', { text: t.title, class: t.done ? 'st-done' : '' }), t.due ? h('div', { class: 'sub', text: Nudge.whenText(t), style: late ? { color: 'var(--danger)' } : null }) : null, t.notes ? h('div', { class: 'sub', text: t.notes.slice(0, 80) }) : null));
          press(r, () => edit(t));
          card.append(r);
        });
        body.append(card);
      }
      body.append(Ui.label('My lists'));
      const lc = h('div', { class: 'card' });
      d.lists.forEach(l => {
        const n = d.tasks.filter(t => t.list === l.id && !t.done).length;
        const r = Ui.row(l.name, null, () => { view = 'list:' + l.id; w.refresh(); }, { glyph: 'list-checks', colour: '#c25a2c', val: String(n) });
        if (l.id !== 'inbox') press(r, () => { view = 'list:' + l.id; w.refresh(); }, () => Dialog.menu(l.name, null, [{ label: 'Rename list', fn: async () => { const v = await Dialog.prompt('Rename list', null, l.name); if (v && v.trim()) { const dd = Nudge.data(); dd.lists.find(x => x.id === l.id).name = v.trim(); Nudge.save(dd); w.refresh(); } } }, { label: 'Delete list', danger: true, fn: async () => { if (await Dialog.confirm('Delete "' + l.name + '"?', 'Its reminders move to Reminders.', 'Delete', true)) { const dd = Nudge.data(); dd.lists = dd.lists.filter(x => x.id !== l.id); dd.tasks.forEach(t => { if (t.list === l.id) t.list = 'inbox'; }); Nudge.save(dd); view = 'today'; w.refresh(); } } }]));
        lc.append(r);
      });
      lc.append(Ui.row('New list…', null, async () => { const v = await Dialog.prompt('New list', null, ''); if (v && v.trim()) { const dd = Nudge.data(); dd.lists.push({ id: uid(), name: v.trim() }); Nudge.save(dd); w.refresh(); } }, { glyph: 'plus', colour: '#4a5162' }));
      body.append(lc);
      if (view === 'done' && items.length) body.append(Ui.btn('Clear completed', async () => { if (await Dialog.confirm('Clear all completed reminders?', null, 'Clear', true)) { const dd = Nudge.data(); dd.tasks = dd.tasks.filter(t => !t.done); Nudge.save(dd); w.refresh(); } }, 'secondary'));
    });
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// ================================================================ 18 Screenroom (videos)
Apps.register({
  id: 'pets:screenroom', name: 'Screenroom', cat: 'StepOS', keywords: 'videos',
  open(w) {
    const pos = () => Store.app('screenroom.pos', {});
    const picker = h('input', { type: 'file', accept: 'video/*', style: { display: 'none' } });
    w.el.append(picker);
    picker.onchange = async () => {
      const f = picker.files && picker.files[0]; picker.value = ''; if (!f) return;
      Shell.toast('Adding ' + f.name + '…');
      try { await Vault.add(f, f.name, 'video', { type: f.type || 'video/mp4' }); w.refresh(); } catch (e) { Dialog.menu('Couldn\'t add the video', e.message, []); }
    };
    const play = v => w.push(v.name, body => {
      body.classList.add('st-dark');
      const u = URL.createObjectURL(v.blob);
      const vid = h('video', { src: u, controls: true, playsinline: true, class: 'st-player', 'aria-label': v.name });
      const p = pos()[v.id];
      vid.addEventListener('loadedmetadata', () => { if (p && p < vid.duration - 5) { vid.currentTime = p; Shell.toast('Resuming at ' + Fmt.dur(p * 1000)); } });
      let last = 0;
      const keep = () => { if (Math.abs(vid.currentTime - last) < 3) return; last = vid.currentTime; const all = pos(); all[v.id] = vid.ended ? 0 : vid.currentTime; Store.setApp('screenroom.pos', all); };
      vid.addEventListener('timeupdate', keep); vid.addEventListener('pause', () => { last = -10; keep(); });
      const btn = (g, label, fn) => { const b = h('button', { class: 'st-pbtn', html: icon(g) + '<span>' + label + '</span>', 'aria-label': label }); b.onclick = fn; return b; };
      const speeds = [1, 1.25, 1.5, 2, 0.75]; let si = 0;
      const sp = btn('timer', '1×', () => { si = (si + 1) % speeds.length; vid.playbackRate = speeds[si]; sp.querySelector('span').textContent = speeds[si] + '×'; });
      body.append(vid, h('div', { class: 'st-pbar' }, btn('skip-back', '−10 s', () => { vid.currentTime = Math.max(0, vid.currentTime - 10); }), btn(vid.paused ? 'play' : 'pause', 'Play/Pause', () => { vid.paused ? vid.play() : vid.pause(); }), btn('skip-forward', '+10 s', () => { vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10); }), sp));
      vid.addEventListener('error', () => body.append(Ui.unavailable('film', 'This video can\'t be played here', 'Pets OS plays the formats this device\'s web engine supports (usually MP4/H.264 and WebM).')));
      const obs = setInterval(() => { if (!body.isConnected) { vid.pause(); URL.revokeObjectURL(u); clearInterval(obs); } }, 1000);
    });
    w.root(body => {
      w.actions([{ icon: 'plus', label: 'Add a video', fn: () => picker.click() }]);
      body.append(Ui.note('Videos you add are kept in Pets OS on this device, and Screenroom remembers where you stopped.'));
      const box = h('div', { class: 'st-vgrid' }); body.append(box);
      Promise.all([Vault.all('video'), Moments.all().catch(() => [])]).then(([vs, ms]) => {
        const fromMoments = ms.filter(m => m.blob && /^video\//.test(m.blob.type)).map(m => ({ id: 'm:' + m.id, name: m.name || 'Video', blob: m.blob, added: m.added, size: m.blob.size, moments: true }));
        const all = vs.concat(fromMoments).sort((a, b) => b.added - a.added);
        if (!all.length) { box.append(Ui.empty('film', 'No videos yet', 'Tap + to add one from this phone. Videos you record in Shutter appear here too.')); return; }
        const p = pos();
        all.forEach(v => {
          const cell = h('div', { class: 'st-vcell', role: 'button', 'aria-label': 'Play ' + v.name });
          const th = h('video', { muted: true, preload: 'metadata', playsinline: true, class: 'st-vthumb' });
          const u = URL.createObjectURL(v.blob); th.src = u + '#t=1';
          const bar = p[v.id] ? h('i', { class: 'st-vprog' }) : null;
          th.addEventListener('loadedmetadata', () => { if (bar && th.duration) bar.style.width = Math.min(100, p[v.id] / th.duration * 100) + '%'; dur.textContent = Fmt.dur(th.duration * 1000); });
          const dur = h('span', { class: 'st-vdur' });
          cell.append(h('div', { class: 'st-vframe' }, th, dur, bar ? h('div', { class: 'st-vtrack' }, bar) : null), h('div', { class: 'st-vname', text: v.name }), h('div', { class: 'sub', text: (v.moments ? 'From Moments · ' : '') + Files.size(v.size || 0) }));
          press(cell, () => play(v), v.moments ? null : () => Dialog.menu(v.name, null, [{ label: 'Rename', fn: async () => { const n = await Dialog.prompt('Rename video', null, v.name); if (n && n.trim()) { const f = await Vault.get(v.id); f.name = n.trim(); await Vault.put(f); w.refresh(); } } }, { label: 'Delete', danger: true, fn: async () => { if (await Dialog.confirm('Delete "' + v.name + '"?', 'It is removed from Pets OS. Copies elsewhere aren\'t touched.', 'Delete', true)) { await Vault.del(v.id); w.refresh(); } } }]));
          box.append(cell);
        });
      });
      if (onPhone && Phone.storageAllowed()) {
        const list = json(Phone.listFiles('Movies'), null);
        const vids = (list || []).filter(f => !f.dir && /\.(mp4|m4v|webm|mkv|3gp|mov)$/i.test(f.name));
        if (vids.length) { body.append(Ui.label('Movies folder on this phone')); const c = h('div', { class: 'card' }); vids.slice(0, 40).forEach(f => c.append(Ui.row(f.name, Files.size(f.size) + ' · opens in the phone\'s player', () => Phone.openFile('Movies/' + f.name) || Shell.toast('No app can play this')))); body.append(c); }
      }
    });
    w.onHide = () => $$('video', w.el).forEach(v => v.pause());
  }
});

// ================================================================ 19 Voice Pin (recorder)
const VoicePin = {
  rec: null, chunks: [], stream: null, started: 0,
  supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
  async start() {
    if (!(await Need.ask('mic'))) throw new Error('Microphone permission wasn\'t given. You can allow it in Settings › Apps › Voice Pin.');
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { throw new Error(e && e.name === 'NotAllowedError' ? 'Microphone access was not allowed.' : e && e.name === 'NotFoundError' ? 'No microphone was found on this device.' : 'The microphone isn\'t available right now.'); }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    this.rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    this.chunks = []; this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.rec.start(1000); this.started = Date.now();
    return this.stream;
  },
  stop() {
    return new Promise(res => {
      if (!this.rec) { res(null); return; }
      const r = this.rec;
      r.onstop = () => { const blob = new Blob(this.chunks, { type: r.mimeType || 'audio/webm' }); this.stream.getTracks().forEach(t => t.stop()); this.rec = null; this.stream = null; res({ blob, ms: Date.now() - this.started }); };
      try { r.stop(); } catch (e) { res(null); }
    });
  },
  ext(type) { return /mp4/.test(type) ? 'm4a' : /ogg/.test(type) ? 'ogg' : 'webm'; }
};
Apps.register({
  id: 'pets:voicepin', name: 'Voice Pin', cat: 'StepOS', keywords: 'voice recorder',
  open(w) {
    let meterRAF = 0;
    w.root(body => {
      if (!VoicePin.supported()) body.append(Ui.unavailable('mic', 'Recording isn\'t available here', 'This device\'s web engine doesn\'t give Pets OS a microphone recorder.', 'getUserMedia and MediaRecorder'));
      const recording = !!VoicePin.rec;
      const time = h('div', { class: 'st-rec-time', text: recording ? Fmt.dur(Date.now() - VoicePin.started) : '0:00' });
      const meter = h('canvas', { class: 'st-meter', width: 600, height: 80, 'aria-hidden': 'true' });
      const btn = h('button', { class: 'st-recbtn' + (recording ? ' on' : ''), 'aria-label': recording ? 'Stop recording' : 'Start recording' }, h('i'));
      const tick = setInterval(() => { if (!body.isConnected) { clearInterval(tick); return; } if (VoicePin.rec) time.textContent = Fmt.dur(Date.now() - VoicePin.started); }, 250);
      const drawMeter = stream => {
        try {
          const ac = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser(); an.fftSize = 256;
          ac.createMediaStreamSource(stream).connect(an);
          const buf = new Uint8Array(an.frequencyBinCount), g = meter.getContext('2d');
          const loop = () => { if (!VoicePin.rec || !meter.isConnected) { ac.close(); return; } an.getByteTimeDomainData(buf); g.clearRect(0, 0, 600, 80); g.fillStyle = '#3ad1c9'; for (let i = 0; i < 60; i++) { const v = Math.abs(buf[i * 2] - 128) / 128; const hh = Math.max(3, v * 76); g.fillRect(i * 10, 40 - hh / 2, 6, hh); } meterRAF = requestAnimationFrame(loop); };
          loop();
        } catch (e) { /* meter is optional */ }
      };
      btn.onclick = async () => {
        if (!VoicePin.rec) {
          try { const s = await VoicePin.start(); btn.classList.add('on'); btn.setAttribute('aria-label', 'Stop recording'); drawMeter(s); }
          catch (e) { Dialog.menu('Can\'t record', e.message, []); }
          return;
        }
        cancelAnimationFrame(meterRAF);
        const r = await VoicePin.stop(); btn.classList.remove('on');
        if (!r || !r.blob.size) { Shell.toast('Nothing was recorded'); w.refresh(); return; }
        const n = (Store.app('voicepin.n', 0) || 0) + 1; Store.setApp('voicepin.n', n);
        const name = await Dialog.prompt('Name this recording', null, 'Recording ' + n) || 'Recording ' + n;
        try { await Vault.add(r.blob, name.trim() || 'Recording ' + n, 'voice', { ms: r.ms }); Shell.toast('Saved'); } catch (e) { Dialog.menu('Not saved', e.message, []); }
        w.refresh();
      };
      body.append(h('div', { class: 'st-rec' }, time, meter, btn, h('div', { class: 'sub', text: recording ? 'Recording… tap to stop' : 'Tap to record. Recordings stay on this device.' })));
      const list = h('div'); body.append(list);
      Vault.all('voice').then(items => {
        if (!items.length) { list.append(Ui.empty('mic', 'No recordings yet')); return; }
        list.append(Ui.label('Recordings'));
        const card = h('div', { class: 'card' });
        items.forEach(f => {
          const r = Ui.row(f.name, new Date(f.added).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + Fmt.dur(f.ms || 0), null, { glyph: 'mic', colour: '#147a83' });
          const pl = h('button', { class: 'st-iconbtn', html: icon('play'), 'aria-label': 'Play ' + f.name });
          let audio = null;
          pl.onclick = e => { e.stopPropagation(); if (audio && !audio.paused) { audio.pause(); pl.innerHTML = icon('play'); return; } const u = URL.createObjectURL(f.blob); audio = new Audio(u); audio.onended = () => { pl.innerHTML = icon('play'); URL.revokeObjectURL(u); }; audio.play().then(() => { pl.innerHTML = icon('pause'); }).catch(() => Shell.toast('This recording can\'t be played here')); };
          r.append(pl);
          press(r, () => Preview.open(w, f), () => Dialog.menu(f.name, null, [
            { label: 'Rename', fn: async () => { const v = await Dialog.prompt('Rename', null, f.name); if (v && v.trim()) { f.name = v.trim(); await Vault.put(f); w.refresh(); } } },
            { label: 'Export', fn: () => Ui.saveFile(f.blob, f.name.replace(/[^\w\- ]+/g, '') + '.' + VoicePin.ext(f.type)) },
            { label: 'Delete', danger: true, fn: async () => { if (await Dialog.confirm('Delete "' + f.name + '"?', null, 'Delete', true)) { await Vault.del(f.id); w.refresh(); } } }
          ]));
          card.append(r);
        });
        list.append(card);
      });
    });
    w.onQuit = () => { if (VoicePin.rec) VoicePin.stop(); };
  }
});

// ================================================================ 20 PocketPay (cards and passes; no fake payments)
const EAN = {
  L: ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'],
  P: ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'],
  check(d12) { let s = 0; for (let i = 0; i < 12; i++) s += +d12[i] * (i % 2 ? 3 : 1); return String((10 - s % 10) % 10); },
  // 12 or 13 digits -> bars (1 = black module), or null when the number isn't an EAN-13.
  bars(num) {
    num = String(num).replace(/\D/g, '');
    if (num.length === 12) num += this.check(num);
    if (num.length !== 13 || this.check(num.slice(0, 12)) !== num[12]) return null;
    const R = c => c.split('').map(b => b === '1' ? '0' : '1').join('');
    let bits = '101';
    for (let i = 1; i <= 6; i++) { const L = this.L[+num[i]]; bits += this.P[+num[0]][i - 1] === 'L' ? L : R(L).split('').reverse().join(''); }
    bits += '01010';
    for (let i = 7; i <= 12; i++) bits += R(this.L[+num[i]]);
    return bits + '101';
  },
  svg(num) { const b = this.bars(num); if (!b) return null; let r = ''; for (let i = 0; i < b.length; i++) if (b[i] === '1') r += '<rect x="' + (i + 9) + '" y="0" width="1" height="60"/>'; return '<svg viewBox="0 0 113 60" preserveAspectRatio="none" class="st-ean" fill="#000" role="img" aria-label="Barcode ' + num + '">' + r + '</svg>'; }
};
Apps.register({
  id: 'pets:pocketpay', name: 'PocketPay', cat: 'StepOS', keywords: 'wallet',
  open(w) {
    const data = () => Store.app('pocketpay', { cards: [] });
    const edit = c => w.push(c ? 'Edit Card' : 'Add a Card', body => {
      const name = h('input', { class: 'field', placeholder: 'Card name (e.g. Library, Gym)', value: c ? c.name : '', 'aria-label': 'Card name' });
      const num = h('input', { class: 'field', placeholder: 'Card or member number', value: c ? c.number : '', inputmode: 'text', 'aria-label': 'Card number' });
      const colour = h('select', { class: 'field', 'aria-label': 'Colour' }); [['#24486d', 'Navy'], ['#1f6f5c', 'Green'], ['#7a2e3c', 'Wine'], ['#3d3f48', 'Graphite'], ['#8a5a1c', 'Amber']].forEach(([v, l]) => colour.append(h('option', { value: v, text: l, selected: c && c.colour === v ? true : null })));
      body.append(h('div', { class: 'st-form' }, name, num, colour), Ui.note('Loyalty, library and membership cards. A 12 or 13-digit number shows as a barcode the till can scan; other numbers are shown large to read out or type.'));
      w.actions([{ label: 'Save', fn: () => { if (!name.value.trim() || !num.value.trim()) { Shell.toast('Add a name and a number'); return; } const d = data(); if (c) Object.assign(d.cards.find(x => x.id === c.id), { name: name.value.trim(), number: num.value.trim(), colour: colour.value }); else d.cards.push({ id: uid(), name: name.value.trim(), number: num.value.trim(), colour: colour.value, added: Date.now() }); Store.setApp('pocketpay', d); w.back(); w.refresh(); } }]);
      if (c) body.append(Ui.btn('Delete card', async () => { if (await Dialog.confirm('Delete "' + c.name + '"?', null, 'Delete', true)) { const d = data(); d.cards = d.cards.filter(x => x.id !== c.id); Store.setApp('pocketpay', d); w.back(); w.refresh(); } }, 'secondary'));
    });
    const show = c => w.push(c.name, body => {
      const bars = EAN.svg(c.number);
      body.append(h('div', { class: 'st-pass', style: { background: c.colour } }, h('div', { class: 'st-pass-n', text: c.name }), h('div', { class: 'st-pass-code' }, bars ? h('div', { html: bars }) : null, h('div', { class: 'st-pass-num', text: c.number }))));
      body.append(Ui.note(bars ? 'Turn your screen brightness up if the scanner can\'t read it.' : 'This number isn\'t an EAN-13 barcode, so it\'s shown to read out or type in.'));
      w.actions([{ icon: 'pencil', label: 'Edit card', fn: () => edit(c) }]);
    });
    w.root(body => {
      w.actions([{ icon: 'plus', label: 'Add a card', fn: () => edit(null) }]);
      body.append(h('div', { class: 'st-notice' }, h('span', { html: icon('info') }), h('div', null, h('b', { text: 'Payments aren\'t set up' }), h('div', { text: 'Tap-to-pay needs a payment provider and secure hardware that Pets OS doesn\'t have yet, so PocketPay never takes or shows payments. It keeps your cards and passes.' }))));
      const d = data();
      if (!d.cards.length) { body.append(Ui.empty('wallet', 'No cards yet', 'Tap + to add a loyalty or membership card.')); return; }
      const stack = h('div', { class: 'st-cards' });
      d.cards.forEach(c => { const el = h('div', { class: 'st-cardmini', style: { background: c.colour }, role: 'button', 'aria-label': c.name }, h('b', { text: c.name }), h('span', { text: '•••• ' + c.number.slice(-4) })); press(el, () => show(c), () => edit(c)); stack.append(el); });
      body.append(stack);
    });
  }
});

// ================================================================ 21 Beacon (find my device)
Apps.register({
  id: 'pets:beacon', name: 'Beacon', cat: 'StepOS', keywords: 'find my device',
  open(w) {
    let tone = null;
    const ring = on => {
      if (!on) { if (tone) { tone.stop(); tone = null; } return; }
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain();
        o.type = 'square'; o.frequency.value = 1320; g.gain.value = 0; o.connect(g); g.connect(ac.destination); o.start();
        const iv = setInterval(() => { const t = ac.currentTime; g.gain.setValueAtTime(0.25, t); g.gain.setValueAtTime(0, t + 0.18); g.gain.setValueAtTime(0.25, t + 0.3); g.gain.setValueAtTime(0, t + 0.48); }, 900);
        tone = { stop() { clearInterval(iv); o.stop(); ac.close(); } };
      } catch (e) { Shell.toast('Sound isn\'t available'); }
    };
    w.root(body => {
      const dev = json(Phone.device(), {}), b = json(Phone.battery(), {});
      const last = Store.app('beacon.last', null);
      const map = OSM.map({ lat: last ? last.lat : 51.5072, lon: last ? last.lon : -0.1276, z: last ? 15 : 5 });
      map.el.classList.add('st-map-small');
      if (last) map.marker(last.lat, last.lon, 'me');
      const where = h('div', { class: 'sub', text: last ? 'Last located ' + Fmt.ago(last.at) + ' · accurate to about ' + Atlas.dist(last.acc) : 'Not located yet' });
      const locate = Ui.btn(icon('locate') + ' Locate this phone', async () => {
        where.textContent = 'Locating…';
        try { const p = await Locate.here(); Store.setApp('beacon.last', p); map.set(p.lat, p.lon, 16); map.marker(p.lat, p.lon, 'me'); where.textContent = 'Located just now · accurate to about ' + Atlas.dist(p.acc); }
        catch (e) { where.textContent = e.message; }
      });
      const sound = h('button', { class: 'btn block secondary', html: icon('volume-2') + ' Play a sound' });
      sound.onclick = () => { const on = !tone; ring(on); sound.innerHTML = icon(on ? 'volume-x' : 'volume-2') + (on ? ' Stop the sound' : ' Play a sound'); };
      body.append(h('div', { class: 'st-devhead' }, h('div', { class: 'st-devname', text: (S.name ? S.name + '\'s ' : '') + (isStephone ? 'Stephone' : (dev.model || 'phone')) }),
        h('div', { class: 'sub', text: [b.level >= 0 ? 'Battery ' + b.level + '%' : null, Phone.network() === 'none' ? 'Offline' : 'Online'].filter(Boolean).join(' · ') })), map.el, where, locate, sound);
      body.append(Ui.label('Finding it from another device'));
      body.append(h('div', { class: 'st-notice' }, h('span', { html: icon('info') }), h('div', null, h('b', { text: 'Remote finding isn\'t available yet' }), h('div', { text: 'Seeing this phone from somewhere else needs a Pets OS account location service, which doesn\'t exist yet. Pets OS never sends your location anywhere.' + (onPhone ? ' On this Android test phone, Google\'s Find Hub can find it if you set it up in Android.' : '') }))));
      if (onPhone) body.append(Ui.card(Ui.row('Open Google Find Hub', 'Google\'s service, signed in with your Google account', () => Phone.openExternal('https://www.google.com/android/find'), { glyph: 'external-link', colour: '#43328a' })));
    });
    w.onHide = () => ring(false); w.onQuit = () => ring(false);
  }
});

// ================================================================ 23 Dropzone (downloads)
Apps.register({
  id: 'pets:dropzone', name: 'Dropzone', cat: 'StepOS', keywords: 'downloads',
  badge: () => { const n = Downloads.list().filter(d => d.status === 'active').length; return n || null; },
  open(w) {
    let tab = 'done';
    w.root(body => {
      w.actions([{ icon: 'plus', label: 'Download from a link', fn: async () => { const u = await Dialog.prompt('Download from a link', 'Paste a web address. The file is saved in Pets OS on this phone.', 'https://'); if (u && /^https?:\/\/\S+\.\S+/.test(u.trim())) { tab = 'active'; Downloads.fetch(u.trim()); w.refresh(); } else if (u) Shell.toast('That isn\'t a web address'); } }]);
      const l = Downloads.list();
      const n = k => l.filter(d => d.status === k).length;
      body.append(Ui.seg([['active', 'Active' + (n('active') ? ' ' + n('active') : '')], ['done', 'Finished'], ['failed', 'Failed' + (n('failed') ? ' ' + n('failed') : '')]], tab, v => { tab = v; w.refresh(); }));
      const items = l.filter(d => d.status === tab);
      if (!items.length) body.append(Ui.empty('download', tab === 'active' ? 'Nothing downloading' : tab === 'failed' ? 'No failed downloads' : 'No downloads yet', tab === 'done' ? 'Files you download or save from Pets OS apps appear here.' : null));
      else {
        const card = h('div', { class: 'card' });
        items.forEach(d => {
          const pct = d.total ? Math.round(100 * d.done / d.total) : 0;
          const sub = d.status === 'active' ? (d.total ? pct + '% · ' + Files.size(d.done || 0) + ' of ' + Files.size(d.total) : Files.size(d.done || 0) + ' so far') : d.status === 'failed' ? d.error : [d.size ? Files.size(d.size) : null, d.path, Fmt.ago(d.at)].filter(Boolean).join(' · ');
          const r = Ui.row(d.name, sub, null, { glyph: d.status === 'failed' ? 'triangle-alert' : 'download', colour: d.status === 'failed' ? '#b8323b' : '#1e6a9c' });
          if (d.status === 'active') r.append(h('div', { class: 'st-prog' }, h('i', { style: { width: pct + '%' } })));
          const remove = async () => {
            if (!(await Dialog.confirm('Delete "' + d.name + '"?', d.vault ? 'The file is deleted from Pets OS.' : d.path && onPhone && /^Download\//.test(d.path) ? 'The file is deleted from the phone\'s Download folder.' : 'It is removed from this list.', 'Delete', true))) return;
            if (d.vault) await Vault.del(d.vault);
            if (onPhone && d.path && /^Download\//.test(d.path)) Phone.deleteFile(d.path);
            Downloads.save(Downloads.list().filter(x => x.id !== d.id)); w.refresh();
          };
          press(r, async () => {
            if (d.status === 'failed') { Dialog.menu(d.name, d.error, [{ label: 'Try again', fn: () => { Downloads.save(Downloads.list().filter(x => x.id !== d.id)); tab = 'active'; Downloads.fetch(d.url); w.refresh(); } }, { label: 'Remove', danger: true, fn: remove }]); return; }
            if (d.status !== 'done') return;
            const f = d.vault && await Vault.get(d.vault);
            const opts = [];
            if (f) opts.push({ label: 'Open', fn: () => Preview.open(w, f) }, { label: onPhone ? 'Save to phone Downloads' : 'Save to your downloads', fn: () => Ui.saveFile(f.blob, f.name) });
            if (onPhone && d.path && /^Download\//.test(d.path)) opts.push({ label: 'Open', fn: () => Phone.openFile(d.path) || Shell.toast('No app can open this') }, { label: 'Share', fn: () => Phone.shareFile(d.path) });
            opts.push({ label: 'Delete', danger: true, fn: remove });
            Dialog.menu(d.name, sub, opts);
          });
          card.append(r);
        });
        body.append(card);
      }
      if (onPhone && tab === 'done') {
        body.append(Ui.label('Download folder on this phone'));
        if (!Phone.storageAllowed()) body.append(Ui.card(Ui.row('Allow access to files', 'To show what other apps downloaded', () => Phone.askStorage(), { glyph: 'folder', colour: '#86612e' })));
        else {
          const fl = (json(Phone.listFiles('Download'), []) || []).filter(f => !f.dir && !f.hidden).sort((a, b) => b.modified - a.modified);
          const c = h('div', { class: 'card' });
          if (!fl.length) c.append(Ui.row('The Download folder is empty', null, null));
          fl.slice(0, 50).forEach(f => { const rel = 'Download/' + f.name; c.append(Ui.row(f.name, Files.size(f.size) + ' · ' + Fmt.ago(f.modified), () => Dialog.menu(f.name, null, [{ label: 'Open', fn: () => Phone.openFile(rel) || Shell.toast('No app can open this') }, { label: 'Share', fn: () => Phone.shareFile(rel) }, { label: 'Delete', danger: true, fn: async () => { if (await Dialog.confirm('Delete "' + f.name + '"?', 'It is deleted from the phone.', 'Delete', true)) { Phone.deleteFile(rel); w.refresh(); } } }]))); });
          body.append(c);
        }
      }
    });
    const iv = setInterval(() => { if (!w.el.isConnected) { clearInterval(iv); return; } if (tab === 'active' && Downloads.list().some(d => d.status === 'active') && !w.stack.length) w.refresh(); }, 1000);
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// ================================================================ 24 Scanwise (QR codes and documents)
const Scan = {
  canQR() { return 'BarcodeDetector' in window; },
  wifi(t) { const m = /^WIFI:(.*);;?$/i.exec(t); if (!m) return null; const o = {}; m[1].replace(/;+$/, '').split(/;(?=[A-Z]:)/i).forEach(p => { const i = p.indexOf(':'); o[p.slice(0, i).toUpperCase()] = p.slice(i + 1); }); return { ssid: o.S, type: o.T || 'none', pass: o.P || '' }; },
  enhance(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    let lo = 255, hi = 0; for (let i = 0; i < d.length; i += 16) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; if (v < lo) lo = v; if (v > hi) hi = v; }
    const k = 255 / Math.max(1, hi - lo - 20);
    for (let i = 0; i < d.length; i += 4) { const v = Math.max(0, Math.min(255, (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11 - lo - 10) * k)); d[i] = d[i + 1] = d[i + 2] = v; }
    g.putImageData(im, 0, 0); return c;
  }
};
Apps.register({
  id: 'pets:scanwise', name: 'Scanwise', cat: 'StepOS', keywords: 'scanner',
  open(w) {
    let mode = 'qr', stream = null, loop = 0;
    const stop = () => { clearTimeout(loop); if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
    const result = text => {
      stop();
      w.push('Scan result', body => {
        const isUrl = /^https?:\/\/\S+$/i.test(text.trim()), wf = Scan.wifi(text);
        body.append(Ui.label(isUrl ? 'Web address' : wf ? 'Wi-Fi network' : 'Text'), Ui.card(h('div', { class: 'row', style: { display: 'block', wordBreak: 'break-word', lineHeight: 1.5 }, text: wf ? 'Network: ' + wf.ssid + '\nSecurity: ' + wf.type + (wf.pass ? '\nPassword: ' + wf.pass : '') : text })));
        if (isUrl) {
          const host = text.trim().replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
          body.append(Ui.note('This code opens ' + host + '. Only open it if you trust where the code came from.'));
          body.append(Ui.btn(icon('globe') + ' Open in Milo', async () => { if (await Dialog.confirm('Open ' + host + '?', text.trim(), 'Open')) Phone.openUrl(text.trim()); }));
        }
        body.append(Ui.btn(icon('copy') + ' Copy', () => { try { navigator.clipboard.writeText(wf ? wf.pass || wf.ssid : text); Shell.toast('Copied'); } catch (e) { Shell.toast('Copy isn\'t available'); } }, 'secondary'));
        body.append(Ui.btn(icon('notebook-pen') + ' Save to Pocket Notes', () => { Pen.add('Scan ' + new Date().toLocaleString() + '\n' + text); Shell.toast('Saved to Pocket Notes'); }, 'secondary'));
        const hist = Store.app('scanwise.history', []); hist.unshift({ text, at: Date.now() }); Store.setApp('scanwise.history', hist.slice(0, 50));
      }, { onPop: () => setTimeout(() => w.refresh(), 0) });
    };
    const docResult = canvas => {
      stop();
      let cur = Scan.enhance(canvas), rot = 0, enhanced = true;
      w.push('Scanned page', body => {
        const img = h('img', { class: 'st-preview-img', alt: 'Scanned page' });
        const show = () => { let c = enhanced ? cur : canvas; if (rot) { const r = document.createElement('canvas'); const sw = rot % 180 ? c.height : c.width, sh = rot % 180 ? c.width : c.height; r.width = sw; r.height = sh; const g = r.getContext('2d'); g.translate(sw / 2, sh / 2); g.rotate(rot * Math.PI / 180); g.drawImage(c, -c.width / 2, -c.height / 2); c = r; } img.src = c.toDataURL('image/jpeg', 0.9); img.dataset.w = c.width; img.dataset.h = c.height; return c; };
        let out = show();
        body.append(img, h('div', { class: 'st-btnrow' }, (() => { const b = h('button', { class: 'btn secondary', html: icon('rotate-cw') + ' Rotate' }); b.onclick = () => { rot = (rot + 90) % 360; out = show(); }; return b; })(), (() => { const b = h('button', { class: 'btn secondary', html: icon('contrast') + ' Original' }); b.onclick = () => { enhanced = !enhanced; b.innerHTML = icon('contrast') + (enhanced ? ' Original' : ' Enhance'); out = show(); }; return b; })()));
        body.append(Ui.note('Check the page, then save it. Nothing is saved until you choose.'));
        body.append(Ui.btn(icon('image') + ' Save to Moments', async () => { const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.9)); await Moments.put({ id: uid(), blob, w: out.width, h: out.height, added: Date.now(), name: 'Scan ' + new Date().toLocaleString(), fav: false, albums: ['Scans'] }); Shell.toast('Saved to Moments'); w.back(); }));
        body.append(Ui.btn(icon('download') + ' Save as a file', async () => { const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.92)); const f = await Vault.add(blob, 'Scan ' + new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.jpg', 'scan'); Ui.saveFile(blob, f.name); }, 'secondary'));
      }, { onPop: () => setTimeout(() => w.refresh(), 0) });
    };
    w.root(body => {
      stop();
      body.classList.add('st-scanbody');
      body.append(Ui.seg([['qr', 'QR code'], ['doc', 'Document']], mode, v => { mode = v; w.refresh(); }));
      const video = h('video', { playsinline: true, muted: true, autoplay: true, class: 'st-scanvid' });
      const frame = h('div', { class: 'st-scanframe' + (mode === 'doc' ? ' doc' : '') });
      const msg = h('div', { class: 'sub st-scanmsg', text: mode === 'qr' ? 'Point the camera at a QR code.' : 'Fit the page inside the frame, then tap Scan.' });
      const view = h('div', { class: 'st-scanview' }, video, frame);
      body.append(view, msg);
      if (mode === 'qr' && !Scan.canQR()) { view.remove(); msg.remove(); body.append(Ui.unavailable('qr', 'QR reading isn\'t available on this device', 'This device\'s web engine has no barcode reader (the Shape Detection API). Document scanning still works.', 'BarcodeDetector support in the WebView')); }
      else {
        (async () => {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'This device doesn\'t give Pets OS a camera.'; return; }
          if (!(await Need.ask('camera'))) { msg.textContent = 'Scanwise needs the Camera permission. You can allow it in Settings › Apps.'; return; }
          try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); video.srcObject = stream; await video.play().catch(() => {}); }
          catch (e) { msg.textContent = e && e.name === 'NotFoundError' ? 'No camera was found on this device.' : 'The camera isn\'t available (' + (e && e.name || 'error') + ').'; return; }
          if (mode === 'qr') {
            let fmts = ['qr_code']; try { const sup = window.BarcodeDetector.getSupportedFormats ? await window.BarcodeDetector.getSupportedFormats() : null; if (sup && sup.length) fmts = ['qr_code', 'ean_13', 'code_128', 'data_matrix'].filter(f => sup.indexOf(f) >= 0); } catch (e) { /* default */ }
            if (!fmts.length) { msg.textContent = 'This device\'s barcode reader can\'t read QR codes.'; return; }
            const det = new window.BarcodeDetector({ formats: fmts });
            const scan = async () => { if (!stream) return; try { const codes = await det.detect(video); if (codes && codes.length) { Phone.vibrate(20); result(codes[0].rawValue); return; } } catch (e) { /* frame not ready */ } loop = setTimeout(scan, 280); };
            scan();
          } else {
            const snap = h('button', { class: 'btn block', html: icon('scan') + ' Scan' });
            snap.onclick = () => { if (!video.videoWidth) return; const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0); docResult(c); };
            body.append(snap);
          }
        })();
      }
      const hist = Store.app('scanwise.history', []);
      if (hist.length) { body.append(Ui.label('Recent scans')); const c = h('div', { class: 'card' }); hist.slice(0, 6).forEach(x => c.append(Ui.row(x.text.slice(0, 60), Fmt.ago(x.at), () => result(x.text)))); body.append(c); }
    });
    w.onHide = stop; w.onQuit = stop; w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// ================================================================ 25 Lingua (translation; MyMemory service)
const Lingua = {
  langs: [['en', 'English'], ['fr', 'French'], ['es', 'Spanish'], ['de', 'German'], ['it', 'Italian'], ['pt', 'Portuguese'], ['nl', 'Dutch'], ['pl', 'Polish'], ['sv', 'Swedish'], ['tr', 'Turkish'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['ar', 'Arabic'], ['hi', 'Hindi'], ['zh-CN', 'Chinese (Simplified)'], ['ja', 'Japanese'], ['ko', 'Korean'], ['sw', 'Swahili'], ['zu', 'Zulu'], ['ny', 'Chichewa'], ['bem', 'Bemba']],
  async go(text, from, to) {
    if (!navigator.onLine) throw new Error('You\'re offline. Offline translation isn\'t available on this phone yet.');
    const r = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(from + '|' + to));
    if (!r.ok) throw new Error('The translation service answered ' + r.status + '.');
    const j = await r.json();
    if (j.responseStatus && +j.responseStatus !== 200) throw new Error(j.responseDetails || 'The translation service couldn\'t translate this.');
    const t = j.responseData && j.responseData.translatedText;
    if (!t) throw new Error('No translation came back.');
    return t;
  }
};
Apps.register({
  id: 'pets:lingua', name: 'Lingua', cat: 'StepOS', keywords: 'translate',
  open(w) {
    w.root(body => {
      const st = Store.app('lingua', { from: 'en', to: 'fr', history: [] });
      const sel = v => { const s = h('select', { class: 'field st-lang' }); Lingua.langs.forEach(([c, n]) => s.append(h('option', { value: c, text: n, selected: c === v ? true : null }))); return s; };
      const from = sel(st.from), to = sel(st.to);
      from.setAttribute('aria-label', 'Translate from'); to.setAttribute('aria-label', 'Translate to');
      const swap = h('button', { class: 'st-iconbtn', html: icon('repeat'), 'aria-label': 'Swap languages' });
      const src = h('textarea', { class: 'field st-ta', placeholder: 'Type text to translate', maxlength: 500, 'aria-label': 'Text to translate' });
      const out = h('div', { class: 'card st-out hidden' });
      const keep = () => { const s = Store.app('lingua', st); s.from = from.value; s.to = to.value; Store.setApp('lingua', s); };
      swap.onclick = () => { const a = from.value; from.value = to.value; to.value = a; keep(); };
      from.onchange = to.onchange = keep;
      const go = Ui.btn(icon('languages') + ' Translate', async () => {
        const t = src.value.trim(); if (!t) return;
        out.classList.remove('hidden'); out.innerHTML = ''; out.append(h('div', { class: 'row sub', text: 'Translating…' }));
        try {
          const r = await Lingua.go(t, from.value, to.value);
          out.innerHTML = '';
          const txt = h('div', { class: 'row st-outtext', text: r, lang: to.value });
          const say = h('button', { class: 'st-iconbtn', html: icon('volume-2'), 'aria-label': 'Read aloud' }); say.onclick = () => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(r); u.lang = to.value; speechSynthesis.speak(u); } catch (e) { Shell.toast('Read aloud isn\'t available'); } };
          const cp = h('button', { class: 'st-iconbtn', html: icon('copy'), 'aria-label': 'Copy' }); cp.onclick = () => { try { navigator.clipboard.writeText(r); Shell.toast('Copied'); } catch (e) { Shell.toast('Copy isn\'t available'); } };
          out.append(txt, h('div', { class: 'row st-outacts' }, h('span', { class: 'grow sub', text: 'MyMemory · ' + (Lingua.langs.find(l => l[0] === to.value) || [0, to.value])[1] }), say, cp));
          const s = Store.app('lingua', st); s.history = [{ t, r, from: from.value, to: to.value, at: Date.now() }].concat(s.history || []).slice(0, 30); Store.setApp('lingua', s);
        } catch (e) { out.innerHTML = ''; out.append(h('div', { class: 'row', style: { lineHeight: 1.5 }, text: e.message })); }
      });
      body.append(h('div', { class: 'st-langrow' }, from, swap, to), src, go, out);
      body.append(Ui.note('Text you translate is sent to the MyMemory service (translated.net) over the internet. Offline translation and speech input aren\'t available on this phone yet.'));
      const hist = (Store.app('lingua', st).history || []);
      if (hist.length) { body.append(Ui.label('Recent')); const c = h('div', { class: 'card' }); hist.slice(0, 10).forEach(x => c.append(Ui.row(x.r, x.t, () => { src.value = x.t; from.value = x.from; to.value = x.to; }))); body.append(c); }
    });
  }
});

// ================================================================ 26 Assist (accessibility)
Apps.register({
  id: 'pets:assist', name: 'Assist', cat: 'StepOS', keywords: 'accessibility',
  open(w) {
    let mstream = null;
    const stopMag = () => { if (mstream) { mstream.getTracks().forEach(t => t.stop()); mstream = null; } };
    const magnifier = () => w.push('Magnifier', body => {
      body.classList.add('st-dark');
      const v = h('video', { playsinline: true, muted: true, autoplay: true, class: 'st-mag' });
      const z = h('input', { type: 'range', min: 1, max: 6, step: 0.1, value: 2, 'aria-label': 'Zoom' });
      const msg = h('div', { class: 'sub', text: 'Use the camera to make small print bigger.' });
      let frozen = false;
      const fr = h('button', { class: 'btn secondary', html: icon('pause') + ' Freeze' });
      fr.onclick = () => { frozen = !frozen; frozen ? v.pause() : v.play(); fr.innerHTML = icon(frozen ? 'play' : 'pause') + (frozen ? ' Live' : ' Freeze'); };
      const apply = () => { v.style.transform = 'scale(' + z.value + ')'; const t = mstream && mstream.getVideoTracks()[0]; const c = t && t.getCapabilities ? t.getCapabilities() : {}; if (c.zoom) t.applyConstraints({ advanced: [{ zoom: Math.min(c.zoom.max, +z.value) }] }).then(() => { v.style.transform = ''; }).catch(() => {}); };
      z.oninput = apply;
      body.append(h('div', { class: 'st-magview' }, v), h('div', { class: 'st-form' }, z), h('div', { class: 'st-btnrow' }, fr), msg);
      (async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'This device doesn\'t give Pets OS a camera.'; return; }
        if (!(await Need.ask('camera'))) { msg.textContent = 'The magnifier needs the Camera permission.'; return; }
        try { mstream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); v.srcObject = mstream; v.play().catch(() => {}); apply(); }
        catch (e) { msg.textContent = 'The camera isn\'t available here.'; }
      })();
    }, { onPop: stopMag });
    w.root(body => {
      const P = (k, v) => { Prefs.set(k, v); };
      const ts = S.textScale || 1;
      const size = h('input', { type: 'range', min: 0.85, max: 1.6, step: 0.05, value: ts, 'aria-label': 'Text size' });
      const sample = h('div', { class: 'st-sample', text: 'The quick brown fox jumps over the lazy dog.', style: { fontSize: (15 * ts) + 'px' } });
      size.oninput = () => { sample.style.fontSize = (15 * size.value) + 'px'; };
      size.onchange = () => P('textScale', +size.value);
      body.append(Ui.label('Vision'), h('div', { class: 'card' }, h('div', { class: 'row', style: { display: 'block' } }, h('div', { text: 'Text size' }), h('div', { class: 'st-form', style: { margin: '8px 0 4px' } }, size), sample),
        Ui.toggleRow('Bold text', null, !!S.boldText, v => P('boldText', v)),
        Ui.toggleRow('Increase contrast', 'Stronger text and borders', !!S.highContrast, v => { S.highContrast = v; Store.save(); document.documentElement.classList.toggle('high-contrast', v); }),
        Ui.toggleRow('Easier reading', 'More space between letters and lines', !!S.easyRead, v => P('easyRead', v)),
        Ui.toggleRow('Dark appearance', null, S.theme === 'dark', v => { S.themeAuto = false; Settings.setTheme(v ? 'dark' : 'light'); }),
        Ui.row('Magnifier', 'Zoom in on things with the camera', magnifier, { glyph: 'zoom-in', colour: '#2367cc' })));
      body.append(Ui.label('Motion'), Ui.card(Ui.toggleRow('Reduce motion', 'Fewer animations', !!S.reduceMotion, v => { S.reduceMotion = v; Store.save(); Settings.applyMotion(); }),
        Ui.toggleRow('Reduce transparency', 'Solid panels instead of blur', !!S.reduceTrans, v => P('reduceTrans', v))));
      const can = typeof Speak !== 'undefined' && Speak.ok();
      body.append(Ui.label('Spoken feedback'), Ui.card(
        can ? Ui.toggleRow('Read new alerts aloud', null, !!S.speakNotes, v => { S.speakNotes = v; Store.save(); }) : Ui.row('Read aloud isn\'t available', 'This device has no speech voice.', null),
        can ? Ui.toggleRow('Clarice speaks her answers', null, !!S.claSpeak, v => { S.claSpeak = v; Store.save(); }) : null,
        can ? Ui.row('Test the voice', null, () => Speak.say('This is how Pets OS sounds when it reads to you.'), { glyph: 'volume-2', colour: '#2367cc' }) : null));
      body.append(Ui.note('Android\'s own screen reader (TalkBack) and magnification also work with Pets OS: all buttons have spoken labels.'));
      if (onPhone) body.append(Ui.card(Ui.row('Android accessibility settings', null, () => Phone.settings('accessibility') || Phone.settings('main'), { glyph: 'smartphone', colour: '#4a5162' })));
      body.append(Ui.card(Ui.row('More in Settings › Accessibility', null, () => Settings.go('accessibility'), { glyph: 'settings', colour: '#535b6e' })));
    });
    w.onHide = stopMag; w.onQuit = stopMag;
  }
});
if (S.highContrast) document.documentElement.classList.add('high-contrast');

// ================================================================ 27 SafeLine (emergency; never simulated)
const SafeLine = {
  // Region from the phone's language/time zone; the owner can change it.
  NUM: { GB: ['999', '112'], IE: ['112', '999'], US: ['911'], CA: ['911'], AU: ['000', '112'], NZ: ['111'], IN: ['112'], ZA: ['112', '10111'], ZM: ['999', '112'], MW: ['997', '112'], KE: ['999', '112'], NG: ['112'], JP: ['110', '119'], CN: ['110', '120'], BR: ['190', '192'], MX: ['911'], EU: ['112'] },
  NAMES: { GB: 'United Kingdom', IE: 'Ireland', US: 'United States', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', IN: 'India', ZA: 'South Africa', ZM: 'Zambia', MW: 'Malawi', KE: 'Kenya', NG: 'Nigeria', JP: 'Japan', CN: 'China', BR: 'Brazil', MX: 'Mexico', EU: 'European Union' },
  region() {
    const s = Store.app('safeline', {}); if (s.region) return s.region;
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    if (/London/.test(tz)) return 'GB';
    const m = /-([A-Z]{2})$/.exec(navigator.language || ''); const c = m && m[1];
    return c && this.NUM[c] ? c : 'EU';
  },
  // Calls open the phone's real dialler with the number filled in; you press call there.
  can() { return typeof PhoneApp !== 'undefined' ? PhoneApp.can() : 'none'; }
};
Apps.register({
  id: 'pets:safeline', name: 'SafeLine', cat: 'StepOS', keywords: 'emergency',
  open(w) {
    const med = () => Store.app('safeline.medical', { name: S.name || '', born: '', blood: '', allergies: '', conditions: '', medicines: '', contacts: [], lock: false });
    const editMed = () => w.push('Medical ID', body => {
      const m = med();
      const f = (k, l, ph) => { const i = h('input', { class: 'field', value: m[k] || '', placeholder: ph || l, 'aria-label': l }); i.dataset.k = k; return i; };
      const fields = [f('name', 'Name'), f('born', 'Date of birth'), f('blood', 'Blood type'), f('allergies', 'Allergies'), f('conditions', 'Medical conditions'), f('medicines', 'Medicines')];
      const cons = h('textarea', { class: 'field st-ta', placeholder: 'Emergency contacts, one per line: Name, number', 'aria-label': 'Emergency contacts' }); cons.value = (m.contacts || []).join('\n');
      body.append(h('div', { class: 'st-form' }, ...fields), Ui.label('Emergency contacts'), h('div', { class: 'st-form' }, cons));
      let lock = !!m.lock;
      body.append(Ui.card(Ui.toggleRow('Show on the lock screen', 'Anyone holding the phone can read your Medical ID without the passcode, and nothing else', lock, v => { lock = v; })));
      w.actions([{ label: 'Save', fn: () => { const n = { lock, contacts: cons.value.split('\n').map(s => s.trim()).filter(Boolean) }; fields.forEach(i => { n[i.dataset.k] = i.value.trim(); }); Store.setApp('safeline.medical', n); SafeLine.lockButton(); w.back(); w.refresh(); } }]);
    });
    w.root(body => {
      const reg = SafeLine.region(), nums = SafeLine.NUM[reg] || ['112'], how = SafeLine.can();
      body.append(h('div', { class: 'st-sos' }, h('div', { class: 'st-sos-t', text: 'Emergency services' }), h('div', { class: 'sub', text: SafeLine.NAMES[reg] + ' · change below' })));
      nums.forEach(n => {
        const b = h('button', { class: 'st-sosbtn', html: icon('phone') + '<span>Call ' + n + '</span>', 'aria-label': 'Call ' + n });
        if (how === 'none') { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
        b.onclick = async () => { if (await Dialog.confirm('Call ' + n + '?', 'The phone\'s dialler opens with ' + n + ' ready. Press call there.', 'Open dialler', true)) Phone.dial(n); };
        body.append(b);
      });
      if (how === 'none') body.append(h('div', { class: 'st-notice' }, h('span', { html: icon('triangle-alert') }), h('div', null, h('b', { text: 'This device can\'t make calls' }), h('div', { text: isStephone ? 'The Stephone simulator has no phone line. In an emergency, use a phone that can make calls.' : 'There is no phone line here. In an emergency, use a phone that can make calls.' }))));
      else body.append(Ui.note(how === 'handoff' ? 'Your phone\'s own dialler opens with the number ready.' : 'Android\'s dialler opens with the number ready; emergency calls work even without a passcode on most phones.'));
      const m = med();
      body.append(Ui.label('Medical ID'));
      const filled = ['born', 'blood', 'allergies', 'conditions', 'medicines'].some(k => m[k]) || (m.contacts || []).length;
      body.append(Ui.card(filled ? h('div', { class: 'row', style: { display: 'block', lineHeight: 1.6 } }, ...[['Name', m.name], ['Born', m.born], ['Blood type', m.blood], ['Allergies', m.allergies], ['Conditions', m.conditions], ['Medicines', m.medicines]].filter(x => x[1]).map(([k, v]) => h('div', null, h('span', { class: 'sub', text: k + ': ' }), v)), ...(m.contacts || []).map(c => h('div', null, h('span', { class: 'sub', text: 'Contact: ' }), c))) : null,
        Ui.row(filled ? 'Edit Medical ID' : 'Set up Medical ID', filled ? (m.lock ? 'Shown on the lock screen' : 'Only inside SafeLine') : 'Allergies, conditions, medicines and who to call', editMed, { glyph: 'life-buoy', colour: '#b8323b' })));
      body.append(Ui.label('Region'));
      const sel = h('select', { class: 'field', 'aria-label': 'Region' }); Object.keys(SafeLine.NAMES).forEach(k => sel.append(h('option', { value: k, text: SafeLine.NAMES[k] + ' (' + SafeLine.NUM[k].join(', ') + ')', selected: k === reg ? true : null })));
      sel.onchange = () => { const s = Store.app('safeline', {}); s.region = sel.value; Store.setApp('safeline', s); w.refresh(); };
      body.append(h('div', { class: 'st-form' }, sel), Ui.note('Pets OS never pretends to call: if this device has no phone line, the buttons stay off. Numbers are a guide; check your local emergency number.'));
    });
  }
});
// Medical ID on the lock screen (read-only; it never unlocks the phone).
SafeLine.lockButton = function () {
  const m = Store.app('safeline.medical', null), lock = $('#lock'); if (!lock) return;
  let b = $('.st-medical', lock);
  if (!m || !m.lock) { if (b) b.remove(); return; }
  if (!b) { b = h('button', { class: 'st-medical', html: icon('life-buoy') + '<span>Medical ID</span>', 'aria-label': 'Medical ID' }); lock.append(b); }
  b.onclick = e => {
    e.stopPropagation();
    const mm = Store.app('safeline.medical', {});
    const ov = h('div', { class: 'st-medov', role: 'dialog', 'aria-label': 'Medical ID' }, h('h2', { text: 'Medical ID' }),
      ...[['Name', mm.name], ['Born', mm.born], ['Blood type', mm.blood], ['Allergies', mm.allergies], ['Conditions', mm.conditions], ['Medicines', mm.medicines]].filter(x => x[1]).map(([k, v]) => h('p', null, h('b', { text: k }), h('span', { text: v }))),
      ...(mm.contacts || []).map(c => h('p', null, h('b', { text: 'Emergency contact' }), h('span', { text: c }))));
    const close = h('button', { class: 'btn block', text: 'Close' }); close.onclick = () => ov.remove();
    ov.append(close); $('#phone').append(ov);
  };
};
(orig => { Shell.buildLock = function () { orig.call(this); SafeLine.lockButton(); }; })(Shell.buildLock);

// ================================================================ 28 Step Update
Apps.register({
  id: 'pets:stepupdate', name: 'Step Update', cat: 'StepOS', keywords: 'software update',
  open(w) {
    w.root(body => {
      body.append(h('div', { class: 'st-hero' }, h('div', { class: 'st-hero-t', text: 'Pets OS ' + PETS_VERSION }), h('div', { class: 'st-hero-s', text: 'Pets OS for Stephone · signed updates from Should Be Media' })));
      if (window.SU && SU.page) SU.page(body);
      else body.append(Ui.unavailable('download', 'Updates aren\'t available in this build', 'The update service didn\'t load.'));
    });
  }
});

// ================================================================ 29 Capture (screen recording)
Apps.register({
  id: 'pets:capture', name: 'Capture', cat: 'StepOS', keywords: 'screen recording',
  open(w) {
    let rec = null, stream = null, started = 0, chunks = [];
    const can = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder);
    w.root(body => {
      if (!can) {
        body.append(Ui.unavailable('record', 'Screen recording isn\'t available in Pets OS here', onPhone ? 'On Android, recording the screen needs the MediaProjection system service, which this Pets OS build doesn\'t include yet.' : 'This browser doesn\'t let web apps record the screen (iPhone and most phones don\'t).', onPhone ? 'Android MediaProjection integration in the Pets OS app' : 'A browser with screen capture'));
        if (onPhone) body.append(Ui.note('Until then, Android\'s own Screen recorder in the quick settings panel works on most phones (Android 11 and later); its videos go to the Movies folder.'));
      } else {
        const time = h('div', { class: 'st-rec-time', text: rec ? Fmt.dur(Date.now() - started) : '0:00' });
        const btn = h('button', { class: 'st-recbtn' + (rec ? ' on' : ''), 'aria-label': rec ? 'Stop recording' : 'Start recording' }, h('i'));
        const tick = setInterval(() => { if (!body.isConnected) { clearInterval(tick); return; } if (rec) time.textContent = Fmt.dur(Date.now() - started); }, 300);
        btn.onclick = async () => {
          if (!rec) {
            try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); } catch (e) { Shell.toast('Screen recording wasn\'t allowed'); return; }
            chunks = []; rec = new MediaRecorder(stream); rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
            rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' }); rec = null; const name = 'Screen recording ' + new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.webm'; try { await Vault.add(blob, name, 'video'); Downloads.record({ name, size: blob.size, type: blob.type, path: 'Pets OS storage (Screenroom)', from: 'Capture' }); Shell.notify('Screen recording saved', 'Open it in Screenroom', { app: 'pets:capture' }); } catch (e) { Dialog.menu('Not saved', e.message, []); } w.refresh(); };
            stream.getVideoTracks()[0].addEventListener('ended', () => rec && rec.state !== 'inactive' && rec.stop());
            rec.start(1000); started = Date.now(); w.refresh(); return;
          }
          rec.stop();
        };
        body.append(h('div', { class: 'st-rec' }, rec ? h('div', { class: 'st-recdot', text: '● Recording' }) : null, time, btn, h('div', { class: 'sub', text: rec ? 'Recording the screen. Tap to stop.' : 'The browser asks which screen or window to record.' })));
        body.append(Ui.note('Recordings are saved in Pets OS on this device and appear in Screenroom and Dropzone.'));
      }
    });
    w.onQuit = () => { if (rec) rec.stop(); };
  }
});

// ================================================================ 30 Torch
Apps.register({
  id: 'pets:torch', name: 'Torch', cat: 'StepOS', keywords: 'flashlight',
  open(w) {
    w.root(body => {
      const dev = json(Phone.device(), {});
      body.classList.add('st-torchbody');
      if (!onPhone || dev.torch === false) {
        body.append(Ui.unavailable('flashlight', 'No torch here', isStephone ? 'The Stephone simulator has no light. On a real Stephone this switch turns on the camera light.' : isWeb ? 'Web apps can\'t control the phone light on iPhone or in a browser. Use the light in your phone\'s own Control Centre.' : 'This phone has no camera light.', isWeb ? null : 'A camera flash LED'));
        return;
      }
      const on = !!CC.torchOn;
      const b = h('button', { class: 'st-torch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': 'Torch', html: icon('flashlight') });
      b.onclick = () => { CC.torch(!CC.torchOn); w.refresh(); };
      body.append(b, h('div', { class: 'st-torch-l', text: on ? 'On' : 'Off' }), Ui.note('The torch also turns off from Control Centre or the lock screen.'));
    });
    w.onShow = () => w.refresh();
  }
});

// ================================================================ 12 Burrow where Android Files isn't available (browser, iPhone, Play)
if (!Apps.builtin['pets:files']) Apps.register({
  id: 'pets:files', name: 'Burrow', cat: 'StepOS', keywords: 'files folders storage documents',
  open(w) {
    let folder = '', q = '';
    const picker = h('input', { type: 'file', multiple: true, style: { display: 'none' } });
    w.el.append(picker);
    picker.onchange = async () => { for (const f of Array.from(picker.files || [])) { try { await Vault.add(f, f.name, 'file', { folder, type: f.type }); } catch (e) { Shell.toast(e.message); break; } } picker.value = ''; w.refresh(); };
    const KIND = { voice: 'Voice Pin', scan: 'Scans', download: 'Downloads', video: 'Videos', file: 'Files' };
    w.root(body => {
      w.setTitle(folder || 'Burrow'); w.backEl.classList.toggle('hidden', !folder);
      if (folder) { w.backEl.innerHTML = icon('chevron-left') + 'Burrow'; w.onBack = () => { folder = ''; w.refresh(); return true; }; } else w.onBack = null;
      w.actions([{ icon: 'folder-plus', label: 'New folder', fn: async () => { const n = await Dialog.prompt('New folder', null, ''); if (n && n.trim()) { const fs = Store.app('burrow.folders', []); if (fs.indexOf(n.trim()) < 0) fs.push(n.trim()); Store.setApp('burrow.folders', fs); w.refresh(); } } }, { icon: 'plus', label: 'Add files', fn: () => picker.click() }]);
      const f = h('input', { type: 'search', placeholder: 'Search files', value: q, autocomplete: 'off', 'aria-label': 'Search files' });
      const box = h('div');
      body.append(h('div', { class: 'search set-search', html: icon('search') }, f), box);
      body.append(Ui.note(PLAY ? 'This edition of Pets OS keeps its own files here. Phone-wide file browsing needs the full Pets OS build.' : 'In a browser or on iPhone, Burrow holds the files Pets OS makes and the ones you add. It can\'t see the rest of the device.'));
      const draw = async () => {
        const all = await Vault.all(), folders = Store.app('burrow.folders', []);
        box.innerHTML = '';
        const ql = f.value.trim().toLowerCase(); q = f.value;
        let list = all.filter(x => ql ? x.name.toLowerCase().includes(ql) : (x.folder || '') === folder);
        if (!folder && !ql) {
          const c = h('div', { class: 'card' });
          folders.forEach(n => c.append(Ui.row(n, all.filter(x => x.folder === n).length + ' items', () => { folder = n; w.refresh(); }, { glyph: 'folder', colour: '#86612e' })));
          if (folders.length) box.append(Ui.label('Folders'), c);
          list = list.filter(x => !x.folder);
        }
        if (!list.length) { box.append(Ui.empty('folder-open', ql ? 'No files match' : 'Nothing here yet', ql ? null : 'Tap + to add files. Recordings, scans and downloads appear here too.')); return; }
        box.append(Ui.label(ql ? 'Results' : 'Files'));
        const c = h('div', { class: 'card' });
        list.forEach(x => c.append((() => {
          const r = Ui.row(x.name, [KIND[x.kind] || 'File', Files.size(x.size || 0), Fmt.ago(x.added)].join(' · '), null, { glyph: x.kind === 'voice' ? 'mic' : x.kind === 'video' ? 'film' : x.kind === 'scan' ? 'scan' : /^image/.test(x.type) ? 'image' : 'file', colour: '#4a5162' });
          press(r, () => Preview.open(w, x), () => Dialog.menu(x.name, null, [
            { label: 'Rename', fn: async () => { const n = await Dialog.prompt('Rename', null, x.name); if (n && n.trim()) { x.name = n.trim(); await Vault.put(x); w.refresh(); } } },
            { label: 'Move to folder', fn: () => Dialog.menu('Move "' + x.name + '" to', null, [{ label: 'Burrow (top level)', fn: async () => { x.folder = ''; await Vault.put(x); w.refresh(); } }].concat(Store.app('burrow.folders', []).map(n => ({ label: n, fn: async () => { x.folder = n; await Vault.put(x); w.refresh(); } })))) },
            { label: 'Save to your downloads', fn: () => Ui.saveFile(x.blob, x.name) },
            { label: 'Delete', danger: true, fn: async () => { if (await Dialog.confirm('Delete "' + x.name + '"?', 'It is deleted from Pets OS.', 'Delete', true)) { await Vault.del(x.id); w.refresh(); } } }
          ]));
          return r;
        })()));
        box.append(c);
      };
      f.addEventListener('input', draw);
      draw();
    });
  }
});

window.Vault = Vault; window.Downloads = Downloads; window.Nudge = Nudge; window.EAN = EAN; window.Atlas = Atlas; window.OSM = OSM; window.Lingua = Lingua; window.SafeLine = SafeLine; window.Scan = Scan; window.VoicePin = VoicePin;
