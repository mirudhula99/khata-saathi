// Khata Saathi merchant app (no build step).
import { api, h, inr, timeAgo } from "/static/common.js";

const $ = (s) => document.querySelector(s);
const state = { data: null, lang: "ta-IN", busy: false };
const KIND_LABEL = {
  add_credit: "Udhaar",
  record_repayment: "Payment received",
  cash_sale: "Cash sale",
  request_payment: "Payment link",
};
const LANG_NAMES = { "hi-IN": "हिन्दी", "kn-IN": "ಕನ್ನಡ", "ta-IN": "தமிழ்", "te-IN": "తెలుగు", "en-IN": "English" };
const HINTS = {
  "hi-IN": "माइक दबाकर बोलें: “Raju 200 udhaar”",
  "kn-IN": "ಮೈಕ್ ಒತ್ತಿ ಹೇಳಿ: “Priya ge 200 saala”",
  "ta-IN": "மைக்கை தட்டி சொல்லுங்கள்: “Lakshmi ku 150 udhaar”",
  "te-IN": "మైక్ నొక్కి చెప్పండి: “Suresh ki 200 appu”",
  "en-IN": "Tap the mic and say “Lakshmi 150 udhaar”",
};

// ------------------------------------------------------------ audio out
const player = new Audio();
let audioUnlocked = false;
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  player.src = SILENT_WAV;
  player.play().catch(() => {});
}
function browserSpeak(text, lang) {
  if (!text || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang || "en-IN";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
function speak(text, url, lang) {
  if (url) {
    player.src = url;
    player.play().catch(() => browserSpeak(text, lang));
  } else {
    browserSpeak(text, lang);
  }
}

// ------------------------------------------------------------ state + render
async function refresh() {
  state.data = await api("/api/state");
  render();
}

function render() {
  const { merchant, customers, totals, health, clock_offset_days } = state.data;
  $("#shopName").textContent = merchant.shop_name;
  const summary = $("#summary");
  summary.replaceChildren();
  if (totals.owing_count) {
    summary.append(`${totals.owing_count} customers owe `, h("strong", {}, `₹${inr(totals.total)}`));
  } else {
    summary.textContent = "Nobody owes you money right now";
  }
  state.lang = merchant.language;
  $("#lang").value = merchant.language;
  $("#hint").textContent = HINTS[merchant.language] || HINTS["en-IN"];

  const note = $("#clockNote");
  note.hidden = !clock_offset_days;
  note.textContent = clock_offset_days ? `Demo time: +${clock_offset_days} days` : "";

  const banner = $("#banner");
  if (!health.voice) {
    banner.hidden = false;
    banner.textContent = "Voice is off: add SARVAM_API_KEY to .env and restart. You can type commands meanwhile.";
    showTypeForm(true);
  } else if (!health.ffmpeg) {
    banner.hidden = false;
    banner.textContent = "ffmpeg isn't installed on the server, so recordings can't be read. Install it and restart.";
  } else {
    banner.hidden = true;
  }

  const list = $("#customerList");
  const sorted = [...customers].sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  list.replaceChildren(...sorted.map(customerRow));
}

function customerRow(c) {
  const owes = c.balance > 0;
  const meta = [];
  if (c.note) meta.push(c.note);
  if (c.consent === "pending") meta.push("No WhatsApp yet");
  if (c.consent === "opted_out") meta.push("Stopped reminders");
  if (c.reminders_paused) meta.push("Reminders paused");
  const flag = c.disputes ? h("span", { class: "flag" }, meta.length ? ", says an entry is wrong" : "Says an entry is wrong") : null;
  const days = owes && c.days ? h("span", { class: `cust-days${c.days >= 30 ? " late" : ""}` }, `${c.days} days`) : null;
  return h("li", {},
    h("button", { class: `cust${owes ? "" : " clear"}`, type: "button", onclick: () => openCustomer(c.id) },
      h("span", {},
        h("span", { class: "cust-name" }, c.name),
        meta.length || flag ? h("span", { class: "cust-meta" }, meta.join(", "), flag) : null),
      h("span", { class: "cust-amt" }, owes ? `₹${inr(c.balance)}` : "Paid up", days)));
}

// ------------------------------------------------------------ slot: read-back slip / reply
function renderSlot(resp) {
  const slot = $("#slot");
  slot.replaceChildren();
  if (!resp) return;
  const p = resp.pending;
  if (p) {
    slot.append(p.state === "awaiting_choice" ? choiceSlip(p, resp) : confirmSlip(p, resp));
  } else if (resp.reply_text) {
    slot.append(h("div", { class: "reply" },
      h("p", {}, resp.reply_text),
      resp.transcript ? h("p", { class: "heard" }, `You said: “${resp.transcript}”`) : null));
  }
}

function confirmSlip(p, resp) {
  const who = p.customer ? p.customer.name : p.new_customer_name;
  const isNew = !p.customer && p.new_customer_name;
  const saveLabel = p.kind === "request_payment" ? "Send link" : "Save";
  const editRow = h("div", { class: "slip-edit", hidden: true },
    h("input", { type: "number", inputmode: "numeric", min: "1", value: p.amount ?? "", "aria-label": "Amount in rupees" }),
    h("button", { class: "btn btn-primary", type: "button", onclick: (e) => {
      const value = parseInt(e.target.previousElementSibling.value, 10);
      if (value > 0) act(`/api/actions/${p.id}/correct`, { amount: value });
    } }, "Update"));
  return h("article", { class: "slip" },
    h("p", { class: "slip-kind" }, KIND_LABEL[p.kind] || "Entry", isNew ? " for a new customer" : ""),
    who ? h("p", { class: "slip-who" }, who, p.customer?.note ? h("span", { class: "muted" }, `, ${p.customer.note}`) : null) : null,
    h("p", { class: "slip-amount" }, `₹${inr(p.amount || 0)}`),
    p.items?.length ? h("p", { class: "slip-items" }, p.items.join(", ")) : null,
    p.payment_mode === "cash" ? h("p", { class: "slip-items" }, "Paid in cash") : null,
    resp?.warning === "amount_from_transcript"
      ? h("p", { class: "slip-warn" }, "Check the amount: I used the number I heard.") : null,
    p.transcript ? h("p", { class: "slip-heard" }, `You said: “${p.transcript}”`) : null,
    h("div", { class: "slip-actions" },
      h("button", { class: "btn btn-primary", type: "button", onclick: () => act(`/api/actions/${p.id}/confirm`) }, saveLabel),
      h("button", { class: "btn", type: "button", onclick: () => { editRow.hidden = false; editRow.querySelector("input").focus(); } }, "Change amount"),
      h("button", { class: "btn btn-quiet", type: "button", onclick: () => act(`/api/actions/${p.id}/reject`) }, "Cancel")),
    editRow);
}

function choiceSlip(p) {
  return h("article", { class: "slip" },
    h("p", { class: "slip-kind" }, KIND_LABEL[p.kind] || "Entry"),
    h("p", { class: "slip-who" }, `Which ${p.spoken_name || "customer"}?`),
    p.amount ? h("p", { class: "slip-amount" }, `₹${inr(p.amount)}`) : null,
    h("div", { class: "choice-list" },
      ...p.options.map((o) => h("button", { class: "choice", type: "button",
        onclick: () => act(`/api/actions/${p.id}/choose`, { customer_id: o.id }) },
        h("span", {}, o.name, o.note ? h("small", {}, o.note) : null),
        h("span", {}, o.balance > 0 ? `owes ₹${inr(o.balance)}` : "no dues"))),
      p.kind === "add_credit" && p.new_customer_name
        ? h("button", { class: "choice", type: "button", onclick: () => act(`/api/actions/${p.id}/new-customer`) },
          h("span", {}, `New customer: ${p.new_customer_name}`), h("span", {}, "+"))
        : null),
    h("div", { class: "slip-actions" },
      h("button", { class: "btn btn-quiet", type: "button", onclick: () => act(`/api/actions/${p.id}/reject`) }, "Cancel")),
    p.transcript ? h("p", { class: "slip-heard" }, `You said: “${p.transcript}”`) : null);
}

function showError(message) {
  $("#slot").replaceChildren(h("div", { class: "reply error" }, h("p", {}, message)));
}

async function handleResponse(resp) {
  renderSlot(resp);
  speak(resp.speak_text, resp.reply_audio_url, resp.reply_lang);
  await refresh();
}

async function act(path, body) {
  unlockAudio();
  try {
    handleResponse(await api(path, { method: "POST", body: { ...(body || {}), lang: state.lang } }));
  } catch (e) {
    showError(e.message);
    refresh();
  }
}

// ------------------------------------------------------------ recording
let recorder = null;
let chunks = [];
let stream = null;
let stopTimer = null;

function setMic(mode) {
  const mic = $("#mic");
  mic.classList.toggle("recording", mode === "recording");
  mic.classList.toggle("working", mode === "working");
  mic.disabled = mode === "working";
  mic.setAttribute("aria-label", mode === "recording" ? "Stop and send" : "Start speaking");
  $("#micStatus").textContent = mode === "recording" ? "Listening… tap to stop" : mode === "working" ? "Understanding…" : "";
}

function pickMime() {
  if (!window.MediaRecorder?.isTypeSupported) return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
    .find((t) => MediaRecorder.isTypeSupported(t)) || "";
}
const extFor = (type) => (type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm");

async function toggleMic() {
  unlockAudio();
  if (state.busy) return;
  if (recorder && recorder.state === "recording") {
    recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    showError("This browser can't record here. Open the https tunnel link, or use Type.");
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showError(location.protocol === "https:" || location.hostname === "localhost"
      ? "Allow microphone access to speak, or use Type."
      : "The microphone only works on an https link. Open the tunnel URL, or use Type.");
    return;
  }
  const mime = pickMime();
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = sendRecording;
  recorder.start();
  setMic("recording");
  stopTimer = setTimeout(() => recorder?.state === "recording" && recorder.stop(), 12000);
}

async function sendRecording() {
  clearTimeout(stopTimer);
  stream?.getTracks().forEach((t) => t.stop());
  const type = recorder.mimeType || "audio/webm";
  const blob = new Blob(chunks, { type });
  state.busy = true;
  setMic("working");
  const form = new FormData();
  form.append("file", blob, `speech.${extFor(type)}`);
  form.append("lang", state.lang);
  try {
    await handleResponse(await api("/api/voice", { method: "POST", form }));
  } catch (e) {
    showError(e.message);
  } finally {
    state.busy = false;
    setMic("idle");
  }
}

// ------------------------------------------------------------ typed commands
function showTypeForm(show) {
  $("#typeForm").hidden = !show;
  $("#typeToggle").setAttribute("aria-pressed", String(show));
}
$("#typeToggle").addEventListener("click", () => {
  const show = $("#typeForm").hidden;
  showTypeForm(show);
  if (show) $("#typeInput").focus();
});
$("#typeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  unlockAudio();
  const input = $("#typeInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  setMic("working");
  try {
    await handleResponse(await api("/api/command", { method: "POST", body: { text, lang: state.lang } }));
  } catch (err) {
    showError(err.message);
  } finally {
    setMic("idle");
  }
});

// ------------------------------------------------------------ customer sheet
const TYPE_LABEL = { credit: "Udhaar", repayment: "Paid", cash_sale: "Cash sale", reversal: "Entry removed" };
const SOURCE_LABEL = { mock: "via payment link", paytm: "via Paytm", cash: "in cash", voice: "", seed: "", manual: "" };

async function openCustomer(id) {
  const sheet = $("#sheet");
  const body = $("#sheetBody");
  let c;
  try {
    c = await api(`/api/customers/${id}`);
  } catch (e) {
    showError(e.message);
    return;
  }
  const s = c.stats;
  const habit = s.avg_days_to_clear != null
    ? `Usually pays back in about ${Math.round(s.avg_days_to_clear)} days (${s.credits_cleared} cleared).`
    : "No repayment history yet.";
  const disputed = c.entries.filter((e) => e.status === "disputed");
  const field = (label, input) => h("div", { class: "field" }, h("label", {}, label), input);
  const phone = h("input", { type: "tel", value: c.phone || "", placeholder: "+91 98765 43210" });
  const lang = h("select", {}, ...Object.entries(LANG_NAMES).map(([v, n]) => h("option", { value: v, selected: v === c.language }, n)));
  const consent = h("input", { type: "checkbox", checked: c.consent === "granted" });
  const paused = h("input", { type: "checkbox", checked: c.reminders_paused });

  const save = async () => {
    try {
      await api(`/api/customers/${id}`, { method: "PATCH", body: {
        phone: phone.value, language: lang.value,
        consent: consent.checked ? "granted" : (c.consent === "opted_out" ? "opted_out" : "pending"),
        reminders_paused: paused.checked,
      } });
      sheet.close();
      refresh();
    } catch (e) { alert(e.message); }
  };
  const remind = async (btn) => {
    btn.disabled = true;
    try {
      await api(`/api/customers/${id}/remind`, { method: "POST" });
      btn.textContent = "Reminder sent";
      refresh();
    } catch (e) { btn.disabled = false; alert(e.message); }
  };
  const resolve = async (entryId, action) => {
    await api(`/api/entries/${entryId}/resolve`, { method: "POST", body: { action } });
    sheet.close();
    refresh();
  };

  body.replaceChildren(...[
    h("div", { class: "sheet-head" },
      h("div", {}, h("h2", { id: "sheetTitle" }, c.name), c.note ? h("p", {}, c.note) : null),
      h("button", { class: "close", type: "button", "aria-label": "Close", onclick: () => sheet.close() }, "×")),
    h("p", { class: "big-balance" }, c.balance > 0 ? `₹${inr(c.balance)}` : "Paid up"),
    h("p", { class: "record" }, c.balance > 0 && s.oldest_unpaid_days ? `Oldest unpaid: ${s.oldest_unpaid_days} days. ` : "", habit),
    ...disputed.map((e) => h("div", { class: "dispute-box" },
      h("p", {}, `${c.name} says the ₹${inr(e.amount)} entry is wrong.`),
      h("div", { class: "row" },
        h("button", { class: "btn", type: "button", onclick: () => resolve(e.id, "keep") }, "Keep entry"),
        h("button", { class: "btn btn-primary", type: "button", onclick: () => resolve(e.id, "remove") }, "Remove entry")))),
    c.balance > 0 && c.consent === "granted"
      ? h("button", { class: "btn btn-primary", type: "button", style: "width:100%", onclick: (e) => remind(e.currentTarget) }, "Send reminder now")
      : null,
    c.consent !== "granted"
      ? h("button", { class: "btn", type: "button", style: "width:100%", onclick: async (e) => {
        await navigator.clipboard?.writeText(state.data.join_url).catch(() => {});
        e.currentTarget.textContent = "Join link copied";
      } }, "Copy “Join my khata” link") : null,
    h("div", { class: "fields" },
      field("WhatsApp number", phone),
      field("Message language", lang),
      h("label", { class: "toggle" }, h("span", {}, "Customer agreed to WhatsApp updates"), consent),
      h("label", { class: "toggle" }, h("span", {}, "Pause reminders"), paused),
      h("button", { class: "btn btn-primary", type: "button", onclick: save }, "Save changes")),
    h("p", { class: "section-title" }, "History"),
    h("ul", { class: "entries" }, ...c.entries.map((e) => h("li", {},
      h("span", {},
        h("span", { class: "what" }, TYPE_LABEL[e.type] || e.type, e.status === "disputed" ? " (disputed)" : ""),
        h("span", { class: "when" }, ` ${[e.items.join(", "), SOURCE_LABEL[e.source]].filter(Boolean).join(", ")}`),
        h("span", { class: "when", style: "display:block" }, timeAgo(e.created_at))),
      h("span", { class: `amt${e.type === "repayment" ? " minus" : ""}` },
        `${e.type === "repayment" ? "−" : ""}₹${inr(e.amount)}`)))),
  ].filter(Boolean));
  sheet.showModal();
}

// ------------------------------------------------------------ live events
let toastTimer = null;
function toast(text, kind = "payment") {
  const t = $("#toast");
  t.className = `toast ${kind === "dispute" ? "dispute" : kind === "payment" ? "" : "info"}`;
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}

async function speakEvent(d) {
  let url = null;
  try {
    url = (await api(`/api/tts?lang=${encodeURIComponent(d.lang)}&text=${encodeURIComponent(d.speak_text)}`)).audio_url;
  } catch { /* fall back to the browser voice */ }
  speak(d.speak_text, url, d.lang);
}

function connectEvents() {
  const es = new EventSource(`/api/events?channel=merchant:${state.data.merchant.id}`);
  es.onmessage = (ev) => {
    const d = JSON.parse(ev.data);
    if (["payment", "dispute", "joined"].includes(d.type)) {
      toast(d.text, d.type);
      speakEvent(d);
    } else if (d.type === "reminder_sent") {
      toast(d.text, "info");
    }
    refresh();
  };
}

// ------------------------------------------------------------ demo sheet
function wireDemo() {
  const sheet = $("#demoSheet");
  $("#demoBtn").addEventListener("click", () => {
    const hlth = state.data.health;
    $("#healthList").replaceChildren(
      ...[["Voice (Sarvam)", hlth.voice ? "On" : "Off"], ["LLM", hlth.llm ? "On" : "Rules only"],
        ["Spoken replies", hlth.tts ? "Sarvam" : "Browser voice"], ["Messages", hlth.messaging],
        ["Payments", hlth.payments], ["Public link", hlth.public_base_url]]
        .flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)]));
    sheet.showModal();
  });
  sheet.querySelector("[data-close]").addEventListener("click", () => sheet.close());
  $("#ffBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const r = await api("/api/demo/fast-forward", { method: "POST", body: { days: 3 } });
      btn.textContent = `Moved forward. ${r.reminders_sent} reminder${r.reminders_sent === 1 ? "" : "s"} sent.`;
      refresh();
    } finally {
      setTimeout(() => { btn.disabled = false; btn.textContent = "Move time forward 3 days"; }, 2500);
    }
  });
  $("#qrBtn").addEventListener("click", () => {
    const box = $("#qrBox");
    box.hidden = false;
    box.replaceChildren(h("img", { src: `/api/join-qr.svg?t=${Date.now()}`, alt: "QR code for the Join my khata page" }),
      h("p", {}, state.data.join_url));
  });
  $("#resetBtn").addEventListener("click", async () => {
    if (!confirm("Reset all demo data?")) return;
    await api("/api/demo/reset", { method: "POST" });
    sheet.close();
    renderSlot(null);
    refresh();
  });
}

// ------------------------------------------------------------ start
$("#mic").addEventListener("click", toggleMic);
$("#lang").addEventListener("change", async (e) => {
  await api("/api/merchant", { method: "PATCH", body: { language: e.target.value } });
  refresh();
});
for (const dlg of document.querySelectorAll("dialog")) {
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
}
wireDemo();
refresh().then(() => {
  if (state.data.pending) renderSlot({ pending: state.data.pending });
  connectEvents();
}).catch((e) => showError(e.message));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
