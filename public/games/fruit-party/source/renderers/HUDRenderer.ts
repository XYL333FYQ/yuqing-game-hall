import type { FruitNinjaState } from "../types";
import { ARCADE_EVENT_DEFINITIONS } from "../systems/ArcadeSystem";

export class HUDRenderer {
  render(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    if (!state.started) return;
    if (state.mode === "endless" || state.mode === "arcade") this.drawScore(ctx, state);
    if (state.mode === "endless" && state.rules.missesCostLife) this.drawLives(ctx, state);
    if (state.mode === "arcade") this.drawTimer(ctx, state);
    this.drawWarmup(ctx, state);
    if (state.mode === "arcade") this.drawArcadeHud(ctx, state);
    this.drawCombo(ctx, state);
    if (state.countdownTimer > 0) this.drawCountdown(ctx, state);
    else if (state.paused) this.drawPaused(ctx, state);
  }

  private drawScore(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    ctx.save();
    ctx.fillStyle = "rgba(13,18,14,.84)";
    ctx.beginPath();
    ctx.moveTo(18, 17);
    ctx.lineTo(176, 17);
    ctx.lineTo(190, 31);
    ctx.lineTo(181, 94);
    ctx.lineTo(18, 94);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(246,232,202,.7)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#e85f2c";
    ctx.fillRect(18, 17, 7, 77);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#efb34c";
    ctx.font = "700 10px 'Microsoft YaHei UI', system-ui, sans-serif";
    ctx.fillText("得分", 37, 27);
    ctx.fillStyle = "#fff8e8";
    ctx.font = "700 42px 'YQ Display', 'Microsoft YaHei UI', sans-serif";
    ctx.fillText(String(state.score).padStart(3, "0"), 34, 35);
    ctx.font = "700 10px 'Microsoft YaHei UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,248,232,.58)";
    ctx.fillText(`最高  ${state.highScore}`, 119, 69);
    ctx.restore();
  }

  private drawLives(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    ctx.save();
    ctx.fillStyle = "rgba(255,248,232,.58)";
    ctx.font = "700 9px 'Microsoft YaHei UI', system-ui, sans-serif";
    ctx.fillText("剩余机会", 20, 111);
    for (let index = 0; index < state.rules.startingLives; index += 1) {
      const alive = index < state.lives;
      const x = 35 + index * 29;
      const y = 136;
      ctx.globalAlpha = alive ? 1 : 0.38;
      ctx.fillStyle = alive ? (state.lives === 1 ? "#ef5c38" : "#efaa38") : "#4c574e";
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 9, -.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = alive ? "rgba(255,248,220,.72)" : "rgba(255,255,255,.2)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (alive) {
        ctx.fillStyle = "#5f9a5e";
        ctx.beginPath();
        ctx.ellipse(x + 4, y - 9, 4, 2.3, -.55, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!alive) {
        ctx.strokeStyle = "rgba(255,255,255,.62)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4);
        ctx.lineTo(x - 4, y + 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawTimer(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    const remaining = Math.max(0, (state.rules.durationMs ?? 0) - state.elapsedMs);
    const totalSeconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "700 27px 'YQ Display', ui-monospace, monospace";
    ctx.fillStyle = remaining < 10_000 ? "#ff764c" : "#fff3d7";
    ctx.shadowColor = "rgba(0,0,0,.72)";
    ctx.shadowBlur = 6;
    ctx.fillText(`${minutes}:${seconds}`, state.width / 2, 31);
    ctx.restore();
  }

  private drawWarmup(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    if (state.mode !== "endless" || state.score > 0 || state.elapsedMs >= 10_000 || state.countdownTimer > 0) return;
    ctx.save();
    ctx.fillStyle = "rgba(255,243,215,.68)";
    ctx.font = "700 10px 'Microsoft YaHei UI', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("开局十秒热身 · 漏切不扣命", 20, 162);
    ctx.fillStyle = "#e85f2c";
    ctx.fillRect(20, 173, 148, 3);
    ctx.restore();
  }

  private drawArcadeHud(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    const arcade = state.arcade;
    if (!arcade || state.countdownTimer > 0) return;
    const panelWidth = 286;
    const panelX = state.width - panelWidth - 18;
    const event = arcade.activeEventId ? ARCADE_EVENT_DEFINITIONS[arcade.activeEventId] : undefined;
    let eyebrow = "街机 · 90 秒";
    let title = "热身阶段";
    let detail = "先找准刀感 · 暂无炸弹";
    let progress = 0;
    if (arcade.phase === "event" && event && arcade.activeEventId) {
      eyebrow = `挑战 ${arcade.activeEventIndex + 1} / 3`;
      title = event.label;
      progress = arcade.eventProgress[arcade.activeEventId];
      detail = `${event.hint}  ${progress}/${event.goal}`;
    } else if (arcade.phase === "transition") {
      title = "换气时间";
      detail = "普通水果 · 下一挑战马上开始";
    } else if (arcade.phase === "boss-warning") {
      eyebrow = "终局将至";
      title = "巨型水果警告";
      detail = "准备连续挥刀";
    } else if (arcade.phase === "boss") {
      eyebrow = "终局 · 巨型水果";
      title = arcade.bossCompleted ? "巨果已击破" : "连续切割巨果";
      detail = `${arcade.bossHits}/${arcade.bossMaxHits} 刀`;
      progress = arcade.bossHits;
    }

    ctx.save();
    ctx.fillStyle = "rgba(13,18,14,.86)";
    ctx.beginPath();
    ctx.moveTo(panelX + 13, 18);
    ctx.lineTo(panelX + panelWidth, 18);
    ctx.lineTo(panelX + panelWidth, 106);
    ctx.lineTo(panelX, 106);
    ctx.lineTo(panelX, 31);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(246,232,202,.62)";
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = arcade.phase === "boss-warning" ? "#ff7d53" : "#efb34c";
    ctx.font = "850 9px 'Microsoft YaHei UI', system-ui, sans-serif";
    ctx.fillText(eyebrow, panelX + 17, 31);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 21px 'YQ Display', 'Microsoft YaHei UI', sans-serif";
    ctx.fillText(title, panelX + 17, 48);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "700 10px 'Microsoft YaHei UI', system-ui, sans-serif";
    ctx.fillText(detail, panelX + 17, 77);
    if ((arcade.phase === "event" && event) || arcade.phase === "boss") {
      const goal = arcade.phase === "boss" ? arcade.bossMaxHits : event!.goal;
      const ratio = Math.min(1, progress / goal);
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fillRect(panelX + 174, 80, 94, 5);
      ctx.fillStyle = ratio >= 1 ? "#60c88a" : "#e85f2c";
      ctx.fillRect(panelX + 174, 80, 94 * ratio, 5);
    }
    ctx.restore();

    this.drawFeverBar(ctx, state);
    if (arcade.announcementTimer > 0) this.drawArcadeAnnouncement(ctx, state, arcade.announcement);
  }

  private drawFeverBar(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    const arcade = state.arcade!;
    const width = Math.min(390, state.width * 0.36);
    const x = (state.width - width) / 2;
    const y = state.height - 57;
    const active = arcade.feverTimer > 0;
    const ratio = active ? arcade.feverTimer / 6_000 : arcade.fever / 100;
    ctx.save();
    ctx.fillStyle = "rgba(13,18,14,.86)";
    ctx.fillRect(x - 13, y - 19, width + 26, 39);
    ctx.fillStyle = "rgba(255,255,255,.1)";
    ctx.fillRect(x, y, width, 7);
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, active ? "#ff7a35" : "#3b8d62");
    gradient.addColorStop(0.6, active ? "#ffd05b" : "#e8a83a");
    gradient.addColorStop(1, "#fff1a6");
    ctx.fillStyle = gradient;
    ctx.shadowColor = active ? "#ffbe55" : "transparent";
    ctx.shadowBlur = active ? 15 : 0;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, ratio)), 7);
    ctx.shadowBlur = 0;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = active ? "#ffe8a0" : "rgba(255,255,255,.58)";
    ctx.font = "850 9px 'Microsoft YaHei UI', system-ui, sans-serif";
    ctx.fillText(active ? `狂热爆发  ${(arcade.feverTimer / 1000).toFixed(1)}s` : `狂热  ${Math.round(arcade.fever)}%`, x, y - 8);
    ctx.textAlign = "right";
    ctx.fillText(active ? "双倍得分 · 无新炸弹" : "切中、完美切、连斩可充能", x + width, y - 8);
    ctx.restore();
  }

  private drawArcadeAnnouncement(
    ctx: CanvasRenderingContext2D,
    state: FruitNinjaState,
    text: string,
  ): void {
    const arcade = state.arcade!;
    const alpha = Math.min(1, arcade.announcementTimer / 320);
    ctx.save();
    ctx.translate(state.width / 2, 135);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(15,20,15,.9)";
    ctx.beginPath();
    ctx.moveTo(-178, -23);
    ctx.lineTo(190, -23);
    ctx.lineTo(178, 23);
    ctx.lineTo(-190, 23);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = arcade.feverTimer > 0 ? "rgba(255,218,99,.75)" : "rgba(232,95,44,.7)";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 15px 'YQ Display', 'Microsoft YaHei UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  private drawCombo(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    if (state.combo < 2 && state.lastSliceLabelTimer <= 0) return;
    const text = state.lastSliceLabelTimer > 0 ? state.lastSliceLabel : `${state.combo} 连击`;
    ctx.save();
    const pulse = 1 + Math.sin(performance.now() * 0.018) * 0.05;
    ctx.translate(state.width / 2, 92);
    ctx.scale(pulse, pulse);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 38px 'YQ Display', system-ui, sans-serif";
    ctx.fillStyle = "#fff0a8";
    ctx.strokeStyle = "#4b2d15";
    ctx.lineWidth = 6;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  private drawCountdown(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    const step = Math.max(1, Math.ceil(state.countdownTimer / 600));
    const label = state.countdownTimer < 430 ? "开始！" : String(step);
    const scale = 1 + (state.countdownTimer % 600) / 2_400;
    ctx.save();
    ctx.translate(state.width / 2, state.height / 2);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#e85f2c";
    ctx.shadowBlur = 18;
    ctx.font = "700 80px 'YQ Display', system-ui, sans-serif";
    ctx.fillStyle = "#fff4d8";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  private drawPaused(ctx: CanvasRenderingContext2D, state: FruitNinjaState): void {
    this.drawCenteredPanel(ctx, state, "已暂停", "按 P 或点击继续");
  }

  private drawCenteredPanel(
    ctx: CanvasRenderingContext2D,
    state: FruitNinjaState,
    title: string,
    subtitle: string,
  ): void {
    const centerX = state.width / 2;
    const centerY = state.height / 2;
    ctx.save();
    ctx.fillStyle = "rgba(18,24,18,.94)";
    ctx.beginPath();
    ctx.moveTo(centerX - 220, centerY - 78);
    ctx.lineTo(centerX + 235, centerY - 78);
    ctx.lineTo(centerX + 220, centerY + 78);
    ctx.lineTo(centerX - 235, centerY + 78);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(245,229,195,.72)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#e85f2c";
    ctx.fillRect(centerX - 58, centerY - 81, 116, 6);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 42px 'YQ Display', system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(title, centerX, centerY - 20);
    ctx.font = "650 17px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,.68)";
    ctx.fillText(subtitle, centerX, centerY + 35);
    ctx.restore();
  }
}

