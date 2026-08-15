function ensureStylesheet(href, marker) {
  if (document.querySelector(`link[${marker}]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute(marker, "true");
  document.head.append(link);
}

function ensurePreconnect(href) {
  if ([...document.querySelectorAll('link[rel="preconnect"]')].some((link) => link.href === href)) return;
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = href;
  if (href.includes("gstatic")) link.crossOrigin = "anonymous";
  document.head.append(link);
}

function ensureFavicon() {
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.append(icon);
  }
  if (icon.type !== "image/svg+xml") icon.type = "image/svg+xml";
  if (!icon.href.endsWith("/favicon.svg")) icon.href = "./favicon.svg";
}

function setTextIfNeeded(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

function syncBrandCopy() {
  document.querySelectorAll(".brand-mark").forEach((mark) => {
    setTextIfNeeded(mark, "✦");
    if (mark.getAttribute("aria-hidden") !== "true") mark.setAttribute("aria-hidden", "true");
  });

  const headerBrand = document.querySelector(".site-header .brand");
  if (headerBrand) {
    setTextIfNeeded(headerBrand.querySelector("strong"), "The Prayer Project");
    setTextIfNeeded(headerBrand.querySelector("small"), "Board of Directors");
  }

  const sidebarSmall = document.querySelector(".sidebar-title small");
  if (sidebarSmall && sidebarSmall.textContent.trim() === "Director") {
    setTextIfNeeded(sidebarSmall, "Board of Directors");
  }

  const badge = document.querySelector(".site-header .environment-badge");
  if (badge && !/Founder Setup/i.test(badge.textContent)) setTextIfNeeded(badge, "Board Governance");
}

let syncFrame = null;
function queueBrandSync() {
  if (syncFrame !== null) return;
  syncFrame = requestAnimationFrame(() => {
    syncFrame = null;
    syncBrandCopy();
  });
}

ensurePreconnect("https://fonts.googleapis.com");
ensurePreconnect("https://fonts.gstatic.com");
ensureStylesheet(
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@600;700;800&display=swap",
  "data-prayer-project-fonts"
);
ensureStylesheet("./prayer-project-brand.css", "data-prayer-project-brand");
ensureStylesheet("./form-contrast.css", "data-prayer-project-form-contrast");
ensureFavicon();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", queueBrandSync, { once: true });
} else {
  queueBrandSync();
}

// Portal modules announce completion through this event. Re-syncing at those
// bounded points is enough to brand dynamically injected navigation without
// keeping a permanent whole-document MutationObserver alive.
window.addEventListener("tpp:module-status", (event) => {
  if (event.detail?.status === "loaded") queueBrandSync();
});
