// Small helpers shared by every page.

export async function api(path, { method = "GET", body, form } = {}) {
  const opts = { method, headers: {} };
  if (form) {
    opts.body = form;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : `Request failed (${res.status}). Try again.`;
    throw new Error(detail);
  }
  return data;
}

// h("button", { class: "btn", onclick }, "Save") — builds elements safely (text, never HTML).
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else if (key === "hidden") el.hidden = Boolean(value);
    else if (key === "checked" || key === "selected" || key === "disabled") el[key] = Boolean(value);
    else if (key === "value") el.value = value;
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const inrFormat = new Intl.NumberFormat("en-IN");
export const inr = (n) => inrFormat.format(Math.round(Number(n) || 0));

export function timeAgo(iso) {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return `Today, ${then.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1) return "Yesterday";
  return then.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
