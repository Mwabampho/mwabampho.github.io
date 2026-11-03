// Pets OS for Stephone: the phone itself.
//   - Lenda, Sonix and StepMail (the owner's own apps, from ShouldBe-Desktop, in web/apps/) as built-in apps
//   - Default apps: which app opens for Calendar, Photos, Browser, Mail, Music, Launcher, Store, Phone,
//     Messages, Camera and Notes, used everywhere the system opens one (Settings › Default Apps)
//   - Phone, Contacts, Messages and Camera apps, using the real hardware when the device provides it
//     (Android: calls, SMS, contacts, camera with permission; iPhone/browser: camera, and calls/texts handed
//     to the iPhone) and saying plainly when it doesn't.
'use strict';

// ================================================================ the owner's apps, in a frame
const DeskApp = {
  open(w, slug, bg) {
    w.header.style.display = 'none';
    w.el.style.background = bg || 'var(--bg)';
    Object.assign(w.body.style, { padding: '0', paddingTop: 'var(--bar)', paddingBottom: 'calc(26px + var(--sab))', overflow: 'hidden', display: 'flex' });
    const f = h('iframe', { src: 'apps/' + slug + '/index.html', title: slug, style: { flex: '1', width: '100%', border: '0', background: bg || 'transparent' } });
    w.body.append(f); w.frame = f;
    // Back steps back inside the app first (if it changed page), then leaves.
    w.onBack = () => { try { if (f.contentWindow.history.length > 1 && f.contentWindow.location.hash) { f.contentWindow.history.back(); return true; } } catch (e) { /* not loaded */ } return false; };
  }
};
const DESK = [
  { id: 'pets:lenda', name: 'Lenda', slug: 'lenda', bg: '#090e1c', role: 'calendar', keywords: 'calendar events tasks diary schedule george' },
  { id: 'pets:sonix', name: 'Sonix', slug: 'sonix', bg: '#0b0c12', role: 'music', keywords: 'music songs player studio record' },
  { id: 'pets:stepmail', name: 'StepMail', slug: 'stepmail', bg: '#1c1c1e', role: 'mail', keywords: 'mail email inbox stepmail' }
];
DESK.forEach(d => Apps.register({ id: d.id, name: d.name, img: 'apps/' + d.slug + '/pets-icon.png', cat: 'Pets OS', keywords: d.keywords, open(w) { DeskApp.open(w, d.slug, d.bg); } }));

// Lenda's events also feed the Today widget, the lock screen and Clarice (Lenda keeps Swift dates:
// seconds since 1 Jan 2001).
(orig => { Calendar.next = function () {
  const own = orig.call(this);
  let doc = null; try { doc = JSON.parse(localStorage.getItem('petsos.desk.lenda.calendar')); } catch (e) { doc = null; }
  const now = Date.now();
  const ev = doc && Array.isArray(doc.events) ? doc.events.map(e => ({ title: e.title, at: (e.start + 978307200) * 1000 })).filter(e => e.at > now).sort((a, b) => a.at - b.at)[0] : null;
  if (!ev) return own;
  const d = new Date(ev.at), k = Calendar.key(d), today = Calendar.key(new Date()), tom = Calendar.key(new Date(now + 864e5));
  const lenda = { title: ev.title, when: (k === today ? 'Today' : k === tom ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()), at: ev.at };
  if (!own) return lenda;
  return own;   // the Pets OS calendar's own next event wins when both have one (it is checked first)
}; })(Calendar.next);

// ================================================================ default apps
const Defaults = {
  roles: [
    { id: 'calendar', name: 'Calendar', glyph: 'calendar', apps: ['pets:lenda', 'pets:calendar'] },
    { id: 'photos', name: 'Photos', glyph: 'image', apps: ['pets:moments'] },
    { id: 'browser', name: 'Browser', glyph: 'globe', apps: ['store:milo', 'pets:milo'] },
    { id: 'mail', name: 'Mail', glyph: 'mail', apps: ['pets:stepmail'] },
    { id: 'music', name: 'Music', glyph: 'music', apps: ['pets:sonix'] },
    { id: 'launcher', name: 'App launcher', glyph: 'layout-grid', apps: ['pets:rest'] },
    { id: 'store', name: 'App store', glyph: 'bag', apps: ['pets:ostore'] },
    { id: 'phone', name: 'Phone', glyph: 'phone', apps: ['pets:phone'] },
    { id: 'messages', name: 'Messages', glyph: 'message', apps: ['pets:messages'] },
    { id: 'camera', name: 'Camera', glyph: 'camera', apps: ['pets:camera'] },
    { id: 'contacts', name: 'Contacts', glyph: 'users', apps: ['pets:contacts'] },
    { id: 'notes', name: 'Notes', glyph: 'notebook-pen', apps: ['pets:pen'] }
  ],
  role(id) { return this.roles.find(r => r.id === id); },
  // Android apps that can also fill a role (when Pets OS runs as the home app on an Android phone).
  androidFor(role) {
    const words = { calendar: /calendar/i, photos: /photo|gallery/i, browser: /chrome|browser|firefox|brave/i, mail: /mail|gmail|outlook/i, music: /music|spotify/i, phone: /dialer|phone/i, messages: /messag|sms/i, camera: /camera/i, contacts: /contact/i, notes: /note|keep/i }[role];
    return words ? Apps.android.filter(a => words.test(a.label + ' ' + a.pkg)).map(a => 'android:' + a.pkg) : [];
  },
  choices(role) { return this.role(role).apps.filter(id => Apps.get(id)).concat(this.androidFor(role)); },
  get(role) { const set = (S.defaults || {})[role]; const ok = this.choices(role); return set && ok.indexOf(set) >= 0 ? set : ok[0]; },
  set(role, id) { S.defaults = Object.assign({}, S.defaults || {}, { [role]: id }); Store.save(); },
  isDefault(id) { return this.roles.some(r => this.get(r.id) === id); },
  open(role) { const id = this.get(role); if (!id) { Shell.toast('No app is set for ' + this.role(role).name); return false; } Shell.open(id); return true; }
};
// The system opens the default app everywhere: Rest's music button, Control Centre, the Dock, Clarice.
(() => {
  const camOrig = Phone.camera;
  Phone.music = () => Defaults.open('music');
  Phone.camera = () => Defaults.open('camera');
  Phone.contacts = () => Defaults.open('contacts');
  Defaults.systemCamera = camOrig;
})();
['sys:phone', 'sys:messages', 'sys:camera', 'sys:contacts'].forEach(id => { const a = Apps.builtin[id]; if (a) a.launch = () => Defaults.open(id.slice(4)); });
// Today widget opens the default calendar.
(orig => { Widgets.make = function (id) {
  const w = orig.call(this, id);
  if (id === 'widget:today' && w) { const fresh = w.cloneNode(true); fresh.className = w.className; Widgets.today(fresh); press(fresh, () => Defaults.open('calendar')); return fresh; }
  return w;
}; })(Widgets.make);
(orig => { Clarice.answer = async function (raw) {
  const q = String(raw || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  let m = /^(?:open|launch|start|go to) (?:the |my )?(calendar|photos|pictures|browser|internet|web|mail|email|music|launcher|app store|store|phone|dialler|dialer|messages|texts|camera|contacts|notes)(?: app)?$/.exec(q);
  if (m) {
    const role = { pictures: 'photos', internet: 'browser', web: 'browser', email: 'mail', 'app store': 'store', dialler: 'phone', dialer: 'phone', texts: 'messages' }[m[1]] || m[1];
    const id = Defaults.get(role), app = id && Apps.get(id);
    if (!app) return 'No app is set for ' + role + '.';
    setTimeout(() => { if (window.ClaricePanel) ClaricePanel.close(); Shell.open(id); }, 400);
    return 'Opening ' + app.name + '.';
  }
  if ((m = /^(?:call|ring|phone) (.+)$/.exec(q))) {
    const c = Contacts.find(m[1]); if (c && c.numbers[0]) { setTimeout(() => PhoneApp.call(c.numbers[0], c.name), 300); return 'Calling ' + c.name + '.'; }
  }
  return orig.call(this, raw);
}; })(Clarice.answer);

// ================================================================ permissions helper
const Perm = {
  has(k) { return onPhone ? !!Phone.hasPermission(k) : false; },
  ask(k) { return new Promise(res => { if (!onPhone) { res(false); return; } const done = () => { window.removeEventListener('petsos-permission', done); res(!!Phone.hasPermission(k)); }; window.addEventListener('petsos-permission', done); Phone.askPermission(k); setTimeout(done, 20000); }); },
  telephony() { return onPhone ? !!Phone.hasTelephony() : false; }
};
(orig => { PetsOS.native = function (ev) { if (ev === 'permission') { window.dispatchEvent(new Event('petsos-permission')); return; } return orig.call(this, ev); }; })(PetsOS.native);

// ================================================================ Contacts
const Contacts = {
  own() { return Store.app('contacts', []); },
  save(l) { Store.setApp('contacts', l); },
  phone() { if (!onPhone || !Perm.has('contacts')) return []; const l = json(Phone.phoneContacts(), []) || []; return l.map(c => Object.assign(c, { fromPhone: true })); },
  all() {
    const own = this.own(), names = new Set(own.map(c => (c.name || '').toLowerCase()));
    return own.concat(this.phone().filter(c => !names.has((c.name || '').toLowerCase()))).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  },
  get(id) { return this.all().find(c => c.id === id); },
  find(q) { q = String(q).toLowerCase().trim(); const all = this.all(); return all.find(c => (c.name || '').toLowerCase() === q) || all.find(c => (c.name || '').toLowerCase().startsWith(q)) || all.find(c => c.numbers.some(n => n.replace(/\D/g, '') === q.replace(/\D/g, '') && q.replace(/\D/g, ''))); },
  byNumber(n) { const d = String(n).replace(/\D/g, '').slice(-9); return d ? this.all().find(c => c.numbers.some(x => x.replace(/\D/g, '').slice(-9) === d)) : null; },
  upsert(c) { const l = this.own(); const i = l.findIndex(x => x.id === c.id); if (i >= 0) l[i] = c; else l.push(c); this.save(l); return c; },
  remove(id) { this.save(this.own().filter(c => c.id !== id)); },
  initials(n) { return (n || '?').split(/\s+/).map(x => x[0]).join('').slice(0, 2).toUpperCase(); },
  avatar(c, size) { return h('div', { class: 'avatar-c', style: { width: size + 'px', height: size + 'px', fontSize: (size * 0.4) + 'px', background: letterColour(c.name || '?') }, text: this.initials(c.name) }); },
  // Edit / create screen (used by Contacts and Phone).
  edit(w, c, after) {
    const isNew = !c || c.fromPhone;
    const base = c ? Object.assign({}, c, { id: c.fromPhone ? uid() : c.id, fromPhone: undefined }) : { id: uid(), name: '', numbers: [''], email: '', notes: '', fav: false };
    w.push(isNew && !c ? 'New Contact' : 'Edit Contact', body => {
      const name = h('input', { class: 'field', placeholder: 'Name', value: base.name, autocorrect: 'off', autocapitalize: 'words' });
      const nums = h('div');
      const addNum = v => { const f = h('input', { class: 'field', placeholder: 'Phone number', type: 'tel', inputmode: 'tel', value: v || '' }); nums.append(f); };
      (base.numbers.length ? base.numbers : ['']).forEach(addNum);
      const more = h('button', { class: 'btn secondary block', text: 'Add another number', style: { marginBottom: '12px' } }); more.onclick = () => addNum('');
      const email = h('input', { class: 'field', placeholder: 'Email', type: 'email', inputmode: 'email', value: base.email || '', autocapitalize: 'off' });
      const notes = h('textarea', { class: 'field', rows: 3, placeholder: 'Notes', value: base.notes || '' }); notes.value = base.notes || '';
      const save = h('button', { class: 'btn block', text: 'Save' });
      save.onclick = () => {
        const n = name.value.trim(); const ns = Array.from(nums.querySelectorAll('input')).map(i => i.value.trim()).filter(Boolean);
        if (!n && !ns.length) { Shell.toast('Add a name or a number'); return; }
        const saved = Contacts.upsert(Object.assign(base, { name: n || ns[0], numbers: ns, email: email.value.trim(), notes: notes.value.trim() }));
        Shell.toast('Saved ' + saved.name); w.back(); if (after) after(saved);
      };
      body.append(name, nums, more, email, notes, h('div', { style: { height: '10px' } }), save);
      if (c && !c.fromPhone) {
        const del = h('button', { class: 'btn block secondary', text: 'Delete Contact', style: { color: 'var(--danger)', marginTop: '10px' } });
        del.onclick = async () => { if (await Dialog.confirm('Delete ' + (c.name || 'this contact') + '?', null, 'Delete', true)) { Contacts.remove(c.id); w.back(); w.back(); } };
        body.append(del);
      }
      if (c && c.fromPhone) body.append(h('p', { class: 'set-note', style: { marginTop: '12px' }, text: 'This contact comes from the phone\'s address book. Saving makes an editable copy in Pets OS; the original stays as it is.' }));
    });
  },
  detail(w, c) {
    w.push(c.name || 'Contact', body => {
      body.append(h('div', { class: 'contact-head' }, Contacts.avatar(c, 84), h('div', { class: 'contact-name', text: c.name || 'No name' }), c.fromPhone ? h('div', { class: 'sub', text: 'From the phone\'s contacts' }) : null));
      const acts = h('div', { class: 'contact-acts' });
      const act = (g, l, fn, off) => { const b = h('button', { class: 'cact' + (off ? ' off' : ''), html: icon(g) + '<span>' + l + '</span>' }); b.onclick = fn; acts.append(b); };
      const n = c.numbers[0];
      act('phone', 'Call', () => n ? PhoneApp.call(n, c.name) : Shell.toast('No number'), !n);
      act('message', 'Message', () => n ? (Shell.open('pets:messages'), MessagesApp.openThread(n)) : Shell.toast('No number'), !n);
      act('mail', 'Mail', () => c.email ? Defaults.open('mail') : Shell.toast('No email address'), !c.email);
      act('star', c.fav ? 'Favourite' : 'Add favourite', () => { if (c.fromPhone) { Shell.toast('Save it to Pets OS first (Edit)'); return; } c.fav = !c.fav; Contacts.upsert(c); w.refresh(); });
      body.append(acts);
      const card = h('div', { class: 'card' });
      c.numbers.forEach(x => { const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'sub', text: 'phone' }), h('div', { text: x })), h('span', { class: 'chev', html: icon('phone') })); press(r, () => PhoneApp.call(x, c.name)); card.append(r); });
      if (c.email) card.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'sub', text: 'email' }), h('div', { text: c.email }))));
      if (c.notes) card.append(h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'sub', text: 'notes' }), h('div', { text: c.notes, style: { whiteSpace: 'pre-wrap' } }))));
      if (card.children.length) body.append(card);
      const edit = h('button', { class: 'btn block secondary', text: c.fromPhone ? 'Edit (save a copy)' : 'Edit' }); edit.onclick = () => Contacts.edit(w, c, () => w.refresh());
      body.append(edit);
    });
  },
  // A searchable list, used by Contacts and the Phone app's Contacts tab.
  list(w, body, onPick) {
    const f = h('input', { type: 'search', placeholder: 'Search contacts', autocomplete: 'off' });
    const box = h('div');
    const draw = () => {
      box.innerHTML = ''; const q = f.value.trim().toLowerCase();
      const all = Contacts.all().filter(c => !q || (c.name || '').toLowerCase().includes(q) || c.numbers.some(n => n.includes(q)) || (c.email || '').toLowerCase().includes(q));
      if (!all.length) { box.append(h('div', { class: 'empty-state', html: icon('users') + '<br>' + (q ? 'No contacts match.' : 'No contacts yet.') })); return; }
      let letter = ''; let card = null;
      all.forEach(c => {
        const L = /[a-z]/i.test((c.name || '#')[0]) ? c.name[0].toUpperCase() : '#';
        if (L !== letter) { letter = L; box.append(h('div', { class: 'label', text: L })); card = h('div', { class: 'card' }); box.append(card); }
        const r = h('div', { class: 'row' }, Contacts.avatar(c, 36), h('div', { class: 'grow' }, h('div', { text: c.name || c.numbers[0] || 'No name' }), h('div', { class: 'sub', text: c.numbers[0] || c.email || '' })), c.fromPhone ? h('span', { class: 'val', text: 'phone' }) : null, h('span', { class: 'chev', html: icon('chevron-right') }));
        press(r, () => onPick(c)); card.append(r);
      });
    };
    f.addEventListener('input', draw);
    body.append(h('div', { class: 'search set-search', html: icon('search') }, f));
    if (onPhone && !Perm.has('contacts')) {
      const b = h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: '#3d7bff' }, html: icon('users') }), h('div', { class: 'grow' }, h('div', { text: 'Show the phone\'s contacts' }), h('div', { class: 'sub', text: 'Allow Pets OS to read the address book' })), h('span', { class: 'chev', html: icon('chevron-right') })));
      press(b.firstChild, async () => { if (await Perm.ask('contacts')) w.refresh(); else Shell.toast('Contacts permission not given'); });
      body.append(b);
    }
    body.append(box); draw();
  }
};
Apps.register({
  id: 'pets:contacts', name: 'Contacts', glyph: 'users', bg: G.grey, cat: 'Phone', keywords: 'people address book numbers',
  open(w) {
    w.actions([{ icon: 'plus', label: 'New contact', fn: () => Contacts.edit(w, null, () => w.refresh()) }]);
    w.root(body => Contacts.list(w, body, c => Contacts.detail(w, c)));
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// ================================================================ Phone
const PhoneApp = {
  log() { return Store.app('calls', []); },
  can() { return onPhone ? (Perm.telephony() ? (Perm.has('call') ? 'direct' : 'dialler') : 'none') : (/iPhone|Android/.test(navigator.userAgent) ? 'handoff' : 'none'); },
  async call(number, name) {
    number = String(number || '').replace(/[^\d+*#]/g, '');
    if (!number) { Shell.toast('Type a number first'); return; }
    const how = this.can();
    if (how === 'none') { Dialog.menu('Calls aren\'t available here', isStephone ? 'The Stephone simulator has no phone line. On a real Stephone this button places the call.' : 'This device has no phone line, so Pets OS can\'t place calls on it.', [{ label: 'Copy the number', fn: () => { try { navigator.clipboard.writeText(number); Shell.toast('Copied'); } catch (e) { /* ignore */ } } }]); return; }
    if (how === 'dialler' && !S.callAsked) { S.callAsked = true; Store.save(); await Perm.ask('call'); }
    const c = name ? { name } : Contacts.byNumber(number);
    const l = this.log(); l.unshift({ id: uid(), number, name: c ? c.name : '', at: Date.now(), dir: 'out', via: this.can() }); Store.setApp('calls', l.slice(0, 300));
    if (onPhone) Phone.call(number); else Phone.dial(number);
  }
};
Apps.register({
  id: 'pets:phone', name: 'Phone', glyph: 'phone', bg: G.green, cat: 'Phone', keywords: 'call dial keypad recents favourites',
  open(w) {
    let tab = 'keypad', typed = '';
    const tabs = [['favs', 'Favourites', 'star'], ['recents', 'Recents', 'clock'], ['contacts', 'Contacts', 'users'], ['keypad', 'Keypad', 'grid']];
    const bar = h('div', { class: 'phone-tabs' });
    const draw = body => {
      w.setTitle(tabs.find(t => t[0] === tab)[1]);
      w.actions(tab === 'contacts' ? [{ icon: 'plus', label: 'New contact', fn: () => Contacts.edit(w, null, () => w.refresh()) }] : []);
      const how = PhoneApp.can();
      if (how === 'none' || how === 'handoff') body.append(h('div', { class: 'phone-note', text: how === 'none' ? (isStephone ? 'Simulator: no phone line. Calls work on a real Stephone.' : 'This device has no phone line: calls can\'t be placed here.') : 'Calls are placed by your ' + (/iPhone/.test(navigator.userAgent) ? 'iPhone' : 'phone') + ' (it asks you to confirm).' }));
      else if (how === 'dialler') { const b = h('button', { class: 'phone-note link', text: 'Allow Pets OS to place calls directly (otherwise the dialler opens)' }); b.onclick = async () => { await Perm.ask('call'); w.refresh(); }; body.append(b); }
      if (tab === 'keypad') {
        const show = () => typed.length > 13 ? '…' + typed.slice(-13) : (typed || ' ');
        const disp = h('div', { class: 'kp-display keep-size', text: show() });
        const who = h('div', { class: 'kp-who', text: (typed && Contacts.byNumber(typed) || {}).name || '' });
        const pad = h('div', { class: 'kp keep-size' });
        [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']].forEach(([k, l]) => {
          const b = h('button', { html: k + '<small>' + l + '</small>', 'aria-label': k });
          press(b, () => { typed = (typed + k).slice(0, 24); Phone.vibrate(8); disp.textContent = show(); who.textContent = (Contacts.byNumber(typed) || {}).name || ''; }, k === '0' ? () => { typed += '+'; disp.textContent = show(); } : null);
          pad.append(b);
        });
        const call = h('button', { class: 'kp-call', html: icon('phone'), 'aria-label': 'Call' }); call.onclick = () => PhoneApp.call(typed);
        const del = h('button', { class: 'kp-del', html: icon('arrow-left'), 'aria-label': 'Delete' }); del.onclick = () => { typed = typed.slice(0, -1); disp.textContent = show(); who.textContent = (typed && Contacts.byNumber(typed) || {}).name || ''; };
        const add = h('button', { class: 'kp-del', html: icon('plus'), 'aria-label': 'Add to contacts' }); add.onclick = () => typed ? Contacts.edit(w, { id: uid(), name: '', numbers: [typed], email: '', fromPhone: true }, () => w.refresh()) : Shell.toast('Type a number first');
        body.append(disp, who, pad, h('div', { class: 'kp-row keep-size' }, add, call, del));
      } else if (tab === 'recents') {
        const l = PhoneApp.log();
        if (!l.length) body.append(h('div', { class: 'empty-state', html: icon('clock') + '<br>No calls yet.<br><small>Calls you make from Pets OS appear here.</small>' }));
        else { const card = h('div', { class: 'card' }); l.slice(0, 100).forEach(c => { const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { text: c.name || c.number }), h('div', { class: 'sub', text: (c.dir === 'out' ? 'Outgoing' : 'Incoming') + (c.name ? ' · ' + c.number : '') })), h('span', { class: 'val', text: Fmt.ago(c.at) })); press(r, () => PhoneApp.call(c.number, c.name)); card.append(r); }); body.append(card);
          const clr = h('button', { class: 'btn block secondary', text: 'Clear recents' }); clr.onclick = async () => { if (await Dialog.confirm('Clear all recent calls?', null, 'Clear', true)) { Store.setApp('calls', []); w.refresh(); } }; body.append(clr); }
        if (onPhone) body.append(h('p', { class: 'set-note', style: { marginTop: '12px' }, text: 'Shows calls made from Pets OS. The phone\'s own call history stays in Android (Pets OS doesn\'t ask to read it).' }));
      } else if (tab === 'favs') {
        const favs = Contacts.own().filter(c => c.fav);
        if (!favs.length) body.append(h('div', { class: 'empty-state', html: icon('star') + '<br>No favourites yet.<br><small>Open a contact and tap Add favourite.</small>' }));
        else { const card = h('div', { class: 'card' }); favs.forEach(c => { const r = h('div', { class: 'row' }, Contacts.avatar(c, 36), h('div', { class: 'grow' }, h('div', { text: c.name }), h('div', { class: 'sub', text: c.numbers[0] || '' })), h('span', { class: 'chev', html: icon('phone') })); press(r, () => PhoneApp.call(c.numbers[0], c.name)); card.append(r); }); body.append(card); }
      } else Contacts.list(w, body, c => Contacts.detail(w, c));
    };
    const host = () => { bar.innerHTML = ''; tabs.forEach(([k, l, g]) => { const b = h('button', { class: k === tab ? 'on' : '', html: icon(g) + '<span>' + l + '</span>' }); b.onclick = () => { tab = k; w.root(draw); host(); }; bar.append(b); }); };
    host(); w.el.append(bar); w.el.classList.add('has-tabs');
    w.root(draw);
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// ================================================================ Messages
const MessagesApp = {
  w: null,
  data() { return Store.app('messages', {}); },
  save(d) { Store.setApp('messages', d); },
  key(n) { return String(n).replace(/[^\d+]/g, ''); },
  add(number, msg) { const d = this.data(), k = this.key(number); d[k] = (d[k] || []).concat([msg]).slice(-500); this.save(d); },
  can() { return onPhone ? (Perm.telephony() ? (PLAY ? 'handoff' : Perm.has('sms') ? 'direct' : 'ask') : 'none') : (/iPhone|Android/.test(navigator.userAgent) ? 'handoff' : 'none'); },
  async send(number, text) {
    const k = this.key(number); if (!k || !text.trim()) return;
    const msg = { id: uid(), text: text.trim(), at: Date.now(), me: true, status: 'sending' };
    let how = this.can();
    if (how === 'ask') { await Perm.ask('sms'); how = this.can(); }
    if (how === 'direct' && Phone.sendSms(msg.id, k, msg.text)) { msg.status = 'sending'; }
    else if (how === 'none') { msg.status = 'not sent'; Shell.toast(isStephone ? 'The simulator has no phone line: the text is saved but not sent' : 'This device can\'t send texts'); }
    else { msg.status = 'handed to Messages'; Phone.sms(k); }
    this.add(k, msg);
    return msg;
  },
  openThread(number) { if (this.w) this.thread(this.w, number); }
};
PetsOS.smsSent = (id, ok) => {
  const d = MessagesApp.data();
  Object.values(d).forEach(l => l.forEach(m => { if (m.id === id) m.status = ok ? 'sent' : 'failed'; }));
  MessagesApp.save(d);
  const w = MessagesApp.w; if (w && w.stack.length) w.refresh();
  if (!ok) Shell.toast('A text couldn\'t be sent');
};
MessagesApp.thread = function (w, number) {
  const k = this.key(number), c = Contacts.byNumber(k);
  w.push(c ? c.name : k, body => {
    body.classList.add('chat-body');
    const list = h('div', { class: 'chat-list' });
    const msgs = this.data()[k] || [];
    if (!msgs.length) list.append(h('div', { class: 'empty-state', style: { padding: '30px 10px' }, text: 'New conversation with ' + (c ? c.name : k) }));
    msgs.forEach(m => list.append(h('div', { class: 'bubble ' + (m.me ? 'me' : 'them') }, h('div', { text: m.text }), h('small', { text: Fmt.ago(m.at) + (m.me && m.status ? ' · ' + m.status : '') }))));
    const f = h('input', { class: 'field', placeholder: 'Text message', enterkeyhint: 'send' });
    const go = h('button', { class: 'btn', html: icon('send'), 'aria-label': 'Send' });
    const send = async () => { const t = f.value; if (!t.trim()) return; f.value = ''; await MessagesApp.send(k, t); w.refresh(); };
    go.onclick = send; f.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    body.append(list, h('div', { class: 'chat-compose' }, f, go));
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
  });
};
Apps.register({
  id: 'pets:messages', name: 'Messages', glyph: 'message', bg: G.green, cat: 'Phone', keywords: 'sms text chat conversation',
  open(w) {
    MessagesApp.w = w;
    const compose = () => w.push('New Message', body => {
      const to = h('input', { class: 'field', placeholder: 'To: name or number', type: 'text', autocomplete: 'off' });
      const sug = h('div', { class: 'card' });
      to.addEventListener('input', () => { sug.innerHTML = ''; const q = to.value.trim().toLowerCase(); if (!q) return; Contacts.all().filter(c => (c.name || '').toLowerCase().includes(q) && c.numbers[0]).slice(0, 6).forEach(c => { const r = h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { text: c.name }), h('div', { class: 'sub', text: c.numbers[0] }))); press(r, () => { w.back(); MessagesApp.thread(w, c.numbers[0]); }); sug.append(r); }); });
      const next = h('button', { class: 'btn block', text: 'Next' });
      next.onclick = () => { const v = to.value.trim(); const c = Contacts.find(v); const n = c && c.numbers[0] ? c.numbers[0] : v.replace(/[^\d+]/g, ''); if (!n) { Shell.toast('Type a number or a contact\'s name'); return; } w.back(); MessagesApp.thread(w, n); };
      body.append(to, sug, next);
    });
    w.actions([{ icon: 'pencil', label: 'New message', fn: compose }]);
    w.root(body => {
      const how = MessagesApp.can();
      body.append(h('div', { class: 'phone-note', text: how === 'direct' ? 'Texts are sent by this phone.' : how === 'ask' ? 'Pets OS will ask to send texts the first time.' : how === 'handoff' ? 'Texts are handed to your phone\'s Messages app to send.' : (isStephone ? 'Simulator: no phone line. Texts are saved but not sent.' : 'This device can\'t send texts.') }));
      const d = MessagesApp.data(), keys = Object.keys(d).filter(k => d[k].length).sort((a, b) => d[b][d[b].length - 1].at - d[a][d[a].length - 1].at);
      if (!keys.length) { body.append(h('div', { class: 'empty-state', html: icon('message') + '<br>No conversations yet.' })); const b = h('button', { class: 'btn block', text: 'New message' }); b.onclick = compose; body.append(b); }
      else { const card = h('div', { class: 'card' }); keys.forEach(k => { const last = d[k][d[k].length - 1], c = Contacts.byNumber(k); const r = h('div', { class: 'row' }, Contacts.avatar(c || { name: k }, 40), h('div', { class: 'grow' }, h('div', { text: c ? c.name : k }), h('div', { class: 'sub', text: last.text.slice(0, 60) })), h('span', { class: 'val', text: Fmt.ago(last.at) })); press(r, () => MessagesApp.thread(w, k), () => Dialog.menu(c ? c.name : k, null, [{ label: 'Delete conversation', danger: true, fn: () => { const dd = MessagesApp.data(); delete dd[k]; MessagesApp.save(dd); w.refresh(); } }])); card.append(r); }); body.append(card); }
      if (onPhone) body.append(h('p', { class: 'set-note', style: { marginTop: '12px' }, text: 'Shows texts sent from Pets OS. Incoming texts arrive in the phone\'s own Messages app (only the default texting app can receive them) and appear in Pets OS notifications.' }));
    });
    w.onShow = () => { if (!w.stack.length) w.refresh(); };
  }
});

// ================================================================ Camera
const CameraApp = {
  stream: null, facing: 'environment', timer: 0, flash: false,
  stop() { if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; } },
  async start(video, note) {
    this.stop();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { note('This device doesn\'t give Pets OS a camera.'); return false; }
    if (onPhone && !Perm.has('camera')) { if (!(await Perm.ask('camera'))) { note('Pets OS needs the Camera permission to show the viewfinder.'); return false; } }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      video.srcObject = this.stream; await video.play().catch(() => {});
      return true;
    } catch (e) {
      note(e && e.name === 'NotAllowedError' ? 'Camera access was not allowed.' : e && e.name === 'NotFoundError' ? (isStephone ? 'The simulator has no camera. On a real Stephone the viewfinder shows here.' : 'No camera was found on this device.') : 'The camera couldn\'t start (' + (e && e.name || 'error') + ').');
      return false;
    }
  },
  torchOK() { const t = this.stream && this.stream.getVideoTracks()[0]; return !!(t && t.getCapabilities && (t.getCapabilities().torch)); },
  async setTorch(on) { const t = this.stream && this.stream.getVideoTracks()[0]; if (!t) return; try { await t.applyConstraints({ advanced: [{ torch: on }] }); } catch (e) { /* not supported */ } },
  async capture(video) {
    const wv = video.videoWidth, hv = video.videoHeight; if (!wv) return null;
    const c = document.createElement('canvas'); c.width = wv; c.height = hv;
    const g = c.getContext('2d'); if (this.facing === 'user') { g.translate(wv, 0); g.scale(-1, 1); } g.drawImage(video, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    const rec = { id: uid(), blob, w: wv, h: hv, added: Date.now(), name: 'Photo ' + new Date().toLocaleString(), fav: false };
    await Moments.put(rec);
    return rec;
  }
};
Apps.register({
  id: 'pets:camera', name: 'Camera', glyph: 'camera', bg: G.grey, cat: 'Phone', keywords: 'photo picture selfie take',
  open(w) {
    w.header.style.display = 'none'; w.el.classList.add('camera-win');
    Object.assign(w.body.style, { padding: '0', overflow: 'hidden' });
    const video = h('video', { playsinline: true, muted: true, autoplay: true });
    const msg = h('div', { class: 'cam-msg hidden' });
    const flashEl = h('div', { class: 'cam-flash' });
    const count = h('div', { class: 'cam-count hidden' });
    const thumb = h('button', { class: 'cam-thumb', 'aria-label': 'Open Moments' });
    const shutter = h('button', { class: 'cam-shutter', 'aria-label': 'Take photo' });
    const flip = h('button', { class: 'cam-btn', html: icon('rotate'), 'aria-label': 'Switch camera' });
    const torch = h('button', { class: 'cam-btn', html: icon('zap'), 'aria-label': 'Flash' });
    const timerB = h('button', { class: 'cam-btn', html: icon('timer') + '<span>Off</span>', 'aria-label': 'Timer' });
    const fallback = h('button', { class: 'btn', text: onPhone ? 'Use the phone\'s camera app' : 'Take a photo with the device camera' });
    fallback.onclick = () => (Defaults.systemCamera || (() => false))();
    const note = t => { msg.innerHTML = ''; msg.append(h('div', { html: icon('camera') }), h('p', { text: t }), fallback); msg.classList.remove('hidden'); shutter.disabled = true; };
    const showThumb = async () => { try { const all = await Moments.all(); const last = all.sort((a, b) => b.added - a.added)[0]; thumb.style.backgroundImage = last ? 'url(' + URL.createObjectURL(last.blob) + ')' : ''; } catch (e) { /* none */ } };
    const refreshTorch = () => { torch.classList.toggle('hidden', !CameraApp.torchOK()); torch.classList.toggle('on', CameraApp.flash); };
    const run = async () => { msg.classList.add('hidden'); shutter.disabled = false; if (await CameraApp.start(video, note)) { refreshTorch(); video.classList.toggle('mirror', CameraApp.facing === 'user'); } };
    flip.onclick = () => { CameraApp.facing = CameraApp.facing === 'user' ? 'environment' : 'user'; run(); };
    torch.onclick = () => { CameraApp.flash = !CameraApp.flash; CameraApp.setTorch(CameraApp.flash); refreshTorch(); };
    timerB.onclick = () => { CameraApp.timer = { 0: 3, 3: 10, 10: 0 }[CameraApp.timer]; timerB.querySelector('span').textContent = CameraApp.timer ? CameraApp.timer + 's' : 'Off'; timerB.classList.toggle('on', !!CameraApp.timer); };
    thumb.onclick = () => Defaults.open('photos');
    shutter.onclick = async () => {
      if (shutter.disabled) return;
      for (let n = CameraApp.timer; n > 0; n--) { count.textContent = n; count.classList.remove('hidden'); await new Promise(r => setTimeout(r, 1000)); }
      count.classList.add('hidden');
      flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); Phone.vibrate(15);
      const rec = await CameraApp.capture(video);
      if (rec) { Shell.toast('Saved to Moments'); showThumb(); } else Shell.toast('Nothing to capture yet');
    };
    const close = h('button', { class: 'cam-btn cam-close', html: icon('x'), 'aria-label': 'Close camera' }); close.onclick = () => Shell.goHome();
    w.body.append(h('div', { class: 'cam' }, video, flashEl, count, msg, h('div', { class: 'cam-top' }, close, torch, timerB),
      h('div', { class: 'cam-bottom' }, thumb, shutter, flip)));
    w.onShow = () => { run(); showThumb(); };
    w.onHide = () => CameraApp.stop();
    w.onQuit = () => CameraApp.stop();
    run(); showThumb();
  }
});

// ================================================================ Settings › Default Apps
SettingsPageNames.defaults = 'Default Apps';
SettingsIndex.push(['Default Apps', 'defaults', 'default calendar photos browser mail music launcher store phone messages camera contacts notes']);
(orig => { Apps.builtin['pets:settings'].open = function (w) {
  orig.call(this, w);
  Settings.pages.defaults = body => {
    body.append(h('p', { class: 'set-note', style: { margin: '0 6px 14px' }, text: 'The app that opens when Pets OS needs a calendar, the browser, music and so on: from the Dock, Control Centre, widgets and Clarice.' }));
    const card = h('div', { class: 'card' });
    Defaults.roles.forEach(r => {
      const id = Defaults.get(r.id), app = id && Apps.get(id), choices = Defaults.choices(r.id);
      const row = h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: '#5d6680' }, html: icon(r.glyph) }), h('div', { class: 'grow' }, h('div', { text: r.name }), choices.length > 1 ? h('div', { class: 'sub', text: choices.length + ' apps can do this' }) : null), h('span', { class: 'val', text: app ? app.name : 'None' }), choices.length > 1 ? h('span', { class: 'chev', html: icon('chevron-right') }) : null);
      if (choices.length > 1) press(row, () => Dialog.menu(r.name, 'Choose the default app', choices.map(cid => ({ label: (cid === id ? '✓ ' : '') + Apps.get(cid).name + (cid.startsWith('android:') ? ' (Android)' : ''), fn: () => { Defaults.set(r.id, cid); w.refresh(); } }))));
      card.append(row);
    });
    body.append(card);
  };
  const main = Settings.main;
  Settings.main = body => {
    main(body);
    const general = Array.from(body.querySelectorAll('.card')).find(c => /General/.test(c.textContent));
    const card = h('div', { class: 'card' });
    const r = h('div', { class: 'row' }, h('div', { class: 'sq', style: { background: '#3dd6a0' }, html: icon('layout-grid') }), h('div', { class: 'grow', text: 'Default Apps' }), h('span', { class: 'chev', html: icon('chevron-right') }));
    press(r, () => w.push('Default Apps', Settings.pages.defaults)); card.append(r);
    if (general) general.before(card); else body.append(card);
  };
  w.root(Settings.main);
}; })(Apps.builtin['pets:settings'].open);
// Rest shows which apps are defaults.
(orig => { Rest.fill = function (box, q) { orig.call(this, box, q); $$('.app', box).forEach(el => { if (Defaults.isDefault(el.getAttribute('data-id'))) el.classList.add('is-default'); }); }; })(Rest.fill);

// ================================================================ Home Screen and Dock with the new apps
(orig => { Shell.start = function () {
  orig.call(this);
  let changed = false;
  // The Dock's Phone, Messages and Camera are now Pets OS apps.
  S.dock = S.dock.map(id => ({ 'sys:phone': 'pets:phone', 'sys:messages': 'pets:messages', 'sys:camera': 'pets:camera', 'sys:contacts': 'pets:contacts' })[id] || id);
  if (!S.addedPhoneApps) {
    S.addedPhoneApps = true; changed = true;
    const want = ['pets:lenda', 'pets:sonix', 'pets:stepmail', 'pets:contacts'];
    const present = new Set([].concat(...S.home, S.dock));
    want.filter(id => !present.has(id)).forEach(id => { let last = S.home[S.home.length - 1]; if (!last || last.length >= 20) { last = []; S.home.push(last); } last.push(id); });
  }
  if (changed || true) { Store.save(); Shell.buildHome(); }
}; })(Shell.start);
(orig => { Store.defaults = function () { const d = orig.call(this); d.dock = ['pets:rest', 'pets:phone', 'pets:messages', 'pets:camera']; return d; }; })(Store.defaults);

window.Defaults = Defaults; window.Contacts = Contacts; window.PhoneApp = PhoneApp; window.MessagesApp = MessagesApp; window.CameraApp = CameraApp;
