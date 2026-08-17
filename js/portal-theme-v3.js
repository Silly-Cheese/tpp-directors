const THEME_ID = "tpp-portal-theme-v3";

function installTheme() {
  const oldTheme = document.getElementById(THEME_ID);
  if (oldTheme) return;

  const link = document.createElement("link");
  link.id = THEME_ID;
  link.rel = "stylesheet";
  link.href = "./portal-theme-v3.css?v=20260817-1648";
  document.head.append(link);

  document.documentElement.dataset.tppTheme = "v3";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installTheme, { once: true });
} else {
  installTheme();
}
