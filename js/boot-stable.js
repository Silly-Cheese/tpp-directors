// Deterministic Board Portal bootstrap.
// Critical live-governance modules mount first; the main app/router comes last.
const RELEASE = "20260817-stable5";

async function boot() {
  try {
    await import(`./phase5.js?v=${RELEASE}`);
    await import(`./phase6.js?v=${RELEASE}`);
    await import(`./app.js?v=${RELEASE}`);
    window.__TPP_BOOT_RELEASE__ = RELEASE;
    window.dispatchEvent(new CustomEvent("tpp:boot-ready", { detail: { release: RELEASE } }));
  } catch (error) {
    console.error("Board Portal critical boot failed", error);
    window.__TPP_BOOT_ERROR__ = String(error?.message || error);
    const message = document.createElement("div");
    message.setAttribute("role", "alert");
    message.style.cssText = "position:fixed;inset:auto 18px 18px 18px;z-index:99999;padding:14px 16px;border:1px solid #8d7452;border-radius:12px;background:#301415;color:#fffdf8;font:600 14px/1.45 system-ui;";
    message.textContent = `The Board Portal could not finish loading: ${window.__TPP_BOOT_ERROR__}`;
    document.body.append(message);
  }
}

boot();
