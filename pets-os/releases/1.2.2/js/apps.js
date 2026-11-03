// Pets OS Mobile built-in apps. Each registers with Apps.register({ id, name, open(win) }).
'use strict';

const G = { // tile backgrounds for apps without approved artwork
  blue: 'linear-gradient(145deg,#5b8cff,#3f63d8)', violet: 'linear-gradient(145deg,#8c7bff,#5b3fd8)',
  green: 'linear-gradient(145deg,#3dd6a0,#159a74)', orange: 'linear-gradient(145deg,#ffb84d,#ff7a3d)',
  red: 'linear-gradient(145deg,#ff6b72,#d8344a)', grey: 'linear-gradient(145deg,#5d6680,#394057)',
  dark: 'linear-gradient(145deg,#2b3147,#161a28)', pink: 'linear-gradient(145deg,#ff8fb1,#e0457b)'
};

// ================================================================ phone apps (Android does the work)
Apps.register({ id: 'pets:rest', name: 'Rest', img: 'img/icons/rest.png', cat: 'Pets OS', hiddenFromRest: true, launch: () => Shell.openSheet('rest') });
Apps.register({ id: 'sys:phone', name: 'Phone', glyph: 'phone', bg: G.green, cat: 'Phone', hiddenFromRest: true, keywords: 'call dial', launch: () => Phone.dial('') });
Apps.register({ id: 'sys:messages', name: 'Messages', glyph: 'message', bg: G.green, cat: 'Phone', hiddenFromRest: true, keywords: 'sms text', launch: () => Phone.sms('') });
Apps.register({ id: 'sys:camera', name: 'Camera', glyph: 'camera', bg: G.grey, cat: 'Phone', hiddenFromRest: true, keywords: 'photo', launch: () => Phone.camera() || Shell.toast('No camera app found') });
Apps.register({ id: 'sys:contacts', name: 'Contacts', glyph: 'users', bg: G.grey, cat: 'Phone', hiddenFromRest: true, launch: () => Phone.contacts() || Shell.toast('No contacts app found') });
// Milo is downloaded from O Store ("store:milo"). This older built-in entry only keeps Milo icons that
// were on Home Screens before 1.0.7 working: it opens the downloaded Milo when there is one, otherwise
// Milo's own welcome screen.
Apps.register({ id: 'pets:milo', name: 'Milo', img: 'img/icons/milo.png', cat: 'Pets OS', hiddenFromRest: true, keywords: 'browser web internet', launch: () => Apps.builtin['store:milo'] ? Shell.open('store:milo') : Phone.openUrl('') });

// ================================================================ Calculator
const Calc = {
  // Small expression parser (no eval): + - × ÷ ^ % brackets, sqrt.
  evaluate(src) {
    const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
    let i = 0;
    const peek = () => s[i];
    const num = () => {
      if (s.startsWith('sqrt', i)) { i += 4; return Math.sqrt(factor()); }
      if (s.startsWith('pi', i)) { i += 2; return Math.PI; }
      if (peek() === '(') { i++; const v = expr(); if (peek() !== ')') throw new Error('bracket'); i++; return v; }
      const m = /^\d*\.?\d+(e[+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new Error('number');
      i += m[0].length;
      return parseFloat(m[0]);
    };
    const factor = () => {
      if (peek() === '-') { i++; return -factor(); }
      if (peek() === '+') { i++; return factor(); }
      let v = num();
      while (peek() === '%') { i++; v = v / 100; }
      if (peek() === '^') { i++; v = Math.pow(v, factor()); }
      return v;
    };
    const term = () => {
      let v = factor();
      while (peek() === '*' || peek() === '/' || peek() === '(') {
        const op = peek() === '(' ? '*' : s[i++];
        const r = factor();
        v = op === '*' ? v * r : v / r;
      }
      return v;
    };
    const expr = () => {
      let v = term();
      while (peek() === '+' || peek() === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    };
    const v = expr();
    if (i !== s.length) throw new Error('syntax');
    return v;
  },
  show(v) {
    if (!isFinite(v)) return 'Error';
    const r = Math.round(v * 1e10) / 1e10;
    return Math.abs(r) >= 1e12 ? r.toExponential(6) : r.toLocaleString(undefined, { maximumFractionDigits: 10 });
  }
};
Apps.register({
  id: 'pets:calculator', name: 'Calculator', glyph: 'calculator', bg: G.orange, cat: 'Utilities', keywords: 'maths sum',
  open(w) {
    w.el.style.background = '#000'; w.el.style.color = '#fff';
    let expr = '', justDone = false;
    w.root(body => {
      body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.justifyContent = 'flex-end'; body.style.paddingBottom = 'calc(36px + var(--sab))';
      const sub = h('div', { style: { textAlign: 'right', color: '#8b90a0', fontSize: '22px', minHeight: '30px', padding: '0 10px', overflow: 'hidden', whiteSpace: 'nowrap' } });
      const out = h('div', { style: { textAlign: 'right', fontFamily: 'InterDisplay, Inter', fontWeight: 300, fontSize: '76px', padding: '0 8px 14px', whiteSpace: 'nowrap', overflow: 'hidden' }, text: '0' });
      const pad = h('div', { class: 'keep-size', style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '13px' } });
      const fit = () => { out.style.fontSize = out.textContent.length > 9 ? Math.max(34, 76 - (out.textContent.length - 9) * 6) + 'px' : '76px'; };
      const update = () => {
        sub.textContent = justDone ? '' : expr;
        let v = null;
        try { if (expr) v = Calc.evaluate(expr); } catch (e) { v = null; }
        out.textContent = justDone ? out.textContent : (v == null ? (expr || '0') : Calc.show(v));
        fit();
      };
      const keys = [['C', '#a5a5a5', '#000'], ['(', '#333'], [')', '#333'], ['÷', '#ff9f0a'], ['7'], ['8'], ['9'], ['×', '#ff9f0a'], ['4'], ['5'], ['6'], ['-', '#ff9f0a'], ['1'], ['2'], ['3'], ['+', '#ff9f0a'], ['%', '#333'], ['0'], ['.'], ['=', '#ff9f0a']];
      keys.forEach(([k, bg, fg]) => {
        const b = h('button', { text: k, style: { height: '76px', borderRadius: '38px', background: bg || '#2a2a2c', color: fg || '#fff', fontSize: '32px', fontWeight: 400 } });
        b.onclick = () => {
          Phone.vibrate(8);
          if (k === 'C') { expr = ''; justDone = false; out.textContent = '0'; }
          else if (k === '=') {
            try { const v = Calc.evaluate(expr); sub.textContent = expr + ' ='; out.textContent = Calc.show(v); expr = String(Math.round(v * 1e10) / 1e10); justDone = true; fit(); return; }
            catch (e) { out.textContent = 'Error'; justDone = true; expr = ''; return; }
          } else {
            if (justDone && /[0-9.(]/.test(k)) expr = '';
            justDone = false;
            expr += k;
          }
          update();
        };
        pad.append(b);
      });
      press(out, null, () => { navigator.clipboard && navigator.clipboard.writeText(out.textContent.replace(/,/g, '')); Shell.toast('Copied ' + out.textContent); });
      body.append(sub, out, pad);
    });
    w.header.style.visibility = 'hidden';
  }
});

// ================================================================ Pen (notes)
const Pen = {
  load() { return Store.app('pen', { notes: [], deleted: [] }); },
  save(d) { Store.setApp('pen', d); },
  add(text) {
    const d = this.load();
    const n = { id: uid(), text, pinned: false, updated: Date.now(), created: Date.now() };
    d.notes.unshift(n); this.save(d);
    return n;
  },
  title(n) { const t = (n.text || '').trim().split('\n')[0]; return t ? t.slice(0, 60) : 'New Note'; },
  preview(n) { const lines = (n.text || '').trim().split('\n'); return (lines.slice(1).join(' ').trim() || 'No additional text').slice(0, 90); }
};
Apps.register({
  id: 'pets:pen', name: 'Pen', img: 'img/icons/pen.png', cat: 'Pets OS', keywords: 'notes write',
  badge: null,
  open(w) {
    let q = '';
    const list = body => {
      const d = Pen.load();
      w.actions([{ icon: 'trash-2', fn: () => w.push('Recently Deleted', deletedView) }, { icon: 'pencil', fn: () => edit(Pen.add('')) }]);
      const search = h('div', { class: 'search', style: { background: 'var(--button)', color: 'var(--text3)', marginBottom: '14px' }, html: icon('search') });
      const f = h('input', { placeholder: 'Search notes', value: q, style: { color: 'var(--text)' } });
      f.oninput = () => { q = f.value; draw(); };
      search.append(f);
      const box = h('div');
      const draw = () => {
        box.innerHTML = '';
        const notes = d.notes.filter(n => !q || n.text.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
        if (!notes.length) { box.append(h('div', { class: 'empty-state', html: icon('notebook-pen') + '<br>' + (q ? 'No notes match.' : 'No notes yet.<br>Tap the pencil to write one.') })); return; }
        const groups = [['Pinned', notes.filter(n => n.pinned)], ['Notes', notes.filter(n => !n.pinned)]];
        groups.forEach(([label, items]) => {
          if (!items.length) return;
          box.append(h('div', { class: 'label', text: label }));
          const card = h('div', { class: 'card' });
          items.forEach(n => {
            const row = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, text: Pen.title(n) }),
              h('div', { class: 'sub', text: new Date(n.updated).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + '  ' + Pen.preview(n) })));
            press(row, () => edit(n), () => Dialog.menu(Pen.title(n), null, [
              { label: n.pinned ? 'Unpin' : 'Pin', fn: () => { n.pinned = !n.pinned; Pen.save(d); draw(); } },
              { label: 'Share', fn: () => { if (navigator.share) navigator.share({ text: n.text }).catch(() => {}); else { navigator.clipboard && navigator.clipboard.writeText(n.text); Shell.toast('Copied'); } } },
              { label: 'Delete', danger: true, fn: () => { d.notes = d.notes.filter(x => x !== n); d.deleted.unshift(Object.assign(n, { deletedAt: Date.now() })); d.deleted = d.deleted.slice(0, 100); Pen.save(d); draw(); } }
            ]));
            card.append(row);
          });
          box.append(card);
        });
      };
      draw();
      body.append(search, box);
    };
    const edit = n => {
      w.push(Pen.title(n), body => {
        const d = Pen.load();
        const note = d.notes.find(x => x.id === n.id) || n;
        const ta = h('textarea', { class: 'field', style: { minHeight: '70vh', border: 0, background: 'transparent', fontSize: '17px', padding: '4px 0' }, placeholder: 'Start writing. The first line is the title.' });
        ta.value = note.text;
        let t = null;
        ta.oninput = () => {
          clearTimeout(t);
          t = setTimeout(() => {
            const dd = Pen.load(); const x = dd.notes.find(y => y.id === note.id);
            if (x) { x.text = ta.value; x.updated = Date.now(); Pen.save(dd); w.setTitle(Pen.title(x)); }
          }, 300);
        };
        w.actions([{ label: 'Done', fn: () => { ta.blur(); w.back(); } }]);
        body.append(ta);
        if (!note.text) setTimeout(() => ta.focus(), 250);
      }, { onPop: () => {
        const dd = Pen.load(); const x = dd.notes.find(y => y.id === n.id);
        const ta = $('textarea', w.body);
        if (x && ta) { x.text = ta.value; x.updated = Date.now(); }
        dd.notes = dd.notes.filter(y => y.text.trim());  // empty notes aren't kept
        Pen.save(dd);
      } });
    };
    const deletedView = body => {
      const d = Pen.load();
      if (!d.deleted.length) { body.append(h('div', { class: 'empty-state', html: icon('trash-2') + '<br>Nothing deleted.' })); return; }
      const card = h('div', { class: 'card' });
      d.deleted.forEach(n => {
        const row = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, text: Pen.title(n) }), h('div', { class: 'sub', text: 'Deleted ' + Fmt.ago(n.deletedAt) })));
        press(row, () => Dialog.menu(Pen.title(n), null, [
          { label: 'Recover', fn: () => { d.deleted = d.deleted.filter(x => x !== n); delete n.deletedAt; d.notes.unshift(n); Pen.save(d); w.refresh(); } },
          { label: 'Delete for ever', danger: true, fn: () => { d.deleted = d.deleted.filter(x => x !== n); Pen.save(d); w.refresh(); } }
        ]));
        card.append(row);
      });
      body.append(card);
    };
    // Search can open one note straight away.
    w.openNote = id => { const n = Pen.load().notes.find(x => x.id === id); if (n) { w.root(list); edit(n); } };
    w.root(list);
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// ================================================================ Moments (photos, kept in Pets OS)
const Moments = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('petsos-moments', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(mode) { return this.db.transaction('photos', mode).objectStore('photos'); },
  all() { return this.open().then(() => new Promise(res => { const q = this.tx('readonly').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => b.added - a.added)); q.onerror = () => res([]); })); },
  put(p) { return this.open().then(() => new Promise(res => { const q = this.tx('readwrite').put(p); q.onsuccess = () => res(); q.onerror = () => res(); })); },
  del(id) { return this.open().then(() => new Promise(res => { const q = this.tx('readwrite').delete(id); q.onsuccess = () => res(); q.onerror = () => res(); })); },
  // Phone photos can be 12 MP; keep a 2048 px copy so storage stays reasonable.
  shrink(file, max, quality) {
    return new Promise(res => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => res({ blob: b, w: c.width, h: c.height }), 'image/jpeg', quality || 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }
};
Apps.register({
  id: 'pets:moments', name: 'Moments', img: 'img/icons/moments.png', cat: 'Pets OS', keywords: 'photos pictures gallery',
  open(w) {
    let view = 'All', urls = [];
    const picker = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
    w.el.append(picker);
    picker.onchange = async () => {
      const files = Array.from(picker.files || []);
      if (!files.length) return;
      Shell.toast('Adding ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '…');
      for (const f of files) {
        const s = await Moments.shrink(f, 2048);
        if (s) await Moments.put({ id: uid(), blob: s.blob, w: s.w, h: s.h, added: Date.now(), name: f.name, fav: false });
      }
      picker.value = '';
      w.refresh();
    };
    const grid = body => {
      urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
      w.actions([{ icon: 'plus', fn: () => picker.click() }]);
      const seg = h('div', { class: 'seg' });
      ['All', 'Favourites'].forEach(v => { const b = h('button', { class: v === view ? 'on' : '', text: v }); b.onclick = () => { view = v; w.refresh(); }; seg.append(b); });
      const box = h('div', { class: 'keep-size', style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '3px', margin: '0 -12px' } });
      body.append(seg, box);
      Moments.all().then(list => {
        if (view === 'Favourites') list = list.filter(p => p.fav);
        if (!list.length) {
          const e = h('div', { class: 'empty-state', style: { gridColumn: '1/-1' }, html: icon('image') + '<br>' + (view === 'All' ? 'No photos in Moments yet.<br>Tap + to add some from your phone.' : 'No favourites yet.') });
          box.append(e); return;
        }
        list.forEach((p, i) => {
          const u = URL.createObjectURL(p.blob); urls.push(u);
          const cell = h('div', { style: { aspectRatio: '1', backgroundImage: 'url(' + u + ')', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' } });
          if (p.fav) cell.innerHTML = '<span style="position:absolute;left:5px;bottom:4px;color:#fff">' + icon('heart') + '</span>';
          cell.onclick = () => viewer(list, i);
          box.append(cell);
        });
        body.append(h('div', { class: 'muted', style: { textAlign: 'center', color: 'var(--text3)', padding: '18px', fontSize: '13px' }, text: list.length + ' photo' + (list.length > 1 ? 's' : '') }));
      });
    };
    const viewer = (list, i) => {
      const ov = h('div', { style: { position: 'absolute', inset: 0, background: '#000', zIndex: 10, display: 'flex', flexDirection: 'column' } });
      const img = h('div', { style: { flex: 1, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' } });
      const bar = h('div', { style: { display: 'flex', justifyContent: 'space-around', padding: '14px 10px calc(34px + var(--sab))', color: '#fff' } });
      const top = h('div', { style: { padding: 'var(--bar) 16px 8px', display: 'flex', justifyContent: 'space-between', color: '#fff', alignItems: 'center' } });
      let cur = null;
      const show = () => {
        const p = list[i];
        if (cur) URL.revokeObjectURL(cur);
        cur = URL.createObjectURL(p.blob);
        img.style.backgroundImage = 'url(' + cur + ')';
        top.innerHTML = '';
        const close = h('button', { html: icon('chevron-left'), style: { color: '#fff' } });
        close.onclick = done;
        top.append(close, h('span', { style: { fontWeight: 600 }, text: new Date(p.added).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) }), h('span', { text: (i + 1) + ' / ' + list.length, style: { fontSize: '13px', opacity: .7 } }));
        bar.innerHTML = '';
        const btn = (g, label, fn) => { const b = h('button', { html: icon(g) + '<div style="font-size:11px;margin-top:3px">' + label + '</div>', style: { color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' } }); b.onclick = fn; bar.append(b); };
        btn('heart', p.fav ? 'Unfavourite' : 'Favourite', async () => { p.fav = !p.fav; await Moments.put(p); show(); });
        btn('image', 'Wallpaper', async () => {
          const s = await Moments.shrink(p.blob, 1600, 0.82);
          const r = new FileReader();
          r.onload = () => { Store.setApp('wallpaper.custom', r.result); S.wallpaper = 'custom'; Store.save(); Wallpapers.apply(); Shell.toast('Wallpaper set'); };
          r.readAsDataURL(s.blob);
        });
        btn('trash-2', 'Delete', async () => {
          if (!(await Dialog.confirm('Delete this photo?', 'It is removed from Moments. The original on your phone is not touched.', 'Delete Photo', true))) return;
          await Moments.del(p.id); list.splice(i, 1);
          if (!list.length) done(); else { i = Math.min(i, list.length - 1); show(); }
        });
      };
      const done = () => { if (cur) URL.revokeObjectURL(cur); ov.remove(); w.onBack = null; w.refresh(); };
      swipe(img, dir => { if (dir === 'left' && i < list.length - 1) { i++; show(); } else if (dir === 'right' && i > 0) { i--; show(); } else if (dir === 'down') done(); });
      ov.append(top, img, bar);
      w.el.append(ov);
      w.onBack = () => { done(); return true; };
      show();
    };
    w.root(grid);
  }
});

// ================================================================ Weather (Open-Meteo, no key)
const WX_CODES = { 0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'cloud-sun'], 3: ['Cloudy', 'cloud'], 45: ['Fog', 'cloud'], 48: ['Fog', 'cloud'], 51: ['Drizzle', 'droplet'], 53: ['Drizzle', 'droplet'], 55: ['Drizzle', 'droplet'], 61: ['Light rain', 'droplet'], 63: ['Rain', 'droplet'], 65: ['Heavy rain', 'droplet'], 66: ['Freezing rain', 'droplet'], 67: ['Freezing rain', 'droplet'], 71: ['Light snow', 'cloud'], 73: ['Snow', 'cloud'], 75: ['Heavy snow', 'cloud'], 77: ['Snow grains', 'cloud'], 80: ['Showers', 'droplet'], 81: ['Showers', 'droplet'], 82: ['Heavy showers', 'droplet'], 85: ['Snow showers', 'cloud'], 86: ['Snow showers', 'cloud'], 95: ['Thunderstorm', 'zap'], 96: ['Thunderstorm', 'zap'], 99: ['Thunderstorm', 'zap'] };
const Weather = {
  places() { return Store.app('weather.places', []); },
  async search(q) {
    const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=en&name=' + encodeURIComponent(q));
    const j = await r.json();
    return (j.results || []).map(p => ({ name: p.name, region: [p.admin1, p.country].filter(Boolean).join(', '), lat: p.latitude, lon: p.longitude }));
  },
  async forecast(p) {
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&forecast_days=7';
    const r = await fetch(u);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const desc = (WX_CODES[j.current.weather_code] || ['–'])[0];
    Store.setApp('weather.last', { place: p.name, temp: j.current.temperature_2m, desc, at: Date.now() });
    return j;
  }
};
Apps.register({
  id: 'pets:weather', name: 'Weather', glyph: 'cloud-sun', bg: 'linear-gradient(160deg,#4fa3ff,#2f5fb3)', cat: 'Pets OS', keywords: 'forecast rain temperature',
  open(w) {
    w.el.style.background = 'linear-gradient(180deg,#2f5fb3 0%,#1a3a78 45%,#10141f 100%)'; w.el.style.color = '#fff';
    let idx = 0;
    const main = body => {
      const places = Weather.places();
      w.actions([{ icon: 'search', fn: () => w.push('Add a place', addView) }, places.length ? { icon: 'layout-grid', fn: () => w.push('Places', listView) } : null].filter(Boolean));
      if (!places.length) {
        body.append(h('div', { class: 'empty-state', style: { color: 'rgba(255,255,255,.8)' }, html: icon('cloud-sun') + '<br>Add your town to see the forecast.' }));
        const b = h('button', { class: 'btn block', text: 'Add a place' }); b.onclick = () => w.push('Add a place', addView);
        body.append(b); return;
      }
      idx = Math.min(idx, places.length - 1);
      const p = places[idx];
      const box = h('div', { style: { textAlign: 'center', paddingTop: '20px' } }, h('div', { style: { fontSize: '28px', fontWeight: 500 }, text: p.name }), h('div', { style: { opacity: .7, marginTop: '30px' }, text: 'Loading…' }));
      body.append(box);
      Weather.forecast(p).then(j => {
        const c = j.current, [desc, g] = WX_CODES[c.weather_code] || ['–', 'cloud'];
        box.innerHTML = '';
        box.append(h('div', { style: { fontSize: '28px', fontWeight: 500 }, text: p.name }),
          h('div', { style: { fontFamily: 'InterDisplay, Inter', fontWeight: 300, fontSize: '96px', lineHeight: 1, margin: '6px 0' }, text: Math.round(c.temperature_2m) + '°' }),
          h('div', { style: { fontSize: '19px', fontWeight: 500 }, text: desc }),
          h('div', { style: { opacity: .8, marginTop: '4px' }, text: 'H:' + Math.round(j.daily.temperature_2m_max[0]) + '°  L:' + Math.round(j.daily.temperature_2m_min[0]) + '°' }),
          places.length > 1 ? h('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '10px' } }, places.map((_, k) => h('i', { style: { width: '7px', height: '7px', borderRadius: '50%', background: k === idx ? '#fff' : 'rgba(255,255,255,.4)' } }))) : null);
        const glass = { background: 'rgba(255,255,255,.12)', borderRadius: '18px', padding: '12px 14px', marginTop: '18px', textAlign: 'left' };
        // next 24 hours
        const now = new Date(c.time).getTime();
        let start = j.hourly.time.findIndex(t => new Date(t).getTime() >= now - 3600e3); if (start < 0) start = 0;
        const hours = h('div', { style: { display: 'flex', gap: '18px', overflowX: 'auto', paddingBottom: '4px' } });
        for (let k = start; k < Math.min(start + 24, j.hourly.time.length); k++) {
          const hc = WX_CODES[j.hourly.weather_code[k]] || ['', 'cloud'];
          hours.append(h('div', { style: { textAlign: 'center', flex: 'none' } }, h('div', { style: { fontSize: '13px', opacity: .8 }, text: k === start ? 'Now' : pad2(new Date(j.hourly.time[k]).getHours()) }), h('div', { html: icon(hc[1]), style: { margin: '6px 0' } }), h('div', { style: { fontWeight: 600 }, text: Math.round(j.hourly.temperature_2m[k]) + '°' })));
        }
        box.append(h('div', { style: glass }, h('div', { style: { fontSize: '12px', opacity: .7, marginBottom: '8px', textTransform: 'uppercase' }, text: 'Next 24 hours' }), hours));
        const days = h('div', { style: glass }, h('div', { style: { fontSize: '12px', opacity: .7, marginBottom: '4px', textTransform: 'uppercase' }, text: '7-day forecast' }));
        j.daily.time.forEach((t, k) => {
          const dc = WX_CODES[j.daily.weather_code[k]] || ['', 'cloud'];
          days.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderTop: k ? '1px solid rgba(255,255,255,.12)' : 0 } },
            h('span', { style: { width: '54px', fontWeight: 500 }, text: k === 0 ? 'Today' : new Date(t).toLocaleDateString(undefined, { weekday: 'short' }) }),
            h('span', { html: icon(dc[1]) }), h('span', { style: { width: '42px', fontSize: '12px', opacity: .8 }, text: j.daily.precipitation_probability_max[k] != null ? j.daily.precipitation_probability_max[k] + '%' : '' }),
            h('span', { style: { flex: 1, textAlign: 'right', opacity: .7 }, text: Math.round(j.daily.temperature_2m_min[k]) + '°' }),
            h('span', { style: { width: '40px', textAlign: 'right', fontWeight: 600 }, text: Math.round(j.daily.temperature_2m_max[k]) + '°' })));
        });
        box.append(days);
        const det = (label, v) => h('div', { style: Object.assign({}, glass, { marginTop: 0 }) }, h('div', { style: { fontSize: '12px', opacity: .7, textTransform: 'uppercase' }, text: label }), h('div', { style: { fontSize: '24px', marginTop: '4px' }, text: v }));
        box.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' } },
          det('Feels like', Math.round(c.apparent_temperature) + '°'), det('Humidity', c.relative_humidity_2m + '%'),
          det('Wind', Math.round(c.wind_speed_10m) + ' km/h'), det('Sunset', (j.daily.sunset[0] || 'T–').split('T')[1])));
        box.append(h('div', { style: { fontSize: '11px', opacity: .55, marginTop: '16px' }, text: 'Weather data by Open-Meteo.com' }));
        const t = $('.widget-today'); if (t) Widgets.today(t);
      }).catch(() => {
        box.append(h('div', { style: { marginTop: '20px', opacity: .85 }, text: 'Can\'t load the forecast. Check the internet connection.' }));
        const b = h('button', { class: 'btn', text: 'Try again', style: { marginTop: '14px' } }); b.onclick = () => w.refresh(); box.append(b);
      });
    };
    const addView = body => {
      const f = h('input', { class: 'field', placeholder: 'Town or city', style: { background: 'rgba(255,255,255,.12)', color: '#fff', borderColor: 'rgba(255,255,255,.2)' } });
      const res = h('div', { style: { marginTop: '12px' } });
      let t = null;
      f.oninput = () => {
        clearTimeout(t);
        const q = f.value.trim();
        if (q.length < 2) { res.innerHTML = ''; return; }
        t = setTimeout(() => Weather.search(q).then(list => {
          res.innerHTML = '';
          if (!list.length) res.append(h('div', { style: { opacity: .7, padding: '10px' }, text: 'No places found.' }));
          list.forEach(p => {
            const r = h('div', { style: { padding: '12px', borderBottom: '1px solid rgba(255,255,255,.12)' } }, h('div', { style: { fontWeight: 600 }, text: p.name }), h('div', { style: { fontSize: '13px', opacity: .7 }, text: p.region }));
            r.onclick = () => { const ps = Weather.places(); ps.push(p); Store.setApp('weather.places', ps); idx = ps.length - 1; w.back(); };
            res.append(r);
          });
        }).catch(() => { res.innerHTML = '<div style="opacity:.7;padding:10px">No internet connection.</div>'; }), 350);
      };
      body.append(f, res);
      setTimeout(() => f.focus(), 200);
    };
    const listView = body => {
      const ps = Weather.places();
      ps.forEach((p, k) => {
        const r = h('div', { style: { padding: '14px', background: 'rgba(255,255,255,.12)', borderRadius: '16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h('div', null, h('div', { style: { fontWeight: 600, fontSize: '18px' }, text: p.name }), h('div', { style: { fontSize: '13px', opacity: .7 }, text: p.region })));
        const del = h('button', { html: icon('trash-2'), style: { color: '#fff' } });
        del.onclick = e => { e.stopPropagation(); ps.splice(k, 1); Store.setApp('weather.places', ps); w.refresh(); };
        r.append(del);
        r.onclick = () => { idx = k; w.back(); };
        body.append(r);
      });
    };
    // One swipe handler for the window's lifetime; it only acts on the forecast screen.
    swipe(w.body, dir => {
      const places = Weather.places();
      if (w.stack.length || places.length < 2) return;
      if (dir === 'left') { idx = (idx + 1) % places.length; w.refresh(); }
      if (dir === 'right') { idx = (idx - 1 + places.length) % places.length; w.refresh(); }
    });
    w.root(main);
  }
});

// ================================================================ Calendar
const Calendar = {
  events() { return Store.app('calendar', []); },
  save(e) { Store.setApp('calendar', e); },
  key(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); },
  next() {
    const now = Date.now();
    const up = this.events().map(e => Object.assign({}, e, { at: new Date(e.date + 'T' + (e.time || '00:00')).getTime() }))
      .filter(e => (e.time ? e.at : e.at + 864e5) > now).sort((a, b) => a.at - b.at)[0];
    if (!up) return null;
    const d = new Date(up.at), today = this.key(new Date()), tomorrow = this.key(new Date(now + 864e5));
    const day = up.date === today ? 'Today' : up.date === tomorrow ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return { title: up.title, when: day + (up.time ? ' ' + up.time : '') };
  }
};
Apps.register({
  id: 'pets:calendar', name: 'Calendar', glyph: 'calendar', bg: G.red, cat: 'Pets OS', keywords: 'events diary schedule',
  open(w) {
    let month = new Date(); month.setDate(1);
    let sel = new Date();
    const view = body => {
      w.setTitle(month.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }));
      w.actions([{ icon: 'chevron-left', fn: () => { month.setMonth(month.getMonth() - 1); w.refresh(); } }, { label: 'Today', fn: () => { month = new Date(); month.setDate(1); sel = new Date(); w.refresh(); } }, { icon: 'chevron-right', fn: () => { month.setMonth(month.getMonth() + 1); w.refresh(); } }, { icon: 'plus', fn: () => add() }]);
      const ev = Calendar.events();
      const grid = h('div', { class: 'keep-size', style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', rowGap: '4px', marginBottom: '14px' } });
      const first = (month.getDay() + 6) % 7; // weeks start on Monday
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(d => grid.append(h('div', { style: { fontSize: '12px', color: 'var(--text3)', fontWeight: 600, paddingBottom: '6px' }, text: d })));
      for (let i = 0; i < first; i++) grid.append(h('div'));
      const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      const todayK = Calendar.key(new Date()), selK = Calendar.key(sel);
      for (let d = 1; d <= days; d++) {
        const date = new Date(month.getFullYear(), month.getMonth(), d), k = Calendar.key(date);
        const has = ev.some(e => e.date === k);
        const isT = k === todayK, isS = k === selK;
        const c = h('div', { style: { height: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } },
          h('div', { style: { width: '36px', height: '36px', borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: isT || isS ? 600 : 400, background: isS ? (isT ? 'var(--danger)' : 'var(--text)') : 'none', color: isS ? (isT ? '#fff' : 'var(--bg)') : isT ? 'var(--danger)' : 'var(--text)' }, text: d }),
          h('i', { style: { width: '5px', height: '5px', borderRadius: '50%', background: has ? 'var(--text3)' : 'transparent', marginTop: '1px' } }));
        c.onclick = () => { sel = date; w.refresh(); };
        grid.append(c);
      }
      swipe(grid, dir => { if (dir === 'left') { month.setMonth(month.getMonth() + 1); w.refresh(); } if (dir === 'right') { month.setMonth(month.getMonth() - 1); w.refresh(); } });
      body.append(grid, h('div', { class: 'label', text: sel.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) }));
      const list = ev.filter(e => e.date === selK).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      const card = h('div', { class: 'card' });
      if (!list.length) card.append(h('div', { class: 'row', style: { color: 'var(--text3)' }, text: 'No events' }));
      list.forEach(e => {
        const r = h('div', { class: 'row' }, h('div', { style: { width: '4px', alignSelf: 'stretch', borderRadius: '2px', background: 'var(--accent)' } }), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, text: e.title }), h('div', { class: 'sub', text: e.time ? e.time + (e.notes ? ' · ' + e.notes : '') : 'All day' + (e.notes ? ' · ' + e.notes : '') })));
        press(r, () => add(e), () => Dialog.menu(e.title, null, [{ label: 'Delete Event', danger: true, fn: () => { Calendar.save(Calendar.events().filter(x => x.id !== e.id)); w.refresh(); } }]));
        card.append(r);
      });
      body.append(card);
    };
    const add = existing => {
      w.push(existing ? 'Edit Event' : 'New Event', body => {
        const e = existing || { id: uid(), title: '', date: Calendar.key(sel), time: '', notes: '' };
        const title = h('input', { class: 'field', placeholder: 'Title', value: e.title });
        const date = h('input', { class: 'field', type: 'date', value: e.date });
        const time = h('input', { class: 'field', type: 'time', value: e.time || '' });
        const notes = h('textarea', { class: 'field', placeholder: 'Notes', rows: 3 }); notes.value = e.notes || '';
        const save = h('button', { class: 'btn block', text: 'Save' });
        save.onclick = () => {
          if (!title.value.trim()) { Shell.toast('Give the event a title'); return; }
          const all = Calendar.events().filter(x => x.id !== e.id);
          all.push({ id: e.id, title: title.value.trim(), date: date.value || Calendar.key(sel), time: time.value, notes: notes.value.trim() });
          Calendar.save(all);
          sel = new Date((date.value || Calendar.key(sel)) + 'T12:00'); month = new Date(sel); month.setDate(1);
          const t = $('.widget-today'); if (t) Widgets.today(t);
          w.back();
        };
        const col = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, title, h('div', { class: 'label', style: { margin: '4px 6px -6px' }, text: 'Date' }), date, h('div', { class: 'label', style: { margin: '4px 6px -6px' }, text: 'Time (leave empty for all day)' }), time, notes, save);
        if (existing) { const del = h('button', { class: 'btn block secondary', text: 'Delete Event', style: { color: 'var(--danger)' } }); del.onclick = () => { Calendar.save(Calendar.events().filter(x => x.id !== e.id)); w.back(); }; col.append(del); }
        body.append(col);
        if (!existing) setTimeout(() => title.focus(), 200);
      });
    };
    w.root(view);
    w.addEvent = () => add();
  }
});

// ================================================================ Clock (world, alarms, stopwatch, timer)
const Clock = {
  data() { return Store.app('clock', { cities: [], alarms: [], timer: null, laps: [], sw: null }); },
  save(d) { Store.setApp('clock', d); },
  tab: 'world',
  win: null,
  show(tab) { this.tab = tab; if (this.win) this.win.root(this.render.bind(this)); },
  startTimer(sec, label, reminder) {
    const d = this.data();
    d.timer = { end: Date.now() + sec * 1000, total: sec * 1000, label: label || 'Timer', paused: null, reminder: !!reminder };
    this.save(d);
  },
  tick() {
    const d = this.data();
    if (d.timer && !d.timer.paused && Date.now() >= d.timer.end) {
      const label = d.timer.label, reminder = d.timer.reminder;
      d.timer = null; this.save(d);
      if (reminder) Shell.notify('Reminder', label, { app: 'pets:clarice', glyph: 'bell' });
      else Shell.notify(label + ' finished', 'Your Pets OS timer is done.', { app: 'pets:clock', glyph: 'timer' });
      Phone.vibrate(800);
      try { const a = new AudioContext(); [0, .35, .7].forEach(t => { const o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(.25, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + t + .3); o.start(a.currentTime + t); o.stop(a.currentTime + t + .3); }); } catch (e) { /* no audio */ }
    }
    if (this.win && !this.win.el.classList.contains('hidden') && (this.tab === 'timer' || this.tab === 'stopwatch' || this.tab === 'world')) {
      const live = $('[data-live]', this.win.body);
      if (live) live.dispatchEvent(new Event('tick'));
    }
  },
  render(body) {
    const w = this.win;
    w.setTitle({ world: 'World Clock', alarm: 'Alarms', stopwatch: 'Stopwatch', timer: 'Timer' }[this.tab]);
    w.actions(this.tab === 'world' ? [{ icon: 'plus', fn: () => this.addCity() }] : this.tab === 'alarm' && !isWeb ? [{ icon: 'plus', fn: () => this.addAlarm() }] : []);
    const seg = h('div', { class: 'seg' });
    [['world', 'World'], ['alarm', 'Alarms'], ['stopwatch', 'Stopwatch'], ['timer', 'Timer']].forEach(([k, l]) => { const b = h('button', { class: k === this.tab ? 'on' : '', text: l }); b.onclick = () => this.show(k); seg.append(b); });
    body.append(seg);
    const d = this.data();
    if (this.tab === 'world') {
      const card = h('div', { class: 'card', 'data-live': 1 });
      const draw = () => {
        card.innerHTML = '';
        const zones = [{ name: 'Here', tz: undefined }].concat(d.cities);
        zones.forEach((c, i) => {
          let t = '', day = '';
          try {
            t = new Date().toLocaleTimeString(undefined, { hour: S.use24h ? '2-digit' : 'numeric', minute: '2-digit', hour12: !S.use24h, timeZone: c.tz });
            day = new Date().toLocaleDateString(undefined, { weekday: 'short', timeZone: c.tz });
          } catch (e) { t = '–'; }
          const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'sub', text: day }), h('div', { style: { fontSize: '20px', fontWeight: 500 }, text: c.name })), h('div', { style: { fontFamily: 'InterDisplay, Inter', fontWeight: 300, fontSize: '40px' }, text: t }));
          if (i) press(r, null, () => Dialog.menu(c.name, null, [{ label: 'Remove', danger: true, fn: () => { const dd = this.data(); dd.cities.splice(i - 1, 1); this.save(dd); this.show('world'); } }]));
          card.append(r);
        });
      };
      // Redraw whenever the minute changes (a 1 s timer can skip the :00 second).
      let shown = new Date().getMinutes();
      card.addEventListener('tick', () => { const m = new Date().getMinutes(); if (m !== shown) { shown = m; draw(); } });
      draw();
      body.append(card);
    } else if (this.tab === 'alarm') {
      if (isWeb) {
        body.append(h('div', { class: 'empty-state', html: icon('alarm') + '<br>iPhone only lets its own Clock app ring alarms.<br>Set alarms there; Pets OS timers work here.' }));
        return;
      }
      body.append(h('p', { style: { color: 'var(--text3)', fontSize: '13px', margin: '0 4px 12px', lineHeight: 1.5 }, text: 'Pets OS hands alarms to the phone\'s clock so they ring even when the screen is off or the phone restarts.' }));
      const card = h('div', { class: 'card' });
      if (!d.alarms.length) card.append(h('div', { class: 'row', style: { color: 'var(--text3)' }, text: 'No alarms yet. Tap + to add one.' }));
      d.alarms.forEach((a, i) => {
        const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { style: { fontFamily: 'InterDisplay, Inter', fontWeight: 300, fontSize: '42px' }, text: a.time }), h('div', { class: 'sub', text: a.label || 'Alarm' })));
        const again = h('button', { class: 'btn secondary', text: 'Set again', style: { height: '34px', fontSize: '13px', padding: '0 12px' } });
        again.onclick = () => { const [hh, mm] = a.time.split(':').map(Number); Phone.setAlarm(hh, mm, a.label || 'Pets OS'); };
        r.append(again);
        press(r, null, () => Dialog.menu(a.time, null, [{ label: 'Remove from list', danger: true, fn: () => { const dd = this.data(); dd.alarms.splice(i, 1); this.save(dd); this.show('alarm'); } }]));
        card.append(r);
      });
      body.append(card);
    } else if (this.tab === 'stopwatch') {
      const big = h('div', { 'data-live': 1, style: { textAlign: 'center', fontFamily: 'InterDisplay, Inter', fontWeight: 300, fontSize: '76px', margin: '40px 0', fontVariantNumeric: 'tabular-nums' } });
      const elapsed = () => d.sw ? (d.sw.running ? Date.now() - d.sw.start : 0) + d.sw.acc : 0;
      const fmt = ms => { const cs = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000); return pad2(m) + ':' + pad2(s) + ',' + pad2(cs); };
      let raf = null;
      const loop = () => { big.textContent = fmt(elapsed()); if (d.sw && d.sw.running && big.isConnected) raf = requestAnimationFrame(loop); };
      const left = h('button', { class: 'btn secondary', style: { width: '84px', height: '84px', borderRadius: '50%' } });
      const right = h('button', { class: 'btn', style: { width: '84px', height: '84px', borderRadius: '50%' } });
      const laps = h('div', { class: 'card', style: { marginTop: '24px' } });
      const sync = () => {
        const run = d.sw && d.sw.running;
        left.textContent = run ? 'Lap' : 'Reset'; right.textContent = run ? 'Stop' : 'Start';
        right.style.background = run ? 'var(--danger)' : 'var(--success)';
        laps.innerHTML = '';
        laps.classList.toggle('hidden', !d.laps.length);
        d.laps.slice().reverse().forEach((l, k) => laps.append(h('div', { class: 'row' }, h('span', { class: 'grow', text: 'Lap ' + (d.laps.length - k) }), h('span', { style: { fontVariantNumeric: 'tabular-nums' }, text: fmt(l) }))));
        loop();
      };
      // Save only the stopwatch fields onto fresh data, so a timer or alarm set meanwhile survives.
      const keep = () => { const dd = this.data(); dd.sw = d.sw; dd.laps = d.laps; this.save(dd); };
      right.onclick = () => {
        if (d.sw && d.sw.running) { d.sw.acc += Date.now() - d.sw.start; d.sw.running = false; }
        else { d.sw = d.sw || { acc: 0 }; d.sw.start = Date.now(); d.sw.running = true; }
        keep(); sync();
      };
      left.onclick = () => {
        if (d.sw && d.sw.running) { d.laps.push(elapsed() - d.laps.reduce((a, b) => a + b, 0)); }
        else { d.sw = null; d.laps = []; }
        keep(); sync();
      };
      body.append(big, h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '0 12px' } }, left, right), laps);
      sync();
      w.onHide = () => cancelAnimationFrame(raf);
      w.onShow = () => { if (this.tab === 'stopwatch') { cancelAnimationFrame(raf); loop(); } };
    } else {
      const t = d.timer;
      if (!t) {
        let mins = 5, secs = 0;
        const pick = (label, max, v, set) => {
          const val = h('div', { style: { fontFamily: 'InterDisplay, Inter', fontWeight: 300, fontSize: '56px', width: '96px', textAlign: 'center' }, text: pad2(v) });
          const up = h('button', { html: icon('chevron-down'), style: { transform: 'rotate(180deg)', color: 'var(--text2)' } }), dn = h('button', { html: icon('chevron-down'), style: { color: 'var(--text2)' } });
          const change = k => { v = (v + k + max + 1) % (max + 1); val.textContent = pad2(v); set(v); };
          press(up, () => change(1), () => change(10)); press(dn, () => change(-1), () => change(-10));
          return h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } }, up, val, dn, h('div', { class: 'sub', style: { color: 'var(--text3)' }, text: label }));
        };
        body.append(h('div', { style: { display: 'flex', justifyContent: 'center', gap: '14px', margin: '30px 0' } }, pick('min', 180, mins, v => { mins = v; }), pick('sec', 59, secs, v => { secs = v; })));
        const quick = h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '22px', flexWrap: 'wrap' } });
        [1, 3, 5, 10, 15, 30].forEach(m => { const b = h('button', { class: 'btn secondary', text: m + ' min', style: { height: '36px', fontSize: '14px', padding: '0 14px' } }); b.onclick = () => { this.startTimer(m * 60); this.show('timer'); }; quick.append(b); });
        const start = h('button', { class: 'btn block', text: 'Start', style: { background: 'var(--success)' } });
        start.onclick = () => { const s = mins * 60 + secs; if (s > 0) { this.startTimer(s); this.show('timer'); } };
        const sys = h('button', { class: 'btn block secondary android-only', text: 'Use the phone\'s timer instead', style: { marginTop: '10px' } });
        sys.onclick = () => { const s = mins * 60 + secs; if (s > 0) Phone.setTimer(s, 'Pets OS'); };
        body.append(quick, start, sys, h('p', { style: { color: 'var(--text3)', fontSize: '13px', textAlign: 'center', lineHeight: 1.5 }, text: isWeb ? 'The Pets OS timer rings while Pets OS is open.' : 'The Pets OS timer rings while Pets OS is open. For one that rings with the screen off, use the phone\'s timer.' }));
      } else {
        const left = () => t.paused != null ? t.paused : t.end - Date.now();
        const big = h('div', { 'data-live': 1, style: { textAlign: 'center', fontFamily: 'InterDisplay, Inter', fontWeight: 300, fontSize: '80px', margin: '40px 0 10px', fontVariantNumeric: 'tabular-nums' } });
        const ring = h('div', { style: { height: '6px', borderRadius: '3px', background: 'var(--button)', margin: '0 20px 30px', overflow: 'hidden' } }, h('div', { style: { height: '100%', background: 'var(--warn)', width: '100%' } }));
        const draw = () => { const ms = left(); big.textContent = Fmt.dur(ms); ring.firstChild.style.width = Math.max(0, 100 * ms / t.total) + '%'; if (ms <= 0 && !this.data().timer) this.show('timer'); };
        big.addEventListener('tick', draw); draw();
        const cancel = h('button', { class: 'btn secondary', text: 'Cancel', style: { width: '84px', height: '84px', borderRadius: '50%' } });
        const pause = h('button', { class: 'btn', text: t.paused != null ? 'Resume' : 'Pause', style: { width: '84px', height: '84px', borderRadius: '50%', background: 'var(--warn)', color: '#000' } });
        cancel.onclick = () => { const dd = this.data(); dd.timer = null; this.save(dd); this.show('timer'); };
        pause.onclick = () => { const dd = this.data(); if (!dd.timer) return; if (dd.timer.paused != null) { dd.timer.end = Date.now() + dd.timer.paused; dd.timer.paused = null; } else dd.timer.paused = dd.timer.end - Date.now(); this.save(dd); this.show('timer'); };
        body.append(big, ring, h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '0 12px' } }, cancel, pause));
      }
    }
  },
  async addCity() {
    const zones = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney', 'Africa/Lusaka', 'Africa/Johannesburg', 'Asia/Dubai', 'Asia/Kolkata']);
    const q = await Dialog.prompt('Add a city', 'Type a city name, like Lusaka or Tokyo.', '', { placeholder: 'City' });
    if (!q) return;
    const hit = zones.find(z => z.toLowerCase().split('/').pop().replace(/_/g, ' ') === q.trim().toLowerCase()) || zones.find(z => z.toLowerCase().includes(q.trim().toLowerCase().replace(/ /g, '_')));
    if (!hit) { Shell.toast('No time zone found for ' + q); return; }
    const d = this.data(); d.cities.push({ name: hit.split('/').pop().replace(/_/g, ' '), tz: hit }); this.save(d); this.show('world');
  },
  async addAlarm() {
    const v = await Dialog.prompt('New alarm', 'Pick a time. The phone\'s clock app saves it and rings it.', '07:00', { type: 'time' });
    if (!v) return;
    const label = await Dialog.prompt('Label', null, 'Alarm', { placeholder: 'Alarm' });
    const [hh, mm] = v.split(':').map(Number);
    const d = this.data(); d.alarms.push({ time: v, label: label || 'Alarm' }); this.save(d);
    Phone.setAlarm(hh, mm, label || 'Pets OS');
    this.show('alarm');
  }
};
Apps.register({ id: 'pets:clock', name: 'Clock', glyph: 'clock', bg: G.dark, cat: 'Utilities', keywords: 'alarm timer stopwatch world',
  open(w) { Clock.win = w; w.root(b => Clock.render(b)); w.onQuit = () => { Clock.win = null; }; } });

// ================================================================ Activities (Rest's heart menu)
const Activities = {
  kinds: [['Shower', 'droplet', '#3fb6ff'], ['Eat', 'utensils', '#ffb84d'], ['Sleep', 'bed', '#8c7bff'], ['Run', 'run', '#3dd6a0'], ['Boxing', 'glove', '#ff5c63']],
  data() { return Store.app('activities', { current: null, log: [] }); },
  save(d) { Store.setApp('activities', d); },
  current() { return this.data().current; },
  restore() { this._last = this.current(); },
  tick() {
    const live = Shell.front() && Shell.front().id === 'pets:activities' && $('[data-live]', Shell.front().body);
    if (live) live.dispatchEvent(new Event('tick'));
    if (this.current() && new Date().getSeconds() % 30 === 0) { const t = $('.widget-today'); if (t) Widgets.today(t); }
  },
  start(name) {
    const d = this.data();
    if (d.current) this.stopIn(d);
    d.current = { name, start: Date.now() };
    this.save(d);
  },
  stopIn(d) {
    if (!d.current) return null;
    const e = { name: d.current.name, start: d.current.start, end: Date.now() };
    d.log.unshift(e); d.log = d.log.slice(0, 500); d.current = null;
    return e;
  },
  stop() { const d = this.data(); const e = this.stopIn(d); this.save(d); return e; }
};
Apps.register({
  id: 'pets:activities', name: 'Activities', glyph: 'heart', bg: G.red, cat: 'Pets OS', keywords: 'shower eat sleep run boxing health',
  open(w) {
    w.root(body => {
      const d = Activities.data();
      const cur = d.current;
      if (cur) {
        const k = Activities.kinds.find(x => x[0] === cur.name) || Activities.kinds[0];
        const big = h('div', { 'data-live': 1, style: { fontFamily: 'InterDisplay, Inter', fontWeight: 300, fontSize: '64px', fontVariantNumeric: 'tabular-nums' } });
        const tickF = () => { big.textContent = Fmt.dur(Date.now() - cur.start); };
        big.addEventListener('tick', tickF); tickF();
        const stop = h('button', { class: 'btn block', text: 'Finish ' + cur.name, style: { background: '#fff', color: '#111', marginTop: '18px' } });
        stop.onclick = () => { const e = Activities.stop(); Shell.toast(e.name + ': ' + Fmt.dur(e.end - e.start)); w.refresh(); const t = $('.widget-today'); if (t) Widgets.today(t); };
        body.append(h('div', { style: { background: k[2], color: '#fff', borderRadius: '24px', padding: '20px', marginBottom: '18px' } }, h('div', { html: icon(k[1]) + ' <b style="font-size:18px;vertical-align:4px">' + esc(cur.name) + '</b>' }), big, h('div', { style: { opacity: .85 }, text: 'Started ' + Fmt.time(new Date(cur.start)) }), stop));
      }
      body.append(h('div', { class: 'label', text: cur ? 'Switch to' : 'Start an activity' }));
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' } });
      Activities.kinds.forEach(([name, g, col]) => {
        if (cur && cur.name === name) return;
        const b = h('button', { style: { background: 'var(--card)', borderRadius: '20px', padding: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px' } },
          h('div', { style: { width: '40px', height: '40px', borderRadius: '12px', background: col, color: '#fff', display: 'grid', placeItems: 'center' }, html: icon(g) }), h('b', { text: name }));
        b.onclick = () => { Activities.start(name); w.refresh(); const t = $('.widget-today'); if (t) Widgets.today(t); };
        grid.append(b);
      });
      body.append(grid);
      // Today's totals and history
      const today = Calendar.key(new Date());
      const todays = d.log.filter(e => Calendar.key(new Date(e.start)) === today);
      body.append(h('div', { class: 'label', text: 'Today' }));
      const tot = h('div', { class: 'card' });
      if (!todays.length) tot.append(h('div', { class: 'row', style: { color: 'var(--text3)' }, text: 'Nothing logged today yet.' }));
      Activities.kinds.forEach(([name, g, col]) => {
        const ms = todays.filter(e => e.name === name).reduce((a, e) => a + e.end - e.start, 0);
        if (ms) tot.append(h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: col }, html: icon(g) }), h('span', { class: 'grow', text: name }), h('span', { class: 'val', text: Fmt.dur(ms) })));
      });
      body.append(tot);
      if (d.log.length) {
        body.append(h('div', { class: 'label', text: 'History' }));
        const hist = h('div', { class: 'card' });
        d.log.slice(0, 30).forEach(e => {
          const k = Activities.kinds.find(x => x[0] === e.name) || Activities.kinds[0];
          hist.append(h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: k[2] }, html: icon(k[1]) }), h('div', { class: 'grow' }, h('div', { text: e.name }), h('div', { class: 'sub', text: new Date(e.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + Fmt.time(new Date(e.start)) })), h('span', { class: 'val', text: Fmt.dur(e.end - e.start) })));
        });
        body.append(hist);
      }
    });
    w.onShow = () => w.refresh();
  }
});

// ================================================================ Clarice (on-phone assistant)
const Clarice = {
  log() { return Store.app('clarice', []); },
  save(l) { Store.setApp('clarice', l.slice(-80)); },
  // Understands plain commands on the phone itself. Nothing is sent anywhere.
  async answer(raw) {
    const t = raw.trim(), q = t.toLowerCase().replace(/[?!.]+$/, '');
    let m;
    if (/^(hi|hello|hey|hiya|yo)\b/.test(q)) return 'Hello' + (S.name ? ' ' + S.name : '') + '! Ask me to open an app, set a timer, write a note, check the weather, or do a sum.';
    if (/(what can you do|help|commands)/.test(q)) return 'Try:\n• open Pen\n• set a timer for 10 minutes\n' + (isWeb ? '' : '• alarm at 7:30\n') + '• note buy milk\n• weather in Leeds\n• what\'s 18% of 240\n' + (isWeb ? '' : '• torch on\n') + '• call 07700 900123\n• search pets\n• start a run\n• dark mode' + (isWeb ? '' : '\n• battery');
    if (/(who (made|built|created|designed) (you|pets ?os|this phone|this)|who('s| is) (the )?(creator|maker) of pets ?os|who made pets ?os)/.test(q)) return 'Pets OS is a new operating system created by Fionn Mpho Mwaba. You can read more at petsos.shouldbe.media.';
    if (/(who are you|your name)/.test(q)) return 'I\'m Clarice, the Pets OS assistant. On this phone I work offline and only understand simple commands.';
    if (/^(what('s| is) the time|what time is it|(the )?time( now)?|tell me the time)$/.test(q)) return 'It\'s ' + Fmt.time() + ' ' + Fmt.ampm(new Date()) + '.';
    if (/(what('s| is) (the )?date|what day|today'?s date)/.test(q)) return 'Today is ' + Fmt.date() + '.';
    if (/battery/.test(q)) { const b = json(Phone.battery(), {}); return b.level >= 0 ? 'Battery is at ' + b.level + '%' + (b.charging ? ' and charging.' : '.') : 'I can\'t read the battery here.'; }
    if ((m = /^(?:set (?:a )?)?timer (?:for )?(\d+)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hours?)?$/.exec(q)) || (m = /^(\d+)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hours?) timer$/.exec(q))) {
      const n = +m[1], u = (m[2] || 'm')[0];
      const sec = u === 's' ? n : u === 'h' ? n * 3600 : n * 60;
      Clock.startTimer(sec, 'Timer');
      return 'Timer set for ' + Fmt.dur(sec * 1000) + '. I\'ll tell you when it\'s done.';
    }
    if ((m = /(?:alarm|wake me)(?: up)? (?:at |for )?(\d{1,2})(?::|\.)?(\d{2})?\s*(am|pm)?/.exec(q))) {
      let hh = +m[1]; const mm = +(m[2] || 0);
      if (m[3] === 'pm' && hh < 12) hh += 12; if (m[3] === 'am' && hh === 12) hh = 0;
      if (hh > 23 || mm > 59) return 'That isn\'t a time I understand.';
      if (isWeb) return 'iPhone only lets its own Clock app set alarms. Open Clock and add ' + pad2(hh) + ':' + pad2(mm) + ' there.';
      const d = Clock.data(); d.alarms.push({ time: pad2(hh) + ':' + pad2(mm), label: 'Alarm' }); Clock.save(d);
      Phone.setAlarm(hh, mm, 'Pets OS');
      return 'Setting an alarm for ' + pad2(hh) + ':' + pad2(mm) + ' in the phone\'s clock.';
    }
    if ((m = /^(?:note|write down|remember|add note)[: ]+(.+)$/i.exec(t))) { Pen.add(m[1].trim()); return 'Saved to Pen: "' + m[1].trim() + '"'; }
    if ((m = /^(?:torch|flashlight|light) (on|off)$|^turn (on|off) (?:the )?(?:torch|flashlight|light)$/.exec(q))) {
      if (isWeb) return 'iPhone doesn\'t let Pets OS use the torch. Use the iPhone Control Centre for it.';
      const on = (m[1] || m[2]) === 'on'; CC.torch(on); return 'Torch ' + (on ? 'on.' : 'off.');
    }
    if (/^(dark|light) mode$|^(?:turn on|switch to) (dark|light)/.test(q)) { const th = /dark/.test(q) ? 'dark' : 'light'; Settings.setTheme(th); return 'Switched to ' + th + ' mode.'; }
    if (/^lock( (the )?phone)?$/.test(q)) { setTimeout(() => Shell.lock(), 600); return 'Locking.'; }
    if ((m = /^(?:call|ring|phone) (.+)$/.exec(q))) { const num = m[1].replace(/[^\d+]/g, ''); Phone.dial(num); return num ? 'Opening the dialler for ' + num + '.' : 'Opening the dialler.'; }
    if ((m = /^(?:text|message|sms) (.+)$/.exec(q))) { const num = m[1].replace(/[^\d+]/g, ''); Phone.sms(num); return 'Opening Messages.'; }
    if ((m = /^(?:start|begin|log) (?:a |my )?(shower|eat(?:ing)?|meal|sleep|run(?:ning)?|boxing)$/.exec(q))) {
      const map = { shower: 'Shower', eat: 'Eat', eating: 'Eat', meal: 'Eat', sleep: 'Sleep', run: 'Run', running: 'Run', boxing: 'Boxing' };
      Activities.start(map[m[1]]); return map[m[1]] + ' started. Open Activities to finish it.';
    }
    if (/^(stop|finish|end) (the )?(activity|shower|meal|sleep|run|boxing)$/.test(q)) { const e = Activities.stop(); return e ? e.name + ' finished: ' + Fmt.dur(e.end - e.start) + '.' : 'No activity is running.'; }
    if ((m = /weather(?: (?:in|for|at) (.+))?$/.exec(q))) {
      try {
        let p;
        if (m[1]) { const r = await Weather.search(m[1]); p = r[0]; if (!p) return 'I couldn\'t find ' + m[1] + '.'; }
        else { p = Weather.places()[0]; if (!p) return 'Tell me a place, like "weather in Leeds", or add one in Weather.'; }
        const j = await Weather.forecast(p);
        const desc = (WX_CODES[j.current.weather_code] || ['–'])[0];
        return p.name + ': ' + Math.round(j.current.temperature_2m) + '° and ' + desc.toLowerCase() + '. High ' + Math.round(j.daily.temperature_2m_max[0]) + '°, low ' + Math.round(j.daily.temperature_2m_min[0]) + '°.';
      } catch (e) { return 'I can\'t reach the weather service. Check the internet connection.'; }
    }
    if ((m = /^(?:search|google|look up|find) (?:for )?(.+)$/.exec(q))) { Phone.openUrl('https://search.brave.com/search?q=' + encodeURIComponent(m[1])); return 'Searching for "' + m[1] + '" in Milo.'; }
    if ((m = /^(?:open|launch|start|go to) (.+)$/.exec(q))) {
      const name = m[1].replace(/^the /, '').replace(/ app$/, '');
      if (/settings/.test(name)) { Shell.open('pets:settings'); return 'Opening Settings.'; }
      const app = Apps.all().concat([Apps.get('sys:phone'), Apps.get('sys:messages'), Apps.get('sys:camera')]).find(a => a && a.name.toLowerCase() === name) ||
        Apps.all().find(a => a.name.toLowerCase().startsWith(name)) || Apps.all().find(a => a.name.toLowerCase().includes(name));
      if (!app) return 'I can\'t find an app called "' + name + '".';
      setTimeout(() => Shell.open(app.id), 500);
      return 'Opening ' + app.name + '.';
    }
    if ((m = /^(?:what(?:'s| is) )?(?:(\d+(?:\.\d+)?)% of (\d+(?:\.\d+)?))$/.exec(q))) return Calc.show(m[1] * m[2] / 100) + '.';
    const expr = q.replace(/^(what(?:'s| is)|calculate|work out)\s+/, '').replace(/times|x/g, '*').replace(/divided by|over/g, '/').replace(/plus/g, '+').replace(/minus/g, '-').replace(/squared/g, '^2');
    if (/^[\d\s.+\-*/^()%]+$/.test(expr) && /\d/.test(expr) && /[+\-*/^%]/.test(expr)) { try { return expr.trim() + ' = ' + Calc.show(Calc.evaluate(expr)); } catch (e) { /* fall through */ } }
    if (/(thank|thanks|cheers)/.test(q)) return 'Any time.';
    return 'I didn\'t catch that. On the phone I understand simple commands. Say "help" to see them, or "search ' + t.slice(0, 40) + '" to look it up in Milo.';
  }
};
// ---- Syncro (owner builds only: build.sh owner puts the real Syncro web app in apps/syncro and sets
// PETS_OWNER.syncro). Syncro runs in a frame; its account requests come to PetsOSHost, and the phone carries
// them to the account server on the owner's Mac on the home Wi-Fi (SyncroLink.java). Away from home Syncro
// keeps working with its saved session, as it does on an iPhone.
if (window.PETS_OWNER && window.PETS_OWNER.syncro) {
  window.PetsOSHost = {
    n: 0, waiting: {},
    syncroRequest(method, url, headers, body) {
      return new Promise((resolve, reject) => {
        if (!onPhone) { reject(new Error('Syncro needs the phone')); return; }
        const id = String(++this.n);
        const t = setTimeout(() => { delete this.waiting[id]; reject(new Error('timeout')); }, 30000);
        this.waiting[id] = { resolve, reject, t };
        window.PetsAndroid.syncroRequest(id, method, url, JSON.stringify(headers || {}), body || '');
      });
    },
    _done(id, json) {
      const w = this.waiting[id];
      if (!w) return;
      delete this.waiting[id];
      clearTimeout(w.t);
      let r = {};
      try { r = JSON.parse(json); } catch (e) { r = { status: -1, data: 'error' }; }
      if (r.status < 0) { w.reject(new Error(r.data)); SyncroApp.offerAddress(r.data); }
      else { SyncroApp.hideAddress(); w.resolve({ status: r.status, data: r.data }); }
    }
  };

  var SyncroApp = {
    w: null,
    // When the Mac can't be found by name: say so, and let the owner type its address once.
    offerAddress(why) {
      const w = this.w;
      if (!w || $('.syncro-addr', w.el)) return;
      const input = h('input', { type: 'text', inputmode: 'url', placeholder: 'e.g. 192.168.1.20', value: onPhone ? window.PetsAndroid.syncroServer() : '',
                                 style: { width: '100%', margin: '8px 0', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,.2)', background: 'rgba(0,0,0,.25)', color: '#fff', font: 'inherit' } });
      const save = h('button', { class: 'btn', text: 'Use this address' });
      const auto = h('button', { class: 'btn', text: 'Find it by name', style: { marginLeft: '8px', opacity: .8 } });
      const box = h('div', { class: 'syncro-addr', style: { position: 'absolute', left: '12px', right: '12px', bottom: '28px', zIndex: 5, padding: '14px 16px', borderRadius: '16px',
                                                             background: 'rgba(28,29,43,.96)', color: '#EDF2F4', boxShadow: '0 10px 30px rgba(0,0,0,.4)', fontSize: '14px' } },
        h('b', { text: why || "Can't reach your Mac" }),
        h('div', { style: { opacity: .8, marginTop: '4px' }, text: "Syncro's accounts live on your Mac. Be on the same Wi-Fi with the Mac on, or type the Mac's address (System Settings > Wi-Fi > Details > IP address)." }),
        input, h('div', null, save, auto),
        h('button', { text: '×', 'aria-label': 'Close', style: { position: 'absolute', top: '6px', right: '10px', background: 'none', border: 0, color: '#EDF2F4', fontSize: '22px' }, onclick: () => box.remove() }));
      save.onclick = () => { window.PetsAndroid.setSyncroServer(input.value.trim()); box.remove(); Shell.toast('Saved. Try again in Syncro.'); };
      auto.onclick = () => { window.PetsAndroid.setSyncroServer(''); box.remove(); Shell.toast('Syncro will look for your Mac by name.'); };
      w.el.append(box);
    },
    hideAddress() { const b = this.w && $('.syncro-addr', this.w.el); if (b) b.remove(); }
  };

  Apps.register({
    id: 'pets:syncro', name: 'Syncro', img: 'apps/syncro/pets-icon.png', cat: 'Pets OS', keywords: 'rota shifts work routine planner projects george',
    open(w) {
      SyncroApp.w = w;
      w.header.style.display = 'none';
      w.el.style.background = '#2B2D42';
      Object.assign(w.body.style, { padding: '0', paddingTop: 'var(--bar)', overflow: 'hidden', display: 'flex' });
      const frame = h('iframe', { src: 'apps/syncro/', title: 'Syncro', style: { flex: '1', width: '100%', border: '0', background: '#2B2D42' } });
      w.body.append(frame);
      w.frame = frame;
      // Back: Syncro's own pages first (the sign-in page), then leave.
      w.onBack = () => {
        try {
          const loc = frame.contentWindow.location.pathname;
          if (loc !== '/apps/syncro/' && loc !== '/apps/syncro/index.html') { frame.contentWindow.history.back(); return true; }
        } catch (e) { /* not loaded */ }
        return false;
      };
    }
  });
}

Apps.register({
  id: 'pets:clarice', name: 'Clarice', img: 'img/icons/clarice.png', cat: 'Pets OS', keywords: 'assistant help ask',
  open(w) {
    w.actions([{ icon: 'trash-2', fn: async () => { if (await Dialog.confirm('Clear the conversation?', null, 'Clear', true)) { Clarice.save([]); w.refresh(); } } }]);
    w.root(body => {
      body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.paddingBottom = '0';
      const list = h('div', { style: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '10px' } });
      const bubble = (who, text) => {
        const mine = who === 'me';
        const b = h('div', { style: { alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', display: 'flex', gap: '8px', alignItems: 'flex-end' } });
        if (!mine) b.append(h('img', { src: 'img/clarice-avatar.jpg', style: { width: '28px', height: '28px', borderRadius: '50%', flex: 'none' } }));
        b.append(h('div', { style: { background: mine ? 'var(--accent)' : 'var(--card)', color: mine ? '#fff' : 'var(--text)', padding: '10px 14px', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', whiteSpace: 'pre-wrap', lineHeight: 1.4, userSelect: 'text' }, text }));
        list.append(b); list.scrollTop = list.scrollHeight;
      };
      const log = Clarice.log();
      if (!log.length) {
        list.append(h('div', { style: { textAlign: 'center', padding: '24px 10px 10px', color: 'var(--text2)' } },
          h('img', { src: 'img/clarice-avatar.jpg', style: { width: '84px', height: '84px', borderRadius: '50%', marginBottom: '10px' } }),
          h('div', { style: { fontWeight: 600, fontSize: '18px', color: 'var(--text)' }, text: 'Hi' + (S.name ? ' ' + S.name : '') + ', I\'m Clarice.' }),
          h('div', { style: { fontSize: '14px', marginTop: '4px', lineHeight: 1.5 }, text: 'I run on this phone and handle simple commands. Nothing you type leaves the phone, except weather and search look-ups.' })));
        const chips = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '6px' } });
        ['What can you do?', 'Weather', 'Timer for 5 minutes', 'Battery'].forEach(c => { const b = h('button', { class: 'btn secondary', text: c, style: { height: '34px', fontSize: '13px', padding: '0 12px' } }); b.onclick = () => send(c); chips.append(b); });
        list.append(chips);
      }
      log.forEach(e => bubble(e.who, e.text));
      const f = h('input', { class: 'field', placeholder: 'Ask Clarice', enterkeyhint: 'send', style: { flex: 1, borderRadius: '23px' } });
      const go = h('button', { class: 'btn', html: icon('send'), style: { width: '46px', padding: 0, borderRadius: '23px' } });
      const send = async text => {
        text = (text || f.value).trim(); if (!text) return;
        f.value = '';
        const l = Clarice.log(); l.push({ who: 'me', text }); Clarice.save(l);
        if (!list.hasAttribute('data-bubbled')) { list.innerHTML = ''; Clarice.log().forEach(e => bubble(e.who, e.text)); list.setAttribute('data-bubbled', 1); }
        else bubble('me', text);
        const reply = await Clarice.answer(text);
        const l2 = Clarice.log(); l2.push({ who: 'clarice', text: reply }); Clarice.save(l2);
        bubble('clarice', reply);
      };
      if (log.length) list.setAttribute('data-bubbled', 1);
      go.onclick = () => send();
      f.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
      body.append(list, h('div', { style: { display: 'flex', gap: '8px', padding: '8px 0 calc(34px + var(--sab))' } }, f, go));
      w.clariceSend = send;
    });
  }
});

// ================================================================ Files (the phone's storage)
const Files = {
  size(b) { if (b < 1024) return b + ' B'; const u = ['KB', 'MB', 'GB', 'TB']; let i = -1; do { b /= 1024; i++; } while (b >= 1024 && i < 3); return (b < 10 ? b.toFixed(1) : Math.round(b)) + ' ' + u[i]; },
  glyph(name, dir) {
    if (dir) return ['folder', '#5b8cff'];
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (/^(jpg|jpeg|png|gif|webp|heic|bmp)$/.test(ext)) return ['image', '#3dd6a0'];
    if (/^(mp3|m4a|wav|flac|ogg|aac)$/.test(ext)) return ['music', '#ff6b8b'];
    if (/^(mp4|mkv|mov|webm|3gp)$/.test(ext)) return ['image-play', '#8c7bff'];
    if (/^(txt|md|pdf|doc|docx|rtf)$/.test(ext)) return ['file-text', '#ffb84d'];
    if (ext === 'apk') return ['smartphone', '#3dd6a0'];
    if (/^(zip|rar|7z|tar|gz)$/.test(ext)) return ['archive', '#5d6680'];
    return ['file', '#5d6680'];
  }
};
if (!isWeb) Apps.register({
  id: 'pets:files', name: 'Files', glyph: 'folder', bg: G.blue, cat: 'Pets OS', keywords: 'storage documents downloads folders',
  open(w) {
    let path = '', showHidden = false;
    const crumbs = () => path ? path.split('/') : [];
    const view = body => {
      w.setTitle(path ? crumbs().slice(-1)[0] : 'Files');
      w.backEl.classList.toggle('hidden', !path);
      w.backEl.innerHTML = path ? icon('chevron-left') + esc(crumbs().length > 1 ? crumbs().slice(-2)[0] : 'Files') : '';
      w.actions([{ icon: 'plus', fn: async () => {
        const n = await Dialog.prompt('New folder', null, '', { placeholder: 'Folder name' });
        if (n && n.trim() && !n.includes('/')) { if (!Phone.makeFolder((path ? path + '/' : '') + n.trim())) Shell.toast('Couldn\'t make that folder'); w.refresh(); }
      } }]);
      if (!Phone.storageAllowed()) {
        body.append(h('div', { class: 'empty-state', html: icon('folder') + '<br>Pets OS needs permission to show the files on this phone.' }));
        const b = h('button', { class: 'btn block', text: 'Allow access to files' }); b.onclick = () => Phone.askStorage();
        body.append(b); return;
      }
      if (!path) {
        const st = json(Phone.storageInfo(), {});
        if (st.total) {
          const used = st.total - st.free;
          body.append(h('div', { class: 'card' }, h('div', { class: 'row', style: { display: 'block' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '14px' } }, h('b', { text: 'Phone storage' }), h('span', { class: 'val', text: Files.size(used) + ' of ' + Files.size(st.total) + ' used' })),
            h('div', { style: { height: '8px', borderRadius: '4px', background: 'var(--button)', marginTop: '10px', overflow: 'hidden' } }, h('div', { style: { height: '100%', width: Math.round(100 * used / st.total) + '%', background: 'var(--accent)' } })))));
        }
        const quick = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '14px' } });
        [['Download', 'download'], ['DCIM', 'image'], ['Pictures', 'image'], ['Music', 'music'], ['Documents', 'file-text'], ['Movies', 'image-play']].forEach(([name, g]) => {
          const b = h('button', { style: { background: 'var(--card)', borderRadius: '16px', padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500 }, html: icon(g) + '<span>' + (name === 'DCIM' ? 'Camera' : name) + '</span>' });
          b.onclick = () => { path = name; w.refresh(); };
          quick.append(b);
        });
        body.append(quick);
      }
      const list = json(Phone.listFiles(path), null);
      if (!list) { body.append(h('div', { class: 'empty-state', text: 'This folder can\'t be opened.' })); return; }
      const items = list.filter(f => showHidden || !f.hidden).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      const card = h('div', { class: 'card' });
      if (!items.length) card.append(h('div', { class: 'row', style: { color: 'var(--text3)' }, text: 'This folder is empty' }));
      items.forEach(f => {
        const rel = (path ? path + '/' : '') + f.name;
        const [g, col] = Files.glyph(f.name, f.dir);
        const r = h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: col }, html: icon(g) }),
          h('div', { class: 'grow' }, h('div', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, text: f.name }),
            h('div', { class: 'sub', text: new Date(f.modified).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + (f.dir ? '' : ' · ' + Files.size(f.size)) })),
          f.dir ? h('span', { class: 'chev', html: icon('chevron-right') }) : null);
        press(r, () => { if (f.dir) { path = rel; w.refresh(); w.body.scrollTop = 0; } else if (!Phone.openFile(rel)) Shell.toast('No app can open this file'); },
          () => Dialog.menu(f.name, f.dir ? 'Folder' : Files.size(f.size), [
            f.dir ? null : { label: 'Open', fn: () => Phone.openFile(rel) || Shell.toast('No app can open this file') },
            f.dir ? null : { label: 'Share', fn: () => Phone.shareFile(rel) },
            { label: 'Rename', fn: async () => { const n = await Dialog.prompt('Rename', null, f.name); if (n && n.trim() && n !== f.name) { if (!Phone.renameFile(rel, n.trim())) Shell.toast('Couldn\'t rename it'); w.refresh(); } } },
            { label: 'Delete', danger: true, fn: async () => { if (await Dialog.confirm('Delete ' + f.name + '?', f.dir ? 'The folder and everything in it is deleted from the phone.' : 'It is deleted from the phone.', 'Delete', true)) { if (!Phone.deleteFile(rel)) Shell.toast('Couldn\'t delete it'); w.refresh(); } } }
          ].filter(Boolean)));
        card.append(r);
      });
      body.append(card);
      const hid = h('button', { class: 'btn block secondary', text: showHidden ? 'Hide hidden files' : 'Show hidden files', style: { height: '40px', fontSize: '14px' } });
      hid.onclick = () => { showHidden = !showHidden; w.refresh(); };
      body.append(hid);
    };
    w.onBack = () => { if (!path) return false; path = crumbs().slice(0, -1).join('/'); w.refresh(); return true; };
    w.root(view);
    w.onShow = () => w.refresh();
  }
});

// ================================================================ O Store
Apps.register({
  id: 'pets:ostore', name: 'O Store', img: 'img/icons/ostore.png', cat: 'Pets OS', keywords: 'store apps download install',
  open(w) {
    const pill = (text, primary, fn) => {
      const b = h('button', { class: 'btn ' + (primary ? '' : 'secondary'), text, style: { height: '32px', borderRadius: '16px', fontSize: '14px', padding: '0 16px', flex: 'none' } });
      if (fn) b.onclick = e => { e.stopPropagation(); fn(b); }; else b.disabled = true;
      return b;
    };
    const smallTile = (app, px) => { const t = Apps.tile(app); Object.assign(t.style, { width: px + 'px', height: px + 'px', borderRadius: (px / 4) + 'px', flex: 'none' }); return t; };
    const entryTile = (e, px) => {
      const app = Apps.builtin['store:' + e.id];
      if (app) return smallTile(app, px);
      const t = h('div', { class: 'tile', style: { width: px + 'px', height: px + 'px', borderRadius: (px / 4) + 'px', flex: 'none', background: e.icon ? 'url(' + e.icon + ') center/cover' : letterColour(e.name), color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 600 } });
      if (!e.icon) t.textContent = e.name.slice(0, 1);
      return t;
    };
    const facts = e => 'Version ' + e.version + ' · ' + Files.size(e.size || 0) + (PetStore.incompatible(e) ? ' · ' + PetStore.incompatible(e) : '');
    // Install or update. Progress shows on every Get button for that app (list and detail page), and
    // survives the screen being redrawn while the download runs.
    const showProgress = (id, p) => $$('[data-store-progress="' + id + '"]', w.el).forEach(b => {
      b.textContent = Math.round(p * 100) + '%';
      b.style.background = 'linear-gradient(90deg, var(--accent) ' + Math.round(p * 100) + '%, var(--button) ' + Math.round(p * 100) + '%)';
    });
    const install = async e => {
      const updating = PetStore.state(e) === 'update';
      const job = PetStore.install(e.id, p => showProgress(e.id, p));
      w.refresh(); // every Get button for this app becomes a progress bar
      showProgress(e.id, PetStore.busy[e.id] || 0);
      try {
        const how = await job;
        Shell.toast(how === 'updated' ? e.name + ' updated to ' + e.version : e.name + ' installed. It\'s on your Home Screen.');
      } catch (err) {
        Dialog.menu(e.name + (updating ? ' wasn\'t updated' : ' wasn\'t installed'), err.message || 'Something went wrong.', []);
      }
      w.refresh();
    };
    const action = e => {
      const st = PetStore.state(e);
      if (PetStore.busy[e.id] != null) { const b = pill(Math.round(PetStore.busy[e.id] * 100) + '%', false, null); b.setAttribute('data-store-progress', e.id); b.classList.add('busy'); return b; }
      if (st === 'get') return pill('Get', true, () => install(e));
      if (st === 'update') return pill('Update', true, () => install(e));
      if (st === 'open') return pill('Open', false, () => Shell.open('store:' + e.id));
      return pill('Can\'t install', false, null);
    };
    const detail = e => w.push(e.name, body => {
      body.append(h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center', margin: '4px 0 16px' } }, entryTile(e, 84),
        h('div', { class: 'grow' }, h('div', { style: { fontSize: '22px', fontWeight: 600 }, text: e.name }), h('div', { class: 'sub', text: e.category || 'App' }), h('div', { style: { marginTop: '8px' } }, action(e)))));
      if (e.description) body.append(h('div', { class: 'card' }, h('div', { class: 'row', style: { display: 'block', lineHeight: 1.5, whiteSpace: 'pre-wrap' }, text: e.description })));
      const have = PetStore.installed[e.id];
      const info = h('div', { class: 'card' });
      [['Version', e.version], ['Size', Files.size(e.size || 0)], ['Works on', PetStore.incompatible(e) || ('This phone' + (e.minPets ? ' (Pets OS ' + e.minPets + ' or later)' : ''))], have ? ['Installed', 'Version ' + have.version] : null, ['Checked', 'Signed list and SHA-256 fingerprint']]
        .filter(Boolean).forEach(([k, v]) => info.append(h('div', { class: 'row' }, h('span', { class: 'grow', text: k }), h('span', { class: 'val', text: String(v) }))));
      body.append(info);
      if (have) { const u = h('button', { class: 'btn block secondary', text: 'Uninstall…', style: { color: 'var(--danger)' } }); u.onclick = () => PetStore.askUninstall(e.id, () => { w.back(); w.refresh(); }); body.append(u); }
    });
    let loading = false;
    const load = () => { if (loading) return; loading = true; PetStore.refresh().finally(() => { loading = false; if (!w.stack.length) w.refresh(); }); };
    w.root(body => {
      const onHome = id => S.home.some(p => p.indexOf(id) >= 0) || S.dock.indexOf(id) >= 0;
      body.append(h('div', { style: { borderRadius: '22px', padding: '20px', background: 'linear-gradient(135deg,#5b8cff,#8c7bff)', color: '#fff', marginBottom: '16px' } },
        h('div', { style: { fontSize: '12px', fontWeight: 600, opacity: .85, textTransform: 'uppercase' }, text: 'Pets OS for Stephone' }),
        h('div', { style: { fontSize: '24px', fontWeight: 600, margin: '4px 0' }, text: 'Get apps for your phone' }),
        h('div', { style: { opacity: .9, fontSize: '14px' }, text: 'Every app here is checked before it installs: it must come from the signed Pets OS app list and match its fingerprint.' })));
      // Downloadable apps from the signed catalogue.
      body.append(h('div', { class: 'label', text: 'Apps to download' + (PetStore.isDev() ? ' · development list' : '') }));
      const cat = PetStore.catalog;
      if (!cat && !PetStore.problem) { body.append(h('div', { class: 'card' }, h('div', { class: 'row', style: { color: 'var(--text3)' }, text: 'Loading the app list…' }))); load(); }
      else if (!cat) {
        const again = pill('Try again', false, () => { PetStore.problem = null; w.refresh(); });
        body.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow', style: { lineHeight: 1.45 }, text: PetStore.problem }), again)));
      } else if (!cat.apps.length) body.append(h('div', { class: 'card' }, h('div', { class: 'row', style: { color: 'var(--text3)' }, text: 'No phone apps are available yet.' })));
      else {
        const card = h('div', { class: 'card' });
        cat.apps.forEach(e => {
          const r = h('div', { class: 'row' }, entryTile(e, 48), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, text: e.name }),
            h('div', { class: 'sub', text: e.summary || e.category || '' }), h('div', { class: 'sub', text: facts(e) })), action(e));
          press(r, () => detail(e));
          card.append(r);
        });
        body.append(card);
      }
      // Installed store apps that are no longer listed (or while offline) can still be opened and removed.
      const orphans = Object.values(PetStore.installed).filter(rec => !PetStore.entry(rec.id));
      if (orphans.length) {
        const card = h('div', { class: 'card' });
        orphans.forEach(rec => {
          const app = Apps.builtin['store:' + rec.id];
          card.append(h('div', { class: 'row' }, app ? smallTile(app, 48) : null, h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, text: rec.name }), h('div', { class: 'sub', text: 'Version ' + rec.version + ' · ' + Files.size(rec.size || 0) })),
            pill('Open', false, () => Shell.open('store:' + rec.id)), pill('Remove', false, () => PetStore.askUninstall(rec.id, () => w.refresh()))));
        });
        body.append(h('div', { class: 'label', text: 'Installed' }), card);
      }
      // Built into Pets OS: always installed, can be put back on the Home Screen.
      const card = h('div', { class: 'card' });
      Object.values(Apps.builtin).filter(a => a.id.startsWith('pets:') && !a.hiddenFromRest && a.id !== 'pets:ostore').forEach(a => {
        const has = onHome(a.id);
        const btn = has ? pill('Open', false, () => Shell.open(a.id)) : pill('Add', true, () => { PetStore.addToHome(a.id); Shell.buildHome(); Shell.toast(a.name + ' added to your Home Screen'); w.refresh(); });
        card.append(h('div', { class: 'row' }, smallTile(a, 48), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, text: a.name }), h('div', { class: 'sub', text: 'Included with Pets OS ' + PETS_VERSION })), btn));
      });
      body.append(h('div', { class: 'label', text: 'Included with Pets OS' }), card);
      const droid = h('div', { class: 'card' });
      const r = h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: G.green }, html: icon('bag') }), h('div', { class: 'grow' }, h('div', { text: isWeb ? 'Get iPhone apps' : 'Get Android apps' }), h('div', { class: 'sub', text: isWeb ? 'Opens the App Store.' : 'Opens the phone\'s app store. New apps show up in Rest and on your Home Screen.' })), h('span', { class: 'chev', html: icon('chevron-right') }));
      press(r, () => Phone.store() || Shell.toast('No app store found on this phone'));
      droid.append(r);
      body.append(h('div', { class: 'label', text: isWeb ? 'iPhone apps' : 'Android apps' }), droid);
      body.append(h('p', { style: { color: 'var(--text3)', fontSize: '13px', lineHeight: 1.5, margin: '4px 6px' }, text: 'Desktop Pets OS packages (.pet) need the full Pets OS computer system and can\'t run on the phone.' }));
    });
  }
});

// ================================================================ Settings
const Settings = {
  setTheme(t) {
    S.theme = t; Store.save();
    document.documentElement.classList.toggle('light', t === 'light');
    Shell.statusTone();
  },
  applyMotion() { document.documentElement.classList.toggle('reduce-motion', !!S.reduceMotion); }
};
Apps.register({
  id: 'pets:settings', name: 'Settings', glyph: 'settings', bg: G.grey, cat: 'Pets OS', keywords: 'preferences wallpaper passcode',
  open(w) {
    const row = (sq, colour, label, val, fn, extra) => {
      const r = h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: colour }, html: icon(sq) }), h('div', { class: 'grow' }, h('div', { text: label }), extra ? h('div', { class: 'sub', text: extra }) : null), val != null ? h('span', { class: 'val', text: val }) : null, fn ? h('span', { class: 'chev', html: icon('chevron-right') }) : null);
      if (fn) press(r, fn);
      return r;
    };
    const toggleRow = (sq, colour, label, on, fn, extra) => {
      const t = h('div', { class: 'toggle' + (on ? ' on' : '') });
      const r = h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: colour }, html: icon(sq) }), h('div', { class: 'grow' }, h('div', { text: label }), extra ? h('div', { class: 'sub', text: extra }) : null), t);
      press(r, () => { const v = !t.classList.contains('on'); t.classList.toggle('on', v); fn(v); });
      return r;
    };
    const droid = el => isWeb ? null : el; // Android-only rows
    const main = body => {
      const dev = json(Phone.device(), {});
      const me = h('div', { class: 'card' }, h('div', { class: 'row', style: { padding: '14px' } },
        h('div', { style: { width: '58px', height: '58px', borderRadius: '50%', background: 'linear-gradient(145deg,#5b8cff,#8c7bff)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '24px', fontWeight: 600 }, text: (S.name || 'P').slice(0, 1).toUpperCase() }),
        h('div', { class: 'grow' }, h('div', { style: { fontSize: '20px', fontWeight: 600 }, text: S.name || 'Your name' }), h('div', { class: 'sub', text: 'Pets OS on ' + (dev.manufacturer || '') + ' ' + (dev.model || '') })), h('span', { class: 'chev', html: icon('chevron-right') })));
      press(me.firstChild, async () => { const n = await Dialog.prompt('Your name', null, S.name, { max: 40 }); if (n != null) { S.name = n.trim(); Store.save(); w.refresh(); } });
      body.append(me);
      const phoneCard = h('div', { class: 'card' },
        row('wifi', '#3d7bff', 'Wi-Fi', Phone.network() === 'wifi' ? 'Connected' : 'Not connected', () => Phone.settings('wifi'), 'Opens Android Wi-Fi settings'),
        row('bluetooth', '#3d7bff', 'Bluetooth', null, () => Phone.settings('bluetooth'), 'Opens Android Bluetooth settings'),
        row('signal', '#3dd6a0', 'Mobile data', Phone.network() === 'cell' ? 'In use' : null, () => Phone.settings('data'), 'Opens Android mobile data settings'),
        row('plane', '#ffb84d', 'Airplane mode', null, () => Phone.settings('airplane'), 'Opens Android airplane mode settings'));
      if (!isWeb) body.append(phoneCard);
      if (isWeb && !document.documentElement.classList.contains('stephone') && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches))
        body.append(h('div', { class: 'card' }, row('download', '#3d7bff', 'Add Pets OS to your Home Screen', null, null, 'In Safari: Share, then Add to Home Screen. It then opens full screen and works offline.')));
      const look = h('div', { class: 'card' },
        row('image', '#2fb8d8', 'Wallpaper', (Wallpapers.list.find(x => x.id === S.wallpaper) || { name: 'Your photo' }).name, () => w.push('Wallpaper', wallView)),
        toggleRow('moon', '#5b5f7a', 'Dark mode', S.theme === 'dark', v => Settings.setTheme(v ? 'dark' : 'light')),
        droid(row('sun', '#3d7bff', 'Display & brightness', null, () => Phone.settings('display'))),
        toggleRow('clock', '#8c7bff', '24-hour time', S.use24h, v => { S.use24h = v; Store.save(); Shell.tick(); }));
      body.append(look);
      const sec = h('div', { class: 'card' },
        row('lock', '#ff5c63', 'Passcode', S.pin ? 'On' : 'Off', () => w.push('Passcode', pinView)),
        row('bell', '#ff5c63', 'Notifications', (S.notifOff || []).length ? (S.notifOff.length + ' app' + (S.notifOff.length > 1 ? 's' : '') + ' off') : null, () => w.push('Notifications', notifView)),
        toggleRow('bell-off', '#8c7bff', 'Focus', S.dnd, v => { S.dnd = v; Store.save(); }, 'Silence Pets OS alerts'),
        row('smartphone', '#3d7bff', 'Accessibility', null, () => w.push('Accessibility', a11yView)),
        droid(row('shield', '#3d7bff', 'Android security', null, () => Phone.settings('security'))));
      body.append(sec);
      const homeCard = h('div', { class: 'card' },
        droid(row('house', '#3dd6a0', 'Default home app', dev.defaultHome ? 'Pets OS' : 'Not Pets OS', () => Phone.askToBeHome(), dev.defaultHome ? null : 'Choose Pets OS so the Home button comes here')),
        droid(toggleRow('layout-grid', '#3dd6a0', 'Add new apps to Home Screen', S.autoAddAndroid, v => { S.autoAddAndroid = v; Store.save(); })),
        row('rotate', '#5d6680', 'Reset Home Screen layout', null, async () => { if (await Dialog.confirm('Reset the Home Screen?', 'Icons go back to where Pets OS first put them. Apps are not deleted.', 'Reset')) { S.home = null; Shell.ensureHome(); S.dock = Store.defaults().dock; Store.save(); Shell.buildHome(); Shell.toast('Home Screen reset'); } }));
      body.append(homeCard);
      const huawei = /huawei|honor/i.test(dev.manufacturer || '');
      const startCard = h('div', { class: 'card' },
        row('power', '#3dd6a0', 'Start with the phone', dev.defaultHome ? 'On' : 'Off', () => startUp(dev),
          dev.defaultHome ? 'Pets OS opens every time the phone turns on' : 'Make Pets OS open when the phone turns on'),
        huawei ? row('shield', '#ff5c63', 'Allow auto-launch', null, () => Phone.autoLaunchSettings(), 'Huawei: let Pets OS start by itself in App launch') : null,
        row('download', '#3d7bff', 'Software Update', 'Pets OS ' + (dev.version || '1.0'), () => w.push('Software Update', updateView)));
      if (!isWeb) body.append(h('div', { class: 'label', text: 'Start-up & updates' }), startCard);
      const phoneMore = h('div', { class: 'card' },
        row('volume-2', '#ff5c63', 'Sound', null, () => w.push('Sound', soundView)),
        row('hard-drive', '#5d6680', 'Storage', (() => { const st = json(Phone.storageInfo(), {}); return st.total ? Files.size(st.free) + ' free' : null; })(), () => Shell.open('pets:files')),
        huawei || Apps.android.some(a => Apps.isHuawei(a.pkg)) ? row('layout-grid', '#ff5c63', 'Huawei apps', S.hideHuawei ? 'Hidden' : 'Shown', () => w.push('Huawei apps', huaweiView)) : null);
      if (!isWeb) body.append(phoneMore);
      const fresh = h('div', { class: 'card' }, row('rotate', '#ff5c63', 'Start fresh', null, async () => {
        if (!(await Dialog.confirm('Start Pets OS fresh?', 'This erases Pets OS settings, notes, events, photos in Moments, activities and the passcode on this phone, then starts setup again. ' + (isWeb ? 'Your other iPhone apps are not touched.' : 'Huawei, Android and your other apps and their data are not touched.'), 'Erase Pets OS data', true))) return;
        localStorage.clear(); try { indexedDB.deleteDatabase('petsos-moments'); } catch (e) { /* ignore */ }
        location.reload();
      }, 'Erase Pets OS data and set it up again'));
      const about = h('div', { class: 'card' },
        droid(row('battery-full', '#3dd6a0', 'Battery', (b => b.level == null ? '–' : b.level + '%')(json(Phone.battery(), {})), () => Phone.settings('battery'))),
        row('info', '#5d6680', 'About Pets OS', isWeb ? 'Pets OS ' + PETS_VERSION : null, () => w.push('About', aboutView)),
        droid(row('smartphone', '#5d6680', 'All Android settings', null, () => Phone.settings('main'))));
      body.append(about, fresh);
    };
    const note = text => h('p', { style: { color: 'var(--text3)', fontSize: '13px', lineHeight: 1.5, margin: '0 6px 14px' }, text });
    const notifView = body => {
      const dev = json(Phone.device(), {});
      if (!isWeb) {
        body.append(h('div', { class: 'card' }, row('bell', '#ff5c63', 'Phone notifications in Pets OS', dev.notifAccess ? 'Allowed' : 'Off', () => Phone.settings('notifications'), 'Opens Android Notification access')));
        body.append(note('Alerts from Android apps are controlled in Android\'s own settings.'));
      }
      body.append(h('div', { class: 'label', text: 'Pets OS apps' }));
      const card = h('div', { class: 'card' });
      Object.values(Apps.builtin).filter(a => a.id.startsWith('pets:') && !a.launch).forEach(a => {
        const off = (S.notifOff || []).indexOf(a.id) >= 0;
        card.append(toggleRow('bell', '#5d6680', a.name, !off, v => {
          S.notifOff = (S.notifOff || []).filter(x => x !== a.id).concat(v ? [] : [a.id]); Store.save();
        }));
      });
      body.append(card, note('When an app is off, its alerts are not shown or kept. Focus silences sounds and banners for every app but still keeps the alerts.'));
    };
    const a11yView = body => {
      body.append(h('div', { class: 'card' }, toggleRow('smartphone', '#3d7bff', 'Reduce motion', !!S.reduceMotion, v => { S.reduceMotion = v; Store.save(); Settings.applyMotion(); }, 'Turns off zooms, slides and fades')));
      body.append(note('Text size and screen readers are set in Android\'s own Accessibility settings for now.'));
      if (!isWeb) body.append(h('div', { class: 'card' }, row('settings', '#5d6680', 'Android accessibility', null, () => Phone.settings('accessibility'), 'Opens Android Accessibility settings')));
    };
    const huaweiView = body => {
      const theirs = Apps.android.filter(a => Apps.isHuawei(a.pkg));
      body.append(h('div', { class: 'card' }, toggleRow('layout-grid', '#ff5c63', 'Hide Huawei apps', S.hideHuawei, v => { Shell.setHideHuawei(v); w.refresh(); }, 'Keeps them out of Rest and the Home Screen')));
      body.append(h('p', { style: { color: 'var(--text3)', fontSize: '13px', lineHeight: 1.5, margin: '0 6px 14px' }, text: 'Hidden apps stay installed and keep working. Huawei Camera and Gallery stay visible because Pets OS doesn\'t replace them yet. Pets OS can\'t remove Huawei\'s system or its start-up logo.' }));
      if (!theirs.length) { body.append(h('div', { class: 'empty-state', text: 'No Huawei apps on this phone.' })); return; }
      body.append(h('div', { class: 'label', text: theirs.length + ' Huawei app' + (theirs.length > 1 ? 's' : '') }));
      const card = h('div', { class: 'card' });
      theirs.forEach(a => {
        const app = Apps.get('android:' + a.pkg);
        const tile = Apps.tile(app); Object.assign(tile.style, { width: '32px', height: '32px', borderRadius: '8px', flex: 'none' });
        const r = h('div', { class: 'row' }, tile, h('div', { class: 'grow', text: a.label }), h('span', { class: 'val', text: 'Open' }));
        press(r, () => Phone.launch(a.pkg));
        card.append(r);
      });
      body.append(card);
    };
    const soundView = body => {
      const s = json(Phone.sound(), {});
      const seg = h('div', { class: 'seg' });
      [['normal', 'Ring'], ['vibrate', 'Vibrate'], ['silent', 'Silent']].forEach(([m, label]) => {
        const b = h('button', { class: s.mode === m ? 'on' : '', text: label });
        b.onclick = () => { if (!Phone.setRingerMode(m) && m === 'silent') Shell.toast('Allow Do Not Disturb access for Pets OS, then try again'); w.refresh(); };
        seg.append(b);
      });
      body.append(seg);
      const card = h('div', { class: 'card' });
      [['ring', 'Ringtone', 'bell'], ['notification', 'Notifications', 'bell-ring'], ['media', 'Music & videos', 'music'], ['alarm', 'Alarms', 'clock']].forEach(([k, label, g]) => {
        const v = s[k]; if (!v) return;
        const range = h('input', { type: 'range', min: 0, max: v.max, value: v.now, style: { width: '100%', accentColor: 'var(--accent)' } });
        range.onchange = () => { Phone.setVolume(k, +range.value); Phone.vibrate(10); };
        card.append(h('div', { class: 'row', style: { display: 'block' } }, h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }, html: icon(g) + '<span>' + label + '</span>' }), range));
      });
      body.append(card, h('div', { class: 'card' }, row('settings', '#5d6680', 'Ringtones and more', null, () => Phone.settings('sound'))));
    };
    const startUp = dev => {
      if (dev.defaultHome) {
        Dialog.menu('Start with the phone is on', 'Pets OS is your home app, so Android opens it every time the phone turns on or restarts. If you set an Android screen lock, you unlock that first and then Pets OS appears.', [
          { label: 'Choose a different home app', fn: () => Phone.settings('home') }
        ]);
        return;
      }
      Phone.setStartOnBoot(true);
      Phone.askToBeHome();
      Shell.toast('Choose Pets OS so it opens when the phone turns on');
    };
    const updateView = body => {
      const dev = json(Phone.device(), {});
      const box = h('div');
      const card = h('div', { class: 'card' }, h('div', { class: 'row', style: { padding: '16px' } },
        h('div', { style: { width: '54px', height: '56px', background: 'url(img/petsos-footprints.png) center/contain no-repeat', filter: S.theme === 'dark' ? 'brightness(0) invert(1)' : 'none', flex: 'none' } }),
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600, fontSize: '18px' }, text: 'Pets OS ' + (dev.version || '') }), h('div', { class: 'sub', text: 'Installed on this phone' }))));
      const show = u => {
        box.innerHTML = '';
        if (u.error) {
          box.append(h('p', { style: { color: 'var(--text2)', textAlign: 'center', lineHeight: 1.5 }, text: 'Couldn\'t check for updates. Check the internet connection and try again.' }));
          const again = h('button', { class: 'btn block secondary', text: 'Try again' }); again.onclick = run; box.append(again);
        } else if (u.versionCode > u.currentCode) {
          const dl = h('button', { class: 'btn block', html: icon('download') + ' Download and install ' + esc(u.version) });
          dl.onclick = () => { Phone.openExternal(u.url) || Shell.toast('Couldn\'t open the download'); };
          box.append(h('div', { class: 'card' }, h('div', { class: 'row', style: { display: 'block', padding: '16px', lineHeight: 1.5 } },
            h('div', { style: { fontWeight: 600, fontSize: '17px' }, text: 'Pets OS ' + u.version + ' is available' }),
            h('div', { class: 'sub', style: { marginTop: '6px', whiteSpace: 'pre-wrap' }, text: u.notes || '' }))), dl,
            h('p', { style: { color: 'var(--text3)', fontSize: '13px', lineHeight: 1.5 }, text: 'The phone\'s browser downloads the update. Open the file and tap Update. Your notes, photos and settings stay.' }));
        } else {
          box.append(h('div', { class: 'empty-state', style: { padding: '30px 20px' }, html: icon('circle-check') + '<br>Pets OS is up to date.' }));
        }
      };
      const run = () => { box.innerHTML = '<div class="empty-state" style="padding:30px 20px">Checking…</div>'; Updates.check().then(show); };
      body.append(card, box);
      run();
    };
    const wallView = body => {
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' } });
      Wallpapers.list.forEach(wp => {
        const t = h('div', { style: { aspectRatio: '9/16', borderRadius: '14px', background: wp.css + ' center/cover', outline: S.wallpaper === wp.id ? '3px solid var(--accent)' : 'none', outlineOffset: '2px', position: 'relative' } }, h('div', { style: { position: 'absolute', bottom: '6px', left: 0, right: 0, textAlign: 'center', color: '#fff', fontSize: '11px', fontWeight: 600, textShadow: '0 1px 3px #000' }, text: wp.name }));
        t.onclick = () => { S.wallpaper = wp.id; Store.save(); Wallpapers.apply(); w.refresh(); };
        grid.append(t);
      });
      body.append(grid, h('p', { style: { color: 'var(--text3)', fontSize: '13px', lineHeight: 1.5 }, text: 'To use one of your photos, open it in Moments and tap Wallpaper.' }));
    };
    const pinView = body => {
      const card = h('div', { class: 'card' });
      const ask = async () => {
        const p = await Dialog.prompt('New passcode', '4 to 6 digits', '', { type: 'password', inputmode: 'numeric', max: 6 });
        if (p == null) return;
        if (!/^\d{4,6}$/.test(p)) { Shell.toast('Use 4 to 6 digits'); return; }
        const p2 = await Dialog.prompt('Type it again', null, '', { type: 'password', inputmode: 'numeric', max: 6 });
        if (p2 !== p) { Shell.toast('The passcodes didn\'t match'); return; }
        Shell.setPin(p); Shell.toast('Passcode set'); w.refresh();
      };
      const check = async () => {
        if (!S.pin) return true;
        const p = await Dialog.prompt('Current passcode', null, '', { type: 'password', inputmode: 'numeric', max: 6 });
        if (p != null && Shell.hashPin(p, S.salt) === S.pin) return true;
        if (p != null) Shell.toast('Wrong passcode');
        return false;
      };
      card.append(row('lock', '#ff5c63', S.pin ? 'Change passcode' : 'Turn passcode on', null, async () => { if (await check()) ask(); }));
      if (S.pin) card.append(row('lock', '#5d6680', 'Turn passcode off', null, async () => { if (await check()) { Shell.setPin(null); Shell.toast('Passcode off'); w.refresh(); } }));
      body.append(card, h('p', { style: { color: 'var(--text3)', fontSize: '13px', lineHeight: 1.5, margin: '0 6px' }, text: 'The passcode guards the Pets OS lock screen. It is stored as a salted SHA-256 hash, and 5 wrong tries pause entry for 30 seconds. Android\'s own screen lock is separate. Keep it on if the phone holds private data, because Pets OS is an app and safe mode can bypass it.' }));
    };
    const aboutView = body => {
      const dev = json(Phone.device(), {});
      body.append(h('div', { style: { textAlign: 'center', padding: '16px 0 20px' } },
        h('div', { style: { width: '72px', height: '75px', margin: '0 auto 12px', background: 'url(img/petsos-footprints.png) center/contain no-repeat', filter: S.theme === 'dark' ? 'brightness(0) invert(1)' : 'none' } }),
        h('div', { style: { fontSize: '24px', fontWeight: 600 }, text: 'Pets OS' }), h('div', { class: 'sub', style: { color: 'var(--text3)' }, text: 'Mobile ' + (dev.version || '1.0.0') })));
      const card = h('div', { class: 'card' });
      [['Phone', (dev.manufacturer || '') + ' ' + (dev.model || '')], ['Runs on', isWeb ? (/iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : 'Web browser') : 'Android ' + (dev.android || '–')], ['Pets OS apps', Object.keys(Apps.builtin).filter(k => k.startsWith('pets:')).length], isWeb ? null : ['Android apps', Apps.android.length], ['Owner', S.name || '–'], ['Screen', 'Portrait only in this version']].filter(Boolean).forEach(([k, v]) => card.append(h('div', { class: 'row' }, h('span', { class: 'grow', text: k }), h('span', { class: 'val', text: String(v) }))));
      body.append(card, h('div', { class: 'label', text: 'Credits' }), h('div', { class: 'card' }, h('div', { class: 'row', style: { display: 'block', fontSize: '13px', color: 'var(--text2)', lineHeight: 1.6 } },
        'Made by Should Be Media. Inter typeface © The Inter Project Authors (SIL Open Font Licence). Icons from Lucide (ISC licence). Weather data by Open-Meteo.com (CC BY 4.0).')));
      const reset = h('button', { class: 'btn block secondary', text: 'Reset Pets OS…', style: { color: 'var(--danger)' } });
      reset.onclick = async () => {
        if (!(await Dialog.confirm('Reset Pets OS?', 'This erases Pets OS settings, notes, events, photos in Moments and the passcode on this phone. Android apps and their data are not touched.', 'Erase Pets OS', true))) return;
        localStorage.clear(); try { indexedDB.deleteDatabase('petsos-moments'); } catch (e) { /* ignore */ }
        location.reload();
      };
      body.append(reset, isWeb ? null : note('To restart or turn off the phone, hold its power button. Pets OS runs as an app on this test phone, and Android doesn\'t let apps restart the phone.'));
    };
    w.root(main);
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

window.Clock = Clock; window.Activities = Activities; window.Calendar = Calendar;
