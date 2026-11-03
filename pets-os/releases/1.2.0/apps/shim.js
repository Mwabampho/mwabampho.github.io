// window.shouldbe for the owner's desktop apps when they run inside Pets OS for Stephone.
// The desktop shell (Electron) gives these pages store/fs/dialog/invoke backed by Node.js; here the same
// calls are answered by phone storage (localStorage + IndexedDB) and Pets OS. Each app's invoke handlers
// are ports of its node/main.js. Anything a phone can't do says so with a clear error.
(function () {
  'use strict';
  const me = document.currentScript, APP = (me && me.getAttribute('data-app')) || location.pathname.split('/').slice(-2)[0];
  const P = 'petsos.desk.' + APP + '.';
  const parentOS = (() => { try { return window.parent !== window && window.parent.Shell ? window.parent : null; } catch (e) { return null; } })();
  const jget = (k, d) => { try { const v = localStorage.getItem(P + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { throw new Error('The phone storage is full.'); } };
  const nope = what => () => Promise.reject(new Error(what + ' isn\'t available on the phone yet.'));

  // ---- IndexedDB blobs (recordings, attachments)
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('petsos-desk-' + APP, 1); r.onupgradeneeded = () => r.result.createObjectStore('b'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const blobPut = async (k, v) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('b', 'readwrite'); t.objectStore('b').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); };
  const blobGet = async k => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('b'); const q = t.objectStore('b').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
  const blobDel = async k => { const db = await idb(); return new Promise(res => { const t = db.transaction('b', 'readwrite'); t.objectStore('b').delete(k); t.oncomplete = () => res(); }); };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).toUpperCase();
  const b64 = { from: u8 => { let s = ''; for (let i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768)); return btoa(s); }, to: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };

  const H = {};

  // ================================================================ Lenda (calendar)
  H.lenda = {
    'lenda:load': () => { const doc = jget('calendar', null); return doc && Array.isArray(doc.events) && Array.isArray(doc.tasks) ? { doc } : { doc: { events: [], tasks: [] } }; },
    'lenda:save': text => { if (typeof text !== 'string') throw new Error('bad data'); jset('calendar', JSON.parse(text)); return true; },
    // Connected apps: on the phone these are Pets OS apps, not Mac apps.
    'lenda:installed': names => { const out = {}; (names || []).forEach(n => { out[n] = !!(parentOS && parentOS.Apps.all().some(a => a.name.toLowerCase() === String(n).toLowerCase())); }); return out; },
    'lenda:george': q => { if (typeof q !== 'string' || q.length > 10000) throw new Error('Input too long'); return window.LendaGeorge ? window.LendaGeorge.matchGeorgeIntent(q) : null; }
  };

  // ================================================================ Sonix (music): Studio takes in IndexedDB
  H.sonix = {
    'studio.folder': () => 'Pets OS › Sonix Studio',
    'studio.saveTake': async bytes => { const name = 'Take ' + new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19) + '.wav'; await blobPut('take:' + name, bytes); const l = jget('takes', []); l.unshift(name); jset('takes', l.slice(0, 200)); return name; },
    'studio.readTake': async p => { const v = await blobGet('take:' + p); if (!v) throw new Error('That take is no longer on this phone.'); return v; },
    'studio.reveal': () => { if (parentOS) parentOS.Shell.toast('Sonix takes are kept inside Pets OS on this phone'); return true; },
    'studio.saveProject': () => { throw new Error('Saving Studio projects to a file isn\'t available on the phone yet.'); },
    'studio.readProject': () => { throw new Error('Opening Studio projects from a file isn\'t available on the phone yet.'); }
  };

  // ================================================================ StepMail (on-phone mailbox + server)
  const DOMAIN = 'stepmail.media', FOLDERS = ['inbox', 'starred', 'sent', 'drafts', 'archive', 'spam', 'trash'];
  const str = (v, max = 100000) => typeof v !== 'string' ? '' : v.length > max ? v.slice(0, max) : v;
  const int = v => { const n = Number(v); if (!Number.isInteger(n)) throw new Error('Invalid id.'); return n; };
  const now = () => Math.floor(Date.now() / 1000);
  const bare = v => { const t = String(v).trim(), o = t.lastIndexOf('<'), c = t.lastIndexOf('>'); return o >= 0 && c > o ? t.slice(o + 1, c).trim().toLowerCase() : t.replace(/^["' ]+|["' ]+$/g, '').toLowerCase(); };
  const addresses = f => String(f || '').split(/[,;\n]/).map(bare).filter(Boolean);
  // PBKDF2-SHA256 in StepMail's own format: pbkdf2_sha256$<iterations>$<salt b64>$<digest b64>
  const ITER = 240000;
  async function pbkdf2(pw, salt, iter, len) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']); return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, k, len * 8)); }
  async function hashPassword(pw) { const salt = crypto.getRandomValues(new Uint8Array(16)); return 'pbkdf2_sha256$' + ITER + '$' + b64.from(salt) + '$' + b64.from(await pbkdf2(pw, salt, ITER, 32)); }
  async function verifyPassword(pw, enc) { const p = String(enc || '').split('$'); if (p.length !== 4 || p[0] !== 'pbkdf2_sha256') return false; const want = b64.to(p[3]); const got = await pbkdf2(pw, b64.to(p[2]), +p[1], want.length); return got.length === want.length && got.every((x, i) => x === want[i]); }
  const secrets = { get: k => jget('secret:' + k, null), set: (k, v) => jset('secret:' + k, v), delete: k => localStorage.removeItem(P + 'secret:' + k) };
  const pwKey = e => 'password:' + String(e).toLowerCase();
  const S = () => jget('native-store', { accounts: [], messages: [], nextAccountID: 1, nextMessageID: 1, nextAttachmentID: 1 });
  let state = S();
  const persist = () => jset('native-store', state);
  const byEmail = e => state.accounts.find(a => a.email.toLowerCase() === String(e).toLowerCase());
  const byIdentity = v => { v = String(v).trim().toLowerCase(); return state.accounts.find(a => a.email.toLowerCase() === v || a.handle.toLowerCase() === v); };
  const matches = (m, f) => f === 'starred' ? m.is_starred && m.folder !== 'trash' && m.folder !== 'spam' : m.folder === f;
  const takeAtt = () => { const id = state.nextAttachmentID || 1; state.nextAttachmentID = id + 1; return id; };
  const newMsg = (owner, folder, sender, recipient, subject, body, read, id) => ({ id: id == null ? state.nextMessageID++ : id, owner_user_id: owner, folder, sender, recipient, subject, body_text: body, body_html: null, is_read: read, created_at: now() });
  const storeAtts = async list => Promise.all((list || []).map(async a => { const name = uuid() + '-' + str(a.filename, 255).replace(/[/\\]/g, '_'); await blobPut('att:' + name, str(a.data, 40 * 1024 * 1024)); return { id: takeAtt(), filename: str(a.filename, 255), content_type: str(a.contentType, 255) || 'application/octet-stream', size: Math.floor(str(a.data).length * 3 / 4), created_at: now(), stored_name: name }; }));
  const removeUnref = async atts => { const used = new Set(state.messages.flatMap(m => m.attachments || []).map(a => a.stored_name)); for (const n of new Set(atts.map(a => a.stored_name).filter(Boolean))) if (!used.has(n)) await blobDel('att:' + n); };
  const outgoing = o => ({ draftID: o && o.draftID != null ? int(o.draftID) : null, to: str(o && o.to, 4000), cc: str(o && o.cc, 4000), bcc: str(o && o.bcc, 4000), subject: str(o && o.subject, 1000), body: str(o && o.body, 2000000), inReplyTo: str(o && o.inReplyTo, 998), references: str(o && o.references, 4000), attachments: Array.isArray(o && o.attachments) ? o.attachments.slice(0, 100) : [] });
  const own = (id, owner) => state.messages.findIndex(m => m.id === int(id) && m.owner_user_id === int(owner));
  const pub = a => ({ id: a.id, email: a.email, handle: a.handle, displayName: a.displayName });
  const local = {
    hasAccounts: () => state.accounts.length > 0,
    account: a => { const x = byIdentity(a.email); return x ? pub(x) : null; },
    createAccount: async a => {
      if (String(a.password || '').length < 10) throw new Error('Use a password with at least 10 characters.');
      const handle = str(a.handle, 100).trim().toLowerCase();
      if (!(handle.length >= 3 && handle.length <= 32 && /^[a-z0-9._-]+$/.test(handle) && !/^[._-]|[._-]$/.test(handle))) throw new Error('Use 3–32 letters, numbers, dots, dashes or underscores for your StepMail name.');
      const email = handle + '@' + DOMAIN;
      if (byEmail(email)) throw new Error('That @' + DOMAIN + ' address already exists on this phone.');
      const acc = { id: state.nextAccountID++, email, handle, displayName: str(a.displayName, 200).trim() || handle };
      state.accounts.push(acc);
      state.messages.push(newMsg(acc.id, 'inbox', 'welcome@' + DOMAIN, email, 'Welcome to StepMail', 'Your StepMail mailbox on this phone is ready.\n\nMail between StepMail accounts on this phone is delivered instantly. To send and receive internet mail, sign in to a StepMail server from the sign-in screen.', false));
      persist(); secrets.set(pwKey(email), await hashPassword(String(a.password)));
      return pub(acc);
    },
    login: async a => { const x = byIdentity(str(a.identity, 300)); if (!x || !(await verifyPassword(String(a.password), secrets.get(pwKey(x.email))))) throw new Error('The email/username or password is incorrect.'); return pub(x); },
    changePassword: async a => { if (!(await verifyPassword(String(a.current), secrets.get(pwKey(a.email))))) throw new Error('The email/username or password is incorrect.'); if (String(a.new || '').length < 10) throw new Error('Use a password with at least 10 characters.'); secrets.set(pwKey(a.email), await hashPassword(String(a.new))); return true; },
    deleteAccount: async a => { if (!(await verifyPassword(String(a.password), secrets.get(pwKey(a.email))))) throw new Error('The email/username or password is incorrect.'); const x = byEmail(a.email); if (x) { const rm = state.messages.filter(m => m.owner_user_id === x.id); state.messages = state.messages.filter(m => m.owner_user_id !== x.id); state.accounts = state.accounts.filter(y => y.id !== x.id); persist(); await removeUnref(rm.flatMap(m => m.attachments || [])); } secrets.delete(pwKey(a.email)); return true; },
    messages: a => { if (!FOLDERS.includes(a.folder)) throw new Error('Unknown folder.'); const q = str(a.query, 200).trim().toLowerCase(); let l = state.messages.filter(m => m.owner_user_id === int(a.ownerID) && matches(m, a.folder)).sort((x, y) => y.created_at - x.created_at || y.id - x.id); if (q) l = l.filter(m => [m.subject, m.sender, m.recipient, m.cc || '', m.body_text].some(f => String(f).toLowerCase().includes(q))); return l; },
    message: a => { const i = own(a.id, a.ownerID); if (i < 0) throw new Error('That message no longer exists.'); return state.messages[i]; },
    counts: a => { const out = {}; FOLDERS.forEach(f => { const l = state.messages.filter(m => m.owner_user_id === int(a.ownerID) && matches(m, f)); out[f] = { total: l.length, unread: l.filter(m => !m.is_read).length }; }); return out; },
    send: async a => {
      const o = outgoing(a.message), me2 = byEmail(a.user && a.user.email);
      if (!me2 || me2.id !== int(a.user.id)) throw new Error('Not signed in.');
      const all = [...addresses(o.to), ...addresses(o.cc), ...addresses(o.bcc)];
      const ext = all.filter(x => !x.endsWith('@' + DOMAIN)); if (ext.length) throw new Error(ext.join(', ') + ' is outside this phone. Sending internet mail requires signing in to a StepMail server.');
      const missing = all.filter(x => !byEmail(x)); if (missing.length) throw new Error('No StepMail mailbox exists for ' + missing.join(', ') + '.');
      const mid = '<' + uuid().toLowerCase() + '@' + DOMAIN + '>', stored = await storeAtts(o.attachments);
      const toL = addresses(o.to).join(', '), ccL = addresses(o.cc).join(', '), bccL = addresses(o.bcc).join(', ');
      [...new Set(all)].forEach(addr => { const t = byEmail(addr); if (!t) return; const c = newMsg(t.id, 'inbox', me2.displayName + ' <' + me2.email + '>', toL, o.subject, o.body, false); Object.assign(c, { cc: ccL, message_id: mid, in_reply_to: o.inReplyTo, references_header: o.references, attachments: stored.map(x => Object.assign({}, x, { id: takeAtt() })), attachments_count: stored.length, external_status: 'delivered' }); state.messages.push(c); });
      const sent = newMsg(me2.id, 'sent', me2.email, toL, o.subject, o.body, true);
      Object.assign(sent, { cc: ccL, bcc: bccL, message_id: mid, in_reply_to: o.inReplyTo, references_header: o.references, attachments: stored, attachments_count: stored.length, external_status: 'delivered on this phone' });
      state.messages.push(sent);
      if (o.draftID != null) state.messages = state.messages.filter(m => !(m.id === o.draftID && m.owner_user_id === me2.id && m.folder === 'drafts'));
      persist(); return 'delivered on this phone';
    },
    saveDraft: async a => { const o = outgoing(a.message), owner = int(a.ownerID); if (o.draftID != null) { const i = state.messages.findIndex(m => m.id === o.draftID && m.owner_user_id === owner); if (i >= 0) { const [old] = state.messages.splice(i, 1); await removeUnref(old.attachments || []); } } const d = newMsg(owner, 'drafts', str(a.sender, 300), o.to, o.subject, o.body, true, o.draftID == null ? undefined : o.draftID); Object.assign(d, { cc: o.cc, bcc: o.bcc, in_reply_to: o.inReplyTo, references_header: o.references }); d.attachments = await storeAtts(o.attachments); d.attachments_count = d.attachments.length; state.messages.push(d); persist(); return d.id; },
    setRead: a => { const i = own(a.id, a.ownerID); if (i >= 0) { state.messages[i].is_read = !!a.read; persist(); } },
    setStarred: a => { const i = own(a.id, a.ownerID); if (i >= 0) { state.messages[i].is_starred = !!a.starred; persist(); } },
    move: a => { if (!FOLDERS.includes(a.folder) || a.folder === 'starred') throw new Error('Unknown folder.'); const i = own(a.id, a.ownerID); if (i >= 0) { state.messages[i].folder = a.folder; persist(); } },
    delete: async a => { const rm = state.messages.filter(m => m.id === int(a.id) && m.owner_user_id === int(a.ownerID)); state.messages = state.messages.filter(m => !(m.id === int(a.id) && m.owner_user_id === int(a.ownerID))); persist(); await removeUnref(rm.flatMap(m => m.attachments || [])); },
    attachmentData: async a => { const v = await blobGet('att:' + str(a.stored_name, 400)); if (v == null) throw new Error('The attachment file could not be found.'); return v; }
  };
  H.stepmail = {
    // Server mode: the page talks to a StepMail server. In a phone browser that needs the server to allow
    // Pets OS (CORS); the stepmail.media server isn't online yet, so this reports the real network error.
    http: async req => {
      const method = String((req && req.method) || 'GET').toUpperCase();
      let url; try { url = new URL(String(req && req.url || '')); } catch (e) { return { error: 'The StepMail server address is not a valid URL.', invalidURL: true }; }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'The StepMail server address is not a valid URL.', invalidURL: true };
      const headers = { Accept: 'application/json' };
      Object.entries((req && req.headers) || {}).forEach(([k, v]) => { if (/^(authorization|content-type)$/i.test(k)) headers[k] = String(v); });
      try {
        const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 30000);
        const r = await fetch(url, { method, headers, body: req.body == null ? undefined : String(req.body), signal: ac.signal }); clearTimeout(t);
        const buf = new Uint8Array(await r.arrayBuffer());
        return { status: r.status, contentType: r.headers.get('content-type') || '', text: req.binary ? undefined : new TextDecoder().decode(buf), base64: req.binary ? b64.from(buf) : undefined };
      } catch (e) { return { error: navigator.onLine ? 'Could not connect to the server. (The StepMail server must be online and allow Pets OS.)' : 'The Internet connection appears to be offline.' }; }
    },
    local: (op, args) => { if (!local[op]) throw new Error('Unknown operation.'); return local[op](args || {}); },
    secret: (op, key, value) => { const k = str(key, 1000); if (!/^session:/.test(k)) throw new Error('Not allowed.'); if (op === 'get') return secrets.get(k); if (op === 'set') { secrets.set(k, str(value, 4000)); return true; } if (op === 'delete') { secrets.delete(k); return true; } throw new Error('Unknown operation.'); },
    openAttachment: (id, filename, base64) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([b64.to(base64)])); a.download = String(filename || 'attachment'); document.body.appendChild(a); a.click(); a.remove(); return true; }
  };

  window.shouldbe = {
    desktop: false, phone: true, platform: 'petsos',
    info: async () => ({ app: APP, platform: 'Pets OS for Stephone', version: (parentOS && parentOS.PETS_VERSION) || '' }),
    store: { get: async k => jget('store:' + k, null), set: async (k, v) => { jset('store:' + k, v); return true; } },
    openExternal: async u => { if (parentOS) parentOS.Phone.openUrl(String(u)); else window.open(String(u), '_blank'); return true; },
    showItem: nope('Showing files'),
    dialog: { open: nope('Opening files'), save: nope('Saving files') },
    fs: { readText: nope('Reading files'), writeText: nope('Writing files'), readBytes: nope('Reading files'), writeBytes: nope('Writing files') },
    invoke: async (ch, ...a) => { const h = (H[APP] || {})[ch]; if (!h) throw new Error(ch + ' isn\'t available on the phone.'); return h(...a); }
  };
})();
