// Finds dates and times written in a conversation, standing in for macOS NSDataDetector
// (which Lenda's "Find date suggestions" uses on the Mac). English phrases it understands:
//   today / tonight / tomorrow, (next/this) Monday…Sunday, 5 November [2027], November 5th [2027],
//   2026-11-05, 05/11/2026 (day/month/year), each optionally followed by a time
//   ("at 3pm", "3:30 pm", "15:00", "noon"), or a time on its own ("at 7pm" = today).
// A date without a time gets 12:00, like NSDataDetector.
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday)";
const TIME = "(?:\\s*(?:,\\s*)?(?:at|@|from|by)?\\s*(?:(noon|midday|midnight)|(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)?))";
const monthIndex = (s) => MONTHS.findIndex((m) => m.startsWith(s.toLowerCase().slice(0, 3)));

function applyTime(d, word, h, m, ap, requireMarker) {
  if (word) {
    const w = word.toLowerCase();
    d.setHours(w === "midnight" ? 0 : 12, 0, 0, 0);
    return true;
  }
  if (h == null) return false;
  let hour = Number(h);
  const min = m != null ? Number(m) : 0;
  const ampm = ap ? ap.toLowerCase().replace(/\./g, "") : null;
  if (requireMarker && !ampm && m == null) return false; // "on Friday 3" is too vague
  if (hour > 23 || min > 59) return false;
  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  if (ampm && Number(h) > 12) return false;
  d.setHours(hour, min, 0, 0);
  return true;
}

export function detectDates(text, now = new Date()) {
  const found = [];
  const taken = [];
  const free = (a, b) => taken.every(([x, y]) => b <= x || a >= y);
  const add = (index, raw, date) => {
    const t = raw.replace(/[\s,]+$/, "");
    if (!free(index, index + t.length) || isNaN(date)) return;
    taken.push([index, index + t.length]);
    found.push({ index, text: t, date });
  };
  const run = (re, make) => {
    for (const m of text.matchAll(re)) {
      const d = make(m);
      if (d) add(m.index, m[0], d);
    }
  };
  const base = () => { const d = new Date(now); d.setHours(12, 0, 0, 0); return d; };
  const withTime = (d, m, i, strict = true) => { if (!applyTime(d, m[i], m[i + 1], m[i + 2], m[i + 3], strict)) d.setHours(12, 0, 0, 0); return d; };

  // 2026-11-05 [time]
  run(new RegExp(`\\b(\\d{4})-(\\d{1,2})-(\\d{1,2})\\b${TIME}?`, "gi"), (m) => withTime(new Date(+m[1], +m[2] - 1, +m[3]), m, 4, false));
  // 05/11/2026 (day/month/year) [time]
  run(new RegExp(`\\b(\\d{1,2})[/.](\\d{1,2})[/.](\\d{2,4})\\b${TIME}?`, "gi"), (m) => {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    if (+m[2] > 12) return null;
    return withTime(new Date(y, +m[2] - 1, +m[1]), m, 4, false);
  });
  // 5 November [2027] / 5th of Nov [time]
  run(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}\\b(?:,?\\s+(\\d{4}))?${TIME}?`, "gi"), (m) => {
    const d = new Date(m[3] ? +m[3] : now.getFullYear(), monthIndex(m[2]), +m[1]);
    if (!m[3] && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() + 1);
    return withTime(d, m, 4);
  });
  // November 5th [, 2027] [time]
  run(new RegExp(`\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?${TIME}?`, "gi"), (m) => {
    const d = new Date(m[3] ? +m[3] : now.getFullYear(), monthIndex(m[1]), +m[2]);
    if (!m[3] && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d.setFullYear(d.getFullYear() + 1);
    return withTime(d, m, 4);
  });
  // today / tonight / tomorrow [time]
  run(new RegExp(`\\b(today|tonight|tomorrow)\\b${TIME}?`, "gi"), (m) => {
    const d = base();
    if (m[1].toLowerCase() === "tomorrow") d.setDate(d.getDate() + 1);
    if (!applyTime(d, m[2], m[3], m[4], m[5], true)) d.setHours(m[1].toLowerCase() === "tonight" ? 20 : 12, 0, 0, 0);
    return d;
  });
  // (next|this|on) Friday [time]
  run(new RegExp(`\\b(?:(next|this|on)\\s+)?${DAY}\\b${TIME}?`, "gi"), (m) => {
    const target = DAYS.findIndex((x) => x.startsWith(m[2].toLowerCase()));
    const d = base();
    let diff = (target - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    return withTime(d, m, 3);
  });
  // a time on its own: "at 7pm", "at 15:30", "3pm"
  run(/\b(?:at\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)(?![a-z])|\bat\s+(\d{1,2})[:.](\d{2})\b/gi, (m) => {
    const d = base();
    const ok = m[1] != null ? applyTime(d, null, m[1], m[2], m[3], false) : applyTime(d, null, m[4], m[5], null, false);
    return ok ? d : null;
  });
  return found.sort((a, b) => a.index - b.index);
}
