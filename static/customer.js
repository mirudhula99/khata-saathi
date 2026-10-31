// Customer phone simulator: shows what a customer receives, live.
import { api, h } from "/static/common.js";

const $ = (s) => document.querySelector(s);
const PAY_LABEL = { "en-IN": "Pay now", "hi-IN": "अभी भुगतान करें", "kn-IN": "ಈಗ ಪಾವತಿಸಿ", "ta-IN": "இப்போது செலுத்து", "te-IN": "ఇప్పుడు చెల్లించండి" };
// Page chrome in the customer's language (view.customer.language). Message bodies and buttons arrive already
// translated from the server. STOP / START stay as they are: WhatsApp keywords.
const UI = {
  "en-IN": {
    account: "Business account · WhatsApp", sandbox: "· sandbox · no real money", you: "You are",
    empty: "No messages yet. Record udhaar for this customer in the shop app, or send a reminder.",
    replies: "Replies go back to the shop.", stopped: "You stopped reminders from this shop.", notDelivered: "not delivered",
  },
  "hi-IN": {
    account: "बिज़नेस अकाउंट · WhatsApp", sandbox: "· सैंडबॉक्स · असली पैसा नहीं", you: "आप हैं",
    empty: "अभी कोई संदेश नहीं। दुकान ऐप में इस ग्राहक का उधार दर्ज करें, या रिमाइंडर भेजें।",
    replies: "जवाब दुकान को जाते हैं।", stopped: "आपने इस दुकान के रिमाइंडर बंद कर दिए।", notDelivered: "नहीं पहुँचा",
  },
  "kn-IN": {
    account: "ವ್ಯಾಪಾರ ಖಾತೆ · WhatsApp", sandbox: "· ಸ್ಯಾಂಡ್‌ಬಾಕ್ಸ್ · ನಿಜವಾದ ಹಣವಿಲ್ಲ", you: "ನೀವು",
    empty: "ಇನ್ನೂ ಸಂದೇಶಗಳಿಲ್ಲ. ಅಂಗಡಿ ಆ್ಯಪ್‌ನಲ್ಲಿ ಈ ಗ್ರಾಹಕರಿಗೆ ಸಾಲ ದಾಖಲಿಸಿ, ಅಥವಾ ನೆನಪು ಕಳುಹಿಸಿ.",
    replies: "ಉತ್ತರಗಳು ಅಂಗಡಿಗೆ ಹೋಗುತ್ತವೆ.", stopped: "ಈ ಅಂಗಡಿಯ ನೆನಪುಗಳನ್ನು ನೀವು ನಿಲ್ಲಿಸಿದ್ದೀರಿ.", notDelivered: "ತಲುಪಿಲ್ಲ",
  },
  "ta-IN": {
    account: "வணிகக் கணக்கு · WhatsApp", sandbox: "· சாண்ட்பாக்ஸ் · உண்மைப் பணம் இல்லை", you: "நீங்கள்",
    empty: "இன்னும் செய்திகள் இல்லை. கடை ஆப்பில் இந்த வாடிக்கையாளருக்கு கடன் பதிவு செய்யுங்கள், அல்லது நினைவூட்டல் அனுப்புங்கள்.",
    replies: "பதில்கள் கடைக்குச் செல்லும்.", stopped: "இந்தக் கடையின் நினைவூட்டல்களை நீங்கள் நிறுத்தினீர்கள்.", notDelivered: "சேரவில்லை",
  },
  "te-IN": {
    account: "వ్యాపార ఖాతా · WhatsApp", sandbox: "· శాండ్‌బాక్స్ · నిజమైన డబ్బు కాదు", you: "మీరు",
    empty: "ఇంకా మెసేజ్‌లు లేవు. షాప్ యాప్‌లో ఈ కస్టమర్‌కు అప్పు నమోదు చేయండి, లేదా గుర్తు పంపండి.",
    replies: "జవాబులు షాప్‌కి వెళ్తాయి.", stopped: "ఈ షాప్ గుర్తులను మీరు ఆపేశారు.", notDelivered: "చేరలేదు",
  },
};
const params = new URLSearchParams(location.search);
let customerId = params.get("id");
let view = null;
let source = null;

function ui() {
  return UI[view?.customer?.language] || UI["en-IN"];
}

async function loadList() {
  const { customers } = await api("/api/customer-view");
  const select = $("#who");
  select.replaceChildren(...customers.map((c) =>
    h("option", { value: c.id, selected: String(c.id) === String(customerId) }, c.note ? `${c.name} (${c.note})` : c.name)));
  if (!customerId && customers.length) customerId = customers[0].id;
  select.value = customerId;
  const me = customers.find((c) => String(c.id) === String(customerId));
  $("#whoName").textContent = me ? (me.note ? `${me.name} (${me.note})` : me.name) : "";
  $(".wa-avatar").textContent = (view?.shop || "S").trim().charAt(0).toUpperCase();
}

async function load() {
  view = await api(`/api/customer-view/${customerId}`);
  render();
}

function answeredButtons() {
  // Per message: the replies the customer sent after THAT message and before the next one with buttons.
  // (Keyed by message, not by label, so flagging one entry never disables the buttons on later entries.)
  const spent = new Map();
  let current = null;
  for (const m of view.messages) {
    if (m.direction === "out" && m.buttons?.length) { current = m; spent.set(m.id, new Set()); }
    else if (m.direction === "in" && current) spent.get(current.id).add(m.body);
  }
  return spent;
}

function render() {
  const t = ui();
  document.documentElement.lang = (view.customer.language || "en-IN").split("-")[0];
  $("#shop").textContent = view.shop;
  $(".wa-avatar").textContent = (view.shop || "S").trim().charAt(0).toUpperCase();
  $("#accountLine").textContent = t.account;
  $("#sandboxLine").textContent = t.sandbox;
  $("#youAre").textContent = t.you;
  const optedOut = view.customer.consent === "opted_out";
  const stop = $("#stopBtn");
  stop.textContent = optedOut ? "START" : "STOP";
  $("#footNote").textContent = optedOut ? t.stopped : t.replies;

  const chat = $("#chat");
  if (!view.messages.length) {
    chat.replaceChildren(h("p", { class: "empty-chat" }, t.empty));
    return;
  }
  const spent = answeredButtons();
  // Only the newest message asking for a tap glows: its Correct / Wrong amount chips (until answered) and the
  // newest Pay now link (while something is still owed). Older messages stay calm.
  const lastAsk = view.messages.findLast((m) => m.direction === "out" && m.buttons?.length)?.id;
  const lastPay = view.customer.balance > 0 ? view.messages.findLast((m) => m.link_url)?.id : null;
  chat.replaceChildren(...view.messages.map((m) => {
    const time = new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    const body = m.link_url ? m.body.replace(m.link_url, "").trim() : m.body;
    // One answer per message: once Confirm or Flag was tapped on this entry, both of its chips are spent.
    const answered = spent.get(m.id);
    const done = Boolean(m.buttons?.length && answered && m.buttons.some((b) => answered.has(b.title)));
    // WhatsApp business layout: the text, then full-width action rows separated by hairlines.
    // "Pay now" is the link; reply buttons (Correct / Wrong amount, Amount wrong?, STOP) post a reply.
    const payTitle = view.customer.language && PAY_LABEL[view.customer.language] || "Pay now";
    const rows = [];
    if (m.link_url) rows.push(h("a", { class: `wa-action wa-link${m.id === lastPay ? " attention" : ""}`, href: m.link_url }, "↗ " + payTitle));
    for (const b of m.buttons || []) {
      const stop = b.id === "stop";
      rows.push(h("button", { class: `wa-action${m.id === lastAsk && !done && !stop ? " attention" : ""}`, type: "button",
        disabled: stop ? optedOut : done, onclick: () => reply({ button_id: b.id, text: b.title }) }, b.title));
    }
    return h("div", { class: `bubble ${m.direction}${rows.length ? " has-actions" : ""}` },
      body,
      h("time", {}, m.status === "failed" ? `${time}, ${t.notDelivered}` : time),
      rows.length ? h("div", { class: "wa-actions" }, ...rows) : null);
  }));
  window.scrollTo({ top: document.body.scrollHeight });
}

async function reply(body) {
  await api(`/api/customer-view/${customerId}/reply`, { method: "POST", body });
  await load();
}

function listen() {
  source?.close();
  source = new EventSource(`/api/events?channel=customer:${customerId}`);
  source.onmessage = () => load();
}

$("#who").addEventListener("change", (e) => {
  customerId = e.target.value;
  history.replaceState(null, "", `/customer?id=${customerId}`);
  load();
  listen();
});
$("#stopBtn").addEventListener("click", () => reply({ text: $("#stopBtn").textContent }));

await loadList();
await load();
listen();
