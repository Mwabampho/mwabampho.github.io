// Lenda 2.1 for Windows/Linux: port of LendaApp.swift + LendaIntegration.swift (Mac).
// Private local calendar, tasks, conversation date suggestions, and the floating George
// assistant (the ShouldBe website's George FAQ matcher, run locally).
import { detectDates } from "./dates.js";

const sb = window.shouldbe;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const REF = 978307200; // Swift's reference date (2001-01-01) in Unix seconds: calendar.json uses it, like the Mac app.
const toSwift = (d) => d.getTime() / 1000 - REF;
const fromSwift = (n) => new Date((n + REF) * 1000);
const uuid = () => crypto.randomUUID().toUpperCase();

// ---------------- store (LendaStore) ----------------
const store = {
  events: [], // {id, title, start: Date, end: Date, location, notes, category}
  tasks: [], // {id, title, complete}
  message: "",
  async load() {
    const r = await sb.invoke("lenda:load");
    if (r.error) { this.message = r.error; return; }
    this.events = r.doc.events.map((e) => ({ location: "", notes: "", category: "Personal", ...e, start: fromSwift(e.start), end: fromSwift(e.end) }));
    this.tasks = r.doc.tasks.map((t) => ({ complete: false, ...t }));
  },
  saving: Promise.resolve(),
  save() {
    const doc = { events: this.events.map((e) => ({ ...e, start: toSwift(e.start), end: toSwift(e.end) })), tasks: this.tasks };
    this.saving = this.saving.then(() => sb.invoke("lenda:save", JSON.stringify(doc))).catch((e) => { this.message = `Save failed: ${e.message}`; render(); });
  },
  upsert(item) {
    const i = this.events.findIndex((e) => e.id === item.id);
    if (i >= 0) this.events[i] = item; else this.events.push(item);
    this.save();
  },
  remove(item) { this.events = this.events.filter((e) => e.id !== item.id); this.save(); },
  addTask(title) {
    const s = title.trim();
    if (!s) return;
    this.tasks.unshift({ id: uuid(), title: s, complete: false });
    this.save();
  },
  toggle(id) { const t = this.tasks.find((x) => x.id === id); if (t) { t.complete = !t.complete; this.save(); } },
  removeTask(id) { this.tasks = this.tasks.filter((t) => t.id !== id); this.save(); },
  forDay(day) { return this.events.filter((e) => sameDay(e.start, day)).sort((a, b) => a.start - b.start); },

  icsText() {
    const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const e = (s) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    let out = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ShouldBe//Lenda//EN\r\n";
    for (const ev of this.events) {
      out += `BEGIN:VEVENT\r\nUID:${ev.id}@lenda.local\r\nDTSTAMP:${f(new Date())}\r\n`;
      out += `DTSTART:${f(ev.start)}\r\nDTEND:${f(ev.end)}\r\n`;
      out += `SUMMARY:${e(ev.title)}\r\nLOCATION:${e(ev.location)}\r\nDESCRIPTION:${e(ev.notes)}\r\nEND:VEVENT\r\n`;
    }
    return out + "END:VCALENDAR\r\n";
  },
  async exportICS(file) {
    if (!file) file = await sb.dialog.save({ defaultPath: "Lenda.ics", filters: [{ name: "Calendar", extensions: ["ics"] }] });
    if (!file) return;
    try { await sb.fs.writeText(file, this.icsText()); this.message = `Exported ${this.events.length} calendar events.`; }
    catch (e) { this.message = `Export failed: ${e.message}`; }
    render();
  },
  async importICS(file) {
    if (!file) [file] = await sb.dialog.open({ properties: ["openFile"], filters: [{ name: "Calendar", extensions: ["ics"] }] });
    if (!file) return;
    try {
      const rows = (await sb.fs.readText(file)).replace(/\r\n/g, "\n").split("\n");
      const parse = (s) => { const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s || ""); return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null; };
      let fields = {}, inside = false, count = 0;
      for (const line of rows) {
        if (line === "BEGIN:VEVENT") { inside = true; fields = {}; continue; }
        if (line === "END:VEVENT") {
          const start = parse(fields.DTSTART);
          if (start && fields.SUMMARY != null) {
            const end = parse(fields.DTEND) || new Date(start.getTime() + 3600000);
            const idPart = (fields.UID || "").split("@")[0];
            const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idPart) ? idPart.toUpperCase() : uuid();
            if (!this.events.some((e) => e.id === id)) {
              this.events.push({ id, title: fields.SUMMARY, start, end, location: fields.LOCATION ?? "", notes: fields.DESCRIPTION ?? "", category: "Personal" });
              count++;
            }
          }
          inside = false;
          continue;
        }
        const i = line.indexOf(":");
        if (inside && i >= 0) fields[line.slice(0, i).split(";")[0]] = line.slice(i + 1);
      }
      this.save();
      this.message = `Imported ${count} events. ICS support currently covers UTC DTSTART events.`;
    } catch (e) { this.message = `Import failed: ${e.message}`; }
    render();
  },
};

// ---------------- date helpers ----------------
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + n); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return x; };
let firstWeekday = 1;
try { const wi = new Intl.Locale(navigator.language).getWeekInfo?.() || new Intl.Locale(navigator.language).weekInfo; if (wi?.firstDay) firstWeekday = wi.firstDay % 7; } catch {}
const weekStart = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() - firstWeekday + 7) % 7)); return x; };
const fmt = (d, o) => d.toLocaleString(undefined, o);
const fmtTime = (d) => fmt(d, { hour: "numeric", minute: "2-digit" });
const fmtAbbrevDateTime = (d) => `${fmt(d, { day: "numeric", month: "short", year: "numeric" })}, ${fmtTime(d)}`;
const pad = (n) => String(n).padStart(2, "0");
const dateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// ---------------- icons ----------------
const o = (b, w = 2) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
const I = {
  logo: o('<rect x="2" y="4" width="16" height="15" rx="3"/><path d="M2 9h16M6 2v4M14 2v4"/><circle cx="18" cy="17" r="5" fill="#090e1c"/><path d="M18 14.5V17l1.6 1.2"/>'),
  month: o('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>'),
  week: o('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 9v12M3 9h18M12 13h6M12 17h4"/>'),
  day: o('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  year: o('<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/>', 1.6),
  agenda: o('<rect x="2" y="4" width="20" height="16" rx="3"/><path d="M6 9h.01M6 13h.01M6 17h.01M9.5 9h8M9.5 13h8M9.5 17h5"/>'),
  tasks: o('<circle cx="12" cy="12" r="10"/><path d="m8 12.5 3 3 5-6"/>'),
  conversations: o('<path d="M3 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8l-4 3v-3.3A2 2 0 0 1 3 10z"/><path d="M19 8h1a2 2 0 0 1 2 2v5a2 2 0 0 1-1 1.7V20l-3.5-2.5H12a2 2 0 0 1-2-2v-1"/>'),
  connected: o('<path d="M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5"/>'),
  sync: o('<path d="M21 12a9 9 0 0 1-15.4 6.4L3 16M3 12a9 9 0 0 1 15.4-6.4L21 8M21 3v5h-5M3 21v-5h5"/>'),
  privacy: o('<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/><rect x="9" y="11" width="6" height="5" rx="1"/><path d="M10.2 11V9.5a1.8 1.8 0 0 1 3.6 0V11"/>'),
  shieldFill: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/><rect x="9" y="11" width="6" height="5" rx="1" fill="#0f1a2e"/></svg>`,
  left: o('<path d="M15 5l-7 7 7 7"/>'),
  right: o('<path d="M9 5l7 7-7 7"/>'),
  down: o('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  up: o('<path d="M12 15V3M7 8l5-5 5 5M4 21h16"/>'),
  plus: o('<path d="M12 5v14M5 12h14"/>'),
  pin: o('<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  circle: o('<circle cx="12" cy="12" r="9.5"/>'),
  checkFill: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#0f1a2e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash: o('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  calPlus: o('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M12 12v6M9 15h6"/>'),
  arrowUR: o('<path d="M7 17 17 7M8 7h9v9"/>'),
  reload: o('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>'),
  sparkles: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="3" y="7" width="16" height="14" rx="3" opacity=".45"/><rect x="5" y="4" width="16" height="14" rx="3" opacity=".7"/><path d="M13 6.5l1.1 2.9 2.9 1.1-2.9 1.1L13 14.5l-1.1-2.9L9 10.5l2.9-1.1z" fill="#0f1a2e"/></svg>`,
  x: o('<path d="M6 6l12 12M18 6 6 18"/>', 2.4),
  check: o('<circle cx="12" cy="12" r="10"/><path d="m8 12.5 3 3 5-6"/>'),
  minus: o('<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>'),
  question: o('<circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.5M12 17h.01"/>'),
  empty: o('<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/>', 1.5),
};

// ---------------- UI ----------------
const MODES = [
  ["month", "Month"], ["week", "Week"], ["day", "Day"], ["year", "Year"], ["agenda", "Agenda"], ["tasks", "Tasks"],
  ["conversations", "Conversations"], ["connected", "Connected Apps"], ["sync", "Synchronisation"], ["privacy", "Privacy"],
];
const CONNECTED = ["Lenda", "Active", "Syncro", "Milo", "Visora", "Sonics", "Viewverse", "StepMail", "Kardio", "Jab", "O Store", "ShouldBe"];
const ui = {
  mode: "month", selected: new Date(), query: "", newTask: "",
  editor: null, // { event|null, draft }
  pasted: "", proposals: [], note: "Paste an authorised conversation. Analysis stays on this computer. No messages are read from Active or Synchro.",
  installed: {}, checked: new Date(),
  george: { open: false, input: "", busy: false, lines: [{ owner: "George", message: "I'm George, the same factual FAQ matcher used on the ShouldBe website. I can answer questions about ShouldBe. I am not a generative AI model, and I can't read Active or Synchro messages." }] },
};
const $app = document.getElementById("app");

function titleText() {
  const m = ui.mode;
  if (m === "year") return String(ui.selected.getFullYear());
  return { tasks: "Your tasks", conversations: "Conversation inbox", connected: "Connected Apps", sync: "Synchronisation", privacy: "Privacy" }[m] || fmt(ui.selected, { month: "long", year: "numeric" });
}

function eventRows(events) {
  if (!events.length) return `<div class="unavailable">${I.empty}<h3>No events</h3><p>Select New Event to get started.</p></div>`;
  return events.map((e) => `<button class="evrow" data-edit="${e.id}"><span class="bar"></span><span class="grow"><b>${esc(e.title)}</b><small>${fmtAbbrevDateTime(e.start)} – ${fmtTime(e.end)}</small></span>${e.location ? `<span class="loc">${I.pin}${esc(e.location)}</span>` : ""}<span class="chev">${I.right}</span></button>`).join("");
}

function monthView() {
  const sel = ui.selected;
  const start = new Date(sel.getFullYear(), sel.getMonth(), 1);
  const lead = (start.getDay() - firstWeekday + 7) % 7;
  const ws = weekStart(sel);
  const today = new Date();
  let cells = "";
  for (let n = 0; n < 7; n++) cells += `<div class="wd">${fmt(addDays(ws, n), { weekday: "short" })}</div>`;
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i - lead);
    const inMonth = d.getMonth() === sel.getMonth();
    const items = store.forDay(d);
    const isSel = sameDay(d, sel);
    cells += `<button class="cell ${isSel ? "sel" : ""}" data-day="${d.getTime()}" aria-label="${fmt(d, { weekday: "long", day: "numeric", month: "long" })}${items.length ? `, ${items.length} events` : ""}">
      <span class="num ${sameDay(d, today) ? "today" : inMonth ? "" : "out"}">${d.getDate()}</span>${items.length ? '<span class="dot"></span>' : ""}
      ${items.slice(0, 2).map((e) => `<span class="chip">${esc(e.title)}</span>`).join("")}</button>`;
  }
  return `<div class="scroll"><div class="pad"><div class="grid7">${cells}</div>
    <div class="selhead"><b>Selected day</b><span>${fmt(sel, { weekday: "short", month: "short", day: "numeric" })}</span></div>
    <div class="rows">${eventRows(store.forDay(sel))}</div></div></div>`;
}
function weekView() {
  const ws = weekStart(ui.selected);
  let out = "";
  for (let i = 0; i < 7; i++) { const d = addDays(ws, i); out += `<h3 class="dayhead">${fmt(d, { weekday: "long", month: "short", day: "numeric" })}</h3><div class="rows">${eventRows(store.forDay(d))}</div>`; }
  return `<div class="scroll"><div class="pad">${out}</div></div>`;
}
const dayView = () => `<div class="scroll"><div class="pad"><h2 class="dayhead big">${fmt(ui.selected, { weekday: "long", month: "long", day: "numeric" })}</h2><div class="rows">${eventRows(store.forDay(ui.selected))}</div></div></div>`;
function yearView() {
  const y = ui.selected.getFullYear();
  let out = "";
  for (let m = 0; m < 12; m++) {
    const d = new Date(y, m, 1);
    const n = store.events.filter((e) => e.start.getFullYear() === y && e.start.getMonth() === m).length;
    out += `<button class="ycard" data-month="${d.getTime()}"><b>${fmt(d, { month: "long" })}</b><small>${n} events</small><span class="grow"></span><span class="view">${I.arrowUR}View month</span></button>`;
  }
  return `<div class="scroll"><div class="pad"><div class="ygrid">${out}</div></div></div>`;
}
function agendaView() {
  const q = ui.query.toLowerCase();
  const matches = store.events.filter((e) => !q || e.title.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q)).sort((a, b) => a.start - b.start);
  return `<div class="scroll"><div class="pad"><input class="field" data-bind="query" placeholder="Search events..." aria-label="Search events" value="${esc(ui.query)}"><div class="rows" id="agenda-rows">${eventRows(matches)}</div></div></div>`;
}
function tasksView() {
  return `<div class="scroll"><div class="pad"><div class="hrow"><input class="field grow" data-bind="newTask" data-submit="add-task" placeholder="What needs to be done?" aria-label="New task" value="${esc(ui.newTask)}"><button class="prominent" data-act="add-task">Add task</button></div>
    ${store.tasks.map((t) => `<div class="card task"><button class="tick ${t.complete ? "done" : ""}" data-toggle="${t.id}" aria-label="${t.complete ? "Mark not done" : "Mark done"}">${t.complete ? I.checkFill : I.circle}</button><span class="grow ${t.complete ? "struck" : ""}">${esc(t.title)}</span><button class="icon danger" data-deltask="${t.id}" aria-label="Delete task">${I.trash}</button></div>`).join("")}</div></div>`;
}
function conversationView() {
  return `<div class="scroll"><div class="pad">
    <h2 class="h2">${I.privacy}Private conversation scheduling</h2><p class="muted">${esc(ui.note)}</p>
    <textarea class="paste" data-bind="pasted" aria-label="Conversation">${esc(ui.pasted)}</textarea>
    <div class="hrow"><button class="prominent" data-act="scan">Find date suggestions</button><button class="bordered" data-act="clear-conv">Clear conversation</button></div>
    ${ui.proposals.map((p, i) => `<div class="card proposal"><span class="pi">${I.calPlus}</span><span class="grow"><b>${esc(p.title)}</b><small>${fmtAbbrevDateTime(p.start)}</small></span><button class="prominent" data-addprop="${i}">Add to Lenda</button></div>`).join("")}
    <p class="caption">Suggestions are not AI-verified. Confirm all dates yourself; nothing is scheduled until you approve.</p></div></div>`;
}
function connectedView() {
  return `<div class="scroll"><div class="pad">
    <div class="hrow"><div class="grow"><h2 class="h2 plain">Connected Apps</h2><p class="caption">Read-only installation discovery. Installed does not mean synchronised.</p></div><button class="bordered" data-act="rescan">${I.reload}Rescan</button></div>
    <p class="caption small">Last scan: ${fmt(ui.checked, { hour: "numeric", minute: "2-digit", second: "2-digit" })}</p>
    ${CONNECTED.map((n) => {
      const found = !!ui.installed[n];
      const lenda = n === "Lenda";
      return `<div class="card app"><span class="ai">${lenda ? I.month : I.connected}</span><span class="grow"><b>${esc(n)}</b><small>${lenda ? "Local calendar available" : found ? "Installed • Integration not configured" : "Not installed at standard application paths"}</small></span><span class="${lenda ? "ok" : "muted"}">${lenda ? I.checkFill : found ? I.minus : I.question}</span></div>`;
    }).join("")}
    <p class="caption">Two-way synchronisation and private message access require compatible, authenticated integrations. No such integration is enabled yet.</p></div></div>`;
}
const info = (t, d) => `<div class="info"><b>${esc(t)}</b><span>${esc(d)}</span></div>`;
const syncView = () => `<div class="scroll"><div class="pad"><h2 class="h2">${I.sync}Synchronisation</h2><p class="muted">Local storage is active. No remote or inter-application synchronisation has been configured.</p>
  <div class="hrow"><button class="prominent" data-act="import">${I.down}Import calendar (.ics)</button><button class="prominent" data-act="export">${I.up}Export calendar (.ics)</button></div>
  ${info("Local calendar", "Available offline")}${info("Active", "Installed; authenticated event interface not yet implemented")}${info("Syncro", "Installed; two-way calendar interface not yet implemented")}${info("Other applications", "Requires verified adapters and explicit authorisation")}${info("Conflicts / offline queue", "Not yet implemented")}</div></div>`;
const privacyView = () => `<div class="scroll"><div class="pad"><h2 class="h2">${I.privacy}Privacy and permissions</h2>
  ${info("Website assistant", "Local copy of the existing George FAQ matcher; requests stay on this computer")}${info("Messages", "Not automatically accessed from any application")}${info("Scheduling suggestions", "Manual approval is required")}${info("Calendar storage", "Local JSON file; access restricted to account, NOT encrypted at rest")}${info("Cross-application permissions", "No external application has been authorised")}${info("Third-party model access", "Disabled; no external model API calls")}
  <p class="caption top">Lenda does not claim end-to-end encryption or complete integration. Encrypted storage, authenticated sync and automatic scheduling are future work.</p></div></div>`;

function editorView() {
  const d = ui.editor.draft;
  const ok = d.title.trim() && d.end >= d.start;
  return `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${ui.editor.event ? "Edit event" : "New event"}">
    <h2>${ui.editor.event ? "Edit event" : "New event"}</h2>
    <input class="field" data-ed="title" placeholder="Event title" aria-label="Event title" value="${esc(d.title)}">
    <label class="dp"><span>Starts</span><input type="date" data-ed="startDate" value="${dateInput(d.start)}"><input type="time" data-ed="startTime" value="${timeInput(d.start)}"></label>
    <label class="dp"><span>Ends</span><input type="date" data-ed="endDate" value="${dateInput(d.end)}" min="${dateInput(d.start)}"><input type="time" data-ed="endTime" value="${timeInput(d.end)}"></label>
    <input class="field" data-ed="location" placeholder="Location (optional)" aria-label="Location" value="${esc(d.location)}">
    <label class="dp"><span>Calendar</span><select data-ed="category">${["Personal", "University", "Work", "Training", "Other"].map((c) => `<option ${c === d.category ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    <span class="muted">Notes</span><textarea class="notes" data-ed="notes" aria-label="Notes">${esc(d.notes)}</textarea>
    <div class="hrow">${ui.editor.event ? '<button class="bordered danger" data-act="delete-event">Delete</button>' : ""}<span class="grow"></span><button class="bordered" data-act="cancel-edit">Cancel</button><button class="prominent" data-act="save-event" ${ok ? "" : "disabled"}>Save event</button></div>
  </div></div>`;
}

function georgePanel() {
  const g = ui.george;
  return `<div class="george ${g.open ? "open" : ""}" aria-hidden="${!g.open}">
    <div class="ghead">${I.sparkles}<div class="grow"><b>ShouldBe • George</b><small>Original website FAQ engine • Runs locally • No cloud transmission</small></div><span class="local">${I.shieldFill}Local</span><button class="icon" data-act="george-close" title="Minimise George" aria-label="Minimise George assistant">${I.x}</button></div>
    <div class="glines" id="glines">${g.lines.map((l) => `<div class="gl ${l.owner === "You" ? "you" : ""}"><div class="gb"><b>${esc(l.owner)}</b><p>${esc(l.message)}</p></div></div>`).join("")}</div>
    <div class="ginput"><input class="field grow" data-bind="george" data-submit="george-send" placeholder="Ask George about ShouldBe..." aria-label="Ask George" value="${esc(g.input)}" ${g.busy ? "disabled" : ""}>${g.busy ? '<span class="spin"></span>' : ""}<button class="prominent" data-act="george-send" ${g.busy || !g.input.trim() ? "disabled" : ""}>Send</button></div>
    <p class="gfoot">No messaging app or calendar data is sent to George. AI model integration is not implemented.</p>
  </div>
  <button class="launcher" data-act="george-toggle" title="${g.open ? "Minimise George" : "Chat with George"}" aria-label="${g.open ? "Minimise George assistant" : "Open George assistant"}"><img src="george-icon.png" alt=""></button>`;
}

function render() {
  const a = document.activeElement;
  const key = a?.dataset?.bind || (a?.dataset?.ed && "ed:" + a.dataset.ed);
  const sel = key && "selectionStart" in a && a.type !== "date" && a.type !== "time" ? [a.selectionStart, a.selectionEnd] : null;
  const scroller = document.querySelector(".main .scroll");
  const st = scroller?.scrollTop;
  const nav = ["month", "week", "day", "year", "agenda"].includes(ui.mode);
  const body = { month: monthView, week: weekView, day: dayView, year: yearView, agenda: agendaView, tasks: tasksView, conversations: conversationView, connected: connectedView, sync: syncView, privacy: privacyView }[ui.mode]();
  $app.innerHTML = `<div class="split">
    <nav class="sidebar"><div class="brand">${I.logo}<div><b>Lenda</b><small>YOUR PRIVATE CALENDAR</small></div></div>
      ${MODES.map(([k, l]) => `<button class="mode ${ui.mode === k ? "sel" : ""}" data-mode="${k}" aria-current="${ui.mode === k}">${I[k]}<span>${l}</span></button>`).join("")}
      <span class="grow"></span>
      <div class="offline"><span class="green">${I.shieldFill}Offline and local</span><small>George FAQ is local. Messages stay private. Active and Syncro remain disconnected.</small></div>
    </nav>
    <main class="main"><header class="top"><div class="grow"><h1>${esc(titleText())}</h1><small>${fmt(new Date(), { weekday: "long", month: "long", day: "numeric" })}</small></div>
      ${nav ? `<button class="bordered" data-act="prev" aria-label="Previous">${I.left}</button><button class="bordered" data-act="today">Today</button><button class="bordered" data-act="next" aria-label="Next">${I.right}</button>` : ""}
      <button class="bordered" data-act="import">${I.down}Import</button><button class="bordered" data-act="export">${I.up}Export</button><button class="prominent" data-act="new-event">${I.plus}New Event</button></header>
      ${body}</main></div>
    ${georgePanel()}${ui.editor ? editorView() : ""}${store.message ? `<div class="scrim"><div class="alert" role="alertdialog" aria-modal="true"><b>Lenda</b><p>${esc(store.message)}</p><button class="prominent" data-act="close-alert">OK</button></div></div>` : ""}`;
  if (key) {
    const el = key.startsWith("ed:") ? document.querySelector(`[data-ed="${key.slice(3)}"]`) : document.querySelector(`[data-bind="${key}"]`);
    if (el) { el.focus(); if (sel) try { el.setSelectionRange(...sel); } catch {} }
  }
  const sc = document.querySelector(".main .scroll");
  if (sc && st) sc.scrollTop = st;
  const gl = document.getElementById("glines");
  if (gl) gl.scrollTop = gl.scrollHeight;
}

// ---------------- actions ----------------
function step(dir) {
  const m = ui.mode;
  ui.selected = m === "year" ? addMonths(ui.selected, 12 * dir) : m === "month" ? addMonths(ui.selected, dir) : addDays(ui.selected, dir);
  render();
}
function openEditor(event) {
  const base = event || { title: "", start: new Date(ui.selected), end: new Date(ui.selected.getTime() + 3600000), location: "", notes: "", category: "Personal" };
  ui.editor = { event, draft: { ...base, start: new Date(base.start), end: new Date(base.end) } };
  render();
  document.querySelector('[data-ed="title"]')?.focus();
}
function saveEditor() {
  const { event, draft: d } = ui.editor;
  const s = d.title.trim();
  if (!s || d.end < d.start) return;
  store.upsert({ id: event?.id ?? uuid(), title: s, start: d.start, end: d.end, location: d.location, notes: d.notes, category: d.category });
  ui.editor = null;
  render();
}
function scan() {
  ui.proposals = [];
  if (!ui.pasted.trim()) { ui.note = "Enter an authorised message or conversation first."; render(); return; }
  const lowered = ui.pasted.toLowerCase();
  for (const m of detectDates(ui.pasted).slice(0, 12)) {
    if (lowered.includes("cancelled") || lowered.includes("canceled") || lowered.includes("hypothetical")) continue;
    ui.proposals.push({ title: "Discussed: " + m.text, start: m.date });
  }
  ui.note = ui.proposals.length ? `${ui.proposals.length} potential dates found. Check before adding.` : "No supported date expressions detected. You can still add events manually.";
  render();
}
async function rescan() {
  ui.checked = new Date();
  ui.installed = await sb.invoke("lenda:installed", CONNECTED).catch(() => ({}));
  render();
}
function calendarAnswer(question) {
  const q = question.toLowerCase();
  if (q.includes("what") && q.includes("today") && (q.includes("plan") || q.includes("scheduled") || q.includes("calendar"))) {
    const evs = store.forDay(new Date());
    return evs.length ? evs.map((e) => `• ${e.title} — ${fmtTime(e.start)}`).join("\n") : "No events scheduled in Lenda today.";
  }
  if (q.includes("unfinished") && q.includes("task")) {
    const ts = store.tasks.filter((t) => !t.complete);
    return ts.length ? ts.map((t) => `• ${t.title}`).join("\n") : "No unfinished tasks.";
  }
  return null;
}
async function georgeSend() {
  const g = ui.george;
  const question = g.input.trim();
  if (!question || g.busy) return;
  g.input = "";
  g.lines.push({ owner: "You", message: question });
  // A limited set of calendar commands is processed locally, not by the George website FAQ.
  const local = calendarAnswer(question);
  if (local != null) { g.lines.push({ owner: "Lenda local calendar", message: local }); render(); return; }
  g.busy = true;
  render();
  let answer;
  try { answer = await sb.invoke("lenda:george", question); }
  catch (e) { answer = `George is unavailable: ${String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")}`; }
  g.lines.push({ owner: "George", message: answer });
  g.busy = false;
  render();
  document.querySelector('[data-bind="george"]')?.focus();
}
function toggleGeorge(open = !ui.george.open) {
  ui.george.open = open;
  render();
  if (open) document.querySelector('[data-bind="george"]')?.focus();
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.mode) { ui.mode = d.mode; if (d.mode === "connected") rescan(); render(); return; }
  if (d.day) { ui.selected = new Date(+d.day); render(); return; }
  if (d.month) { ui.selected = new Date(+d.month); ui.mode = "month"; render(); return; }
  if (d.edit) { openEditor(store.events.find((x) => x.id === d.edit)); return; }
  if (d.toggle) { store.toggle(d.toggle); render(); return; }
  if (d.deltask) { store.removeTask(d.deltask); render(); return; }
  if (d.addprop) {
    const i = +d.addprop, p = ui.proposals[i];
    store.upsert({ id: uuid(), title: p.title, start: p.start, end: new Date(p.start.getTime() + 3600000), location: "", notes: "", category: "Personal" });
    ui.proposals.splice(i, 1);
    render();
    return;
  }
  switch (d.act) {
    case "prev": return step(-1);
    case "next": return step(1);
    case "today": ui.selected = new Date(); return render();
    case "import": return store.importICS();
    case "export": return store.exportICS();
    case "new-event": return openEditor(null);
    case "cancel-edit": ui.editor = null; return render();
    case "save-event": return saveEditor();
    case "delete-event": store.remove(ui.editor.event); ui.editor = null; return render();
    case "add-task": store.addTask(ui.newTask); ui.newTask = ""; return render();
    case "scan": return scan();
    case "clear-conv": ui.pasted = ""; ui.proposals = []; return render();
    case "rescan": return rescan();
    case "close-alert": store.message = ""; return render();
    case "george-toggle": return toggleGeorge();
    case "george-close": return toggleGeorge(false);
    case "george-send": return georgeSend();
  }
});
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.bind) {
    const k = el.dataset.bind;
    if (k === "george") { ui.george.input = el.value; const b = document.querySelector('[data-act="george-send"]'); if (b) b.disabled = ui.george.busy || !el.value.trim(); return; }
    if (k === "query") { ui.query = el.value; render(); return; }
    ui[k] = el.value; // newTask, pasted: no re-render needed
    return;
  }
  if (el.dataset.ed && ui.editor) {
    const d = ui.editor.draft, k = el.dataset.ed;
    const setDate = (dt, v) => { const [y, m, dd] = v.split("-").map(Number); if (y) dt.setFullYear(y, m - 1, dd); };
    const setTime = (dt, v) => { const [h, mi] = v.split(":").map(Number); if (!isNaN(h)) dt.setHours(h, mi || 0, 0, 0); };
    if (k === "startDate") { const len = d.end - d.start; setDate(d.start, el.value); if (d.end < d.start) d.end = new Date(d.start.getTime() + Math.max(len, 0)); }
    else if (k === "startTime") { setTime(d.start, el.value); if (d.end < d.start) d.end = new Date(d.start.getTime() + 3600000); }
    else if (k === "endDate") setDate(d.end, el.value);
    else if (k === "endTime") setTime(d.end, el.value);
    else d[k] = el.value;
    const ok = d.title.trim() && d.end >= d.start;
    const btn = document.querySelector('[data-act="save-event"]');
    if (btn) btn.disabled = !ok;
    if (["startDate", "startTime"].includes(k)) { const ed = document.querySelector('[data-ed="endDate"]'), et = document.querySelector('[data-ed="endTime"]'); ed.value = dateInput(d.end); ed.min = dateInput(d.start); et.value = timeInput(d.end); }
  }
});
document.addEventListener("keydown", (e) => {
  const el = e.target;
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "g") { e.preventDefault(); toggleGeorge(); return; }
  if (e.key === "Escape") {
    if (store.message) { store.message = ""; render(); }
    else if (ui.editor) { ui.editor = null; render(); }
    else if (ui.george.open) toggleGeorge(false);
    return;
  }
  if (e.key === "Enter" && el.dataset?.submit) {
    e.preventDefault();
    if (el.dataset.submit === "add-task") { store.addTask(ui.newTask); ui.newTask = ""; render(); }
    if (el.dataset.submit === "george-send") georgeSend();
  }
  if (e.key === "Enter" && ui.editor && el.dataset?.ed === "title") { e.preventDefault(); saveEditor(); }
});

await store.load();
render();
rescan();
window.__lenda = { store, ui, render, scan, georgeSend, toggleGeorge, detectDates, fromSwift, toSwift };
