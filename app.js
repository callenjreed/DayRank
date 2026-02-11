const STORAGE_KEY = "dayrank_entries_v1";

const el = (id) => document.getElementById(id);

const listEl = el("list");
const emptyEl = el("empty");
const statsLineEl = el("statsLine");

const addBtn = el("addBtn");
const exportBtn = el("exportBtn");
const importFile = el("importFile");

const modalBackdrop = el("modalBackdrop");
const modalTitle = el("modalTitle");
const entryForm = el("entryForm");
const dateInput = el("dateInput");
const scoreInput = el("scoreInput");
const notesInput = el("notesInput");
const cancelBtn = el("cancelBtn");
const dangerRow = el("dangerRow");
const deleteBtn = el("deleteBtn");

const searchInput = el("searchInput");

const sortButtons = Array.from(document.querySelectorAll(".seg-btn[data-sort]"));
const tabButtons = Array.from(document.querySelectorAll(".tab"));
const tabDays = el("tab-days");
const tabStats = el("tab-stats");

// Stats elements
const avgAll = el("avgAll");
const avgWeek = el("avgWeek");
const avgMonth = el("avgMonth");
const avgYear = el("avgYear");
const bestDay = el("bestDay");
const worstDay = el("worstDay");
const countDays = el("countDays");
const streakEl = el("streak");
const top10List = el("top10List");
const top10Hint = el("top10Hint");
const distBars = el("distBars");

// Trend chart + range toggle
const trendChart = el("trendChart");
const chartHint = el("chartHint");
const rangeSeg = el("rangeSeg");
const rangeButtons = rangeSeg ? Array.from(rangeSeg.querySelectorAll(".seg-btn")) : [];

let entries = loadEntries();
let currentSort = "score"; // "score" | "date"
let currentRange = "30";   // "30" | "90" | "all"
let editingId = null;

initPWA();
wireUI();
renderAll();

function initPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

function wireUI() {
  addBtn.addEventListener("click", () => openModalForNew());
  cancelBtn.addEventListener("click", closeModal);
  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  entryForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const dateStr = dateInput.value;
    const score = clampInt(scoreInput.value, 0, 100);
    const notes = (notesInput.value || "").trim();

    if (!dateStr || Number.isNaN(score)) return;

    if (editingId) {
      const idx = entries.findIndex(x => x.id === editingId);
      if (idx >= 0) {
        entries[idx].date = dateStr;
        entries[idx].score = score;
        entries[idx].notes = notes;
        entries[idx].updatedAt = Date.now();
      }
    } else {
      entries.push({
        id: crypto.randomUUID(),
        date: dateStr,        // YYYY-MM-DD
        score,
        notes,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    saveEntries(entries);
    closeModal();
    renderAll();
  });

  deleteBtn.addEventListener("click", () => {
    if (!editingId) return;
    entries = entries.filter(x => x.id !== editingId);
    saveEntries(entries);
    closeModal();
    renderAll();
  });

  sortButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sortButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSort = btn.dataset.sort;
      renderAll();
    });
  });

  searchInput.addEventListener("input", () => renderList());

  exportBtn.addEventListener("click", exportData);
  importFile.addEventListener("change", importData);

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      if (tab === "days") {
        tabDays.classList.remove("hidden");
        tabStats.classList.add("hidden");
      } else {
        tabDays.classList.add("hidden");
        tabStats.classList.remove("hidden");
      }
      renderAll();
    });
  });

  rangeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      rangeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentRange = btn.dataset.range;
      renderAll();
    });
  });
}

function openModalForNew() {
  editingId = null;
  modalTitle.textContent = "New Entry";
  dangerRow.classList.add("hidden");
  dateInput.value = todayLocalISO();
  scoreInput.value = 50;
  notesInput.value = "";
  modalBackdrop.classList.remove("hidden");
  setTimeout(() => scoreInput.focus(), 50);
}

function openModalForEdit(entry) {
  editingId = entry.id;
  modalTitle.textContent = "Edit Entry";
  dangerRow.classList.remove("hidden");
  dateInput.value = entry.date;
  scoreInput.value = entry.score;
  notesInput.value = entry.notes || "";
  modalBackdrop.classList.remove("hidden");
  setTimeout(() => notesInput.focus(), 50);
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
}

function renderAll() {
  renderHeaderLine();
  renderList();
  renderStats();
}

function renderHeaderLine() {
  if (entries.length === 0) {
    statsLineEl.textContent = "Offline • 0 days logged";
    return;
  }
  const avg = average(entries.map(e => e.score));
  const best = entries.reduce((a,b)=> b.score>a.score?b:a, entries[0]).score;
  statsLineEl.textContent = `Offline • ${entries.length} days • Avg ${fmt1(avg)} • Best ${best}`;
}

function renderList() {
  const q = (searchInput.value || "").trim().toLowerCase();

  let filtered = entries.slice();
  if (q) filtered = filtered.filter(e => (e.notes || "").toLowerCase().includes(q));

  filtered.sort((a, b) => {
    if (currentSort === "date") {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      if (a.score !== b.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    }
    if (a.score !== b.score) return b.score - a.score;
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.updatedAt - a.updatedAt;
  });

  listEl.innerHTML = "";
  if (filtered.length === 0) {
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  for (const e of filtered) {
    const card = document.createElement("div");
    card.className = "card";
    card.addEventListener("click", () => openModalForEdit(e));

    const scoreBox = document.createElement("div");
    scoreBox.className = "scoreBox";
    scoreBox.textContent = e.score;
    scoreBox.style.background = scoreBg(e.score);

    const main = document.createElement("div");
    main.className = "cardMain";

    const titleRow = document.createElement("div");
    titleRow.className = "cardTitleRow";

    const title = document.createElement("p");
    title.className = "cardTitle";
    title.textContent = formatDatePretty(e.date);

    const meta = document.createElement("span");
    meta.className = "cardMeta";
    meta.textContent = labelForScore(e.score);

    titleRow.appendChild(title);
    titleRow.appendChild(meta);

    const notes = document.createElement("p");
    notes.className = "cardNotes";
    notes.textContent = (e.notes && e.notes.trim().length) ? e.notes : "No notes";

    main.appendChild(titleRow);
    main.appendChild(notes);

    card.appendChild(scoreBox);
    card.appendChild(main);

    listEl.appendChild(card);
  }
}

/* ---------------- STATS + TREND ---------------- */

function renderStats() {
  const allScores = entries.map(e => e.score);

  countDays.textContent = entries.length ? String(entries.length) : "—";
  avgAll.textContent = entries.length ? fmt1(average(allScores)) : "—";

  const now = new Date();
  const weekScores = scoresInRange(entries, startOfWeek(now), endOfWeek(now));
  const monthScores = scoresInRange(entries, startOfMonth(now), endOfMonth(now));
  const yearScores = scoresInRange(entries, startOfYear(now), endOfYear(now));

  avgWeek.textContent = weekScores.length ? fmt1(average(weekScores)) : "—";
  avgMonth.textContent = monthScores.length ? fmt1(average(monthScores)) : "—";
  avgYear.textContent = yearScores.length ? fmt1(average(yearScores)) : "—";

  if (entries.length) {
    const sortedByScore = entries.slice().sort((a,b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.date.localeCompare(a.date);
    });

    const best = sortedByScore[0];
    const worst = sortedByScore[sortedByScore.length - 1];

    bestDay.textContent = `${best.score} • ${formatDatePretty(best.date)}`;
    worstDay.textContent = `${worst.score} • ${formatDatePretty(worst.date)}`;

    renderTop10(sortedByScore.slice(0, 10));
    renderDistribution(entries);
    streakEl.textContent = String(calcStreak(entries));

    renderTrendChart(entries);
  } else {
    bestDay.textContent = "—";
    worstDay.textContent = "—";
    top10List.innerHTML = "";
    top10Hint.textContent = "—";
    distBars.innerHTML = "";
    streakEl.textContent = "—";
    clearTrendChart();
  }
}

function renderTop10(top) {
  top10List.innerHTML = "";
  top10Hint.textContent = top.length ? `${top.length} shown` : "No data";

  for (const e of top) {
    const row = document.createElement("div");
    row.className = "topItem";
    row.addEventListener("click", () => openModalForEdit(e));

    const s = document.createElement("div");
    s.className = "score";
    s.textContent = e.score;
    s.style.background = scoreBg(e.score);

    const main = document.createElement("div");
    main.className = "main";

    const d = document.createElement("div");
    d.className = "date";
    d.textContent = formatDatePretty(e.date);

    const note = document.createElement("div");
    note.className = "note";
    note.textContent = (e.notes && e.notes.trim().length) ? e.notes : "No notes";

    main.appendChild(d);
    main.appendChild(note);

    row.appendChild(s);
    row.appendChild(main);
    top10List.appendChild(row);
  }
}

function renderDistribution(entries) {
  const buckets = [
    { label: "90–100", count: 0 },
    { label: "75–89", count: 0 },
    { label: "60–74", count: 0 },
    { label: "40–59", count: 0 },
    { label: "0–39",  count: 0 }
  ];

  for (const e of entries) {
    const s = e.score;
    if (s >= 90) buckets[0].count++;
    else if (s >= 75) buckets[1].count++;
    else if (s >= 60) buckets[2].count++;
    else if (s >= 40) buckets[3].count++;
    else buckets[4].count++;
  }

  const max = Math.max(1, ...buckets.map(b => b.count));
  distBars.innerHTML = "";

  for (const b of buckets) {
    const row = document.createElement("div");
    row.className = "distRow";

    const label = document.createElement("div");
    label.className = "distLabel";
    label.textContent = b.label;

    const bar = document.createElement("div");
    bar.className = "distBar";

    const fill = document.createElement("div");
    fill.className = "distFill";
    fill.style.width = `${Math.round((b.count / max) * 100)}%`;

    bar.appendChild(fill);

    const count = document.createElement("div");
    count.className = "distCount";
    count.textContent = String(b.count);

    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(count);

    distBars.appendChild(row);
  }
}

/* ---------------- TREND CHART ---------------- */

function clearTrendChart(){
  if (!trendChart) return;
  const ctx = trendChart.getContext("2d");
  ctx.clearRect(0, 0, trendChart.width, trendChart.height);
  if (chartHint) chartHint.textContent = "—";
}

function renderTrendChart(entries){
  if (!trendChart) return;

  // Keep latest score per date (if duplicates exist)
  const byDate = new Map();
  for (const e of entries.slice().sort((a,b)=>a.updatedAt-b.updatedAt)) {
    byDate.set(e.date, e.score);
  }

  let dates = Array.from(byDate.keys()).sort();

  if (currentRange !== "all") {
    const keep = parseInt(currentRange, 10); // 30 or 90
    dates = dates.slice(Math.max(0, dates.length - keep));
  }

  const series = dates.map(d => ({ date: d, score: byDate.get(d) }));

  if (!series.length) {
    clearTrendChart();
    return;
  }

  if (chartHint) {
    const first = series[0].date;
    const last = series[series.length-1].date;
    chartHint.textContent = `${series.length} days • ${formatDatePretty(first)} → ${formatDatePretty(last)}`;
  }

  const ctx = trendChart.getContext("2d");

  const W = trendChart.width;
  const H = trendChart.height;
  ctx.clearRect(0, 0, W, H);

  const padL = 44, padR = 16, padT = 16, padB = 34;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const yMin = 0, yMax = 100;

  const xForIndex = (i, n) => padL + (n <= 1 ? innerW/2 : (i / (n - 1)) * innerW);
  const yForScore = (s) => padT + (1 - (s - yMin) / (yMax - yMin)) * innerH;

  // Grid lines + y labels
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 1;
  ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial";
  ctx.fillStyle = "rgba(255,255,255,.55)";

  const ticks = [0,25,50,75,100];
  for (const t of ticks) {
    const y = yForScore(t);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillText(String(t), 10, y + 4);
  }
  ctx.restore();

  // X axis baseline
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,.16)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, H - padB);
  ctx.lineTo(W - padR, H - padB);
  ctx.stroke();
  ctx.restore();

  const scores = series.map(p => p.score);
  const roll = rollingAvg(scores, 7);

  // Rolling avg (gray)
  drawLine(ctx, series, roll, xForIndex, yForScore, "rgba(255,255,255,.65)", 3);

  // Daily score (blue)
  drawLine(ctx, series, scores, xForIndex, yForScore, "rgba(79,124,255,.90)", 2);

  // Points
  ctx.save();
  for (let i = 0; i < series.length; i++) {
    const x = xForIndex(i, series.length);
    const y = yForScore(series[i].score);
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(79,124,255,.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // X labels (first/mid/last)
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial";
  const labelIdx = uniqueLabelIndices(series.length);
  for (const i of labelIdx) {
    const x = xForIndex(i, series.length);
    const label = shortMD(series[i].date);
    const w = ctx.measureText(label).width;
    ctx.fillText(label, x - w/2, H - 12);
  }
  ctx.restore();
}

function drawLine(ctx, series, values, xForIndex, yForScore, stroke, width){
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i < series.length; i++) {
    const x = xForIndex(i, series.length);
    const y = yForScore(values[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function rollingAvg(nums, window){
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = nums.slice(start, i + 1);
    out.push(slice.reduce((a,b)=>a+b,0) / slice.length);
  }
  return out;
}

function uniqueLabelIndices(n){
  if (n <= 1) return [0];
  if (n === 2) return [0,1];
  const mid = Math.floor((n - 1) / 2);
  return [0, mid, n - 1];
}

function shortMD(isoDate){
  const [y,m,d] = isoDate.split("-").map(Number);
  return `${m}/${d}`;
}

/* ---------------- EXPORT / IMPORT ---------------- */

function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `dayrank-export-${todayLocalISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function importData(evt) {
  const file = evt.target.files && evt.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      if (!parsed || !Array.isArray(parsed.entries)) throw new Error("Bad format");

      const cleaned = parsed.entries
        .filter(x => x && x.id && x.date && typeof x.score === "number")
        .map(x => ({
          id: String(x.id),
          date: String(x.date).slice(0,10),
          score: clampInt(x.score, 0, 100),
          notes: String(x.notes || ""),
          createdAt: Number(x.createdAt || Date.now()),
          updatedAt: Number(x.updatedAt || Date.now())
        }));

      entries = cleaned;
      saveEntries(entries);
      renderAll();
      alert("Import complete ✅");
    } catch {
      alert("Import failed — file format not recognized.");
    } finally {
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

/* ---------------- STORAGE + HELPERS ---------------- */

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(x => ({
      id: String(x.id),
      date: String(x.date).slice(0,10),
      score: clampInt(x.score, 0, 100),
      notes: String(x.notes || ""),
      createdAt: Number(x.createdAt || Date.now()),
      updatedAt: Number(x.updatedAt || Date.now())
    }));
  } catch {
    return [];
  }
}

function saveEntries(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function average(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a,b)=>a+b,0) / nums.length;
}

function fmt1(n) {
  return (Math.round(n * 10) / 10).toFixed(1);
}

function todayLocalISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDatePretty(isoDate) {
  const [y,m,d] = isoDate.split("-").map(Number);
  const dt = new Date(y, (m-1), d);
  return dt.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric", year:"numeric" });
}

function labelForScore(score) {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Good";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Rough";
  return "Bad";
}

function scoreBg(score) {
  if (score >= 90) return "rgba(34,197,94,.22)";
  if (score >= 75) return "rgba(16,185,129,.20)";
  if (score >= 60) return "rgba(234,179,8,.18)";
  if (score >= 40) return "rgba(249,115,22,.18)";
  return "rgba(239,68,68,.18)";
}

function toISODate(dt) {
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth()+1).padStart(2,"0");
  const dd = String(dt.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function startOfWeek(dt) {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Mon-start week
  d.setDate(d.getDate() - diff);
  return d;
}
function endOfWeek(dt) {
  const s = startOfWeek(dt);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return e;
}
function startOfMonth(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), 1);
}
function endOfMonth(dt) {
  return new Date(dt.getFullYear(), dt.getMonth()+1, 0);
}
function startOfYear(dt) {
  return new Date(dt.getFullYear(), 0, 1);
}
function endOfYear(dt) {
  return new Date(dt.getFullYear(), 11, 31);
}
function scoresInRange(entries, startDt, endDt) {
  const startISO = toISODate(startDt);
  const endISO = toISODate(endDt);
  return entries
    .filter(e => e.date >= startISO && e.date <= endISO)
    .map(e => e.score);
}

// Streak = consecutive logged days ending on most recent logged day
function calcStreak(entries) {
  if (!entries.length) return 0;
  const dates = new Set(entries.map(e => e.date));
  const sorted = Array.from(dates).sort(); // ascending
  let cursor = sorted[sorted.length - 1]; // most recent logged date
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = prevISO(cursor);
  }
  return streak;
}
function prevISO(iso) {
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate() - 1);
  return toISODate(dt);
}
