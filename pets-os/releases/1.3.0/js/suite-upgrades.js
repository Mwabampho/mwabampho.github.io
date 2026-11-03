// StepOS app suite: upgrades to apps that already existed (their data and ids are kept).
//   Shutter: video recording, exposure and tap-to-focus where the camera offers them.
//   Moments: albums, search, videos, and edits saved as copies (originals are never changed).
//   Kinbook: vCard import and export.   Pocket Notes: folders, checklists, export.
//   QuickCalc: scientific mode, history and keyboard input.   Skycast: your location and data times.
'use strict';

// ================================================================ Shutter (camera)
(orig => { CameraApp.start = async function (video, note) { const ok = await orig.call(this, video, note); if (ok && this.onStarted) this.onStarted(); return ok; }; })(CameraApp.start);
(orig => { Apps.builtin['pets:camera'].open = function (w) {
  orig.call(this, w);
  const cam = $('.cam', w.body), shutter = $('.cam-shutter', w.body), video = $('video', w.body);
  if (!cam || !shutter) return;
  let mode = 'photo', rec = null, chunks = [], audio = null, started = 0, tick = 0;
  const modes = h('div', { class: 'st-cammodes', role: 'tablist' });
  const timeEl = h('div', { class: 'st-camtime hidden' });
  const ctl = h('div', { class: 'st-camctl hidden' });
  const ring = h('div', { class: 'st-focus hidden' });
  cam.append(modes, timeEl, ctl, ring);
  const setMode = m => {
    if (rec) return;
    mode = m; cam.classList.toggle('st-video', m === 'video');
    shutter.setAttribute('aria-label', m === 'video' ? 'Start recording' : 'Take photo');
    $$('button', modes).forEach(b => { b.classList.toggle('on', b.dataset.m === m); b.setAttribute('aria-selected', b.dataset.m === m ? 'true' : 'false'); });
  };
  [['photo', 'Photo'], ['video', 'Video']].forEach(([m, l]) => { const b = h('button', { text: l, role: 'tab', 'data-m': m }); b.onclick = () => setMode(m); modes.append(b); });
  setMode('photo');
  const stopRec = () => new Promise(res => { if (!rec) { res(); return; } rec.onstop2 = res; rec.stop(); });
  // Video: same viewfinder plus the microphone (asked for the first time you record).
  cam.addEventListener('click', async e => {
    if (e.target !== shutter && !shutter.contains(e.target)) return;
    if (mode !== 'video') return;
    e.stopPropagation(); e.preventDefault();
    if (rec) { await stopRec(); return; }
    if (!CameraApp.stream) { Shell.toast('The camera isn\'t ready'); return; }
    let tracks = CameraApp.stream.getVideoTracks().slice();
    if (await Need.ask('mic')) { try { audio = await navigator.mediaDevices.getUserMedia({ audio: true }); tracks = tracks.concat(audio.getAudioTracks()); } catch (er) { Shell.toast('Recording without sound: the microphone isn\'t available'); } }
    else Shell.toast('Recording without sound (no microphone permission)');
    if (!window.MediaRecorder) { Dialog.menu('Video isn\'t available', 'This device\'s web engine can\'t record video.', []); return; }
    const type = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    chunks = []; rec = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type, videoBitsPerSecond: 6e6 } : undefined);
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = async () => {
      clearInterval(tick); timeEl.classList.add('hidden'); cam.classList.remove('st-recording'); shutter.setAttribute('aria-label', 'Start recording');
      if (audio) { audio.getTracks().forEach(t => t.stop()); audio = null; }
      const blob = new Blob(chunks, { type: (rec.mimeType || 'video/webm').split(';')[0] }); const done = rec.onstop2; rec = null;
      if (blob.size) { await Moments.put({ id: uid(), blob, w: video.videoWidth, h: video.videoHeight, added: Date.now(), name: 'Video ' + new Date().toLocaleString(), fav: false, video: true, dur: Date.now() - started }); Shell.toast('Video saved to Moments'); const th = $('.cam-thumb', w.body); if (th) th.style.backgroundImage = ''; }
      if (done) done();
    };
    rec.start(1000); started = Date.now(); cam.classList.add('st-recording'); shutter.setAttribute('aria-label', 'Stop recording');
    timeEl.classList.remove('hidden'); timeEl.textContent = '0:00'; tick = setInterval(() => { timeEl.textContent = Fmt.dur(Date.now() - started); }, 500);
  }, true);
  // Exposure and focus: only shown when this camera supports them.
  CameraApp.onStarted = () => {
    ctl.innerHTML = ''; ctl.classList.add('hidden');
    const t = CameraApp.stream && CameraApp.stream.getVideoTracks()[0];
    const caps = t && t.getCapabilities ? t.getCapabilities() : {};
    if (caps.exposureCompensation && caps.exposureCompensation.max > caps.exposureCompensation.min) {
      const ec = caps.exposureCompensation, s = h('input', { type: 'range', min: ec.min, max: ec.max, step: ec.step || 0.1, value: 0, 'aria-label': 'Exposure' });
      s.oninput = () => t.applyConstraints({ advanced: [{ exposureMode: 'continuous', exposureCompensation: +s.value }] }).catch(() => {});
      ctl.append(h('span', { html: icon('sun') }), s); ctl.classList.remove('hidden');
    }
    const canFocus = caps.focusMode && caps.focusMode.length && caps.pointsOfInterest !== undefined;
    video.onclick = canFocus ? e => {
      const r = video.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      ring.style.left = e.clientX - cam.getBoundingClientRect().left + 'px'; ring.style.top = e.clientY - cam.getBoundingClientRect().top + 'px';
      ring.classList.remove('hidden'); clearTimeout(ring.t); ring.t = setTimeout(() => ring.classList.add('hidden'), 900);
      const fm = caps.focusMode.indexOf('single-shot') >= 0 ? 'single-shot' : caps.focusMode[0];
      t.applyConstraints({ advanced: [{ pointsOfInterest: [{ x, y }], focusMode: fm }] }).catch(() => {});
    } : null;
  };
  const prevHide = w.onHide, prevQuit = w.onQuit;
  w.onHide = () => { if (rec) stopRec(); if (prevHide) prevHide(); };
  w.onQuit = () => { if (rec) stopRec(); if (prevQuit) prevQuit(); };
}; })(Apps.builtin['pets:camera'].open);

// ================================================================ Moments (photos and videos)
const Albums = {
  list() { return Store.app('moments.albums', []); },
  save(l) { Store.setApp('moments.albums', l); },
  ensure(n) { const l = this.list(); if (l.indexOf(n) < 0) { l.push(n); this.save(l); } }
};
const PhotoEdit = {
  // Renders a photo with the edits into a canvas (the original blob is never touched).
  async render(blob, e) {
    const u = URL.createObjectURL(blob);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    URL.revokeObjectURL(u);
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    const ratio = { square: 1, '4:3': 4 / 3, '16:9': 16 / 9 }[e.crop];
    if (ratio) { const want = sw / sh > ratio ? [sh * ratio, sh] : [sw, sw / ratio]; sx = (sw - want[0]) / 2; sy = (sh - want[1]) / 2; sw = want[0]; sh = want[1]; }
    const rot = ((e.rot || 0) % 360 + 360) % 360, c = document.createElement('canvas');
    c.width = rot % 180 ? sh : sw; c.height = rot % 180 ? sw : sh;
    const g = c.getContext('2d');
    const f = { none: '', mono: ' grayscale(1)', warm: ' sepia(.25) saturate(1.15)', cool: ' hue-rotate(-12deg) saturate(.9)', vivid: ' saturate(1.35)' }[e.filter || 'none'];
    g.filter = 'brightness(' + (e.bright || 1) + ') contrast(' + (e.contrast || 1) + ')' + f;
    g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180);
    g.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    return c;
  }
};
Apps.builtin['pets:moments'].open = function (w) {
  let tab = 'all', q = '', album = null, urls = [];
  const picker = h('input', { type: 'file', accept: 'image/*,video/*', multiple: true, style: { display: 'none' } });
  w.el.append(picker);
  picker.onchange = async () => {
    const files = Array.from(picker.files || []); if (!files.length) return;
    Shell.toast('Adding ' + files.length + ' item' + (files.length > 1 ? 's' : '') + '…');
    for (const f of files) {
      if (/^video\//.test(f.type)) await Moments.put({ id: uid(), blob: f, w: 0, h: 0, added: Date.now(), name: f.name, fav: false, video: true, albums: album ? [album] : [] });
      else { const s = await Moments.shrink(f, 2048); if (s) await Moments.put({ id: uid(), blob: s.blob, w: s.w, h: s.h, added: Date.now(), name: f.name, fav: false, albums: album ? [album] : [] }); }
    }
    picker.value = ''; w.refresh();
  };
  const isVid = p => !!(p.video || (p.blob && /^video\//.test(p.blob.type)));
  const free = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; };
  const grid = (box, list) => {
    const g = h('div', { class: 'st-grid' });
    list.forEach((p, i) => {
      const u = URL.createObjectURL(p.blob); urls.push(u);
      const cell = h('button', { class: 'st-cell', 'aria-label': (isVid(p) ? 'Video ' : 'Photo ') + (p.name || '') });
      if (isVid(p)) { const v = h('video', { src: u + '#t=0.5', muted: true, preload: 'metadata', playsinline: true }); cell.append(v, h('span', { class: 'st-cell-badge', html: icon('play') + (p.dur ? Fmt.dur(p.dur) : '') })); }
      else cell.style.backgroundImage = 'url(' + u + ')';
      if (p.fav) cell.append(h('span', { class: 'st-cell-fav', html: icon('heart') }));
      cell.onclick = () => viewer(list, i);
      g.append(cell);
    });
    box.append(g, h('div', { class: 'st-count', text: list.length + (list.length === 1 ? ' item' : ' items') }));
  };
  const match = p => { if (!q) return true; const s = q.toLowerCase(); const d = new Date(p.added); return (p.name || '').toLowerCase().includes(s) || d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).toLowerCase().includes(s) || (p.albums || []).some(a => a.toLowerCase().includes(s)) || (s === 'video' && isVid(p)); };
  const root = body => {
    free();
    w.setTitle(album || 'Moments');
    w.backEl.classList.toggle('hidden', !album);
    if (album) { w.backEl.innerHTML = icon('chevron-left') + 'Albums'; w.onBack = () => { album = null; w.refresh(); return true; }; } else w.onBack = null;
    w.actions([{ icon: 'plus', label: 'Add photos or videos', fn: () => picker.click() }]);
    if (!album) body.append(Ui.seg([['all', 'All'], ['fav', 'Favourites'], ['albums', 'Albums'], ['videos', 'Videos']], tab, v => { tab = v; w.refresh(); }));
    const f = h('input', { type: 'search', placeholder: 'Search by name, date or album', value: q, autocomplete: 'off', 'aria-label': 'Search Moments' });
    const box = h('div');
    if (tab !== 'albums' || album) body.append(h('div', { class: 'search set-search', html: icon('search') }, f));
    body.append(box);
    const draw = () => Moments.all().then(all => {
      box.innerHTML = ''; free();
      if (tab === 'albums' && !album) {
        const names = Albums.list(); (all.some(p => (p.albums || []).indexOf('Scans') >= 0) && names.indexOf('Scans') < 0) && names.push('Scans');
        const g = h('div', { class: 'st-albums' });
        names.forEach(n => {
          const items = all.filter(p => (p.albums || []).indexOf(n) >= 0), cover = items.find(p => !isVid(p));
          const u = cover ? URL.createObjectURL(cover.blob) : null; if (u) urls.push(u);
          const a = h('button', { class: 'st-album', 'aria-label': n + ', ' + items.length + ' items' }, h('div', { class: 'st-album-c', style: u ? { backgroundImage: 'url(' + u + ')' } : null, html: u ? '' : icon('image') }), h('b', { text: n }), h('span', { text: String(items.length) }));
          press(a, () => { album = n; w.refresh(); }, () => Dialog.menu(n, null, [{ label: 'Rename album', fn: async () => { const v = await Dialog.prompt('Rename album', null, n); if (!v || !v.trim()) return; Albums.save(Albums.list().map(x => x === n ? v.trim() : x)); for (const p of items) { p.albums = p.albums.map(x => x === n ? v.trim() : x); await Moments.put(p); } w.refresh(); } }, { label: 'Delete album', danger: true, fn: async () => { if (!(await Dialog.confirm('Delete the album "' + n + '"?', 'The photos stay in Moments.', 'Delete Album', true))) return; Albums.save(Albums.list().filter(x => x !== n)); for (const p of items) { p.albums = p.albums.filter(x => x !== n); await Moments.put(p); } w.refresh(); } }]));
          g.append(a);
        });
        const add = h('button', { class: 'st-album st-album-new', 'aria-label': 'New album' }, h('div', { class: 'st-album-c', html: icon('plus') }), h('b', { text: 'New album' }));
        add.onclick = async () => { const v = await Dialog.prompt('New album', null, ''); if (v && v.trim()) { Albums.ensure(v.trim()); w.refresh(); } };
        g.append(add); box.append(g);
        return;
      }
      let list = all;
      if (album) list = list.filter(p => (p.albums || []).indexOf(album) >= 0);
      else if (tab === 'fav') list = list.filter(p => p.fav);
      else if (tab === 'videos') list = list.filter(isVid);
      list = list.filter(match);
      if (!list.length) { box.append(Ui.empty('image', q ? 'Nothing matches "' + q + '"' : album ? 'This album is empty' : tab === 'fav' ? 'No favourites yet' : tab === 'videos' ? 'No videos yet' : 'No photos in Moments yet', q ? null : 'Tap + to add from this phone, or take some with Shutter.')); return; }
      grid(box, list);
    });
    f.addEventListener('input', () => { q = f.value; draw(); });
    draw();
  };
  const editor = (p, done) => {
    const e = { rot: 0, crop: 'original', bright: 1, contrast: 1, filter: 'none' };
    const ov = h('div', { class: 'st-viewer st-editor', role: 'dialog', 'aria-label': 'Edit photo' });
    const cv = h('div', { class: 'st-editcv' });
    const redraw = async () => { const c = await PhotoEdit.render(p.blob, e); c.className = 'st-editcanvas'; cv.innerHTML = ''; cv.append(c); };
    const top = h('div', { class: 'st-vtop' });
    const cancel = h('button', { class: 'st-vbtn', text: 'Cancel' }); cancel.onclick = () => { ov.remove(); done(false); };
    const save = h('button', { class: 'st-vbtn st-vsave', text: 'Save copy' });
    save.onclick = async () => {
      save.disabled = true;
      const c = await PhotoEdit.render(p.blob, e), blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
      await Moments.put({ id: uid(), blob, w: c.width, h: c.height, added: Date.now(), name: (p.name || 'Photo') + ' (edited)', fav: false, albums: (p.albums || []).slice(), editedFrom: p.id });
      Shell.toast('Saved as a new photo. The original is unchanged.'); ov.remove(); done(true);
    };
    top.append(cancel, h('b', { text: 'Edit' }), save);
    const tools = h('div', { class: 'st-edittools' });
    const chips = (label, opts, key) => { const row = h('div', { class: 'st-chips', role: 'radiogroup', 'aria-label': label }); opts.forEach(([v, t]) => { const b = h('button', { class: e[key] === v ? 'on' : '', text: t, role: 'radio', 'aria-checked': e[key] === v ? 'true' : 'false' }); b.onclick = () => { e[key] = v; $$('button', row).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b ? 'true' : 'false'); }); redraw(); }; row.append(b); }); return row; };
    const slider = (label, key) => { const s = h('input', { type: 'range', min: 0.5, max: 1.5, step: 0.02, value: 1, 'aria-label': label }); s.onchange = () => { e[key] = +s.value; redraw(); }; return h('label', { class: 'st-slider' }, h('span', { text: label }), s); };
    const rot = h('button', { class: 'st-vbtn', html: icon('rotate-cw') + ' Rotate' }); rot.onclick = () => { e.rot += 90; redraw(); };
    tools.append(h('div', { class: 'st-chips' }, rot), chips('Crop', [['original', 'Original'], ['square', 'Square'], ['4:3', '4:3'], ['16:9', '16:9']], 'crop'),
      slider('Brightness', 'bright'), slider('Contrast', 'contrast'), chips('Filter', [['none', 'None'], ['vivid', 'Vivid'], ['warm', 'Warm'], ['cool', 'Cool'], ['mono', 'Mono']], 'filter'));
    ov.append(top, cv, tools);
    w.el.append(ov); redraw();
    const prevBack = w.onBack; w.onBack = () => { ov.remove(); w.onBack = prevBack; done(false); return true; };
  };
  const viewer = (list, i) => {
    const ov = h('div', { class: 'st-viewer', role: 'dialog', 'aria-label': 'Photo viewer' });
    const stage = h('div', { class: 'st-vstage' });
    const top = h('div', { class: 'st-vtop' }), bar = h('div', { class: 'st-vbar' });
    let cur = null;
    const done = () => { if (cur) URL.revokeObjectURL(cur); $$('video', stage).forEach(v => v.pause()); ov.remove(); w.onBack = album ? () => { album = null; w.refresh(); return true; } : null; w.refresh(); };
    const show = () => {
      const p = list[i];
      if (cur) URL.revokeObjectURL(cur);
      cur = URL.createObjectURL(p.blob); stage.innerHTML = '';
      stage.append(isVid(p) ? h('video', { src: cur, controls: true, playsinline: true, class: 'st-vmedia' }) : h('img', { src: cur, alt: p.name || 'Photo', class: 'st-vmedia' }));
      top.innerHTML = '';
      const close = h('button', { class: 'st-vbtn', html: icon('chevron-left'), 'aria-label': 'Close' }); close.onclick = done;
      top.append(close, h('div', { class: 'st-vtitle' }, h('b', { text: new Date(p.added).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) }), h('span', { text: Fmt.time(new Date(p.added)) + (p.editedFrom ? ' · edited copy' : '') })), h('span', { class: 'st-vpos', text: (i + 1) + ' / ' + list.length }));
      bar.innerHTML = '';
      const btn = (g, label, fn) => { const b = h('button', { class: 'st-vact', html: icon(g) + '<span>' + label + '</span>', 'aria-label': label }); b.onclick = fn; bar.append(b); };
      btn('heart', p.fav ? 'Unfavourite' : 'Favourite', async () => { p.fav = !p.fav; await Moments.put(p); show(); });
      if (!isVid(p)) btn('sliders-horizontal', 'Edit', () => editor(p, saved => { if (saved) done(); }));
      btn('tag', 'Album', () => {
        const names = Albums.list();
        Dialog.menu('Albums', 'Tap an album to add or remove this ' + (isVid(p) ? 'video' : 'photo') + '.', names.map(n => ({ label: ((p.albums || []).indexOf(n) >= 0 ? '✓ ' : '') + n, fn: async () => { p.albums = p.albums || []; const k = p.albums.indexOf(n); if (k >= 0) p.albums.splice(k, 1); else p.albums.push(n); await Moments.put(p); Shell.toast(k >= 0 ? 'Removed from ' + n : 'Added to ' + n); } })).concat([{ label: 'New album…', fn: async () => { const v = await Dialog.prompt('New album', null, ''); if (v && v.trim()) { Albums.ensure(v.trim()); p.albums = (p.albums || []).concat([v.trim()]); await Moments.put(p); Shell.toast('Added to ' + v.trim()); } } }]));
      });
      if (!isVid(p)) btn('image', 'Wallpaper', async () => { const s = await Moments.shrink(p.blob, 1600, 0.82); const r = new FileReader(); r.onload = () => { Store.setApp('wallpaper.custom', r.result); S.wallpaper = 'custom'; Store.save(); Wallpapers.apply(); Shell.toast('Wallpaper set'); }; r.readAsDataURL(s.blob); });
      btn('download', 'Save', () => Ui.saveFile(p.blob, (p.name || 'Moment').replace(/[^\w\- ().]+/g, '').slice(0, 60) + (/\.\w{3,4}$/.test(p.name || '') ? '' : isVid(p) ? '.webm' : '.jpg')));
      btn('trash-2', 'Delete', async () => {
        if (!(await Dialog.confirm('Delete this ' + (isVid(p) ? 'video' : 'photo') + '?', 'It is removed from Moments. Originals elsewhere on your phone are not touched.', 'Delete', true))) return;
        await Moments.del(p.id); list.splice(i, 1);
        if (!list.length) done(); else { i = Math.min(i, list.length - 1); show(); }
      });
    };
    swipe(stage, dir => { if (dir === 'left' && i < list.length - 1) { i++; show(); } else if (dir === 'right' && i > 0) { i--; show(); } else if (dir === 'down') done(); });
    ov.append(top, stage, bar); w.el.append(ov);
    w.onBack = () => { done(); return true; };
    show();
  };
  w.root(root);
  w.onShow = () => { if (!w.stack.length && !$('.st-viewer', w.el)) w.refresh(); };
};

// ================================================================ Kinbook (contacts): vCard import and export
const VCard = {
  esc: s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1'),
  out(list) { return list.map(c => ['BEGIN:VCARD', 'VERSION:3.0', 'FN:' + this.esc(c.name), 'N:' + this.esc(c.name) + ';;;;'].concat((c.numbers || []).map(n => 'TEL;TYPE=CELL:' + n), c.email ? ['EMAIL:' + this.esc(c.email)] : [], c.notes ? ['NOTE:' + this.esc(c.notes)] : [], ['END:VCARD']).join('\r\n')).join('\r\n') + '\r\n'; },
  parse(text) {
    const un = s => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    const out = []; let c = null;
    lines.forEach(l => {
      const i = l.indexOf(':'); if (i < 0) return;
      const key = l.slice(0, i).toUpperCase(), val = l.slice(i + 1), base = key.split(';')[0];
      if (base === 'BEGIN') c = { id: uid(), name: '', numbers: [], email: '', notes: '', fav: false };
      else if (!c) return;
      else if (base === 'FN') c.name = un(val).trim();
      else if (base === 'N' && !c.name) c.name = un(val).split(';').reverse().filter(Boolean).join(' ').trim();
      else if (base === 'TEL') c.numbers.push(val.replace(/^tel:/i, '').trim());
      else if (base === 'EMAIL' && !c.email) c.email = un(val).trim();
      else if (base === 'NOTE') c.notes = un(val);
      else if (base === 'END') { if (c.name || c.numbers.length) out.push(c); c = null; }
    });
    return out;
  }
};
(orig => { Apps.builtin['pets:contacts'].open = function (w) {
  orig.call(this, w);
  const picker = h('input', { type: 'file', accept: '.vcf,text/vcard,text/x-vcard', style: { display: 'none' } });
  w.el.append(picker);
  picker.onchange = async () => {
    const f = picker.files && picker.files[0]; picker.value = ''; if (!f) return;
    const found = VCard.parse(await f.text());
    if (!found.length) { Dialog.menu('No contacts found', 'That file has no vCard contacts in it.', []); return; }
    const own = Contacts.own(), have = new Set(own.map(c => (c.name || '').toLowerCase() + '|' + (c.numbers[0] || '')));
    const fresh = found.filter(c => !have.has((c.name || '').toLowerCase() + '|' + (c.numbers[0] || '')));
    if (!(await Dialog.confirm('Import ' + fresh.length + ' contact' + (fresh.length === 1 ? '' : 's') + '?', found.length - fresh.length ? (found.length - fresh.length) + ' are already in Kinbook and are skipped.' : 'They are saved in Kinbook on this phone.', 'Import'))) return;
    Contacts.save(own.concat(fresh)); Shell.toast(fresh.length + ' imported'); w.refresh();
  };
  w.actions([
    { icon: 'upload', label: 'Import contacts (vCard)', fn: () => picker.click() },
    { icon: 'share', label: 'Export contacts (vCard)', fn: async () => { const l = Contacts.all(); if (!l.length) { Shell.toast('No contacts to export'); return; } if (await Dialog.confirm('Export ' + l.length + ' contacts?', 'A contacts.vcf file is saved. Anyone with the file can read these contacts.', 'Export')) Ui.saveFile(new Blob([VCard.out(l)], { type: 'text/vcard' }), 'contacts.vcf'); } },
    { icon: 'plus', label: 'New contact', fn: () => Contacts.edit(w, null, () => w.refresh()) }
  ]);
}; })(Apps.builtin['pets:contacts'].open);

// ================================================================ Pocket Notes (was Pen): folders, checklists, export
const NoteBox = {
  folders() { return Store.app('pen.folders', []); },
  setFolders(l) { Store.setApp('pen.folders', l); },
  isTask: l => /^[☐☑] /.test(l),
  toggle(text, idx) { const ls = text.split('\n'); const l = ls[idx]; if (l && /^☐ /.test(l)) ls[idx] = '☑ ' + l.slice(2); else if (l && /^☑ /.test(l)) ls[idx] = '☐ ' + l.slice(2); return ls.join('\n'); },
  fileName: n => (Pen.title(n).replace(/[^\w\- ]+/g, '').trim() || 'Note') + '.txt'
};
Apps.builtin['pets:pen'].open = function (w) {
  let q = '', folder = '';
  const list = body => {
    const d = Pen.load();
    w.actions([{ icon: 'trash-2', label: 'Recently deleted', fn: () => w.push('Recently Deleted', deletedView) }, { icon: 'download', label: 'Export all notes', fn: exportAll }, { icon: 'pencil', label: 'New note', fn: () => { const n = Pen.add(''); if (folder) { const dd = Pen.load(); dd.notes.find(x => x.id === n.id).folder = folder; Pen.save(dd); n.folder = folder; } edit(n); } }]);
    const f = h('input', { type: 'search', placeholder: 'Search notes', value: q, autocomplete: 'off', 'aria-label': 'Search notes' });
    const chips = h('div', { class: 'st-chips st-folders', role: 'tablist' });
    const fl = NoteBox.folders();
    [['', 'All notes']].concat(fl.map(x => [x, x])).forEach(([v, t]) => { const b = h('button', { class: folder === v ? 'on' : '', text: t, role: 'tab' }); press(b, () => { folder = v; w.refresh(); }, v ? () => Dialog.menu(v, null, [{ label: 'Rename folder', fn: async () => { const n = await Dialog.prompt('Rename folder', null, v); if (!n || !n.trim()) return; NoteBox.setFolders(NoteBox.folders().map(x => x === v ? n.trim() : x)); const dd = Pen.load(); dd.notes.forEach(x => { if (x.folder === v) x.folder = n.trim(); }); Pen.save(dd); folder = n.trim(); w.refresh(); } }, { label: 'Delete folder', danger: true, fn: async () => { if (!(await Dialog.confirm('Delete the folder "' + v + '"?', 'Its notes move to All notes.', 'Delete', true))) return; NoteBox.setFolders(NoteBox.folders().filter(x => x !== v)); const dd = Pen.load(); dd.notes.forEach(x => { if (x.folder === v) x.folder = ''; }); Pen.save(dd); folder = ''; w.refresh(); } }]) : null); chips.append(b); });
    const nf = h('button', { html: icon('folder-plus'), 'aria-label': 'New folder' }); nf.onclick = async () => { const n = await Dialog.prompt('New folder', null, ''); if (n && n.trim() && fl.indexOf(n.trim()) < 0) { NoteBox.setFolders(fl.concat([n.trim()])); folder = n.trim(); w.refresh(); } };
    chips.append(nf);
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      const notes = d.notes.filter(n => (!folder || n.folder === folder) && (!q || n.text.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
      if (!notes.length) { box.append(Ui.empty('notebook-pen', q ? 'No notes match.' : 'No notes here yet.', q ? null : 'Tap the pencil to write one.')); return; }
      [['Pinned', notes.filter(n => n.pinned)], ['Notes', notes.filter(n => !n.pinned)]].forEach(([label, items]) => {
        if (!items.length) return;
        box.append(Ui.label(label));
        const card = h('div', { class: 'card' });
        items.forEach(n => {
          const tasks = n.text.split('\n').filter(NoteBox.isTask), doneN = tasks.filter(l => l[0] === '☑').length;
          const row = h('div', { class: 'row', role: 'button', tabindex: '0' }, h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, text: Pen.title(n) }),
            h('div', { class: 'sub', text: new Date(n.updated).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + (n.folder && !folder ? ' · ' + n.folder : '') + (tasks.length ? ' · ' + doneN + '/' + tasks.length + ' done' : '') + '  ' + Pen.preview(n) })));
          press(row, () => edit(n), () => Dialog.menu(Pen.title(n), null, [
            { label: n.pinned ? 'Unpin' : 'Pin', fn: () => { n.pinned = !n.pinned; Pen.save(d); draw(); } },
            { label: 'Move to folder', fn: () => Dialog.menu('Move to', null, [{ label: 'All notes (no folder)', fn: () => { n.folder = ''; Pen.save(d); draw(); } }].concat(NoteBox.folders().map(x => ({ label: x, fn: () => { n.folder = x; Pen.save(d); draw(); } })))) },
            { label: 'Export as text', fn: () => Ui.saveFile(new Blob([n.text], { type: 'text/plain' }), NoteBox.fileName(n)) },
            { label: 'Copy', fn: () => { try { navigator.clipboard.writeText(n.text); Shell.toast('Copied'); } catch (e) { Shell.toast('Copy isn\'t available'); } } },
            { label: 'Delete', danger: true, fn: () => { d.notes = d.notes.filter(x => x !== n); d.deleted.unshift(Object.assign(n, { deletedAt: Date.now() })); d.deleted = d.deleted.slice(0, 100); Pen.save(d); draw(); Shell.toast('Moved to Recently Deleted'); } }
          ]));
          card.append(row);
        });
        box.append(card);
      });
    };
    f.oninput = () => { q = f.value; draw(); };
    body.append(h('div', { class: 'search set-search', html: icon('search') }, f), chips, box);
    draw();
  };
  const exportAll = async () => {
    const d = Pen.load(); if (!d.notes.length) { Shell.toast('No notes to export'); return; }
    if (!(await Dialog.confirm('Export ' + d.notes.length + ' notes?', 'One text file with every note, newest first.', 'Export'))) return;
    const text = d.notes.slice().sort((a, b) => b.updated - a.updated).map(n => '# ' + Pen.title(n) + (n.folder ? '  [' + n.folder + ']' : '') + '\n' + new Date(n.updated).toLocaleString() + '\n\n' + n.text).join('\n\n----------\n\n');
    Ui.saveFile(new Blob([text], { type: 'text/plain' }), 'Pocket Notes ' + new Date().toISOString().slice(0, 10) + '.txt');
  };
  const edit = n => {
    w.push(Pen.title(n), body => {
      const d = Pen.load();
      const note = d.notes.find(x => x.id === n.id) || n;
      const ta = h('textarea', { class: 'field st-note', placeholder: 'Start writing. The first line is the title.', 'aria-label': 'Note' });
      ta.value = note.text;
      const checks = h('div', { class: 'card st-checks' });
      const status = h('div', { class: 'st-saved', text: 'Saved', 'aria-live': 'polite' });
      let t = null;
      const persist = () => { const dd = Pen.load(); const x = dd.notes.find(y => y.id === note.id); if (x) { x.text = ta.value; x.updated = Date.now(); Pen.save(dd); w.setTitle(Pen.title(x)); status.textContent = 'Saved'; } };
      const drawChecks = () => {
        checks.innerHTML = '';
        const ls = ta.value.split('\n');
        const idx = ls.map((l, i) => NoteBox.isTask(l) ? i : -1).filter(i => i >= 0);
        checks.classList.toggle('hidden', !idx.length);
        idx.forEach(i => {
          const on = ls[i][0] === '☑';
          const b = h('button', { class: 'st-check' + (on ? ' on' : ''), role: 'checkbox', 'aria-checked': on ? 'true' : 'false', 'aria-label': ls[i].slice(2), html: on ? icon('check') : '' });
          const r = h('div', { class: 'row' }, b, h('div', { class: 'grow' + (on ? ' st-done' : ''), text: ls[i].slice(2) }));
          press(r, () => { ta.value = NoteBox.toggle(ta.value, i); persist(); drawChecks(); });
          checks.append(r);
        });
      };
      ta.oninput = () => { status.textContent = 'Saving…'; clearTimeout(t); t = setTimeout(() => { persist(); drawChecks(); }, 300); };
      const addTask = h('button', { class: 'st-chipbtn', html: icon('square-check') + ' Checklist item' });
      addTask.onclick = () => {
        const s = ta.selectionStart, v = ta.value, ls = v.slice(0, s).lastIndexOf('\n') + 1;
        if (NoteBox.isTask(v.slice(ls))) ta.value = v.slice(0, ls) + v.slice(ls + 2);
        else ta.value = v.slice(0, ls) + '☐ ' + v.slice(ls);
        ta.focus(); ta.oninput();
      };
      w.actions([{ label: 'Done', fn: () => { ta.blur(); w.back(); } }]);
      body.append(h('div', { class: 'st-notebar' }, addTask, status), checks, ta);
      drawChecks();
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
    if (!d.deleted.length) { body.append(Ui.empty('trash-2', 'Nothing deleted.')); return; }
    body.append(Ui.note('Deleted notes stay here until you remove them for ever.'));
    const card = h('div', { class: 'card' });
    d.deleted.forEach(n => {
      const row = Ui.row(Pen.title(n), 'Deleted ' + Fmt.ago(n.deletedAt), () => Dialog.menu(Pen.title(n), null, [
        { label: 'Recover', fn: () => { d.deleted = d.deleted.filter(x => x !== n); delete n.deletedAt; d.notes.unshift(n); Pen.save(d); w.refresh(); } },
        { label: 'Delete for ever', danger: true, fn: async () => { if (await Dialog.confirm('Delete for ever?', 'This can\'t be undone.', 'Delete', true)) { d.deleted = d.deleted.filter(x => x !== n); Pen.save(d); w.refresh(); } } }
      ]));
      card.append(row);
    });
    body.append(card);
  };
  w.openNote = id => { const n = Pen.load().notes.find(x => x.id === id); if (n) { w.root(list); edit(n); } };
  w.root(list);
  w.onShow = () => { if (!w.stack.length) w.refresh(); };
};

// ================================================================ QuickCalc (was Calculator)
// Scientific expressions: sin cos tan asin acos atan ln log sqrt, π e, n!, and Calc's + − × ÷ ^ % ( ).
Calc.sci = function (src, deg) {
  const s = String(src).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, 'pi').replace(/√/g, 'sqrt').replace(/,/g, '').replace(/\s+/g, '').toLowerCase();
  let i = 0;
  const k = deg ? Math.PI / 180 : 1;
  const F = { sin: x => Math.sin(x * k), cos: x => Math.cos(x * k), tan: x => Math.tan(x * k), asin: x => Math.asin(x) / k, acos: x => Math.acos(x) / k, atan: x => Math.atan(x) / k, ln: Math.log, log: Math.log10, sqrt: Math.sqrt };
  const fact = n => { if (n < 0 || n !== Math.floor(n) || n > 170) throw new Error('factorial'); let r = 1; for (let j = 2; j <= n; j++) r *= j; return r; };
  const num = () => {
    for (const name of ['asin', 'acos', 'atan', 'sqrt', 'sin', 'cos', 'tan', 'ln', 'log']) if (s.startsWith(name, i)) { i += name.length; return F[name](unary()); }
    if (s.startsWith('pi', i)) { i += 2; return Math.PI; }
    if (s[i] === 'e' && !/[a-z]/.test(s[i + 1] || '')) { i++; return Math.E; }
    if (s[i] === '(') { i++; const v = expr(); if (s[i] !== ')') throw new Error('bracket'); i++; return v; }
    const m = /^\d*\.?\d+(e[+-]?\d+)?/.exec(s.slice(i)); if (!m) throw new Error('number');
    i += m[0].length; return parseFloat(m[0]);
  };
  const post = () => { let v = num(); for (;;) { if (s[i] === '!') { i++; v = fact(v); } else if (s[i] === '%') { i++; v /= 100; } else break; } return v; };
  const power = () => { const b = post(); if (s[i] === '^') { i++; return Math.pow(b, unary()); } return b; };
  const unary = () => { if (s[i] === '-') { i++; return -unary(); } if (s[i] === '+') { i++; return unary(); } return power(); };
  const term = () => { let v = unary(); while (s[i] === '*' || s[i] === '/' || s[i] === '(' || /[a-z]/.test(s[i] || '')) { const op = s[i] === '*' || s[i] === '/' ? s[i++] : '*'; const r = unary(); v = op === '*' ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; } return v; };
  const v = expr(); if (i !== s.length) throw new Error('syntax');
  return v;
};
Apps.builtin['pets:calculator'].open = function (w) {
  w.el.classList.add('st-calcwin');
  let expr = '', justDone = false, sci = !!Store.app('calc.sci', false), deg = Store.app('calc.deg', true) !== false;
  const hist = () => Store.app('calc.history', []);
  const historyView = () => w.push('History', body => {
    const l = hist();
    if (!l.length) { body.append(Ui.empty('clock', 'No calculations yet')); return; }
    const c = h('div', { class: 'card' });
    l.forEach(x => c.append(Ui.row(x.r, x.e + ' · ' + Fmt.ago(x.at), () => { expr = String(x.raw != null ? x.raw : x.r); justDone = true; w.back(); })));
    body.append(c, Ui.btn('Clear history', async () => { if (await Dialog.confirm('Clear the calculation history?', null, 'Clear', true)) { Store.setApp('calc.history', []); w.refresh(); } }, 'secondary'));
  });
  w.root(body => {
    body.classList.add('st-calc');
    w.actions([{ icon: 'clock', label: 'History', fn: historyView }, { label: sci ? 'Basic' : 'Scientific', fn: () => { sci = !sci; Store.setApp('calc.sci', sci); w.refresh(); } }]);
    const sub = h('div', { class: 'st-calc-sub', 'aria-live': 'polite' }), disp = h('div', { class: 'st-calc-disp', 'aria-live': 'polite' });
    const show = () => {
      disp.textContent = expr || '0';
      disp.style.fontSize = expr.length > 14 ? '34px' : expr.length > 9 ? '46px' : '';
      let prev = '';
      if (expr && !justDone) { try { const v = Calc.sci(expr, deg); prev = '= ' + Calc.show(v); } catch (e) { prev = ''; } }
      sub.textContent = prev || (sci ? (deg ? 'Degrees' : 'Radians') : '');
    };
    const press1 = k => {
      Phone.vibrate(6);
      if (k === 'C') { expr = ''; justDone = false; }
      else if (k === '⌫') { expr = expr.slice(0, -1); justDone = false; }
      else if (k === '=') {
        if (!expr) return;
        try { const v = Calc.sci(expr, deg), r = Calc.show(v); const l = hist(); l.unshift({ e: expr, r, raw: v, at: Date.now() }); Store.setApp('calc.history', l.slice(0, 100)); sub.textContent = expr + ' ='; expr = isFinite(v) ? String(Math.round(v * 1e10) / 1e10) : ''; justDone = true; disp.textContent = r; return; }
        catch (e) { sub.textContent = 'Can\'t work that out'; return; }
      }
      else if (k === '±') { expr = expr ? (expr.startsWith('-(') && expr.endsWith(')') ? expr.slice(2, -1) : '-(' + expr + ')') : '-'; }
      else if (k === 'deg') { deg = !deg; Store.setApp('calc.deg', deg); w.refresh(); return; }
      else {
        const fn = ['sin', 'cos', 'tan', 'ln', 'log', '√'].indexOf(k) >= 0;
        const val = fn ? k + '(' : k === 'x²' ? '^2' : k === 'xʸ' ? '^' : k === 'n!' ? '!' : k;
        if (justDone && /^[\d.(πe√slct]/.test(val)) expr = '';
        expr += val; justDone = false;
      }
      show();
    };
    const pad = h('div', { class: 'st-calc-pad' + (sci ? ' sci' : '') });
    const keys = (sci ? [['deg', deg ? 'Deg' : 'Rad', 'fn'], ['sin', 'sin', 'fn'], ['cos', 'cos', 'fn'], ['tan', 'tan', 'fn'], ['ln', 'ln', 'fn'], ['log', 'log', 'fn'], ['√', '√', 'fn'], ['x²', 'x²', 'fn'], ['xʸ', 'xʸ', 'fn'], ['π', 'π', 'fn'], ['e', 'e', 'fn'], ['n!', 'n!', 'fn']] : [])
      .concat([['C', 'C', 'fn'], ['(', '(', 'fn'], [')', ')', 'fn'], ['÷', '÷', 'op'], ['7'], ['8'], ['9'], ['×', '×', 'op'], ['4'], ['5'], ['6'], ['−', '−', 'op'], ['1'], ['2'], ['3'], ['+', '+', 'op'], ['±', '±'], ['0'], ['.'], ['=', '=', 'eq']]);
    keys.forEach(([k, label, cls]) => { const b = h('button', { class: 'st-key ' + (cls || 'num'), text: label || k, 'aria-label': { '÷': 'divide', '×': 'times', '−': 'minus', '+': 'plus', '=': 'equals', C: 'clear', '±': 'plus or minus', '√': 'square root', 'x²': 'squared', 'xʸ': 'to the power', 'n!': 'factorial', deg: deg ? 'degrees, switch to radians' : 'radians, switch to degrees' }[k] || label || k }); b.onclick = () => press1(k === '−' ? '-' : k === '%' ? '%' : k); pad.append(b); });
    const back = h('button', { class: 'st-calc-back', html: icon('arrow-left'), 'aria-label': 'Delete' }); back.onclick = () => press1('⌫');
    body.append(h('div', { class: 'st-calc-screen' }, sub, h('div', { class: 'st-calc-row' }, back, disp)), pad);
    show();
    w.calcKey = press1;
  });
  // Keyboard: digits, + - * / ^ ( ) . %, Enter for =, Backspace and Escape.
  const onKey = e => {
    if (Shell.front() !== w || !w.calcKey || /input|textarea/i.test((document.activeElement || {}).tagName || '')) return;
    const k = e.key, map = { '*': '×', '/': '÷', Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', '-': '-' };
    if (/^[\d.()+^%!]$/.test(k)) { w.calcKey(k); e.preventDefault(); } else if (map[k]) { w.calcKey(map[k]); e.preventDefault(); }
  };
  document.addEventListener('keydown', onKey);
  w.onQuit = () => document.removeEventListener('keydown', onKey);
};

// ================================================================ Skycast (weather): your location and data times
(orig => { Weather.forecast = async function (p) {
  const j = await orig.call(this, p);
  Weather.lastData = { place: p.name, obs: j.current && j.current.time, tz: j.timezone_abbreviation || j.timezone || '', at: Date.now() };
  setTimeout(() => Weather.stamp(), 0);
  return j;
}; })(Weather.forecast);
Weather.stamp = function () {
  const w = Shell.windows.find(x => x.id === 'pets:weather'); if (!w || w.stack.length) return;
  let el = $('.st-wxstamp', w.body);
  if (!el) {
    el = h('div', { class: 'st-wxstamp' });
    const loc = h('button', { class: 'st-chipbtn st-wxloc', html: icon('locate') + ' Use my location' });
    loc.onclick = async () => {
      loc.disabled = true; loc.innerHTML = icon('locate') + ' Finding you…';
      try {
        const p = await Locate.here();
        const pl = Weather.places().filter(x => !x.mine);
        let name = 'My location';
        try { const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=' + p.lat + '&lon=' + p.lon); const j = await r.json(); const a = j.address || {}; name = a.city || a.town || a.village || a.county || name; } catch (e) { /* keep the plain name */ }
        Store.setApp('weather.places', [{ name, region: 'Your location', lat: +p.lat.toFixed(3), lon: +p.lon.toFixed(3), mine: true }].concat(pl));
        Shell.toast('Skycast now shows ' + name);
        Shell.quit(w); Shell.open('pets:weather');
      } catch (e) { Dialog.menu('Location unavailable', e.message, []); loc.disabled = false; loc.innerHTML = icon('locate') + ' Use my location'; }
    };
    el.loc = loc;
  }
  w.body.append(el, el.loc);
  const d = Weather.lastData;
  el.textContent = d ? 'Data from Open-Meteo for ' + d.place + (d.obs ? ', measured ' + d.obs.slice(11, 16) + ' ' + d.tz : '') + ' · fetched ' + Fmt.time(new Date(d.at)) + '. Needs the internet.' : 'Forecasts come from Open-Meteo over the internet.';
};
(orig => { Apps.builtin['pets:weather'].open = function (w) { orig.call(this, w); setTimeout(() => Weather.stamp(), 50); const r = w._render; if (r) w._render = body => { r(body); setTimeout(() => Weather.stamp(), 0); }; }; })(Apps.builtin['pets:weather'].open);

window.Albums = Albums; window.PhotoEdit = PhotoEdit; window.VCard = VCard; window.NoteBox = NoteBox;
