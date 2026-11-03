// Full-colour app icons for Pets OS. Vector, so they are sharp on any screen (3x on Stephone).
// Apps with approved artwork (Rest, Clarice, Pen, Moments, O Store, Milo) keep their pictures.
// Clock shows the real time and Calendar today's date.
'use strict';
const HD = {
  n: 0,
  // Unique gradient ids per drawing: the same icon appears on Home, in Rest and in Clarice at once.
  id() { return 'hd' + (++this.n); },
  wrap(body) { return '<svg class="hd" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>'; },
  lin(id, a, b, x2, y2) { return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 0 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>'; },
  // A soft top highlight, like light falling on the icon.
  shine(id) { return '<defs>' + this.lin(id, 'rgba(255,255,255,.28)', 'rgba(255,255,255,0)') + '</defs><rect width="120" height="60" fill="url(#' + id + ')"/>'; },
  gear(cx, cy, r1, r2, teeth) {
    let d = '';
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = (i / (teeth * 2)) * Math.PI * 2, a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2, r = i % 2 ? r1 : r2;
      const p = a => (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2);
      d += (i ? 'L' : 'M') + p(a0 + 0.04) + 'L' + p(a1 - 0.04);
    }
    return d + 'Z';
  },
  icons: {
    'sys:phone'() {
      const g = HD.id();
      return '<defs>' + HD.lin(g, '#6cf28a', '#18b843') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<path transform="translate(27 27) scale(2.75)" fill="#fff" d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>';
    },
    'sys:messages'() {
      const g = HD.id();
      return '<defs>' + HD.lin(g, '#6cf28a', '#18b843') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<ellipse cx="60" cy="56" rx="38" ry="31" fill="#fff"/><path d="M30 74 Q28 88 18 94 Q38 92 46 82 Z" fill="#fff"/>';
    },
    'sys:camera'() {
      const g = HD.id(), l = HD.id();
      return '<defs>' + HD.lin(g, '#eef0f3', '#b4bac3') + '<radialGradient id="' + l + '" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#6f86ff"/><stop offset=".45" stop-color="#25306b"/><stop offset="1" stop-color="#05070f"/></radialGradient></defs>' +
        '<rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<rect x="16" y="34" width="88" height="60" rx="12" fill="#2b2f36"/><rect x="42" y="27" width="36" height="12" rx="4" fill="#2b2f36"/>' +
        '<circle cx="60" cy="64" r="22" fill="#9aa1ab"/><circle cx="60" cy="64" r="18" fill="url(#' + l + ')"/><circle cx="53" cy="57" r="4.5" fill="rgba(255,255,255,.55)"/>' +
        '<circle cx="91" cy="45" r="3.5" fill="#ffcf4d"/>';
    },
    'sys:contacts'() {
      const g = HD.id();
      return '<defs>' + HD.lin(g, '#c9ced6', '#8b929c') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<circle cx="60" cy="48" r="20" fill="#fff"/><path d="M24 104c4-22 20-32 36-32s32 10 36 32z" fill="#fff"/>';
    },
    'pets:calculator'() {
      const g = HD.id();
      let keys = '';
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const orange = c === 3, top = r === 0 && c < 3;
        keys += '<rect x="' + (17 + c * 22) + '" y="' + (37 + r * 18) + '" width="18" height="14" rx="7" fill="' + (orange ? '#ff9f0a' : top ? '#a5a5aa' : '#3a3a3e') + '"/>';
      }
      return '<defs>' + HD.lin(g, '#2c2c30', '#0b0b0d') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<rect x="17" y="15" width="84" height="16" rx="5" fill="#16161a"/><text x="96" y="28" text-anchor="end" font-family="Inter" font-size="13" font-weight="500" fill="#fff">128</text>' + keys;
    },
    'pets:clock'() {
      const d = new Date(), hh = d.getHours() % 12, mm = d.getMinutes();
      const ha = (hh + mm / 60) * 30, ma = mm * 6;
      let ticks = '';
      for (let i = 0; i < 12; i++) ticks += '<rect x="58.6" y="17" width="2.8" height="' + (i % 3 ? 6 : 10) + '" rx="1.4" fill="#1c1c1e" transform="rotate(' + i * 30 + ' 60 60)"/>';
      return '<rect width="120" height="120" fill="#111214"/><circle cx="60" cy="60" r="47" fill="#fbfbfd"/>' + ticks +
        '<rect x="57" y="34" width="6" height="30" rx="3" fill="#1c1c1e" transform="rotate(' + ha + ' 60 60)"/>' +
        '<rect x="58" y="21" width="4" height="43" rx="2" fill="#1c1c1e" transform="rotate(' + ma + ' 60 60)"/>' +
        '<circle cx="60" cy="60" r="5" fill="#ff9f0a"/><circle cx="60" cy="60" r="2" fill="#fff"/>';
    },
    'pets:calendar'() {
      const d = new Date();
      return '<rect width="120" height="120" fill="#fff"/>' +
        '<text x="60" y="36" text-anchor="middle" font-family="Inter" font-size="19" font-weight="600" fill="#ff3b30">' + d.toLocaleDateString(undefined, { weekday: 'short' }).replace('.', '') + '</text>' +
        '<text x="60" y="94" text-anchor="middle" font-family="InterDisplay, Inter" font-size="62" font-weight="300" fill="#111" letter-spacing="-2">' + d.getDate() + '</text>';
    },
    'pets:weather'() {
      const g = HD.id(), s = HD.id(), c = HD.id();
      return '<defs>' + HD.lin(g, '#5fb4ff', '#1d5fd1') + '<radialGradient id="' + s + '"><stop offset="0" stop-color="#fff6b0"/><stop offset=".55" stop-color="#ffd23f"/><stop offset="1" stop-color="#ffb000"/></radialGradient>' + HD.lin(c, '#ffffff', '#d9e6f5') + '</defs>' +
        '<rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<circle cx="76" cy="42" r="26" fill="rgba(255,220,90,.25)"/><circle cx="76" cy="42" r="19" fill="url(#' + s + ')"/>' +
        '<path d="M30 92 h52 a16 16 0 0 0 0-32 a22 22 0 0 0-42 4 a14 14 0 0 0-10 28z" fill="url(#' + c + ')"/>';
    },
    'pets:settings'() {
      const g = HD.id(), m = HD.id();
      return '<defs>' + HD.lin(g, '#d9dde3', '#8a919b') + HD.lin(m, '#a4abb5', '#4c535d') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<path d="' + HD.gear(60, 60, 44, 36, 14) + '" fill="#5d646e"/>' +
        '<circle cx="60" cy="60" r="34" fill="url(#' + m + ')"/><circle cx="60" cy="60" r="26" fill="#d4d8de"/>' +
        '<path d="' + HD.gear(60, 60, 20, 15, 8) + '" fill="#6b727c"/><circle cx="60" cy="60" r="8" fill="#d4d8de"/>';
    },
    'pets:activities'() {
      const g = HD.id(), hgr = HD.id();
      return '<defs>' + HD.lin(g, '#ffffff', '#eef0f4') + HD.lin(hgr, '#ff7a90', '#e5153c') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<path d="M60 98 C30 78 16 62 16 44 a22 22 0 0 1 44-6 a22 22 0 0 1 44 6 c0 18-14 34-44 54z" fill="url(#' + hgr + ')"/>' +
        '<path d="M26 58 h18 l7-14 l10 28 l7-14 h26" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    },
    'pets:files'() {
      const g = HD.id(), f = HD.id();
      return '<defs>' + HD.lin(g, '#ffffff', '#eceff4') + HD.lin(f, '#6cc0ff', '#1e7bf2') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<path d="M18 34 a6 6 0 0 1 6-6 h24 l8 8 h40 a6 6 0 0 1 6 6 v8 H18z" fill="#4aa3f7"/>' +
        '<rect x="18" y="44" width="84" height="50" rx="7" fill="url(#' + f + ')"/>';
    },
    'pets:capsule'() {
      const g = HD.id(), b = HD.id();
      return '<defs>' + HD.lin(g, '#a597ff', '#ff8fb1') + HD.lin(b, '#ffffff', '#efe9ff') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' +
        '<rect x="28" y="40" width="64" height="50" rx="8" fill="url(#' + b + ')"/><path d="M28 48 L60 70 L92 48" fill="none" stroke="#b9a8ff" stroke-width="4" stroke-linejoin="round"/>' +
        '<circle cx="60" cy="72" r="11" fill="#ff6b8b"/><path d="M55 72 l4 4 l7 -8" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M84 26 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3z" fill="#fff" opacity=".9"/>';
    },
    'pets:pip'() {
      const g = HD.id();
      const pip = window.Pip ? Pip.svg('happy').replace('<svg class="pip-svg m-happy"', '<svg x="10" y="12" width="100" height="100"') : '';
      return '<defs>' + HD.lin(g, '#ffd98a', '#ff9a6b') + '</defs><rect width="120" height="120" fill="url(#' + g + ')"/>' + pip;
    }
  },
  alias: { 'pets:phone': 'sys:phone', 'pets:messages': 'sys:messages', 'pets:camera': 'sys:camera', 'pets:contacts': 'sys:contacts' },
  has(id) { return !!this.icons[this.alias[id] || id]; },
  draw(id) { return this.wrap(this.icons[this.alias[id] || id]() + this.shine(this.id())); },
  // Clock and Calendar change: redraw them every half minute.
  live() {
    $$('.tile[data-hd="pets:clock"], .tile[data-hd="pets:calendar"]').forEach(t => { t.innerHTML = this.draw(t.getAttribute('data-hd')); });
  }
};
(orig => { Apps.tile = function (app, big) {
  if (!app || !HD.has(app.id)) return orig.call(this, app, big);
  const t = h('div', { class: 'tile hd-tile', 'data-hd': app.id });
  t.innerHTML = HD.draw(app.id);
  return t;
}; })(Apps.tile);
setInterval(() => HD.live(), 30000);
window.HD = HD;
