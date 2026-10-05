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
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/sprites.json
var norman_arms_up = [
	0,
	18,
	16,
	15
];
var skeleton = [
	11,
	33,
	13,
	15
];
var norman_arms_down = [
	16,
	18,
	16,
	15
];
var villager_1 = [
	32,
	18,
	14,
	15
];
var villager_3 = [
	58,
	18,
	13,
	15
];
var villager_4 = [
	71,
	18,
	14,
	15
];
var archer = [
	85,
	18,
	13,
	15
];
var monk = [
	98,
	18,
	10,
	15
];
var skull = [
	72,
	61,
	8,
	7
];
var health_pip = [
	18,
	52,
	2,
	2
];
var wall = [
	16,
	54,
	16,
	16
];
var floor = [
	0,
	54,
	16,
	8
];
var p_green_skull = [
	22,
	48,
	4,
	4
];
var champion = [
	67,
	33,
	22,
	20
];
var reticle = [
	48,
	50,
	7,
	7
];
var p_green_1 = [
	22,
	52,
	2,
	2
];
var p_green_2 = [
	24,
	52,
	1,
	1
];
var p_green_3 = [
	25,
	53,
	1,
	1
];
var p_green_4 = [
	24,
	53,
	1,
	1
];
var p_green_5 = [
	25,
	52,
	1,
	1
];
var p_bone_1 = [
	65,
	54,
	6,
	6
];
var p_bone_2 = [
	71,
	55,
	5,
	5
];
var p_bone_3 = [
	76,
	56,
	4,
	4
];
var shell_knight_up = [
	142,
	18,
	18,
	17
];
var p_star_1 = [
	11,
	51,
	3,
	3
];
var p_star_2 = [
	11,
	48,
	3,
	3
];
var p_star_3 = [
	11,
	49,
	1,
	1
];
var p_star_4 = [
	11,
	52,
	1,
	1
];
var wizard = [
	108,
	18,
	14,
	17
];
var the_king = [
	131,
	35,
	29,
	31
];
var the_king_on_foot = [
	109,
	35,
	22,
	22
];
var royal_guard = [
	36,
	33,
	16,
	17
];
var shell_knight_down = [
	122,
	18,
	20,
	11
];
var health_orb = [
	111,
	57,
	5,
	5
];
var piper = [
	24,
	33,
	12,
	14
];
var ceiling = [
	0,
	62,
	16,
	8
];
var health_orb_empty = [
	111,
	62,
	5,
	5
];
var cast_orb = [
	116,
	57,
	5,
	5
];
var cast_orb_empty = [
	116,
	62,
	5,
	5
];
var norman_icon = [
	55,
	53,
	10,
	11
];
var yellow_orb = [
	121,
	57,
	5,
	5
];
var p_red_skull = [
	18,
	48,
	4,
	4
];
var p_red_1 = [
	20,
	52,
	1,
	1
];
var p_red_2 = [
	21,
	52,
	1,
	1
];
var p_red_3 = [
	18,
	52,
	1,
	2
];
var p_red_4 = [
	21,
	53,
	1,
	1
];
var p_skull = [
	14,
	48,
	4,
	4
];
var p_purple_5 = [
	17,
	53,
	1,
	1
];
var rat = [
	122,
	29,
	20,
	6
];
var status_enraged = [
	53,
	64,
	7,
	6
];
var status_shielded = [
	60,
	64,
	5,
	6
];
var status_bleeding = [
	49,
	64,
	4,
	6
];
var royal_guard_shielded = [
	52,
	33,
	15,
	17
];
var pink_frame = [
	65,
	60,
	7,
	8
];
var rage_knight = [
	89,
	33,
	14,
	15
];
var rage_knight_enraged = [
	89,
	48,
	15,
	20
];
var portal = [
	80,
	53,
	9,
	15
];
var p_blue_1 = [
	83,
	54,
	2,
	2
];
var p_blue_2 = [
	82,
	57,
	1,
	1
];
var p_blue_3 = [
	82,
	56,
	1,
	1
];
var ice = [
	104,
	58,
	7,
	8
];
var p_skull_yellow = [
	26,
	48,
	4,
	4
];
var p_lightning_2 = [
	104,
	48,
	3,
	3
];
var p_lightning_1 = [
	104,
	51,
	3,
	3
];
var p_lightning_3 = [
	104,
	54,
	3,
	3
];
var p_lightning_4 = [
	106,
	50,
	1,
	1
];
var p_lightning_5 = [
	106,
	51,
	1,
	1
];
var p_lightning_6 = [
	106,
	54,
	1,
	1
];
var p_ice_1 = [
	58,
	50,
	3,
	3
];
var p_ice_2 = [
	61,
	50,
	2,
	2
];
var p_ice_3 = [
	61,
	52,
	1,
	1
];
var p_dust_1 = [
	26,
	53,
	1,
	1
];
var p_dust_2 = [
	27,
	52,
	2,
	2
];
var p_dust_3 = [
	26,
	52,
	1,
	1
];
var door = [
	32,
	50,
	16,
	20
];
var big_skeleton = [
	0,
	33,
	11,
	20
];
var villager_2 = [
	46,
	18,
	12,
	15
];
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/sprites.png
var sprites_default = "data:image/png;base64,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";
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/font.json
var glyphWidthOverrides = {
	"mMWTVw/$%": 6,
	"I1f-=*+?{}\"": 4,
	"lj[]()|'`,": 3,
	"i:.!": 2
};
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/helpers.ts
var DEG_180 = Math.PI;
var DEG_90 = DEG_180 / 2;
DEG_180 + DEG_90;
var DEG_360 = DEG_180 * 2;
function Point(x, y) {
	return {
		x,
		y
	};
}
function Rectangle(x, y, w, h) {
	return {
		x,
		y,
		w,
		h
	};
}
function overlaps(a, b) {
	return a.x < b.x + b.w && a.y < b.y + b.h && a.x + a.w > b.x && a.y + a.h > b.y;
}
function clamp(val, min, max) {
	return val < min ? min : val > max ? max : val;
}
function vectorFromAngle(radians) {
	return [Math.cos(radians), Math.sin(radians)];
}
function angleBetweenPoints(p1, p2) {
	return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}
function removeFromArray(array, element) {
	let index = array.indexOf(element);
	if (index >= 0) array.splice(index, 1);
}
function randomElement(items) {
	return items[randomInt(items.length)];
}
function distance(p1, p2) {
	return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}
function vectorToAngle(x, y) {
	return Math.atan2(y, x);
}
function randomInt(max) {
	return Math.random() * max | 0;
}
function randomFloat(max = 1) {
	return Math.random() * max;
}
function shuffled(array) {
	array = [...array];
	let m = array.length;
	while (m) {
		let i = randomInt(m--);
		[array[m], array[i]] = [array[i], array[m]];
	}
	return array;
}
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/engine.ts
var metrics = {};
for (let k in glyphWidthOverrides) for (let c of k) metrics[c] = glyphWidthOverrides[k];
var spritesImage = new Image();
spritesImage.src = sprites_default;
var canvas = c;
var ctx$1 = canvas.getContext("2d");
function clear() {
	ctx$1.clearRect(0, 0, canvas.width, canvas.height);
}
function drawSprite([sx, sy, sw, sh], x, y) {
	drawSpriteSlice(sx, sy, sw, sh, x, y, sw, sh);
}
/**
* A scene sprite is drawn with their bottom left corner at the requested
* X coordinate and the Y coordinate treated as a negative, so that a positive
* Y value appears to move them upwards.
* @param sprite
* @param x
* @param y
*/
function drawSceneSprite(sprite, x, y) {
	drawSprite(sprite, x, -y - sprite[3]);
}
function drawSpriteSlice(sx, sy, sw, sh, dx, dy, dw, dh) {
	ctx$1.drawImage(spritesImage, sx, sy, sw, sh, dx | 0, dy | 0, dw, dh);
}
function drawNineSlice(sprite, x, y, w, h) {
	let [sx, sy, sw, sh] = sprite;
	let c = 3;
	if (w <= c || h <= c) return;
	let sx1 = sx;
	let sx2 = sx + c;
	let sx3 = sx + sw - c;
	let sy1 = sy;
	let sy2 = sy + c;
	let sy3 = sy + sh - c;
	let sw1 = sx3 - sx2;
	let sh1 = sy3 - sy2;
	let dx1 = x;
	let dx2 = x + c;
	let dx3 = x + w - c;
	let dy1 = y;
	let dy2 = y + c;
	let dy3 = y + h - c;
	let dw1 = dx3 - dx2;
	let dh1 = dy3 - dy2;
	drawSpriteSlice(sx1, sy1, c, c, dx1, dy1, c, c);
	drawSpriteSlice(sx3, sy1, c, c, dx3, dy1, c, c);
	drawSpriteSlice(sx1, sy3, c, c, dx1, dy3, c, c);
	drawSpriteSlice(sx3, sy3, c, c, dx3, dy3, c, c);
	drawSpriteSlice(sx2, sy1, sw1, c, dx2, dy1, dw1, c);
	drawSpriteSlice(sx2, sy3, sw1, c, dx2, dy3, dw1, c);
	drawSpriteSlice(sx1, sy2, c, sh1, dx1, dy2, c, dh1);
	drawSpriteSlice(sx3, sy2, c, sh1, dx3, dy2, c, dh1);
	drawSpriteSlice(sx2, sy2, sw1, sh1, dx2, dy2, dw1, dh1);
}
var textX = 0;
var textY = 0;
/**
* Write a string of text from the pixel font onto the screen.
* @param text
* @param x
* @param y
*/
function write(text, x = textX, y = textY) {
	textX = x | 0;
	textY = y | 0;
	const zh = window.YuqingChinese.translate(text);
	if (zh !== text) {
		const lines = zh.split("\n");
		lines.forEach((line, i) => window.YuqingChinese.paintBitmap(ctx$1, line, x, y + i * 7, {
			size: 6,
			maxWidth: Math.max(40, text.split("\n")[i]?.length * 5 || 250)
		}));
		textX = x + lines[lines.length - 1].length * 6;
		textY = y + (lines.length - 1) * 7;
		return;
	}
	for (let i = 0; i < text.length; i++) {
		let char = text[i];
		if (char === "\n") {
			textX = x;
			textY += 7;
		} else {
			let code = char.charCodeAt(0) - 32;
			let sx = code % 32 * 5;
			let sy = (code / 32 | 0) * 6;
			let dx = textX;
			let dy = textY;
			ctx$1.drawImage(spritesImage, sx, sy, 5, 6, dx, dy, 5, 6);
			textX += metrics[char] ?? 5;
		}
	}
}
function resize() {
	let { width: w, height: h } = canvas;
	let scale = Math.min(innerWidth / w, innerHeight / h, 3);
	canvas.style.width = canvas.width * scale + "px";
	canvas.style.height = canvas.height * scale + "px";
	ctx$1.imageSmoothingEnabled = false;
}
function init$1(width, height, update) {
	canvas.width = width;
	canvas.height = height;
	(onresize = resize)();
	let t0 = 0;
	(function loop(t1 = 0) {
		requestAnimationFrame(loop);
		update(t1 - t0);
		t0 = t1;
	})();
	onfocus = () => t0 = performance.now();
}
var tweens = [];
var linear = (x) => x;
function updateTweens(dt) {
	tweens = tweens.filter((tween) => {
		tween.elapsed += dt;
		let progress = clamp(tween.elapsed / tween.duration, 0, 1);
		let t = tween.ease(progress);
		let value = tween.startValue + (tween.endValue - tween.startValue) * t;
		tween.callback(value, t);
		return progress < 1;
	});
}
function tween(startValue, endValue, duration, callback, ease = linear) {
	tweens.push({
		startValue,
		endValue,
		duration,
		callback,
		ease,
		elapsed: 0
	});
}
var defaultRange = [0, 0];
function randomFromRange([base, spread]) {
	return base + Math.random() * spread;
}
var particleEmitters = [];
var ParticleEmitter = class ParticleEmitter {
	static pool = [];
	particles = /* @__PURE__ */ new Set();
	x = 0;
	y = 0;
	w = 0;
	h = 0;
	variants = [];
	frequency = 0;
	velocity = defaultRange;
	angle = defaultRange;
	duration = defaultRange;
	bounce = defaultRange;
	friction = defaultRange;
	mass = defaultRange;
	clock = 0;
	done = false;
	constructor(props = {}) {
		Object.assign(this, props);
		particleEmitters.push(this);
	}
	extend(options) {
		return Object.assign(this, options);
	}
	remove() {
		this.done = true;
	}
	update(dt) {
		let t = dt / 1e3;
		this.clock += this.frequency;
		while (!this.done && this.clock > 0) {
			this.clock -= 1;
			this.emit();
		}
		for (let p of this.particles) if ((p.elapsed += dt) >= p.duration) {
			this.particles.delete(p);
			ParticleEmitter.pool.push(p);
		} else {
			p.x += p.vx * t;
			p.y += p.vy * t;
			p.vy -= p.mass * t;
			if (p.y <= 0) {
				p.y = 0;
				p.vy *= -p.bounce;
				p.vx *= p.friction;
			}
		}
		if (this.done && this.particles.size === 0) removeFromArray(particleEmitters, this);
	}
	emit() {
		let p = ParticleEmitter.pool.pop() || {};
		let velocity = randomFromRange(this.velocity);
		let [vx, vy] = vectorFromAngle(randomFromRange(this.angle));
		p.x = randomFromRange([this.x, this.w]);
		p.y = randomFromRange([this.y, this.h]);
		p.vx = vx * velocity;
		p.vy = vy * velocity;
		p.elapsed = 0;
		p.duration = randomFromRange(this.duration);
		p.bounce = randomFromRange(this.bounce);
		p.friction = randomFromRange(this.friction);
		p.mass = randomFromRange(this.mass);
		p.variant = randomFromRange([0, this.variants.length]) | 0;
		this.particles.add(p);
	}
	burst(count) {
		for (let i = 0; i < count; i++) this.emit();
		return this;
	}
};
function updateParticles(dt) {
	for (let emitter of particleEmitters) emitter.update(dt);
}
var GameObject = class {
	x = 0;
	y = 0;
	vx = 0;
	vy = 0;
	mass = 0;
	bounce = 0;
	friction = 0;
	hop = 0;
	sprite = [
		0,
		0,
		0,
		0
	];
	emitter;
	tags = 0;
	collisionMask = 0;
	hp = 0;
	maxHp = 0;
	souls = 0;
	corpseChance = 0;
	despawnOnCollision = false;
	despawnOnBounce = false;
	groupId = 0;
	behaviours = [];
	updateSpeed = 0;
	updateClock = 0;
	is(mask) {
		return (this.tags & mask) > 0;
	}
	bounds() {
		return Rectangle(this.x, this.y, this.sprite[2], this.sprite[3]);
	}
	center() {
		return Point(this.x + this.sprite[2] / 2, this.y + this.sprite[3] / 2);
	}
	update(dt) {
		this.onFrame(dt);
		this.updateClock -= dt;
		if (this.updateClock <= 0) {
			this.updateClock = this.updateSpeed;
			this.onUpdate();
		}
		if (this.emitter) {
			this.emitter.x = this.x;
			this.emitter.y = this.y;
		}
	}
	addBehaviour(behaviour = new Behaviour(this), index = this.behaviours.length) {
		let { constructor } = Object.getPrototypeOf(behaviour);
		if (constructor !== Behaviour && this.getBehaviour(constructor)) return behaviour;
		this.behaviours.splice(index, 0, behaviour);
		behaviour.onAdded();
		return behaviour;
	}
	removeBehaviour(behaviour) {
		removeFromArray(this.behaviours, behaviour);
		behaviour.onRemoved();
	}
	getBehaviour(constructor) {
		return this.behaviours.find((behaviour) => behaviour instanceof constructor);
	}
	onFrame(dt) {
		for (let behaviour of this.behaviours) behaviour.onFrame(dt);
	}
	onUpdate() {
		for (let behaviour of this.behaviours) if (++behaviour.timer >= behaviour.turns) {
			behaviour.timer = 0;
			if (behaviour.onUpdate()) break;
		}
	}
	onDamage(damage) {
		for (let behaviour of this.behaviours) behaviour.onDamage(damage);
	}
	onDeath(death) {
		for (let behaviour of this.behaviours) behaviour.onDeath(death);
	}
	onBounce() {
		for (let behaviour of this.behaviours) behaviour.onBounce();
		if (this.despawnOnBounce) game.despawn(this);
	}
	onCollision(target) {
		for (let behaviour of this.behaviours) behaviour.onCollision(target);
		if (this.despawnOnCollision) game.despawn(this);
	}
};
var Behaviour = class {
	object;
	constructor(object) {
		this.object = object;
	}
	turns = 1;
	timer = 0;
	sprite;
	onAdded() {}
	onRemoved() {}
	onUpdate() {}
	onBounce() {}
	onDamage(damage) {}
	onDeath(death) {}
	onFrame(dt) {}
	onCollision(target) {}
};
function ShopItem(cost, name, description, purchase) {
	return {
		cost,
		name,
		description,
		purchase
	};
}
var Game = class {
	stage = {
		width: 400,
		height: 200,
		floor: 0,
		ceiling: 200
	};
	objects = [];
	player = void 0;
	rituals = [];
	state = 0;
	souls = 0;
	streak = 0;
	level = 0;
	dialogue = [];
	spell = {
		targetAngle: 0,
		targetRadius: 15,
		basePower: 180,
		shotsPerRound: 1,
		shotOffsetAngle: .1,
		maxCasts: 3,
		casts: 3,
		castRechargeRate: 1e3,
		castRechargeTimer: 0
	};
	ability = {
		cooldown: 1e4,
		timer: 1e4
	};
	constructor(player) {
		this.player = player;
		this.spawn(player);
		window.game = this;
	}
	spawn(object, x = object.x, y = object.y) {
		object.x = x;
		object.y = y;
		this.objects.push(object);
	}
	despawn(object) {
		object.emitter?.remove();
		for (let behaviour of Array.from(object.behaviours)) object.removeBehaviour(behaviour);
		removeFromArray(this.objects, object);
	}
	getStreakMultiplier() {
		return this.streak / 10;
	}
	addSouls(amount) {
		this.souls += amount + amount * this.getStreakMultiplier();
	}
	addRitual(ritual) {
		this.rituals.push(ritual);
		ritual.onActive?.();
	}
	canAddRitual(ritual) {
		if (ritual.exclusiveTags) {
			for (let other of this.rituals) if (ritual.exclusiveTags & other.tags) return false;
		}
		if (ritual.requiredTags) {
			for (let other of this.rituals) if (ritual.requiredTags & other.tags) return true;
			return false;
		}
		return true;
	}
	update(dt) {
		this.updateAbility(dt);
		this.updateSpell(dt);
		this.updateObjects(dt);
		this.updatePhysics(dt);
		this.updateRituals(dt);
	}
	updateAbility(dt) {
		game.ability.timer += dt;
		game.player.emitter.frequency = game.ability.timer >= game.ability.cooldown ? .1 : 0;
	}
	updateSpell(dt) {
		if (this.spell.casts < this.spell.maxCasts) {
			this.spell.castRechargeTimer += dt;
			if (this.spell.castRechargeTimer > this.spell.castRechargeRate) {
				this.spell.casts += 1;
				this.spell.castRechargeTimer = 0;
			}
		}
	}
	updateRituals(dt) {
		for (let ritual of this.rituals) ritual.onFrame?.(dt);
	}
	updateObjects(dt) {
		for (let object of this.objects) object.update(dt);
	}
	updatePhysics(dt) {
		let d = dt / 1e3;
		for (let object of this.objects) {
			object.x += object.vx * d;
			object.y += object.vy * d;
		}
		for (let object of this.objects) {
			let lower = this.stage.floor;
			let upper = this.stage.ceiling - object.sprite[3];
			if (object.y < lower || object.y > upper) {
				object.y = clamp(object.y, lower, upper);
				if (Math.abs(object.vy) >= 10) object.onBounce();
				object.vy *= -object.bounce;
			}
			if (object.y === lower || object.y === upper) object.vx *= 1 - object.friction;
			if (object.mass && object.y > 0) object.vy -= object.mass * d;
		}
		for (let object of this.objects) for (let target of this.objects) if (object.collisionMask & target.tags) {
			if (overlaps(object.bounds(), target.bounds())) object.onCollision(target);
		}
	}
	onLevelStart() {
		for (let ritual of game.rituals) ritual.onLevelStart?.();
	}
	onLevelEnd() {
		for (let ritual of game.rituals) ritual.onLevelEnd?.();
	}
	onShopEnter() {
		for (let ritual of game.rituals) ritual.onShopEnter?.();
	}
	onCast(spell, recursive = false) {
		for (let ritual of game.rituals) {
			if (recursive && ritual.recursive == false) continue;
			ritual.onCast?.(spell);
		}
	}
	getCastingPoint() {
		let { spell, player } = this;
		let center = player.center();
		let [vx, vy] = vectorFromAngle(spell.targetAngle);
		return {
			x: center.x + vx * spell.targetRadius,
			y: center.y + vy * spell.targetRadius
		};
	}
};
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/fx.ts
function bones() {
	return new ParticleEmitter({
		duration: [1e4, 5e3],
		friction: [.6, 0],
		velocity: [5, 20],
		angle: [DEG_90 - .5, 1],
		bounce: [.1, .5],
		mass: [60, 0],
		variants: [
			[p_bone_1],
			[p_bone_2],
			[p_bone_3]
		]
	});
}
function trail() {
	return new ParticleEmitter({
		duration: [500, 1e3],
		velocity: [1, 10],
		angle: [Math.PI, -.5],
		bounce: [0, 0],
		frequency: 2,
		mass: [3, 0],
		friction: [.5, 0],
		variants: [
			[
				p_green_1,
				p_green_2,
				p_green_3
			],
			[
				p_green_2,
				p_green_3,
				p_green_4
			],
			[
				p_green_1,
				p_green_2,
				p_green_3
			]
		]
	});
}
function cloud(area, variants) {
	return new ParticleEmitter({
		...area,
		duration: [500, 1e3],
		velocity: [1, 10],
		angle: [DEG_90 - .2, .4],
		bounce: [0, 0],
		frequency: 2,
		mass: [-2, 0],
		variants
	});
}
function royalty() {
	return trail().extend({
		frequency: .5,
		variants: [
			[
				p_star_1,
				p_star_2,
				p_star_3
			],
			[
				p_star_2,
				p_star_3,
				p_star_4
			],
			[p_star_1, p_star_3]
		]
	});
}
function dust() {
	return new ParticleEmitter({
		x: 0,
		y: 0,
		w: game.stage.width,
		h: game.stage.height,
		angle: [0, DEG_360],
		duration: [5e3, 1e4],
		velocity: [1, 3],
		bounce: [0, 0],
		frequency: .1,
		variants: [[p_dust_1, p_dust_2], [
			p_dust_2,
			p_dust_1,
			p_dust_3,
			p_dust_1
		]]
	});
}
function resurrect(unit) {
	return cloud(unit.bounds(), [
		[
			p_green_1,
			p_green_2,
			p_green_3
		],
		[
			p_green_2,
			p_green_3,
			p_green_4
		],
		[
			p_green_1,
			p_green_3,
			p_green_5
		]
	]).extend({ frequency: 0 });
}
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/sounds.ts
function freq(step) {
	return 440 * Math.pow(Math.pow(2, 1 / 12), step);
}
var ctx = new AudioContext();
var __ = -24e3;
var W = 1;
var H = 2;
var Q = 4;
var E = 8;
var A3 = -12;
var B3 = -10;
var C3 = -9;
var D3 = -7;
var E3 = -5;
var F3 = -4;
var Ab4 = -1;
var A4 = 0;
var B4 = 2;
var C4 = 3;
var D4 = 5;
var E4 = 7;
var F4 = 8;
var Ab5 = 11;
var A5 = 12;
var ORGAN = [
	-.8,
	1,
	.8,
	.8,
	-.8,
	-.8,
	-1
];
var A_HARMONIC_MINOR = [
	A3,
	B3,
	C3,
	D3,
	F3,
	E3,
	Ab4,
	A4,
	A4,
	B4,
	C4,
	D4,
	F4,
	E4,
	Ab5,
	A5
];
var masterGain = new GainNode(ctx, { gain: 0 });
masterGain.connect(ctx.destination);
function createReverb(duration = 3, decay = 2) {
	let convolver = new ConvolverNode(ctx, {});
	let rate = ctx.sampleRate;
	let length = rate * duration;
	let impulse = ctx.createBuffer(2, length, rate);
	let left = impulse.getChannelData(0);
	let right = impulse.getChannelData(1);
	for (let i = 0; i < length; i++) {
		left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
		right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
	}
	convolver.buffer = impulse;
	return convolver;
}
function Synth() {
	let volume = new GainNode(ctx, { gain: 1 });
	volume.connect(masterGain);
	let gain = new GainNode(ctx, { gain: 0 });
	gain.connect(volume);
	let filter = new BiquadFilterNode(ctx, {
		type: "lowpass",
		frequency: 500
	});
	filter.connect(gain);
	let osc = new OscillatorNode(ctx);
	osc.connect(filter);
	return {
		gain,
		osc,
		filter,
		volume,
		play(time, frequency) {
			gain.gain.setValueAtTime(.2, time);
			osc.frequency.setValueAtTime(frequency, time);
		},
		start() {
			this.osc.start();
			this.enter();
		},
		enter() {
			volume.gain.linearRampToValueAtTime(.5, ctx.currentTime + 1);
		},
		exit() {
			volume.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
		}
	};
}
function Organ(duration = 1, decay = 1) {
	let synth = Synth();
	synth.osc.setPeriodicWave(ctx.createPeriodicWave(ORGAN, ORGAN));
	let reverb = createReverb(duration, decay);
	reverb.connect(synth.gain);
	synth.filter.connect(reverb);
	synth.filter.type = "highpass";
	synth.filter.frequency.value = 200;
	return synth;
}
function Kick() {
	let synth = Synth();
	synth.filter.type = "lowpass";
	synth.filter.frequency.value = 80;
	synth.osc.frequency.value = 150;
	synth.play = (time) => {
		synth.osc.frequency.setValueAtTime(150, time);
		synth.gain.gain.setValueAtTime(1, time);
		synth.filter.frequency.setValueAtTime(80, time);
		synth.osc.frequency.exponentialRampToValueAtTime(.001, time + .5);
		synth.gain.gain.exponentialRampToValueAtTime(.001, time + .5);
		synth.filter.frequency.linearRampToValueAtTime(.001, time + .5);
	};
	return synth;
}
function Lead() {
	let synth = Synth();
	let convolver = createReverb(3, 1);
	convolver.connect(synth.gain);
	synth.filter.connect(convolver);
	synth.osc.type = "sawtooth";
	synth.play = (time, frequency) => {
		synth.osc.frequency.setValueAtTime(frequency, time);
		synth.gain.gain.setValueAtTime(.25, time);
		synth.gain.gain.setTargetAtTime(0, time + .05, .2);
	};
	return synth;
}
function sequence(pattern, retune = 0, synth) {
	let time = ctx.currentTime;
	function loop() {
		let looper = new OscillatorNode(ctx);
		looper.start(time);
		for (let i = 0; i < pattern.length; i += 2) {
			let note = pattern[i];
			let hold = .25 / (pattern[i + 1] / 4);
			let hz = freq(note + retune);
			synth.play(time, hz, hold);
			time += hold;
		}
		looper.stop(time);
		looper.onended = () => {
			loop();
		};
	}
	loop();
}
var init = false;
function createPattern(beats = 4, lengths = [
	W,
	H,
	Q,
	E
], notes = A_HARMONIC_MINOR) {
	let time = beats;
	let pattern = [];
	while (time > 0) {
		let length = randomElement(lengths);
		let note = randomElement(notes);
		let duration = 1 / length;
		if (time - duration < 0) continue;
		time -= duration;
		pattern.push(note, length);
	}
	return pattern;
}
function createBassline() {
	let a = createPattern(4, [E, Q], [
		A_HARMONIC_MINOR,
		A3,
		A3,
		A3,
		A3,
		A3
	].flat());
	return [
		a,
		a,
		a,
		createPattern(4, [E, Q], A_HARMONIC_MINOR)
	].flat();
}
var synths = {
	kick: Kick(),
	ambientOrgan: Organ(6, 1),
	bass: Lead(),
	kingsOrgan1: Organ(3, .25),
	kingsOrgan2: Organ(3, 1),
	kingsBass: Organ()
};
function play() {
	if (init) return;
	init = true;
	let kingsBass = [
		A4,
		W / 2,
		B4,
		W / 2,
		C4,
		W / 2,
		B4,
		W / 2
	];
	sequence([
		A4,
		H,
		__,
		H
	], -36, synths.kick);
	sequence([
		A4,
		E,
		A3,
		E
	], -36, synths.ambientOrgan);
	sequence(createBassline(), -24, synths.bass);
	{
		let p1 = [
			A4,
			H,
			B4,
			H,
			C4,
			H,
			B4,
			H
		];
		let p = [
			p1,
			p1,
			p1,
			[
				A4,
				H,
				B4,
				H,
				C4,
				H,
				D4,
				H
			]
		].flat();
		sequence(p, 0, synths.kingsOrgan1);
		sequence(p, -12, synths.kingsOrgan2);
		sequence(kingsBass, -36, synths.kingsBass);
	}
	let t = ctx.currentTime;
	masterGain.gain.linearRampToValueAtTime(.5, t + 5);
	useLevelSynths();
}
var normalLevelSynths = [synths.kick, synths.bass];
var bossLevelSynths = [
	synths.kingsBass,
	synths.kingsOrgan1,
	synths.kingsOrgan2
];
function useShopSynths() {
	synths.kick.exit();
}
function useLevelSynths() {
	if (game.level === 0) synths.ambientOrgan.start();
	if (game.level === 1) synths.bass.start();
	if (game.level === 2) synths.kick.start();
	if (game.level === 9) {
		for (let synth of normalLevelSynths) synth.exit();
		for (let synth of bossLevelSynths) synth.start();
	} else for (let synth of normalLevelSynths) synth.enter();
}
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/behaviours.ts
var Attack = class extends Behaviour {
	onCollision(target) {
		let dealDamage = this.object.hp;
		let takeDamage = target.hp;
		Damage(target, dealDamage, this.object);
		Damage(this.object, takeDamage, target);
	}
};
var DespawnTimer = class extends Behaviour {
	duration;
	elapsed = 0;
	constructor(object, duration) {
		super(object);
		this.duration = duration;
	}
	onFrame(dt) {
		if ((this.elapsed += dt) >= this.duration) game.despawn(this.object);
	}
};
var March = class extends Behaviour {
	step;
	constructor(object, step) {
		super(object);
		this.step = step;
	}
	onUpdate() {
		if (this.object.y > 0) return;
		tween(this.object.x, this.object.x + this.step, 200, (x, t) => {
			this.object.x = x;
			this.object.hop = Math.sin(t * Math.PI) * 2;
			if (t === 1 && this.object.mass >= 100) screenshake(50);
		});
		if (this.step < 0 && this.object.x < 0 || this.step > 0 && this.object.x > game.stage.width) game.despawn(this.object);
	}
};
var Damaging = class extends Behaviour {
	amount = 1;
	onCollision(target) {
		Damage(target, this.amount, this.object);
	}
};
var Bleeding = class extends Behaviour {
	sprite = status_bleeding;
	turns = 3;
	amount = 1;
	emitter = cloud({
		x: 0,
		y: 0,
		w: 0,
		h: 0
	}, [[health_orb, health_pip], [health_pip]]).extend({
		mass: [10, 30],
		velocity: [10, 30],
		frequency: 0
	});
	onUpdate() {
		this.emitter.extend(this.object.center());
		this.emitter?.burst(1);
		Damage(this.object, 1, this.object);
	}
};
var Enraged = class extends Behaviour {
	mask;
	sprite = status_enraged;
	emitter = cloud({
		x: 0,
		y: 0,
		w: 0,
		h: 0
	}, [[health_orb, health_pip], [health_pip]]).extend({
		mass: [10, 30],
		velocity: [10, 30],
		frequency: 0
	});
	constructor(object, mask) {
		super(object);
		this.mask = mask;
	}
	onDamage(damage) {
		if (damage.dealer && damage.dealer.is(this.mask)) {
			Damage(this.object, -damage.amount, this.object);
			damage.amount = 0;
			this.emitter.extend(this.object.bounds()).burst(4);
		}
	}
};
var Seeking = class extends Behaviour {
	onFrame() {
		let projectile = this.object;
		let target;
		let minDist = 100;
		for (let object of game.objects) if (object.is(this.object.collisionMask)) {
			let dist = distance(projectile, object);
			if (dist < minDist) {
				target = object;
				minDist = dist;
			}
		}
		if (target) {
			let currentAngle = vectorToAngle(projectile.vx, projectile.vy);
			let angle = currentAngle + (angleBetweenPoints(projectile, target.center()) - currentAngle) / 20;
			let magnitude = Math.hypot(projectile.vx, projectile.vy);
			let [vx, vy] = vectorFromAngle(angle);
			projectile.vx = vx * magnitude;
			projectile.vy = vy * magnitude;
		}
	}
};
var Summon = class extends Behaviour {
	create;
	summonSpeed;
	summonTimer = 0;
	summonCounter = 0;
	constructor(object, create, summonSpeed) {
		super(object);
		this.create = create;
		this.summonSpeed = summonSpeed;
	}
	onSummon(object) {}
	onFrame(dt) {
		if ((this.summonTimer += dt) > this.summonSpeed) {
			this.summonTimer = 0;
			this.summonCounter++;
			let object = this.create();
			game.spawn(object, this.object.x, this.object.y);
			this.onSummon(object);
		}
	}
};
var HitStreak = class HitStreak extends Behaviour {
	static counters = {};
	hit = false;
	counter = void 0;
	onCollision = () => this.hit = true;
	onAdded = () => {
		this.counter = HitStreak.counters[this.object.groupId] ||= {
			total: 0,
			hits: 0
		};
		this.counter.total++;
	};
	onRemoved() {
		if (this.hit) this.counter.hits++;
		if (--this.counter.total) return;
		if (this.counter.hits) game.streak = clamp(game.streak + 1, 0, 10);
		else game.streak = 0;
	}
};
var Invulnerable = class extends Behaviour {
	sprite = status_shielded;
	onDamage(damage) {
		if (damage.amount > 0) damage.amount = 0;
	}
};
var Frozen = class extends Behaviour {
	freezeTimer = 10;
	onUpdate() {
		if (this.freezeTimer-- <= 0) this.object.removeBehaviour(this);
		return true;
	}
};
var LightningStrike = class extends Behaviour {
	onCollision(target) {
		let bolts = 3;
		for (let i = 0; i < bolts; i++) {
			let bolt = LightningSpell();
			bolt.vy = -200;
			bolt.vx = randomInt(20) - 10;
			bolt.y = clamp(50 + randomInt(100), 0, game.stage.ceiling - 10);
			bolt.x = target.x + randomInt(50) - 25;
			game.spawn(bolt);
		}
	}
};
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/objects.ts
function Corpse() {
	let unit = new GameObject();
	unit.sprite = skull;
	unit.mass = 100;
	unit.tags = 8;
	return unit;
}
function Player() {
	let player = new GameObject();
	player.x = 5;
	player.tags = 36;
	player.sprite = norman_arms_down;
	player.collisionMask = 2;
	player.updateSpeed = 1e3;
	player.hp = player.maxHp = 5;
	player.emitter = resurrect(player);
	player.onCollision = (unit) => {
		Damage(player, unit.hp);
		Die(unit);
	};
	player.onDeath = () => window.location = window.location;
	return player;
}
function Spell() {
	let object = new GameObject();
	object.sprite = p_green_skull;
	object.tags = 16;
	object.collisionMask = 3;
	object.mass = 100;
	object.emitter = trail();
	object.friction = .1;
	object.despawnOnCollision = true;
	object.despawnOnBounce = true;
	object.addBehaviour(new Damaging(object));
	return object;
}
function LightningSpell() {
	let spell = Spell();
	spell.sprite = p_skull_yellow;
	spell.emitter.frequency = .8;
	spell.emitter.variants = [
		[
			p_lightning_1,
			p_lightning_2,
			p_lightning_3,
			p_lightning_4
		],
		[
			p_lightning_1,
			p_lightning_2,
			p_lightning_3,
			p_lightning_5
		],
		[
			p_lightning_2,
			p_lightning_3,
			p_lightning_6
		],
		[
			p_lightning_4,
			p_lightning_5,
			p_lightning_6
		],
		[p_purple_5]
	];
	return spell;
}
function Skeleton() {
	let unit = new GameObject();
	unit.sprite = skeleton;
	unit.tags = 5;
	unit.collisionMask = 2;
	unit.hp = unit.maxHp = 1;
	unit.updateSpeed = 1e3;
	unit.behaviours.push(new March(unit, 16));
	unit.behaviours.push(new Attack(unit));
	return unit;
}
function SkeletonLord() {
	let unit = Skeleton();
	unit.sprite = big_skeleton;
	unit.hp = unit.maxHp = 3;
	unit.updateSpeed = 1500;
	return unit;
}
function Villager() {
	let unit = new GameObject();
	unit.sprite = randomElement([
		villager_1,
		villager_2,
		villager_3,
		villager_4
	]);
	unit.friction = .8;
	unit.mass = 75;
	unit.x = game.stage.width;
	unit.tags = 3;
	unit.hp = unit.maxHp = 1;
	unit.updateSpeed = 600;
	unit.addBehaviour(new March(unit, -16));
	unit.corpseChance = .75;
	unit.souls = 5;
	return unit;
}
function Bandit() {
	let unit = Villager();
	unit.hp = unit.maxHp = 2;
	return unit;
}
function TheKing() {
	let unit = Villager();
	unit.sprite = the_king;
	unit.updateSpeed = 5e3;
	unit.hp = unit.maxHp = 100;
	unit.behaviours = [];
	unit.mass = 1e3;
	unit.emitter = royalty().extend({
		frequency: .2,
		angle: [DEG_90, .5],
		w: unit.sprite[2],
		h: unit.sprite[3]
	});
	let phase = 1;
	let marching = new March(unit, -32);
	let summons = new Summon(unit, RoyalGuard, 2e3);
	let enraged = new Enraged(unit, 16);
	let invulnerable = new Invulnerable(unit);
	let boss = new Behaviour(unit);
	unit.addBehaviour(marching);
	unit.addBehaviour(boss);
	boss.onDamage = ({ amount }) => {
		let willDie = unit.hp - amount <= 0;
		if (phase === 1 && willDie) {
			phase = 2;
			unit.addBehaviour(summons);
			unit.addBehaviour(enraged);
			unit.addBehaviour(invulnerable);
			marching.step *= -1;
		} else if (phase === 3 && willDie) {
			synths.kick.enter();
			phase = 4;
			unit.hp = unit.maxHp;
			unit.sprite = the_king_on_foot;
			unit.updateSpeed = unit.updateClock = 1e3;
			marching.step /= 2;
			let t = 0;
			unit.addBehaviour().onFrame = (dt) => {
				if ((t += dt) > 300) {
					t = 0;
					game.spawn(Corpse(), randomInt(game.stage.width), game.stage.ceiling);
				}
			};
		}
	};
	summons.onSummon = () => {
		if (summons.summonCounter >= 5) {
			phase = 3;
			unit.removeBehaviour(enraged);
			unit.removeBehaviour(invulnerable);
			unit.removeBehaviour(summons);
			marching.step *= -1;
		}
	};
	return unit;
}
function Champion() {
	let unit = Villager();
	unit.sprite = champion;
	unit.updateSpeed = 1e3;
	unit.hp = unit.maxHp = 10;
	unit.souls = 25;
	return unit;
}
function ShellKnight() {
	let unit = Villager();
	unit.sprite = shell_knight_up;
	unit.updateSpeed = 1e3;
	unit.hp = unit.maxHp = 5;
	unit.souls = 15;
	let shell = unit.addBehaviour();
	let shelled = false;
	let timer = 0;
	shell.onUpdate = () => {
		shelled = timer++ % 4 > 1;
		unit.sprite = shelled ? shell_knight_down : shell_knight_up;
		shell.sprite = shelled ? status_shielded : void 0;
	};
	shell.onDamage = (dmg) => {
		if (shelled) dmg.amount = Math.min(0, dmg.amount);
	};
	return unit;
}
function Monk() {
	let unit = Villager();
	unit.sprite = monk;
	unit.updateSpeed = 600;
	unit.hp = unit.maxHp = 3;
	unit.souls = 10;
	let heal = new Behaviour(unit);
	heal.turns = 5;
	heal.onUpdate = () => {
		for (let object of game.objects) if (object.is(2)) Damage(object, -1, unit);
		cloud(unit.bounds(), [
			[
				p_star_1,
				p_star_2,
				p_star_3
			],
			[
				p_star_2,
				p_star_3,
				p_star_4
			],
			[p_star_1, p_star_3]
		]).burst(10).remove();
	};
	unit.addBehaviour(heal);
	return unit;
}
function Archer() {
	let unit = Villager();
	unit.sprite = archer;
	unit.updateSpeed = 300;
	unit.hp = unit.maxHp = 2;
	return unit;
}
function Piper() {
	let unit = Villager();
	unit.sprite = piper;
	unit.updateSpeed = 500;
	unit.hp = unit.maxHp = 15;
	unit.addBehaviour(new Summon(unit, Rat, 2e3));
	unit.souls = 100;
	return unit;
}
function Rat() {
	let unit = Villager();
	unit.sprite = rat;
	unit.updateSpeed = 200;
	unit.souls = 5;
	unit.corpseChance = 0;
	return unit;
}
function RageKnight() {
	let unit = Villager();
	unit.sprite = rage_knight;
	unit.updateSpeed = 500;
	unit.hp = unit.maxHp = 5;
	let raging = unit.addBehaviour();
	let march = unit.getBehaviour(March);
	let enraged = new Enraged(unit, 16);
	let angry = false;
	let step = march.step;
	raging.turns = 5;
	raging.onUpdate = () => {
		angry = !angry;
		if (angry) unit.addBehaviour(enraged);
		else unit.removeBehaviour(enraged);
		unit.sprite = angry ? rage_knight_enraged : rage_knight;
		march.step = angry ? 0 : step;
	};
	unit.souls = 20;
	return unit;
}
function RoyalGuard() {
	let unit = Villager();
	unit.sprite = royal_guard;
	unit.hp = unit.maxHp = 4;
	unit.souls = 10;
	let march = unit.getBehaviour(March);
	let shielded = false;
	let shield = unit.addBehaviour();
	shield.turns = 3;
	shield.onUpdate = () => {
		shielded = !shielded;
		march.step = shielded ? 0 : -16;
		unit.sprite = shielded ? royal_guard_shielded : royal_guard;
	};
	shield.onDamage = (dmg) => {
		if (!shielded || !dmg.dealer?.is(16)) return;
		if (dmg.dealer.vx > 0) {
			dmg.amount = 0;
			let orb = RoyalGuardOrb();
			orb.vx = dmg.dealer.vx *= -1;
			orb.vy = dmg.dealer.vy *= -.25;
			orb.mass = dmg.dealer.mass;
			game.spawn(orb, dmg.dealer.x - orb.sprite[2] - 1, dmg.dealer.y);
		}
	};
	unit.behaviours.reverse();
	return unit;
}
function RoyalGuardOrb() {
	let unit = new GameObject();
	unit.sprite = yellow_orb;
	unit.tags = 16;
	unit.collisionMask = 33;
	unit.hp = 1;
	unit.despawnOnBounce = true;
	unit.despawnOnCollision = true;
	unit.addBehaviour(new Damaging(unit));
	unit.addBehaviour(new DespawnTimer(unit, 3e3));
	unit.friction = .9;
	unit.emitter = royalty();
	return unit;
}
function Wizard() {
	let unit = Villager();
	unit.sprite = wizard;
	unit.hp = unit.maxHp = 15;
	unit.souls = 10;
	unit.addBehaviour(new Summon(unit, Portal, 3e3));
	return unit;
}
function Portal() {
	let unit = new GameObject();
	unit.sprite = portal;
	unit.tags = 2;
	unit.hp = unit.maxHp = 3;
	unit.souls = 10;
	unit.addBehaviour(new DespawnTimer(unit, 3e4));
	unit.addBehaviour(new Summon(unit, () => randomElement([
		Villager,
		Bandit,
		Archer
	])(), 3e3));
	unit.emitter = cloud(unit.bounds(), [
		[
			p_blue_1,
			p_blue_2,
			p_blue_3
		],
		[p_blue_2, p_blue_3],
		[p_blue_3]
	]).extend({ frequency: .2 });
	return unit;
}
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/actions.ts
function Damage(object, amount, dealer) {
	let damage = {
		amount,
		dealer
	};
	object.onDamage(damage);
	object.hp = clamp(object.hp - damage.amount, 0, object.maxHp);
	if (!object.hp) Die(object, dealer);
}
function Die(object, killer) {
	let death = {
		object,
		killer,
		souls: object.souls
	};
	if (object.is(1)) {
		let center = object.center();
		bones().extend(center).burst(2 + randomInt(3)).remove();
		for (let ritual of game.rituals) ritual.onDeath?.(death);
		if (randomFloat() <= object.corpseChance) game.spawn(Corpse(), center.x, center.y);
		game.addSouls(death.souls);
	}
	object.onDeath(death);
	game.despawn(object);
}
var castAnimationTimeout = 0;
var castGroupId = 1;
function Cast() {
	let { spell, player } = game;
	if (spell.casts === 0) return;
	spell.casts--;
	player.sprite = norman_arms_up;
	clearTimeout(castAnimationTimeout);
	castAnimationTimeout = setTimeout(() => player.sprite = norman_arms_down, 500);
	let power = spell.basePower;
	let targetAngle = spell.targetAngle - spell.shotsPerRound * spell.shotOffsetAngle / 2;
	let groupId = castGroupId++;
	for (let j = 0; j < spell.shotsPerRound; j++) {
		let projectile = Spell();
		let [vx, vy] = vectorFromAngle(targetAngle + j * spell.shotOffsetAngle);
		let { x, y } = game.getCastingPoint();
		projectile.x = x - projectile.sprite[2] / 2;
		projectile.y = y - projectile.sprite[3] / 2;
		projectile.vx = vx * power;
		projectile.vy = vy * power;
		projectile.groupId = groupId;
		game.spawn(projectile);
		game.onCast(projectile);
	}
}
function Resurrect() {
	if (game.ability.timer < game.ability.cooldown) return;
	game.ability.timer = 0;
	for (let ritual of game.rituals) ritual.onResurrect?.();
	let corpses = game.objects.filter((object) => object.is(8));
	for (let corpse of corpses) {
		game.despawn(corpse);
		let unit = Skeleton();
		game.spawn(unit, corpse.x, 0);
		resurrect(unit).burst(10).remove();
		for (let ritual of game.rituals) ritual.onResurrection?.(unit);
	}
}
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/levels.ts
var END_OF_LEVEL = 99;
var END_OF_WAVE = 98;
var VILLAGER = 0;
var ARCHER = 1;
var MONK = 2;
var CHAMPION = 3;
var PIPER = 4;
var RAGE_KNIGHT = 5;
var ROYAL_GUARD = 6;
var SHELL_KNIGHT = 7;
var WIZARD = 8;
var THE_KING = 9;
var RAT = 10;
var MOB = 11;
var BANDIT = 12;
var LOOKUP = [
	Villager,
	Archer,
	Monk,
	Champion,
	Piper,
	RageKnight,
	RoyalGuard,
	ShellKnight,
	Wizard,
	TheKing,
	Rat,
	Villager,
	Bandit
];
var DELAYS = {
	[RAT]: () => randomInt(500),
	[VILLAGER]: () => randomInt(200),
	[BANDIT]: () => randomInt(200),
	[MOB]: () => -randomInt(500)
};
var LEVELS = [
	4,
	VILLAGER,
	END_OF_WAVE,
	4,
	VILLAGER,
	END_OF_WAVE,
	2,
	VILLAGER,
	1,
	ARCHER,
	END_OF_WAVE,
	2,
	VILLAGER,
	1,
	ARCHER,
	4,
	VILLAGER,
	END_OF_LEVEL,
	2,
	ARCHER,
	4,
	VILLAGER,
	END_OF_WAVE,
	3,
	ARCHER,
	4,
	VILLAGER,
	END_OF_WAVE,
	8,
	VILLAGER,
	2,
	ARCHER,
	END_OF_WAVE,
	1,
	CHAMPION,
	END_OF_LEVEL,
	1,
	MONK,
	END_OF_WAVE,
	4,
	BANDIT,
	END_OF_WAVE,
	2,
	BANDIT,
	1,
	MONK,
	END_OF_WAVE,
	2,
	ARCHER,
	1,
	MONK,
	END_OF_WAVE,
	4,
	VILLAGER,
	2,
	BANDIT,
	2,
	ARCHER,
	1,
	MONK,
	END_OF_LEVEL,
	1,
	SHELL_KNIGHT,
	END_OF_WAVE,
	4,
	VILLAGER,
	3,
	BANDIT,
	END_OF_WAVE,
	1,
	SHELL_KNIGHT,
	1,
	MONK,
	1,
	END_OF_WAVE,
	2,
	ARCHER,
	1,
	MONK,
	1,
	SHELL_KNIGHT,
	END_OF_WAVE,
	8,
	VILLAGER,
	END_OF_WAVE,
	1,
	SHELL_KNIGHT,
	1,
	CHAMPION,
	1,
	SHELL_KNIGHT,
	END_OF_LEVEL,
	1,
	RAT,
	END_OF_WAVE,
	3,
	RAT,
	END_OF_WAVE,
	7,
	RAT,
	1,
	PIPER,
	END_OF_LEVEL,
	4,
	BANDIT,
	END_OF_WAVE,
	1,
	RAGE_KNIGHT,
	END_OF_WAVE,
	4,
	BANDIT,
	1,
	CHAMPION,
	2,
	ARCHER,
	END_OF_WAVE,
	4,
	BANDIT,
	1,
	RAGE_KNIGHT,
	END_OF_WAVE,
	2,
	RAGE_KNIGHT,
	1,
	MONK,
	END_OF_WAVE,
	1,
	WIZARD,
	END_OF_LEVEL,
	20,
	MOB,
	1,
	RAGE_KNIGHT,
	20,
	MOB,
	1,
	RAGE_KNIGHT,
	20,
	MOB,
	END_OF_WAVE,
	20,
	MOB,
	1,
	RAGE_KNIGHT,
	20,
	MOB,
	1,
	RAGE_KNIGHT,
	20,
	MOB,
	END_OF_WAVE,
	3,
	CHAMPION,
	END_OF_LEVEL,
	10,
	BANDIT,
	1,
	MONK,
	10,
	BANDIT,
	1,
	MONK,
	END_OF_WAVE,
	10,
	BANDIT,
	1,
	WIZARD,
	1,
	SHELL_KNIGHT,
	END_OF_WAVE,
	5,
	BANDIT,
	3,
	ARCHER,
	3,
	RAGE_KNIGHT,
	END_OF_WAVE,
	1,
	CHAMPION,
	1,
	WIZARD,
	1,
	CHAMPION,
	END_OF_LEVEL,
	1,
	VILLAGER,
	END_OF_WAVE,
	2,
	ROYAL_GUARD,
	END_OF_WAVE,
	2,
	ARCHER,
	END_OF_WAVE,
	10,
	ROYAL_GUARD,
	END_OF_WAVE,
	10,
	ROYAL_GUARD,
	2,
	MONK,
	10,
	ROYAL_GUARD,
	END_OF_WAVE,
	2,
	ROYAL_GUARD,
	1,
	SHELL_KNIGHT,
	1,
	CHAMPION,
	1,
	MONK,
	END_OF_WAVE,
	2,
	ROYAL_GUARD,
	1,
	SHELL_KNIGHT,
	1,
	CHAMPION,
	1,
	WIZARD,
	END_OF_LEVEL,
	1,
	THE_KING,
	END_OF_LEVEL
];
var timer = 0;
var cursor = 0;
function isLevelFinished() {
	return LEVELS[cursor] === END_OF_LEVEL && isCleared();
}
function isComplete() {
	return cursor >= LEVELS.length - 1;
}
var nextLevel = () => {
	cursor++;
	game.level++;
	game.onLevelStart();
};
function updateLevel(dt) {
	let cmd = LEVELS[cursor];
	if ((timer -= dt) > 0) {} else if (cmd === END_OF_WAVE) isCleared() && cursor++;
	else if (cmd === END_OF_LEVEL) {} else if (cmd) {
		LEVELS[cursor]--;
		let id = LEVELS[cursor + 1];
		let unit = LOOKUP[id]();
		game.spawn(unit);
		timer = unit.updateSpeed + (DELAYS[id]?.() || 0);
	} else cursor += 2;
}
function isCleared() {
	return !game.objects.some((object) => object.is(2));
}
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/shop.ts
var shop = {
	rituals: [],
	items: [],
	selectedIndex: 0
};
function buy() {
	let item = shop.items[shop.selectedIndex];
	if (item && item.cost <= game.souls) {
		game.souls -= item.cost;
		removeFromArray(shop.items, item);
		item.purchase();
		selectShopIndex(shop.selectedIndex);
	}
}
function selectShopIndex(step) {
	shop.selectedIndex = clamp(shop.selectedIndex + step, 0, shop.items.length - 1);
}
function enterShop() {
	game.state = 2;
	restockShop();
	game.onShopEnter();
	useShopSynths();
}
function exitShop() {
	game.state = 1;
	nextLevel();
	useLevelSynths();
}
function restockShop() {
	let exp = Math.pow(game.level + 1, 2);
	shop.items = [
		game.player.hp < game.player.maxHp && ShopItem(10 * game.level, "Heal", `Heal 1*`, () => Damage(game.player, -1)),
		ShopItem(10 * exp, "Renew", `+1* max hp`, () => {
			game.player.maxHp++;
			game.player.hp++;
		}),
		ShopItem(10 * exp, "Recharge", "+1 max casts", () => game.spell.maxCasts++),
		...createRitualItems(),
		ShopItem(0, "Continue", "Begin the next level", () => exitShop())
	].filter((item) => item);
}
function createRitualItems() {
	let rituals = shuffled(shop.rituals.filter((ritual) => game.canAddRitual(ritual)));
	let commons = rituals.filter((r) => r.rarity !== 1);
	return rituals.filter((r) => r.rarity === 1).slice(0, 1).concat(commons.slice(0, 2)).map((ritual) => {
		return {
			name: ritual.name,
			description: ritual.description,
			cost: ritual.rarity === 1 ? 200 + randomInt(100) : 75 + randomInt(100),
			purchase() {
				removeFromArray(shop.rituals, ritual);
				game.addRitual(ritual);
			}
		};
	});
}
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/renderer.ts
var ICON_SOULS = "$";
var screenShakeTimer = 0;
function screenshake(time) {
	screenShakeTimer = time;
}
var sceneOrigin = Point(0, 150);
function screenToSceneCoords(x, y) {
	let r = canvas.getBoundingClientRect();
	let sx = (x - r.x) * (canvas.width / r.width) | 0;
	let sy = (y - r.y) * (canvas.height / r.height) | 0;
	return {
		x: sx,
		y: sceneOrigin.y - sy
	};
}
function render(dt) {
	clear();
	ctx$1.save();
	if (screenShakeTimer > 0) {
		screenShakeTimer -= dt;
		ctx$1.translate(randomInt(2), randomInt(2));
	}
	ctx$1.translate(sceneOrigin.x, sceneOrigin.y);
	drawBackground();
	drawParticles();
	drawObjects();
	if (game.state === 1) drawReticle();
	ctx$1.restore();
	drawHud();
	if (game.state === 2) drawShop();
}
function drawShop() {
	write("Rituals\n\n", 160, 20);
	let selected = shop.items[shop.selectedIndex];
	for (let item of shop.items) write(`${item === selected ? ">" : " "}${item.name} $${item.cost}\n`);
	write("\n" + selected?.description + "\n");
}
function drawHud() {
	if (game.dialogue.length) write(game.dialogue[0], 75, 50);
	if (game.state === 0) return;
	drawSprite(norman_icon, 0, 0);
	for (let i = 0; i < game.player.maxHp; i++) drawSprite(i < game.player.hp ? health_orb : health_orb_empty, 11 + i * 4, 0);
	for (let i = 0; i < game.spell.maxCasts; i++) drawSprite(i < game.spell.casts ? cast_orb : cast_orb_empty, 11 + i * 4, 6);
	let souls = game.souls | 0;
	if (souls) {
		let multiplier = game.getStreakMultiplier();
		write(`${ICON_SOULS}${souls} ${multiplier ? `(+${multiplier * 100 + "%"})` : ""}`, canvas.width / 2 - 30, 0);
	}
	write(`${game.level + 1}-10`, canvas.width - 30, 2);
	if (game.state === 1) {
		let x = 150;
		let y = canvas.height - 12;
		let progress = clamp(game.ability.timer / game.ability.cooldown, 0, 1);
		drawNineSlice(pink_frame, x, y, 52 * (1 - progress) | 0, 10);
		write("Resurrect", 160, y + 2);
		if (progress === 1) write(" (Space)");
		else write(" (" + ((1 - progress) * game.ability.cooldown / 1e3 | 0) + "s)");
		drawSprite(skull, 151, y + 1);
	}
}
function drawOrbs(x, y, value, maxValue, sprite, emptySprite) {
	let x0 = x - maxValue * 4 / 2;
	for (let i = 0; i < maxValue; i++) drawSceneSprite(i < value ? sprite : emptySprite, x0 + i * 4, y);
}
function drawObjects() {
	for (let object of game.objects) {
		drawSceneSprite(object.sprite, object.x, object.y + object.hop);
		if (object.getBehaviour(Frozen)) drawNineSlice(ice, object.x, -object.sprite[3], object.sprite[2], object.sprite[3]);
		if (object.maxHp > 1 && object !== game.player) {
			if (object.maxHp < 10) {
				let { x } = object.center();
				drawOrbs(x, -6, object.hp, object.maxHp, health_orb, health_orb_empty);
			} else {
				drawSceneSprite(health_orb, object.x, -6);
				write(`${object.hp}/${object.maxHp}`, object.x + 6, 0);
			}
		}
		let { x } = object;
		for (let behaviour of object.behaviours) if (behaviour.sprite) {
			drawSceneSprite(behaviour.sprite, x, -12);
			x += behaviour.sprite[2] + 1;
		}
	}
}
function drawBackground() {
	for (let i = 0; i < game.stage.width / 16; i++) {
		drawSceneSprite(i % 5 ? wall : door, i * 16, 0);
		drawSceneSprite(floor, i * 16, -floor[3]);
		drawSceneSprite(ceiling, i * 16, game.stage.ceiling);
	}
}
function drawReticle() {
	let { x, y } = game.getCastingPoint();
	let sprite = reticle;
	drawSceneSprite(sprite, x - sprite[2] / 2, y - sprite[3] / 2);
}
function drawParticles() {
	for (let emitter of particleEmitters) for (let particle of emitter.particles) {
		let variant = emitter.variants[particle.variant];
		let sprite = variant[particle.elapsed / particle.duration * variant.length | 0];
		drawSceneSprite(sprite, particle.x, particle.y);
	}
}
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/rituals.ts
var NONE = 0;
var BOUNCING = 1;
var SPLITTING = 2;
var HOMING = 8;
var CURSE = 64;
var Streak = {
	tags: NONE,
	name: "Streak",
	description: "",
	onCast: (spell) => spell.addBehaviour(new HitStreak(spell))
};
var Bouncing = {
	tags: BOUNCING,
	name: "Bouncing",
	description: "Spells bounce",
	onCast(spell) {
		spell.addBehaviour(new DespawnTimer(spell, 3e3));
		spell.despawnOnBounce = false;
		spell.bounce = .5;
	}
};
var Doubleshot = {
	tags: SPLITTING,
	exclusiveTags: SPLITTING,
	rarity: 1,
	name: "Doubleshot",
	description: "Cast 2 spells",
	onActive() {
		game.spell.shotsPerRound = 2;
	}
};
var Hunter = {
	tags: HOMING,
	rarity: 1,
	name: "Hunter",
	description: "Spells seek targets",
	onCast(projectile) {
		projectile.addBehaviour(new Seeking(projectile));
	}
};
var Weightless = {
	tags: NONE,
	name: "Weightless",
	description: "Spells are not affected by gravity",
	onCast(spell) {
		spell.mass = 0;
		spell.friction = 0;
		spell.bounce = 1;
	}
};
var KnockbackSpell = class extends Behaviour {
	onCollision(target) {
		if (target.mass < 1e3) tween(target.x, target.x + 16, 200, (x) => target.x = x);
	}
};
var Knockback = {
	tags: NONE,
	name: "Knockback",
	description: "Spells knock backwards",
	onCast(spell) {
		spell.addBehaviour(new KnockbackSpell(spell));
	}
};
var Ceiling = {
	tags: NONE,
	requiredTags: BOUNCING,
	name: "Ceiling",
	description: "Adds a ceiling",
	onActive() {
		game.stage.ceiling = 48;
	}
};
var RainSpell = class extends Behaviour {
	split = false;
	onFrame() {
		if (!this.split && this.object.vy < 0) {
			this.split = true;
			let p0 = this.object;
			let p1 = Spell();
			let p2 = Spell();
			p1.x = p2.x = p0.x;
			p1.y = p2.y = p0.y;
			p1.vx = p2.vx = p0.vx;
			p1.vy = p2.vy = p0.vy;
			p1.vx -= 20;
			p2.vx += 20;
			p1.groupId = p2.groupId = p0.groupId;
			game.onCast(p1, true);
			game.onCast(p2, true);
			game.spawn(p1);
			game.spawn(p2);
		}
	}
};
var Rain = {
	tags: SPLITTING,
	exclusiveTags: SPLITTING,
	rarity: 1,
	name: "Rain",
	description: "Spells split when they drop",
	recursive: false,
	onCast(spell) {
		spell.addBehaviour(new RainSpell(spell));
	}
};
var Drunkard = {
	tags: NONE,
	name: "Drunkard",
	description: "2x damage, wobbly aim",
	onCast(spell) {
		spell.vx += randomInt(100) - 50;
		spell.vy += randomInt(100) - 50;
		spell.getBehaviour(Damaging).amount *= 2;
	}
};
var Seer = {
	tags: NONE,
	name: "Seer",
	description: "Spells pass through the dead",
	onCast(spell) {
		spell.collisionMask = 2;
	}
};
var Tearstone = {
	tags: NONE,
	name: "Tearstone",
	description: "2x damage when < half HP",
	onCast(spell) {
		if (game.player.hp < game.player.maxHp / 2) spell.getBehaviour(Damaging).amount *= 3;
	}
};
var Impatience = {
	tags: NONE,
	name: "Impatience",
	description: "Resurrection recharges 2x faster",
	onActive() {
		game.ability.cooldown /= 2;
	}
};
var Bleed = {
	tags: CURSE,
	name: "Bleed",
	description: "Inflicts bleed on hits",
	onCast(spell) {
		spell.sprite = p_red_skull;
		spell.emitter.extend({
			variants: [
				[
					p_red_3,
					p_red_2,
					p_red_1
				],
				[
					p_red_4,
					p_red_3,
					p_red_2
				],
				[
					p_red_3,
					p_red_2,
					p_red_1
				]
			],
			frequency: 5,
			angle: [DEG_180, 0],
			mass: [20, 50]
		});
		let inflict = spell.addBehaviour();
		inflict.onCollision = (target) => {
			target.addBehaviour(new Bleeding(target));
		};
	}
};
var Allegiance = {
	tags: NONE,
	name: "Allegiance",
	description: "Summon your honour guard after resurrections",
	onResurrect() {
		for (let i = 0; i < 3; i++) {
			let unit = SkeletonLord();
			unit.updateSpeed = 200;
			game.spawn(unit, i * -15, 0);
		}
	}
};
var Salvage = {
	tags: NONE,
	name: "Salvage",
	description: "Corpses become souls at the end of levels",
	onLevelEnd() {
		let corpses = game.objects.filter((object) => object.is(8));
		for (let corpse of corpses) {
			let emitter = bones().extend({
				...corpse.center(),
				variants: [[p_green_skull]],
				duration: [100, 1e3]
			});
			emitter.burst(5);
			emitter.remove();
			game.despawn(corpse);
			game.addSouls(5);
		}
	}
};
var Studious = {
	tags: NONE,
	rarity: 1,
	name: "Studious",
	description: "Rituals are 50% cheaper",
	onShopEnter() {
		for (let item of shop.items) item.cost = item.cost / 2 | 0;
	}
};
var Electrodynamics = {
	tags: NONE,
	rarity: 1,
	name: "Electrodynamics",
	description: "Lightning strikes after hits",
	onCast(spell) {
		spell.addBehaviour(new LightningStrike(spell));
	}
};
var Chilly = {
	tags: NONE,
	name: "Chilly",
	description: "10% chance to freeze enemies",
	onCast(spell) {
		if (randomFloat() <= .1) {
			spell.emitter.variants = [[
				p_ice_1,
				p_ice_2,
				p_ice_3
			]];
			spell.sprite = p_skull;
			spell.getBehaviour(Damaging).amount = 0;
			spell.addBehaviour().onCollision = (target) => {
				if (target.mass < 1e3) target.addBehaviour(new Frozen(target), 0);
			};
		}
	}
};
var Giants = {
	tags: NONE,
	name: "Giants",
	description: "20% chance to resurrect giant skeletons",
	onResurrection(object) {
		if (randomFloat() < .2) {
			game.despawn(object);
			game.spawn(SkeletonLord(), object.x, object.y);
		}
	}
};
var Avarice = {
	tags: NONE,
	name: "Avarice",
	description: "+1 soul for each corpse you resurrect",
	onResurrection() {
		game.addSouls(1);
	}
};
var Hardened = {
	tags: NONE,
	name: "Hardened",
	description: "Undead have +1 HP*",
	onResurrection(object) {
		object.hp = object.maxHp += 1;
	}
};
//#endregion
//#region game-sources/upstream/expansion/danprince--js13k-2022/src/index.ts
var player = Player();
player.sprite = skull;
var game$1 = new Game(player);
var paused = false;
var ARROW_UP = 38;
var ARROW_DOWN = 40;
var SPACE = 32;
var ENTER = 13;
var KEY_P = 80;
var INTRO_DIALOGUE = [
	"Norman wasn't a particularly popular necromancer...",
	"         The other villagers hunted him.",
	"     Sometimes they even finished the job (@)",
	"  But like any self-respecting necromancer...",
	"        Norman just brought himself back."
];
var OUTRO_DIALOGUE = [
	"",
	"It was over.",
	"Norman was able to study peacefully.",
	"But he knew that eventually, they'd be back.",
	"THE END"
];
onpointerup = () => {
	if (game$1.state === 0) {
		play();
		game$1.state = 1;
		game$1.player.sprite = norman_arms_down;
	}
	Cast();
};
onpointermove = ({ clientX, clientY }) => {
	let p1 = player.center();
	let p2 = screenToSceneCoords(clientX, clientY);
	game$1.spell.targetAngle = angleBetweenPoints(p1, p2);
};
onkeydown = ({ which: key }) => {
	if (game$1.state === 1) {
		if (key === SPACE) Resurrect();
		if (key === KEY_P) paused = !paused;
	} else if (game$1.state === 2) {
		if (key === ARROW_UP) selectShopIndex(-1);
		if (key === ARROW_DOWN) selectShopIndex(1);
		if (key === ENTER) buy();
	}
};
var normanIsBouncing = false;
function update(dt) {
	updateDialogue(dt);
	render(dt);
	if (paused) return;
	if (game$1.state === 1) updateLevel(dt);
	if (game$1.state !== 0) game$1.update(dt);
	updateTweens(dt);
	updateParticles(dt);
	if (game$1.state === 1 && isLevelFinished()) {
		if (isComplete()) onWin();
		else {
			game$1.onLevelEnd();
			enterShop();
		}
	}
	if (game$1.level === 2 && !normanIsBouncing) {
		game$1.player.addBehaviour(new March(game$1.player, 0));
		game$1.player.updateClock = 100;
		game$1.player.updateSpeed = 500;
		normanIsBouncing = true;
	}
}
function onWin() {
	game$1.state = 4;
	game$1.dialogue = OUTRO_DIALOGUE;
}
var dialogueTimer = 0;
function updateDialogue(dt) {
	if ((dialogueTimer += dt) > 4e3) {
		game$1.dialogue.shift();
		dialogueTimer = 0;
		if (game$1.state === 0 && game$1.dialogue.length === 0) game$1.dialogue.push("                (Click to begin)");
	}
}
game$1.addRitual(Streak);
shop.rituals = [
	Bouncing,
	Ceiling,
	Rain,
	Doubleshot,
	Hunter,
	Weightless,
	Knockback,
	Drunkard,
	Seer,
	Tearstone,
	Impatience,
	Bleed,
	Salvage,
	Studious,
	Electrodynamics,
	Chilly,
	Giants,
	Avarice,
	Hardened,
	Allegiance
];
game$1.dialogue = INTRO_DIALOGUE;
init$1(game$1.stage.width, game$1.stage.height, update);
dust().burst(200);
//#endregion
