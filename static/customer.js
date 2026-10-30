// Customer phone simulator: shows what a customer receives, live.
import { api, h } from "/static/common.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
let customerId = params.get("id");
let view = null;
let source = null;

async function loadList() {
  const { customers } = await api("/api/customer-view");
  const select = $("#who");
  select.replaceChildren(...customers.map((c) =>
    h("option", { value: c.id, selected: String(c.id) === String(customerId) }, c.note ? `${c.name} (${c.note})` : c.name)));
  if (!customerId && customers.length) customerId = customers[0].id;
  select.value = customerId;
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
  $("#shop").textContent = view.shop;
  const optedOut = view.customer.consent === "opted_out";
  const stop = $("#stopBtn");
  stop.textContent = optedOut ? "START" : "STOP";
  $("#footNote").textContent = optedOut ? "You stopped reminders from this shop." : "Replies go back to the shop.";

  const chat = $("#chat");
  if (!view.messages.length) {
    chat.replaceChildren(h("p", { class: "empty-chat" },
      "No messages yet. Record udhaar for this customer in the shop app, or send a reminder."));
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
    return h("div", { class: `bubble ${m.direction}` },
      body,
      m.link_url ? h("a", { class: `btn btn-paid pay${m.id === lastPay ? " attention" : ""}`, href: m.link_url }, "Pay now") : null,
      m.buttons?.length ? h("div", { class: "chips" }, ...m.buttons.map((b) =>
        h("button", { class: `chip${m.id === lastAsk && !done ? " attention" : ""}`, type: "button", disabled: done,
          onclick: () => reply({ button_id: b.id, text: b.title }) }, b.title))) : null,
      h("time", {}, m.status === "failed" ? `${time}, not delivered` : time));
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
