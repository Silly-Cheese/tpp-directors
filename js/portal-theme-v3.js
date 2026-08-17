const THEME_ID = "tpp-portal-theme-v3";

function markThemeReady() {
  document.documentElement.dataset.tppTheme = "v3";
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", markThemeReady, { once: true });
} else {
  markThemeReady();
}
