var algoscopeTheme = "light";
try {
  var t = JSON.parse(localStorage.getItem("algoscope.settings.v1") || "{}").theme || "system";
  if (t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches)) algoscopeTheme = "dark";
} catch (err) {
  algoscopeTheme = String(err) ? "light" : "light";
}
document.documentElement.dataset.theme = algoscopeTheme;
