// A subtle "‹ Back" link on the pages outside the React app (customer phone, pay, join, legacy UI), so no screen is a dead end.
// Goes back in history when we came from somewhere on this site; otherwise to the shop app at "/".
(function () {
  var sameSite = document.referrer && document.referrer.indexOf(location.origin) === 0;
  var a = document.createElement("a");
  a.className = "back-link";
  a.href = "/";
  a.textContent = "‹ Back";
  a.setAttribute("aria-label", "Back to the shop app");
  a.addEventListener("click", function (e) {
    if (sameSite && history.length > 1) { e.preventDefault(); history.back(); }
  });
  var host = document.querySelector("header.phone-top") || document.querySelector("header.topbar") || document.querySelector("main.simple-page");
  if (host) host.insertBefore(a, host.firstChild); else document.body.insertBefore(a, document.body.firstChild);
})();
