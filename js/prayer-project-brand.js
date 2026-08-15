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
  icon.type = "image/svg+xml";
  icon.href = "./favicon.svg";
}

function syncBrandCopy() {
  document.querySelectorAll(".brand-mark").forEach((mark) => {
    mark.textContent = "✦";
    mark.setAttribute("aria-hidden", "true");
  });

  const headerBrand = document.querySelector(".site-header .brand");
  if (headerBrand) {
    const strong = headerBrand.querySelector("strong");
    const small = headerBrand.querySelector("small");
    if (strong) strong.textContent = "The Prayer Project";
    if (small) small.textContent = "Board of Directors";
  }

  const sidebarSmall = document.querySelector(".sidebar-title small");
  if (sidebarSmall && sidebarSmall.textContent.trim() === "Director") {
    sidebarSmall.textContent = "Board of Directors";
  }

  const badge = document.querySelector(".site-header .environment-badge");
  if (badge && !/Founder Setup/i.test(badge.textContent)) badge.textContent = "Board Governance";
}

ensurePreconnect("https://fonts.googleapis.com");
ensurePreconnect("https://fonts.gstatic.com");
ensureStylesheet(
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Playfair+Display:wght@600;700;800&display=swap",
  "data-prayer-project-fonts"
);
ensureStylesheet("./prayer-project-brand.css", "data-prayer-project-brand");
ensureFavicon();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncBrandCopy, { once: true });
} else {
  syncBrandCopy();
}

const observer = new MutationObserver(() => syncBrandCopy());
observer.observe(document.documentElement, { childList: true, subtree: true });
