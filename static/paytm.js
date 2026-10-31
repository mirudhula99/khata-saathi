// Mock of the customer's Paytm app: the shop's reminders and entry notes arrive as in-app notifications.
// "Pay" opens a Paytm-style payment sheet that goes through the same mock payment webhook as the WhatsApp pay page;
// "Amount wrong?" and the reminders switch post the same replies as the WhatsApp simulator (flag:balance, STOP/START).
import { api, h } from "/static/common.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
let customerId = params.get("id");
let view = null;
let source = null;
let seenAt = 0;

const UI = {
  "en-IN": { you: "You are", sandbox: "sandbox · no real money", title: "Notifications", mute: "Reminders from this shop",
    empty: "No notifications yet. The shop's entries and reminders will show up here.", pay: "Pay {amount}", wrong: "Amount wrong?",
    correct: "Correct", wrongAmount: "Wrong amount", payFrom: "Pay From", choose: "Choose Payment Methods", wallet: "Paytm Wallet",
    other: "Other Payment Mode", cards: "Debit & Credit Cards", netbanking: "Net Banking", upi: "UPI Payment", payBtn: "Pay {amount}",
    paid: "Paid {amount}", to: "to {shop}", remaining: "Remaining with {shop}: {amount}", nothing: "Nothing left to pay. Thank you!",
    done: "Done", test: "Test payment. No real money moves.", tooMuch: "You owe only {amount}.", min: "Enter an amount of at least ₹1." },
  "hi-IN": { you: "आप हैं", sandbox: "सैंडबॉक्स · असली पैसा नहीं", title: "सूचनाएँ", mute: "इस दुकान से रिमाइंडर",
    empty: "अभी कोई सूचना नहीं। दुकान की एंट्री और रिमाइंडर यहाँ दिखेंगे।", pay: "{amount} चुकाएँ", wrong: "राशि गलत है?",
    correct: "सही है", wrongAmount: "गलत रकम", payFrom: "भुगतान करें", choose: "भुगतान का तरीका चुनें", wallet: "Paytm वॉलेट",
    other: "अन्य तरीके", cards: "डेबिट और क्रेडिट कार्ड", netbanking: "नेट बैंकिंग", upi: "UPI भुगतान", payBtn: "{amount} चुकाएँ",
    paid: "{amount} चुकाए", to: "{shop} को", remaining: "{shop} पर बाकी: {amount}", nothing: "कुछ बाकी नहीं। धन्यवाद!",
    done: "ठीक है", test: "टेस्ट भुगतान। असली पैसा नहीं जाता।", tooMuch: "आप पर केवल {amount} बकाया है।", min: "कम से कम ₹1 लिखें।" },
  "kn-IN": { you: "ನೀವು", sandbox: "ಸ್ಯಾಂಡ್‌ಬಾಕ್ಸ್ · ನಿಜವಾದ ಹಣವಿಲ್ಲ", title: "ಅಧಿಸೂಚನೆಗಳು", mute: "ಈ ಅಂಗಡಿಯಿಂದ ನೆನಪುಗಳು",
    empty: "ಇನ್ನೂ ಅಧಿಸೂಚನೆಗಳಿಲ್ಲ. ಅಂಗಡಿಯ ನಮೂದುಗಳು ಮತ್ತು ನೆನಪುಗಳು ಇಲ್ಲಿ ಬರುತ್ತವೆ.", pay: "{amount} ಪಾವತಿಸಿ", wrong: "ಮೊತ್ತ ತಪ್ಪೇ?",
    correct: "ಸರಿ", wrongAmount: "ತಪ್ಪು ಮೊತ್ತ", payFrom: "ಪಾವತಿಸಿ", choose: "ಪಾವತಿ ವಿಧಾನ ಆರಿಸಿ", wallet: "Paytm ವಾಲೆಟ್",
    other: "ಇತರ ವಿಧಾನಗಳು", cards: "ಡೆಬಿಟ್ ಮತ್ತು ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್", netbanking: "ನೆಟ್ ಬ್ಯಾಂಕಿಂಗ್", upi: "UPI ಪಾವತಿ", payBtn: "{amount} ಪಾವತಿಸಿ",
    paid: "{amount} ಪಾವತಿಸಲಾಗಿದೆ", to: "{shop} ಗೆ", remaining: "{shop} ನಲ್ಲಿ ಬಾಕಿ: {amount}", nothing: "ಬಾಕಿ ಇಲ್ಲ. ಧನ್ಯವಾದ!",
    done: "ಸರಿ", test: "ಪರೀಕ್ಷಾ ಪಾವತಿ. ನಿಜವಾದ ಹಣ ಹೋಗುವುದಿಲ್ಲ.", tooMuch: "ನೀವು {amount} ಮಾತ್ರ ಕೊಡಬೇಕು.", min: "ಕನಿಷ್ಠ ₹1 ನಮೂದಿಸಿ." },
  "ta-IN": { you: "நீங்கள்", sandbox: "சாண்ட்பாக்ஸ் · உண்மையான பணம் இல்லை", title: "அறிவிப்புகள்", mute: "இந்தக் கடையின் நினைவூட்டல்கள்",
    empty: "இன்னும் அறிவிப்புகள் இல்லை. கடையின் பதிவுகளும் நினைவூட்டல்களும் இங்கே வரும்.", pay: "{amount} செலுத்து", wrong: "தொகை தவறா?",
    correct: "சரி", wrongAmount: "தவறான தொகை", payFrom: "செலுத்து", choose: "செலுத்தும் முறையைத் தேர்வு செய்க", wallet: "Paytm வாலட்",
    other: "பிற முறைகள்", cards: "டெபிட் & கிரெடிட் கார்டு", netbanking: "நெட் பேங்கிங்", upi: "UPI", payBtn: "{amount} செலுத்து",
    paid: "{amount} செலுத்தப்பட்டது", to: "{shop} க்கு", remaining: "{shop} இல் பாக்கி: {amount}", nothing: "பாக்கி இல்லை. நன்றி!",
    done: "சரி", test: "சோதனைப் பணம். உண்மையான பணம் போகாது.", tooMuch: "நீங்கள் {amount} மட்டுமே தர வேண்டும்.", min: "குறைந்தது ₹1 உள்ளிடுங்கள்." },
  "te-IN": { you: "మీరు", sandbox: "శాండ్‌బాక్స్ · నిజమైన డబ్బు లేదు", title: "నోటిఫికేషన్లు", mute: "ఈ దుకాణం నుండి గుర్తులు",
    empty: "ఇంకా నోటిఫికేషన్లు లేవు. దుకాణం ఎంట్రీలు, గుర్తులు ఇక్కడ కనిపిస్తాయి.", pay: "{amount} చెల్లించండి", wrong: "మొత్తం తప్పా?",
    correct: "సరైనది", wrongAmount: "తప్పు మొత్తం", payFrom: "చెల్లించండి", choose: "చెల్లింపు విధానం ఎంచుకోండి", wallet: "Paytm వాలెట్",
    other: "ఇతర విధానాలు", cards: "డెబిట్ & క్రెడిట్ కార్డులు", netbanking: "నెట్ బ్యాంకింగ్", upi: "UPI చెల్లింపు", payBtn: "{amount} చెల్లించండి",
    paid: "{amount} చెల్లించారు", to: "{shop} కి", remaining: "{shop} వద్ద బాకీ: {amount}", nothing: "బాకీ లేదు. ధన్యవాదాలు!",
    done: "సరే", test: "టెస్ట్ చెల్లింపు. నిజమైన డబ్బు వెళ్ళదు.", tooMuch: "మీరు {amount} మాత్రమే ఇవ్వాలి.", min: "కనీసం ₹1 నమోదు చేయండి." },
};
let T = UI["en-IN"];
const t = (k, v = {}) => (T[k] || UI["en-IN"][k]).replace(/\{(\w+)\}/g, (_, n) => (n in v ? v[n] : `{${n}}`));
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

async function load() {
  view = await api(`/api/customer-view/${customerId}`);
  T = UI[view.customer.language] || UI["en-IN"];
  document.documentElement.lang = (view.customer.language || "en-IN").split("-")[0];
  render();
}

function answered() {
  // Per message: replies after it and before the next message with buttons (keyed by message, not by label).
  const spent = new Map(); let current = null;
  for (const m of view.messages) {
    if (m.direction === "out" && m.buttons?.length) { current = m; spent.set(m.id, new Set()); }
    else if (m.direction === "in" && current) spent.get(current.id).add(m.body);
  }
  return spent;
}

function render() {
  const c = view.customer;
  $("#shopName").textContent = view.shop;
  $("#whoName").textContent = c.note ? `${c.name} (${c.note})` : c.name;
  $("#youAre").textContent = t("you"); $("#sandbox").textContent = t("sandbox"); $("#title").textContent = t("title"); $("#muteLabel").textContent = t("mute");
  $("#sheetTitle").textContent = t("payFrom");
  const on = c.consent !== "opted_out";
  $("#mute").classList.toggle("on", on); $("#mute").setAttribute("aria-checked", String(on));

  const list = $("#list");
  const out = view.messages.filter((m) => m.direction === "out").slice().reverse();
  if (!out.length) { list.replaceChildren(h("p", { class: "pt-empty" }, t("empty"))); return; }
  const spent = answered();
  const lastPay = c.balance > 0 ? view.messages.findLast((m) => m.link_url)?.id : null;
  list.replaceChildren(...out.map((m) => {
    const time = new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    const body = m.link_url ? m.body.replace(m.link_url, "").replace(/\s+$/, "") : m.body;
    const done = Boolean(m.buttons?.length && spent.get(m.id) && m.buttons.some((b) => spent.get(m.id).has(b.title)));
    const actions = [];
    if (m.link_url && c.balance > 0) actions.push(h("button", { class: "pt-btn primary", type: "button", onclick: () => openPay(m.link_url) }, t("pay", { amount: inr(c.balance) })));
    for (const b of m.buttons || []) {
      if (b.id === "stop") continue;  // the switch in the header does this in the Paytm app
      const label = b.id === "flag:balance" ? t("wrong") : b.id.startsWith("ack:") ? t("correct") : b.id.startsWith("dispute:") ? t("wrongAmount") : b.title;
      actions.push(h("button", { class: "pt-btn ghost", type: "button", disabled: done, onclick: () => reply({ button_id: b.id, text: b.title }) }, label));
    }
    return h("div", { class: `pt-card${m.id === lastPay ? " unread" : ""}` },
      h("div", { class: "pt-head" }, h("span", { class: "pt-avatar" }, view.shop.trim().charAt(0).toUpperCase()), h("span", { class: "pt-shop" }, view.shop), h("span", { class: "pt-time" }, time)),
      h("p", { class: "pt-body" }, body),
      actions.length ? h("div", { class: "pt-actions" }, ...actions) : null);
  }));
}

async function reply(body) {
  await api(`/api/customer-view/${customerId}/reply`, { method: "POST", body });
  await load();
}

// ---- Paytm-style payment sheet ---------------------------------------------------------------------------------
let linkId = null, info = null;
async function openPay(url) {
  linkId = url.split("/").pop();
  info = await api(`/api/pay/${linkId}`);
  const max = info.balance ?? info.amount;
  const body = $("#sheetBody");
  const amount = h("input", { id: "ptAmount", inputmode: "numeric", type: "number", min: 1, value: max });
  const err = h("p", { class: "pt-err", hidden: true });
  const payBtn = h("button", { class: "pt-paybtn", type: "button" }, t("payBtn", { amount: inr(max) }));
  amount.addEventListener("input", () => { const n = Number(amount.value) || 0; payBtn.textContent = t("payBtn", { amount: inr(n) }); err.hidden = true; });
  payBtn.addEventListener("click", async () => {
    const n = Math.round(Number(amount.value) || 0);
    if (n < 1) { err.textContent = t("min"); err.hidden = false; return; }
    if (n > max) { err.textContent = t("tooMuch", { amount: inr(max) }); err.hidden = false; return; }
    payBtn.disabled = true;
    try {
      const r = await api(`/api/pay/${linkId}/simulate`, { method: "POST", body: { amount: n } });
      body.replaceChildren(h("div", { class: "pt-done" },
        h("div", { class: "mark" }, "✓"), h("h3", {}, t("paid", { amount: inr(r.amount) })), h("p", {}, t("to", { shop: info.shop })),
        h("p", {}, r.balance > 0 ? t("remaining", { shop: info.shop, amount: inr(r.balance) }) : t("nothing")),
        h("button", { class: "pt-paybtn", type: "button", onclick: closePay }, t("done"))));
      await load();
    } catch (e) { payBtn.disabled = false; err.textContent = e.message; err.hidden = false; }
  });
  const opt = (name, label, icon, checked) => h("label", { class: "pt-opt" }, h("input", { type: "radio", name: "ptMethod", value: name, checked }), h("span", { class: "ic" }, icon), label);
  body.replaceChildren(
    h("div", { class: "pt-choose" }, t("choose")),
    h("div", { class: "pt-amount" }, "₹", amount),
    opt("wallet", t("wallet"), "👛", true),
    payBtn, err,
    h("p", { class: "pt-other" }, t("other")),
    opt("cards", t("cards"), "💳", false), opt("netbanking", t("netbanking"), "🏦", false), opt("upi", t("upi"), "⚡", false),
    h("p", { class: "pt-note" }, t("test")));
  $("#sheetBg").classList.add("open");
}
function closePay() { $("#sheetBg").classList.remove("open"); }
$("#closeSheet").addEventListener("click", closePay);
$("#sheetBg").addEventListener("click", (e) => { if (e.target === $("#sheetBg")) closePay(); });
$("#mute").addEventListener("click", () => reply({ text: view.customer.consent === "opted_out" ? "START" : "STOP" }));

function listen() {
  source?.close();
  source = new EventSource(`/api/events?channel=customer:${customerId}`);
  source.onmessage = () => load();
}

if (!customerId) {
  const { customers } = await api("/api/customer-view");
  customerId = (customers.find((c) => c.channel === "paytm") || customers[0])?.id;
}
await load();
listen();
