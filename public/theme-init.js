var strideTheme = "light";
try {
  var t = JSON.parse(localStorage.getItem("algoscope.settings.v1") || "{}").theme || "system";
  if (t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches)) strideTheme = "dark";
} catch {
  strideTheme = "light";
}
document.documentElement.dataset.theme = strideTheme;
