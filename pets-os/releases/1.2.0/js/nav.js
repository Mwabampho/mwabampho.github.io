// Getting around Pets OS for Stephone:
//   - swipe in from the left edge of an app to go back (one screen, or out of the app)
//   - big titles shrink into the top bar as you scroll
//   - the app switcher shows what is in each app
//   - one search (Search pill / Rest) finds apps, settings, notes and events, or asks Clarice
//   - Clarice opens settings pages and changes text size and read-aloud
'use strict';

// ---------------------------------------------------------------- edge swipe back
const EdgeBack = {
  s: null,
  init() {
    document.addEventListener('pointerdown', e => {
      const win = e.target.closest && e.target.closest('.win');
      const w = Shell.front();
      if (!win || !w || w.el !== win || e.clientX > 22 || Shell.locked) return;
      this.s = { x: e.clientX, y: e.clientY, w, id: e.pointerId, dx: 0 };
    }, true);
    document.addEventListener('pointermove', e => {
      const s = this.s; if (!s || e.pointerId !== s.id) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dy) > 40 && Math.abs(dy) > dx) { this.cancel(); return; }
      if (dx > 6) { s.dx = dx; s.w.el.style.transition = 'none'; s.w.el.style.transform = 'translateX(' + Math.min(dx, window.innerWidth) * 0.6 + 'px)'; s.w.el.classList.add('edge-dragging'); }
    }, true);
    document.addEventListener('pointerup', e => this.end(e), true);
    document.addEventListener('pointercancel', () => this.cancel(), true);
  },
  // Finger lifted: far enough to the right means Back (one screen, or out of the app).
  end(e) {
    const s = this.s; if (!s || (e && e.pointerId !== s.id)) return false;
    this.cancel();
    if (s.dx > 80) { swallowClick(e && e.clientX != null ? e : { clientX: 0, clientY: 0 }); if (!s.w.back()) Shell.goHome(); return true; }
    return false;
  },
  cancel() {
    const s = this.s; this.s = null;
    if (s) { s.w.el.style.transition = 'transform .18s ease-out'; s.w.el.style.transform = ''; s.w.el.classList.remove('edge-dragging'); setTimeout(() => { s.w.el.style.transition = ''; }, 200); }
  }
};

// ---------------------------------------------------------------- shrinking titles
document.addEventListener('scroll', e => {
  const b = e.target;
  if (!b || !b.classList || !b.classList.contains('body') || !b.parentElement || !b.parentElement.classList.contains('win')) return;
  const win = b.parentElement, compact = win.classList.contains('compact');
  if (!compact && b.scrollTop > 44) win.classList.add('compact');
  else if (compact && b.scrollTop < 8) win.classList.remove('compact');
}, true);
// A new screen starts with the big title again.
(orig => { AppWindow.prototype.push = function (...a) { this.el.classList.remove('compact'); return orig.apply(this, a); }; })(AppWindow.prototype.push);
(orig => { AppWindow.prototype.back = function (...a) { const r = orig.apply(this, a); if (r) this.el.classList.toggle('compact', this.body.scrollTop > 44); return r; }; })(AppWindow.prototype.back);

// ---------------------------------------------------------------- app switcher with previews
Shell.recents = function () {
  this.closeSheets();
  const box = $('#recents');
  box.innerHTML = '';
  const ws = this.windows.slice().reverse();
  if (!ws.length) box.append(h('div', { class: 'none', text: 'No apps open' }));
  ws.forEach(w => {
    const cap = h('div', { class: 'rc-cap' }, Apps.tile(w.app), h('span', { text: w.app.name }));
    const snap = h('div', { class: 'rc-snap' });
    const copy = w.el.cloneNode(true);
    copy.classList.remove('hidden', 'closing'); copy.removeAttribute('style');
    copy.querySelectorAll('input,textarea,button,iframe').forEach(x => { x.tabIndex = -1; });
    $$('iframe', copy).forEach(f => f.remove());
    snap.append(copy);
    const card = h('div', { class: 'rc' }, snap);
    const wrap = h('div', { class: 'rc-wrap' }, cap, card);
    card.addEventListener('click', () => { box.classList.add('hidden'); this.open(w.id); });
    swipe(card, dir => {
      if (dir !== 'up') return;
      wrap.style.transition = '.2s ease-out'; wrap.style.transform = 'translateY(-110%)'; wrap.style.opacity = 0;
      setTimeout(() => { this.quit(w); wrap.remove(); if (!this.windows.length) this.recents(); }, 200);
    });
    box.append(wrap);
  });
  box.classList.remove('hidden');
  $$('#apps > .win').forEach(e => e.classList.add('hidden'));
  $('#home').classList.add('away');
  box.onclick = e => { if (e.target === box) { box.classList.add('hidden'); this.goHome(); } };
};

// ---------------------------------------------------------------- one search for everything
const Find = {
  settings(q) { return SettingsIndex.filter(([t, p, k]) => (t + ' ' + k).toLowerCase().includes(q)).slice(0, 4); },
  notes(q) { return Pen.load().notes.filter(n => (n.text || '').toLowerCase().includes(q)).slice(0, 3); },
  events(q) { return Calendar.events().filter(e => (e.title || '').toLowerCase().includes(q)).sort((a, b) => (a.date > b.date ? 1 : -1)).slice(0, 3); },
  row(glyph, colour, title, sub, fn) {
    const r = h('div', { class: 'srow' }, h('div', { class: 'sq', style: { background: colour }, html: icon(glyph) }),
      h('div', { class: 'grow' }, h('div', { class: 'st', text: title }), sub ? h('div', { class: 'ss', text: sub }) : null), h('span', { class: 'chev', html: icon('chevron-right') }));
    press(r, () => { Shell.closeSheets(); fn(); });
    return r;
  },
  sect(text) { return h('div', { class: 'sect', text }); }
};
(orig => { Rest.fill = function (box, q) {
  orig.call(this, box, q);
  q = (q || '').trim().toLowerCase();
  if (!q) return;
  // "No apps match" goes: the other results (and Clarice) cover it.
  $$('.sect', box).forEach(s => { if (/^No apps match/.test(s.textContent)) s.remove(); });
  const set = Find.settings(q), notes = Find.notes(q), evs = Find.events(q);
  if (set.length) { box.append(Find.sect('Settings')); set.forEach(([t, p]) => { const pt = SettingsPageNames[p] || t; box.append(Find.row('settings', '#5d6680', t, pt !== t ? 'Settings › ' + pt : 'Settings', () => Settings.go(p))); }); }
  if (notes.length) { box.append(Find.sect('Pen')); notes.forEach(n => box.append(Find.row('notebook-pen', '#ffb84d', Pen.title(n), Pen.preview(n), () => { Shell.open('pets:pen'); const w = Shell.front(); if (w && w.openNote) w.openNote(n.id); }))); }
  if (evs.length) { box.append(Find.sect('Calendar')); evs.forEach(e => box.append(Find.row('calendar', '#ff5c63', e.title, e.date + (e.time ? ' ' + e.time : ''), () => Shell.open('pets:calendar')))); }
  box.append(Find.sect('Clarice'));
  box.append(Find.row('sparkles', '#8c7bff', 'Ask Clarice: "' + q + '"', 'She can open things, set timers, change settings and more', () => ClaricePanel.open(q)));
}; })(Rest.fill);

// ---------------------------------------------------------------- Clarice and settings
(orig => { Clarice.answer = async function (raw) {
  const t = String(raw || '').trim(), q = t.toLowerCase().replace(/[?!.]+$/, '');
  let m;
  const sizes = [0.9, 1, 1.1, 1.2, 1.35, 1.5];
  const say = r => { if (S.claSpeak) Speak.say(r); return r; };
  if (/^(make )?(the )?(text|writing|letters|font)( size)? (bigger|larger)$|^bigger text$|^larger text$/.test(q)) {
    const i = Math.min(sizes.length - 1, Math.max(0, sizes.indexOf(S.textScale || 1)) + 1); Prefs.set('textScale', sizes[i]);
    return say('Text is now ' + Math.round(sizes[i] * 100) + '%.');
  }
  if (/^(make )?(the )?(text|writing|letters|font)( size)? smaller$|^smaller text$/.test(q)) {
    const i = Math.max(0, Math.max(0, sizes.indexOf(S.textScale || 1)) - 1); Prefs.set('textScale', sizes[i]);
    return say('Text is now ' + Math.round(sizes[i] * 100) + '%.');
  }
  if ((m = /^(?:turn |switch )?(on|off) read(?:ing)? aloud$|^read aloud (on|off)$|^(?:turn |switch )(on|off) (?:the )?voice$/.exec(q))) {
    const on = (m[1] || m[2] || m[3]) === 'on'; S.claSpeak = on; Store.save();
    if (on) Speak.say('OK, I will read my replies aloud.'); else Speak.stop();
    return on ? 'I\'ll read my replies aloud.' : 'I\'ll stop reading aloud.';
  }
  if ((m = /^(?:open |show |go to )?(?:the )?(.+?) settings$|^settings (?:for )?(.+)$/.exec(q))) {
    const want = (m[1] || m[2]).trim();
    const hit = SettingsIndex.find(([title, p, k]) => title.toLowerCase() === want) || SettingsIndex.find(([title, p, k]) => (title + ' ' + k).toLowerCase().includes(want));
    if (hit) { setTimeout(() => { ClaricePanel.close(); Settings.go(hit[1]); }, 400); return say('Opening ' + (SettingsPageNames[hit[1]] || hit[0]) + '.'); }
  }
  return orig.call(this, raw);
}; })(Clarice.answer);

(orig => { Shell.start = function () { orig.call(this); EdgeBack.init(); }; })(Shell.start);
window.Find = Find; window.EdgeBack = EdgeBack;
