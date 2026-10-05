var Game = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/transformer.ts
	var transformToCenter = (ctx, rotation = 0, scaleX = 1, scaleY = 1) => {
		transformTo(ctx, 400, 300, rotation, scaleX, scaleY);
	};
	var transformTo = (ctx, x, y, rotation = 0, scaleX = 1, scaleY = 1) => {
		ctx.translate(x, y);
		ctx.rotate(rotation);
		ctx.scale(scaleX, scaleY);
		ctx.translate(-x, -y);
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/bg.ts
	var tartan = (ctx) => {
		ctx.save();
		transformToCenter(ctx, -Math.PI * .25, 1.5, 1.5);
		ctx.fillStyle = "#ffffff22";
		for (let i = 0; i < 5; i++) {
			ctx.fillRect(200 * i, 0, 100, 999);
			ctx.fillRect(200 * i - 70, 0, 5, 999);
			ctx.fillRect(200 * i - 35, 0, 5, 999);
			ctx.fillRect(200 * i + 50, 0, 5, 999);
		}
		ctx.save();
		transformToCenter(ctx, -Math.PI * .5);
		for (let i = 0; i < 5; i++) {
			ctx.fillRect(200 * i, 0, 100, 999);
			ctx.fillRect(200 * i - 70, 0, 5, 999);
			ctx.fillRect(200 * i - 35, 0, 5, 999);
			ctx.fillRect(200 * i + 50, 0, 5, 999);
		}
		ctx.restore();
		ctx.restore();
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/math.ts
	var clamp = (num, min, max) => {
		return Math.min(Math.max(num, min), max);
	};
	var clamp01 = (num) => {
		return clamp(num, 0, 1);
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/vector.ts
	var ZERO = {
		x: 0,
		y: 0
	};
	var normalize = (v) => {
		const magnitude = Math.sqrt(v.x * v.x + v.y * v.y);
		if (magnitude == 0) return ZERO;
		return {
			x: v.x / magnitude,
			y: v.y / magnitude
		};
	};
	var distance = (a, b) => {
		const dx = Math.abs(a.x - b.x);
		const dy = Math.abs(a.y - b.y);
		return Math.sqrt(dx * dx + dy * dy);
	};
	var lerp = (a, b, t) => {
		const ease = bounce(t);
		return {
			x: a.x + ease * (b.x - a.x),
			y: a.y + ease * (b.y - a.y)
		};
	};
	var bounce = (p) => {
		if (p < 4 / 11) return 121 * p * p / 16;
		else if (p < 8 / 11) return 363 / 40 * p * p - 99 / 10 * p + 17 / 5;
		else if (p < 9 / 10) return 4356 / 361 * p * p - 35442 / 1805 * p + 16061 / 1805;
		else return 54 / 5 * p * p - 513 / 25 * p + 268 / 25;
	};
	var offset = (v, x, y) => {
		return {
			x: v.x + x,
			y: v.y + y
		};
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/tween.ts
	var Tween = class {
		constructor(entity) {
			this.entity = entity;
			this.time = 0;
			this.type = "none";
		}
		scale(target, duration) {
			this.type = "scale";
			const p = this.entity.scale;
			this.start = {
				x: p.x,
				y: p.y
			};
			this.startTween(target, duration);
		}
		move(target, duration) {
			this.type = "move";
			const p = this.entity.p;
			this.start = {
				x: p.x,
				y: p.y
			};
			this.startTween(target, duration);
		}
		startTween(target, duration) {
			this.target = target;
			this.duration = duration * 1e3;
			this.active = true;
			this.startTime = -1;
		}
		update(tick) {
			if (this.startTime < 0 || this.type == "none") {
				this.startTime = tick;
				return;
			}
			if (!this.active) return;
			this.time = clamp01((tick - this.startTime) / this.duration);
			if (!this.start || !this.target) return;
			const p = lerp(this.start, this.target, this.time);
			if (this.type == "move") this.entity.p = {
				x: p.x,
				y: p.y
			};
			if (this.type == "scale") this.entity.scale = {
				x: p.x,
				y: p.y
			};
			this.active = this.time < 1;
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/entity.ts
	var Entity = class {
		constructor(x, y, width, height) {
			this.scale = {
				x: 1,
				y: 1
			};
			this.d = 0;
			this.p = {
				x,
				y
			};
			this.s = {
				x: width,
				y: height
			};
			this.tween = new Tween(this);
		}
		update(tick, mouse) {
			this.tween.update(tick);
		}
		draw(ctx) {}
		getCenter() {
			return {
				x: this.p.x + this.s.x * .5,
				y: this.p.y + this.s.y * .5
			};
		}
		setPosition(x, y) {
			this.p = {
				x,
				y
			};
		}
		isInside(point) {
			const c = this.getCenter();
			return point.x > c.x - this.s.x * .5 * this.scale.x && point.x < c.x + this.s.x * .5 * this.scale.x && point.y > c.y - this.s.y * .5 * this.scale.y && point.y < c.y + this.s.y * .5 * this.scale.y;
		}
	};
	var sortByDepth = (a, b) => a.d - b.d;
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/draggable.ts
	var Draggable = class extends Entity {
		constructor(..._args) {
			super(..._args);
			this.offset = {
				x: 0,
				y: 0
			};
		}
		update(tick, mouse) {
			super.update(tick, mouse);
			const wasHovered = this.hovered;
			this.hovered = !mouse.dragging && this.isInside(mouse);
			if (wasHovered && !this.hovered) this.exit();
			if (!wasHovered && this.hovered && (!this.locked || this.selectable)) this.hover();
			if (!mouse.pressing) {
				if (this.pressed && !mouse.dragging && this.hovered) this.click();
				this.pressed = false;
			}
			if (this.hovered && this.selectable && mouse.pressing && !this.pressed && !mouse.dragging) {
				this.pressed = true;
				return;
			}
			if (this.locked) return;
			if (this.hovered && mouse.pressing && !mouse.dragging && !this.dragging) {
				this.pick();
				this.start = {
					x: this.p.x,
					y: this.p.y
				};
				this.dragging = true;
				this.offset = offset(mouse, -this.p.x, -this.p.y);
				mouse.dragging = true;
				this.d = 100;
			}
			if (this.dragging) {
				this.p = offset(mouse, -this.offset.x, -this.offset.y);
				if (!mouse.pressing) {
					this.dragging = false;
					mouse.dragging = false;
					this.d = 0;
					this.drop();
				}
			}
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/drawing.ts
	var drawCircle = (ctx, pos, radius, color) => {
		drawEllipse(ctx, pos, radius, radius, color);
	};
	var drawEllipse = (ctx, pos, x, y, color) => {
		ctx.beginPath();
		ctx.fillStyle = color;
		ctx.ellipse(pos.x, pos.y, x, y, 0, 0, Math.PI * 2);
		ctx.fill();
	};
	var roundRect = (ctx, x, y, width, height, radius) => {
		ctx.beginPath();
		ctx.moveTo(x + radius, y);
		ctx.lineTo(x + width - radius, y);
		ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
		ctx.lineTo(x + width, y + height - radius);
		ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
		ctx.lineTo(x + radius, y + height);
		ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
		ctx.lineTo(x, y + radius);
		ctx.quadraticCurveTo(x, y, x + radius, y);
		ctx.closePath();
	};
	var drawColoredText = (ctx, content, x, y, baseColor, colors) => {
		const parts = content.split("|");
		let color = false;
		let pos = 0;
		let n = 0;
		parts.forEach((part) => {
			ctx.fillStyle = color ? colors[n] : baseColor;
			if (color) n = (n + 1) % colors.length;
			ctx.fillText(part, x + pos, y);
			color = !color;
			pos += ctx.measureText(part).width;
		});
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/particle.ts
	var Particle = class extends Entity {
		constructor(x, y, width, height, life, velocity) {
			super(x, y, width, height);
			this.life = life;
			this.velocity = velocity;
			this.ratio = 1;
			this.start = -1;
		}
		update(tick, mouse) {
			if (this.dead || this.life < 0) return;
			this.p = {
				x: this.p.x + this.velocity.x,
				y: this.p.y + this.velocity.y
			};
			this.ratio = 1 - (tick - this.start) / (this.life * 1e3);
			if (this.start < 0) this.start = tick;
			if (tick - this.start > this.life * 1e3) this.dead = true;
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/pulse.ts
	var Pulse = class extends Particle {
		constructor(x, y, radius, duration = 1, ringWidth = 0, alpha = 40) {
			super(x, y, radius, radius, (.3 + Math.random() * .1) * duration, ZERO);
			this.radius = radius;
			this.ringWidth = ringWidth;
			this.alpha = alpha;
		}
		draw(ctx) {
			const mod = Math.max(0, Math.min(1 - this.ratio, 1));
			const color = "#ffffff" + Math.round(mod * this.alpha).toString(16).padStart(2, "0");
			drawCircle(ctx, this.p, mod * this.radius, this.ringWidth > 0 ? "#ffffff00" : color);
			if (this.ringWidth > 0) {
				ctx.strokeStyle = color;
				ctx.lineWidth = this.ringWidth;
				ctx.stroke();
			}
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/random.ts
	var random = (min = 0, max = 1) => {
		return min + Math.random() * max;
	};
	var randomCell = (arr) => {
		return arr[Math.floor(Math.random() * arr.length)];
	};
	var randomSorter = () => Math.random() < .5 ? 1 : -1;
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/constants.ts
	var font = "Arial Black, HelveticaNeue-CondensedBlack, sans-serif";
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/text.ts
	var TextEntity = class extends Particle {
		constructor(content, fontSize, x, y, life, velocity, options) {
			super(x, y, 0, 0, life, velocity);
			this.content = content;
			this.fontSize = fontSize;
			this.options = options;
		}
		draw(ctx) {
			ctx.save();
			ctx.rotate(this.options?.angle ?? 0);
			const mod = this.options?.scales ? this.ratio : 1;
			ctx.font = `${this.fontSize * mod}px ${font}`;
			ctx.textAlign = this.options?.align ?? "center";
			if (this.options?.shadow) {
				ctx.fillStyle = "#000";
				ctx.fillText(this.content.replace(/\|/g, ""), this.p.x + this.options.shadow, this.p.y + this.options.shadow);
			}
			drawColoredText(ctx, this.content, this.p.x, this.p.y, this.options?.color ?? "#fff", this.options?.markColors ?? []);
			ctx.restore();
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/gem.ts
	var gems = [
		{
			type: "b",
			color: "#00BDE5",
			name: "FIBONACCI'S BOON",
			desc: "|Draw extra| card when |placed"
		},
		{
			type: "p",
			color: "#846AC1",
			name: "PENANCE",
			desc: "|Recycle |random card when |stepping| on"
		},
		{
			type: "r",
			color: "#E93988",
			name: "POPE'S BLESSING",
			desc: "|Heal| for one when |placed"
		},
		{
			type: "y",
			color: "#F3DC00",
			name: "INDULGENCE",
			desc: "|Score earned| for stepping on is |tenfold"
		},
		{
			type: "o",
			color: "#F89F00",
			name: "DYNASTY",
			desc: "|Doubles| move scores when |stepping| on"
		},
		{
			type: "g",
			color: "#B4D000",
			name: "KHAN'S LEGACY",
			desc: "Fill neighbours with |blank cards"
		}
	];
	var randomCard = (chance = 1, canHaveGem = true, dirs) => {
		const count = Math.random() < .1 ? 4 : 1 + Math.floor(Math.random() * 3);
		const directions = dirs ?? [
			"u",
			"r",
			"d",
			"l"
		].sort(() => Math.random() - .5).slice(0, count);
		const gemChance = directions.length == 1 ? .6 * chance : .2 * chance;
		return {
			directions,
			gem: canHaveGem && Math.random() < gemChance ? { ...randomCell(gems) } : null
		};
	};
	var Card = class extends Draggable {
		constructor(x, y, level, game, data) {
			super(x, y, 80, 60);
			this.level = level;
			this.game = game;
			this.data = data;
		}
		is(color) {
			return this.data.gem && [this.data.gem.type, ...this.game.getWilds(this.data.gem.type)].includes(color);
		}
		isLocked() {
			return this.locked;
		}
		makeSelectable() {
			this.lock();
			this.selectable = true;
		}
		update(tick, mouse) {
			super.update(tick, mouse);
			this.updateTile();
		}
		updateTile() {
			const sorted = [...this.level.board].filter((tile) => !tile.content && tile.accepts(this, this.level.board) && distance(this.p, tile.p) < 100).sort((a, b) => distance(this.p, a.p) - distance(this.p, b.p));
			const prev = this.tile;
			this.tile = sorted[0];
			if (this.tile && this.dragging) this.tile.hilite = true;
			if (prev && prev != this.tile) prev.hilite = false;
		}
		move(to, duration) {
			this.tween.move(to, duration);
		}
		getMoveTarget() {
			return this.game.pile.p;
		}
		getPossibleSpots() {
			return this.level.board.filter((tile) => !tile.content && tile.accepts(this, this.level.board));
		}
		click() {
			this.game.audio.pop();
			this.game.audio.swoosh();
			this.game.pick(this);
			this.game.tooltip.visible = false;
		}
		pick() {
			this.start = {
				x: this.p.x,
				y: this.p.y
			};
			this.game.clearSelect();
			this.game.audio.click();
			this.level.board.forEach((tile) => tile.marked = !tile.content && tile.accepts(this, this.level.board));
		}
		drop() {
			this.level.board.forEach((tile) => tile.marked = false);
			this.selected = false;
			this.game.audio.pong();
			this.level.board.filter((tile) => tile.content === this).forEach((tile) => tile.content = null);
			this.d = 100;
			setTimeout(() => this.d = 0, 100);
			if (this.game.picker.rewards > 0) {
				this.move(this.start, .1);
				return;
			}
			if (this.tile && !this.game.dude.isMoving) {
				this.game.multi = 1;
				this.locked = true;
				this.p = this.tile.p;
				this.tile.content = this;
				this.game.fill();
				this.game.findPath(this.tile, this.game);
				if (this.is("b")) {
					this.game.audio.discard();
					this.game.pull();
				}
				if (this.is("r")) this.game.heal(1);
				if (this.is("g")) {
					const neighbours = this.tile.getFreeNeighbours(this.level.board, true).filter((n) => !n.content);
					neighbours.forEach((n) => this.game.createBlank(n));
					if (neighbours.length > 0) {
						this.game.audio.open();
						this.game.audio.aja();
						this.pulse();
					}
				}
				this.tile = null;
				return;
			}
			this.move(this.start, .1);
		}
		exit() {
			if (this.data.gem) this.game.tooltip.visible = false;
		}
		hover() {
			if (this.data.gem) setTimeout(() => {
				this.game.tooltip.show(this.data.gem.name, this.data.gem.desc, offset(this.getCenter(), 0, -50 * this.scale.y), [this.data.gem.color]);
			}, 5);
			this.game.audio.thud();
		}
		draw(ctx) {
			ctx.save();
			const c = this.getCenter();
			transformTo(ctx, c.x, c.y, 0, this.scale.x, this.scale.y);
			if (this.hovered && this.selectable) ctx.translate(0, -10);
			if (this.dragging) {
				ctx.fillStyle = "#00000022";
				const center = {
					x: 400,
					y: 0
				};
				const p = {
					x: this.p.x + 2,
					y: this.p.y + 2
				};
				const dir = normalize({
					x: p.x - center.x,
					y: p.y - center.y
				});
				roundRect(ctx, p.x + dir.x * 12, p.y + dir.y * 24, this.s.x - 4, this.s.y - 4, 3);
				ctx.fill();
			}
			ctx.fillStyle = "#000";
			ctx.fillRect(this.p.x + 2, this.p.y + 2, this.s.x - 4, this.s.y - 4);
			ctx.fillStyle = this.hovered && (!this.locked || this.selectable) ? "#ffff66" : "#fff";
			if (this.visited) ctx.fillStyle = "#ffffaa";
			ctx.fillRect(this.p.x + 7 + 2, this.p.y + 7 + 2, this.s.x - 14 - 4, this.s.y - 14 - 4);
			if (this.data.directions.includes("u")) this.lineTo(ctx, this.p.x + this.s.x * .5, this.p.y + 7 + 2);
			if (this.data.directions.includes("r")) this.lineTo(ctx, this.p.x + this.s.x - 7 - 2, this.p.y + this.s.y * .5);
			if (this.data.directions.includes("d")) this.lineTo(ctx, this.p.x + this.s.x * .5, this.p.y + this.s.y - 7 - 2);
			if (this.data.directions.includes("l")) this.lineTo(ctx, this.p.x + 7 + 2, this.p.y + this.s.y * .5);
			const p = {
				x: this.p.x + this.s.x * .5,
				y: this.p.y + this.s.y * .5
			};
			if (this.data.directions.length > 0) drawCircle(ctx, p, 8, "#000");
			if (this.data.gem) {
				drawCircle(ctx, p, 12, "#000");
				drawCircle(ctx, p, 6, this.data.gem.color);
			}
			if (this.selected) {
				ctx.strokeStyle = "#fff";
				ctx.save();
				transformTo(ctx, c.x, c.y, 0, 2, 2.5);
				drawCorners(ctx, this.p.x, this.p.y, 4);
				ctx.restore();
			}
			ctx.restore();
		}
		lock() {
			this.d = -50;
			this.locked = true;
		}
		has(dir) {
			return this.data.directions && this.data.directions.includes(dir);
		}
		getConnections() {
			const index = this.level.board.find((tile) => tile.content === this).index;
			return this.data.directions.map((d) => {
				if (d == "u") return this.level.board.find((tile) => tile.index.x === index.x && tile.index.y === index.y - 1 && tile.content && tile.content.has("d"));
				if (d == "d") return this.level.board.find((tile) => tile.index.x === index.x && tile.index.y === index.y + 1 && tile.content && tile.content.has("u"));
				if (d == "l") return this.level.board.find((tile) => tile.index.x === index.x - 1 && tile.index.y === index.y && tile.content && tile.content.has("r"));
				if (d == "r") return this.level.board.find((tile) => tile.index.x === index.x + 1 && tile.index.y === index.y && tile.content && tile.content.has("l"));
			}).filter((tile) => tile && tile.content);
		}
		activate() {
			if (this.is("r") && this.game.healOnStep) this.game.heal(1);
			if (this.is("p")) {
				this.game.audio.discard();
				this.game.discard();
			}
			if (this.is("o")) this.triggerMulti();
			if (this.is("y")) this.game.audio.score();
		}
		triggerMulti() {
			this.game.audio.multi();
			this.game.multi *= 2;
			this.popText(`x${this.game.multi}`, {
				x: this.p.x + this.s.x * .5,
				y: this.p.y + this.s.y * .5 - 50
			}, "#F89F00");
		}
		pop(amt) {
			setTimeout(() => {
				this.game.camera.shake(3, .08);
				this.addScore(amt);
			}, .2);
		}
		addScore(amt) {
			const isYellow = this.is("y");
			const addition = this.getScore(amt);
			this.game.score += addition;
			const p = {
				x: this.p.x + this.s.x * .5,
				y: this.p.y + this.s.y * .5 - 20
			};
			this.pulse();
			this.popText(addition.toString(), p, isYellow ? "#F3DC00" : "#fff");
		}
		pulse() {
			const c = this.getCenter();
			this.game.effects.add(new Pulse(c.x, c.y, 40 + Math.random() * 30, 1, 10, 60));
		}
		popText(content, p, color) {
			this.game.effects.add(new TextEntity(content, 40 + Math.random() * 10, p.x, p.y, .5 + Math.random(), {
				x: 0,
				y: -1 - Math.random()
			}, {
				shadow: 4,
				scales: true,
				color,
				angle: random(-.1, .1)
			}));
		}
		lineTo(ctx, x, y) {
			ctx.beginPath();
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 7;
			ctx.moveTo(this.p.x + this.s.x * .5, this.p.y + this.s.y * .5);
			ctx.lineTo(x, y);
			ctx.stroke();
		}
		getScore(step) {
			return step * (this.is("y") ? 10 : 1) * this.game.multi * this.level.level;
		}
	};
	var drawCorners = (ctx, x, y, width = 4) => {
		ctx.lineWidth = width;
		ctx.lineDashOffset = 5;
		ctx.setLineDash([
			10,
			40,
			10,
			20,
			10,
			40,
			10,
			20
		]);
		ctx.strokeRect(x + 15, y + 15, 50, 30);
		ctx.setLineDash([]);
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/rect.ts
	var RectParticle = class extends Particle {
		constructor(x, y, width, height, life, velocity, options) {
			super(x, y, width, height, life, velocity);
			this.options = options;
			if (this.options?.depth) this.d = this.options.depth;
		}
		update(tick, mouse) {
			if (this.options?.force) this.velocity = {
				x: this.velocity.x + this.options.force.x,
				y: this.velocity.y + this.options.force.y
			};
			super.update(tick, mouse);
		}
		draw(ctx) {
			ctx.fillStyle = this.options?.color ?? "#fff";
			ctx.fillRect(this.p.x - this.s.x * .5, this.p.y - this.s.y * .5, this.s.x, this.s.y);
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/dude.ts
	var Dude = class extends Entity {
		constructor(tile) {
			const p = tile.p;
			super(p.x, p.y, 80, 60);
			this.tile = tile;
			this.path = [];
			this.phase = 0;
			this.d = 50;
		}
		reset(tile) {
			const p = tile.p;
			this.tile = tile;
			this.p = {
				x: p.x,
				y: p.y
			};
		}
		update(tick, mouse) {
			this.tween.update(tick);
			this.phase = Math.abs(Math.sin(tick * .005));
		}
		draw(ctx) {
			const center = {
				x: this.p.x + this.s.x * .5,
				y: this.p.y + this.s.y * .5
			};
			const head = {
				x: this.p.x + this.s.x * .5,
				y: this.p.y + this.s.y * .5 - 30 - 5 * this.phase
			};
			ctx.save();
			const height = Math.sin(-this.tween.time * Math.PI);
			drawEllipse(ctx, center, 24 + height * 8, 12 + height * 4, "#00000033");
			ctx.translate(0, height * 25);
			drawCircle(ctx, head, 14, "#000");
			ctx.strokeStyle = "#000";
			ctx.lineWidth = 5;
			ctx.fillStyle = "#fff";
			ctx.beginPath();
			ctx.moveTo(center.x, this.p.y - 10 - 5 * this.phase);
			ctx.lineTo(center.x + 14, this.p.y + 32);
			ctx.quadraticCurveTo(center.x, this.p.y + 40, center.x - 14, this.p.y + 32);
			ctx.lineTo(center.x - 14, this.p.y + 32);
			ctx.lineTo(center.x, this.p.y - 1 - 5 * this.phase);
			ctx.fill();
			ctx.stroke();
			drawCircle(ctx, head, 9, "#fff");
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(head.x, head.y + 5);
			ctx.lineTo(head.x, head.y - 10);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(head.x - 4, head.y - 2 * this.phase);
			ctx.lineTo(head.x + 4, head.y - 2 * this.phase);
			ctx.stroke();
			ctx.restore();
		}
		hop(game) {
			this.tween.move(this.p, .3);
			this.dust(game);
		}
		dust(game) {
			game.audio.move();
			const p = this.getCenter();
			for (let i = 0; i < 10; i++) {
				const size = 1 + Math.random() * 3;
				const opts = {
					force: {
						x: 0,
						y: .1
					},
					depth: 20,
					color: "#5b7c5b44"
				};
				const v = {
					x: -2 + Math.random() * 4,
					y: -4 * Math.random()
				};
				game.effects.add(new RectParticle(p.x, p.y, size, size, .2 + Math.random() * .5, v, opts));
			}
		}
		findPath(to, game, level) {
			this.path = [];
			this.findNext(this.tile, to, [this.tile], game.freeMoveOn);
			this.tile = this.path[this.path.length - 1];
			this.isMoving = true;
			const moveDuration = .3;
			this.path.forEach((tile, index) => {
				setTimeout(() => {
					tile.content.visited = true;
					if (index > 0) {
						this.tween.move(tile.p, moveDuration);
						setTimeout(() => this.dust(game), moveDuration * .25);
						tile.content.activate();
						tile.content.pop(index * game.stepScore);
						game.loot(tile);
						if (game.remoteMulti) tile.getNeighbours(level.board).filter((t) => t.content && t.content.is("o")).forEach((n) => n.content.activate());
					}
				}, index * moveDuration * 1e3);
			});
			setTimeout(() => {
				this.path.forEach((p) => p.content.visited = false);
				this.isMoving = false;
			}, (this.path.length + 1) * moveDuration * 1e3);
			setTimeout(() => game.checkLevelEnd(), this.path.length * moveDuration * 1e3 + 600);
		}
		findNext(from, to, visited, free) {
			const steps = from.content.getConnections().filter((tile) => !visited.includes(tile) || free.some((f) => tile.content.is(f)) && visited.filter((t) => t == tile).length < 5);
			if (from == to) {
				if (this.evaluate(this.path) < this.evaluate(visited)) this.path = [...visited];
				return;
			}
			steps.forEach((step) => this.findNext(step, to, [...visited, step], free));
		}
		evaluate(path) {
			let multi = 1;
			let total = 0;
			path.forEach((tile, i) => {
				if (tile.content.is("o")) multi *= 2;
				total += tile.content.getScore((i + 1) * multi);
			});
			return total;
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/song.ts
	var song = {
		songData: [
			{
				i: [
					0,
					255,
					116,
					79,
					0,
					255,
					116,
					0,
					83,
					0,
					4,
					6,
					69,
					52,
					0,
					0,
					0,
					0,
					0,
					0,
					2,
					21,
					0,
					0,
					50,
					0,
					0,
					0,
					0
				],
				p: [
					1,
					2,
					1,
					1,
					1,
					2,
					1,
					2
				],
				c: [{
					n: [
						147,
						,
						,
						,
						,
						147,
						,
						147,
						,
						,
						147,
						,
						,
						,
						,
						147,
						147,
						,
						,
						,
						,
						147,
						,
						147,
						,
						,
						147,
						,
						,
						,
						,
						147
					],
					f: []
				}, {
					n: [
						147,
						,
						,
						,
						,
						147,
						,
						147,
						,
						,
						147,
						,
						,
						,
						,
						147,
						147,
						,
						,
						,
						,
						147,
						,
						147,
						,
						,
						147
					],
					f: []
				}]
			},
			{
				i: [
					0,
					0,
					140,
					0,
					0,
					0,
					140,
					0,
					0,
					50,
					4,
					10,
					47,
					55,
					0,
					0,
					0,
					187,
					5,
					0,
					1,
					239,
					135,
					0,
					32,
					108,
					5,
					16,
					4
				],
				p: [
					3,
					4,
					2,
					2,
					1,
					5,
					1,
					5,
					3,
					4
				],
				c: [
					{
						n: [
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147
						],
						f: []
					},
					{
						n: [
							147,
							,
							147,
							147,
							147,
							,
							147,
							147,
							147,
							,
							147,
							,
							147,
							147,
							,
							147,
							147,
							,
							147,
							147,
							147,
							,
							147,
							147,
							147,
							,
							147,
							,
							147,
							147,
							,
							147
						],
						f: []
					},
					{
						n: [
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147
						],
						f: []
					},
					{
						n: [
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147,
							,
							147
						],
						f: []
					},
					{
						n: [
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147,
							147
						],
						f: []
					}
				]
			},
			{
				i: [
					0,
					160,
					128,
					64,
					0,
					160,
					128,
					0,
					64,
					210,
					4,
					7,
					52,
					85,
					0,
					0,
					0,
					60,
					4,
					1,
					2,
					255,
					0,
					0,
					32,
					61,
					5,
					32,
					6
				],
				p: [
					1,
					1,
					1,
					1,
					1,
					1,
					1,
					1
				],
				c: [{
					n: [
						,
						,
						,
						,
						147,
						,
						,
						,
						,
						,
						,
						,
						147,
						,
						,
						,
						,
						,
						,
						,
						147,
						,
						,
						,
						,
						,
						,
						,
						147
					],
					f: []
				}]
			},
			{
				i: [
					2,
					127,
					128,
					0,
					3,
					201,
					128,
					0,
					0,
					0,
					0,
					6,
					29,
					0,
					0,
					0,
					0,
					195,
					4,
					1,
					3,
					50,
					184,
					119,
					244,
					147,
					6,
					84,
					6
				],
				p: [
					1,
					2,
					1,
					2,
					1,
					2,
					1,
					2
				],
				c: [{
					n: [
						111,
						,
						111,
						,
						111,
						,
						,
						111,
						111,
						,
						,
						,
						111,
						,
						,
						,
						111,
						,
						111,
						,
						111,
						,
						,
						111,
						111,
						,
						,
						,
						111,
						,
						110,
						109
					],
					f: []
				}, {
					n: [
						111,
						,
						111,
						,
						111,
						,
						,
						111,
						111,
						,
						,
						,
						111,
						,
						,
						,
						111,
						,
						111,
						,
						111,
						,
						,
						111,
						111,
						,
						,
						,
						111
					],
					f: []
				}]
			},
			{
				i: [
					3,
					192,
					116,
					0,
					3,
					192,
					128,
					0,
					0,
					0,
					7,
					12,
					22,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					2,
					255,
					0,
					0,
					32,
					61,
					3,
					29,
					4
				],
				p: [
					1,
					2,
					3,
					4,
					3,
					4,
					1,
					2,
					3,
					4
				],
				c: [
					{
						n: [
							135,
							138,
							142,
							147,
							150,
							154,
							150,
							147,
							135,
							138,
							142,
							147,
							150,
							154,
							150,
							123,
							130,
							133,
							137,
							142,
							145,
							149,
							145,
							142,
							130,
							133,
							137,
							142,
							145,
							149,
							145,
							142
						],
						f: []
					},
					{
						n: [
							131,
							134,
							138,
							143,
							146,
							150,
							146,
							143,
							131,
							134,
							138,
							143,
							146,
							150,
							146,
							143,
							133,
							136,
							140,
							145,
							148,
							152,
							148,
							145,
							133,
							136,
							140,
							145,
							148,
							152,
							148,
							145
						],
						f: []
					},
					{
						n: [
							142,
							,
							147,
							154,
							149,
							154,
							159,
							161,
							150,
							,
							162,
							,
							150,
							,
							159,
							,
							142,
							,
							142,
							,
							149,
							157,
							154,
							157,
							154,
							,
							159,
							,
							161,
							,
							154,
							,
							162,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							159,
							,
							,
							161
						],
						f: []
					},
					{
						n: [
							155,
							149,
							143,
							162,
							159,
							155,
							157,
							149,
							155,
							159,
							162,
							,
							159,
							,
							157,
							,
							143,
							,
							147,
							,
							147,
							152,
							162,
							159,
							142,
							158,
							149,
							154,
							158,
							154,
							161,
							,
							161,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							155,
							,
							152
						],
						f: []
					}
				]
			},
			{
				i: [
					3,
					255,
					128,
					0,
					1,
					154,
					128,
					9,
					0,
					0,
					7,
					5,
					52,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					1,
					0,
					0,
					0,
					32,
					47,
					3,
					13,
					2
				],
				p: [
					,
					,
					,
					,
					1,
					2,
					3,
					4
				],
				c: [
					{
						n: [
							114,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							114,
							,
							113,
							,
							111,
							,
							106,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							109,
							,
							106,
							,
							106
						],
						f: []
					},
					{
						n: [
							102,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							107,
							,
							102,
							,
							99,
							,
							104,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							109,
							,
							104,
							,
							101
						],
						f: [10]
					},
					{
						n: [
							114,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							114,
							,
							109,
							,
							106,
							,
							104,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							109,
							,
							106,
							,
							104
						],
						f: []
					},
					{
						n: [
							102,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							107,
							,
							102,
							,
							99,
							,
							104,
							,
							,
							,
							,
							,
							,
							,
							,
							,
							106,
							,
							106,
							,
							106
						],
						f: []
					}
				]
			},
			{
				i: [
					0,
					255,
					152,
					0,
					3,
					255,
					152,
					12,
					0,
					0,
					9,
					0,
					19,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					2,
					59,
					0,
					0,
					32,
					47,
					1,
					57,
					1
				],
				p: [
					,
					,
					,
					,
					,
					,
					,
					,
					1,
					2
				],
				c: [{
					n: [
						126,
						,
						,
						,
						,
						,
						126,
						,
						130,
						,
						,
						,
						126,
						,
						,
						,
						125,
						,
						,
						,
						,
						,
						,
						,
						130,
						,
						,
						,
						125
					],
					f: []
				}, {
					n: [
						125,
						,
						,
						,
						,
						,
						126,
						,
						123,
						,
						,
						,
						,
						,
						,
						,
						123,
						,
						,
						,
						,
						,
						,
						,
						122,
						,
						,
						,
						125
					],
					f: []
				}]
			}
		],
		rowLen: 7350,
		patternLen: 32,
		endPattern: 9,
		numChannels: 7
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/audio-player.ts
	var CPlayer = function() {
		var osc_sin = function(value) {
			return Math.sin(value * 6.283184);
		};
		var osc_saw = function(value) {
			return 2 * (value % 1) - 1;
		};
		var osc_square = function(value) {
			return value % 1 < .5 ? 1 : -1;
		};
		var osc_tri = function(value) {
			var v2 = value % 1 * 4;
			if (v2 < 2) return v2 - 1;
			return 3 - v2;
		};
		var getnotefreq = function(n) {
			return .003959503758 * 2 ** ((n - 128) / 12);
		};
		var createNote = function(instr, n, rowLen) {
			var osc1 = mOscillators[instr.i[0]], o1vol = instr.i[1], o1xenv = instr.i[3] / 32, osc2 = mOscillators[instr.i[4]], o2vol = instr.i[5], o2xenv = instr.i[8] / 32, noiseVol = instr.i[9], attack = instr.i[10] * instr.i[10] * 4, sustain = instr.i[11] * instr.i[11] * 4, release = instr.i[12] * instr.i[12] * 4, releaseInv = 1 / release, expDecay = -instr.i[13] / 16, arp = instr.i[14];
			rowLen * 2 ** (2 - instr.i[15]);
			var noteBuf = new Int32Array(attack + sustain + release);
			var c1 = 0, c2 = 0, j, j2, e, rsample, o1t, o2t;
			for (j = 0, j2 = 0; j < attack + sustain + release; j++, j2++) {
				if (j2 >= 0) {
					o1t = getnotefreq(n + (arp & 15) + instr.i[2] - 128);
					o2t = getnotefreq(n + (arp & 15) + instr.i[6] - 128) * (1 + 8e-4 * instr.i[7]);
				}
				e = 1;
				if (j < attack) e = j / attack;
				else if (j >= attack + sustain) {
					e = (j - attack - sustain) * releaseInv;
					e = (1 - e) * 3 ** (expDecay * e);
				}
				c1 += o1t * e ** o1xenv;
				rsample = osc1(c1) * o1vol;
				c2 += o2t * e ** o2xenv;
				rsample += osc2(c2) * o2vol;
				if (noiseVol) rsample += (2 * Math.random() - 1) * noiseVol;
				noteBuf[j] = 80 * rsample * e | 0;
			}
			return noteBuf;
		};
		var mOscillators = [
			osc_sin,
			osc_square,
			osc_saw,
			osc_tri
		];
		var mSong, mLastRow, mCurrentCol, mNumWords, mMixBuf;
		this.init = function(song) {
			mSong = song;
			mLastRow = song.endPattern;
			mCurrentCol = 0;
			mNumWords = song.rowLen * song.patternLen * (mLastRow + 1) * 2;
			mMixBuf = new Int32Array(mNumWords);
		};
		this.generate = function() {
			var i, j, p, row, col, n, cp, k, t, rsample, rowStartSample, f;
			var chnBuf = new Int32Array(mNumWords), instr = mSong.songData[mCurrentCol], rowLen = mSong.rowLen, patternLen = mSong.patternLen;
			var low = 0, band = 0, high;
			var lsample, filterActive = false;
			var noteCache = [];
			for (p = 0; p <= mLastRow; ++p) {
				cp = instr.p[p];
				for (row = 0; row < patternLen; ++row) {
					var oscLFO = mOscillators[instr.i[16]], lfoAmt = instr.i[17] / 512, lfoFreq = 2 ** (instr.i[18] - 9) / rowLen, fxLFO = instr.i[19], fxFilter = instr.i[20], fxFreq = instr.i[21] * 43.23529 * 3.141592 / 44100, q = 1 - instr.i[22] / 255, dist = instr.i[23] * 1e-5, drive = instr.i[24] / 32, panAmt = instr.i[25] / 512, panFreq = 6.283184 * 2 ** (instr.i[26] - 9) / rowLen, dlyAmt = instr.i[27] / 255, dly = instr.i[28] * rowLen & -2;
					rowStartSample = (p * patternLen + row) * rowLen;
					for (col = 0; col < 4; ++col) {
						n = cp ? instr.c[cp - 1].n[row + col * patternLen] : 0;
						if (n) {
							if (!noteCache[n]) noteCache[n] = createNote(instr, n, rowLen);
							var noteBuf = noteCache[n];
							for (j = 0, i = rowStartSample * 2; j < noteBuf.length; j++, i += 2) chnBuf[i] += noteBuf[j];
						}
					}
					for (j = 0; j < rowLen; j++) {
						k = (rowStartSample + j) * 2;
						rsample = chnBuf[k];
						if (rsample || filterActive) {
							f = fxFreq;
							if (fxLFO) f *= oscLFO(lfoFreq * k) * lfoAmt + .5;
							f = 1.5 * Math.sin(f);
							low += f * band;
							high = q * (rsample - band) - low;
							band += f * high;
							rsample = fxFilter == 3 ? band : fxFilter == 1 ? high : low;
							if (dist) {
								rsample *= dist;
								rsample = rsample < 1 ? rsample > -1 ? osc_sin(rsample * .25) : -1 : 1;
								rsample /= dist;
							}
							rsample *= drive;
							filterActive = rsample * rsample > 1e-5;
							t = Math.sin(panFreq * k) * panAmt + .5;
							lsample = rsample * (1 - t);
							rsample *= t;
						} else lsample = 0;
						if (k >= dly) {
							lsample += chnBuf[k - dly + 1] * dlyAmt;
							rsample += chnBuf[k - dly] * dlyAmt;
						}
						chnBuf[k] = lsample | 0;
						chnBuf[k + 1] = rsample | 0;
						mMixBuf[k] += lsample | 0;
						mMixBuf[k + 1] += rsample | 0;
					}
				}
			}
			mCurrentCol++;
			return mCurrentCol / mSong.numChannels;
		};
		this.createAudioBuffer = function(context) {
			var buffer = context.createBuffer(2, mNumWords / 2, 44100);
			for (var i = 0; i < 2; i++) {
				var data = buffer.getChannelData(i);
				for (var j = i; j < mNumWords; j += 2) data[j >> 1] = mMixBuf[j] / 65536;
			}
			return buffer;
		};
		this.createWave = function() {
			var headerLen = 44;
			var l1 = headerLen + mNumWords * 2 - 8;
			var l2 = l1 - 36;
			var wave = new Uint8Array(headerLen + mNumWords * 2);
			wave.set([
				82,
				73,
				70,
				70,
				l1 & 255,
				l1 >> 8 & 255,
				l1 >> 16 & 255,
				l1 >> 24 & 255,
				87,
				65,
				86,
				69,
				102,
				109,
				116,
				32,
				16,
				0,
				0,
				0,
				1,
				0,
				2,
				0,
				68,
				172,
				0,
				0,
				16,
				177,
				2,
				0,
				4,
				0,
				16,
				0,
				100,
				97,
				116,
				97,
				l2 & 255,
				l2 >> 8 & 255,
				l2 >> 16 & 255,
				l2 >> 24 & 255
			]);
			for (var i = 0, idx = headerLen; i < mNumWords; ++i) {
				var y = mMixBuf[i];
				y = y < -32767 ? -32767 : y > 32767 ? 32767 : y;
				wave[idx++] = y & 255;
				wave[idx++] = y >> 8 & 255;
			}
			return wave;
		};
		this.getData = function(t, n) {
			var i = 2 * Math.floor(t * 44100);
			var d = new Array(n);
			for (var j = 0; j < 2 * n; j += 1) {
				var k = i + j;
				d[j] = t > 0 && k < mMixBuf.length ? mMixBuf[k] / 32768 : 0;
			}
			return d;
		};
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/zzfx.ts
	function zzfx(...parameters) {
		return ZZFX.play(...parameters);
	}
	var ZZFX = {
		volume: .3,
		sampleRate: 44100,
		x: new AudioContext(),
		play: function(...parameters) {
			return this.playSamples(this.buildSamples(...parameters));
		},
		playSamples: function(...samples) {
			const buffer = this.x.createBuffer(samples.length, samples[0].length, this.sampleRate), source = this.x.createBufferSource();
			samples.map((d, i) => buffer.getChannelData(i).set(d));
			source.buffer = buffer;
			source.connect(this.x.destination);
			source.start();
			return source;
		},
		buildSamples: function(volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0, release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0, pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0, bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0) {
			let PI2 = Math.PI * 2, sampleRate = this.sampleRate, sign = (v) => v > 0 ? 1 : -1, startSlide = slide *= 500 * PI2 / sampleRate / sampleRate, startFrequency = frequency *= (1 + randomness * 2 * Math.random() - randomness) * PI2 / sampleRate, b = [], t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0, f, length;
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
					s = (repeatTime ? 1 - tremolo + tremolo * Math.sin(PI2 * i / repeatTime) : 1) * sign(s) * Math.abs(s) ** shapeCurve * volume * this.volume * (i < attack ? i / attack : i < attack + decay ? 1 - (i - attack) / decay * (1 - sustainVolume) : i < attack + decay + sustain ? sustainVolume : i < length - delay ? (length - i - delay) / release * sustainVolume : 0);
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
					j ||= 1;
				}
			}
			return b;
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/audio.ts
	var AudioManager = class {
		constructor() {
			this.started = false;
		}
		prepare() {
			if (this.started) return;
			this.audio = document.createElement("audio");
			this.started = true;
			const player = new CPlayer();
			player.init(song);
			player.generate();
			this.loaded = false;
			const timer = setInterval(() => {
				if (this.loaded) return;
				this.loaded = player.generate() >= 1;
				if (this.loaded) {
					var wave = player.createWave();
					this.audio.src = URL.createObjectURL(new Blob([wave], { type: "audio/wav" }));
					this.audio.loop = true;
					clearInterval(timer);
				}
			}, 5);
		}
		play() {
			const timer = setInterval(() => {
				if (!this.loaded) return;
				this.audio.play();
				clearInterval(timer);
			}, 5);
		}
		deadEnd() {
			zzfx(...[
				1.5,
				,
				157,
				.16,
				,
				0,
				,
				.35,
				-24,
				28,
				,
				,
				,
				.1,
				,
				.6,
				,
				.19,
				.01
			]);
		}
		move() {
			zzfx(...[
				,
				,
				759,
				.01,
				,
				.01,
				1,
				.97,
				15,
				,
				,
				,
				,
				,
				3.1,
				,
				,
				.76,
				.04
			]);
		}
		chest() {
			zzfx(...[
				.5,
				,
				392,
				.06,
				.22,
				.5,
				1,
				1.85,
				-.1,
				-.9,
				61,
				.05,
				.07,
				,
				,
				.1,
				,
				.96,
				.12
			]);
		}
		win() {
			zzfx(...[
				.5,
				,
				146,
				.04,
				.23,
				.46,
				,
				.56,
				,
				-3.7,
				658,
				.02,
				.15,
				.1,
				,
				,
				,
				.82,
				.13,
				.2
			]);
		}
		explode() {
			zzfx(...[
				1.5,
				,
				785,
				.01,
				.1,
				.54,
				4,
				2.66,
				,
				,
				,
				,
				,
				.9,
				,
				.5,
				.38,
				.34,
				.11,
				.14
			]);
		}
		open() {
			zzfx(...[
				.4,
				,
				22,
				.08,
				.22,
				.02,
				1,
				.52,
				-4.2,
				-9.8,
				,
				,
				.14,
				,
				-18,
				.2,
				,
				,
				.05
			]);
		}
		lose() {
			zzfx(...[
				1.5,
				,
				430,
				.02,
				.12,
				.5,
				,
				.89,
				,
				-3.6,
				-133,
				.07,
				.13,
				,
				,
				.1,
				,
				.83,
				.23,
				.26
			]);
		}
		frog() {
			zzfx(...[
				.5,
				,
				160,
				.03,
				.03,
				.02,
				,
				1.52,
				-23,
				93,
				662,
				.02,
				,
				,
				,
				.1,
				,
				,
				.07,
				.01
			]);
		}
		thud() {
			zzfx(...[
				.7,
				,
				1305,
				,
				,
				.03,
				1,
				.75,
				,
				23,
				694,
				.01,
				,
				,
				3.9,
				,
				,
				,
				.01
			]);
		}
		click() {
			zzfx(...[
				,
				,
				158,
				.09,
				.18,
				.03,
				,
				2.53,
				11,
				-58,
				63,
				.02,
				.01,
				.5,
				,
				,
				,
				.16
			]);
		}
		aja() {
			zzfx(...[
				.7,
				,
				1496,
				.09,
				.09,
				.01,
				3,
				.14,
				,
				,
				-870,
				,
				,
				,
				3.2,
				.2,
				,
				.31,
				.02
			]);
		}
		pop() {
			zzfx(...[
				.5,
				,
				1368,
				.09,
				,
				0,
				,
				1.11,
				-76,
				9.1,
				-490,
				,
				,
				,
				,
				,
				,
				.56
			]);
		}
		pong() {
			zzfx(...[
				6,
				,
				205,
				,
				.02,
				0,
				,
				1.03,
				,
				,
				,
				,
				,
				,
				,
				,
				.12,
				.32
			]);
		}
		swoosh() {
			zzfx(...[
				.1,
				,
				836,
				.11,
				,
				0,
				4,
				.91,
				13,
				,
				,
				,
				.09,
				.1,
				-39,
				,
				,
				.06,
				.07
			]);
		}
		multi() {
			zzfx(...[
				,
				,
				341,
				,
				.14,
				.23,
				1,
				1.01,
				.9,
				,
				-132,
				.03,
				,
				.1,
				,
				.1,
				,
				.52,
				.22
			]);
		}
		score() {
			zzfx(...[
				,
				,
				103,
				.04,
				.11,
				.43,
				1,
				.77,
				,
				,
				57,
				.19,
				.05,
				,
				,
				.1,
				,
				.68,
				.24
			]);
		}
		discard() {
			zzfx(...[
				.5,
				,
				426,
				.01,
				,
				.05,
				,
				2.54,
				49,
				,
				9,
				.1,
				,
				,
				,
				,
				,
				.46,
				.15
			]);
		}
		heal() {
			zzfx(...[
				,
				,
				193,
				.04,
				.27,
				.42,
				1,
				1.71,
				2.8,
				4.9,
				,
				,
				.1,
				.2,
				,
				.1,
				,
				.55,
				.27,
				.47
			]);
		}
		boom() {
			zzfx(...[
				,
				,
				922,
				.03,
				.03,
				.33,
				4,
				1.88,
				.5,
				.4,
				,
				,
				,
				.9,
				,
				.2,
				,
				.45,
				.05
			]);
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/button.ts
	var BORDER_THICKNESS = 7;
	var ButtonEntity = class extends Entity {
		constructor(content, x, y, width, height, onClick, audio) {
			super(x - width * .5, y - height * .5, width, height);
			this.content = content;
			this.onClick = onClick;
			this.audio = audio;
			this.visible = true;
		}
		update(tick, mouse) {
			if (!this.visible) return;
			const wasHovered = this.hovered;
			this.hovered = !mouse.dragging && this.isInside(mouse);
			if (!wasHovered && this.hovered) this.hover();
			if (!mouse.pressing) {
				if (this.pressed && !mouse.dragging && this.hovered) {
					this.audio.pop();
					this.onClick();
				}
				this.pressed = false;
			}
			if (this.hovered && mouse.pressing && !this.pressed && !mouse.dragging) {
				this.pressed = true;
				return;
			}
		}
		draw(ctx) {
			if (!this.visible) return;
			ctx.save();
			ctx.translate(0, this.hovered ? -5 : 0);
			ctx.fillStyle = "#000";
			ctx.fillRect(this.p.x, this.p.y, this.s.x, this.s.y);
			ctx.fillStyle = this.hovered ? "#ffff77" : "#fff";
			ctx.fillRect(this.p.x + BORDER_THICKNESS, this.p.y + BORDER_THICKNESS, this.s.x - 14, this.s.y - 14);
			ctx.font = `30px ${font}`;
			ctx.textAlign = "center";
			ctx.fillStyle = "#000";
			ctx.fillText(this.content, this.p.x + this.s.x * .5, this.p.y + this.s.y * .5 + 10);
			ctx.restore();
		}
		hover() {
			this.audio.thud();
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/camera.ts
	var Camera = class {
		constructor() {
			this.offset = ZERO;
			this.shakeStrength = 0;
			this.shakeRotation = 0;
		}
		shake(amount, duration, rotation = 0) {
			this.shakeStrength = amount;
			this.shakeRotation = rotation / 360 * Math.PI;
			setTimeout(() => this.reset(), duration * 1e3);
		}
		update() {
			this.offset = {
				x: random(-this.shakeStrength, this.shakeStrength),
				y: random(-this.shakeStrength, this.shakeStrength)
			};
			this.rotation = random(-this.shakeRotation, this.shakeRotation);
		}
		reset() {
			this.shakeStrength = 0;
			this.shakeRotation = 0;
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/container.ts
	var Container = class extends Entity {
		constructor(x = 0, y = 0, entities = []) {
			super(x, y, 0, 0);
			this.children = [];
			this.children.push(...entities);
		}
		update(tick, mouse) {
			super.update(tick, mouse);
			this.children.forEach((c) => c.update(tick, mouse));
			if (this.children.some((c) => c.dead)) this.children = this.children.filter((c) => !c.dead);
		}
		hide(duration = .3) {
			this.tween.scale({
				x: 0,
				y: 0
			}, duration);
		}
		show(duration = .3) {
			this.tween.scale({
				x: 1,
				y: 1
			}, duration);
		}
		draw(ctx) {
			ctx.save();
			const p = this.p;
			transformTo(ctx, p.x, p.y, 0, this.scale.x, this.scale.y);
			this.children.forEach((c) => c.draw(ctx));
			ctx.restore();
		}
		getChild(index) {
			return this.children[index];
		}
		getChildren() {
			return this.children;
		}
		add(entity) {
			this.children.push(entity);
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/end.ts
	var GameOver = class extends Entity {
		constructor(game) {
			super(0, 0, 0, 0);
			this.gameOver = new TextEntity("SIEGE ENDED!", 90, 400, 280, -1, ZERO, {
				shadow: 8,
				align: "center"
			});
			this.again = new ButtonEntity("TRY AGAIN?", 400, 390, 300, 75, () => game.restart(), game.audio);
			this.scale = {
				x: 1,
				y: 0
			};
		}
		click(x, y, game) {
			if (this.again.isInside({
				x,
				y
			})) game.restart();
		}
		toggle(state) {
			const delay = state ? .3 : .1;
			this.tween.scale({
				x: 1,
				y: state ? 1 : 0
			}, delay);
			setTimeout(() => this.visible = state, delay * 1e3);
		}
		update(tick, mouse) {
			this.tween.update(tick);
			if (this.visible) this.again.update(tick, mouse);
		}
		draw(ctx) {
			ctx.save();
			transformToCenter(ctx, 0, this.scale.x, this.scale.y);
			ctx.fillStyle = "#000000bb";
			ctx.fillRect(-100, 120, 1e3, 360);
			this.gameOver.draw(ctx);
			this.again.draw(ctx);
			ctx.restore();
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/blinders.ts
	var Blinders = class extends Entity {
		constructor() {
			super(0, 0, 0, 0);
			this.d = 500;
			this.open();
		}
		open(after = () => {}) {
			this.tween.scale({
				x: 0,
				y: 0
			}, .5);
			setTimeout(after, 500);
		}
		close(after = () => {}) {
			this.tween.scale({
				x: 1,
				y: 1
			}, .4);
			setTimeout(after, 500);
		}
		draw(ctx) {
			ctx.fillStyle = "#000";
			ctx.fillRect(0, 0, 800 * this.scale.x, 600);
			ctx.fillRect(800 - 800 * this.scale.x, 0, 800 * this.scale.x, 600);
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/engine/line.ts
	var LineParticle = class extends Particle {
		constructor(from, to, life, width, color, midOffset = 0) {
			super(0, 0, 0, 0, life, ZERO);
			this.from = from;
			this.to = to;
			this.width = width;
			this.color = color;
			this.midOffset = midOffset;
			this.direction = Math.random() < .5 ? 1 : -1;
			this.half = .25 + Math.random() * .5;
		}
		draw(ctx) {
			ctx.beginPath();
			ctx.lineWidth = this.width * this.ratio;
			ctx.strokeStyle = this.color;
			ctx.moveTo(this.from.x, this.from.y);
			if (this.midOffset) {
				const mid = {
					x: this.from.x * this.half + this.to.x * (1 - this.half),
					y: this.from.y * this.half + this.to.y * (1 - this.half)
				};
				const m1 = offset(mid, this.midOffset * this.direction, 0);
				const m2 = offset(mid, -this.midOffset * this.direction, 0);
				ctx.lineTo(m1.x, m1.y);
				ctx.lineTo(m2.x, m2.y);
			}
			ctx.lineTo(this.to.x, this.to.y);
			ctx.stroke();
		}
	};
	var relics = [
		{
			name: "SAINTHOOD",
			description: "Increase your |LIFE| by |2",
			color: "#E93988",
			bg: "ಎ",
			offset: -3,
			repeatable: true,
			pickup: (g) => g.boost(2)
		},
		{
			name: "MAGNA CARTA",
			description: "Increase your |MAX HAND SIZE| by |1",
			color: "#00BDE5",
			bg: "ಃ",
			offset: -3,
			repeatable: true,
			pickup: (g) => g.handSize++
		},
		{
			name: "SACRAMENT",
			description: "Increases the presented |reward options",
			color: "#F89F00",
			bg: "ಐ",
			offset: -2,
			repeatable: true,
			pickup: (g) => g.rewardOptions++
		},
		{
			name: "MIRACLE",
			description: "Allows you to pick an |extra| reward",
			color: "#F89F00",
			bg: "ಠ",
			pickup: (g) => g.rewardPicks++
		},
		{
			name: "CAVALRY",
			description: "Your |empty cards| can open chests",
			color: "#B4D000",
			bg: "ು",
			offset: -3,
			pickup: (g) => g.canRemoteOpen = true
		},
		{
			name: "FAITH",
			description: "Stepping on |RED| also |HEALS",
			color: "#E93988",
			bg: "ಏ",
			offset: -2,
			pickup: (g) => g.healOnStep = true
		},
		{
			name: "PILLAGE",
			description: "Double your step |SCORE",
			color: "#F3DC00",
			bg: "ಚ",
			offset: -1,
			repeatable: true,
			pickup: (g) => g.stepScore++
		},
		{
			name: "LOOT",
			description: "Passing by |ORANGE| activates it",
			color: "#F89F00",
			bg: "್",
			pickup: (g) => g.remoteMulti = true
		},
		{
			name: "MANNA",
			description: "Get increased |GEM| chance",
			color: "#F3DC00",
			bg: "ಞ",
			offset: -3,
			repeatable: true,
			pickup: (g) => g.gemChance *= 1.3
		},
		{
			name: "SIN",
			description: "Once per level, |redraw| your hand if |stuck",
			color: "#846AC1",
			bg: "೪",
			pickup: (g) => g.canRedraw = true
		},
		{
			name: "WILDCARD",
			description: "|!1| ⇆ |!2|",
			bg: "ೞ",
			repeatable: true,
			varies: true,
			offset: -3,
			pickup: (g) => {}
		},
		{
			name: "HOME",
			description: "Freely revisit |!1| tiles",
			bg: "ಹ",
			repeatable: true,
			varies: true,
			pickup: (g) => {}
		}
	];
	var RelicIcon = class extends Draggable {
		constructor(x, y, game, data) {
			super(x, y, 80, 60);
			this.game = game;
			this.data = data;
			this.selectable = true;
			this.locked = true;
			this.data.gems = gems.map((g) => ({ ...g })).sort(randomSorter);
			this.data.color = this.data.varies ? this.data.gems[0].color : this.data.color;
		}
		isInside(point) {
			if (!this.icon) return super.isInside(point);
			const c = this.getCenter();
			return point.x > c.x - this.s.x * .25 * this.scale.x && point.x < c.x + this.s.x * .25 * this.scale.x && point.y > c.y - this.s.y * .25 * this.scale.y && point.y < c.y + this.s.y * .25 * this.scale.y;
		}
		move(to, duration) {
			this.tween.move(to, duration);
		}
		makeSelectable() {}
		getMoveTarget() {
			return {
				x: 30,
				y: 50
			};
		}
		hover() {
			setTimeout(() => {
				const dx = this.icon ? 230 : 0;
				const dy = this.icon ? 120 : -50 * this.scale.y;
				const tt = this.data.description.replace("!1", this.data.gems[0].name).replace("!2", this.data.gems[1].name);
				this.game.tooltip.show(this.data.name, tt, offset(this.getCenter(), dx, dy), this.data.name == "WILDCARD" ? this.data.gems.map((g) => g.color) : [this.data.color], this.icon);
			}, 5);
			this.game.audio.thud();
		}
		exit() {
			this.game.tooltip.visible = false;
		}
		pick() {}
		click() {
			this.game.audio.pop();
			this.game.audio.swoosh();
			this.game.addRelic(this);
			this.game.tooltip.visible = false;
			this.data.pickup(this.game);
		}
		drop() {}
		draw(ctx) {
			ctx.save();
			const c = this.getCenter();
			transformTo(ctx, c.x, c.y, 0, this.scale.x, this.scale.y);
			if (this.hovered && this.selectable && !this.icon) ctx.translate(0, -10);
			if (!this.icon) {
				ctx.fillStyle = "#000";
				ctx.fillRect(this.p.x, this.p.y + 2, this.s.x - 4, this.s.y - 4);
				ctx.fillStyle = this.hovered ? "#ffff66" : "#ddd";
				ctx.fillRect(this.p.x + 7 + 2, this.p.y + 7 + 2, this.s.x - 14 - 4, this.s.y - 14 - 4);
				ctx.strokeStyle = "#00000022";
				drawCorners(ctx, this.p.x, this.p.y);
			}
			ctx.font = `30px sans-serif`;
			ctx.textAlign = "center";
			const off = this.data.offset ?? 0;
			ctx.fillStyle = this.data.color;
			if (this.data.name == "WILDCARD") {
				const c = this.getCenter();
				const gradient = ctx.createLinearGradient(c.x - 20, 0, c.x + 20, 0);
				gradient.addColorStop(0, this.data.gems[0].color);
				gradient.addColorStop(.49, this.data.gems[0].color);
				gradient.addColorStop(.51, this.data.gems[1].color);
				gradient.addColorStop(1, this.data.gems[1].color);
				ctx.fillStyle = gradient;
			}
			ctx.strokeStyle = "#000000cc";
			ctx.lineWidth = 6;
			ctx.strokeText(this.data.bg, c.x + 15 - 15, c.y + 12 + off);
			ctx.fillText(this.data.bg, c.x + 15 - 15, c.y + 12 + off);
			ctx.restore();
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/picker.ts
	var PICK_OFFSET = 40;
	var Picker = class extends Entity {
		constructor(level, game) {
			super(400, 300, 0, 0);
			this.level = level;
			this.game = game;
			this.rewards = 0;
			this.picks = [];
			this.title = new TextEntity("", 55, 400, 280, -1, ZERO, { shadow: 7 });
			this.scale = {
				x: 1,
				y: 0
			};
		}
		update(tick, mouse) {
			this.tween.update(tick);
			if (this.rewards <= 0 || this.picks.length <= 0 || !this.ready) return;
			this.picks.forEach((card) => card.update(tick, mouse));
		}
		draw(ctx) {
			ctx.save();
			transformToCenter(ctx, 0, this.scale.x, this.scale.y);
			ctx.fillStyle = "#000000bb";
			ctx.fillRect(0, 120, 800, 360);
			this.picks.forEach((card) => card.draw(ctx));
			this.title.draw(ctx);
			ctx.restore();
		}
		pickAt(x, y) {
			const card = [...this.picks].sort((a, b) => distance(a.getCenter(), {
				x,
				y
			}) - distance(b.getCenter(), {
				x,
				y
			}))[0];
			if (card && distance(card.getCenter(), {
				x,
				y
			}) < 100) {
				if (!card.hovered) {
					card.hovered = true;
					return;
				}
				if (card instanceof Card) this.game.pick(card);
				if (card instanceof RelicIcon) this.game.addRelic(card);
			}
		}
		remove(reward) {
			if (this.locked || !reward) return;
			reward.move(reward.getMoveTarget(), .2);
			this.locked = true;
			setTimeout(() => {
				this.picks = this.picks.filter((c) => c != reward);
				if (this.rewards == 1 || this.picks.length == 0) {
					this.tween.scale({
						x: 1,
						y: 0
					}, .1);
					this.ready = false;
				}
				this.reposition();
				this.rewards = Math.min(this.rewards - 1, this.picks.length);
				this.locked = false;
				this.game.tooltip.visible = false;
				if (this.rewards > 0) this.title.content = `PICK ${this.rewards} MORE!`;
			}, 150);
		}
		create(amt, relicChance = .25) {
			this.rewards += amt;
			this.tween.scale({
				x: 1,
				y: 1
			}, .3);
			setTimeout(() => this.ready = true, 300);
			const amount = this.game.rewardOptions;
			this.picks = [];
			this.title.content = "PICK YOUR REWARD!";
			if (this.rewards > 1) this.title.content = "PICK YOUR REWARDS!";
			const relic = Math.random() < relicChance && this.level.level > 1;
			const relicOptions = [...relics].filter((r) => r.repeatable || !this.game.relics.includes(r.name)).sort(() => Math.random() < .5 ? 1 : -1);
			for (var i = 0; i < amount; i++) {
				if (!relicOptions[i]) break;
				const reward = relic ? new RelicIcon(this.p.x + 6 - 52 * amount + 104 * i, this.p.y + PICK_OFFSET, this.game, { ...relicOptions[i] }) : new Card(this.p.x + 6 - 52 * amount + 104 * i, this.p.y + PICK_OFFSET, this.level, this.game, randomCard(this.game.gemChance));
				reward.scale = {
					x: 1.3,
					y: 1.3
				};
				this.picks.push(reward);
			}
			this.reposition();
			this.picks.forEach((card) => card.makeSelectable());
		}
		reposition() {
			this.picks.forEach((card, i) => {
				const p = {
					x: this.p.x + 6 - 52 + (i - this.picks.length * .5 + .5) * 80 * 1.3,
					y: this.p.y + PICK_OFFSET
				};
				card.move(p, .15);
			});
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/pile.ts
	var Pile = class extends Entity {
		constructor(x, y) {
			super(x, y, 80, 60);
			this.count = 1;
			this.d = -5;
		}
		move(to, duration) {
			this.tween.move(to, duration);
		}
		draw(ctx) {
			if (this.count <= 0) return;
			const height = (Math.min(6, this.count) - 1) * 10;
			ctx.fillStyle = "#000";
			ctx.fillRect(this.p.x + 2, this.p.y + 2, this.s.x - 4, this.s.y - 4);
			ctx.fillStyle = "#ccc";
			ctx.fillRect(this.p.x + 7 + 2, this.p.y + 7 + 2, this.s.x - 14 - 4, this.s.y - 14 - 4);
			ctx.fillStyle = "#000";
			ctx.fillRect(this.p.x + 2, this.p.y + 2 - height, this.s.x - 4, this.s.y - 4);
			ctx.fillStyle = "#fff";
			ctx.fillRect(this.p.x + 7 + 2, this.p.y + 7 + 2 - height, this.s.x - 14 - 4, this.s.y - 14 - 4);
			ctx.strokeStyle = "#00000022";
			drawCorners(ctx, this.p.x, this.p.y - height);
			ctx.font = `27px ${font}`;
			ctx.textAlign = "center";
			ctx.fillStyle = "#000";
			ctx.fillText(this.count.toString(), this.p.x + this.s.x * .5, this.p.y + this.s.y * .5 + 10 - height);
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/tooltip.ts
	var Tooltip = class extends Entity {
		constructor(x, y, width, height) {
			super(x - width * .5, y - height * .5, width, height);
			this.visible = false;
			this.title = "";
			this.content = "";
			this.phase = 0;
			this.diff = 0;
			this.d = 150;
		}
		show(title, content, pos, colors, flipped = false) {
			const x = pos.x - this.s.x * .5;
			const clamped = clamp(x, 10, 800 - this.s.x - 10);
			this.diff = clamped - x;
			this.title = title;
			this.content = content;
			this.p = {
				x: clamped,
				y: pos.y - this.s.y
			};
			this.visible = true;
			this.colors = colors;
			this.flipped = flipped;
		}
		update(tick, mouse) {
			this.phase = Math.abs(Math.sin(tick * .0025));
		}
		draw(ctx) {
			if (!this.visible) return;
			ctx.save();
			ctx.translate(0, this.phase * (this.flipped ? -7 : -7));
			ctx.fillStyle = "#000000";
			ctx.fillRect(this.p.x, this.p.y, this.s.x, this.s.y);
			ctx.font = `30px ${font}`;
			ctx.textAlign = "left";
			const c = this.p;
			ctx.fillStyle = "#000";
			ctx.fillText(this.title, c.x + 5 + 15, c.y + 5 + 40);
			ctx.fillStyle = this.colors[0];
			ctx.fillText(this.title, c.x + 15, c.y + 40);
			ctx.font = `20px ${font}`;
			ctx.fillStyle = "#000";
			ctx.fillText(this.content, c.x + 4 + 15, c.y + 4 + 40 + 30);
			ctx.beginPath();
			const dx = this.flipped ? 25 : 250 - this.diff;
			const dy = this.flipped ? 5 : 85;
			ctx.moveTo(c.x - 15 + dx, c.y + dy);
			ctx.lineTo(c.x + 15 + dx, c.y + dy);
			ctx.lineTo(c.x + dx, c.y + dy + (this.flipped ? -15 : 15));
			ctx.fill();
			drawColoredText(ctx, this.content, c.x + 15, c.y + 40 + 30, "#fff", this.colors);
			ctx.restore();
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/game.ts
	var Game = class extends Entity {
		constructor(dude, effects, camera, level, audio, mouse) {
			super(360, 500, 0, 0);
			this.dude = dude;
			this.effects = effects;
			this.camera = camera;
			this.level = level;
			this.audio = audio;
			this.mouse = mouse;
			this.score = 0;
			this.multi = 1;
			this.handSize = 3;
			this.life = 5;
			this.rewardOptions = 3;
			this.rewardPicks = 1;
			this.relics = [];
			this.stepScore = 1;
			this.gemChance = 1;
			this.wilds = [];
			this.blinders = new Blinders();
			this.freeMoveOn = [];
			this.tooltip = new Tooltip(400, 300, 500, 90);
			this.cards = [];
			this.deck = [];
			this.icons = [];
			this.splash = new Container(400, 140, [new TextEntity("", 40, 400, 120, -1, ZERO, { shadow: 4 })]);
			audio.prepare();
			this.pile = new Pile(this.p.x - 160 - 30, this.p.y);
			this.picker = new Picker(this.level, this);
			this.gameOver = new GameOver(this);
			this.init();
		}
		getWilds(gem) {
			return [...this.wilds.filter((w) => w.first == gem).map((w) => w.second), ...this.wilds.filter((w) => w.second == gem).map((w) => w.first)];
		}
		pick(card) {
			if (this.picker.rewards <= 0) return;
			this.add(card.data, true, true);
			this.picker.remove(card);
			this.fill();
		}
		boost(amount) {
			this.maxLife += amount;
			this.life += amount;
		}
		addRelic(relic) {
			if (this.picker.rewards <= 0) return;
			if (relic.data.name == "WILDCARD") this.wilds.push({
				first: relic.data.gems[0].type,
				second: relic.data.gems[1].type
			});
			if (relic.data.name == "HOME") this.freeMoveOn.push(relic.data.gems[0].type);
			const pos = this.icons.length;
			this.picker.remove(relic);
			this.relics.push(relic.data.name);
			this.icons.push(relic);
			setTimeout(() => {
				relic.icon = true;
				relic.scale = {
					x: .8,
					y: .8
				};
				relic.setPosition(pos % 10 * 30 - 15, 30 + 30 * Math.floor(pos / 10));
			}, 250);
		}
		heal(amount) {
			this.life = Math.min(this.maxLife, this.life + amount);
			this.audio.heal();
			for (var i = 0; i < 50; i++) {
				const p = offset(this.dude.getCenter(), random(-20, 40), random(-30, 40));
				this.effects.add(new RectParticle(p.x, p.y, 2, 5, random(.1, .6), {
					x: 0,
					y: -.25 - random() * 1.5
				}, "#B4D000"));
			}
		}
		setSplash(text) {
			this.splash.getChild(0).content = text;
		}
		nextLevel() {
			clearTimeout(this.endCheckTimer);
			this.tooltip.visible = false;
			const hits = this.level.board.filter((tile) => !tile.content && !tile.reward);
			const delay = 200;
			if (hits.length > 0 && this.canRedraw && !this.level.retried) {
				this.audio.deadEnd();
				this.level.retried = true;
				setTimeout(() => this.redraw(), 500);
				return;
			}
			if (hits.length > 0) this.audio.deadEnd();
			[...hits].sort(randomSorter).forEach((hit, i) => {
				const p = hit.getCenter();
				setTimeout(() => {
					this.audio.explode();
					this.camera.shake(15, .15, 3);
					this.effects.add(new Pulse(p.x, p.y, random(30, 80), .5, 0, 120));
					this.addBits(p);
					this.effects.add(new LineParticle({
						x: 400,
						y: -100
					}, p, .4, 10, "#ffffcc99", random(10, 20)));
					this.life--;
					hit.hidden = true;
					this.audio.boom();
				}, 100 + i * delay + 750);
			});
			const extra = hits.length > 0 ? 1300 : 100;
			if (this.life - hits.length <= 0) {
				setTimeout(() => {
					this.gameOver.toggle(true);
					this.camera.shake(7, .3, 2);
					this.audio.lose();
				}, hits.length * delay + extra);
				return;
			}
			setTimeout(() => {
				this.setSplash(randomCell([
					"LAND CONQUERED",
					"INFIDELS MASSACRED",
					"MIGHTY RIGHTEOUS",
					"SUCCESS",
					"REPORTING TO POPE",
					"GREAT SUCCESS",
					"RECONQUISTA",
					"HERETICS LIQUIDATED",
					"THE CHURCH PREVAILS",
					"PAGANS MURDERED",
					"SINS FORGIVEN",
					"SIGNED BY THE CROSS",
					"CRUX TRANSMARINA",
					"CRUX CISMARINA"
				]));
				this.splash.show();
				this.audio.win();
				this.dude.hop(this);
				this.audio.move();
			}, hits.length * delay + extra);
			setTimeout(() => {
				this.splash.hide(.6);
				this.blinders.close(() => {
					this.blinders.open();
					this.mouse.dragging = false;
					this.level.next();
					this.cards = [];
					this.dude.reset(this.level.board[2]);
					this.shuffle();
					this.fill();
					this.showIntro();
					const sortedX = [...this.level.board].filter((t) => !t.reward).map((t) => t.index.x).sort((a, b) => a - b);
					const sortedY = [...this.level.board].filter((t) => !t.reward).map((t) => t.index.y).sort((a, b) => a - b);
					const x = -(sortedX[0] - 1 + sortedX[sortedX.length - 1] - 1) * .5 * 80;
					const y = -(sortedY[0] - 1 + sortedY[sortedY.length - 1] - 1) * .5 * 60;
					this.level.board.forEach((t) => {
						this.moveEntity(t, x, y);
						this.moveEntity(t.content, x, y);
						this.moveEntity(t.getLid(), x, y);
					});
					const p = this.level.board[2].p;
					this.dude.setPosition(p.x, p.y);
				});
			}, hits.length * delay + 1500 + extra);
		}
		click(x, y) {
			if (this.gameOver.visible) {
				this.gameOver.click(x, y, this);
				return;
			}
			if (this.picker.rewards > 0) {
				this.picker.pickAt(x, y);
				return;
			}
			this.cards.forEach((c) => c.selected = false);
			const card = [...this.cards.filter((c) => !c.isLocked())].sort((a, b) => distance(a.getCenter(), {
				x,
				y
			}) - distance(b.getCenter(), {
				x,
				y
			}))[0];
			if (card && distance(card.getCenter(), {
				x,
				y
			}) < 100) {
				card.pick();
				card.selected = true;
				this.selectedCard = card;
				return;
			}
			if (this.selectedCard) {
				this.selectedCard.selected = false;
				this.selectedCard.setPosition(x - 40, y - 30);
				this.selectedCard.updateTile();
				this.selectedCard.drop();
				this.selectedCard = null;
				return;
			}
		}
		clearSelect() {
			this.cards.forEach((c) => c.selected = false);
		}
		showIntro() {
			this.setSplash([
				"THE FOURTH CRUSADE",
				"THE FIFTH CRUSADE",
				"CRUSADE OF FREDERICK II",
				"THE BARONS' CRUSADE",
				"CRUSADE OF LOUIS IX",
				"THE SHEPHERDS' CRUSADE",
				"THE CRUSADE OF 1267",
				"THE INFANTS OF ARAGON",
				"THE EIGHTH CRUSADE",
				"LORD EDWARD'S CRUSADE",
				"THE FALL OF OUTREMER",
				"THE CRUSADES AFTER ACRE",
				"THE ARAGONESE CRUSADE"
			][(this.level.level - 1) % 13]);
			this.splash.show();
			setTimeout(() => this.splash.hide(), 2500);
		}
		checkLevelEnd() {
			if (this.dude.isMoving) return;
			if (this.picker.rewards > 0) {
				this.endCheckTimer = setTimeout(() => this.checkLevelEnd(), 500);
				return;
			}
			const handCards = this.cards.filter((c) => !c.isLocked());
			if (handCards.length == 0 || this.level.isFull() || !handCards.some((c) => c.getPossibleSpots().length > 0)) this.nextLevel();
		}
		shuffle() {
			this.deck = [...this.all].sort(() => Math.random() < .5 ? 1 : -1);
		}
		fill() {
			const handCards = this.cards.filter((c) => !c.isLocked());
			for (var i = 0; i < this.handSize - handCards.length; i++) setTimeout(() => {
				this.pull();
				this.reposition();
			}, 50 * i);
			this.reposition();
		}
		findPath(to, game) {
			this.dude.findPath(to, game, this.level);
		}
		createBlank(tile) {
			const p = tile.p;
			const card = new Card(p.x, p.y, this.level, this, { directions: [] });
			card.lock();
			tile.content = card;
			this.cards.push(card);
			card.pulse();
			if (this.canRemoteOpen) this.loot(tile);
		}
		add(card, shuffles = true, permanent = false) {
			if (permanent) this.all.push(card);
			this.deck.push(card);
			if (shuffles) this.deck = [...this.deck].sort(() => Math.random() < .5 ? 1 : -1);
			this.reposition();
		}
		pull() {
			if (this.deck.length <= 0) return;
			this.audio.swoosh();
			const card = this.deck.pop();
			const p = this.pile.p;
			this.cards.push(new Card(p.x, p.y - 20, this.level, this, card));
			this.reposition();
		}
		update(tick, mouse) {
			this.dude.update(tick, mouse);
			this.blinders.update(tick, mouse);
			if (!this.started) return;
			[
				...this.cards,
				...this.level.board,
				...this.icons,
				this.tooltip,
				this.splash,
				this.pile,
				this.picker,
				this.gameOver,
				this.effects,
				this.camera
			].forEach((c) => c.update(tick, mouse));
		}
		draw(ctx) {
			if (!this.started) {
				this.dude.draw(ctx);
				return;
			}
			[
				...this.cards,
				this.dude,
				this.pile
			].sort(sortByDepth).forEach((c) => c.draw(ctx));
			[
				this.picker,
				...this.icons,
				this.splash,
				this.gameOver,
				this.tooltip
			].forEach((i) => i.draw(ctx));
		}
		redraw() {
			const handCards = this.cards.filter((c) => !c.isLocked());
			handCards.forEach((card) => card.move(this.pile.p, .3));
			setTimeout(() => {
				this.cards = this.cards.filter((c) => !handCards.includes(c));
				handCards.forEach((card) => this.add(card.data, true, false));
				this.fill();
			}, 300);
			this.endCheckTimer = setTimeout(() => this.checkLevelEnd(), 1e3);
		}
		discard() {
			const card = randomCell(this.cards.filter((c) => !c.isLocked()));
			if (!card) return;
			card.move(this.pile.p, .3);
			setTimeout(() => {
				this.cards = this.cards.filter((c) => c != card);
				this.add(card.data, true, false);
				this.fill();
			}, 300);
		}
		addBits(p) {
			for (let i = 0; i < 20; i++) {
				const size = 1 + Math.random() * 3;
				this.effects.add(new RectParticle(p.x, p.y, size, size, .2 + Math.random() * .5, {
					x: -3 + Math.random() * 6,
					y: -7 * Math.random()
				}, {
					force: {
						x: 0,
						y: .1
					},
					depth: 20
				}));
			}
		}
		loot(tile) {
			const chests = tile.getChests(this.level.board).filter((n) => n.reward && !n.looted);
			if (chests.length > 0) {
				setTimeout(() => {
					this.audio.frog();
					this.audio.open();
					chests.forEach((c) => {
						c.loot();
						this.addBits(offset(c.getCenter(), 0, -5));
						this.camera.shake(10, .3);
						const p = offset(c.getCenter(), 0, -15);
						const duration = .5;
						const sky = {
							x: p.x,
							y: p.y - 20
						};
						this.effects.add(new LineParticle(p, offset(sky, 0, -10), duration, 10, "#ffffff55"));
						this.effects.add(new LineParticle(offset(p, -5, 0), offset(sky, -10, 0), duration, 7, "#ffffff55"));
						this.effects.add(new LineParticle(offset(p, 5, 0), offset(sky, 10, 0), duration, 7, "#ffffff55"));
					});
				}, 150);
				setTimeout(() => {
					this.audio.chest();
					this.picker.create(chests.length * this.rewardPicks);
				}, 600);
			}
		}
		reposition() {
			const handCards = [...this.cards.filter((c) => !c.isLocked())].sort((a, b) => a.p.x - b.p.x);
			this.pile.count = this.deck.length;
			handCards.forEach((c, i) => c.move(offset(this.p, (i - handCards.length * .5 + .5) * 80, 0), .15));
			this.pile.move(offset(this.p, -(handCards.length * .5 + 1) * 80, 0), .15);
		}
		moveEntity(e, x, y) {
			if (!e) return;
			e.p = offset(e.p, x, y);
		}
		restart() {
			this.blinders.close(() => {
				this.blinders.open();
				this.score = 0;
				this.gameOver.toggle(false);
				this.cards = [];
				this.icons = [];
				this.relics = [];
				this.wilds = [];
				this.freeMoveOn = [];
				this.stepScore = 1;
				this.gemChance = 1;
				this.healOnStep = false;
				this.remoteMulti = false;
				this.canRedraw = false;
				this.canRemoteOpen = false;
				this.init();
				this.level.restart();
				this.dude.reset(this.level.board[2]);
			});
		}
		init() {
			this.splash.scale = {
				x: 0,
				y: 0
			};
			this.life = this.maxLife = 5;
			this.handSize = 3;
			this.rewardOptions = 3;
			this.rewardPicks = 1;
			this.all = [
				{ directions: ["u", "d"] },
				{ directions: ["u", "d"] },
				{ directions: ["l", "r"] },
				{ directions: ["l", "r"] },
				randomCard(1, true)
			];
			this.shuffle();
			this.fill();
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/lid.ts
	var Lid = class extends Entity {
		constructor(pos) {
			super(pos.x, pos.y, 0, 0);
			this.angle = 0;
			this.direction = 1;
			this.direction = Math.sign(pos.x - 400);
			this.d = 75;
		}
		draw(ctx) {
			const center = this.getCenter();
			ctx.fillStyle = "#000";
			ctx.save();
			ctx.translate(0, Math.sin(-this.tween.time * Math.PI) * 25);
			transformTo(ctx, center.x, center.y, this.angle * this.tween.time);
			ctx.fillRect(center.x - 22, center.y - 28, 44, 20);
			ctx.fillStyle = "#F3DC00";
			ctx.fillRect(center.x - 17, center.y - 23, 34, 10);
			drawEllipse(ctx, offset(center, 0, -17), 3, 2, "#000");
			ctx.restore();
		}
		open() {
			this.tween.move(offset(this.getCenter(), 15 * this.direction, -5), .2);
			this.angle = Math.PI * .25 * this.direction;
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/tile.ts
	var Tile = class extends Entity {
		constructor(x, y, offset) {
			super(x * 80 + offset.x, y * 60 + offset.y, 80, 60);
			this.life = 0;
			this.offset = Math.random() * 100;
			this.index = {
				x,
				y
			};
			this.d = -100;
			this.ballSize = 15 + Math.random() * 7;
			this.lid = new Lid(this.getCenter());
		}
		getLid() {
			return this.lid;
		}
		update(tick, mouse) {
			this.life = tick * .01 * (this.hilite ? 3 : -1);
			this.lid.update(tick, mouse);
		}
		loot() {
			this.looted = true;
			this.lid.open();
		}
		prePreDraw(ctx) {
			if (!this.reward && !this.hidden) {
				ctx.setLineDash([0, this.ballSize]);
				ctx.lineDashOffset = this.offset * 2;
				ctx.lineCap = "round";
				ctx.lineWidth = this.ballSize + 10;
				ctx.strokeStyle = "#5b7c5b";
				roundRect(ctx, this.p.x - 5, this.p.y - 5, this.s.x + 10, this.s.y + 10, 5);
				ctx.stroke();
			}
		}
		preDraw(ctx) {
			if (!this.reward && !this.hidden) {
				ctx.lineWidth = 5;
				ctx.strokeStyle = "#5b7c5b";
				ctx.beginPath();
				ctx.setLineDash([]);
				roundRect(ctx, this.p.x - 5, this.p.y - 5, this.s.x + 10, this.s.y + 10, 15);
				ctx.stroke();
				ctx.setLineDash([0, this.ballSize]);
				ctx.lineDashOffset = this.offset * 2;
				ctx.lineCap = "round";
				ctx.lineWidth = this.ballSize;
				ctx.strokeStyle = "#afd594";
				roundRect(ctx, this.p.x - 5, this.p.y - 5, this.s.x + 10, this.s.y + 10, 5);
				ctx.stroke();
			}
		}
		draw(ctx) {
			if (this.hidden) return;
			const center = this.getCenter();
			if (!this.reward) {
				ctx.fillStyle = "#afd594";
				ctx.beginPath();
				roundRect(ctx, this.p.x - 5, this.p.y - 5, this.s.x + 10, this.s.y + 10, 15);
				ctx.fill();
			}
			if (this.reward) {
				ctx.save();
				ctx.translate(0, 7);
				drawEllipse(ctx, this.getCenter(), 27, 12, "#00000033");
				ctx.fillStyle = "#000";
				ctx.fillRect(center.x - 20, center.y - 22, 40, 25);
				ctx.fillStyle = "#F3DC00";
				ctx.fillRect(center.x - 15, center.y - 17, 30, 15);
				ctx.fillStyle = "#000";
				ctx.fillRect(center.x - 12, center.y - 16, 24, 7);
				this.lid.draw(ctx);
				ctx.restore();
			}
			if (this.marked || this.hilite) {
				ctx.strokeStyle = this.hilite ? "#ffffffff" : "#ffffff99";
				ctx.lineWidth = this.hilite ? 10 : 6;
				ctx.setLineDash([5, 15]);
				ctx.lineCap = "round";
				ctx.lineDashOffset = this.life + this.offset;
				ctx.beginPath();
				roundRect(ctx, this.p.x + 10, this.p.y + 10, this.s.x - 20, this.s.y - 20, 10);
				ctx.stroke();
			}
			ctx.setLineDash([]);
		}
		isIn(snapped) {
			return !this.content && this.p.x == snapped.x && this.p.y == snapped.y;
		}
		accepts(card, board) {
			if (this.reward) return false;
			return board.some((tile) => {
				if (tile.index.x == this.index.x && tile.index.y == this.index.y - 1 && tile.content && tile.content.has("d") && card.has("u")) return true;
				if (tile.index.x == this.index.x && tile.index.y == this.index.y + 1 && tile.content && tile.content.has("u") && card.has("d")) return true;
				if (tile.index.x == this.index.x + 1 && tile.index.y == this.index.y && tile.content && tile.content.has("l") && card.has("r")) return true;
				if (tile.index.x == this.index.x - 1 && tile.index.y == this.index.y && tile.content && tile.content.has("r") && card.has("l")) return true;
				return false;
			});
		}
		getChests(board) {
			return board.filter((tile) => tile.reward && Math.abs(tile.index.x - this.index.x) + Math.abs(tile.index.y - this.index.y) == 1);
		}
		getNeighbours(board) {
			return board.filter((tile) => tile.content && Math.abs(tile.index.x - this.index.x) + Math.abs(tile.index.y - this.index.y) == 1);
		}
		getFreeNeighbours(board, includeDiagonals) {
			return includeDiagonals ? board.filter((tile) => !tile.reward && !tile.content && tile != this && Math.abs(tile.index.x - this.index.x) <= 1 && Math.abs(tile.index.y - this.index.y) <= 1) : board.filter((tile) => !tile.reward && !tile.content && Math.abs(tile.index.x - this.index.x) + Math.abs(tile.index.y - this.index.y) == 1);
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/level.ts
	var Level = class {
		constructor() {
			this.level = 0;
			this.retried = false;
			this.offset = {
				x: 280,
				y: 195
			};
			this.next();
		}
		isFull() {
			return !this.board.some((tile) => !tile.content);
		}
		restart() {
			this.level = 0;
			this.next();
		}
		next() {
			this.retried = false;
			this.level++;
			this.board = [
				new Tile(0, 1, this.offset),
				new Tile(1, 0, this.offset),
				new Tile(1, 1, this.offset),
				new Tile(1, 2, this.offset),
				new Tile(2, 1, this.offset)
			];
			for (var i = 0; i < (this.level - 1) * 2; i++) {
				const spot = this.getFromAllEdgeTile();
				if (!spot) continue;
				this.board.push(new Tile(spot.x, spot.y, this.offset));
			}
			if (this.starter) {
				this.board[2].content = this.starter;
				this.board[2].content.setPosition(this.offset.x + 80, this.offset.y + 60);
			}
			const center = this.board[2].p;
			this.getPossibleRewardSpots().sort(randomSorter).sort((a, b) => {
				return distance(a.p, center) - distance(b.p, center);
			}).slice(0, Math.max(0, this.level - Math.max(0, this.level - 8) * 3)).forEach((tile) => {
				const edge = this.getEdgeTile(tile);
				if (!edge) return;
				const chest = new Tile(edge.x, edge.y, this.offset);
				chest.reward = true;
				this.board.push(chest);
			});
		}
		isInRange(t) {
			return t.index.x > -3 && t.index.x < 5 && t.index.y > -2 && t.index.y < 4;
		}
		getFromAllEdgeTile() {
			const tiles = this.board.filter((tile) => tile.getNeighbours(this.board).length < 4).filter((t) => this.isInRange(t));
			const spots = [];
			tiles.forEach((tile) => {
				spots.push(this.edgeOrZero(tile, {
					x: 1,
					y: 0
				}), this.edgeOrZero(tile, {
					x: -1,
					y: 0
				}), this.edgeOrZero(tile, {
					x: 0,
					y: 1
				}), this.edgeOrZero(tile, {
					x: 0,
					y: -1
				}));
			});
			return randomCell(spots.filter((v) => v != ZERO));
		}
		getEdgeTile(tile) {
			return randomCell([
				this.edgeOrZero(tile, {
					x: 1,
					y: 0
				}),
				this.edgeOrZero(tile, {
					x: -1,
					y: 0
				}),
				this.edgeOrZero(tile, {
					x: 0,
					y: 1
				}),
				this.edgeOrZero(tile, {
					x: 0,
					y: -1
				})
			].filter((v) => v != ZERO));
		}
		getPossibleRewardSpots() {
			return [...this.board.filter((tile) => tile != this.board[2] && tile.getNeighbours(this.board).length < 4)];
		}
		edgeOrZero(tile, dir) {
			return !this.board.some((t) => t.index.x == tile.index.x + dir.x && t.index.y == tile.index.y + dir.y) ? {
				x: tile.index.x + dir.x,
				y: tile.index.y + dir.y
			} : ZERO;
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/casual-crusade/src/index.ts
	var WIDTH = 800;
	var HEIGHT = 600;
	var canvas = document.createElement("canvas");
	var ctx = canvas.getContext("2d");
	var level = new Level();
	var dude = new Dude(level.board[2]);
	var mouse = {
		x: 0,
		y: 0
	};
	var game = new Game(dude, new Container(), new Camera(), level, new AudioManager(), mouse);
	var startButton = new ButtonEntity("PLAY", 400, 510, 250, 75, () => {}, game.audio);
	var startUi = [
		startButton,
		new TextEntity("CASUAL CRUSADE", 70, 400, 95, -1, ZERO, { shadow: 7 }),
		new TextEntity("by Antti Haavikko", 35, 400, 140, -1, ZERO, { shadow: 4 }),
		new TextEntity("Made for js13k 2023", 20, 400, 170, -1, ZERO, { shadow: 2 }),
		new TextEntity("Press F for full screen", 18, 400, 580, -1, ZERO, { shadow: 2 })
	];
	var ui = [new TextEntity("LIFE: 10", 30, 10, 35, -1, ZERO, {
		shadow: 3,
		align: "left"
	}), new TextEntity("0", 50, 785, 55, -1, ZERO, {
		shadow: 4,
		align: "right"
	})];
	var p = dude.p;
	level.starter = new Card(p.x, p.y, level, game, { directions: [
		"u",
		"r",
		"d",
		"l"
	] });
	level.starter.lock();
	level.board[2].content = level.starter;
	canvas.id = "game";
	canvas.width = 800;
	canvas.height = 600;
	document.body.appendChild(canvas);
	var ratio = 1;
	var x = 0;
	var y = 0;
	var resize = () => {
		ratio = Math.min(window.innerWidth / 800, window.innerHeight / 600);
		canvas.style.transformOrigin = "top left";
		x = (window.innerWidth - 800 * ratio) * .5;
		y = (window.innerHeight - 600 * ratio) * .5;
		canvas.style.transform = `translate(${x}px,${y}px) scale(${ratio})`;
	};
	resize();
	window.onresize = resize;
	var isFull = false;
	document.onfullscreenchange = () => isFull = !isFull;
	document.onmousemove = (e) => {
		mouse.x = isFull ? e.x / window.innerWidth * 800 : e.offsetX;
		mouse.y = isFull ? e.y / window.innerHeight * 600 : e.offsetY;
	};
	document.onkeydown = (e) => {
		game.audio.prepare();
		if (e.key == "f") canvas.requestFullscreen();
		if (e.key == "p") {
			level.level++;
			game.picker.create(1, 1);
		}
		if (e.key == "c") {
			game.picker.rewards = 1;
			game.picker.create(1, 0);
		}
	};
	document.ontouchstart = (e) => {
		game.click((e.touches[0].clientX - x) / ratio, (e.touches[0].clientY - y) / ratio);
	};
	document.onmousedown = (e) => {
		game.audio.play();
		mouse.pressing = true;
		if (startButton.isInside(mouse)) {
			startButton.visible = false;
			game.audio.pop();
			setTimeout(() => {
				if (!game.started) game.showIntro();
				game.started = true;
			}, 100);
		}
	};
	document.onmouseup = (e) => mouse.pressing = false;
	var zoom = 1.2;
	var tick = (t) => {
		ui[0].content = `LIFE: ${game.life}/${game.maxLife}`;
		ui[1].content = game.score.toString();
		requestAnimationFrame(tick);
		ctx.resetTransform();
		transformToCenter(ctx, game.camera.rotation, zoom, zoom);
		ctx.translate(0, game.started ? 0 : 30);
		ctx.translate(game.camera.offset.x, game.camera.offset.y);
		ctx.fillStyle = "#74be75";
		ctx.fillRect(-100, -100, canvas.width + 200, canvas.height + 200);
		tartan(ctx);
		game.update(t, mouse);
		const all = [
			game,
			...game.effects.getChildren(),
			...level.board,
			level.starter
		];
		all.sort(sortByDepth);
		level.board.forEach((t) => t.prePreDraw(ctx));
		level.board.forEach((t) => t.preDraw(ctx));
		all.forEach((e) => e.draw(ctx));
		if (!game.started) {
			ctx.resetTransform();
			startUi.forEach((e) => {
				e.update(t, mouse);
				e.draw(ctx);
				game.blinders.draw(ctx);
			});
			return;
		}
		zoom = Math.max(1, zoom - .02);
		ui.forEach((e) => e.draw(ctx));
		game.blinders.draw(ctx);
	};
	requestAnimationFrame(tick);
	//#endregion
	exports.HEIGHT = HEIGHT;
	exports.WIDTH = WIDTH;
	return exports;
})({});
