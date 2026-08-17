// High-contrast reset loaded after every phase module.
const id = "tpp-contrast-v2";
if (!document.getElementById(id)) {
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = "./portal-contrast-v2.css?v=20260817-2";
  document.head.append(link);
}
document.documentElement.dataset.tppContrast = "v2";
