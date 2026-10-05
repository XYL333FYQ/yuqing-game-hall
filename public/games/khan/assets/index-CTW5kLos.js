//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/utility.ts
var gei = (id) => document.getElementById(id);
var qs = (e, selector) => e.querySelector(selector);
var ce = (c = "x", innerHTML = "") => {
	const el = document.createElement("div");
	el.classList.add(...c.trim().split(" "));
	el.innerHTML = innerHTML;
	return el;
};
function getRandomIntInclusive(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max) + 1;
	return Math.floor(Math.random() * (max - min) + min);
}
function resize(e) {
	let scale = 1;
	e.board.style.transform = `scale(${scale})`;
	while (e.board?.getBoundingClientRect().width > window.innerWidth || e.board.getBoundingClientRect().height > window.innerHeight) {
		scale -= .05;
		e.board.style.transform = `scale(${scale})`;
	}
}
function uuid() {
	return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}
function getAttackForData(attack, modData) {
	if (!modData) return attack;
	return Math.ceil(attack * (modData.e ? 1.5 : 1) * (modData.w ? .75 : 1));
}
function getDefenceForData(defence, modData) {
	if (!modData) return defence;
	return Math.ceil(defence * (!!modData.w ? .5 : 1));
}
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/levels.ts
var levels = {
	1: { enemies: () => [getRandomIntInclusive(9, 9)] },
	2: { enemies: () => [getRandomIntInclusive(9, 9), getRandomIntInclusive(9, 9)] },
	3: { enemies: () => [getRandomIntInclusive(7, 8)] },
	4: { enemies: () => [getRandomIntInclusive(7, 8), getRandomIntInclusive(6, 9)] },
	5: { enemies: () => [
		getRandomIntInclusive(7, 9),
		getRandomIntInclusive(5, 7),
		getRandomIntInclusive(5, 7)
	] },
	6: { enemies: () => [
		4,
		getRandomIntInclusive(5, 9),
		getRandomIntInclusive(5, 9)
	] },
	7: { enemies: () => [
		4,
		4,
		getRandomIntInclusive(5, 7)
	] },
	8: { enemies: () => [
		3,
		2,
		getRandomIntInclusive(7, 9)
	] },
	9: { enemies: () => [
		3,
		2,
		3
	] },
	10: { enemies: () => [
		1,
		2,
		3,
		5
	] }
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/GameElement.ts
var GameElement = class {
	constructor(game) {
		if (game) this.register(game);
	}
	register(game) {
		this.game = game;
	}
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/enums.ts
var DeckCollections = /* @__PURE__ */ function(DeckCollections) {
	DeckCollections["HAND"] = "HAND";
	DeckCollections["DRAW"] = "DRAW";
	DeckCollections["DONE"] = "DONE";
	DeckCollections["INNATE"] = "INNATE";
	return DeckCollections;
}({});
var SPRITE_TYPE = /* @__PURE__ */ function(SPRITE_TYPE) {
	SPRITE_TYPE["player"] = "player";
	SPRITE_TYPE["enemy"] = "enemy";
	SPRITE_TYPE["mount"] = "mount";
	return SPRITE_TYPE;
}({});
var CARD_TYPE = /* @__PURE__ */ function(CARD_TYPE) {
	CARD_TYPE["assault"] = "assault";
	CARD_TYPE["ability"] = "ability";
	CARD_TYPE["defense"] = "defense";
	CARD_TYPE["innate"] = "innate";
	return CARD_TYPE;
}({});
var ACTIVATION_TRIGGER = /* @__PURE__ */ function(ACTIVATION_TRIGGER) {
	ACTIVATION_TRIGGER["round"] = "round";
	ACTIVATION_TRIGGER["turn"] = "turn";
	ACTIVATION_TRIGGER["buff"] = "buff";
	return ACTIVATION_TRIGGER;
}({});
var GAME_STATE = /* @__PURE__ */ function(GAME_STATE) {
	GAME_STATE["PLAYER_TURN"] = "player_turn";
	GAME_STATE["ENEMY_TURN"] = "enemy_turn";
	GAME_STATE["PICKING_CARD"] = "picking_card";
	GAME_STATE["GAME_OVER"] = "game_over";
	GAME_STATE["TRANSITION"] = "TRANSITION";
	return GAME_STATE;
}({});
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/renderer.ts
function spriteElementBuilder(name, hp, type, mounted, id) {
	const wrapper = ce(`sprite-wrapper ${type === SPRITE_TYPE.enemy ? "enemy" : "x"} ${mounted ? "mounted" : "x"}`);
	wrapper.id = id;
	if (mounted) wrapper.appendChild(ce("sprite horse"));
	const a = ce(`sprite ${name}`);
	const b = ce("intent");
	const c = ce("assault-value");
	b.appendChild(c);
	a.appendChild(b);
	wrapper.appendChild(a);
	const d = ce("stats hp");
	d.appendChild(ce("number", `${hp}/${hp}`));
	d.appendChild(ce("fill"));
	wrapper.appendChild(d);
	const e = ce("stats affects");
	e.appendChild(ce("armor", "D:0"));
	e.appendChild(ce("enrage", "E:0"));
	e.appendChild(ce("weak", "W:0"));
	wrapper.appendChild(e);
	const f = ce("targeting");
	wrapper.appendChild(f);
	return wrapper;
}
function cardElementBuilder(card) {
	const wrapper = ce("card pixel-border");
	wrapper.id = card.id;
	const d = ce("detail");
	card.attributes.forEach((attribute) => {
		d.appendChild(ce("x", attribute));
	});
	const b = ce("body");
	b.appendChild(d);
	if (card.data.flavor) b.appendChild(ce("flavor", card.data.flavor));
	if (card.type !== CARD_TYPE.innate) wrapper.appendChild(ce("cost", card.data.c.toString()));
	else wrapper.classList.add("innate");
	wrapper.appendChild(ce("title", card.name));
	wrapper.appendChild(b);
	return wrapper;
}
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/zzfx.ts
/**
* Master volume scale.
*/
var zzfxV = .3;
/**
* Sample rate for audio.
*/
var zzfxR = 44100;
/**
* Create shared audio context.
*/
var zzfxX = new AudioContext();
/**
* Play a sound from zzfx paramerters.
*/
function zzfx(...parameters) {
	return zzfxP(zzfxG(...parameters));
}
/**
* Play an array of samples.
*/
function zzfxP(...samples) {
	const buffer = zzfxX.createBuffer(samples.length, samples[0].length, zzfxR), source = zzfxX.createBufferSource();
	samples.map((d, i) => buffer.getChannelData(i).set(d));
	source.buffer = buffer;
	source.connect(zzfxX.destination);
	source.start();
	return source;
}
/**
* Build an array of samples.
*/
function zzfxG(volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0, release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0, pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0, bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0) {
	const PI2 = Math.PI * 2;
	const sampleRate = zzfxR;
	const sign = (v) => v > 0 ? 1 : -1;
	const startSlide = slide *= 500 * PI2 / sampleRate / sampleRate;
	const b = [];
	let startFrequency = frequency *= (1 + randomness * 2 * Math.random() - randomness) * PI2 / sampleRate, t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0, f, length;
	attack = attack * sampleRate + 9;
	decay *= sampleRate;
	sustain *= sampleRate;
	release *= sampleRate;
	delay *= sampleRate;
	deltaSlide *= 500 * PI2 / sampleRate ** 3;
	modulation *= PI2 / sampleRate;
	pitchJump *= PI2 / sampleRate;
	pitchJumpTime *= sampleRate;
	repeatTime = repeatTime * sampleRate | 0;
	for (length = attack + decay + sustain + release + delay | 0; i < length; b[i++] = s) {
		if (!(++c % (bitCrush * 100 | 0))) {
			s = shape ? shape > 1 ? shape > 2 ? shape > 3 ? Math.sin((t % PI2) ** 3) : Math.max(Math.min(Math.tan(t), 1), -1) : 1 - (2 * t / PI2 % 2 + 2) % 2 : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2) : Math.sin(t);
			s = (repeatTime ? 1 - tremolo + tremolo * Math.sin(PI2 * i / repeatTime) : 1) * sign(s) * Math.abs(s) ** shapeCurve * volume * zzfxV * (i < attack ? i / attack : i < attack + decay ? 1 - (i - attack) / decay * (1 - sustainVolume) : i < attack + decay + sustain ? sustainVolume : i < length - delay ? (length - i - delay) / release * sustainVolume : 0);
			s = delay ? s / 2 + (delay > i ? 0 : (i < length - delay ? 1 : (length - i) / delay) * b[i - delay | 0] / 2) : s;
		}
		f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
		t += f - f * noise * (1 - (Math.sin(i) + 1) * 1e9 % 2);
		if (j && ++j > pitchJumpTime) {
			frequency += pitchJump;
			startFrequency += pitchJump;
			j = 0;
		}
		if (repeatTime && !(++r % repeatTime)) {
			frequency = startFrequency;
			slide = startSlide;
			j = j || 1;
		}
	}
	return b;
}
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/sounds.ts
var sounds_default = {
	draw: () => globals.sfx ? zzfx(...[
		.25,
		,
		323,
		.03,
		.02,
		.08,
		1,
		.59,
		14,
		,
		,
		,
		,
		1.5,
		,
		,
		,
		.64,
		.09
	]) : () => {},
	ability: () => globals.sfx ? zzfx(...[
		.5,
		,
		316,
		.01,
		.05,
		.06,
		1,
		.22,
		-5.6,
		-2.4,
		,
		,
		,
		1.8,
		,
		.1,
		,
		.79,
		.09
	]) : () => {},
	assault: () => globals.sfx ? zzfx(...[
		1,
		,
		255,
		.02,
		.04,
		.09,
		4,
		1.31,
		-.2,
		,
		,
		,
		,
		1.3,
		,
		.3,
		.19,
		.52,
		.04,
		.22
	]) : () => {},
	defense: () => globals.sfx ? zzfx(...[
		.75,
		0,
		2838,
		.01,
		,
		.2,
		2,
		1.98,
		,
		,
		35,
		.02,
		,
		.1,
		,
		.1,
		.08,
		.75,
		.1,
		.12
	]) : () => {},
	buttonInteract: () => globals.sfx ? zzfx(...[
		.5,
		,
		1500,
		.01,
		,
		.23,
		4,
		5,
		,
		,
		,
		,
		,
		1,
		-30,
		,
		,
		.5,
		,
		1
	]) : () => {},
	cardSelect: () => globals.sfx ? zzfx(...[
		.5,
		,
		1836,
		.14,
		.01,
		.07,
		4,
		2.9,
		28,
		74,
		,
		,
		.19,
		,
		,
		,
		,
		.33,
		,
		.91
	]) : () => {}
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/entity.ts
/**
* Potential bug to fix - when an element is changed multiple times quickly, 
* sometimes a previous timeout removes a `changed` class prematureley, which
* looks a little glitchy.
* 
* @param el 
*/
function flashChanged(el) {
	el.classList.remove("changed");
	el.classList.add("changed");
	setTimeout(() => {
		el.classList.remove("changed");
	}, 1500);
}
var Entity = class extends GameElement {
	constructor(data, game) {
		super(game);
		const { name, type, hp } = data;
		this.id = uuid();
		this.data = { ...data };
		this.currentHp = data.hp;
		this.sprite = spriteElementBuilder(name, hp, type, data.mounted, this.id);
		this.sprite.addEventListener("click", () => {
			game.entitySelect(this.id);
		});
		this.isPlayer = this.data.type === SPRITE_TYPE.player;
	}
	render() {
		gei(this.data.type)?.appendChild(this.sprite);
		this.update();
	}
	update(changed) {
		const fillEl = qs(this.sprite, `.hp .fill`);
		fillEl.style.width = Math.round(this.currentHp / this.data.hp * 100) + "%";
		this.data.d > 0 ? fillEl.classList.add("armored") : fillEl.classList.remove("armored");
		qs(this.sprite, ".hp .number").innerHTML = `${this.currentHp}/${this.data.hp}`;
		const dEl = qs(this.sprite, ".affects .armor");
		dEl.innerHTML = "D:" + this.data.d;
		if (changed?.d) flashChanged(dEl);
		const eEl = qs(this.sprite, ".affects .enrage");
		eEl.innerHTML = "E:" + this.data.e;
		if (changed?.e) flashChanged(eEl);
		const wEl = qs(this.sprite, ".affects .weak");
		wEl.innerHTML = "W:" + this.data.w;
		if (changed?.w) flashChanged(wEl);
	}
	applyFromEnemy(cardData) {
		let changed = {};
		const { a = 0, aa = 0, wa = 0, w = 0 } = cardData;
		let d = this.data.d;
		if (a > 0 && this.data.d > 0) {
			changed.d = this.data.d;
			d = d - a;
			if (d < 0) {
				this.currentHp = Math.min(this.data.hp, Math.max(0, this.currentHp - (a - this.data.d)));
				this.data.d = 0;
			} else this.data.d = d;
		} else this.currentHp = Math.min(this.data.hp, Math.max(0, this.currentHp - a));
		this.data.w += w;
		if (w > 0) changed.w = w;
		this.update(changed);
		if (this.currentHp <= 0) this.game?.onDeath(this);
		const parsedData = {};
		if (aa > 0) parsedData.a = aa;
		if (wa > 0) parsedData.w = wa;
		if (Object.keys(parsedData).length) this.game?.applyToAllEnemies(parsedData);
	}
	applyFromFriendly(cardData) {
		let changed = {};
		const { d = 0, e = 0, hp = 0 } = cardData;
		this.currentHp = Math.min(this.data.hp, Math.max(0, this.currentHp + hp));
		this.data.d += d;
		this.data.e += e;
		if (d > 0) changed.d = d;
		if (e > 0) changed.e = e;
		this.update(changed);
		if (this.currentHp <= 0) this.game?.onDeath(this);
	}
	startTurn() {
		this.data.d = 0;
		this.update();
	}
	endTurn() {
		this.data.e = Math.max(0, this.data.e - 1);
		this.data.w = Math.max(0, this.data.w - 1);
		this.update();
	}
	do(type) {
		let animationName = "";
		switch (type) {
			case CARD_TYPE.ability:
				sounds_default.ability();
				animationName = "bumpUp";
				break;
			case CARD_TYPE.assault:
				sounds_default.assault();
				animationName = this.isPlayer ? "bumpLeft" : "bumpRight";
				break;
			case CARD_TYPE.defense:
				sounds_default.defense();
				animationName = this.isPlayer ? "bumpRight" : "bumpLeft";
		}
		this.sprite.style.animationName = animationName;
		setTimeout(() => {
			const e = qs(this.sprite, ".intent");
			e.className = "intent";
			qs(e, ".assault-value").innerHTML = "";
		}, 500);
		setTimeout(() => {
			this.sprite.style.animation = "";
		}, 1e3);
	}
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/player.ts
var Player = class extends Entity {
	constructor(data, game) {
		super(data, game);
		this.data = { ...data };
		this.currentStamina = data.stamina;
	}
	resetStamina() {
		this.currentStamina = this.data.stamina;
	}
	resetProperties() {
		this.data.d = 0;
		this.data.w = 0;
		this.data.e = 0;
	}
	startRound() {
		this.resetProperties();
		this.resetStamina();
	}
	startTurn() {
		super.startTurn();
		this.resetStamina();
		this.update();
	}
	applyFromEnemy(cardData) {
		super.applyFromEnemy(cardData);
	}
	applyFromFriendly(cardData) {
		super.applyFromFriendly(cardData);
		const { s = 0, draw = 0, mhp = 0, ca = 0 } = cardData;
		this.currentStamina += s;
		this.currentHp += mhp;
		this.data.hp += mhp;
		if (ca > 0) {
			this.data.e = 0;
			this.data.w = 0;
		}
		if (draw > 0) this.game?.deck.startDraw(draw);
		this.update();
		if (this.currentHp <= 0) this.game?.onDeath(this);
	}
	applyInnate(cards, type) {
		let applyCards = [];
		switch (type) {
			case ACTIVATION_TRIGGER.buff:
				applyCards = cards.filter((card) => card.data.on === ACTIVATION_TRIGGER.buff);
				this.game?.onPlayerBuffsApplied(applyCards);
				break;
			case ACTIVATION_TRIGGER.round:
				applyCards = cards.filter((card) => card.data.on === ACTIVATION_TRIGGER.round);
				break;
			case ACTIVATION_TRIGGER.turn: applyCards = cards.filter((card) => card.data.on === ACTIVATION_TRIGGER.turn);
		}
		applyCards.forEach((card) => {
			this.applyFromFriendly(card.data);
			if (card.data.w) this.game?.applyToAllEnemies(card.data);
		});
	}
	play(card) {
		this.currentStamina -= card.data.c || 0;
		this.update();
	}
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/card.ts
var Card = class extends GameElement {
	constructor(constructorData) {
		super();
		const [name, type, data] = constructorData;
		this.id = uuid();
		this.name = name;
		this.type = type;
		this.data = { ...data };
		this.attributes = [];
	}
	dData(modData) {
		return {
			...this.data,
			a: getAttackForData(this.data.a || 0, modData),
			aa: getAttackForData(this.data.aa || 0, modData),
			d: getDefenceForData(this.data.d || 0, modData)
		};
	}
};
var VisualCard = class extends Card {
	constructor(constructorData, isCardAdd = false) {
		super(constructorData);
		this.buildVisualAttributes(this.data);
		this.sprite = cardElementBuilder(this);
		this.listener = isCardAdd ? this.deckAddSelect.bind(this) : this.cardSelect.bind(this);
		if (isCardAdd) this.sprite.addEventListener("click", this.listener);
		else this.sprite.addEventListener("click", this.listener);
	}
	deckAddSelect(event) {
		event.stopPropagation();
		if (this.game?.state === GAME_STATE.PICKING_CARD) this.game.deck.selectToAdd(this);
	}
	cardSelect(event) {
		event.stopPropagation();
		this.game?.onPlayerSelectCard(this);
	}
	buildVisualAttributes(data, modData) {
		this.attributes = [];
		if (data.a) this.attributes.push(`ATTACK ENEMY: ${getAttackForData(data.a, modData)}`);
		if (data.ca) this.attributes.push(`Remove ENRAGE and WEAKEN from SELF`);
		if (data.aa) this.attributes.push(`ATTACK ALL: ${getAttackForData(data.aa, modData)}`);
		if (data.wa) this.attributes.push(`WEAKEN ALL: ${getAttackForData(data.wa, modData)}`);
		if (data.d) this.type === CARD_TYPE.innate ? this.attributes.push(`Start with +${data.d} defend/TURN`) : this.attributes.push(`DEFEND SELF: ${getDefenceForData(data.d, modData)}`);
		if (data.e) this.attributes.push(`ENRAGE SELF: ${data.e}`);
		if (data.w) this.type === CARD_TYPE.innate ? this.attributes.push(`Enemies start +${data.w} weak/ROUND`) : this.attributes.push(`WEAKEN ENEMY: ${data.w}`);
		if (data.s) this.type === CARD_TYPE.innate ? this.attributes.push(`Gain +${data.s} stamina per TURN`) : this.attributes.push(`STAMINA: +${data.s}`);
		if (data.draw) this.type === CARD_TYPE.innate ? this.attributes.push(`Draw ${data.draw} extra card${data.draw > 1 ? "s" : ""} per TURN`) : this.attributes.push(`DRAW CARDS: ${data.draw}`);
		if (data.mhp) this.attributes.push(`Gain +${data.mhp} max life this ONCE`);
		if (data.hp && data.hp < 0) this.attributes.push(`Lose ${Math.abs(data.hp)} life`);
		if (data.hp && data.hp > 0) this.type === CARD_TYPE.innate ? this.attributes.push(`Heal ${data.hp} life at the start of each ROUND`) : this.attributes.push(`Heal ${data.hp} life`);
	}
	update(modData) {
		this.buildVisualAttributes(this.data, modData);
		const newSprite = cardElementBuilder(this);
		this.sprite.replaceChildren(...newSprite.childNodes);
	}
};
var basicCards = [
	[
		"Saber Attack",
		CARD_TYPE.assault,
		{
			a: 8,
			c: 1,
			flavor: "The Khans favored weapon, designed for use from horseback. These swords with slightly curved blades were 30-40 inches long."
		}
	],
	[
		"Bambai Shield",
		CARD_TYPE.defense,
		{
			d: 10,
			c: 1,
			flavor: "The Khans favored shield, round and domed, originally made of woven reeds covered in leather and later from stronger metal."
		}
	],
	[
		"War Cry",
		CARD_TYPE.ability,
		{
			c: 1,
			wa: 1,
			e: 2,
			flavor: "Enemies could scarcely move to defend themselves on hearing the screams of the Khans' army."
		}
	],
	[
		"Rally Cry",
		CARD_TYPE.defense,
		{
			c: 2,
			d: 18,
			e: 1,
			flavor: "Such were The Khans regrouping tactics that enemies could find nowhere to strike."
		}
	],
	[
		"Tactical Retreat",
		CARD_TYPE.defense,
		{
			c: 2,
			d: 14,
			draw: 1,
			flavor: "Better to retreat, and entice the enemy into a trap or your making."
		}
	],
	[
		"Surgical Strike",
		CARD_TYPE.assault,
		{
			c: 1,
			a: 12,
			draw: 1,
			flavor: "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt."
		}
	]
];
var cards = [
	[
		"Recharge",
		CARD_TYPE.ability,
		{
			c: 0,
			s: 2,
			flavor: "The Khan's army could rest on the move, allowing them to be where noone thought they could be."
		}
	],
	[
		"Push Through",
		CARD_TYPE.ability,
		{
			c: 1,
			draw: 3,
			flavor: "Any obstacle may be overcome with enough force."
		}
	],
	[
		"Clairvoyance",
		CARD_TYPE.ability,
		{
			c: 0,
			draw: 2,
			flavor: "The Khan had a preternatural ability with strategy, to know what to do next."
		}
	],
	[
		"Shield Wall",
		CARD_TYPE.defense,
		{
			c: 3,
			d: 30,
			e: 2,
			flavor: ""
		}
	],
	[
		"Reluctant Withdrawl",
		CARD_TYPE.defense,
		{
			c: 1,
			d: 12,
			e: 3,
			flavor: "The Khan grew more determined, and more angry, with every forced step backwards."
		}
	],
	[
		"Whirling Dervish",
		CARD_TYPE.assault,
		{
			c: 2,
			aa: 10,
			wa: 2,
			flavor: "The Persians were a magnificent addition to the Khan's army."
		}
	],
	[
		"Wrath Of Khan",
		CARD_TYPE.assault,
		{
			c: 3,
			aa: 15,
			e: 4,
			hp: -10,
			flavor: "The Khan was merciless, sometimes reckless, in pursuit of his enemies."
		}
	],
	[
		"Reckless Assault",
		CARD_TYPE.assault,
		{
			c: 2,
			a: 25,
			hp: -5,
			flavor: "Let your plans be dark and impenetrable as night, and when you move, fall like a thunderbolt."
		}
	],
	[
		"Overpower",
		CARD_TYPE.assault,
		{
			c: 2,
			a: 18,
			w: 2,
			flavor: "Attack where the enemy is unprepared, appear where you are not expected."
		}
	],
	[
		"Cavalry Charge",
		CARD_TYPE.assault,
		{
			c: 4,
			aa: 18,
			flavor: "The Khan's cavalry were second to none thanks, in no small part, to the invention of the stirrup."
		}
	],
	[
		"Shock and Awe",
		CARD_TYPE.ability,
		{
			c: 2,
			e: 3,
			wa: 3,
			flavor: "Supreme excellence consists of breaking the enemy's resistance without fighting."
		}
	],
	[
		"Combat Medics",
		CARD_TYPE.defense,
		{
			c: 1,
			d: 8,
			hp: 6,
			flavor: "A little ginsing, some water, a BIG shield and you'll be back up in no time."
		}
	],
	[
		"Field Hospital",
		CARD_TYPE.ability,
		{
			c: 2,
			hp: 12,
			flavor: "He will win who knows when to fight and when not to fight."
		}
	],
	[
		"Meditation",
		CARD_TYPE.ability,
		{
			c: 1,
			ca: 1,
			flavor: "It is the unemotional, reserved, calm, detached warrior who wins, not the hothead seeking vengeance."
		}
	]
];
var innateCards = [
	[
		"Strategic Planning",
		CARD_TYPE.innate,
		{
			on: ACTIVATION_TRIGGER.turn,
			c: 0,
			draw: 1,
			flavor: "Water flows according to the ground as the soldier plots victory in relation to his foe."
		}
	],
	[
		"Calisthenics",
		CARD_TYPE.innate,
		{
			on: ACTIVATION_TRIGGER.turn,
			c: 0,
			s: 1,
			flavor: "To not prepare is the greatest of crimes; to be prepared for any contingency is the greatest of virtues."
		}
	],
	[
		"Tenger Spirit",
		CARD_TYPE.innate,
		{
			on: ACTIVATION_TRIGGER.round,
			c: 0,
			hp: 10,
			flavor: "The Khan was considered the embodiment of this highest deity."
		}
	],
	[
		"Fearsome Reputation",
		CARD_TYPE.innate,
		{
			on: ACTIVATION_TRIGGER.round,
			c: 0,
			w: 5,
			flavor: "Supreme excellence consists of breaking the enemy's resistance without fighting."
		}
	],
	[
		"Scientific Advancement",
		CARD_TYPE.innate,
		{
			on: ACTIVATION_TRIGGER.buff,
			c: 0,
			mhp: 10,
			flavor: "To fight harder, be stronger, and live longer one must do more than just cross swords."
		}
	],
	[
		"Defensive Perimeter",
		CARD_TYPE.innate,
		{
			on: ACTIVATION_TRIGGER.turn,
			c: 0,
			d: 5,
			flavor: "Supreme excellence consists of breaking the enemy's resistance without fighting."
		}
	]
];
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/deck.ts
var MAX_IN_HAND = 8;
var alreadyShownCardsQueue = [];
var alreadyShownInnateCardsQueue = [];
function pickNewNumberIfInSeenCollection(collection, seenCollection, pickCollection, collectionMaxLen) {
	let newIds = [];
	collection.forEach((num, i) => {
		let newId = num;
		while (seenCollection.includes(newId) || newIds.includes(newId)) newId = getRandomIntInclusive(0, pickCollection.length - 1);
		newIds.push(newId);
		collection[i] = newId;
	});
	newIds.forEach((id) => {
		seenCollection.push(id);
	});
	while (seenCollection.length > collectionMaxLen) seenCollection.shift();
}
function getNewCardsToPick() {
	const c1 = getRandomIntInclusive(0, cards.length - 1);
	let c2 = c1;
	let c3 = c1;
	while (c2 === c1 || c2 === c3) c2 = getRandomIntInclusive(0, cards.length - 1);
	while (c3 === c1 || c3 === c2) c3 = getRandomIntInclusive(0, cards.length - 1);
	const ci1 = getRandomIntInclusive(0, innateCards.length - 1);
	let ci2 = getRandomIntInclusive(0, innateCards.length - 1);
	while (ci1 === ci2) ci2 = getRandomIntInclusive(0, innateCards.length - 1);
	const cardIds = [
		c1,
		c2,
		c3
	];
	const innateCardIds = [ci1, ci2];
	pickNewNumberIfInSeenCollection(cardIds, alreadyShownCardsQueue, cards, 6);
	pickNewNumberIfInSeenCollection(innateCardIds, alreadyShownInnateCardsQueue, innateCards, 4);
	return [
		new VisualCard(cards[cardIds[0]], true),
		new VisualCard(cards[cardIds[1]], true),
		new VisualCard(cards[cardIds[2]], true),
		new VisualCard(innateCards[innateCardIds[0]], true),
		new VisualCard(innateCards[innateCardIds[1]], true)
	];
}
var Deck = class extends GameElement {
	constructor(game) {
		super(game);
		this.game = game;
		this.drawPile = [
			new VisualCard(basicCards[0]),
			new VisualCard(basicCards[0]),
			new VisualCard(basicCards[0]),
			new VisualCard(basicCards[1]),
			new VisualCard(basicCards[1]),
			new VisualCard(basicCards[2]),
			new VisualCard(basicCards[3]),
			new VisualCard(basicCards[4]),
			new VisualCard(basicCards[5])
		];
		this.deck = [...this.drawPile];
		this.handPile = [];
		this.donePile = [];
		this.innatePile = [];
		this.pendingDraw = 0;
		this.update();
		this.register(this.game);
	}
	register(game) {
		[
			this.drawPile,
			this.handPile,
			this.donePile
		].forEach((pile) => pile?.forEach((card) => card.register(game)));
	}
	selectToAdd(card) {
		this.handPile.forEach((card) => {
			card.sprite.classList.remove("selected");
		});
		sounds_default.cardSelect();
		if (this.pendingSelect === card) {
			gei("confirmcard").disabled = true;
			this.pendingSelect = void 0;
		} else {
			gei("confirmcard").disabled = false;
			this.pendingSelect = card;
			this.pendingSelect.sprite.classList.add("selected");
		}
	}
	confirmAdd() {
		const el = gei("confirmcard");
		el.removeEventListener("click", this.confirmAdd);
		el.disabled = true;
		el.classList.add("hide");
		if (this.pendingSelect && this.game?.state === GAME_STATE.PICKING_CARD) {
			this.game?.setState(GAME_STATE.TRANSITION);
			this.pendingSelect.sprite.classList.remove("selected");
			this.pendingSelect.sprite.removeEventListener("click", this.pendingSelect.listener);
			this.pendingSelect.listener = this.pendingSelect.cardSelect.bind(this.pendingSelect);
			this.pendingSelect.sprite.addEventListener("click", this.pendingSelect.listener);
			this.pendingSelect.type === CARD_TYPE.innate ? this.add(this.pendingSelect, DeckCollections.INNATE) : this.add(this.pendingSelect);
			this.pendingSelect = void 0;
		}
	}
	add(card, collection) {
		switch (collection) {
			case DeckCollections.DONE:
				this.donePile.push(card);
				break;
			case DeckCollections.HAND:
				this.handPile.push(card);
				break;
			case DeckCollections.INNATE:
				this.innatePile.push(card);
				break;
			default:
			case DeckCollections.DRAW: this.drawPile.push(card);
		}
		this.deck.push(card);
		this.update();
		this.game.newCardPicked();
		return this;
	}
	shuffle() {
		const t = [];
		while (this.drawPile.length) t.push(this.drawPile.splice(Math.floor(Math.random() * this.drawPile.length), 1)[0]);
		this.drawPile = t;
		return this;
	}
	shuffleInto(basePile, otherPile) {
		while (otherPile.length) {
			const c = otherPile.splice(Math.floor(Math.random() * otherPile.length), 1)[0];
			const i = getRandomIntInclusive(0, basePile.length);
			basePile.splice(i, 0, c);
		}
	}
	update() {
		gei("deck").innerHTML = `Draw: ${this.drawPile.length}`;
		gei("done").innerHTML = `Discard: ${this.donePile.length}`;
	}
	draw(n) {
		this.pendingDraw = n;
		if (n > 0 && this.handPile.length < MAX_IN_HAND) {
			sounds_default.draw();
			if (this.drawPile.length) {
				const c = this.drawPile.pop();
				c.update(this.game.player.data);
				this.handPile.push(c);
				gei("card-holder")?.appendChild(c.sprite);
				this.update();
				setTimeout(() => this.draw(--n), 100);
			} else if (this.donePile.length) {
				this.shuffleInto(this.drawPile, this.donePile);
				this.draw(n);
			}
		} else if (this.pendingDraw > 0) this.game.alert("Your hand is full!");
		return this;
	}
	startDraw(n) {
		setTimeout(() => this.draw(n), 100);
	}
	pickNewCards() {
		const cards = getNewCardsToPick();
		const el = gei("confirmcard");
		el.addEventListener("click", this.confirmAdd.bind(this));
		el.classList.remove("hide");
		cards.forEach((card) => {
			card.register(this.game);
			this.handPile.push(card);
			gei("card-holder")?.appendChild(card.sprite);
		});
	}
	updateVisibleCards(modData) {
		this.handPile.forEach((card) => {
			card.update(modData);
		});
	}
	removeFromHand(card, addToDone = true) {
		card.sprite.parentNode?.removeChild(card.sprite);
		if (addToDone) this.donePile.push(card);
		this.handPile.splice(this.handPile.indexOf(card), 1);
		this.update();
	}
	removeInnateBuffs(cards) {
		for (let i = 0; i < this.innatePile.length; i++) {
			const c = this.innatePile[i];
			if (cards.indexOf(c) !== -1) {
				this.innatePile.splice(i, 1);
				i--;
			}
		}
	}
	clearHand() {
		const card = this.handPile[this.handPile.length - 1];
		if (card) {
			this.removeFromHand(card, false);
			setTimeout(() => this.clearHand(), 100);
		}
	}
	endTurn() {
		const card = this.handPile[this.handPile.length - 1];
		if (card) {
			this.removeFromHand(card);
			setTimeout(() => this.endTurn(), 100);
		}
	}
	endRound() {
		this.endTurn();
		setTimeout(() => {
			this.shuffleInto(this.drawPile, this.donePile);
		}, 1e3);
	}
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/dom.ts
function flashCardCost(card) {
	const el = card.sprite.querySelector(".cost");
	el.classList.add("flash");
	setTimeout(() => el.classList.remove("flash"), 250);
}
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/enemy.ts
var Enemy = class extends Entity {
	constructor(data, game) {
		super(data, game);
	}
	intent(action) {
		const iEl = this.sprite.querySelector(".intent");
		const aEl = iEl.querySelector(".assault-value");
		iEl.classList.add(action.type);
		if (action.type === CARD_TYPE.assault) aEl.innerHTML = getAttackForData(action.data.a, this.data).toString();
	}
	pickAction() {
		this.nextAction = new Card(this.data.actions.get());
		this.intent(this.nextAction);
	}
	applyFromEnemy(cardData) {
		super.applyFromEnemy(cardData);
		if (this.nextAction) this.intent(this.nextAction);
	}
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/messaging.ts
var messages = {intro:'可汗，踏上远征吧！<br><br>用手中的卡牌击败敌人，合理运用防御、狂怒和虚弱。每场胜利都能强化牌组。击败最后的西方之王，完成十关冒险！',final:'你击败了西方之王，远征胜利！你的谋略与勇气，为所有战士赢得了荣耀。',thanks:'感谢游玩，希望你喜欢这段小小的卡牌冒险！',fail:'这一次远征失败了，但新的旅程仍在等待。试着调整出牌顺序，留意敌人意图，再次挑战吧！'};
function showMessage(message, callback, multiMessage = false) {
	gei("tutorial").disabled = true;
	gei("context").classList.remove("hide");
	gei("message").classList.remove("hide");
	gei("context").classList.add("show");
	gei("content").innerHTML = message;
	const b = document.createElement("button");
	b.classList.add("pixel-border");
	b.innerHTML = "Continue ...";
	b.id = "context-close";
	const eventHandler = () => {
		gei("context-close").removeEventListener("click", eventHandler);
		if (!multiMessage) {
			gei("tutorial").disabled = false;
			gei("context").classList.remove("show");
			gei("context").classList.add("hide");
			gei("message").classList.add("hide");
		}
		callback();
	};
	gei("context-close").replaceWith(b);
	gei("context-close").addEventListener("click", eventHandler);
}
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/data.ts
var EnemyActions = class {
	constructor(actions) {
		this.actions = [...actions];
	}
	get() {
		return this.actions[getRandomIntInclusive(0, this.actions.length - 1)];
	}
};
var data = {
	startLevel: 1,
	startTurn: 0,
	defaultDraw: 5,
	playerData: {
		name: "khan",
		type: SPRITE_TYPE.player,
		hp: 50,
		d: 0,
		w: 0,
		f: 0,
		e: 0,
		mounted: true,
		stamina: 4
	},
	enemyData: {
		1: {
			name: "king",
			type: SPRITE_TYPE.enemy,
			hp: 80,
			d: 0,
			w: 0,
			e: 0,
			mounted: true,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{ a: 25 }
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 20,
						d: 10
					}
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 15,
						d: 15
					}
				],
				[
					"",
					CARD_TYPE.defense,
					{
						d: 25,
						w: 2
					}
				],
				[
					"",
					CARD_TYPE.defense,
					{
						d: 20,
						e: 2,
						w: 2
					}
				]
			])
		},
		2: {
			name: "archer",
			type: SPRITE_TYPE.enemy,
			hp: 30,
			d: 0,
			w: 0,
			e: 0,
			mounted: false,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{ a: 15 }
				],
				[
					"",
					CARD_TYPE.assault,
					{ a: 12 }
				],
				[
					"",
					CARD_TYPE.assault,
					{ a: 10 }
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 8,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 8,
						w: 2
					}
				]
			])
		},
		3: {
			name: "knight",
			type: SPRITE_TYPE.enemy,
			hp: 40,
			d: 0,
			w: 0,
			e: 0,
			mounted: false,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{ a: 15 }
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 12,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 10,
						d: 10
					}
				]
			])
		},
		4: {
			name: "dervish",
			type: SPRITE_TYPE.enemy,
			hp: 28,
			d: 0,
			w: 0,
			e: 0,
			mounted: false,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{ a: 15 }
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 10,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 10,
						w: 1
					}
				]
			])
		},
		5: {
			name: "bear2",
			type: SPRITE_TYPE.enemy,
			hp: 22,
			d: 0,
			w: 0,
			e: 1,
			mounted: false,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{ a: 10 }
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 7,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.defense,
					{ d: 10 }
				],
				[
					"",
					CARD_TYPE.defense,
					{
						d: 8,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.ability,
					{ e: 3 }
				]
			])
		},
		6: {
			name: "bear1",
			type: SPRITE_TYPE.enemy,
			hp: 22,
			d: 0,
			w: 0,
			e: 2,
			mounted: false,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{ a: 10 }
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 7,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.defense,
					{ d: 10 }
				],
				[
					"",
					CARD_TYPE.defense,
					{
						d: 8,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.ability,
					{ e: 3 }
				]
			])
		},
		7: {
			name: "rok",
			type: SPRITE_TYPE.enemy,
			hp: 18,
			d: 0,
			w: 0,
			e: 0,
			mounted: false,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{
						a: 8,
						d: 5
					}
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 4,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 5,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.defense,
					{ d: 10 }
				]
			])
		},
		8: {
			name: "wolf",
			type: SPRITE_TYPE.enemy,
			hp: 16,
			d: 0,
			w: 0,
			e: 3,
			mounted: false,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{ a: 10 }
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 6,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.ability,
					{
						e: 2,
						w: 3
					}
				]
			])
		},
		9: {
			name: "snake",
			type: SPRITE_TYPE.enemy,
			hp: 12,
			d: 0,
			w: 0,
			e: 0,
			mounted: false,
			actions: new EnemyActions([
				[
					"",
					CARD_TYPE.assault,
					{
						a: 9,
						w: 1
					}
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 5,
						w: 1,
						e: 2
					}
				],
				[
					"",
					CARD_TYPE.assault,
					{
						a: 7,
						w: 1
					}
				],
				[
					"",
					CARD_TYPE.defense,
					{
						d: 10,
						e: 3
					}
				]
			])
		}
	}
};
function getEnemyDataWithMult(mult) {
	let multiplyer = 1;
	switch (mult) {
		case 3:
		case 2:
			multiplyer = 1.5;
			break;
		case 4:
			multiplyer = 2;
			break;
		case 5:
			multiplyer = 2.5;
			break;
		default: multiplyer = 1;
	}
	const enemyData = { ...data.enemyData };
	Object.keys(enemyData).forEach((key) => {
		let k = Number(key);
		const e = { ...enemyData[k] };
		if (mult > 2) e.hp = Math.ceil(e.hp * multiplyer);
		let temp = [...e.actions.actions];
		const newActions = [];
		temp.forEach((action) => {
			const newAction = [
				action[0],
				action[1],
				{ ...action[2] }
			];
			const newData = { ...newAction[2] };
			if (newData.a) newData.a *= multiplyer;
			if (newData.d) newData.d *= multiplyer;
			newAction[2] = newData;
			newActions.push(newAction);
		});
		e.actions = new EnemyActions(newActions);
		enemyData[k] = e;
	});
	return enemyData;
}
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/game.ts
var globalGameData = {
	selectedCard: void 0,
	targetedEntities: []
};
function clearSelectedCard(card) {
	globalGameData.selectedCard = void 0;
	card?.sprite.classList.remove("selected");
}
function clearTargeted(targets) {
	targets.forEach((el) => {
		el.classList.remove("targeted");
	});
}
function getValidTargets(entities, card) {
	if (card.data.a || card.data.aa || card.data.w || card.data.wa) return entities.filter((entity) => entity.data.type === SPRITE_TYPE.enemy);
	return [entities.find((entity) => entity.data.type === SPRITE_TYPE.player)];
}
/**
* Grabs `enemies` arry from passed instance to add enemies for level and
* register IGame instance with enemy instance.
* 
* @param c 
* @param level 
*/
function getEnemiesForLevel(c) {
	levels[c.level].enemies().forEach(((enemy) => {
		const e = new Enemy(c.modifiedEnemyData[enemy], c);
		c.enemies.push(e);
	}));
}
var Game = class {
	constructor(e, gameData) {
		this.deck = gameData?.deck || new Deck(this);
		if (gameData?.deck) this.deck.register(this);
		this.e = e;
		this.level = data.startLevel;
		this.turn = data.startTurn;
		this.enemies = [];
		this.player = new Player(data.playerData, this);
		this.state = GAME_STATE.PLAYER_TURN;
		this.diffMult = 1;
		this.modifiedEnemyData = data.enemyData;
	}
	setState(newState) {
		this.state = newState;
	}
	alert(str) {
		const id = uuid();
		const el = gei("alert");
		el.setAttribute("data-id", id);
		el.innerHTML = str;
		setTimeout(() => {
			if (gei("alert").getAttribute("data-id") === id) gei("alert").innerHTML = "";
		}, 4e3);
	}
	renderDeck() {
		const el = gei("deckdisplay");
		const btn = gei("viewdeck");
		if (el.classList.contains("hide")) {
			el.classList.remove("hide");
			this.deck.deck.forEach((card) => {
				el.appendChild(card.sprite.cloneNode(true));
			});
			btn.style.zIndex = "20001";
			btn.innerHTML = "Done";
		} else {
			el.classList.add("hide");
			el.innerHTML = "";
			btn.style.zIndex = "inherit";
			btn.innerHTML = "View Deck";
		}
	}
	newGame() {
		this.diffMult = Number(gei("difficulty").value);
		this.modifiedEnemyData = getEnemyDataWithMult(this.diffMult);
		this.e.title.classList.add("hide");
		this.e.game.classList.remove("hide");
		getEnemiesForLevel(this);
		this.deck.shuffle();
		this.render();
		this.newTurn();
	}
	endRound() {
		this.deck.endRound();
		gei("endturn").disabled = true;
		setTimeout(() => {
			this.setState(GAME_STATE.PICKING_CARD);
			this.deck.pickNewCards();
			gei("stamina").innerHTML = "Pick a card to add to your deck OR an innate ability!";
		}, 1e3);
	}
	endGame(isWin = true) {
		setTimeout(() => {
			showMessage(isWin ? messages.final : messages.fail, () => {
				showMessage(messages.thanks, () => {
					window.location.reload();
				});
			}, true);
		}, 1e3);
	}
	newCardPicked() {
		sounds_default.buttonInteract();
		this.deck.clearHand();
		this.player.applyInnate(this.deck.innatePile, ACTIVATION_TRIGGER.buff);
		setTimeout(() => {
			this.newRound();
		}, 500);
	}
	newRound() {
		this.level += 1;
		this.turn = 0;
		getEnemiesForLevel(this);
		this.player.applyInnate(this.deck.innatePile, ACTIVATION_TRIGGER.round);
		setTimeout(() => {
			this.player.startRound();
			this.deck.shuffle();
			this.render();
			this.newTurn();
		}, 500);
	}
	newTurn() {
		this.turn += 1;
		this.setState(GAME_STATE.PLAYER_TURN);
		gei("endturn").disabled = false;
		this.player.startTurn();
		this.player.applyInnate(this.deck.innatePile, ACTIVATION_TRIGGER.turn);
		this.update();
		this.enemies.forEach((enemy) => {
			enemy.pickAction();
		});
		this.deck.startDraw(data.defaultDraw);
	}
	render() {
		this.enemies.forEach((entity) => {
			entity.render();
		});
		this.player.render();
		gei("stamina").innerHTML = `Stamina: ${this.player.currentStamina}`;
		gei("stage").innerHTML = `Stage ${this.level} / ${Object.keys(levels).length}`;
		gei("round").innerHTML = `Turn ${this.turn}`;
	}
	update() {
		gei("stamina").innerHTML = `Stamina: ${this.player.currentStamina}`;
		gei("round").innerHTML = `Turn ${this.turn}`;
	}
	onPlayerBuffsApplied(cards) {
		this.deck.removeInnateBuffs(cards);
	}
	/**
	* Called when a card is clicked in the hand during players turn. Card may have been
	* either Selected or De-selected. Targets are selected based on card data.
	* 
	* @param card 
	* @returns 
	*/
	onPlayerSelectCard(card) {
		/**
		* Clear selected & targets every time
		*/
		clearTargeted(globalGameData.targetedEntities);
		sounds_default.cardSelect();
		globalGameData.targetedEntities = [];
		if (this.player.currentStamina < card.data.c) {
			flashCardCost(card);
			this.alert("Not enough stamina!");
			return;
		}
		/**
		* Has a different card been selected?
		* 
		* If not, deselect current card.
		*/
		if (globalGameData.selectedCard?.id !== card.id) {
			clearSelectedCard(globalGameData.selectedCard);
			globalGameData.selectedCard = card;
			card.sprite.classList.add("selected");
		} else {
			clearSelectedCard(globalGameData.selectedCard);
			return;
		}
		getValidTargets([...this.enemies, this.player], card).forEach((entity) => {
			const el = entity.sprite.querySelector(".targeting");
			globalGameData.targetedEntities.push(el);
			el.classList.add("targeted");
		});
	}
	/**
	* Called when an entity is selected during combat.
	* 
	* *should not* be called if player stamina is insufficient for played card
	* 
	* @param id id of selected entity
	*/
	entitySelect(id) {
		if (globalGameData.selectedCard) {
			const target = getValidTargets([...this.enemies, this.player], globalGameData.selectedCard).find((item) => item?.id === id);
			if (!target || this.player.currentStamina < globalGameData.selectedCard?.data?.c) return;
			const cardToRemove = globalGameData.selectedCard;
			clearSelectedCard(globalGameData.selectedCard);
			clearTargeted(globalGameData.targetedEntities);
			this.player.play(cardToRemove);
			this.player.do(cardToRemove.type);
			const dynamicData = cardToRemove.dData(this.player.data);
			if (target && target !== this.player) target.applyFromEnemy(dynamicData);
			this.player.applyFromFriendly(dynamicData);
			this.deck.updateVisibleCards(this.player.data);
			this.update();
			this.deck.removeFromHand(cardToRemove);
			if (!this.enemies.length) {
				if (this.level === Object.keys(levels).length) {
					this.setState(GAME_STATE.GAME_OVER);
					this.endGame();
				} else this.endRound();
			}
		}
	}
	applyToAllEnemies(cardData) {
		/**
		* Must make copy of array, otherwise if an enemy dies other enemies will be skipped
		*/
		[...this.enemies].forEach((enemy) => {
			enemy.applyFromEnemy(cardData);
		});
	}
	endPlayerTurn() {
		if (this.state === GAME_STATE.PLAYER_TURN) {
			sounds_default.buttonInteract();
			this.setState(GAME_STATE.ENEMY_TURN);
			gei("endturn").disabled = true;
			this.player.endTurn();
			clearSelectedCard(globalGameData.selectedCard);
			clearTargeted(globalGameData.targetedEntities);
			this.enemies.forEach((enemy) => {
				enemy.startTurn();
			});
			this.deck.endTurn();
			setTimeout(() => this.runEnemyTurns(), 1e3);
		}
	}
	runEnemyTurns() {
		const enemiesToGo = [...this.enemies];
		const enemyTurn = () => {
			const enemy = enemiesToGo.pop();
			if (enemy) {
				const dynamicData = enemy.nextAction.dData(enemy.data);
				this.player.applyFromEnemy(dynamicData);
				enemy.applyFromFriendly(dynamicData);
				enemy.do(enemy.nextAction.type);
				setTimeout(() => enemyTurn(), 1e3);
			} else this.startNextTurn();
		};
		enemyTurn();
	}
	startNextTurn() {
		if (this.state !== GAME_STATE.GAME_OVER) {
			this.enemies.forEach((enemy) => {
				enemy.endTurn();
			});
			this.newTurn();
		}
	}
	onDeath(entity) {
		entity.sprite.style.animationName = "dead";
		setTimeout(() => {
			entity.sprite.parentNode?.removeChild(entity.sprite);
		}, 750);
		if (entity.isPlayer) {
			this.setState(GAME_STATE.GAME_OVER);
			this.endGame(false);
			return;
		}
		this.enemies.splice(this.enemies.indexOf(entity), 1);
	}
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/p1.ts
var createP1 = function() {
	var buffers = {}, contexts = [...Array(12).keys()].map((_) => new AudioContext()), tracks, trackLen, interval, unlocked, noteI, b = (note, add) => Math.sin(note * 6.28 + add), pianoify = (note) => b(note, b(note, 0) ** 2 + b(note, .25) * .75 + b(note, .5) * .1);
	var makeNote = (note, seconds, sampleRate) => {
		var key = note + "" + seconds;
		var buffer = buffers[key];
		if (note >= 0 && !buffer) {
			note = 65.406 * 1.06 ** note / sampleRate;
			var i = sampleRate * seconds | 0, sampleRest = sampleRate * (seconds - .002), bufferArray;
			buffer = buffers[key] = contexts[0].createBuffer(1, i, sampleRate);
			bufferArray = buffer.getChannelData(0);
			for (; i--;) bufferArray[i] = (i < 88 ? i / 88.2 : (1 - (i - 88.2) / sampleRest) ** (Math.log(1e4 * note) / 2) ** 2) * pianoify(i * note);
			if (!unlocked) contexts.map((context) => playBuffer(buffer, context, unlocked = 1));
		}
		return buffer;
	};
	var playBuffer = (buffer, context, stop) => {
		var gain = context.createGain();
		gain.gain.value = .1;
		gain.connect(context.destination);
		var source = context.createBufferSource();
		source.buffer = buffer;
		source.connect(gain);
		source.start();
		stop && source.stop();
	};
	return (params) => {
		var tempo = 125, noteLen = .5;
		tracks = params[trackLen = 0].replace(/[\!\|]/g, "").split("\n").map((track) => track > 0 ? (track = track.split("."), tempo = track[0], noteLen = track[1] / 100 || noteLen) : track.split("").map((letter, i) => {
			var duration = 1, note = letter.charCodeAt(0);
			note -= note > 90 ? 71 : 65;
			while (track[i + duration] == "-") duration++;
			if (trackLen < i) trackLen = i + 1;
			return makeNote(note, duration * noteLen * tempo / 125, 44100);
		}));
		noteI = 0;
		clearInterval(interval);
		interval = setInterval((j) => {
			tracks.map((track, trackI) => {
				if (track[j = noteI % track.length]) playBuffer(track[j], contexts[trackI * 3 + noteI % 3]);
			});
			noteI++;
			noteI %= trackLen;
		}, tempo);
	};
};
//#endregion
//#region game-sources/upstream/expansion/BenjaminWFox--KHAN-js13k-2023/src/index.ts
var globals = {
	music: false,
	sfx: true,
	tutorial: false
};
window.addEventListener("load", () => {
	const p1 = createP1();
	const e = {
		board: gei("board"),
		title: gei("title"),
		game: gei("game"),
		new: gei("new"),
		continue: gei("continue"),
		endturn: gei("endturn"),
		music: gei("music"),
		sfx: gei("sfx"),
		tutorial: gei("tutorial"),
		gotit: gei("gotit"),
		viewdeck: gei("viewdeck")
	};
	const game = new Game(e);
	document.ondblclick = function(e) {
		e.preventDefault();
	};
	function play() {
		if (globals.music) return;
		globals.music = true;
		e.music.classList.remove("stopped");
		p1`50.25
    |C---H---|--------|        |J---A---|--------|        |F---E---|--------|        |H---F---|--------|        |A---C---|--------|        |E---C---|--------|        |F---J---|--------|        |C---F---|--------|     |`;
	}
	function stop() {
		globals.music = false;
		e.music.classList.add("stopped");
		p1``;
	}
	function tutorial(show) {
		if (!show) {
			globals.tutorial = false;
			gei("board").classList.remove("tutorial");
			gei("context").classList.add("hide");
			gei("context").classList.remove("show");
			gei("gotit").classList.add("hide");
		} else {
			globals.tutorial = true;
			gei("board").classList.add("tutorial");
			gei("context").classList.remove("hide");
			gei("context").classList.add("show");
			gei("gotit").classList.remove("hide");
		}
	}
	e.tutorial.addEventListener("click", () => {
		tutorial(!globals.tutorial);
	});
	e.gotit.addEventListener("click", () => {
		tutorial(false);
	});
	e.new.addEventListener("click", () => {
		zzfx(0);
		play();
		showMessage(messages.intro, () => {
			e.tutorial.classList.remove("hide");
			game.newGame.call(game);
		});
	});
	e.endturn.addEventListener("click", () => game.endPlayerTurn());
	e.music.addEventListener("click", () => {
		globals.music ? stop() : play();
	});
	e.sfx.addEventListener("click", () => {
		if (globals.sfx) {
			globals.sfx = false;
			e.sfx.classList.add("stopped");
		} else {
			globals.sfx = true;
			e.sfx.classList.remove("stopped");
		}
	});
	e.viewdeck.addEventListener("click", game.renderDeck.bind(game));
	window.addEventListener("resize", () => {
		resize(e);
	});
	resize(e);
	if (navigator.userAgent.match("CriOS")) alert("Hello iOS Chrome User!\n\nYou may have to rotate your phone orientation back/forth once for correct display.\n\nEnjoy the game!");
});
//#endregion
