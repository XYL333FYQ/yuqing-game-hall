// Blocking, same-origin bootstrap restores the palette before the first paint.
// Kept external to work with the platform's strict script-src 'self' policy.
(() => {
  let theme = "dark";
  try {
    const saved = localStorage.getItem("yuqing:theme");
    if (saved === "dark" || saved === "light" || saved === "pink") theme = saved;
  } catch {}
  const color = { dark: "#090b10", light: "#f4eddf", pink: "#fff0f5" }[theme];
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  document.documentElement.style.backgroundColor = color;
  document.querySelector('meta[name="theme-color"]').content = color;
})();
