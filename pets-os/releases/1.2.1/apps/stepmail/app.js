// StepMail 1.8.1 for Windows and Linux — a port of the Mac app's SwiftUI client
// (SessionStore.swift, MailBackend.swift, Views.swift). Two kinds of account, as on the Mac:
//   "StepMail server" — the StepMail REST API (default https://api.stepmail.media, changeable);
//   "This phone only" — an on-device mailbox kept in the app's data folder (node/main.js).
import { icon } from "./icons.js";

const SB = window.shouldbe;
const DOMAIN = "stepmail.media";
const DEFAULT_SERVER = "https://api.stepmail.media";
const REFRESH_SECONDS = 30;
const IS_MAC = /Mac/.test(navigator.platform);
const FOLDERS = [
  { key: "inbox", title: "Inbox", icon: "tray" },
  { key: "starred", title: "Starred", icon: "star" },
  { key: "sent", title: "Sent", icon: "paperplane" },
  { key: "drafts", title: "Drafts", icon: "doc" },
  { key: "archive", title: "Archive", icon: "archivebox" },
  { key: "spam", title: "Spam", icon: "octagon" },
  { key: "trash", title: "Trash", icon: "trash" },
];
const folderInfo = (k) => FOLDERS.find((f) => f.key === k) || FOLDERS[4];
const isMoveTarget = (k) => k !== "starred" && k !== "drafts" && k !== "sent";
const msgFolder = (m) => (FOLDERS.some((f) => f.key === m.folder) ? m.folder : "archive");

// ---------------------------------------------------------------- helpers
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "value") el.value = v;
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const ico = (name, cls = "") => h("span", { class: `ico ${cls}`, "aria-hidden": "true", html: icon(name) });
const cleanErr = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function toB64(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
}
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const b64Size = (b) => Math.floor((b.length * 3) / 4) - (b.endsWith("==") ? 2 : b.endsWith("=") ? 1 : 0);
function formatSize(n) {
  if (n < 1000) return `${n} bytes`;
  const units = ["KB", "MB", "GB"];
  let v = n, i = -1;
  do { v /= 1000; i++; } while (v >= 1000 && i < units.length - 1);
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
const fmtTime = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const fmtAbbrev = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const fmtLong = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
const fmtComplete = (d) => `${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} at ${fmtTime(d)}`;
function shortDate(d) {
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return fmtTime(d);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return fmtAbbrev(d);
}
const mdate = (m) => new Date(m.created_at * 1000);

// StepMailService
function isValidEmail(value) {
  const t = value.trim();
  const at = t.lastIndexOf("@");
  if (t.length > 254 || at < 0) return false;
  const local = t.slice(0, at), dom = t.slice(at + 1);
  return !!local && !!dom && dom.includes(".") && !dom.endsWith(".") && !/[ <>]/.test(t) && t.split("@").length === 2;
}
function bareAddress(value) {
  const t = String(value).trim();
  const open = t.lastIndexOf("<"), close = t.lastIndexOf(">");
  if (open >= 0 && close > open) return t.slice(open + 1, close).trim().toLowerCase();
  return t.replace(/^["' ]+|["' ]+$/g, "").toLowerCase();
}
const addresses = (field) => String(field || "").split(/[,;\n]/).map(bareAddress).filter(Boolean);
function displayName(value) {
  const t = String(value).trim();
  const open = t.lastIndexOf("<");
  if (open > 0) {
    const name = t.slice(0, open).replace(/^[" ]+|[" ]+$/g, "");
    if (name) return name;
  }
  return bareAddress(t);
}
const invalidAddresses = (field) => addresses(field).filter((a) => !isValidEmail(a));
function htmlToText(html) {
  try { return new DOMParser().parseFromString(html, "text/html").body.innerText || ""; } catch { return html.replace(/<[^>]+>/g, ""); }
}
const displayText = (m) => (m.body_text && m.body_text.trim() ? m.body_text : m.body_html ? htmlToText(m.body_html) : "");
function preview(m) {
  const t = displayText(m).replace(/[\r\n]/g, " ").trim();
  return t ? t.slice(0, 240) : "No message preview";
}
const hasAttachments = (m) => (m.attachments_count ?? m.attachments?.length ?? 0) > 0;
const MIME = { txt: "text/plain", html: "text/html", htm: "text/html", csv: "text/csv", pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", heic: "image/heic", svg: "image/svg+xml", zip: "application/zip", json: "application/json", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", mp4: "video/mp4", mov: "video/quicktime", rtf: "application/rtf", ics: "text/calendar", vcf: "text/vcard", eml: "message/rfc822" };
const contentType = (name) => MIME[(name.split(".").pop() || "").toLowerCase()] || "application/octet-stream";

// ReplyBuilder
const prefixed = (p, s) => (s.toLowerCase().startsWith(p.toLowerCase()) ? s : `${p} ${s}`);
const blankOutgoing = () => ({ uid: Math.random().toString(36).slice(2), draftID: null, to: "", cc: "", bcc: "", subject: "", body: "", inReplyTo: "", references: "", attachments: [] });
function quoted(m) {
  const d = mdate(m);
  return `On ${fmtAbbrev(d)} at ${fmtTime(d)}, ${m.sender} wrote:\n` + displayText(m).split(/\r?\n/).map((l) => "> " + l).join("\n");
}
function buildReply(m, me, all) {
  const out = blankOutgoing();
  const from = bareAddress(m.sender);
  const mine = me.toLowerCase();
  if (msgFolder(m) === "sent") {
    out.to = m.recipient;
    if (all) out.cc = m.cc || "";
  } else {
    out.to = from;
    if (all) out.cc = [...new Set([...addresses(m.recipient), ...addresses(m.cc || "")].filter((a) => a !== mine && a !== from))].join(", ");
  }
  out.subject = prefixed("Re:", m.subject);
  out.inReplyTo = m.message_id || "";
  out.references = [m.references_header || "", m.message_id || ""].filter(Boolean).join(" ");
  out.body = "\n\n" + quoted(m);
  return out;
}
function buildForward(m, attachments) {
  const out = blankOutgoing();
  out.subject = prefixed("Fwd:", m.subject);
  let head = "\n\n---------- Forwarded message ----------\n";
  head += `From: ${m.sender}\nDate: ${fmtLong(mdate(m))} at ${fmtTime(mdate(m))}\nSubject: ${m.subject}\nTo: ${m.recipient}\n`;
  if (m.cc) head += `Cc: ${m.cc}\n`;
  out.body = head + "\n" + displayText(m);
  out.attachments = attachments;
  return out;
}
function buildEditDraft(m) {
  return { ...blankOutgoing(), draftID: m.id, to: m.recipient, cc: m.cc || "", bcc: m.bcc || "", subject: m.subject, body: m.body_text, inReplyTo: m.in_reply_to || "", references: m.references_header || "" };
}
const sameOutgoing = (a, b) => !!a && !!b && ["draftID", "to", "cc", "bcc", "subject", "body", "inReplyTo", "references"].every((k) => (a[k] ?? null) === (b[k] ?? null)) && a.attachments.map((x) => x.id).join() === b.attachments.map((x) => x.id).join();
const outgoingEmpty = (o) => !o.to && !o.cc && !o.bcc && !o.subject && !o.body.trim() && !o.attachments.length;

// ---------------------------------------------------------------- server API (StepMailAPI)
class ClientError extends Error {
  constructor(kind, message, status = 0, code = "") {
    super(message);
    Object.assign(this, { kind, status, code });
  }
  get unauthorized() { return this.kind === "server" && this.status === 401 && this.code === "unauthorized"; }
}
function normalizeURL(text) {
  let t = String(text).trim();
  while (t.endsWith("/")) t = t.slice(0, -1);
  return t;
}
function validServerURL(text) {
  try {
    const u = new URL(normalizeURL(text));
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch { return false; }
}
function makeAPI(serverURL, token) {
  const base = normalizeURL(serverURL);
  if (!validServerURL(base)) throw new ClientError("invalid", "The StepMail server address is not a valid URL.");
  const api = {
    token,
    async raw(path, { method = "GET", body, binary } = {}) {
      const headers = {};
      if (api.token) headers.Authorization = `Bearer ${api.token}`;
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const r = await SB.invoke("http", { method, url: base + path, headers, body: body === undefined ? undefined : JSON.stringify(body), binary });
      if (r.error) throw new ClientError("unreachable", `Can't reach the StepMail server. ${r.error}`);
      if (r.status < 200 || r.status > 299) {
        let message = `The server returned HTTP ${r.status}.`, code = "";
        try {
          const o = JSON.parse(r.text || "");
          code = typeof o.error === "string" ? o.error : "";
          message = (typeof o.message === "string" && o.message) || code || message;
        } catch {}
        throw new ClientError("server", message, r.status, code);
      }
      return r;
    },
    async request(path, opts) {
      const r = await api.raw(path, opts);
      try { return JSON.parse(r.text); } catch { throw new ClientError("server", "Unexpected response from the StepMail server.", 200); }
    },
    status: () => api.request("/api/status"),
    login: (identity, password, otp) => api.request("/v1/login", { method: "POST", body: otp ? { identity, password, otp } : { identity, password } }),
    register: (handle, displayName, password) => api.request("/api/register", { method: "POST", body: { handle, displayName, password } }),
    recover: (identity, recoveryCode, newPassword) => api.request("/v1/account/recover", { method: "POST", body: { identity, recoveryCode, newPassword } }),
    me: async () => (await api.request("/api/me")).user,
  };
  return api;
}
const okReq = async (p) => { await p; };
const outgoingBody = (o) => ({
  to: o.to, cc: o.cc, bcc: o.bcc, subject: o.subject, text: o.body, inReplyTo: o.inReplyTo, references: o.references,
  attachments: o.attachments.map((a) => ({ filename: a.filename, content_type: a.contentType, data: a.data })),
});
function remoteBackend(api, user) {
  const pct = encodeURIComponent;
  return {
    isRemote: true, user, api,
    async messages(folder, query) {
      let p = `/api/messages?folder=${folder}`;
      if (query.trim()) p += `&q=${pct(query.trim())}`;
      return (await api.request(p)).messages;
    },
    message: async (id) => (await api.request(`/api/messages/${id}`)).message,
    folderCounts: async () => (await api.request("/api/folders")).folders,
    async send(o) {
      const body = outgoingBody(o);
      if (o.draftID != null) body.draftId = o.draftID;
      return (await api.request("/api/send", { method: "POST", body })).status;
    },
    async saveDraft(o) {
      const body = outgoingBody(o);
      if (o.draftID != null) body.id = o.draftID;
      return (await api.request("/api/draft", { method: "POST", body })).id;
    },
    setRead: (id, read) => okReq(api.request(`/api/messages/${id}/read`, { method: "POST", body: { read } })),
    move: (id, folder) => okReq(api.request(`/api/messages/${id}/move`, { method: "POST", body: { folder } })),
    delete: (id) => okReq(api.request(`/api/messages/${id}`, { method: "DELETE" })),
    setStarred: (id, starred) => okReq(api.request(`/v1/messages/${id}/star`, { method: "POST", body: { starred } })),
    markSpam: (id, spam) => okReq(api.request(`/v1/messages/${id}/spam`, { method: "POST", body: { spam } })),
    restore: (id) => okReq(api.request(`/v1/messages/${id}/restore`, { method: "POST", body: {} })),
    emptyTrash: () => okReq(api.request("/v1/folders/trash/empty", { method: "POST", body: {} })),
    attachmentData: async (a) => (await api.raw(`/api/attachments/${a.id}`, { binary: true })).base64,
    changePassword: (current, next) => okReq(api.request("/api/account/password", { method: "POST", body: { currentPassword: current, newPassword: next } })),
    deleteAccount: (password) => okReq(api.request("/api/account", { method: "DELETE", body: { password } })),
    signOut: async () => { try { await api.raw("/api/logout", { method: "POST" }); } catch {} },
    settings: () => api.request("/v1/account/settings"),
    saveProfile: (displayName, signature) => okReq(api.request("/v1/account/profile", { method: "POST", body: { displayName, signature } })),
    sessions: async () => (await api.request("/v1/account/sessions")).sessions,
    revokeSession: (id) => okReq(api.request(`/v1/account/sessions/${pct(id)}`, { method: "DELETE" })),
    securityLog: async () => (await api.request("/v1/account/security-log")).events,
    newRecoveryCodes: async (password) => (await api.request("/v1/account/recovery-codes", { method: "POST", body: { password } })).recoveryCodes,
    setupTwoFactor: (password) => api.request("/v1/account/2fa/setup", { method: "POST", body: { password } }),
    enableTwoFactor: (code) => okReq(api.request("/v1/account/2fa/enable", { method: "POST", body: { code } })),
    disableTwoFactor: (password, code) => okReq(api.request("/v1/account/2fa/disable", { method: "POST", body: { password, code } })),
    appPasswords: async () => (await api.request("/v1/account/app-passwords")).appPasswords,
    createAppPassword: async (name) => (await api.request("/v1/account/app-passwords", { method: "POST", body: { name } })).password,
    deleteAppPassword: (id) => okReq(api.request(`/v1/account/app-passwords/${id}`, { method: "DELETE" })),
    dnsConfig: () => api.request("/api/admin/dns-config"),
    diagnostics: () => api.request("/api/admin/diagnostics"),
    relayConfig: () => api.request("/api/admin/relay-config"),
    saveRelay: (host, port, user, pass, security) => okReq(api.request("/api/admin/relay-config", { method: "POST", body: { host, port, user, pass, security } })),
    retryQueue: () => okReq(api.request("/api/admin/retry-queue", { method: "POST" })),
  };
}
const local = (op, args) => SB.invoke("local", op, args);
function localBackend(user) {
  const o = { ownerID: user.id };
  const plain = (x) => ({ ...x, attachments: x.attachments.map(({ filename, contentType, data }) => ({ filename, contentType, data })) });
  return {
    isRemote: false, user,
    messages: (folder, query) => local("messages", { ...o, folder, query }),
    message: (id) => local("message", { ...o, id }),
    folderCounts: () => local("counts", o),
    send: (m) => local("send", { message: plain(m), user }),
    saveDraft: (m) => local("saveDraft", { ...o, message: plain(m), sender: user.email }),
    setRead: (id, read) => local("setRead", { ...o, id, read }),
    move: (id, folder) => local("move", { ...o, id, folder }),
    setStarred: (id, starred) => local("setStarred", { ...o, id, starred }),
    markSpam: (id, spam) => local("move", { ...o, id, folder: spam ? "spam" : "inbox" }),
    restore: (id) => local("move", { ...o, id, folder: "inbox" }),
    delete: (id) => local("delete", { ...o, id }),
    attachmentData: (a) => local("attachmentData", { stored_name: a.stored_name }),
    changePassword: (current, next) => local("changePassword", { email: user.email, current, new: next }),
    deleteAccount: (password) => local("deleteAccount", { email: user.email, password }),
    signOut: async () => {},
  };
}

// ---------------------------------------------------------------- session (SessionStore)
const S = {
  booted: false, mode: "server", serverURL: DEFAULT_SERVER, serverStatus: null, serverReachable: null,
  user: null, backend: null, messages: [], counts: {}, folder: "inbox", selected: null, search: "",
  busy: false, notice: null, error: null, compose: null, lastRefresh: null, recoveryCodes: null, signature: "",
  needsOTP: false, sessions: [], events: [], appPasswords: [], twoFactorSetup: null, newAppPassword: null,
  dnsRecords: [], diagnostics: {}, relay: null, settingsOpen: false,
  welcome: { creating: false, recovering: false, identity: "", handle: "", name: "", password: "", otp: "", code: "", server: "" },
};
let pollTimer = null, searchTimer = null, noticeTimer = null;
const isRemote = () => S.backend?.isRemote === true;
const isAdmin = () => S.user?.isAdmin === true && isRemote();
const tokenKey = (email) => `session:${S.serverURL.toLowerCase()}|${email.toLowerCase()}`;
const secret = (op, k, v) => SB.invoke("secret", op, k, v);
const signatureBlock = () => (S.signature ? "\n\n-- \n" + S.signature : "");

async function bootstrap() {
  S.mode = (await SB.store.get("accountMode")) === "local" ? "local" : "server";
  S.serverURL = (await SB.store.get("serverURL")) || DEFAULT_SERVER;
  const email = await SB.store.get("activeUserEmail");
  if (S.mode === "server") {
    const check = checkServer();
    const token = email ? await secret("get", tokenKey(email)) : null;
    if (email && token) {
      let api;
      try { api = makeAPI(S.serverURL, token); } catch {}
      if (api) {
        try {
          activate(remoteBackend(api, await api.me()));
        } catch (e) {
          if (e.unauthorized) await secret("delete", tokenKey(email));
          else {
            const cached = await SB.store.get(`cachedUser:${email.toLowerCase()}`);
            if (cached) activate(remoteBackend(api, cached));
          }
        }
      }
    }
    void check;
  } else if (email) {
    const acct = await local("account", { email });
    if (acct) activate(localBackend({ ...acct, isAdmin: false }));
  }
  if (S.mode === "local" && !S.user && !(await local("hasAccounts"))) S.welcome.creating = true;
  S.welcome.server = S.serverURL;
  S.booted = true;
  render();
}

async function setMode(mode) {
  S.mode = mode;
  await SB.store.set("accountMode", mode);
  if (mode === "local" && !(await local("hasAccounts"))) S.welcome.creating = true;
  if (mode === "local") S.welcome.recovering = false;
  render();
  if (mode === "server") checkServer();
}
async function setServerURL(url) {
  const t = normalizeURL(url);
  S.serverURL = t || DEFAULT_SERVER;
  S.welcome.server = S.serverURL;
  await SB.store.set("serverURL", S.serverURL);
  await checkServer();
}
let checkSeq = 0;
async function checkServer() {
  const seq = ++checkSeq;
  S.serverReachable = null;
  renderBadges();
  let reachable = false, status = null;
  try {
    status = await makeAPI(S.serverURL).status();
    reachable = true;
  } catch { status = null; }
  if (seq !== checkSeq) return;
  S.serverStatus = status;
  S.serverReachable = reachable;
  renderBadges();
  if (S.settingsOpen) renderSettings();
}

async function login(identity, password, otp) {
  await run(async () => {
    if (S.mode === "server") {
      const api = makeAPI(S.serverURL);
      let res;
      try {
        res = await api.login(identity.trim(), password, otp);
      } catch (e) {
        if (e.code === "otp_required") { S.needsOTP = true; renderWelcome(); return; }
        throw e;
      }
      S.needsOTP = false;
      await startRemoteSession(api, res.token, res.user);
    } else {
      const acct = await local("login", { identity, password });
      await SB.store.set("activeUserEmail", acct.email);
      activate(localBackend({ ...acct, isAdmin: false }));
    }
  });
}
async function register(handle, name, password) {
  await run(async () => {
    if (password.length < 10) throw new Error("Use a password with at least 10 characters.");
    if (S.mode === "server") {
      const api = makeAPI(S.serverURL);
      const res = await api.register(handle, name, password);
      await startRemoteSession(api, res.token, res.user);
      S.recoveryCodes = res.recoveryCodes || null;
      if (S.recoveryCodes) showRecoveryCodes();
    } else {
      const acct = await local("createAccount", { handle, displayName: name, password });
      await SB.store.set("activeUserEmail", acct.email);
      activate(localBackend({ ...acct, isAdmin: false }));
    }
  });
}
async function recover(identity, code, newPassword) {
  await run(async () => {
    if (newPassword.length < 10) throw new Error("Use a password with at least 10 characters.");
    const api = makeAPI(S.serverURL);
    const res = await api.recover(identity.trim(), code.trim(), newPassword);
    await startRemoteSession(api, res.token, res.user);
    flash("Password reset. That recovery code can't be used again.");
  });
}
async function startRemoteSession(api, token, user) {
  api.token = token;
  await secret("set", tokenKey(user.email), token);
  await SB.store.set("activeUserEmail", user.email);
  await SB.store.set(`cachedUser:${user.email.toLowerCase()}`, user);
  activate(remoteBackend(api, user));
}
function activate(backend) {
  S.backend = backend;
  S.user = backend.user;
  S.folder = "inbox";
  S.selected = null;
  S.messages = [];
  S.counts = {};
  S.signature = "";
  S.welcome = { ...S.welcome, password: "", otp: "", code: "" };
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (isRemote()) refresh(); }, REFRESH_SECONDS * 1000);
  render();
  (async () => {
    await refresh();
    if (backend.isRemote) { try { S.signature = (await backend.settings()).signature || ""; } catch {} }
  })();
}
async function signOut() {
  const b = S.backend;
  if (b) {
    b.signOut();
    if (b.isRemote) await secret("delete", tokenKey(b.user.email));
  }
  await endSession();
}
async function endSession() {
  clearInterval(pollTimer);
  await SB.store.set("activeUserEmail", null);
  Object.assign(S, { backend: null, user: null, messages: [], counts: {}, selected: null, folder: "inbox", compose: null, settingsOpen: false, search: "" });
  S.welcome.creating = S.mode === "local" && !(await local("hasAccounts"));
  closeLayer();
  render();
}
async function changePassword(current, next) {
  if (!S.backend) return false;
  let ok = false;
  await run(async () => {
    if (next.length < 10) throw new Error("Use a password with at least 10 characters.");
    await S.backend.changePassword(current, next);
    flash("Password changed.");
    ok = true;
  });
  return ok;
}
async function deleteCurrentAccount(password) {
  const b = S.backend;
  if (!b) return false;
  let ok = false;
  await run(async () => {
    await b.deleteAccount(password);
    if (b.isRemote) await secret("delete", tokenKey(b.user.email));
    await endSession();
    ok = true;
  });
  return ok;
}

// Mailbox
let refreshSeq = 0;
async function refresh() {
  const b = S.backend;
  if (!b) return;
  const seq = ++refreshSeq;
  try {
    const folder = S.folder;
    const list = await b.messages(folder, S.search);
    if (folder !== S.folder || b !== S.backend || seq !== refreshSeq) return;
    S.messages = list;
    S.counts = await b.folderCounts();
    S.lastRefresh = new Date();
    if (b.isRemote) S.serverReachable = true;
    if (S.selected) {
      const fresh = list.find((m) => m.id === S.selected.id);
      if (fresh) S.selected = { ...fresh, attachments: S.selected.attachments || fresh.attachments };
      else if (!S.search) S.selected = null;
    }
  } catch (e) {
    handle(e);
  }
  renderMailbox();
}
function searchChanged() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 300);
}
async function choose(folder) {
  S.folder = folder;
  S.selected = null;
  S.messages = [];
  renderMailbox();
  await refresh();
}
async function open(m) {
  const b = S.backend;
  if (!b) return;
  S.selected = m;
  renderMailbox();
  try {
    const d = await b.message(m.id);
    if (!d.is_read) {
      await b.setRead(m.id, true);
      d.is_read = true;
      const row = S.messages.find((x) => x.id === m.id);
      if (row) row.is_read = true;
      const c = S.counts[S.folder];
      if (c) S.counts[S.folder] = { total: c.total, unread: Math.max(0, c.unread - 1) };
    }
    if (S.selected?.id === m.id) S.selected = d;
  } catch (e) { handle(e); }
  renderMailbox();
}
const act = (fn) => run(async () => { await fn(); await refresh(); });
const setRead = (m, read) => act(async () => {
  await S.backend.setRead(m.id, read);
  if (S.selected?.id === m.id && !read) S.selected = null;
});
const move = (m, folder) => act(async () => {
  await S.backend.move(m.id, folder);
  if (S.selected?.id === m.id) S.selected = null;
  S.messages = S.messages.filter((x) => x.id !== m.id);
  flash(`Moved to ${folderInfo(folder).title}.`);
});
const trash = (m) => (msgFolder(m) === "trash" ? deletePermanently(m) : move(m, "trash"));
const deletePermanently = (m) => act(async () => {
  await S.backend.delete(m.id);
  if (S.selected?.id === m.id) S.selected = null;
  S.messages = S.messages.filter((x) => x.id !== m.id);
  flash("Message deleted.");
});
const setStarred = (m, starred) => act(async () => {
  await S.backend.setStarred(m.id, starred);
  if (S.selected?.id === m.id) S.selected = { ...S.selected, is_starred: starred };
});
const markSpam = (m, spam) => act(async () => {
  await S.backend.markSpam(m.id, spam);
  if (S.selected?.id === m.id) S.selected = null;
  S.messages = S.messages.filter((x) => x.id !== m.id);
  flash(spam ? "Marked as spam. Future mail from this sender goes to Spam." : "Moved to Inbox. This sender is trusted.");
});
const restore = (m) => act(async () => {
  await S.backend.restore(m.id);
  if (S.selected?.id === m.id) S.selected = null;
  S.messages = S.messages.filter((x) => x.id !== m.id);
  flash("Message restored.");
});
const emptyTrash = () => act(async () => {
  if (S.backend.isRemote) await S.backend.emptyTrash();
  else for (const m of await S.backend.messages("trash", "")) await S.backend.delete(m.id);
  S.selected = null;
  flash("Trash emptied.");
});
async function attachmentData(a) {
  if (!S.backend) throw new Error("StepMail can't reach your mail server. Check the server address in Settings.");
  return S.backend.attachmentData(a);
}

// Compose
function newMessage() {
  if (!S.user) return;
  const m = blankOutgoing();
  m.body = signatureBlock();
  openCompose(m);
}
function reply(all) {
  if (!S.user || !S.selected) return;
  const out = buildReply(S.selected, S.user.email, all);
  out.body = signatureBlock() + out.body;
  openCompose(out);
}
async function loadAttachments(m) {
  const files = [];
  for (const a of m.attachments || []) {
    const data = await attachmentData(a);
    files.push({ id: Math.random().toString(36).slice(2), filename: a.filename, contentType: a.content_type, data, size: b64Size(data) });
  }
  return files;
}
async function forward() {
  const m = S.selected;
  if (!m) return;
  let files;
  try { files = await loadAttachments(m); } catch (e) { handle(e); return; }
  const out = buildForward(m, files);
  out.body = signatureBlock() + out.body;
  openCompose(out);
}
async function editDraft() {
  const m = S.selected;
  if (!m || msgFolder(m) !== "drafts") return;
  const out = buildEditDraft(m);
  try { out.attachments = await loadAttachments(m); } catch (e) { handle(e); return; }
  openCompose(out);
}
async function sendMessage(o) {
  const b = S.backend;
  if (!b) return false;
  const all = `${o.to},${o.cc},${o.bcc}`;
  if (!addresses(all).length) { showError("Add at least one recipient."); return false; }
  const invalid = invalidAddresses(all);
  if (invalid.length) { showError(`Check these addresses: ${invalid.join(", ")}`); return false; }
  if (o.attachments.reduce((n, a) => n + a.size, 0) > 18 * 1024 * 1024) { showError("Attachments are limited to 18 MB per message."); return false; }
  let ok = false;
  await run(async () => {
    const status = await b.send(o);
    flash(String(status).startsWith("queued") ? "Message sent — queued for internet delivery." : "Message sent.");
    ok = true;
    await refresh();
  });
  return ok;
}
async function saveDraft(o) {
  if (!S.backend) return null;
  let id = null;
  await run(async () => {
    id = await S.backend.saveDraft(o);
    flash("Draft saved.");
    await refresh();
  });
  return id;
}
async function autosaveDraft(o) {
  if (!S.backend) return null;
  try {
    const id = await S.backend.saveDraft(o);
    if (S.folder === "drafts") await refresh();
    return id;
  } catch { return null; }
}

// Account security / admin (server accounts)
async function loadAccountSecurity() {
  const b = S.backend;
  if (!isRemote()) return;
  try { S.sessions = await b.sessions(); } catch { S.sessions = []; }
  try { S.events = await b.securityLog(); } catch { S.events = []; }
}
async function refreshMe() {
  if (!isRemote()) return;
  try { S.user = await S.backend.api.me(); S.backend.user = S.user; } catch {}
}
async function loadAppPasswords() {
  if (!isRemote()) return;
  try { S.appPasswords = await S.backend.appPasswords(); } catch { S.appPasswords = []; }
}
async function loadAdmin() {
  if (!isAdmin()) return;
  try {
    S.dnsRecords = (await S.backend.dnsConfig()).records;
    S.relay = await S.backend.relayConfig();
    S.diagnostics = await S.backend.diagnostics();
  } catch (e) { handle(e); }
}

// Helpers
function flash(text) {
  S.notice = text;
  const el = document.getElementById("notice");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { S.notice = null; el.hidden = true; }, 3000);
}
function handle(e) {
  if (e instanceof ClientError) {
    if (e.unauthorized && isRemote()) {
      if (S.user) secret("delete", tokenKey(S.user.email));
      endSession();
      showError("Your session has expired. Sign in again.");
      return;
    }
    if (e.kind === "unreachable") { S.serverReachable = false; renderBadges(); return; }
  }
  showError(cleanErr(e));
}
async function run(op) {
  S.busy = true;
  S.error = null;
  renderBusy();
  try {
    await op();
  } catch (e) {
    if (e instanceof ClientError && e.kind === "unreachable") {
      S.serverReachable = false;
      renderBadges();
      showError(e.message);
    } else handle(e);
  }
  S.busy = false;
  renderBusy();
}

// ---------------------------------------------------------------- views
const root = document.getElementById("root");
const layer = document.getElementById("layer");

function render() {
  if (!S.booted) return;
  if (S.user) renderMailboxShell();
  else renderWelcome();
}

function brandHeader() {
  return h("div", { class: "brand" },
    h("div", { class: "brand-tile", "aria-hidden": "true" }, "S"),
    h("div", {}, h("div", { class: "brand-name" }, "StepMail"), h("div", { class: "brand-domain" }, DOMAIN)));
}
function serverBadge() {
  const r = S.serverReachable;
  return h("span", { class: "badge-status", title: S.serverURL, "data-badge": "1" },
    h("span", { class: `dot ${r === true ? "green" : r === false ? "red" : "gray"}` }),
    h("span", { class: "muted small" }, r === true ? "Online" : r === false ? "Offline" : "Checking…"));
}
function renderBadges() {
  document.querySelectorAll("[data-badge]").forEach((el) => el.replaceWith(serverBadge()));
}
function renderBusy() {
  document.querySelectorAll("[data-busy]").forEach((el) => (el.hidden = !S.busy));
  document.querySelectorAll("[data-needs-idle]").forEach((el) => el.dispatchEvent(new Event("validate")));
}
const busySpinner = () => h("div", { class: "spinner", "data-busy": "1", hidden: !S.busy, role: "progressbar", "aria-label": "Working" });

// Sign in / Create account (WelcomeView)
function renderWelcome() {
  const W = S.welcome;
  const fields = [];
  const input = (key, placeholder, type = "text", extra = {}) => h("input", {
    class: "field", type, placeholder, "aria-label": placeholder, value: W[key], id: `w-${key}`, autocomplete: "off", spellcheck: "false",
    oninput: (e) => { W[key] = e.target.value; validate(); }, ...extra,
  });
  let primary;
  const validate = () => {
    if (!primary) return;
    if (W.recovering) primary.disabled = !W.identity || !W.code || W.password.length < 10 || S.busy;
    else if (W.creating) primary.disabled = !W.handle || W.password.length < 10 || S.busy;
    else primary.disabled = !W.identity || !W.password || S.busy;
  };
  const syncServer = () => { if (S.mode === "server" && normalizeURL(W.server) !== S.serverURL) setServerURL(W.server); };
  const signIn = () => {
    if (primary.disabled) return;
    syncServer();
    login(W.identity, W.password, S.needsOTP ? W.otp : null);
  };
  const createAccount = () => {
    if (!W.handle || W.password.length < 10) return;
    syncServer();
    register(W.handle, W.name || W.handle, W.password);
  };
  const enter = (fn) => ({ onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); fn(); } } });

  const seg = h("div", { class: "segmented", role: "radiogroup", "aria-label": "Account type" },
    ...[["server", "StepMail server"], ["local", "This phone only"]].map(([k, t]) =>
      h("button", { type: "button", role: "radio", "aria-checked": String(S.mode === k), class: S.mode === k ? "on" : "", id: `mode-${k}`, onclick: () => setMode(k) }, t)));
  fields.push(seg);
  if (S.mode === "server") {
    fields.push(h("div", { class: "row gap8" }, input("server", "Server address", "url", { onkeydown: (e) => { if (e.key === "Enter") setServerURL(W.server); }, onchange: () => {} }), serverBadge()));
  } else {
    fields.push(h("p", { class: "caption muted center" }, "Mail stays on this phone and can only be exchanged with other StepMail accounts on it."));
  }
  if (W.recovering) {
    fields.push(input("identity", "Email or username"), input("code", "Recovery code (e.g. a1b2-c3d4-e5f6)"), input("password", "New password — at least 10 characters", "password"));
    primary = h("button", { class: "btn prominent large", id: "w-primary", onclick: () => { syncServer(); recover(W.identity, W.code, W.password); } }, "Reset Password");
    fields.push(primary, h("p", { class: "caption muted center" }, "Use one of the recovery codes you saved when you created the account. Each code works once."));
  } else if (W.creating) {
    fields.push(h("div", { class: "row" }, input("handle", "username"), h("span", { class: "muted suffix" }, `@${DOMAIN}`)));
    fields.push(input("name", "Display name"), input("password", "Password — at least 10 characters", "password", enter(createAccount)));
    primary = h("button", { class: "btn prominent large", id: "w-primary", onclick: createAccount }, "Create Account");
    fields.push(primary);
  } else {
    fields.push(input("identity", "Email or username"), input("password", "Password", "password", enter(signIn)));
    if (S.needsOTP) fields.push(input("otp", "6-digit code from your authenticator app", "text", enter(signIn)));
    primary = h("button", { class: "btn prominent large", id: "w-primary", onclick: signIn }, "Sign In");
    fields.push(primary);
  }
  primary.setAttribute("data-needs-idle", "1");
  primary.addEventListener("validate", validate);
  fields.push(busySpinner());
  fields.push(h("button", { class: "link", id: "w-toggle", onclick: () => {
    if (W.recovering) W.recovering = false; else W.creating = !W.creating;
    W.password = "";
    renderWelcome();
  } }, W.creating || W.recovering ? "Already have an account? Sign in" : "New to StepMail? Create an account"));
  if (S.mode === "server" && !W.creating && !W.recovering) fields.push(h("button", { class: "link", id: "w-forgot", onclick: () => { W.recovering = true; W.password = ""; renderWelcome(); } }, "Forgot your password?"));

  const title = W.recovering ? "Reset your password" : W.creating ? "Create your StepMail" : "Welcome back";
  const focusId = document.activeElement?.id;
  root.replaceChildren(h("main", { class: "welcome" }, brandHeader(), h("section", { class: "card", "aria-label": title }, h("h1", { class: "large-title" }, title), ...fields)));
  validate();
  if (focusId && document.getElementById(focusId)) document.getElementById(focusId).focus();
}

// Mailbox (MailboxView)
let els = {};
function renderMailboxShell() {
  const search = h("input", { class: "field search", type: "search", id: "search", value: S.search, oninput: (e) => { S.search = e.target.value; searchChanged(); } });
  els = {
    sidebar: h("nav", { class: "sidebar", "aria-label": "Mailboxes" }),
    listHead: h("div", { class: "list-head" }),
    search,
    list: h("div", { class: "list", role: "listbox", "aria-label": "Messages", tabindex: "0", onkeydown: listKeys }),
    detail: h("section", { class: "detail", "aria-label": "Message" }),
  };
  root.replaceChildren(h("div", { class: "split" }, els.sidebar, h("section", { class: "content" }, els.listHead, h("div", { class: "search-wrap" }, search), els.list), els.detail));
  renderMailbox();
}
function renderMailbox() {
  if (!S.user || !els.sidebar) return;
  renderSidebar();
  renderList();
  renderDetail();
}
function renderSidebar() {
  const badge = (f) => {
    const c = S.counts[f.key];
    const v = f.key === "drafts" ? c?.total || 0 : c?.unread || 0;
    return v > 0 && f.key !== "sent" && f.key !== "trash" ? h("span", { class: "count" }, String(v)) : null;
  };
  els.sidebar.replaceChildren(
    h("div", { class: "pad-brand" }, brandHeader()),
    h("button", { class: "btn prominent large new-msg", id: "new-message", onclick: newMessage, title: `New Message (${modName}N)` }, ico("compose"), "New Message"),
    h("ul", { class: "folders" }, ...FOLDERS.map((f) => h("li", {},
      h("button", { class: `folder ${S.folder === f.key ? "sel" : ""}`, "data-folder": f.key, "aria-current": S.folder === f.key ? "true" : null, onclick: () => choose(f.key),
        oncontextmenu: f.key === "trash" ? (e) => { e.preventDefault(); popupMenu(e, [{ label: "Empty Trash…", run: confirmEmptyTrash }]); } : null },
      ico(f.icon, "accent"), h("span", { class: "grow" }, f.title), badge(f))))),
    h("div", { class: "grow" }),
    h("div", { class: "side-status" }, isRemote() ? serverBadge() : [h("span", { class: "dot orange" }), h("span", { class: "muted small" }, "This phone only")]),
    h("div", { class: "side-email muted tiny" }, S.user.email),
    h("div", { class: "side-foot" }, h("button", { class: "btn", id: "open-settings", onclick: openSettings }, "Settings"), h("button", { class: "btn", id: "sign-out", onclick: signOut }, "Sign out")),
  );
}
function confirmEmptyTrash() {
  confirmDialog("Permanently delete everything in Trash?", null, [{ label: "Empty Trash", destructive: true, run: emptyTrash }]);
}
function messageActions(m) {
  const f = msgFolder(m);
  const items = [
    { label: m.is_read ? "Mark as Unread" : "Mark as Read", run: () => setRead(m, !m.is_read) },
    { label: m.is_starred ? "Unstar" : "Star", run: () => setStarred(m, !m.is_starred) },
  ];
  if (f !== "archive" && f !== "drafts") items.push({ label: "Archive", run: () => move(m, "archive") });
  items.push({ label: "Move to", sub: FOLDERS.filter((x) => x.key !== f && isMoveTarget(x.key)).map((x) => ({ label: x.title, run: () => move(m, x.key) })) });
  items.push({ sep: true }, { label: f === "trash" ? "Delete Permanently" : "Move to Trash", destructive: true, run: () => trash(m) });
  return items;
}
function renderList() {
  const fi = folderInfo(S.folder);
  els.listHead.replaceChildren(
    h("div", {}, h("h1", { class: "large-title" }, fi.title), S.lastRefresh ? h("div", { class: "caption muted" }, `Updated ${fmtTime(S.lastRefresh)}`) : null),
    h("button", { class: "icon-btn", id: "refresh", title: `Check for new mail (${IS_MAC ? "⇧⌘R" : "Ctrl+Shift+R"})`, "aria-label": "Check for new mail", onclick: refresh }, ico("refresh")));
  els.search.placeholder = `Search ${fi.title}`;
  els.search.setAttribute("aria-label", `Search ${fi.title}`);
  if (!S.messages.length) {
    els.list.replaceChildren(emptyState(S.search ? "No results" : "No messages", fi.icon,
      S.search ? `Nothing in ${fi.title.toLowerCase()} matches “${S.search}”.` : `Nothing is in ${fi.title.toLowerCase()} yet.`));
    return;
  }
  els.list.replaceChildren(...S.messages.map((m) => {
    const f = msgFolder(m);
    const who = f === "sent" || f === "drafts" ? "To: " + (m.recipient || "(No recipient)") : displayName(m.sender);
    const sel = S.selected?.id === m.id;
    return h("div", { class: `row-msg ${sel ? "sel" : ""} ${m.is_read ? "" : "unread"}`, role: "option", "aria-selected": String(sel), "data-id": String(m.id),
      onclick: () => open(m), oncontextmenu: (e) => { e.preventDefault(); popupMenu(e, messageActions(m)); } },
      h("span", { class: `udot ${m.is_read ? "" : "on"}`, "aria-label": m.is_read ? null : "Unread" }),
      h("div", { class: "row-body" },
        h("div", { class: "row-top" }, h("span", { class: "who" }, who), hasAttachments(m) ? ico("paperclip", "muted") : null, h("span", { class: "caption muted nowrap" }, shortDate(mdate(m)))),
        h("div", { class: "subj" }, m.subject || "(No subject)"),
        h("div", { class: "prev muted" }, preview(m))));
  }));
}
function listKeys(e) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  e.preventDefault();
  const i = S.messages.findIndex((m) => m.id === S.selected?.id);
  const next = S.messages[Math.max(0, Math.min(S.messages.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
  if (next) open(next);
}
function emptyState(title, iconName, detail) {
  return h("div", { class: "empty" }, ico(iconName, "big muted"), h("div", { class: "empty-title" }, title), h("div", { class: "muted" }, detail));
}
const authVerified = (v) => v.includes("dmarc=pass") || (v.includes("dkim=pass") && v.includes("spf=pass"));
function authText(v) {
  const r = (k) => (v.match(new RegExp(`${k}=([A-Za-z]*)`)) || [])[1] || "none";
  return `${authVerified(v) ? "Sender verified" : "Sender not verified"} — SPF ${r("spf")}, DKIM ${r("dkim")}, DMARC ${r("dmarc")}`;
}
function renderDetail() {
  const m = S.selected;
  if (!m) { els.detail.replaceChildren(emptyState("Select a message", "envopen", "Choose an email to read it.")); return; }
  const f = msgFolder(m);
  const tb = [];
  const tbtn = (id, label, iconName, fn, extra = {}) => h("button", { class: "btn", id, onclick: fn, ...extra }, iconName ? ico(iconName) : null, label);
  const ibtn = (id, label, iconName, fn, extra = {}) => h("button", { class: "btn icon-only", id, title: label, "aria-label": label, onclick: fn, ...extra }, ico(iconName));
  if (f === "drafts") tb.push(h("button", { class: "btn prominent", id: "edit-draft", onclick: editDraft }, ico("pencil"), "Edit Draft"));
  else tb.push(tbtn("reply", "Reply", "reply", () => reply(false)), tbtn("reply-all", "Reply All", "replyall", () => reply(true)), tbtn("forward", "Forward", "forward", forward));
  tb.push(h("span", { class: "grow" }));
  tb.push(ibtn("star", m.is_starred ? "Unstar" : "Star", m.is_starred ? "starfill" : "star", () => setStarred(m, !m.is_starred)));
  if (f !== "archive" && f !== "drafts" && f !== "trash") tb.push(ibtn("archive", "Archive", "archivebox", () => move(m, "archive")));
  if (f === "spam") tb.push(tbtn("not-spam", "Not Spam", null, () => markSpam(m, false)));
  else if (f !== "sent" && f !== "drafts" && f !== "trash") tb.push(ibtn("spam", "Mark as Spam", "spambin", () => markSpam(m, true)));
  if (f === "trash") tb.push(tbtn("restore", "Restore", null, () => restore(m)));
  tb.push(ibtn("mark-unread", "Mark as Unread", "envbadge", () => setRead(m, false), { disabled: !m.is_read }));
  tb.push(ibtn("trash", f === "trash" ? "Delete Permanently" : "Move to Trash", "trash", () => trash(m), { class: "btn icon-only destructive" }));
  const header = (label, value) => h("div", { class: "hline" }, h("span", { class: "hlabel" }, label + ":"), h("span", { class: "selectable" }, value));
  els.detail.replaceChildren(
    h("div", { class: "toolbar" }, ...tb),
    h("div", { class: "detail-scroll" },
      h("h2", { class: "detail-subject selectable" }, m.subject || "(No subject)"),
      h("div", { class: "headers" },
        header("From", m.sender), header("To", m.recipient),
        m.cc ? header("Cc", m.cc) : null, m.bcc ? header("Bcc", m.bcc) : null,
        h("div", { class: "callout muted" }, fmtComplete(mdate(m))),
        m.auth_results ? h("div", { class: "caption muted", title: m.auth_results }, ico(authVerified(m.auth_results) ? "shieldok" : "shieldwarn"), " ", authText(m.auth_results)) : null),
      m.attachments?.length ? attachmentStrip(m.attachments) : null,
      h("hr"),
      h("div", { class: "body selectable", id: "message-body" }, displayText(m) || "This message has no text."),
      m.external_status && f === "sent" ? [h("hr"), h("div", { class: "caption muted selectable" }, ico("info"), ` Delivery: ${m.external_status}`)] : null));
}
function attachmentStrip(list) {
  return h("div", { class: "attachments" },
    h("div", { class: "caption muted bold" }, `${list.length} attachment${list.length === 1 ? "" : "s"}`),
    ...list.map((a) => h("div", { class: "att" }, ico("doc", "big2 muted"),
      h("div", { class: "grow" }, h("div", { class: "ellipsis" }, a.filename), h("div", { class: "caption muted" }, formatSize(a.size))),
      h("button", { class: "btn", onclick: () => openAttachment(a) }, "Open"),
      h("button", { class: "btn", onclick: () => saveAttachment(a) }, "Save…"))));
}
async function openAttachment(a) {
  try { await SB.invoke("openAttachment", a.id, a.filename, await attachmentData(a)); } catch (e) { showError(cleanErr(e)); }
}
async function saveAttachment(a) {
  const file = await SB.dialog.save({ defaultPath: a.filename });
  if (!file) return;
  try {
    await SB.fs.writeBytes(file, fromB64(await attachmentData(a)));
    flash(`Saved ${a.filename}.`);
  } catch (e) { showError(cleanErr(e)); }
}

// ---------------------------------------------------------------- dialogs
const modName = IS_MAC ? "⌘" : "Ctrl+";
let sheetStack = [];
function closeLayer() { sheetStack = []; layer.replaceChildren(); }
function pushSheet(node, onEscape) {
  const back = h("div", { class: "backdrop" }, node);
  back.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); onEscape?.(); } });
  sheetStack.push(back);
  layer.append(back);
  setTimeout(() => (node.querySelector("[autofocus]") || node.querySelector("input,textarea,button"))?.focus(), 0);
  return () => { back.remove(); sheetStack = sheetStack.filter((x) => x !== back); };
}
function showError(text) {
  S.error = text;
  const close = () => { S.error = null; done(); };
  const done = pushSheet(h("div", { class: "alert", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "alert-title", id: "alert" },
    ico("appicon", "alert-icon"),
    h("div", { class: "alert-title", id: "alert-title" }, "StepMail"),
    h("div", { class: "alert-text", id: "alert-text" }, text),
    h("button", { class: "btn prominent wide", id: "alert-ok", autofocus: true, onclick: close }, "OK")), close);
}
function confirmDialog(title, message, actions) {
  const done = pushSheet(h("div", { class: "alert", role: "alertdialog", "aria-modal": "true" },
    h("div", { class: "alert-title" }, title), message ? h("div", { class: "alert-text" }, message) : null,
    ...actions.map((a) => h("button", { class: `btn wide ${a.destructive ? "destructive-fill" : a.primary ? "prominent" : ""}`, onclick: () => { done(); a.run(); } }, a.label)),
    h("button", { class: "btn wide", autofocus: true, onclick: () => done() }, actions.cancelLabel || "Cancel")), () => done());
  return done;
}
function popupMenu(e, items) {
  document.querySelector(".menu")?.remove();
  const build = (list) => h("div", { class: "menu", role: "menu" }, ...list.map((it) => it.sep ? h("div", { class: "menu-sep" }) :
    it.sub ? h("div", { class: "menu-item has-sub", role: "menuitem", tabindex: "-1" }, it.label, h("span", { class: "chev" }, "›"), build(it.sub)) :
    h("button", { class: `menu-item ${it.destructive ? "red" : ""}`, role: "menuitem", onclick: () => { menu.remove(); it.run(); } }, it.label)));
  const menu = build(items);
  menu.style.left = `${Math.min(e.clientX, innerWidth - 220)}px`;
  menu.style.top = `${Math.min(e.clientY, innerHeight - 30 * items.length - 10)}px`;
  document.body.append(menu);
  menu.querySelector("button")?.focus();
  const off = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); removeEventListener("mousedown", off, true); } };
  addEventListener("mousedown", off, true);
  menu.addEventListener("keydown", (ev) => { if (ev.key === "Escape") menu.remove(); });
}

// Compose (ComposeView)
let composeAPI = null;
function openCompose(initial) {
  if (S.compose) return;
  const original = { ...initial, attachments: [...initial.attachments] };
  const draft = { ...initial, attachments: [...initial.attachments] };
  S.compose = draft;
  let showCc = !!(draft.cc || draft.bcc), sending = false, lastAutosaved = null;
  const title = draft.draftID != null ? "Edit Draft" : draft.inReplyTo ? "Reply" : draft.subject.startsWith("Fwd:") ? "Forward" : "New Message";
  const autosaveNote = h("span", { class: "caption muted", id: "autosave-note" });
  const sendBtn = h("button", { class: "btn prominent", id: "send", title: `Send (${modName}Return)`, onclick: () => doSend() }, ico("paperplane"), "Send");
  const updateSend = () => (sendBtn.disabled = sending || !(draft.to + draft.cc + draft.bcc).trim());
  const field = (label, key, extra) => h("div", { class: "cfield" }, h("label", { for: `c-${key}`, class: "muted" }, label),
    h("input", { id: `c-${key}`, class: "plain", value: draft[key], spellcheck: key === "subject" ? "true" : "false", oninput: (e) => { draft[key] = e.target.value; updateSend(); } }), extra || null);
  const ccWrap = h("div", { hidden: !showCc }, field("Cc:", "cc"), field("Bcc:", "bcc"));
  const ccToggle = h("button", { class: "link", id: "toggle-cc", onclick: () => { showCc = !showCc; ccWrap.hidden = !showCc; ccToggle.textContent = showCc ? "Hide Cc/Bcc" : "Cc/Bcc"; } }, showCc ? "Hide Cc/Bcc" : "Cc/Bcc");
  const attWrap = h("div", { class: "chips", id: "compose-attachments" });
  const renderAtts = () => {
    attWrap.hidden = !draft.attachments.length;
    attWrap.replaceChildren(...draft.attachments.map((a) => h("span", { class: "chip" }, ico("doc"), h("span", { class: "ellipsis" }, a.filename), h("span", { class: "caption muted" }, formatSize(a.size)),
      h("button", { class: "chip-x", "aria-label": `Remove ${a.filename}`, onclick: () => { draft.attachments = draft.attachments.filter((x) => x.id !== a.id); renderAtts(); } }, "×"))));
  };
  const addAttachment = (filename, bytes) => {
    const data = toB64(bytes);
    draft.attachments.push({ id: Math.random().toString(36).slice(2), filename, contentType: contentType(filename), data, size: b64Size(data) });
    renderAtts();
  };
  const attach = async () => {
    const files = await SB.dialog.open({ properties: ["openFile", "multiSelections"] });
    for (const f of files || []) {
      const name = f.split(/[\\/]/).pop();
      try { addAttachment(name, await SB.fs.readBytes(f)); } catch (e) { showError(`Couldn't attach ${name}: ${cleanErr(e)}`); }
    }
  };
  const body = h("textarea", { class: "compose-body", id: "c-body", "aria-label": "Message", value: draft.body, oninput: (e) => (draft.body = e.target.value) });
  const timer = setInterval(async () => {
    if (sending || outgoingEmpty(draft) || sameOutgoing(draft, original) || sameOutgoing(draft, lastAutosaved)) return;
    const snap = { ...draft, attachments: [...draft.attachments] };
    const id = await autosaveDraft(snap);
    if (id != null) {
      draft.draftID = id;
      lastAutosaved = { ...draft, attachments: [...draft.attachments] };
      autosaveNote.textContent = `Draft saved ${fmtTime(new Date())}`;
    }
  }, 15000);
  const dismiss = () => { clearInterval(timer); S.compose = null; composeAPI = null; done(); };
  const saveAndClose = async () => {
    const id = await saveDraft(draft);
    if (id != null) { draft.draftID = id; dismiss(); }
  };
  const close = () => {
    if (sameOutgoing(draft, original) || outgoingEmpty(draft) || sameOutgoing(draft, lastAutosaved)) dismiss();
    else confirmDialog("Save this message as a draft?", null, [{ label: "Save Draft", primary: true, run: saveAndClose }, { label: "Discard", destructive: true, run: dismiss }]);
  };
  const doSend = async () => {
    if (sendBtn.disabled) return;
    sending = true; updateSend();
    const ok = await sendMessage(draft);
    sending = false; updateSend();
    if (ok) dismiss();
  };
  const sheet = h("div", { class: "sheet compose", role: "dialog", "aria-modal": "true", "aria-label": title, id: "compose",
    onkeydown: (e) => {
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;
      if (mod && e.key === "Enter") { e.preventDefault(); doSend(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === "a") { e.preventDefault(); attach(); }
    } },
    h("div", { class: "sheet-bar" }, h("button", { class: "btn", id: "c-cancel", onclick: close }, "Cancel"), h("span", { class: "grow center bold" }, title),
      h("button", { class: "btn", id: "save-draft", onclick: saveAndClose }, "Save Draft"), sendBtn),
    field("To:", "to", ccToggle), ccWrap, field("Subject:", "subject"), body, attWrap,
    h("div", { class: "sheet-foot" }, h("button", { class: "btn", id: "attach", title: `Attach Files… (${IS_MAC ? "⇧⌘A" : "Ctrl+Shift+A"})`, onclick: attach }, ico("paperclip"), "Attach Files…"), h("span", { class: "grow" }), autosaveNote, h("span", { class: "caption muted" }, `From: ${S.user?.email || ""}`)));
  const done = pushSheet(sheet, close);
  renderAtts();
  updateSend();
  setTimeout(() => (draft.to ? body : sheet.querySelector("#c-to")).focus(), 0);
  if (draft.to) setTimeout(() => body.setSelectionRange(0, 0), 0);
  composeAPI = { draft, addAttachment, send: doSend, saveAndClose, close };
}

// Recovery codes (RecoveryCodesView)
function showRecoveryCodes() {
  const codes = S.recoveryCodes || [];
  const done = pushSheet(h("div", { class: "sheet narrow", role: "dialog", "aria-modal": "true", "aria-label": "Save your recovery codes", id: "recovery-codes" },
    h("h2", {}, "Save your recovery codes"),
    h("p", { class: "muted" }, "If you forget your password, one of these codes lets you set a new one. Each works once. StepMail can't show them again."),
    h("pre", { class: "codes selectable" }, codes.join("\n")),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: () => navigator.clipboard.writeText(codes.join("\n")).then(() => flash("Copied.")) }, "Copy"), h("span", { class: "grow" }),
      h("button", { class: "btn prominent", autofocus: true, onclick: () => { S.recoveryCodes = null; done(); } }, "I've Saved Them"))), () => {});
}

// Settings (SettingsView)
let settingsBody = null, settingsForm = {};
function openSettings() {
  if (S.settingsOpen) return;
  S.settingsOpen = true;
  settingsForm = { server: S.serverURL, cur: "", next: "", del: "", codesPw: "", name: S.user?.displayName || "", sig: S.signature, tfPw: "", tfCode: "", appName: "",
    relayHost: S.relay?.host || "", relayPort: String(S.relay?.port || 587), relayUser: S.relay?.user || "", relayPass: "", relaySecurity: S.relay?.security || "starttls" };
  settingsBody = h("div", { class: "settings-scroll" });
  const close = () => { S.settingsOpen = false; settingsBody = null; done(); if (S.recoveryCodes) showRecoveryCodes(); };
  const done = pushSheet(h("div", { class: "sheet settings", role: "dialog", "aria-modal": "true", "aria-label": "StepMail Settings", id: "settings" },
    h("div", { class: "sheet-bar" }, h("h2", { class: "grow" }, "StepMail Settings"), h("button", { class: "btn", id: "settings-done", onclick: close }, "Done")),
    settingsBody), close);
  renderSettings();
  (async () => {
    await Promise.all([loadAdmin(), refreshMe(), loadAppPasswords(), loadAccountSecurity()]);
    if (S.relay) Object.assign(settingsForm, { relayHost: S.relay.host, relayPort: String(S.relay.port), relayUser: S.relay.user, relaySecurity: S.relay.security });
    renderSettings();
  })();
}
function renderSettings() {
  if (!settingsBody) return;
  const F = settingsForm;
  const scrollTop = settingsBody.scrollTop;
  const lc = (label, value) => h("div", { class: "lc" }, h("span", {}, label), h("span", { class: "muted selectable" }, value));
  const sec = (title, ...kids) => h("section", { class: "group" }, h("h3", {}, title), h("div", { class: "group-box" }, ...kids));
  const inp = (key, placeholder, type = "text", extra = {}) => h("input", { class: "field", type, placeholder, "aria-label": placeholder, value: F[key], oninput: (e) => { F[key] = e.target.value; }, ...extra });
  const note = (t) => h("p", { class: "caption muted" }, t);
  const date = (ts) => `${fmtAbbrev(new Date(ts * 1000))} at ${fmtTime(new Date(ts * 1000))}`;
  const btn = (label, fn, extra = {}) => h("button", { class: "btn", onclick: fn, ...extra }, label);
  const remote = isRemote();
  const out = [];
  out.push(sec("Account", lc("Address", S.user?.email || "Not signed in"), S.user ? lc("Name", S.user.displayName) : null,
    lc("Mailbox", remote ? "StepMail server" : S.user ? "This phone only" : "—"), lc("App version", "1.8.1")));
  const st = S.serverStatus;
  out.push(sec("Server",
    h("div", { class: "row gap8" }, inp("server", "Server address", "url", { disabled: !!S.user, id: "settings-server" }), btn("Check", () => setServerURL(F.server), { disabled: !!S.user, id: "settings-check" })),
    h("div", { class: "lc" }, h("span", {}, "Status"), serverBadge()),
    st ? [lc("Server version", st.version || "—"), lc("Domain", st.domain || DOMAIN),
      lc("Internet delivery", st.independent === false ? "Through a third-party relay" : "Direct from StepMail's own server (full independent mode)"),
      st.independent === false ? h("div", { class: "warn bold" }, "⚠ ", st.independenceNotice || "NOT FULLY INDEPENDENT — STEPMAIL IS NOT CURRENTLY OPERATING IN FULL INDEPENDENT MODE") : null] : null,
    S.user ? note("Sign out to change servers.") : null));
  if (S.user) {
    out.push(sec("Change password", inp("cur", "Current password", "password"), inp("next", "New password — at least 10 characters", "password"),
      btn("Change Password", async () => {
        if (!F.cur || F.next.length < 10 || S.busy) return showError(F.next.length < 10 ? "Use a password with at least 10 characters." : "Enter your current password.");
        if (await changePassword(F.cur, F.next)) { F.cur = ""; F.next = ""; renderSettings(); }
      }, { id: "change-password" })));
  }
  if (remote) {
    const tfOn = S.user?.twoFactor === true;
    const tf = [lc("Two-factor", tfOn ? "On" : "Off")];
    if (S.twoFactorSetup) {
      tf.push(note("Add this key to an authenticator app (or open the link on a device that has one):"),
        h("div", { class: "mono selectable" }, S.twoFactorSetup.secret),
        h("div", { class: "mono tiny muted selectable" }, S.twoFactorSetup.otpauthURI),
        inp("tfCode", "6-digit code"),
        btn("Turn On", () => { if (F.tfCode.length !== 6) return; run(async () => { await S.backend.enableTwoFactor(F.tfCode); S.twoFactorSetup = null; flash("Two-factor sign-in is on. Other devices were signed out."); await refreshMe(); F.tfCode = ""; renderSettings(); }); }));
    } else {
      tf.push(inp("tfPw", "Current password", "password"));
      if (tfOn) tf.push(inp("tfCode", "Current 6-digit code"), btn("Turn Off Two-Factor", () => { if (!F.tfPw || F.tfCode.length !== 6) return; run(async () => { await S.backend.disableTwoFactor(F.tfPw, F.tfCode); flash("Two-factor sign-in is off."); await refreshMe(); F.tfPw = F.tfCode = ""; renderSettings(); }); }, { class: "btn destructive" }));
      else tf.push(btn("Set Up Two-Factor Sign-In", () => { if (!F.tfPw) return; run(async () => { S.twoFactorSetup = await S.backend.setupTwoFactor(F.tfPw); F.tfPw = ""; renderSettings(); }); }));
    }
    tf.push(h("hr"), note("App passwords let mail programs send through StepMail (SMTP, ports 587/465). They're required when two-factor is on."));
    for (const p of S.appPasswords) tf.push(h("div", { class: "lc" }, h("span", {}, p.name), h("span", { class: "row gap8" }, h("span", { class: "caption muted" }, p.last_used > 0 ? `used ${fmtAbbrev(new Date(p.last_used * 1000))}` : "never used"),
      btn("Revoke", () => run(async () => { await S.backend.deleteAppPassword(p.id); await loadAppPasswords(); renderSettings(); })))));
    tf.push(h("div", { class: "row gap8" }, inp("appName", "Name (e.g. Thunderbird)"), btn("Create", () => { if (!F.appName) return; run(async () => { S.newAppPassword = await S.backend.createAppPassword(F.appName); F.appName = ""; await loadAppPasswords(); renderSettings(); }); })));
    if (S.newAppPassword) tf.push(h("div", { class: "lc" }, h("span", { class: "mono big-mono selectable" }, S.newAppPassword), btn("Done", () => { S.newAppPassword = null; renderSettings(); })), note("Shown once. Use it instead of your password in the mail program."));
    out.push(sec("Two-factor sign-in and app passwords", ...tf));

    const sigArea = h("textarea", { class: "field sig", "aria-label": "Signature", value: F.sig, oninput: (e) => (F.sig = e.target.value) });
    out.push(sec("Profile and signature", inp("name", "Display name"), sigArea, note("The signature is added below new messages, replies and forwards."),
      btn("Save Profile", () => run(async () => { await S.backend.saveProfile(F.name, F.sig); S.signature = F.sig; flash("Profile saved."); }))));

    const dev = S.sessions.map((s) => h("div", { class: "lc" }, h("div", {}, h("div", { class: "ellipsis" }, s.userAgent || "Unknown device"), h("div", { class: "caption muted" }, `${s.ip} · last active ${date(s.lastSeen)}`)),
      s.current ? h("span", { class: "caption muted" }, "This computer") : btn("Sign Out", () => run(async () => { await S.backend.revokeSession(s.id); await loadAccountSecurity(); renderSettings(); }))));
    out.push(sec("Signed-in devices and security log", ...dev,
      h("details", {}, h("summary", {}, "Recent security events"), ...S.events.slice(0, 30).map((e) => h("div", { class: "caption" }, `${date(e.ts)} — ${e.event.replace(/_/g, " ")}${e.ip ? ` from ${e.ip}` : ""}`)))));

    out.push(sec("Recovery codes", note("Recovery codes are the only way back in if you forget your password. Generating new ones cancels the old ones."),
      inp("codesPw", "Current password", "password"),
      btn("Generate New Recovery Codes", () => { if (!F.codesPw) return; run(async () => { S.recoveryCodes = await S.backend.newRecoveryCodes(F.codesPw); F.codesPw = ""; renderSettings(); }); }),
      S.recoveryCodes ? [h("pre", { class: "codes selectable" }, S.recoveryCodes.join("\n")), btn("I've Saved Them", () => { S.recoveryCodes = null; renderSettings(); })] : null));
  }
  if (isAdmin()) {
    out.push(sec("Server administration — DNS records", S.dnsRecords.length ? null : h("div", { class: "muted" }, "Loading…"),
      ...S.dnsRecords.map((r) => h("div", { class: "dns" }, h("div", { class: "row gap8" }, h("span", { class: "pill" }, r.type), h("span", { class: "mono selectable" }, r.name)), h("div", { class: "mono tiny selectable" }, r.value), h("div", { class: "tiny muted" }, r.purpose)))));
    const summary = (v) => v === null ? "—" : Array.isArray(v) ? `${v.length} item(s)` : typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "object" ? (typeof v.status === "string" ? v.status : Object.keys(v).sort().map((k) => `${k}: ${summary(v[k])}`).join(", ")) : String(v);
    out.push(sec("Server administration — diagnostics",
      ...Object.keys(S.diagnostics).sort().map((k) => {
        const v = S.diagnostics[k];
        return v && typeof v === "object" && !Array.isArray(v) && v.status === undefined
          ? h("details", {}, h("summary", {}, k), ...Object.keys(v).sort().map((s) => h("div", { class: "lc caption" }, h("span", {}, s), h("span", { class: "muted" }, summary(v[s])))))
          : lc(k, summary(v));
      }),
      h("div", { class: "row gap8" }, btn("Refresh", async () => { await loadAdmin(); renderSettings(); }), btn("Retry Outgoing Queue", () => run(async () => { await S.backend.retryQueue(); flash("Outgoing queue will retry now."); await loadAdmin(); renderSettings(); })))));
    out.push(sec("Server administration — outbound relay",
      note("Leave empty: StepMail then delivers directly to recipients' mail servers from its own server. Setting a relay hands all outgoing mail to another company, and StepMail will report itself as not independent. Save with an empty host to remove a relay."),
      inp("relayHost", "Relay host"), inp("relayPort", "Port"), inp("relayUser", "Username"), inp("relayPass", "Password (leave blank to keep)", "password"),
      h("label", { class: "lc" }, h("span", {}, "Security"), h("select", { class: "field narrow", onchange: (e) => (F.relaySecurity = e.target.value) },
        ...[["starttls", "STARTTLS"], ["ssl", "SSL/TLS"], ["none", "None"]].map(([v, t]) => h("option", { value: v, selected: F.relaySecurity === v }, t)))),
      btn("Save Relay", () => run(async () => {
        await S.backend.saveRelay(F.relayHost, parseInt(F.relayPort, 10) || 587, F.relayUser, F.relayPass, F.relaySecurity);
        F.relayPass = "";
        flash("Outbound relay saved.");
        await loadAdmin(); await checkServer(); renderSettings();
      }))));
  }
  out.push(sec("Privacy", note("StepMail does not use advertising trackers. Session tokens and on-device password hashes are kept in StepMail's own data folder on this computer.")));
  if (S.user) {
    out.push(sec("Delete account", inp("del", "Current password", "password", { id: "delete-password" }),
      btn("Delete StepMail Account…", () => {
        if (!F.del) return;
        confirmDialog("Delete this StepMail account?", "This cannot be undone.", [{ label: "Delete Account and Mail", destructive: true, run: async () => { if (await deleteCurrentAccount(F.del)) F.del = ""; } }]);
      }, { class: "btn destructive", id: "delete-account" }),
      note(remote ? "Permanently deletes your StepMail account and all of its mail from the server." : "Permanently deletes this account and all of its mail from this computer.")));
  }
  settingsBody.replaceChildren(...out);
  settingsBody.scrollTop = scrollTop;
}

// ---------------------------------------------------------------- keyboard (the Mac app's menu commands)
addEventListener("keydown", (e) => {
  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === ",") { e.preventDefault(); if (!S.settingsOpen) openSettings(); return; }
  if (sheetStack.length || !S.user) return;
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
  if (k === "n" && !e.shiftKey) { e.preventDefault(); newMessage(); }
  else if (k === "r" && e.shiftKey) { e.preventDefault(); refresh(); }
  else if (/^[1-7]$/.test(e.key) && !e.shiftKey && !e.altKey) { e.preventDefault(); choose(FOLDERS[Number(e.key) - 1].key); }
  else if (!S.selected || inField) return;
  else if (k === "r" && e.altKey) { e.preventDefault(); if (msgFolder(S.selected) !== "drafts") reply(true); }
  else if (k === "r") { e.preventDefault(); if (msgFolder(S.selected) !== "drafts") reply(false); }
  else if (k === "f" && e.shiftKey) { e.preventDefault(); if (msgFolder(S.selected) !== "drafts") forward(); }
  else if (k === "e") { e.preventDefault(); const f = msgFolder(S.selected); if (f !== "archive" && f !== "drafts" && f !== "trash") move(S.selected, "archive"); }
  else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); trash(S.selected); }
});

// Test hooks used by selftest.js (it drives the real UI; these only expose state and the
// compose window's file-attach step, which normally goes through the system file picker).
window.__stepmail = { state: S, compose: () => composeAPI, refresh, showRecoveryCodes };

bootstrap();
