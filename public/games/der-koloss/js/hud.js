// HUD: DOM overlay — points, ammo, round counter, hitmarkers, prompts,
// banners, scoreboard, perk icons, power-up timers, revive UI.
import { CFG } from './config.js';
import { multiplayerRosterPresentation } from './multiplayer-contracts.js';
import { clamp } from './utils.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'),
      points: $('points'),
      ammo: $('ammo'),
      weaponName: $('weapon-name'),
      round: $('round'),
      grenades: $('grenades'),
      hitmarker: $('hitmarker'),
      prompt: $('prompt'),
      promptBar: $('prompt-bar-fill'),
      promptBarWrap: $('prompt-bar'),
      banner: $('banner'),
      bannerSub: $('banner-sub'),
      perks: $('perk-icons'),
      crosshair: $('crosshair'),
      scoreboard: $('scoreboard'),
      scoreRows: $('score-rows'),
      dropTimers: $('drop-timers'),
      reviveWrap: $('revive-wrap'),
      reviveText: $('revive-text'),
      reviveFill: $('revive-fill'),
      downOverlay: $('down-overlay'),
      downText: $('down-text'),
      downNote: document.querySelector('#down-overlay .down-note'),
      bleedFill: $('bleed-fill'),
      healthPulse: $('health-pulse'),
      waveProgress: $('wave-progress'),
      voxSub: $('vox-sub'),
      scope: $('scope-overlay'),
      minimap: $('minimap'),
      reddot: $('reddot-overlay'),
      mic: $('mic-indicator'),
      multiplayerRoster: $('multiplayer-roster'),
      multiplayerRosterRows: $('multiplayer-roster-rows'),
      papNotice: $('pap-notice'),
      // presentation-only additions (absent markup degrades to no-op)
      pointsDelta: $('points-delta'),
      healthTrack: $('health-track'),
      healthFill: $('health-fill'),
      healthTip: $('health-tip'),
      ammoTrack: $('ammo-track'),
      ammoFill: $('ammo-fill'),
    };
    this._hmT = null;
    this._bannerT = null;
    this._lastRound = null;
    this._lastPoints = null;
    this._deltaT = null;
    this._magMax = new Map();
    this._ammoState = '';
    this._healthState = '';
    this._healthScale = -1;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  setPoints(v, flash = false) {
    const prev = this._lastPoints;
    this._lastPoints = v;
    this.el.points.textContent = v;
    if (flash) {
      this.el.points.classList.remove('flash');
      void this.el.points.offsetWidth;
      this.el.points.classList.add('flash');
    }
    // a points change the player caused should be legible as a change, not
    // just as a new total — show the delta and let it drift away.
    const delta = prev == null ? 0 : v - prev;
    const chip = this.el.pointsDelta;
    if (chip && delta !== 0) {
      chip.textContent = (delta > 0 ? '+' : '−') + Math.abs(delta);
      chip.classList.toggle('neg', delta < 0);
      chip.classList.remove('pop');
      void chip.offsetWidth;
      chip.classList.add('pop');
      clearTimeout(this._deltaT);
      this._deltaT = setTimeout(() => chip.classList.remove('pop'), 950);
    }
  }

  // magSize is optional: pass the weapon's real magazine capacity and the fill
  // bar is exact from the first frame. Omit it and the HUD infers capacity from
  // the largest magazine it has seen for that weapon, which is correct as soon
  // as the player has held a full mag once.
  setAmmo(mag, reserve, name, magSize = 0) {
    const sig = `${mag}|${reserve}|${name}`;
    if (sig === this._ammoSig) return;
    const prevSig = this._ammoSig;
    this._ammoSig = sig;
    this.el.ammo.innerHTML = `<span class="mag">${mag}</span><span class="sep">|</span><span class="reserve">${reserve}</span>`;
    this.el.weaponName.textContent = name;

    const declared = Number(magSize) > 0 ? Math.trunc(Number(magSize)) : 0;
    const cap = declared || Math.max(this._magMax.get(name) || 0, mag, 1);
    this._magMax.set(name, cap);
    const frac = Math.max(0, Math.min(1, mag / cap));
    if (this.el.ammoFill) this.el.ammoFill.style.transform = `scaleX(${frac})`;

    const state = mag <= 0 ? 'empty' : frac <= 0.3 ? 'low' : '';
    if (state !== this._ammoState) {
      this._ammoState = state;
      this.el.ammo.classList.toggle('low', state === 'low');
      this.el.ammo.classList.toggle('empty', state === 'empty');
    }
    // only tick when the count actually moved on the same weapon
    if (prevSig && prevSig.endsWith(`|${name}`)) {
      this.el.ammo.classList.remove('tick');
      void this.el.ammo.offsetWidth;
      this.el.ammo.classList.add('tick');
    }
  }

  setRound(n, dogRound = false) {
    if (this._lastRound === n) return;
    this._lastRound = n;
    this.el.round.textContent = dogRound ? '' : n;
    this.el.round.classList.remove('round-anim');
    void this.el.round.offsetWidth;
    this.el.round.classList.add('round-anim');
  }

  setGrenades(n, monkeys = 0) {
    let s = '';
    for (let i = 0; i < n; i++) s += '<span class="nade"></span>';
    for (let i = 0; i < monkeys; i++) s += '<span class="nade monkey"></span>';
    this.el.grenades.innerHTML = s;
    // text counts (grenades always; monkey counter with how-to hint when owned)
    const nc = $('nade-count');
    if (nc) nc.textContent = '× ' + n;
    const mc = $('monkey-count');
    if (mc) {
      mc.classList.toggle('hidden', monkeys <= 0);
      const mn = $('monkey-n');
      if (mn) mn.textContent = monkeys;
    }
  }

  hitmarker(kill = false, head = false) {
    const h = this.el.hitmarker;
    h.className = 'hm-show' + (kill ? ' hm-kill' : '') + (head ? ' hm-head' : '');
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => { h.className = ''; }, 110);
  }

  prompt(text, holdFrac = null) {
    if (text) {
      this.el.prompt.innerHTML = text;
      this.el.prompt.classList.remove('hidden');
      if (holdFrac !== null) {
        this.el.promptBarWrap.classList.remove('hidden');
        this.el.promptBar.style.width = `${clamp(holdFrac, 0, 1) * 100}%`;
      } else {
        this.el.promptBarWrap.classList.add('hidden');
      }
    } else {
      this.el.prompt.classList.add('hidden');
      this.el.promptBarWrap.classList.add('hidden');
    }
  }

  banner(text, color = '#c33', sub = '') {
    const b = this.el.banner;
    b.textContent = text;
    b.style.setProperty('--banner-color', color);
    b.style.color = color;
    b.classList.remove('banner-anim');
    void b.offsetWidth;
    b.classList.add('banner-anim');
    this.el.bannerSub.textContent = sub;
    this.el.bannerSub.classList.remove('banner-sub-anim');
    void this.el.bannerSub.offsetWidth;
    this.el.bannerSub.classList.add('banner-sub-anim');
  }

  setPerks(perkSet, allPerks) {
    const art = { jug: 'juggernog', speed: 'speed-cola', dtap: 'double-tap', qr: 'quick-revive' };
    const colors = { jug: '#e0453a', speed: '#5fd08a', dtap: '#ffb454', qr: '#8fd4ea' };
    const names = { jug: 'Juggernog', speed: 'Speed Cola', dtap: 'Double Tap', qr: 'Quick Revive' };
    const sig = [...perkSet].join(',');
    if (sig === this._perkSig) return;
    this._perkSig = sig;
    this.el.perks.innerHTML = [...perkSet]
      .map((p) => {
        const tint = colors[p] || '#b9cbe0';
        const label = names[p] || p;
        // A perk with no shipped art still gets a chip, so a new id degrades to
        // the old bordered glyph instead of a broken image.
        if (!art[p]) return `<span class="perk-icon perk-icon-glyph" style="--perk:${tint}" title="${label}" aria-label="${label}">?</span>`;
        return `<img class="perk-icon" src="assets/perks/${art[p]}.webp" style="--perk:${tint}" title="${label}" alt="${label}" width="32" height="32" decoding="async">`;
      })
      .join('');
  }

  setCrosshair(spreadPx, visible, adsT) {
    const c = this.el.crosshair;
    const opacity = visible ? (adsT > 0.7 ? 0.25 : 1) : 0;
    const gap = Math.round((6 + spreadPx) * 10) / 10;
    if (opacity !== this._crosshairOpacity) {
      this._crosshairOpacity = opacity;
      c.style.opacity = opacity;
    }
    if (gap !== this._crosshairGap) {
      this._crosshairGap = gap;
      c.style.setProperty('--gap', `${gap}px`);
    }
  }

  setDropTimers(timers) {
    // timers: {insta: secsLeft, double: secsLeft}
    const insta = timers.insta > 0 ? Math.ceil(timers.insta) : 0;
    const double = timers.double > 0 ? Math.ceil(timers.double) : 0;
    const sig = `${insta}|${double}`;
    if (sig === this._dropTimerSig) return;
    this._dropTimerSig = sig;
    let html = '';
    if (insta) html += `<div class="drop-timer" style="color:#ff6a5a">INSTA-KILL ${insta}</div>`;
    if (double) html += `<div class="drop-timer" style="color:#ffd24a">DOUBLE POINTS ${double}</div>`;
    this.el.dropTimers.innerHTML = html;
  }

  reviveUI(show, text = '', frac = 0) {
    if (show) {
      this.el.reviveWrap.classList.remove('hidden');
      this.el.reviveText.textContent = text;
      this.el.reviveFill.style.width = `${clamp(frac, 0, 1) * 100}%`;
    } else this.el.reviveWrap.classList.add('hidden');
  }

  downUI(show, bleedFrac = 1, beingRevived = false, selfRevive = false, hasTeammates = true) {
    if (show) {
      this.el.downOverlay.classList.remove('hidden');
      // beingRevived may be a string ("BEING REVIVED BY NIKOLAI") so the player
      // on the floor knows who is actually coming for them, not just that
      // someone is. Plain true keeps the generic wording.
      this.el.downText.textContent = beingRevived
        ? (typeof beingRevived === 'string' ? beingRevived : 'BEING REVIVED…')
        : selfRevive ? 'REVIVING YOURSELF…' : 'YOU ARE DOWN';
      // "a teammate CAN revive you" is a contradiction once one actually is —
      // and a lie in solo, where going down with no self-revive is simply the end.
      if (this.el.downNote) {
        this.el.downNote.style.display = (beingRevived || selfRevive || !hasTeammates) ? 'none' : '';
      }
      this.el.bleedFill.style.width = `${clamp(bleedFrac, 0, 1) * 100}%`;
    } else this.el.downOverlay.classList.add('hidden');
  }

  healthPulse(frac) {
    // 1. the readable bar: quantised so we only touch the DOM when it moves
    const clamped = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 1));
    const scale = Math.round(clamped * 100) / 100;
    if (scale !== this._healthScale) {
      this._healthScale = scale;
      if (this.el.healthFill) this.el.healthFill.style.transform = `scaleX(${scale})`;
      if (this.el.healthTip) this.el.healthTip.style.transform = `translate3d(${scale * 100}%, 0, 0)`;
      const state = scale <= 0.3 ? 'crit' : scale <= 0.6 ? 'warn' : 'ok';
      if (state !== this._healthState) {
        this._healthState = state;
        if (this.el.healthTrack) {
          this.el.healthTrack.dataset.state = state;
          this.el.healthTrack.setAttribute('aria-label', `Health ${Math.round(scale * 100)}%`);
        }
      }
    }
    // 2. the peripheral pulse, unchanged in behaviour
    const opacity = frac < 0.55 ? Math.round((0.55 - frac) * 160) / 100 : 0;
    if (opacity === this._healthOpacity) return;
    this._healthOpacity = opacity;
    this.el.healthPulse.style.opacity = String(opacity);
  }

  scoreboard(show, rows) {
    if (!show) { this.el.scoreboard.classList.add('hidden'); this._scoreSig = ''; return; }
    this.el.scoreboard.classList.remove('hidden');
    const sig = rows.map((r) => [r.name, r.c, r.kills, r.downs, r.revives, r.points, !!r.down, !!r.dead].join('|')).join('~');
    if (sig === this._scoreSig) return;
    this._scoreSig = sig;
    const frag = document.createDocumentFragment();
    for (const r of rows) {
      const tr = document.createElement('tr');
      const colorIndex = Number.isFinite(Number(r.c)) ? Math.abs(Math.trunc(Number(r.c))) % CFG.COLORS.length : 0;
      tr.style.color = CFG.COLORS[colorIndex];
      if (r.dead) tr.className = 'is-dead';
      else if (r.down) tr.className = 'is-down';
      const values = [
        `${String(r.name || 'Player').slice(0, 14)}${r.dead ? ' †' : r.down ? ' (DOWN)' : ''}`,
        r.kills, r.downs, r.revives, r.points,
      ];
      for (const value of values) {
        const td = document.createElement('td');
        td.textContent = String(value ?? 0);
        tr.appendChild(td);
      }
      frag.appendChild(tr);
    }
    this.el.scoreRows.replaceChildren(frag);
  }

  multiplayerRoster(multiplayer, players) {
    const roster = this.el.multiplayerRoster;
    const rowsEl = this.el.multiplayerRosterRows;
    if (!roster || !rowsEl) return;
    const presentation = multiplayerRosterPresentation(multiplayer, players);
    if (presentation.signature === this._multiplayerRosterSig) return;
    this._multiplayerRosterSig = presentation.signature;
    roster.classList.toggle('hidden', !presentation.visible);
    roster.setAttribute('aria-hidden', String(!presentation.visible));
    if (!presentation.visible) {
      rowsEl.replaceChildren();
      return;
    }

    const existing = new Map([...rowsEl.children].map((row) => [row.dataset.playerId, row]));
    const active = new Set();
    for (const player of presentation.rows) {
      active.add(player.id);
      let row = existing.get(player.id);
      if (!row) {
        row = document.createElement('div');
        row.className = 'squad-row';
        row.setAttribute('role', 'listitem');
        row.dataset.playerId = player.id;

        const color = document.createElement('span');
        color.className = 'squad-color';
        color.setAttribute('aria-hidden', 'true');
        const identity = document.createElement('div');
        identity.className = 'squad-identity';
        const name = document.createElement('div');
        name.className = 'squad-name';
        const persona = document.createElement('div');
        persona.className = 'squad-persona';
        identity.append(name, persona);
        const points = document.createElement('div');
        points.className = 'squad-points';
        const voice = document.createElement('span');
        voice.className = 'squad-voice';
        voice.setAttribute('aria-hidden', 'true');
        const voiceGlyph = document.createElement('span');
        voiceGlyph.className = 'squad-voice-glyph';
        const voiceLabel = document.createElement('span');
        voiceLabel.className = 'squad-voice-label';
        voice.append(voiceGlyph, voiceLabel);
        row.append(color, identity, points, voice);
      }

      const rowSignature = [player.name, player.persona, player.color, player.points, player.voice].join('|');
      if (row.dataset.signature !== rowSignature) {
        row.dataset.signature = rowSignature;
        row.style.setProperty('--squad-color', player.color);
        row.querySelector('.squad-name').textContent = player.name;
        row.querySelector('.squad-persona').textContent = player.persona;
        row.querySelector('.squad-points').textContent = player.points.toLocaleString('en-US');
        row.querySelector('.squad-voice').dataset.state = player.voice;
        row.querySelector('.squad-voice-label').textContent = player.voice === 'muted' ? 'OFF' : 'MIC';
        row.setAttribute('aria-label', `${player.name}, ${player.persona}, ${player.points} points, microphone ${player.voice}`);
      }
      rowsEl.appendChild(row);
    }
    for (const [id, row] of existing) if (!active.has(id)) row.remove();
  }

  drawMinimap(g) {
    const c = this.el.minimap;
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const B = { minX: -47, maxX: 35, minZ: -65, maxZ: 29 };
    // Uniform scale on both axes. The footprint is 82m x 94m drawn into a
    // square, so an independent per-axis scale squashed it horizontally and
    // the rooms no longer matched the shape of the level the player walks.
    const spanX = B.maxX - B.minX, spanZ = B.maxZ - B.minZ;
    const s = Math.min(W / spanX, H / spanZ);
    const ox = (W - spanX * s) * 0.5, oz = (H - spanZ * s) * 0.5;
    const sx = s, sz = s;
    const X = (x) => ox + (x - B.minX) * s, Z = (z) => oz + (z - B.minZ) * s;
    // OPAQUE backing. This canvas sits on top of the live 3D frame, and the
    // fill used to be 58% alpha over a 42%-alpha frame — so the panel was
    // really a tinted window onto whatever the camera happened to be pointing
    // at. At spawn that is the moonlit sky above the factory wall, which is the
    // brightest thing in the level, so the whole map washed out to a white
    // rectangle and the 44%-alpha room outlines disappeared into it. A HUD
    // element must not depend on the scene behind it to stay legible.
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#070a10';
    ctx.fillRect(0, 0, W, H);
    if (!g.map) return;
    // room footprints — cold moonlight, so the warm markers read as signal
    ctx.strokeStyle = 'rgba(150,178,210,0.5)';
    ctx.fillStyle = 'rgba(120,148,184,0.09)';
    ctx.lineWidth = 1;
    for (const r of g.map.rooms) {
      const rc = r.rect;
      const rx = X(rc.minX), rz = Z(rc.minZ);
      const rw = (rc.maxX - rc.minX) * sx, rh = (rc.maxZ - rc.minZ) * sz;
      ctx.fillRect(rx, rz, rw, rh);
      ctx.strokeRect(rx, rz, rw, rh);
    }
    // doors: red = closed, green = open, amber = power-sealed
    for (const d of g.map.doors) {
      if (d.preOpen) continue;
      ctx.fillStyle = d.open ? 'rgba(95,208,138,0.9)' : (d.cost == null ? 'rgba(255,180,84,0.9)' : 'rgba(224,69,58,0.9)');
      ctx.fillRect(X(d.x) - 2, Z(d.z) - 2, 4, 4);
    }
    // power switch
    // NOTE: the "on" colour was missing its closing paren, so assigning it was
    // a silent no-op and the powered-up bolt inherited whatever colour the last
    // door happened to leave behind.
    ctx.fillStyle = g.map.power.on ? 'rgba(120,230,120,0.95)' : 'rgba(230,60,50,0.95)';
    ctx.font = '9px sans-serif';
    ctx.fillText('⚡', X(g.map.power.pos.x) - 4, Z(g.map.power.pos.z) + 3);
    // teleporters (blue when linked)
    for (const tp of g.map.teleporters) {
      ctx.fillStyle = tp.linked ? 'rgba(110,170,255,0.95)' : 'rgba(120,120,130,0.8)';
      ctx.fillText(tp.id === 'teleA' ? 'A' : tp.id === 'teleB' ? 'B' : 'C', X(tp.x) - 3, Z(tp.z) + 3);
    }
    // pack-a-punch + box
    ctx.fillStyle = 'rgba(203,162,255,0.92)';
    ctx.fillText('PaP', X(g.map.pap.pos.x) - 6, Z(g.map.pap.pos.z) + 3);
    ctx.fillStyle = 'rgba(255,180,84,0.95)';
    ctx.fillText('?', X(g.map.box.pos.x) - 2, Z(g.map.box.pos.z) + 3);
    // players
    for (const pl of g.minimapPlayers()) {
      ctx.save();
      ctx.translate(X(pl.x), Z(pl.z));
      if (pl.me) {
        ctx.rotate(-pl.yaw);
        // Facing wedge first, so the arrow sits on top of it. Yaw alone in a
        // 7px glyph is almost unreadable; the cone is what actually tells you
        // which way you are pointed at a glance.
        const cone = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
        cone.addColorStop(0, 'rgba(214,228,255,0.34)');
        cone.addColorStop(1, 'rgba(214,228,255,0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 22, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4.5); ctx.lineTo(0, 2.4); ctx.lineTo(-4, 4.5); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(4,6,11,0.9)';
        ctx.stroke();
      } else {
        // teammates: bold ringed dot in their lobby color (+ down state)
        ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 7);
        ctx.fillStyle = pl.down ? '#e0453a' : pl.color;
        ctx.fill();
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = 'rgba(4,6,11,0.9)';
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  scope(on) {
    if (this.el.scope) this.el.scope.classList.toggle('hidden', !on);
  }

  micIndicator(speakers) {
    // Xbox-360-style: names of who's talking right now (up to 4)
    const el = this.el.mic;
    if (!el) return;
    const list = Array.isArray(speakers) ? speakers : [];
    el.classList.toggle('hidden', list.length === 0);
    let sig = '';
    for (let i = 0; i < list.length; i++) sig += `${i ? '|' : ''}${String(list[i]).slice(0, 14)}`;
    if (sig === this._micSig) return;
    this._micSig = sig;
    const children = list.map((name) => {
      const span = document.createElement('span');
      span.className = 'spk';
      span.textContent = `🎙 ${String(name).slice(0, 14)}`;
      return span;
    });
    el.replaceChildren(...children);
  }

  reddot(on) {
    if (this.el.reddot) this.el.reddot.classList.toggle('hidden', !on);
  }

  voxSub(text, ms = 2800) {
    const el = this.el.voxSub;
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.remove('vox-anim');
    void el.offsetWidth;
    el.classList.add('vox-anim');
    clearTimeout(this._voxT);
    this._voxT = setTimeout(() => el.classList.add('hidden'), ms);
  }

  waveProgress(show, text) {
    const value = text || '';
    const sig = `${show ? 1 : 0}|${value}`;
    if (sig === this._waveSig) return;
    this._waveSig = sig;
    this.el.waveProgress.textContent = value;
    this.el.waveProgress.classList.toggle('hidden', !show);
  }

  papNotice(text) {
    const el = this.el.papNotice;
    if (!text) { el.classList.add('hidden'); return; }
    el.textContent = text;
    el.classList.remove('hidden');
  }
}
