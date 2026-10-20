/** Three depth planes retain 150 star trails without a full-screen Canvas redraw. */
export function createPortalParticles(options: {
  x: number;
  y: number;
  colors: readonly string[];
  duration: number;
  theme?: string;
}): { start: () => void; finished: Promise<void>; cancel: () => void } {
  const { x, y, colors, duration } = options;
  const requestedTheme = options.theme ?? document.documentElement.dataset.theme;
  const theme = requestedTheme === "light" || requestedTheme === "pink" ? requestedTheme : "dark";
  const width = innerWidth;
  const height = innerHeight;
  const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const layer = document.createElement("div");
  layer.className = "portal-effect";
  layer.dataset.theme = theme;
  layer.dataset.pattern = theme === "light" ? "prism" : theme === "pink" ? "bloom" : "warp";
  layer.setAttribute("aria-hidden", "true");
  layer.style.setProperty("--portal-x", `${x}px`);
  layer.style.setProperty("--portal-y", `${y}px`);
  layer.style.setProperty("--portal-accent", colors[0]);
  layer.innerHTML = Array.from({ length: 3 }, (_, plane) => {
    const paths = Array.from({ length: width < 700 ? 28 : 50 }, (_, index) => {
      const seed = index * 3 + plane;
      const angle = seed * 2.39996323;
      const distance = radius * (0.08 + ((seed * 31) % 97) / 110);
      const tail = 10 + (seed % 9) * 7;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const px = (x + cos * distance).toFixed(1);
      const py = (y + sin * distance).toFixed(1);
      const shape = theme === "light"
        ? `M${px} ${py}l${tail * .35} -3 4 6 -${tail * .35} 3Z`
        : theme === "pink"
          ? `M${px} ${py}q${tail * .3} -${tail * .4} ${tail * .65} -2q-${tail * .25} ${tail * .4} -${tail * .65} 2Z`
          : `M${px} ${py}l${(cos * tail).toFixed(1)} ${(sin * tail).toFixed(1)}`;
      return `<path d="${shape}" opacity="${0.4 + (seed % 4) * 0.2}"/>`;
    }).join("");
    return `<svg class="portal-stars" viewBox="0 0 ${width} ${height}" fill="none" stroke="${colors[plane % colors.length]}" stroke-width="${0.9 + plane * 0.5}" stroke-linecap="round" aria-hidden="true">${paths}</svg>`;
  }).join("") + '<div class="portal-wave"></div><div class="portal-wave portal-wave-echo"></div>';
  const glints = Array.from({ length: width < 700 ? 6 : 9 }, (_, index) => {
    const angle = index * 2.39996323;
    const distance = radius * (0.2 + index % 4 * 0.13);
    const gx = x + Math.cos(angle) * distance;
    const gy = y + Math.sin(angle) * distance;
    return `<path d="M${gx - 4} ${gy}h8M${gx} ${gy - 4}v8"/>`;
  }).join("");
  layer.insertAdjacentHTML("beforeend", `<svg class="portal-sparkles" viewBox="0 0 ${width} ${height}" fill="none" stroke="${colors[1]}" stroke-width="1" stroke-linecap="round" aria-hidden="true">${glints}</svg>`);
  const signature = Array.from({ length: width < 700 ? 6 : 10 }, (_, index) => {
    const angle = index * 2.39996323;
    const distance = radius * (.18 + index % 4 * .13);
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    const color = colors[index % colors.length];
    if (theme === "light") return `<path d="M${px - 45} ${py + 22}l90 -48 22 10 -90 48Z" fill="${color}" fill-opacity=".16" stroke="${color}" stroke-opacity=".42"/>`;
    if (theme === "pink") return `<path d="M0 0C-20 -25 10 -42 19 -34C35 -17 12 -2 0 0Z" transform="translate(${px} ${py}) rotate(${index * 47})" fill="${color}" fill-opacity=".3" stroke="${color}" stroke-opacity=".45"/>`;
    return `<path d="M${px} ${py}l${Math.cos(angle) * 80} ${Math.sin(angle) * 80}" stroke="${color}" stroke-opacity=".35"/><circle cx="${px}" cy="${py}" r="${index % 3 + 1.5}" fill="${color}"/>`;
  }).join("");
  layer.insertAdjacentHTML("beforeend", `<svg class="portal-signature" viewBox="0 0 ${width} ${height}" aria-hidden="true">${signature}</svg>`);
  document.body.append(layer);

  let complete!: () => void;
  const finished = new Promise<void>((resolve) => { complete = resolve; });
  const animations: Animation[] = [];
  let stopped = false;
  const cancel = (): void => {
    stopped = true;
    animations.forEach((animation) => animation.cancel());
    layer.remove();
    complete();
  };
  const start = (): void => {
    if (stopped || animations.length) return;
    layer.querySelectorAll<SVGElement>(".portal-stars").forEach((stars, plane) => {
      const trajectory = theme === "light"
        ? ["translate(-90px, 30px) scale(.45) rotate(-8deg)", `translate(70px, -25px) scale(${1.2 + plane * .12}) rotate(4deg)`]
        : theme === "pink"
          ? ["translateY(65px) scale(.35) rotate(-18deg)", `translateY(-55px) scale(${1.25 + plane * .15}) rotate(16deg)`]
          : ["scale(0.04)", `scale(${1.4 + plane * 0.3})`];
      animations.push(stars.animate([
        { transform: trajectory[0], opacity: 0 },
        { opacity: 0.95, offset: 0.2 },
        { opacity: 0.8, offset: 0.65 },
        { transform: trajectory[1], opacity: 0 },
      ], { duration, easing: "cubic-bezier(0.4, 0, 0.16, 1)", fill: "both" }));
    });
    layer.querySelectorAll<HTMLElement>(".portal-wave").forEach((wave, index) => {
      const shape = theme === "light" ? "rotate(-24deg) scale(1, .6) " : theme === "pink" ? "rotate(18deg) scale(1, .82) " : "";
      animations.push(wave.animate([
        { transform: `translate(-50%, -50%) ${shape}scale(0.01)`, opacity: 0 },
        { opacity: index ? 0.3 : 0.7, offset: 0.15 },
        { transform: `translate(-50%, -50%) ${shape}scale(${radius / 150})`, opacity: 0 },
      ], { duration: duration - index * 120, delay: index * 120, easing: "cubic-bezier(0.4, 0, 0.16, 1)", fill: "both" }));
    });
    const sparkles = layer.querySelector<SVGElement>(".portal-sparkles");
    if (sparkles) animations.push(sparkles.animate([
      { transform: "scale(.65)", opacity: 0 },
      { opacity: .8, offset: .35 },
      { transform: "scale(1.08)", opacity: 0 },
    ], { duration: duration - 240, delay: 240, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "both" }));
    const motif = layer.querySelector<SVGElement>(".portal-signature");
    if (motif) {
      const motion = theme === "light" ? ["translateX(-120px) scale(.7)", "translateX(95px) scale(1.1)"]
        : theme === "pink" ? ["translateY(60px) rotate(-12deg) scale(.65)", "translateY(-70px) rotate(16deg) scale(1.15)"]
          : ["scale(.12)", "scale(1.3)"];
      animations.push(motif.animate([
        { transform: motion[0], opacity: 0 },
        { opacity: .85, offset: .3 },
        { transform: motion[1], opacity: 0 },
      ], { duration, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "both" }));
    }
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => complete());
  };
  return { start, finished, cancel };
}
