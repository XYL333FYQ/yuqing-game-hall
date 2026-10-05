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
//#region game-sources/upstream/expansion/13th-floor/src/engine/enhanced-dom-point.ts
var EnhancedDOMPoint = class EnhancedDOMPoint extends DOMPoint {
	add_(otherVector) {
		this.addVectors(this, otherVector);
		return this;
	}
	addVectors(v1, v2) {
		this.x = v1.x + v2.x;
		this.y = v1.y + v2.y;
		this.z = v1.z + v2.z;
		return this;
	}
	set(x, y, z) {
		if (x && typeof x === "object") {
			y = x.y;
			z = x.z;
			x = x.x;
		}
		this.x = x ?? this.x;
		this.y = y ?? this.y;
		this.z = z ?? this.z;
		return this;
	}
	clone_() {
		return new EnhancedDOMPoint(this.x, this.y, this.z, this.w);
	}
	scale_(scaleBy) {
		this.x *= scaleBy;
		this.y *= scaleBy;
		this.z *= scaleBy;
		return this;
	}
	subtract(otherVector) {
		this.subtractVectors(this, otherVector);
		return this;
	}
	subtractVectors(v1, v2) {
		this.x = v1.x - v2.x;
		this.y = v1.y - v2.y;
		this.z = v1.z - v2.z;
		return this;
	}
	crossVectors(v1, v2) {
		const x = v1.y * v2.z - v1.z * v2.y;
		const y = v1.z * v2.x - v1.x * v2.z;
		const z = v1.x * v2.y - v1.y * v2.x;
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}
	dot(otherVector) {
		return this.x * otherVector.x + this.y * otherVector.y + this.z * otherVector.z;
	}
	toArray() {
		return [
			this.x,
			this.y,
			this.z
		];
	}
	get magnitude() {
		return Math.hypot(...this.toArray());
	}
	normalize_() {
		const magnitude = this.magnitude;
		if (magnitude === 0) return new EnhancedDOMPoint();
		this.x /= magnitude;
		this.y /= magnitude;
		this.z /= magnitude;
		return this;
	}
	moveTowards(otherVector, speed) {
		const distance = new EnhancedDOMPoint().subtractVectors(otherVector, this);
		if (distance.magnitude > 1) {
			const direction_ = distance.normalize_().scale_(speed);
			this.add_(direction_);
		}
		return this;
	}
	lerp(otherVector, alpha) {
		this.x += (otherVector.x - this.x) * alpha;
		this.y += (otherVector.y - this.y) * alpha;
		this.z += (otherVector.z - this.z) * alpha;
		return this;
	}
	isEqualTo(otherVector) {
		return this.x === otherVector.x && this.y === otherVector.y && this.z === otherVector.z;
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/core/controls.ts
var Controls = class {
	constructor() {
		this.isConfirm = false;
		this.isFlashlight = false;
		this.prevConfirm = false;
		this.prevFlash = false;
		this.mouseMovement = new EnhancedDOMPoint();
		this.keyMap = /* @__PURE__ */ new Map();
		document.addEventListener("keydown", (event) => this.keyMap.set(event.code, true));
		document.addEventListener("keyup", (event) => this.keyMap.set(event.code, false));
		document.addEventListener("mousedown", () => this.keyMap.set("KeyE", true));
		document.addEventListener("mouseup", () => this.keyMap.set("KeyE", false));
		document.addEventListener("mousemove", (event) => {
			this.mouseMovement.x = event.movementX;
			this.mouseMovement.y = event.movementY;
			this.onMouseMoveCallback?.(this.mouseMovement);
		});
		this.inputDirection = new EnhancedDOMPoint();
	}
	onMouseMove(callback) {
		this.onMouseMoveCallback = callback;
	}
	queryController() {
		this.prevConfirm = this.isConfirm;
		this.prevFlash = this.isFlashlight;
		const leftVal = this.keyMap.get("KeyA") ? -1 : 0;
		const rightVal = this.keyMap.get("KeyD") ? 1 : 0;
		const upVal = this.keyMap.get("KeyW") ? -1 : 0;
		const downVal = this.keyMap.get("KeyS") ? 1 : 0;
		this.inputDirection.x = leftVal + rightVal;
		this.inputDirection.y = upVal + downVal;
		this.isConfirm = !!this.keyMap.get("KeyE");
		this.isFlashlight = !!this.keyMap.get("KeyF");
	}
};
var controls = new Controls();
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/material.ts
var Material = class {
	constructor(props) {
		this.texture = props?.texture;
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/shaders/shaders.ts
var depth_fragment_glsl = `#version 300 es
precision highp float;
uniform vec3 v;in vec3 f;out float m;void main(){m=length(f-v)/40.;}`;
var depth_vertex_glsl = `#version 300 es
precision highp float;
layout(location=0) in vec4 i;uniform mat4 e,l;out vec3 f;void main(){gl_Position=e*i;f=vec3(l*vec4(i.xyz,1));}`;
var fragment_glsl = `#version 300 es
precision highp float;
in vec2 o;in float n;in vec3 u;in mat4 h;in vec3 t;uniform vec3 v,d;vec4 s=vec4(1);uniform mediump sampler2DArray z;uniform mediump samplerCube x;uniform vec3 c,y;vec4 A=vec4(1,1,.8,1);float C=1.,D=.85;vec4 G=vec4(.05,.05,.05,1);out vec4 g;float p(float v,float m,float f,float h){return 1./(v*v*m+v*f+h);}void main(){vec3 m=t-v,l=v-t;float f=length(m);vec3 e=normalize(m),i=normalize(l);float B=texture(x,e).x*40.,E=.015,F=0.;F=B+E<f?0.:1.;vec3 H=normalize(mat3(h)*u);float I=max(0.,dot(i,H)),J=p(f,d.x,d.y,d.z);vec4 K=s*I*J*F;vec3 L=c-t,M=normalize(L);float N=length(L),O=max(0.,dot(M,H)),P=dot(y,-M),Q=smoothstep(D,C,P),R=p(N,.005,.001,.4);vec4 S=A*O*Q*R,T=clamp(G+K+S,G,vec4(1));g=texture(z,vec3(o,n))*T;}`;
var vertex_glsl = `#version 300 es
layout(location=0) in vec3 L;layout(location=1) in vec3 B;layout(location=2) in vec2 F;layout(location=3) in float H;uniform mat4 I,M,e,l;out vec2 o;out float n;out vec3 u;out mat4 h;out vec4 K;out vec3 t;void main(){vec4 v=vec4(L,1);gl_Position=I*v;o=F;n=H;u=B;h=M;K=e*v;t=(l*v).xyz;}`;
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/lil-gl.ts
var LilGl = class {
	constructor() {
		this.gl = c3d.getContext("webgl2");
		const vertex = this.createShader(35633, vertex_glsl);
		const fragment = this.createShader(35632, fragment_glsl);
		this.program = this.createProgram(vertex, fragment);
		const depthVertex = this.createShader(35633, depth_vertex_glsl);
		const depthFragment = this.createShader(35632, depth_fragment_glsl);
		this.depthProgram = this.createProgram(depthVertex, depthFragment);
		const shadowCubeMapLocation = this.gl.getUniformLocation(this.program, "x");
		const textureLocation = this.gl.getUniformLocation(this.program, "z");
		this.gl.useProgram(this.program);
		this.gl.uniform1i(textureLocation, 0);
		this.gl.uniform1i(shadowCubeMapLocation, 2);
	}
	createShader(type, source) {
		const shader = this.gl.createShader(type);
		this.gl.shaderSource(shader, source);
		this.gl.compileShader(shader);
		return shader;
	}
	createProgram(vertexShader, fragmentShader) {
		const program = this.gl.createProgram();
		this.gl.attachShader(program, vertexShader);
		this.gl.attachShader(program, fragmentShader);
		this.gl.linkProgram(program);
		return program;
	}
};
var lilgl = new LilGl();
var gl = lilgl.gl;
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/texture.ts
var Texture = class {
	constructor(id, source) {
		this.source = source;
		this.id = id;
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/texture-loader.ts
var TextureLoader = class {
	constructor() {
		this.textures = [];
	}
	load_(textureSource) {
		const texture = new Texture(this.textures.length, textureSource);
		this.textures.push(texture);
		return texture;
	}
	bindTextures() {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(35866, gl.createTexture());
		gl.texStorage3D(35866, 8, gl.RGBA8, 512, 512, this.textures.length);
		this.textures.forEach((texture, index) => {
			gl.texSubImage3D(35866, 0, 0, 0, index, 512, 512, 1, gl.RGBA, gl.UNSIGNED_BYTE, texture.source);
		});
		gl.generateMipmap(35866);
	}
};
var textureLoader = new TextureLoader();
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/svg-maker/svg-string-converters.ts
async function toImage(svgImageBuilder) {
	const image_ = new Image();
	image_.src = URL.createObjectURL(new Blob([svgImageBuilder], { type: "image/svg+xml" }));
	return new Promise((resolve) => image_.addEventListener("load", () => resolve(image_)));
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/textures.ts
var materials = {};
async function initTextures() {
	materials.wood = new Material({ texture: textureLoader.load_(await wood()) });
	materials.face = new Material({ texture: textureLoader.load_(await face()) });
	materials.silver = new Material({ texture: textureLoader.load_(await metals("", 20)) });
	materials.iron = new Material({ texture: textureLoader.load_(await metals()) });
	materials.marble = new Material({ texture: textureLoader.load_(await marbleFloor()) });
	materials.ceilingTiles = new Material({ texture: textureLoader.load_(await ceilingTiles()) });
	materials.elevatorPanel = new Material({ texture: textureLoader.load_(await elevatorPanel()) });
	materials.redCarpet = new Material({ texture: textureLoader.load_(await redCarpet()) });
	materials.wallpaper = new Material({ texture: textureLoader.load_(await wallpaper(true)) });
	materials.greenPlasterWall = new Material({ texture: textureLoader.load_(await wallpaper()) });
	materials.white = new Material({ texture: textureLoader.load_(await color("#bbb")) });
	materials.red = new Material({ texture: textureLoader.load_(await color("#b00")) });
	for (let i = 1; i <= 13; i++) materials[i] = new Material({ texture: textureLoader.load_(await roomSign(`13${i.toString().padStart(2, "0")}`)) });
	textureLoader.bindTextures();
}
function wallpaper(isPattern = false) {
	return toImage(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><pattern id="b" width="128" height="128" patternUnits="userSpaceOnUse"><path fill="#687A5E" d="M0 0h128v128H0z"/>${isPattern ? "<text x=\"64\" y=\"64\" style=\"font-size:64px\" stroke=\"#506546\" fill=\"#506546\">❀</text><text y=\"128\" style=\"font-size:50px\" stroke=\"#506546\" fill=\"#506546\">✦</text>" : ""}</pattern><filter id="a"><feTurbulence baseFrequency=".4" stitchTiles="stitch"/><feDiffuseLighting color-interpolation-filters="sRGB" lighting-color="#687A5E"><feDistantLight azimuth="120" elevation="45"/></feDiffuseLighting><feBlend in="SourceGraphic" mode="difference"/></filter><rect width="100%" height="100%" filter="url(#a)" fill="url(#b)"/></svg>`);
}
async function elevatorPanel() {
	const positions = [
		30,
		50,
		70
	];
	let percentY = 70;
	const button = (x, y, num) => {
		return `<ellipse cx="${x}%" cy="${y}%" rx="40" ry="40" fill="${num < 13 ? "#777" : "#ffa"}" stroke="black" stroke-width="4"></ellipse><text x="${x}%" dx="${num > 9 ? -30 : -14}" y="${y}%" dy="18" style="font-weight: bold; font-size: 60px;">${num}</text>`;
	};
	let content = button(50, 90, 1);
	for (let i = 0; i < 12; i++) {
		const row = i % 3;
		if (i > 0 && row === 0) percentY -= 20;
		const percentX = positions[row];
		content += button(percentX, percentY, i + 2);
	}
	return metals(content, 30);
}
function redCarpet() {
	return toImage(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><filter id="a"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2"/><feDiffuseLighting color-interpolation-filters="sRGB" lighting-color="#600" result="d"><feDistantLight azimuth="90" elevation="55"/></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#a)"/></svg>`);
}
function ceilingTiles() {
	return toImage(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><pattern id="b" width="512" height="256" patternUnits="userSpaceOnUse"><path d="M8 7h502v248H8z"/></pattern><filter id="a"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="8"/><feComposite in="SourceGraphic" operator="arithmetic" k2=".5" k3=".5"/><feComponentTransfer result="n"><feFuncA type="gamma" exponent="4"/></feComponentTransfer><feDiffuseLighting color-interpolation-filters="sRGB" lighting-color="#fff" surfaceScale="-1" result="d"><feDistantLight azimuth="40" elevation="55"/></feDiffuseLighting></filter><rect width="100%" height="100%" filter="url(#a)" fill="url(#b)"/></svg>`);
}
function marbleFloor() {
	return toImage(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><pattern id="a" width="256" height="256" patternUnits="userSpaceOnUse"><circle r="290" fill="#fff"/><path d="M0 0h128v256h128V128H0z"/></pattern><filter id="b"><feTurbulence baseFrequency=".04" numOctaves="5"/><feColorMatrix values="1 -1 0 0 0 1 -1 0 0 0 1 -1 0 0 0 0 0 0 0 0.3"/><feBlend in="SourceGraphic" mode="soft-light"/></filter><rect width="100%" height="100%" fill="url(#a)" filter="url(#b)"/></svg>`);
}
function wood() {
	return toImage(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><filter id="a"><feTurbulence type="fractalNoise" baseFrequency="0.1, 0.007" numOctaves="6" stitchTiles="stitch"/><feComposite in="s" operator="arithmetic" k2=".5" k3=".6"/><feComponentTransfer><feFuncA type="table" tableValues="0, .1, .2, .3, .4, .2, .4"/></feComponentTransfer><feDiffuseLighting color-interpolation-filters="sRGB" surfaceScale="3" lighting-color="#6e3f2b"><feDistantLight azimuth="110" elevation="48"/></feDiffuseLighting></filter><rect height="100%" width="100%" filter="url(#a)"/></svg>`);
}
function face() {
	return toImage(`<svg style="filter: invert()" width="512" height="512" xmlns="http://www.w3.org/2000/svg"><filter id="a" x="-0.01%" primitiveUnits="objectBoundingBox" width="100%" height="100%"><feTurbulence seed="7" type="fractalNoise" baseFrequency="0.005" numOctaves="5" result="n"/><feComposite in="SourceAlpha" operator="in"/><feDisplacementMap in2="n" scale="0.9"/></filter><rect x="0" y="-14" width="100%" height="100%" id="l" filter="url(#a)"/><rect fill="#fff" width="100%" height="100%"/><use href="#l" x="22%" y="42" transform="scale(2.2, 1.2)"></use><use href="#l" x="-22%" y="42" transform="rotate(.1) scale(-2.2 1.2)"></use><rect fill="#777" x="220" y="230" width="50" height="50"/></svg>`);
}
function metals(content = "", brightnessModifier = 1) {
	const value = .01 * brightnessModifier;
	return toImage(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><filter id="b"><feTurbulence baseFrequency="0.01,0.0008" numOctaves="2" seed="23" type="fractalNoise" stitchTiles="stitch" /><feColorMatrix values="${value}, ${value}, ${value}, 0, 0,${value}, ${value}, ${value}, 0, 0,${value}, ${value}, ${value}, 0, 0,1, 1, 1, 1, 1"/></filter><rect x="0" y="0" width="100%" height="100%" filter="url(#b)"/>${content}</svg>`);
}
function roomSign(roomNumber) {
	return metals(`<text x="21%" y="42%" font-size="150px" style="transform: scaleY(1.5)">${roomNumber}</text>`, 30);
}
function color(color) {
	return toImage(`<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100%" height="100%" fill="${color}"/></svg>`);
}
var cellSize = 15;
var cellsInEachDirection = 12;
function getGridPosition(point) {
	return Math.floor((point.x + 90) / cellSize) + Math.floor((point.z + 90) / cellSize) * cellsInEachDirection;
}
function getGridPositionWithNeighbors(point, gridLength) {
	const gridPos = getGridPosition(point);
	return [
		gridPos,
		gridPos - 1 - cellsInEachDirection,
		gridPos - cellsInEachDirection,
		gridPos + 1 - cellsInEachDirection,
		gridPos - 1,
		gridPos + 1,
		gridPos - 1 + cellsInEachDirection,
		gridPos + cellsInEachDirection,
		gridPos + 1 + cellsInEachDirection
	].filter((gp) => gp >= 0 && gp < gridLength);
}
function build2dGrid(allFaces) {
	const gridFaces = [];
	allFaces.forEach((face) => {
		face.points_.map(getGridPosition).forEach((gp) => {
			if (!gridFaces[gp]) gridFaces[gp] = /* @__PURE__ */ new Set();
			gridFaces[gp].add(face);
		});
	});
	return gridFaces;
}
var floor = new EnhancedDOMPoint(0, 1, 0);
var ceiling = new EnhancedDOMPoint(0, -1, 0);
function findWallCollisionsFromList(walls, player) {
	for (const wall of walls) {
		if (wall.normal.isEqualTo(ceiling) || wall.normal.isEqualTo(floor)) continue;
		const newWallHit = testSphereTriangle(player.collisionSphere, wall);
		if (newWallHit) {
			const correctionVector = newWallHit.penetrationNormal.scale_(newWallHit.penetrationDepth + 1e-8);
			player.collisionSphere.center.add_(correctionVector);
			const normalComponent = newWallHit.penetrationNormal.scale_(player.velocity.dot(newWallHit.penetrationNormal));
			player.velocity.subtract(normalComponent);
			if (wall.normal.y >= .6 && player.velocity.y < 0) player.velocity.y = 0;
			else if (wall.normal.y <= -.6 && player.velocity.y > 0) player.velocity.y = 0;
		}
	}
}
function testSphereTriangle(s, wall) {
	if (new EnhancedDOMPoint().subtractVectors(s.center, wall.points_[0]).dot(wall.normal) < 0) return;
	const p = closestPointInTriangle(s.center, wall.points_[0], wall.points_[1], wall.points_[2]);
	const v = new EnhancedDOMPoint().subtractVectors(s.center, p);
	const squaredDistanceFromPointOnTriangle = v.dot(v);
	if (squaredDistanceFromPointOnTriangle <= s.radius * s.radius) return {
		penetrationNormal: v.normalize_(),
		penetrationDepth: s.radius - Math.sqrt(squaredDistanceFromPointOnTriangle)
	};
}
function closestPointInTriangle(p, a, b, c) {
	const ab = new EnhancedDOMPoint().subtractVectors(b, a);
	const ac = new EnhancedDOMPoint().subtractVectors(c, a);
	const ap = new EnhancedDOMPoint().subtractVectors(p, a);
	const d1 = ab.dot(ap);
	const d2 = ac.dot(ap);
	if (d1 <= 0 && d2 <= 0) return a;
	const bp = new EnhancedDOMPoint().subtractVectors(p, b);
	const d3 = ab.dot(bp);
	const d4 = ac.dot(bp);
	if (d3 >= 0 && d4 <= d3) return b;
	const vc = d1 * d4 - d3 * d2;
	if (vc <= 0 && d1 >= 0 && d3 <= 0) {
		const v = d1 / (d1 - d3);
		return new EnhancedDOMPoint().addVectors(a, new EnhancedDOMPoint().set(ab).scale_(v));
	}
	const cp = new EnhancedDOMPoint().subtractVectors(p, c);
	const d5 = ab.dot(cp);
	const d6 = ac.dot(cp);
	if (d6 >= 0 && d5 <= d6) return c;
	const vb = d5 * d2 - d1 * d6;
	if (vb <= 0 && d2 >= 0 && d6 <= 0) {
		const w = d2 / (d2 - d6);
		return new EnhancedDOMPoint().addVectors(a, new EnhancedDOMPoint().set(ac).scale_(w));
	}
	const va = d3 * d6 - d5 * d4;
	if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
		const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
		const wbc = new EnhancedDOMPoint().subtractVectors(c, b).scale_(w);
		return new EnhancedDOMPoint().addVectors(b, wbc);
	}
	const denom = 1 / (va + vb + vc);
	const v = vb * denom;
	const w = vc * denom;
	const abv = new EnhancedDOMPoint().set(ab).scale_(v);
	const acw = new EnhancedDOMPoint().set(ac).scale_(w);
	return new EnhancedDOMPoint().addVectors(abv, acw).add_(a);
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/audio/simplest-midi.ts
var audioContext = new AudioContext();
var compressor = audioContext.createDynamicsCompressor();
var biquadFilter = audioContext.createBiquadFilter();
biquadFilter.type = "lowshelf";
biquadFilter.frequency.value = 500;
biquadFilter.gain.value = 20;
biquadFilter.connect(compressor);
compressor.threshold.value = -50;
compressor.knee.value = 40;
compressor.ratio.value = 12;
compressor.connect(audioContext.destination);
var blen = audioContext.sampleRate * .5;
var noiseBuf = {};
noiseBuf["n0"] = audioContext.createBuffer(1, blen, audioContext.sampleRate);
noiseBuf["n1"] = audioContext.createBuffer(1, blen, audioContext.sampleRate);
for (let i = 0; i < blen; ++i) noiseBuf["n0"].getChannelData(0)[i] = Math.random() * 2 - 1;
for (let jj = 0; jj < 64; ++jj) {
	const r1 = Math.random() * 10 + 1;
	const r2 = Math.random() * 10 + 1;
	for (let i = 0; i < blen; ++i) {
		const dd = Math.sin(i / blen * 2 * Math.PI * 440 * r1) * Math.sin(i / blen * 2 * Math.PI * 440 * r2);
		noiseBuf["n1"].getChannelData(0)[i] += dd / 8;
	}
}
var SimplestMidiRev2 = class {
	constructor() {
		this.volume_ = audioContext.createGain();
		this.modulator = audioContext.createGain();
		this.bend = 0;
	}
	playNote(startTime, note, volume, instrumentDatas, duration) {
		let out;
		let sc;
		const o = [];
		const g = [];
		const vp = [];
		const fp = [];
		const releases = [];
		const frequency = 440 * 2 ** ((note - 69) / 12);
		for (let i = 0; i < instrumentDatas.length; ++i) {
			const instrumentInfo = instrumentDatas[i];
			if (instrumentInfo.output === 0) {
				out = this.volume_;
				sc = volume * volume / 16384;
				fp[i] = frequency * instrumentInfo.t + instrumentInfo.f;
			} else if (o[instrumentInfo.output - 1].frequency) {
				out = o[instrumentInfo.output - 1].frequency;
				sc = fp[instrumentInfo.output - 1];
				fp[i] = fp[instrumentInfo.output - 1] * instrumentInfo.t + instrumentInfo.f;
			} else {
				out = o[instrumentInfo.output - 1].playbackRate;
				sc = fp[instrumentInfo.output - 1] / 440;
				fp[i] = fp[instrumentInfo.output - 1] * instrumentInfo.t + instrumentInfo.f;
			}
			switch (instrumentInfo.w[0]) {
				case "n":
					o[i] = audioContext.createBufferSource();
					o[i].buffer = noiseBuf[instrumentInfo.w];
					o[i].loop = true;
					o[i].playbackRate.value = fp[i] / 440;
					if (instrumentInfo.p != 1) this._setParamTarget(o[i].playbackRate, fp[i] / 440 * instrumentInfo.p, startTime, instrumentInfo.q);
					if (o[i].detune) {
						this.modulator.connect(o[i].detune);
						o[i].detune.value = this.bend;
					}
					break;
				default:
					o[i] = audioContext.createOscillator();
					o[i].frequency.value = fp[i];
					if (instrumentInfo.p != 1) this._setParamTarget(o[i].frequency, fp[i] * instrumentInfo.p, startTime, instrumentInfo.q);
					o[i].type = instrumentInfo.w;
					if (o[i].detune) {
						this.modulator.connect(o[i].detune);
						o[i].detune.value = this.bend;
					}
			}
			g[i] = audioContext.createGain();
			releases[i] = instrumentInfo.r;
			o[i].connect(g[i]);
			g[i].connect(out);
			vp[i] = sc * instrumentInfo.v;
			if (instrumentInfo.k) vp[i] *= 2 ** ((note - 60) / 12 * instrumentInfo.k);
			if (instrumentInfo.a) {
				g[i].gain.value = 0;
				g[i].gain.setValueAtTime(0, startTime);
				g[i].gain.linearRampToValueAtTime(vp[i], startTime + instrumentInfo.a);
			} else g[i].gain.setValueAtTime(vp[i], startTime);
			const startupDuration = startTime + instrumentInfo.a + instrumentInfo.h;
			this._setParamTarget(g[i].gain, instrumentInfo.s * vp[i], startupDuration, instrumentInfo.d);
			o[i].start(startTime);
			for (let k = g.length - 1; k >= 0; --k) {
				g[k].gain.cancelScheduledValues(instrumentInfo.d + duration);
				this._setParamTarget(g[k].gain, 0, duration, instrumentInfo.d);
				o[i].stop(duration + instrumentInfo.d);
			}
		}
	}
	_setParamTarget(p, v, t, duration) {
		if (duration != 0) p.setTargetAtTime(v, t, duration);
		else p.setValueAtTime(v, t);
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/sounds.ts
var defaults = {
	output: 0,
	w: "sine",
	t: 1,
	f: 0,
	v: .5,
	a: 0,
	h: .01,
	d: .01,
	s: 0,
	r: .05,
	p: 1,
	q: 1,
	k: 0
};
var footstep = [{
	...defaults,
	w: "triangle",
	v: .7,
	t: .5,
	d: .2,
	r: .2,
	p: .95
}, {
	...defaults,
	w: "n1",
	v: 9,
	output: 1,
	d: .2,
	r: .2
}];
var violin = [{
	...defaults,
	w: "sawtooth",
	v: .4,
	a: .1,
	d: .2
}, {
	...defaults,
	w: "sine",
	v: 5,
	d: .2,
	s: .2,
	output: 1
}];
var frenchHorn = [{
	...defaults,
	w: "square",
	v: .1,
	a: .1,
	d: .5,
	s: .5,
	r: .08
}, {
	...defaults,
	w: "sine",
	v: 1,
	d: .1,
	s: 4,
	output: 1
}];
var doorOpening4 = [{
	...defaults,
	w: "sawtooth",
	v: .4,
	a: .1,
	d: 1,
	p: 2,
	q: 1.5
}, {
	...defaults,
	output: 1,
	w: "n1",
	v: .8,
	f: 11,
	d: 11,
	s: .2
}];
var hideSound = [{
	...defaults,
	w: "n0",
	v: .2,
	a: .05,
	h: .02,
	d: .02,
	r: .02
}];
var flashlightSound = [{
	...defaults,
	w: "n0",
	p: 0,
	r: .01,
	h: 0,
	v: .3
}];
var elevatorDoor1 = [
	{
		...defaults,
		w: "sine",
		f: 1651,
		v: .15,
		d: .5,
		r: .2,
		h: 0,
		t: 0
	},
	{
		...defaults,
		w: "sawtooth",
		output: 1,
		t: 1.21,
		v: 7.2,
		d: .1,
		r: 11,
		h: 1
	},
	{
		...defaults,
		output: 1,
		w: "n0",
		v: 3.1,
		t: .152,
		d: .002,
		r: .002
	}
];
var elevatorMotionRev1 = [{
	...defaults,
	w: "sine",
	t: 0,
	f: 100,
	a: .2,
	d: 1,
	r: 2,
	s: 1,
	q: 7
}, {
	...defaults,
	output: 1,
	w: "n1",
	v: .7,
	t: .9,
	d: 1,
	s: 1,
	r: 1.5,
	f: 40
}];
var baseDrum = [{
	...defaults,
	w: "triangle",
	t: 0,
	f: 88,
	v: 1,
	d: .05,
	h: .03,
	p: .5,
	q: .1
}, {
	...defaults,
	w: "n0",
	output: 1,
	t: 5,
	v: 42,
	r: .01,
	h: 0,
	p: 0
}];
var elevatorDoorTest = [{
	...defaults,
	w: "sine",
	t: 0,
	f: 90,
	v: 1,
	d: 1,
	h: .5,
	p: .5,
	q: .5,
	a: 1,
	s: .5,
	r: 1
}, {
	...defaults,
	w: "n0",
	output: 1,
	t: 5,
	v: 3.6,
	r: 1,
	h: .5,
	p: 0,
	f: 40,
	a: 1,
	d: .75,
	s: .5
}];
var song = expandSong("2P(322P*322P,322P.322Q0322P2322P4322Q6322R8322R:322R<322R>322S@322RB322RD322SF322MH322MJ322ML322MN322NP322MR322MT322NV3235(B<32(B<3/(B<3/8B<3,8B<3)8B<36HB<33HB<30HB<");
function expandSong(noteString) {
	return noteString.match(/.{5}/g).map((noteset) => [
		noteset.charCodeAt(0) - 50,
		noteset.charCodeAt(1),
		(noteset.charCodeAt(2) - 40) / 8,
		(noteset.charCodeAt(3) - 50) / 8,
		noteset.charCodeAt(4) - 20
	]);
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/light-info.ts
var lightInfo = {
	pointLightPosition: new EnhancedDOMPoint(0, 7, 0),
	pointLightColor: new EnhancedDOMPoint(1, 1, 1),
	pointLightAttenuation: new EnhancedDOMPoint(.008, .01, .4),
	spotLightPosition: new EnhancedDOMPoint(),
	spotLightDirection: new EnhancedDOMPoint(),
	spotLightColor: new EnhancedDOMPoint(1, 1, 1)
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/core/first-person-player.ts
var Sphere = class {
	constructor(center, radius) {
		this.center = center;
		this.radius = radius;
	}
};
var FirstPersonPlayer = class {
	constructor(camera, startingPoint) {
		this.feetCenter = new EnhancedDOMPoint();
		this.velocity = new EnhancedDOMPoint();
		this.isFrozen_ = false;
		this.cameraRotation = new EnhancedDOMPoint();
		this.isHiding = false;
		this.hidFrom = new EnhancedDOMPoint();
		this.differenceFromNavPoint = new EnhancedDOMPoint();
		this.isFlashlightOn = false;
		this.normal = new EnhancedDOMPoint();
		this.health = 100;
		this.sfxPlayer = new SimplestMidiRev2();
		this.sfxPlayer.volume_.connect(compressor);
		this.closestNavPoint = startingPoint;
		this.feetCenter.set(2, 2.5, -2);
		this.collisionSphere = new Sphere(this.feetCenter, 2);
		this.camera = camera;
		this.listener = audioContext.listener;
		controls.onMouseMove((mouseMovement) => {
			if (!this.isFrozen_) {
				this.cameraRotation.x += mouseMovement.y * -.001;
				this.cameraRotation.y += mouseMovement.x * -.001;
				this.cameraRotation.x = Math.min(Math.max(this.cameraRotation.x, -Math.PI / 2), Math.PI / 2);
				this.cameraRotation.y = this.cameraRotation.y % (Math.PI * 2);
			}
		});
	}
	heal() {
		this.health += 50;
		this.health = Math.min(this.health, 100);
	}
	hide(hidingPlace) {
		this.hidFrom.set(this.feetCenter);
		this.isHiding = true;
		this.camera.position.set(hidingPlace.position);
		this.cameraRotation.set(hidingPlace.cameraRotation);
		this.sfxPlayer.playNote(audioContext.currentTime, 30, 40, hideSound, audioContext.currentTime + 1);
	}
	unhide() {
		this.isHiding = false;
		this.feetCenter.set(this.hidFrom);
		this.sfxPlayer.playNote(audioContext.currentTime, 38, 40, hideSound, audioContext.currentTime + 1);
	}
	update(gridFaces) {
		if (this.heldKeyRoomNumber && this.heldKeyRoomNumber !== -1) tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 50px; right: 80px;">🗝️ #${this.heldKeyRoomNumber}</div>`;
		tmpl.innerHTML += `<div style="font-size: 40px; text-align: center; position: absolute; bottom: 10px; right: 280px; color: #b00;">♥ <div style="position: absolute; bottom: 13px; left: 30px; width: ${this.health * 2}px; height: 20px; background-color: #b00;"></div></div>`;
		let smallestDistance = Infinity;
		[this.closestNavPoint, ...this.closestNavPoint.getPresentSiblings()].forEach((point) => {
			const difference = new EnhancedDOMPoint().subtractVectors(this.feetCenter, point.position);
			const distance = difference.magnitude;
			if (distance < smallestDistance) {
				this.closestNavPoint = point;
				smallestDistance = distance;
				this.differenceFromNavPoint = difference;
			}
		});
		if (this.isFrozen_ || this.isHiding) this.velocity.set(0, 0, 0);
		else this.updateVelocityFromControls();
		if (!this.isHiding) {
			getGridPositionWithNeighbors(this.feetCenter, gridFaces.length).forEach((p) => findWallCollisionsFromList(gridFaces[p], this));
			this.feetCenter.add_(this.velocity);
			this.feetCenter.y = 2.5;
			this.camera.position.set(this.feetCenter);
			this.camera.position.y += 3.5;
		} else if (controls.isConfirm && !controls.prevConfirm) this.unhide();
		this.camera.setRotation_(...this.cameraRotation.toArray());
		this.normal.set(0, 0, -1);
		this.normal.set(this.camera.rotationMatrix.transformPoint(this.normal));
		lightInfo.spotLightPosition.set(this.camera.position);
		lightInfo.spotLightDirection.set(this.normal);
		if (!this.isFlashlightOn || this.isHiding) lightInfo.spotLightPosition.y = -100;
		this.camera.updateWorldMatrix();
		this.updateAudio();
	}
	updateVelocityFromControls() {
		const speed = .24;
		const depthMovementZ = Math.cos(this.cameraRotation.y) * controls.inputDirection.y * speed;
		const depthMovementX = Math.sin(this.cameraRotation.y) * controls.inputDirection.y * speed;
		const sidestepZ = Math.cos(this.cameraRotation.y + Math.PI / 2) * controls.inputDirection.x * speed;
		const sidestepX = Math.sin(this.cameraRotation.y + Math.PI / 2) * controls.inputDirection.x * speed;
		this.velocity.z = depthMovementZ + sidestepZ;
		this.velocity.x = depthMovementX + sidestepX;
		this.velocity.normalize_().scale_(speed);
		if (controls.isFlashlight && !controls.prevFlash) {
			this.sfxPlayer.playNote(audioContext.currentTime, 31 + (this.isFlashlightOn ? 0 : 10), 40, flashlightSound, audioContext.currentTime + 1);
			this.isFlashlightOn = !this.isFlashlightOn;
		}
	}
	updateAudio() {
		if (this.listener.positionX) {
			this.listener.positionX.value = this.camera.position.x;
			this.listener.positionY.value = this.camera.position.y;
			this.listener.positionZ.value = this.camera.position.z;
			this.listener.forwardX.value = this.normal.x;
			this.listener.forwardY.value = this.normal.y;
			this.listener.forwardZ.value = this.normal.z;
		} else {
			this.listener.setPosition(...this.camera.position.toArray());
			this.listener.setOrientation(this.normal.x, this.normal.y, this.normal.z, 0, 1, 0);
		}
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/helpers.ts
function radsToDegrees(radians) {
	return radians * (180 / Math.PI);
}
function unormalizedNormal(points) {
	const u = points[2].clone_().subtract(points[1]);
	const v = points[0].clone_().subtract(points[1]);
	return new EnhancedDOMPoint().crossVectors(u, v);
}
function calculateFaceNormal(points) {
	return unormalizedNormal(points).normalize_();
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/object-3d.ts
var Object3d = class {
	constructor(...children_) {
		this.rotation_ = new EnhancedDOMPoint();
		this.isUsingLookAt = false;
		this.right = new EnhancedDOMPoint();
		this.lookatUp = new EnhancedDOMPoint();
		this.forward = new EnhancedDOMPoint();
		this.position = new EnhancedDOMPoint();
		this.scale_ = new EnhancedDOMPoint(1, 1, 1);
		this.children_ = [];
		this.localMatrix = new DOMMatrix();
		this.worldMatrix = new DOMMatrix();
		this.up = new EnhancedDOMPoint(0, 1, 0);
		this.rotationMatrix = new DOMMatrix();
		if (children_) this.add_(...children_);
	}
	add_(...object3ds) {
		object3ds.forEach((object3d) => {
			if (object3d.parent_) object3d.parent_.children_ = object3d.parent_.children_.filter((child) => child !== this);
			object3d.parent_ = this;
			this.children_.push(object3d);
		});
	}
	remove_(object3d) {
		this.children_ = this.children_.filter((child) => child !== object3d);
	}
	rotate_(xRads, yRads, zRads) {
		this.rotation_.add_({
			x: radsToDegrees(xRads),
			y: radsToDegrees(yRads),
			z: radsToDegrees(zRads)
		});
		this.rotationMatrix.rotateSelf(radsToDegrees(xRads), radsToDegrees(yRads), radsToDegrees(zRads));
	}
	setRotation_(xRads, yRads, zRads) {
		this.rotationMatrix = new DOMMatrix();
		this.rotation_.set(radsToDegrees(xRads), radsToDegrees(yRads), radsToDegrees(zRads));
		this.rotationMatrix.rotateSelf(radsToDegrees(xRads), radsToDegrees(yRads), radsToDegrees(zRads));
	}
	getMatrix() {
		const matrix = new DOMMatrix();
		matrix.translateSelf(this.position.x, this.position.y, this.position.z);
		if (this.isUsingLookAt) matrix.multiplySelf(this.rotationMatrix);
		else matrix.rotateSelf(this.rotation_.x, this.rotation_.y, this.rotation_.z);
		matrix.scaleSelf(this.scale_.x, this.scale_.y, this.scale_.z);
		return matrix;
	}
	updateWorldMatrix() {
		this.localMatrix = this.getMatrix();
		if (this.parent_) this.worldMatrix = this.parent_.worldMatrix.multiply(this.localMatrix);
		else this.worldMatrix = DOMMatrix.fromMatrix(this.localMatrix);
		this.children_.forEach((child) => child.updateWorldMatrix());
	}
	allChildren() {
		function getChildren(object3d, all_) {
			object3d.children_.forEach((child) => {
				all_.push(child);
				getChildren(child, all_);
			});
		}
		const allChildren = [];
		getChildren(this, allChildren);
		return allChildren;
	}
	lookAt(target) {
		this.isUsingLookAt = true;
		this.forward.subtractVectors(this.position, target).normalize_();
		this.right.crossVectors(this.up, this.forward).normalize_();
		this.lookatUp.crossVectors(this.forward, this.right).normalize_();
		this.rotationMatrix = new DOMMatrix([
			this.right.x,
			this.right.y,
			this.right.z,
			0,
			this.lookatUp.x,
			this.lookatUp.y,
			this.lookatUp.z,
			0,
			this.forward.x,
			this.forward.y,
			this.forward.z,
			0,
			0,
			0,
			0,
			1
		]);
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/scene.ts
var Scene = class extends Object3d {
	constructor(..._args) {
		super(..._args);
		this.solidMeshes = [];
	}
	add_(...object3ds) {
		super.add_(...object3ds);
		[...object3ds, ...object3ds.flatMap((object3d) => object3d.allChildren())].forEach((object3d) => {
			if (object3d.geometry) {
				object3d.geometry.bindGeometry();
				this.solidMeshes.push(object3d);
			}
		});
	}
	remove_(object3d) {
		super.remove_(object3d);
		[object3d, ...object3d.allChildren()].forEach((obj) => {
			if (obj.geometry) this.solidMeshes = this.solidMeshes.filter((mesh) => mesh !== obj);
		});
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/camera.ts
var Camera = class extends Object3d {
	constructor(fieldOfViewRadians, aspect, near, far) {
		super();
		const f = Math.tan(Math.PI * .5 - .5 * fieldOfViewRadians);
		const rangeInv = 1 / (near - far);
		this.projection = new DOMMatrix([
			f / aspect,
			0,
			0,
			0,
			0,
			f,
			0,
			0,
			0,
			0,
			(near + far) * rangeInv,
			-1,
			0,
			0,
			near * far * rangeInv * 2,
			0
		]);
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/mesh.ts
var Mesh = class extends Object3d {
	constructor(geometry, material) {
		super();
		this.geometry = geometry;
		this.material = material;
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/physics/face.ts
var Face = class {
	constructor(points, normal) {
		this.points_ = points;
		this.normal = normal ?? calculateFaceNormal(points);
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/cube-buffer-2.ts
var ShadowCubeMapFbo = class {
	constructor(size) {
		this.size = size;
		gl.activeTexture(gl.TEXTURE2);
		this.depthTexture = gl.createTexture();
		gl.bindTexture(3553, this.depthTexture);
		gl.texStorage2D(3553, 1, gl.DEPTH_COMPONENT32F, size, size);
		this.cubeMapTexture = gl.createTexture();
		gl.bindTexture(34067, this.cubeMapTexture);
		gl.texParameteri(34067, 10241, gl.LINEAR);
		gl.texParameteri(34067, 10240, gl.LINEAR);
		gl.texParameteri(34067, gl.TEXTURE_WRAP_S, 33071);
		gl.texParameteri(34067, gl.TEXTURE_WRAP_T, 33071);
		gl.texParameteri(34067, gl.TEXTURE_WRAP_R, 33071);
		for (let i = 0; i < 6; i++) gl.texImage2D(34069 + i, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, null);
		this.depthFramebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(36160, this.depthFramebuffer);
		gl.framebufferTexture2D(36160, gl.DEPTH_ATTACHMENT, 3553, this.depthTexture, 0);
		gl.readBuffer(gl.NONE);
	}
	bindForWriting(i) {
		gl.activeTexture(gl.TEXTURE2);
		gl.bindFramebuffer(36160, this.depthFramebuffer);
		gl.viewport(0, 0, this.size, this.size);
		gl.framebufferTexture2D(36160, 36064, 34069 + i, this.cubeMapTexture, 0);
	}
	getSides() {
		return [
			{
				target: new EnhancedDOMPoint(1, 0, 0),
				up: new EnhancedDOMPoint(0, -1, 0)
			},
			{
				target: new EnhancedDOMPoint(-1, 0, 0),
				up: new EnhancedDOMPoint(0, -1, 0)
			},
			{
				target: new EnhancedDOMPoint(0, 1, 0),
				up: new EnhancedDOMPoint(0, 0, 1)
			},
			{
				target: new EnhancedDOMPoint(0, -1, 0),
				up: new EnhancedDOMPoint(0, 0, -1)
			},
			{
				target: new EnhancedDOMPoint(0, 0, 1),
				up: new EnhancedDOMPoint(0, -1, 0)
			},
			{
				target: new EnhancedDOMPoint(0, 0, -1),
				up: new EnhancedDOMPoint(0, -1, 0)
			}
		];
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/renderer/renderer.ts
var AttributeLocation = /* @__PURE__ */ function(AttributeLocation) {
	AttributeLocation[AttributeLocation["Positions"] = 0] = "Positions";
	AttributeLocation[AttributeLocation["Normals"] = 1] = "Normals";
	AttributeLocation[AttributeLocation["TextureCoords"] = 2] = "TextureCoords";
	AttributeLocation[AttributeLocation["TextureDepth"] = 3] = "TextureDepth";
	AttributeLocation[AttributeLocation["LocalMatrix"] = 4] = "LocalMatrix";
	AttributeLocation[AttributeLocation["NormalMatrix"] = 8] = "NormalMatrix";
	return AttributeLocation;
}({});
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);
gl.blendFunc(gl.SRC_ALPHA, 771);
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
gl.getExtension("EXT_color_buffer_float");
gl.getExtension("OES_texture_float_linear");
var modelviewProjectionLocation = gl.getUniformLocation(lilgl.program, "I");
var normalMatrixLocation = gl.getUniformLocation(lilgl.program, "M");
var pointLightAttenuationLocation = gl.getUniformLocation(lilgl.program, "d");
var spotlightPositionLocation = gl.getUniformLocation(lilgl.program, "c");
var spotlightDirectionLocation = gl.getUniformLocation(lilgl.program, "y");
var worldMatrixDepth = gl.getUniformLocation(lilgl.depthProgram, "l");
var lightPositionDepth = gl.getUniformLocation(lilgl.depthProgram, "v");
var lightPovMvpDepthLocation = gl.getUniformLocation(lilgl.depthProgram, "e");
var worldMatrixMain = gl.getUniformLocation(lilgl.program, "l");
var lightPositionMain = gl.getUniformLocation(lilgl.program, "v");
gl.useProgram(lilgl.program);
var lightPerspective = new Camera(Math.PI / 2, 1, .1, 60);
function createLookAt(position, target, up) {
	const zAxis = new EnhancedDOMPoint().subtractVectors(target, position).normalize_();
	const xAxis = new EnhancedDOMPoint().crossVectors(zAxis, up).normalize_();
	const yAxis = new EnhancedDOMPoint().crossVectors(xAxis, zAxis);
	const invertedZ = new EnhancedDOMPoint(zAxis.x * -1, zAxis.y * -1, zAxis.z * -1);
	return new DOMMatrix([
		xAxis.x,
		yAxis.x,
		invertedZ.x,
		0,
		xAxis.y,
		yAxis.y,
		invertedZ.y,
		0,
		xAxis.z,
		yAxis.z,
		invertedZ.z,
		0,
		-xAxis.dot(position),
		-yAxis.dot(position),
		-invertedZ.dot(position),
		1
	]);
}
var cubeMap = new ShadowCubeMapFbo(1024);
function render(camera, scene) {
	const viewMatrix = camera.worldMatrix.inverse();
	const viewProjectionMatrix = camera.projection.multiply(viewMatrix);
	gl.useProgram(lilgl.depthProgram);
	gl.disable(gl.BLEND);
	gl.uniform3fv(lightPositionDepth, lightInfo.pointLightPosition.toArray());
	cubeMap.getSides().forEach((side, i) => {
		cubeMap.bindForWriting(i);
		gl.clearColor(1, 1, 1, 1);
		gl.clear(16640);
		const lightView = createLookAt(lightInfo.pointLightPosition, new EnhancedDOMPoint().addVectors(lightInfo.pointLightPosition, side.target), side.up);
		const lightViewProjectionMatrix = lightPerspective.projection.multiply(lightView);
		scene.solidMeshes.forEach((mesh, index) => {
			gl.bindVertexArray(mesh.geometry.vao);
			gl.uniformMatrix4fv(worldMatrixDepth, false, mesh.worldMatrix.toFloat32Array());
			gl.uniformMatrix4fv(lightPovMvpDepthLocation, false, lightViewProjectionMatrix.multiply(mesh.worldMatrix).toFloat32Array());
			gl.drawElements(gl.TRIANGLES, mesh.geometry.getIndices().length, 5123, 0);
		});
	});
	gl.useProgram(lilgl.program);
	gl.enable(gl.BLEND);
	gl.uniform3fv(lightPositionMain, lightInfo.pointLightPosition.toArray());
	gl.uniform3fv(spotlightPositionLocation, lightInfo.spotLightPosition.toArray());
	gl.uniform3fv(spotlightDirectionLocation, lightInfo.spotLightDirection.toArray());
	gl.uniform3fv(pointLightAttenuationLocation, lightInfo.pointLightAttenuation.toArray());
	gl.activeTexture(gl.TEXTURE0);
	gl.texParameteri(35866, 10241, 9987);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.bindFramebuffer(36160, null);
	gl.cullFace(gl.BACK);
	gl.clearColor(0, 0, 0, 0);
	gl.clear(16640);
	scene.solidMeshes.forEach((mesh) => {
		gl.useProgram(lilgl.program);
		const modelViewProjectionMatrix = viewProjectionMatrix.multiply(mesh.worldMatrix);
		gl.vertexAttrib1f(3, mesh.material.texture?.id ?? -1);
		gl.bindVertexArray(mesh.geometry.vao);
		gl.uniformMatrix4fv(normalMatrixLocation, true, mesh.color ? mesh.cachedMatrixData : mesh.worldMatrix.inverse().toFloat32Array());
		gl.uniformMatrix4fv(worldMatrixMain, false, mesh.worldMatrix.toFloat32Array());
		gl.uniformMatrix4fv(modelviewProjectionLocation, false, modelViewProjectionMatrix.toFloat32Array());
		gl.drawElements(gl.TRIANGLES, mesh.geometry.getIndices().length, 5123, 0);
	});
	gl.bindVertexArray(null);
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/physics/parse-faces.ts
function indexToFaceVertexPoint(index, positionData, matrix) {
	return new EnhancedDOMPoint().set(matrix.transformPoint(new EnhancedDOMPoint(positionData[index], positionData[index + 1], positionData[index + 2])));
}
function meshToFaces(meshes) {
	return meshes.flatMap((mesh) => {
		const indices = mesh.geometry.getIndices();
		const positions = mesh.geometry.getAttribute_(AttributeLocation.Positions);
		const triangles = [];
		for (let i = 0; i < indices.length; i += 3) {
			const firstIndex = indices[i] * 3;
			const secondIndex = indices[i + 1] * 3;
			const thirdIndex = indices[i + 2] * 3;
			const trianglePoints = [
				indexToFaceVertexPoint(firstIndex, positions.data, mesh.worldMatrix),
				indexToFaceVertexPoint(secondIndex, positions.data, mesh.worldMatrix),
				indexToFaceVertexPoint(thirdIndex, positions.data, mesh.worldMatrix)
			];
			triangles.push(trianglePoints);
		}
		return triangles.map((triangle) => new Face(triangle));
	});
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/engine/moldable-cube-geometry.ts
function getTextureForSide(uDivisions, vDivisions, material) {
	return new Array((uDivisions + 1) * (vDivisions + 1)).fill().map((_) => material.texture.id);
}
var MoldableCubeGeometry = class {
	texturePerSide(leftOrAll, right, top, bottom, back, front) {
		const allSides = [
			...getTextureForSide(this.depthSegments, this.heightSegments, leftOrAll),
			...getTextureForSide(this.depthSegments, this.heightSegments, right ?? leftOrAll),
			...getTextureForSide(this.widthSegments, this.depthSegments, top ?? leftOrAll),
			...getTextureForSide(this.widthSegments, this.depthSegments, bottom ?? leftOrAll),
			...getTextureForSide(this.widthSegments, this.heightSegments, back ?? leftOrAll),
			...getTextureForSide(this.widthSegments, this.heightSegments, front ?? leftOrAll)
		];
		this.setAttribute_(AttributeLocation.TextureDepth, new Float32Array(allSides), 1);
		return this;
	}
	constructor(width_ = 1, height_ = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1, sidesToDraw = 6) {
		this.vertices = [];
		this.verticesToActOn = [];
		this.buffers = /* @__PURE__ */ new Map();
		this.widthSegments = widthSegments;
		this.depthSegments = depthSegments;
		this.heightSegments = heightSegments;
		this.vao = gl.createVertexArray();
		const indices = [];
		const uvs = [];
		let vertexCount = 0;
		const buildPlane = (u, v, w, uDir, vDir, width, height, depth, gridX, gridY) => {
			const segmentWidth = width / gridX;
			const segmentHeight = height / gridY;
			const widthHalf = width / 2;
			const heightHalf = height / 2;
			const depthHalf = depth / 2;
			const gridX1 = gridX + 1;
			const gridY1 = gridY + 1;
			for (let iy = 0; iy < gridY1; iy++) {
				const y = iy * segmentHeight - heightHalf;
				for (let ix = 0; ix < gridX1; ix++) {
					const x = ix * segmentWidth - widthHalf;
					const vector = new EnhancedDOMPoint();
					vector[u] = x * uDir;
					vector[v] = y * vDir;
					vector[w] = depthHalf;
					this.vertices.push(vector);
					uvs.push(ix / gridX, 1 - iy / gridY);
				}
			}
			for (let iy = 0; iy < gridY; iy++) for (let ix = 0; ix < gridX; ix++) {
				const a = vertexCount + ix + gridX1 * iy;
				const b = vertexCount + ix + gridX1 * (iy + 1);
				const c = vertexCount + (ix + 1) + gridX1 * (iy + 1);
				const d = vertexCount + (ix + 1) + gridX1 * iy;
				indices.push(a, b, d, b, c, d);
			}
			vertexCount += gridX1 * gridY1;
		};
		const sides = [
			[
				"x",
				"z",
				"y",
				1,
				1,
				width_,
				depth,
				height_,
				widthSegments,
				depthSegments
			],
			[
				"x",
				"z",
				"y",
				1,
				-1,
				width_,
				depth,
				-height_,
				widthSegments,
				depthSegments
			],
			[
				"z",
				"y",
				"x",
				-1,
				-1,
				depth,
				height_,
				width_,
				depthSegments,
				heightSegments
			],
			[
				"z",
				"y",
				"x",
				1,
				-1,
				depth,
				height_,
				-width_,
				depthSegments,
				heightSegments
			],
			[
				"x",
				"y",
				"z",
				1,
				-1,
				width_,
				height_,
				depth,
				widthSegments,
				heightSegments
			],
			[
				"x",
				"y",
				"z",
				-1,
				-1,
				width_,
				height_,
				-depth,
				widthSegments,
				heightSegments
			]
		];
		for (let i = 0; i < sidesToDraw; i++) buildPlane(...sides[i]);
		this.setAttribute_(AttributeLocation.TextureCoords, new Float32Array(uvs), 2);
		this.indices = new Uint16Array(indices);
		this.computeNormals().done_().all_();
	}
	all_() {
		this.verticesToActOn = this.vertices;
		return this;
	}
	invertSelection() {
		this.verticesToActOn = this.vertices.filter((vertex) => !this.verticesToActOn.includes(vertex));
		return this;
	}
	selectBy(callback) {
		this.verticesToActOn = this.vertices.filter(callback);
		return this;
	}
	translate_(x = 0, y = 0, z = 0) {
		this.verticesToActOn.forEach((vertex) => vertex.add_({
			x,
			y,
			z
		}));
		return this;
	}
	scale_(x = 1, y = 1, z = 1) {
		const scaleMatrix = new DOMMatrix().scaleSelf(x, y, z);
		this.verticesToActOn.forEach((vertex) => vertex.set(scaleMatrix.transformPoint(vertex)));
		return this;
	}
	rotate_(x = 0, y = 0, z = 0) {
		const rotationMatrix = new DOMMatrix().rotateSelf(radsToDegrees(x), radsToDegrees(y), radsToDegrees(z));
		this.verticesToActOn.forEach((vertex) => vertex.set(rotationMatrix.transformPoint(vertex)));
		return this;
	}
	modifyEachVertex(callback) {
		this.verticesToActOn.forEach(callback);
		return this;
	}
	spherify(radius) {
		this.modifyEachVertex((vertex) => {
			vertex.normalize_().scale_(radius);
		});
		return this;
	}
	merge(otherMoldable) {
		const updatedOtherIndices = otherMoldable.getIndices().map((index) => index + this.vertices.length);
		this.indices = new Uint16Array([...this.indices, ...updatedOtherIndices]);
		this.vertices.push(...otherMoldable.vertices);
		const thisTextureCoords = this.getAttribute_(AttributeLocation.TextureCoords).data;
		const otherTextureCoords = otherMoldable.getAttribute_(AttributeLocation.TextureCoords).data;
		const combinedCoords = new Float32Array([...thisTextureCoords, ...otherTextureCoords]);
		this.setAttribute_(AttributeLocation.TextureCoords, combinedCoords, 2);
		const thisNormals = this.getAttribute_(AttributeLocation.Normals).data;
		const otherNormals = otherMoldable.getAttribute_(AttributeLocation.Normals).data;
		const combinedNormals = new Float32Array([...thisNormals, ...otherNormals]);
		this.setAttribute_(AttributeLocation.Normals, combinedNormals, 3);
		if (this.getAttribute_(AttributeLocation.TextureDepth)) {
			const thisTextureDepth = this.getAttribute_(AttributeLocation.TextureDepth).data;
			const otherTextureDepth = otherMoldable.getAttribute_(AttributeLocation.TextureDepth).data;
			const combinedTextureDepth = new Float32Array([...thisTextureDepth, ...otherTextureDepth]);
			this.setAttribute_(AttributeLocation.TextureDepth, combinedTextureDepth, 1);
		}
		return this;
	}
	cylindrify(radius, aroundAxis = "y", circleCenter = {
		x: 0,
		y: 0,
		z: 0
	}) {
		this.modifyEachVertex((vertex) => {
			const originalAxis = vertex[aroundAxis];
			vertex[aroundAxis] = 0;
			vertex.subtract(circleCenter).normalize_().scale_(radius);
			vertex[aroundAxis] = originalAxis;
		});
		return this;
	}
	spreadTextureCoords(scaleX = 12, scaleY = 12, shiftX = 0, shiftY = 0) {
		const texCoordSideCount = (u, v) => (2 + (u - 1)) * (2 + (v - 1)) * 2;
		const xzCount = texCoordSideCount(this.widthSegments, this.depthSegments);
		const zyCount = xzCount + texCoordSideCount(this.depthSegments, this.heightSegments);
		const textureCoords = this.getAttribute_(AttributeLocation.TextureCoords).data;
		let u, v;
		this.vertices.forEach((vert, index) => {
			if (index < xzCount) {
				u = vert.x;
				v = vert.z;
			} else if (index < zyCount) {
				u = vert.z;
				v = vert.y;
			} else {
				u = vert.x;
				v = vert.y;
			}
			const pointInTextureGrid = [u / scaleX + shiftX, v / scaleY + shiftY];
			textureCoords.set(pointInTextureGrid, index * 2);
		});
		this.setAttribute_(AttributeLocation.TextureCoords, textureCoords, 2);
		return this;
	}
	/**
	* Computes normals. By default it uses faces on a single plane. Use this on moldable planes or for moldable cube
	* shapes where each side should have it's own normals, like a cube, ramp, pyramid, etc.
	*
	* You can optionally pass the shouldCrossPlanes boolean to tell it to use faces from other sides of the cube to
	* compute the normals. Use this for shapes that should appear continuous, like spheres.
	*/
	computeNormals(shouldCrossPlanes = false) {
		const vertexNormals = this.vertices.map((_) => new EnhancedDOMPoint());
		const indices = shouldCrossPlanes ? this.getIndicesWithUniquePositions() : this.indices;
		for (let i = 0; i < indices.length; i += 3) {
			const faceNormal = unormalizedNormal([
				this.vertices[indices[i]],
				this.vertices[indices[i + 1]],
				this.vertices[indices[i + 2]]
			]);
			vertexNormals[indices[i]].add_(faceNormal);
			vertexNormals[indices[i + 1]].add_(faceNormal);
			vertexNormals[indices[i + 2]].add_(faceNormal);
		}
		this.setAttribute_(AttributeLocation.Normals, new Float32Array(vertexNormals.flatMap((vector) => vector.normalize_().toArray())), 3);
		return this;
	}
	getIndicesWithUniquePositions() {
		const checkedPositions = [];
		const indexCopy = this.indices.slice();
		this.verticesToActOn.forEach((selectedVertex) => {
			if (checkedPositions.find((compareVertex) => selectedVertex.isEqualTo(compareVertex))) return;
			checkedPositions.push(selectedVertex);
			const originalIndex = this.vertices.findIndex((compareVertex) => selectedVertex.isEqualTo(compareVertex));
			this.vertices.forEach((compareVertex, vertexIndex) => {
				if (selectedVertex.isEqualTo(compareVertex)) {
					const indicesIndex = indexCopy.indexOf(vertexIndex);
					indexCopy[indicesIndex] = originalIndex;
				}
			});
		});
		return indexCopy;
	}
	done_() {
		this.setAttribute_(AttributeLocation.Positions, new Float32Array(this.vertices.flatMap((point) => point.toArray())), 3);
		return this;
	}
	getAttribute_(attributeLocation) {
		return this.buffers.get(attributeLocation);
	}
	setAttribute_(attributeLocation, data, size) {
		this.buffers.set(attributeLocation, {
			data,
			size
		});
		return this;
	}
	getIndices() {
		return this.indices;
	}
	bindGeometry() {
		const fullSize = [...this.buffers.values()].reduce((total, current) => total += current.data.length, 0);
		const fullBuffer = new Float32Array(fullSize);
		gl.bindBuffer(34962, gl.createBuffer());
		gl.bindVertexArray(this.vao);
		let byteOffset = 0;
		let lengthOffset = 0;
		this.buffers.forEach((buffer, position) => {
			gl.vertexAttribPointer(position, buffer.size, gl.FLOAT, false, 0, byteOffset);
			gl.enableVertexAttribArray(position);
			fullBuffer.set(buffer.data, lengthOffset);
			byteOffset += buffer.data.length * buffer.data.BYTES_PER_ELEMENT;
			lengthOffset += buffer.data.length;
		});
		gl.bufferData(34962, fullBuffer, gl.STATIC_DRAW);
		gl.bindBuffer(34963, gl.createBuffer());
		gl.bufferData(34963, this.indices, gl.STATIC_DRAW);
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/modeling/building-blocks.ts
function buildSegmentedWall(segmentWidths, segmentHeight, topSegments, bottomSegments, depth = 1, textureScale = 12, texturesPerSide) {
	let geo;
	let totalWidth = 0;
	let runningSide = 0;
	let runningLeft = 0;
	topSegments.forEach((top, index) => {
		const currentWidth = segmentWidths[index];
		if (top > 0) {
			const topGeo = new MoldableCubeGeometry(currentWidth, top, depth, 1, 1, 1, 6).translate_(runningSide + (index === 0 ? 0 : currentWidth / 2), segmentHeight - top / 2).spreadTextureCoords(textureScale, textureScale);
			if (texturesPerSide) topGeo.texturePerSide(...texturesPerSide);
			if (!geo) geo = topGeo;
			else geo.merge(topGeo);
		}
		if (bottomSegments[index] > 0) {
			const bottomGeo = new MoldableCubeGeometry(currentWidth, bottomSegments[index], depth, 1, 1, 1, 6).translate_(runningSide + (index === 0 ? 0 : currentWidth / 2), bottomSegments[index] / 2).spreadTextureCoords(textureScale, textureScale);
			if (texturesPerSide) bottomGeo.texturePerSide(...texturesPerSide);
			if (!geo) geo = bottomGeo;
			else geo.merge(bottomGeo);
		}
		runningSide += index === 0 ? currentWidth / 2 : currentWidth;
		runningLeft += currentWidth;
	});
	totalWidth = runningLeft;
	if (geo) geo.all_().translate_((segmentWidths[0] - runningLeft) / 2, 0).computeNormals().done_();
	return [geo, totalWidth];
}
function createHallway(frontWall, backWall, spacing) {
	frontWall?.translate_(0, 0, spacing);
	backWall?.translate_(0, 0, -spacing);
	if (frontWall && backWall) return frontWall.merge(backWall).done_();
	else return frontWall ?? backWall;
}
function createBox(frontWall, backWall, leftWall, rightWall) {
	return createHallway(frontWall[0], backWall[0], (leftWall[1] + 1) / 2).merge(createHallway(leftWall[0], rightWall[0], (frontWall[1] - 1) / 2).rotate_(0, Math.PI / 2)).computeNormals().done_();
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/modeling/elevator.ts
var Elevator = class {
	constructor() {
		this.isOpen = false;
		this.isOpenTriggered = false;
		this.isCloseTriggered = false;
		const elevatorBody = new Mesh(createBox(buildSegmentedWall([
			4,
			7.9,
			4
		], 12, [
			12,
			3,
			12
		], [
			0,
			0,
			0
		], 1), buildSegmentedWall([16], 12, [12], [], 1), buildSegmentedWall([10], 12, [12], [], 1), buildSegmentedWall([10], 12, [12], [], 1)), materials.silver);
		const elevatorRail = new Mesh(new MoldableCubeGeometry(10, .5, .3).translate_(0, 4, -4).merge(new MoldableCubeGeometry(.3, .5, 6).translate_(-6, 4, 0)).merge(new MoldableCubeGeometry(.3, .5, 6).translate_(6, 4, 0)).done_(), materials.silver);
		const panel = new Mesh(new MoldableCubeGeometry(1.5, 2, 1).translate_(5.4, 5, 5.2).spreadTextureCoords(-2, 2, .2).translate_(0, 0, .2).computeNormals().done_(), materials.elevatorPanel);
		const bfSegments = [
			1.25,
			4,
			.5,
			4,
			.5,
			4,
			1.25
		];
		const lrSegments = [
			.5,
			4,
			.5,
			4,
			.5
		];
		const elevatorWoodTest = new Mesh(createBox(buildSegmentedWall([bfSegments.reduce((acc, curr) => acc + curr)], 9, [0], [0]), buildSegmentedWall(bfSegments, 9, [
			0,
			9,
			0,
			9,
			0,
			9,
			0
		], [0]), buildSegmentedWall(lrSegments, 9, [
			0,
			9,
			0,
			9,
			0
		], [0]), buildSegmentedWall(lrSegments, 9, [
			0,
			9,
			0,
			9,
			0
		], [0])).translate_(0, 1.25).done_(), materials.wood);
		const elevatorFloor = new Mesh(new MoldableCubeGeometry(15, 1.5, 10.5).spreadTextureCoords(5, 5), materials.marble);
		const elevatorRoof = new Mesh(new MoldableCubeGeometry(15, 1.5, 10).translate_(0, 12).done_().spreadTextureCoords(), materials.ceilingTiles);
		const elevatorRightDoor = new Mesh(new MoldableCubeGeometry(4, 9, .5).translate_(-2, 4.5, 5.5).done_(), materials.silver);
		const elevatorLeftDoor = new Mesh(new MoldableCubeGeometry(4, 9, .5).translate_(2, 4.5, 5.5).done_(), materials.silver);
		this.bodyCollision = elevatorBody;
		this.doorCollision = new Set(meshToFaces([elevatorRightDoor, elevatorLeftDoor]));
		this.meshes = [
			elevatorBody,
			elevatorRail,
			elevatorFloor,
			elevatorRoof,
			elevatorWoodTest,
			panel,
			elevatorRightDoor,
			elevatorLeftDoor
		];
		this.openDoors = () => {
			if (elevatorRightDoor.position.x > -5) {
				elevatorRightDoor.position.x -= .035;
				elevatorLeftDoor.position.x += .035;
			} else this.isOpenTriggered = false;
			this.isOpen = elevatorRightDoor.position.x < -1;
		};
		this.closeDoors = () => {
			if (elevatorRightDoor.position.x < 0) {
				elevatorRightDoor.position.x += .04;
				elevatorLeftDoor.position.x -= .04;
			} else this.isCloseTriggered = false;
			this.isOpen = elevatorRightDoor.position.x < -1;
		};
	}
	update() {
		if (this.isOpenTriggered) this.openDoors();
		else if (this.isCloseTriggered) this.closeDoors();
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/modeling/room.ts
var NormalDoorWidth = 5;
function buildRoom(roomNumber, swapSign = false, isIncludeDetails = false) {
	const testWall = buildSegmentedWall([
		3,
		NormalDoorWidth,
		15
	], 12, [
		12,
		3,
		12
	], [
		0,
		0,
		0
	], 1, 4, [
		materials.greenPlasterWall,
		,
		,
		,
		,
		materials.wallpaper
	]);
	const testWall2 = buildSegmentedWall([23], 12, [12], [], 1, 4, [
		materials.wallpaper,
		,
		,
		,
		,
		materials.greenPlasterWall
	]);
	const testWall3 = buildSegmentedWall([34], 12, [12], [], 1, 4, [
		materials.wallpaper,
		,
		,
		,
		,
		materials.greenPlasterWall
	]);
	const testWall4 = buildSegmentedWall([34], 12, [12], [], 1, 4, [materials.wallpaper]);
	const [bathroomDoorWall] = buildSegmentedWall([
		4,
		NormalDoorWidth,
		4
	], 12, [
		12,
		3,
		12
	], [], 1, 4, [materials.greenPlasterWall]);
	bathroomDoorWall.rotate_(0, Math.PI).translate_(-10).computeNormals();
	const secondBathroomWall = new MoldableCubeGeometry(1, 12, 11.5).texturePerSide(materials.greenPlasterWall).translate_(-4, 6, -6.25).spreadTextureCoords(4, 4);
	const bathroomCornerColumn = new MoldableCubeGeometry(3, 12, 4).texturePerSide(materials.greenPlasterWall).translate_(-6, 6, -9.5).spreadTextureCoords(4, 4);
	const aboveShowerWall = new MoldableCubeGeometry(9, 3, 1).texturePerSide(materials.greenPlasterWall).merge(new MoldableCubeGeometry(12, .5, 1.5).translate_(2, 1.25).texturePerSide(materials.wood)).translate_(-12, 10, -8).spreadTextureCoords(4, 4);
	const bedPlaceholder = new MoldableCubeGeometry(7, 2, 8).translate_(6, 2, -6.5).texturePerSide(materials.white).done_();
	const counterPlaceholder = new MoldableCubeGeometry(3, 1, 7).translate_(-5.5, 3, -4).texturePerSide(materials.white).done_();
	const toiletPlaceholder = new MoldableCubeGeometry(2, 3, 4.75).translate_(-14.5, 1.5, -.25).texturePerSide(materials.white).done_();
	const bathPlaceholder = new MoldableCubeGeometry(7, 5, 3).translate_(-11.5, 3, -9).texturePerSide(materials.white).done_();
	const closetPlaceholder = new MoldableCubeGeometry(4, 8, 6).translate_(14, 4, 5).texturePerSide(materials.white).done_();
	const bathroomFloor = new MoldableCubeGeometry(10, 2, 8).translate_(-11, -.4, -4).spreadTextureCoords(6, 6, -.03).texturePerSide(materials.marble);
	const counter = new MoldableCubeGeometry(3, 1, 7, 12, 1, 12).selectBy((pos) => pos.y > 0 && Math.hypot(pos.x, pos.z) < 1).spherify(1).translate_(0, -.5).modifyEachVertex((vert) => vert.y *= -1).translate_(0, .4, 0).selectBy((pos) => pos.y > -.5 && Math.hypot(pos.x, pos.z) < 1.3).translate_(-.2).texturePerSide(materials.white).all_().merge(new MoldableCubeGeometry(1, 1, 1, 2, 1, 2).cylindrify(.2).translate_(1.1, .3, -.5).texturePerSide(materials.silver)).merge(new MoldableCubeGeometry(1, 1, 1, 2, 1, 2).cylindrify(.2).translate_(1.1, .3, .5).texturePerSide(materials.silver)).merge(new MoldableCubeGeometry(1, .2, .4).translate_(.7, .7).texturePerSide(materials.silver)).merge(new MoldableCubeGeometry(3, 3, 7).translate_(.1, -2).texturePerSide(materials.wood)).merge(new MoldableCubeGeometry(1, 4, 4).translate_(1.5, 3.2).texturePerSide(materials.silver)).translate_(-6, 3.2, -4).computeNormals(true).done_();
	const bath = createBox([new MoldableCubeGeometry(8.5, 3, .5).texturePerSide(materials.white), 9.75], [new MoldableCubeGeometry(8.5, 15, .5).texturePerSide(materials.white), 9.75], [new MoldableCubeGeometry(3.75, 15, .5).texturePerSide(materials.white), 2.5], [new MoldableCubeGeometry(3.75, 15, .5).texturePerSide(materials.white), 2.5]).merge(new MoldableCubeGeometry(8.5, .5, 3).texturePerSide(materials.white)).merge(new MoldableCubeGeometry(1, 1, 1, 1, 3, 3).cylindrify(.1, "x").selectBy((pos) => pos.x < 0).scale_(1, 3, 3).all_().rotate_(0, 0, .5).translate_(3.75, 6.5).texturePerSide(materials.silver)).merge(new MoldableCubeGeometry(6, 7, .1, 10, 1, 1).modifyEachVertex((vert) => vert.z = Math.sin(vert.x * 3) * .3).translate_(-.5, 3.75, 2.5).rotate_(-.1).texturePerSide(materials.white)).translate_(-11.75, 1, -9.5).computeNormals().done_();
	const closet = new MoldableCubeGeometry(.2, 8, 6).translate_(1.5).texturePerSide(materials.wood).merge(new MoldableCubeGeometry(3, .2, 6).translate_(0, -4).texturePerSide(materials.wood)).merge(new MoldableCubeGeometry(3, .2, 6).translate_(0, 4).texturePerSide(materials.wood)).merge(new MoldableCubeGeometry(3, 8.2, .2).translate_(0, 0, 3.1).texturePerSide(materials.wood)).merge(new MoldableCubeGeometry(3, 8.2, .2).translate_(0, 0, -3.1).texturePerSide(materials.wood)).merge(new MoldableCubeGeometry(.2, 8, 3).translate_(-.5, 0, -1.75).rotate_(0, .25).texturePerSide(materials.wood)).merge(new MoldableCubeGeometry(.2, 8, 3).translate_(-2.75, 0, .8).rotate_(0, .5).texturePerSide(materials.wood)).translate_(14, 4.5, 5).done_();
	const makePillow = () => {
		return new MoldableCubeGeometry(1, 1, 1, 4, 3, 4).spherify(1).selectBy((v) => Math.abs(v.x) > .8 || Math.abs(v.z) > .8).scale_(.8, 1, .8).all_().scale_(2, .3).rotate_(.5).translate_(0, 1.3, -3.5).texturePerSide(materials.white).computeNormals(true).done_();
	};
	const bed = new MoldableCubeGeometry(7, 2, 7, 8, 1, 8).selectBy((v) => Math.hypot(v.x, v.z) > 4.5).scale_(.9, 1, .9).selectBy((v) => Math.hypot(v.x, v.z) > 3).scale_(1, .9, 1).all_().scale_(1, 1, 1.2).texturePerSide(materials.white).merge(makePillow().translate_(-1.5)).merge(makePillow().translate_(1.5)).computeNormals(true).merge(new MoldableCubeGeometry(7, 7, .5).translate_(0, 0, -4.5).texturePerSide(materials.wood).merge(new MoldableCubeGeometry(7, 1, 8.5).translate_(0, -1.5).texturePerSide(materials.wood)).computeNormals()).translate_(6, 2, -6.5).done_();
	const toilet = new MoldableCubeGeometry(2, 2, 2, 6, 2, 6).cylindrify(1).scale_(1, 1, 1.2).selectBy((v) => v.y === 0).scale_(.7, 1, .7).translate_(0, -.5).texturePerSide(materials.white).merge(new MoldableCubeGeometry(2, 2, 1).translate_(0, 1.5, 1.5).texturePerSide(materials.white)).all_().translate_(-14.5, 1.5, -2.25).done_();
	function makeBedsideTable() {
		const table = new MoldableCubeGeometry(3, 3, 2).texturePerSide(materials.wood);
		if (isIncludeDetails) table.merge(new MoldableCubeGeometry(1, .2).translate_(0, 1, .6).texturePerSide(materials.silver));
		return table.computeNormals().done_();
	}
	const leftBedsideTable = makeBedsideTable().translate_(-.25, 1.5, -9.5);
	const rightBedsideTable = makeBedsideTable().translate_(12.25, 1.5, -9.5);
	const desk = makeBedsideTable().merge(makeBedsideTable().translate_(3)).merge(makeBedsideTable().translate_(-3)).rotate_(0, 3.14).translate_(0, 1.5, 10);
	function outerLargeTrimPiece() {
		return new MoldableCubeGeometry(1, 3.5, 3).texturePerSide(materials.wood).spreadTextureCoords(4, 4).translate_(-16.6, 2.5, 10).merge(new MoldableCubeGeometry(1, 3.5, 15).texturePerSide(materials.wood).spreadTextureCoords(4, 4).translate_(-16.6, 2.5, -4)).merge(new MoldableCubeGeometry(1, 3.5, 23).texturePerSide(materials.wood).spreadTextureCoords(4, 4).translate_(16.6, 2.5, 0)).merge(new MoldableCubeGeometry(33, 3.5, 1).texturePerSide(materials.wood).spreadTextureCoords(4, 4).translate_(0, 2.5, 12.1)).merge(new MoldableCubeGeometry(33, 3.5, 1).texturePerSide(materials.wood).spreadTextureCoords(4, 4).translate_(0, 2.5, -12.1));
	}
	const outerTrimFront = buildSegmentedWall([
		3,
		NormalDoorWidth,
		15
	], 12, [
		1,
		1,
		1
	], [
		1,
		0,
		1
	], 1.5, 4, [materials.wood]);
	const outerTrimBack = buildSegmentedWall([23], 12, [1], [1], 1.5, 4, [materials.wood]);
	const outerTrimLeft = buildSegmentedWall([34], 12, [1], [1], 1.5, 4, [materials.wood]);
	const outerTrimRight = buildSegmentedWall([34], 12, [1], [1], 1.5, 4, [materials.wood]);
	const bathroomDoorTrim = buildSegmentedWall([
		4.25,
		4.5,
		4.25
	], 12, [
		1,
		1,
		1
	], [
		1,
		0,
		1
	], 1.5, 4, [materials.wood]);
	const bathroomWallTrim = buildSegmentedWall([12], 12, [1], [1], 1.5, 4, [materials.wood]);
	const doorTrim = buildSegmentedWall([
		.5,
		4.5,
		.5
	], 9, [
		12,
		.5,
		12
	], [], 1.5, 4, [materials.wood]);
	const trim = createBox(outerTrimLeft, outerTrimRight, outerTrimBack, outerTrimFront).merge(bathroomDoorTrim[0].rotate_(0, Math.PI).translate_(-10)).merge(bathroomWallTrim[0].rotate_(0, Math.PI / 2).translate_(-4, 0, -5.25)).merge(doorTrim[0].rotate_(0, Math.PI / 2).translate_(-16.5, 0, 6)).merge(bathroomFloor).merge(outerLargeTrimPiece()).computeNormals().done_();
	const doorNumberPlate = new MoldableCubeGeometry(1, 1).texturePerSide(materials[roomNumber]).translate_(-16.6, 5, swapSign ? 9.5 : 2.5);
	const walls = createBox(testWall3, testWall4, testWall2, testWall).merge(bathroomDoorWall).merge(secondBathroomWall).merge(bathroomCornerColumn).merge(aboveShowerWall);
	if (isIncludeDetails) return walls.merge(trim).merge(doorNumberPlate).merge(closet).merge(counter).merge(bath).merge(bed).merge(toilet).merge(leftBedsideTable).merge(rightBedsideTable).merge(desk);
	else return walls.merge(bedPlaceholder).merge(closetPlaceholder).merge(counterPlaceholder).merge(toiletPlaceholder).merge(bathPlaceholder).merge(leftBedsideTable).merge(rightBedsideTable).merge(desk);
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/modeling/hotel.ts
var HallwayWidth = 10;
function makeHotel(isIncludingDetails = false) {
	const hotel = buildRoom(1, false, isIncludingDetails).translate_(0, 0, HallwayWidth).merge(buildRoom(2, false, isIncludingDetails).translate_(0, 0, 45)).merge(buildRoom(3, false, isIncludingDetails).translate_(0, 0, 80)).merge(buildRoom(5, false, isIncludingDetails).translate_(-44, 0, HallwayWidth)).merge(buildRoom(7, false, isIncludingDetails).translate_(-44, 0, 45)).merge(buildRoom(9, false, isIncludingDetails).translate_(-44, 0, 80)).merge(buildRoom(4, true, isIncludingDetails).rotate_(0, Math.PI).translate_(-88, 0, HallwayWidth)).merge(buildRoom(6, true, isIncludingDetails).rotate_(0, Math.PI).translate_(-88, 0, 45)).merge(buildRoom(8, true, isIncludingDetails).rotate_(0, Math.PI).translate_(-88, 0, 80)).merge(buildRoom(10, true, isIncludingDetails).rotate_(0, Math.PI).translate_(-132, 0, HallwayWidth)).merge(buildRoom(11, true, isIncludingDetails).rotate_(0, Math.PI).translate_(-132, 0, 45)).merge(buildRoom(12, true, isIncludingDetails).rotate_(0, Math.PI).translate_(-132, 0, 80)).translate_((34 + HallwayWidth) * 1.5, 0, 14).merge(buildSegmentedWall([
		45,
		11,
		45
	], 12, [
		12,
		2,
		12
	], [], 1, 4, [materials.wallpaper])[0]).merge(buildSegmentedWall([
		45,
		11,
		45
	], 12, [
		12,
		3,
		12
	], [], 1, 4, [materials.wallpaper])[0].merge(buildSegmentedWall([
		.5,
		10,
		.5
	], 9, [
		12,
		.5,
		12
	], [], 1.5, 12, [materials.wood])[0]).merge(new MoldableCubeGeometry(2, 1.5).texturePerSide(materials[13]).translate_(0, 10, -.1)).merge(createBox([new MoldableCubeGeometry(20, 12, .5).texturePerSide(materials.wallpaper).spreadTextureCoords(6, 6), 20], [void 0, 20], [new MoldableCubeGeometry(19.5, 12, .5).texturePerSide(materials.wallpaper).spreadTextureCoords(6, 6), 19], [new MoldableCubeGeometry(19.5, 12, .5).texturePerSide(materials.wallpaper).spreadTextureCoords(6, 6), 19]).translate_(0, 6, 10)).merge(new MoldableCubeGeometry(3, 3.25, 3).translate_(0, 1.5, 15).texturePerSide(materials.wood)).translate_(0, 0, 118)).merge(buildSegmentedWall([
		11,
		25,
		HallwayWidth,
		25,
		HallwayWidth,
		25,
		11
	], 12, [
		12,
		0,
		12,
		0,
		12,
		0,
		12
	], [], 1, 4, [materials.wallpaper])[0].rotate_(0, Math.PI / 2).translate_(49.5, 0, 59)).merge(buildSegmentedWall([
		11,
		25,
		HallwayWidth,
		25,
		HallwayWidth,
		25,
		11
	], 12, [
		12,
		0,
		12,
		0,
		12,
		0,
		12
	], [], 1, 4, [materials.wallpaper])[0].rotate_(0, Math.PI / 2).translate_(-49.5, 0, 59)).done_();
	if (isIncludingDetails) hotel.merge(makeAllBracing()).computeNormals();
	return hotel;
}
function makeAllBracing() {
	const corridors = [
		-44,
		0,
		44
	].map((val) => {
		return makeBracing(val, 0).merge(makeBracing(val, 24.25)).merge(makeBracing(val, 25 + HallwayWidth)).merge(makeBracing(val, 50 + HallwayWidth - .75)).merge(makeBracing(val, 70)).merge(makeBracing(val, 94.25));
	});
	return corridors[0].merge(corridors[1]).merge(corridors[2]);
}
function makeBracing(xOffset, zOffset) {
	return buildSegmentedWall([
		.75,
		9.5,
		.75
	], 12, [
		12,
		1,
		12
	], [], 1.25, 4, [materials.wood])[0].translate_(xOffset, 0, 11.875 + zOffset);
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/lever-door.ts
var LeverDoorObject3d = class extends Object3d {
	constructor(x, y, z, swapHingeSideX = 1, swapHingeSideZ = 1, swapOpenClosed, isLocked) {
		const mesh = new Mesh(new MoldableCubeGeometry(5, 7.75, .25).texturePerSide(materials.wood).merge(new MoldableCubeGeometry(1, 1, 1, 4, 4).cylindrify(.2, "z").translate_(2 * swapHingeSideX, -.5).texturePerSide(materials.silver)).done_(), materials.white);
		super(mesh);
		this.originalRot = 0;
		this.isLocked = false;
		this.openClose = -1;
		this.isAnimating = false;
		this.speed_ = 3;
		this.sfxPlayer = new SimplestMidiRev2();
		this.isLocked = !!isLocked;
		this.placedPosition = new EnhancedDOMPoint(x - (swapOpenClosed ? 2 * swapHingeSideX : 0), y, z - (swapOpenClosed ? 2 * swapHingeSideX : 0));
		this.swapHingeSideX = swapHingeSideX;
		this.swapHingeSideZ = swapHingeSideZ;
		this.sfxPlayer.volume_.connect(compressor);
		this.position.set(x - 2 * swapHingeSideX, y, z);
		this.children_[0].position.x = 2 * swapHingeSideX;
		this.collisionMesh = new Mesh(new MoldableCubeGeometry(swapOpenClosed ? 1 : 4, 7, swapOpenClosed ? 4 : 1).translate_(x - (swapOpenClosed ? 2 * swapHingeSideX : 0), y, z - (swapOpenClosed ? 2 * swapHingeSideX : 0)).done_(), new Material());
		this.placedPosition.y -= 3;
		this.closedDoorCollision = new Set(meshToFaces([this.collisionMesh]));
		if (swapOpenClosed) {
			this.rotation_.y = 90;
			this.originalRot = 90;
		}
	}
	pullLever(isEnemy = false) {
		this.speed_ = isEnemy ? 1 : 3;
		if (!this.isAnimating) {
			this.isAnimating = true;
			this.openClose *= -1;
			this.sfxPlayer.playNote(audioContext.currentTime, 10, 40, baseDrum, audioContext.currentTime + 1);
			if (isEnemy) this.sfxPlayer.playNote(audioContext.currentTime, 72, 20, doorOpening4, audioContext.currentTime + 1);
		}
	}
	update_() {
		if (this.isAnimating) {
			this.rotation_.y += this.swapHingeSideZ * this.swapHingeSideX * this.speed_ * this.openClose;
			if (Math.abs(this.rotation_.y) - this.originalRot === (this.openClose === -1 ? 0 : 120)) this.isAnimating = false;
		}
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/ai/path-node.ts
var PathNode = class {
	constructor(position, door, roomNumber, hidingPlace) {
		this.position = position;
		this.door = door;
		this.roomNumber = roomNumber;
		this.hidingPlace = hidingPlace;
	}
	getAllSiblings() {
		return [
			this.aboveSibling,
			this.belowSibling,
			this.rightSibling,
			this.leftSibling
		];
	}
	getPresentSiblings() {
		return this.getAllSiblings().filter((i) => i !== void 0);
	}
	attachThisRightToOtherLeft(other) {
		this.rightSibling = other;
		other.leftSibling = this;
	}
	attachThisLeftToOtherRight(other) {
		this.leftSibling = other;
		other.rightSibling = this;
	}
	insertBetweenVert(above, below) {
		this.aboveSibling = above;
		this.belowSibling = below;
		above.belowSibling = this;
		below.aboveSibling = this;
	}
	insertBetweenHor(left, right) {
		this.leftSibling = left;
		this.rightSibling = right;
		left.rightSibling = this;
		right.leftSibling = this;
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/hiding-place.ts
var HidingPlace = class {
	constructor(position, cameraRotation) {
		this.position = position;
		this.cameraRotation = cameraRotation;
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/item.ts
var Item = class {
	constructor(position, rotation, roomNumber) {
		this.isTaken = false;
		this.roomNumber = roomNumber;
		if (this.roomNumber) {
			if (this.roomNumber === -1) this.mesh = new Mesh(buildSegmentedWall([
				.5,
				2,
				.5,
				2,
				.5
			], 2, [
				2,
				.5,
				2,
				.5,
				2
			], [], 1, 4, [materials.red])[0].merge(new MoldableCubeGeometry(5.5, .5).texturePerSide(materials.red).translate_(0, -2, 0)).rotate_(0, 0, -Math.PI / 2).merge(new MoldableCubeGeometry(3, 4, 3, 8, 1, 8).cylindrify(6).all_().translate_(0, -5.5).texturePerSide(materials.white)).merge(new MoldableCubeGeometry(4, 1, 4, 8, 1, 8).cylindrify(8).all_().translate_(0, -8).texturePerSide(materials.white)).rotate_(0, Math.PI).scale_(.1, .1, .1).computeNormals().done_(), materials.silver);
			else this.mesh = new Mesh(new MoldableCubeGeometry(1, 1, .5, 3, 3).cylindrify(.75, "z").merge(buildSegmentedWall([
				1,
				.5,
				.5,
				.5
			], 1, [
				.25,
				1,
				.25,
				1
			], [0], .3)[0].translate_(1.75, -.75)).scale_(.5, .5, .5).translate_(-.5).done_(), materials.silver);
		} else this.mesh = new Mesh(new MoldableCubeGeometry(1.9, 1, .5).texturePerSide(materials.white).merge(new MoldableCubeGeometry(.75, .2, .75).texturePerSide(materials.red)).merge(new MoldableCubeGeometry(.2, .75, .75).texturePerSide(materials.red)).done_(), materials.wood);
		this.mesh.position.set(position);
		this.mesh.setRotation_(rotation.x, rotation.y, rotation.z);
		this.mesh.updateWorldMatrix();
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/ai/ai-nav-points.ts
var AiNavPoints = [];
var items = [];
var rightFacingRoomNumbers = [
	1304,
	1306,
	1308,
	1310,
	1311,
	1312
];
function createRoomNodes(roomPosition, roomNumber, door) {
	const isGoingRight = rightFacingRoomNumbers.includes(roomNumber);
	const roomEntranceNode = new PathNode(roomPosition, door, roomNumber);
	const bathEntranceOffset = new EnhancedDOMPoint(12, 0, -1);
	const roomOffset = new EnhancedDOMPoint(27, 0, -3);
	const closetHidingPlaceOffset = new EnhancedDOMPoint(35.5, 0, .5);
	const showerHidingPlaceOffset = new EnhancedDOMPoint(12.75, 0, -15);
	if (isGoingRight) {
		bathEntranceOffset.scale_(-1);
		roomOffset.scale_(-1);
		closetHidingPlaceOffset.scale_(-1);
		showerHidingPlaceOffset.scale_(-1);
	}
	const bathEntranceNode = new PathNode(new EnhancedDOMPoint(roomPosition.x + bathEntranceOffset.x, roomPosition.y, roomPosition.z + bathEntranceOffset.z), door, roomNumber, new HidingPlace(new EnhancedDOMPoint(roomPosition.x + showerHidingPlaceOffset.x, 5.5, roomPosition.z + showerHidingPlaceOffset.z), new EnhancedDOMPoint(0, isGoingRight ? 0 : 3.14)));
	const roomNode = new PathNode(new EnhancedDOMPoint(roomPosition.x + roomOffset.x, roomPosition.y, roomPosition.z + roomOffset.z), void 0, roomNumber, new HidingPlace(new EnhancedDOMPoint(roomPosition.x + closetHidingPlaceOffset.x, 5.5, roomPosition.z + closetHidingPlaceOffset.z), new EnhancedDOMPoint(0, isGoingRight ? -1.7 : 1.7)));
	bathEntranceNode.insertBetweenHor(isGoingRight ? roomEntranceNode : roomNode, isGoingRight ? roomNode : roomEntranceNode);
	return roomEntranceNode;
}
function makeNavPoints(doors) {
	const roomEntrances = [
		createRoomNodes(new EnhancedDOMPoint(44, 2.5, 36), 1301, doors[0]),
		createRoomNodes(new EnhancedDOMPoint(44, 2.5, 71), 1302, doors[1]),
		createRoomNodes(new EnhancedDOMPoint(44, 2.5, 106), 1303, doors[2]),
		createRoomNodes(new EnhancedDOMPoint(0, 2.5, 24), 1304, doors[3], true),
		createRoomNodes(new EnhancedDOMPoint(0, 2.5, 36), 1305, doors[4]),
		createRoomNodes(new EnhancedDOMPoint(0, 2.5, 59), 1306, doors[5], true),
		createRoomNodes(new EnhancedDOMPoint(0, 2.5, 71), 1307, doors[6]),
		createRoomNodes(new EnhancedDOMPoint(0, 2.5, 94), 1308, doors[7], true),
		createRoomNodes(new EnhancedDOMPoint(0, 2.5, 106), 1309, doors[8]),
		createRoomNodes(new EnhancedDOMPoint(-44, 2.5, 24), 1310, doors[9], true),
		createRoomNodes(new EnhancedDOMPoint(-44, 2.5, 59), 1311, doors[10], true),
		createRoomNodes(new EnhancedDOMPoint(-44, 2.5, 94), 1312, doors[11], true)
	];
	let roomsWorkingCopy = [...roomEntrances];
	const firstNode = roomsWorkingCopy[Math.floor(Math.random() * (roomsWorkingCopy.length - 1))];
	firstNode.door.isLocked = true;
	placeKeys(firstNode);
	function placeKeys(activeNode) {
		const scaler = rightFacingRoomNumbers.includes(activeNode.roomNumber) ? -1 : 1;
		const itemSpots = [[
			{
				position: new EnhancedDOMPoint(4.25 * scaler, 1.75, -7 * scaler),
				rotation_: new EnhancedDOMPoint(0, Math.PI / 4)
			},
			{
				position: new EnhancedDOMPoint(-4.5 * scaler, .5, -7.5 * scaler),
				rotation_: new EnhancedDOMPoint(0, -Math.PI / 2)
			},
			{
				position: new EnhancedDOMPoint(-5.5 * scaler, .75, -12.75 * scaler),
				rotation_: new EnhancedDOMPoint(0, 0, Math.PI / 2)
			}
		], [
			{
				position: new EnhancedDOMPoint(5.25 * scaler, -.75, -12 * scaler),
				rotation_: new EnhancedDOMPoint(0, 0, Math.PI / 2)
			},
			{
				position: new EnhancedDOMPoint(-1 * scaler, -.5, 8.4 * scaler),
				rotation_: new EnhancedDOMPoint(0, 0, -Math.PI / 2)
			},
			{
				position: new EnhancedDOMPoint(-2 * scaler, .8, -13.5 * scaler),
				rotation_: new EnhancedDOMPoint(Math.PI / 3 * -scaler, 0, 0)
			}
		]];
		roomsWorkingCopy = roomsWorkingCopy.filter((node) => node !== activeNode);
		let nextNode;
		let longestDistance = 0;
		const difference = new EnhancedDOMPoint();
		roomsWorkingCopy.forEach((node) => {
			const distance = difference.subtractVectors(activeNode.position, node.position).magnitude;
			if (distance > longestDistance) {
				longestDistance = distance;
				nextNode = node;
			}
		});
		if (Math.random() <= .3) nextNode = roomsWorkingCopy[Math.floor(Math.random() * (roomsWorkingCopy.length - 1))];
		const bathNode = activeNode.getPresentSiblings().find((node) => node.hidingPlace);
		const roomNode = bathNode.getPresentSiblings().find((node) => node.hidingPlace);
		const itemRoomIndex = Math.floor(Math.random() * 2);
		const itemSpotIndex = Math.floor(Math.random() * 3);
		const nodeToPlaceItemIn = [bathNode, roomNode][itemRoomIndex];
		if (roomsWorkingCopy.length > 3) {
			nodeToPlaceItemIn.item = new Item(new EnhancedDOMPoint().addVectors(nodeToPlaceItemIn.position, itemSpots[itemRoomIndex][itemSpotIndex].position), itemSpots[itemRoomIndex][itemSpotIndex].rotation_, nextNode.roomNumber);
			nextNode.door.isLocked = true;
		} else if (roomsWorkingCopy.length > 2) nodeToPlaceItemIn.item = new Item(new EnhancedDOMPoint().addVectors(nodeToPlaceItemIn.position, itemSpots[itemRoomIndex][itemSpotIndex].position), itemSpots[itemRoomIndex][itemSpotIndex].rotation_, 1313);
		else nodeToPlaceItemIn.item = new Item(new EnhancedDOMPoint().addVectors(nodeToPlaceItemIn.position, itemSpots[itemRoomIndex][itemSpotIndex].position), itemSpots[itemRoomIndex][itemSpotIndex].rotation_);
		items.push(nodeToPlaceItemIn.item);
		if (roomsWorkingCopy.length >= 1) placeKeys(nextNode);
	}
	const LowerLeftCorner = new PathNode(new EnhancedDOMPoint(44, 2.5, 12));
	const LowerRightCorner = new PathNode(new EnhancedDOMPoint(-44, 2.5, 12));
	const TopLeftCorner = new PathNode(new EnhancedDOMPoint(44, 2.5, 118));
	const TopRightCorner = new PathNode(new EnhancedDOMPoint(-44, 2.5, 118));
	const BottomCenterEntrance = new PathNode(new EnhancedDOMPoint(0, 2.5, 12));
	const LowerQuarterCenterIntersection = new PathNode(new EnhancedDOMPoint(0, 2.5, 47.5));
	const UpperQuarterCenterIntersection = new PathNode(new EnhancedDOMPoint(0, 2.5, 82.5));
	const TopCenterEntrance = new PathNode(new EnhancedDOMPoint(0, 2.5, 118.5), void 0, 1313);
	TopCenterEntrance.item = new Item(new EnhancedDOMPoint(0, 1.4, 20).add_(TopCenterEntrance.position), new EnhancedDOMPoint(), -1);
	items.push(TopCenterEntrance.item);
	const LowerQuarterLeftIntersection = new PathNode(new EnhancedDOMPoint(44, 2.5, 47.5));
	const UpperQuarterLeftIntersection = new PathNode(new EnhancedDOMPoint(44, 2.5, 82.5));
	const LowerQuarterRightIntersection = new PathNode(new EnhancedDOMPoint(-44, 2.5, 47.5));
	const UpperQuarterRightIntersection = new PathNode(new EnhancedDOMPoint(-44, 2.5, 82.5));
	TopLeftCorner.rightSibling = TopRightCorner;
	TopLeftCorner.belowSibling = LowerLeftCorner;
	TopRightCorner.belowSibling = LowerRightCorner;
	LowerLeftCorner.rightSibling = LowerRightCorner;
	BottomCenterEntrance.insertBetweenHor(LowerLeftCorner, LowerRightCorner);
	TopCenterEntrance.insertBetweenHor(TopLeftCorner, TopRightCorner);
	UpperQuarterCenterIntersection.insertBetweenVert(TopCenterEntrance, BottomCenterEntrance);
	LowerQuarterCenterIntersection.insertBetweenVert(UpperQuarterCenterIntersection, BottomCenterEntrance);
	LowerQuarterLeftIntersection.insertBetweenVert(TopLeftCorner, LowerLeftCorner);
	LowerQuarterLeftIntersection.attachThisRightToOtherLeft(LowerQuarterCenterIntersection);
	UpperQuarterLeftIntersection.insertBetweenVert(TopLeftCorner, LowerQuarterLeftIntersection);
	UpperQuarterLeftIntersection.attachThisRightToOtherLeft(UpperQuarterCenterIntersection);
	LowerQuarterRightIntersection.insertBetweenVert(TopRightCorner, LowerRightCorner);
	LowerQuarterRightIntersection.attachThisLeftToOtherRight(LowerQuarterCenterIntersection);
	UpperQuarterRightIntersection.insertBetweenVert(TopRightCorner, LowerQuarterRightIntersection);
	UpperQuarterRightIntersection.attachThisLeftToOtherRight(UpperQuarterCenterIntersection);
	roomEntrances[0].insertBetweenVert(LowerQuarterLeftIntersection, LowerLeftCorner);
	roomEntrances[1].insertBetweenVert(UpperQuarterLeftIntersection, LowerQuarterLeftIntersection);
	roomEntrances[2].insertBetweenVert(TopLeftCorner, UpperQuarterLeftIntersection);
	roomEntrances[9].insertBetweenVert(LowerQuarterRightIntersection, LowerRightCorner);
	roomEntrances[10].insertBetweenVert(UpperQuarterRightIntersection, LowerQuarterRightIntersection);
	roomEntrances[11].insertBetweenVert(TopRightCorner, UpperQuarterRightIntersection);
	roomEntrances[3].insertBetweenVert(LowerQuarterCenterIntersection, BottomCenterEntrance);
	roomEntrances[4].insertBetweenVert(LowerQuarterCenterIntersection, roomEntrances[3]);
	roomEntrances[5].insertBetweenVert(UpperQuarterCenterIntersection, LowerQuarterCenterIntersection);
	roomEntrances[6].insertBetweenVert(UpperQuarterCenterIntersection, roomEntrances[5]);
	roomEntrances[7].insertBetweenVert(TopCenterEntrance, UpperQuarterCenterIntersection);
	roomEntrances[8].insertBetweenVert(TopCenterEntrance, roomEntrances[7]);
	AiNavPoints.push(BottomCenterEntrance, LowerLeftCorner, LowerRightCorner, TopLeftCorner, TopRightCorner);
	return firstNode;
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/core/state-machine.ts
var StateMachine = class {
	constructor(initialState, ...enterArgs) {
		this.currentState = initialState;
		this.currentState.onEnter?.(...enterArgs);
	}
	setState(newState, ...enterArgs) {
		this.currentState.onLeave?.();
		this.currentState = { onUpdate: () => {} };
		newState.onEnter?.(...enterArgs);
		this.currentState = newState;
	}
	getState() {
		return this.currentState;
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/ai/enemy-model.ts
function upyri() {
	const obj = new Mesh(new MoldableCubeGeometry(1, 1, 1, 6, 6, 6).spherify(.8).scale_(1, 1.3, .8).selectBy((vert) => vert.y > .7).scale_(3, 1, 1.5).selectBy((vert) => vert.y > .8).scale_(1.5, 8, 2).texturePerSide(materials.iron, materials.iron, materials.iron, materials.iron, materials.face, materials.iron).all_().rotate_(Math.PI).translate_(0, 5).computeNormals(true).done_(), materials.face);
	obj.position.set(0, 54, 2);
	return obj;
}
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/ai/enemy-ai.ts
var Enemy = class {
	constructor() {
		this.spotSearchFrameCount = 0;
		this.spotsSearched = 0;
		this.pathCache = [];
		this.positionInPathCache = 0;
		this.travelingDirection = new EnhancedDOMPoint();
		this.nextNodeDifference = new EnhancedDOMPoint();
		this.nextNodeDistance = 0;
		this.nextNodeDirection = new EnhancedDOMPoint();
		this.currentNodeDifference = new EnhancedDOMPoint();
		this.songInterval = 0;
		this.currentInterval = 0;
		this.footstepPlayer = new SimplestMidiRev2();
		this.pannerNode = new PannerNode(audioContext, {
			distanceModel: "linear",
			maxDistance: 80,
			rolloffFactor: 99,
			coneOuterGain: .1
		});
		this.unseenFrameCount = 0;
		this.aggression = 0;
		this.songPlayer = new SimplestMidiRev2();
		this.lightObject = new Object3d();
		this.footstepDebounce = 0;
		this.isSpawned = false;
		this.killFrames = 300;
		this.killFrameCount = 0;
		this.farthestPoint = AiNavPoints[0];
		this.songPlayer.volume_.connect(biquadFilter);
		this.footstepPlayer.volume_.connect(this.pannerNode).connect(compressor);
		this.currentNode = AiNavPoints[2];
		this.position = new EnhancedDOMPoint().set(this.currentNode.position);
		this.nextNode = this.currentNode;
		this.patrolState = {
			onEnter: () => {
				this.stopSong();
			},
			onUpdate: (player) => this.patrolUpdate(player)
		};
		this.chaseState = {
			onEnter: (player) => this.chaseEnter(player),
			onUpdate: (player) => this.chaseUpdate(player)
		};
		this.searchState = {
			onEnter: () => this.searchEnter(),
			onUpdate: (player) => this.searchUpdate(player)
		};
		this.fleeState = {
			onEnter: (player) => this.fleeEnter(player),
			onUpdate: () => this.fleeUpdate()
		};
		this.killState = {
			onUpdate: (player) => this.killUpdate(player),
			onEnter: (player) => this.killEnter(player)
		};
		this.stateMachine = new StateMachine(this.patrolState);
		this.model_ = upyri();
		this.model_.add_(this.lightObject);
	}
	spawn(player) {
		lightInfo.pointLightAttenuation.set(.005, .001, .4);
		this.isSpawned = true;
		this.setFarthestPoint(player);
		this.position.set(this.farthestPoint.position);
		this.currentNode = this.farthestPoint;
		const siblings = this.currentNode.getPresentSiblings();
		this.nextNode = siblings[Math.floor(Math.random() * siblings.length)];
		this.stateMachine.setState(this.patrolState);
	}
	playSong() {
		const playSong = () => {
			for (const note of song) this.songPlayer.playNote(audioContext.currentTime + note[2], note[1], note[4] - 10, [violin, frenchHorn][note[0]], audioContext.currentTime + note[2] + note[3]);
		};
		this.songPlayer.volume_.gain.cancelScheduledValues(audioContext.currentTime);
		this.songPlayer.volume_.gain.setValueAtTime(1, audioContext.currentTime);
		playSong();
		this.songInterval = setInterval(playSong, 6e3);
	}
	stopSong() {
		this.songPlayer.volume_.gain.linearRampToValueAtTime(0, audioContext.currentTime + 1);
		clearInterval(this.songInterval);
	}
	increaseAggression() {
		if (this.aggression <= .9) this.aggression += .1;
	}
	decreaseAggression() {
		this.aggression *= .4;
	}
	getMaxUnseenFramesBeforeGivingUp() {
		return 600 + 600 * this.aggression;
	}
	getSpeed() {
		return Math.min(.15 + .23 * this.aggression, .3);
	}
	updateNodeDistanceData() {
		this.nextNodeDifference.subtractVectors(this.nextNode.position, this.position);
		this.nextNodeDistance = this.nextNodeDifference.magnitude;
		this.nextNodeDirection = this.nextNodeDifference.clone_().normalize_();
		this.currentNodeDifference.subtractVectors(this.currentNode.position, this.position);
	}
	updateLight(followDistance, height) {
		this.lightObject.position.z = followDistance;
		lightInfo.pointLightPosition.set(this.lightObject.worldMatrix.transformPoint(new EnhancedDOMPoint(0, 0, 0)));
		lightInfo.pointLightPosition.y = height;
	}
	update_(player) {
		if (!this.isSpawned) {
			this.model_.position.y = -1e3;
			this.currentNode = AiNavPoints[0];
			this.stopSong();
			return;
		}
		this.updateNodeDistanceData();
		this.stateMachine.getState().onUpdate(player);
		this.model_.position.set(this.position);
	}
	patrolUpdate(player) {
		this.checkVision(player);
		if (player.closestNavPoint.hidingPlace) this.updateLight(4, 2);
		else this.updateLight(8, 9);
		if (this.handleDoor(player)) return;
		if (this.nextNodeDistance > 6 - this.getSpeed() * 2) {
			this.travelingDirection.lerp(this.nextNodeDirection, this.getSpeed() / 4);
			this.moveInTravelingDirection();
		} else {
			this.moveInTravelingDirection();
			let lastNode = this.currentNode;
			this.currentNode = this.nextNode;
			if (Math.random() < this.aggression / 3) this.advancePathToNode(player.closestNavPoint);
			else {
				let siblings = this.currentNode.getPresentSiblings();
				if (siblings.length > 1) siblings = siblings.filter((p) => {
					const isGoingToEnterRoom = this.currentNode.door && p.door && this.currentNode.roomNumber === p.roomNumber && this.currentNode !== p && !this.currentNode.hidingPlace;
					return p !== lastNode && !isGoingToEnterRoom;
				});
				this.nextNode = siblings[Math.floor(Math.random() * siblings.length)];
			}
		}
		if (!this.nextNode) this.nextNode = this.currentNode;
	}
	moveInTravelingDirection() {
		if (this.nextNodeDistance > .3) {
			const enemyFeetPos = 2.5;
			this.position.add_(this.travelingDirection.clone_().normalize_().scale_(this.getSpeed()));
			this.model_.lookAt(new EnhancedDOMPoint().addVectors(this.position, this.travelingDirection));
			this.position.y = enemyFeetPos + Math.sin(this.position.x + this.position.z) * .1;
			if (this.position.y < 2.402) {
				clearTimeout(this.footstepDebounce);
				this.footstepDebounce = setTimeout(() => this.footstepPlayer.playNote(audioContext.currentTime, 38 + Math.random() * 4, 60, footstep, audioContext.currentTime + 1), 40);
			}
			this.currentInterval++;
			this.pannerNode.positionX.value = this.position.x;
			this.pannerNode.positionZ.value = this.position.z;
		} else this.position.set(this.nextNode.position);
	}
	handleRoomEntering(player, timeout) {
		if (this.currentNode.roomNumber === player.closestNavPoint.roomNumber) setTimeout(() => {
			if (player.isHiding) this.stateMachine.setState(this.searchState, player);
			else if (this.stateMachine.getState() !== this.chaseState) this.stateMachine.setState(this.chaseState, player);
		}, timeout);
	}
	handleDoor(player) {
		if (this.currentNode.door && this.nextNode.door && this.currentNode.roomNumber === this.nextNode.roomNumber && this.currentNode !== this.nextNode) {
			if (this.currentNode.door.openClose === -1 || this.currentNode.door.isAnimating) {
				if (!this.currentNode.door.isAnimating) {
					this.currentNode.door.pullLever(true);
					this.model_.lookAt(this.nextNode.position);
					this.travelingDirection.set(this.nextNodeDirection);
					this.handleRoomEntering(player, 2e3);
				}
				return true;
			} else if (!this.currentNode.door.isAnimating) this.handleRoomEntering(player, 100);
		}
		return false;
	}
	chaseEnter(player) {
		this.stopSong();
		this.playSong();
		this.pathCache = [];
		this.positionInPathCache = 0;
		this.advancePathToNode(player.closestNavPoint);
		this.nextNode = this.pathCache[1] ?? this.currentNode;
		this.positionInPathCache++;
		const direction = new EnhancedDOMPoint().subtractVectors(this.nextNode.position, this.position).normalize_();
		this.travelingDirection.set(direction);
		this.unseenFrameCount = 0;
	}
	chaseUpdate(player) {
		this.updateLight(8, 9);
		if (this.handleDoor(player)) return;
		this.unseenFrameCount++;
		this.checkVision(player);
		if (this.unseenFrameCount >= this.getMaxUnseenFramesBeforeGivingUp()) {
			this.stateMachine.setState(this.fleeState, player);
			this.increaseAggression();
		}
		if (this.currentNode.hidingPlace && player.isHiding && player.closestNavPoint === this.currentNode || (this.currentNode === player.closestNavPoint || this.nextNode === player.closestNavPoint) && new EnhancedDOMPoint().subtractVectors(this.position, player.feetCenter).magnitude < 7) {
			this.stateMachine.setState(this.killState, player);
			return;
		}
		const nodeDistance = this.nextNode.door ? 1 : 6;
		if (this.nextNodeDistance > nodeDistance - this.getSpeed() * 2) {
			this.travelingDirection.lerp(this.nextNodeDirection, this.getSpeed() / 4);
			this.moveInTravelingDirection();
		} else {
			this.moveInTravelingDirection();
			this.currentNode = this.nextNode;
			this.advancePathToNode(player.closestNavPoint);
			if (!this.nextNode) this.nextNode = this.currentNode;
		}
	}
	advancePathToNode(node) {
		if (this.lastPlayerNode === node && this.pathCache.length) {
			this.nextNode = this.pathCache[this.positionInPathCache];
			if (this.positionInPathCache < this.pathCache.length - 1) this.positionInPathCache++;
			return;
		}
		this.positionInPathCache = 0;
		this.lastPlayerNode = node;
		const search = (start, target) => {
			if (start === target) return [start];
			const queue = [{
				node_: start,
				path_: [start]
			}];
			const visited = /* @__PURE__ */ new Set();
			while (queue.length > 0) {
				const { node_, path_ } = queue.shift();
				visited.add(node_);
				for (const sibling of node_.getPresentSiblings()) if (!visited.has(sibling)) {
					const newPath = [...path_, sibling];
					if (sibling === target) return newPath;
					queue.push({
						node_: sibling,
						path_: newPath
					});
				}
			}
		};
		this.pathCache = search(this.currentNode, node);
	}
	killEnter(player) {
		this.killFrameCount = 0;
		this.stopSong();
		player.isFlashlightOn = false;
		const lookAtTarget = new EnhancedDOMPoint().set(player.feetCenter);
		this.model_.lookAt(lookAtTarget);
		this.footstepPlayer.playNote(audioContext.currentTime, 70, 100, footstep, audioContext.currentTime + 1);
		this.footstepPlayer.playNote(audioContext.currentTime + .1, 1, 80, elevatorDoorTest, audioContext.currentTime + 5);
		if (player.isHiding) player.unhide();
		player.isFrozen_ = true;
	}
	killUpdate(player) {
		this.updateLight(5, 5);
		this.killFrameCount++;
		player.health -= .1;
		if (this.killFrameCount === this.killFrames) {
			this.spawn(player);
			player.isFrozen_ = false;
			this.decreaseAggression();
		}
	}
	checkVision(player) {
		const followPathToEnd = (node, directionIndex) => {
			const sibling = node?.getAllSiblings()[directionIndex];
			if (sibling && (!sibling.door || sibling.door.openClose === 1 || !(sibling.roomNumber && node.roomNumber && sibling.roomNumber === node.roomNumber))) {
				if (sibling === player.closestNavPoint) {
					const isPlayerCloseEnough = directionIndex < 2 && Math.abs(player.differenceFromNavPoint.x) < 5.75 || directionIndex > 1 && Math.abs(player.differenceFromNavPoint.z) < 5.75;
					const isEnemyCloseEnough = directionIndex < 2 && Math.abs(this.currentNodeDifference.x) < 5.75 || directionIndex > 1 && Math.abs(this.currentNodeDifference.z) < 5.75;
					if (!player.isHiding && isPlayerCloseEnough && isEnemyCloseEnough) {
						if (new EnhancedDOMPoint().subtractVectors(player.feetCenter, this.position).magnitude < 60) {
							this.unseenFrameCount = 0;
							if (this.stateMachine.getState() !== this.chaseState) this.stateMachine.setState(this.chaseState, player);
							return true;
						}
					}
				} else followPathToEnd(sibling, directionIndex);
			}
		};
		const isPlayerCloseEnough = Math.abs(player.differenceFromNavPoint.x) < 5.75 || Math.abs(player.differenceFromNavPoint.z) < 5.75;
		const isEnemyCloseEnough = Math.abs(this.currentNodeDifference.x) < 5.75 || Math.abs(this.currentNodeDifference.z) < 5.75;
		if (!player.isHiding && this.currentNode === player.closestNavPoint && isPlayerCloseEnough && isEnemyCloseEnough) {
			this.unseenFrameCount = 0;
			if (this.stateMachine.getState() !== this.chaseState) this.stateMachine.setState(this.chaseState, player);
			return;
		}
		followPathToEnd(this.currentNode, 0) || followPathToEnd(this.currentNode, 1) || followPathToEnd(this.currentNode, 2) || followPathToEnd(this.currentNode, 3);
	}
	searchEnter() {
		this.spotsSearched = 0;
	}
	searchUpdate(player) {
		this.updateLight(5, 5);
		if (!player.isHiding) this.stateMachine.setState(this.chaseState, player);
		if (this.nextNodeDistance > .5) {
			this.travelingDirection.lerp(this.nextNodeDirection, 1);
			this.moveInTravelingDirection();
		} else if (this.spotSearchFrameCount <= 300) {
			this.model_.rotate_(0, this.spotSearchFrameCount > 100 ? -.02 : .02, 0);
			this.spotSearchFrameCount++;
		} else {
			this.spotsSearched++;
			this.currentNode = this.nextNode;
			if (this.currentNode === player.closestNavPoint && Math.random() < Math.min(this.aggression, .3)) {
				this.stateMachine.setState(this.killState, player);
				return;
			}
			this.nextNode = this.currentNode.getPresentSiblings().find((node) => node.hidingPlace);
			this.updateNodeDistanceData();
			this.spotSearchFrameCount = 0;
			if (this.spotsSearched >= 2 && Math.random() > .25) {
				this.stateMachine.setState(this.fleeState, player);
				this.increaseAggression();
			}
		}
	}
	setFarthestPoint(player) {
		let longestDistance = 0;
		const difference = new EnhancedDOMPoint();
		AiNavPoints.forEach((node) => {
			const distance = difference.subtractVectors(player.feetCenter, node.position).magnitude;
			if (distance > longestDistance) {
				longestDistance = distance;
				this.farthestPoint = node;
			}
		});
	}
	fleeEnter(player) {
		this.stopSong();
		this.setFarthestPoint(player);
		this.advancePathToNode(this.farthestPoint);
		this.nextNode = this.pathCache[0];
		this.updateNodeDistanceData();
	}
	fleeUpdate() {
		this.updateLight(3, 9);
		if (this.nextNodeDistance > 1) {
			this.travelingDirection.lerp(this.nextNodeDirection, 1);
			this.moveInTravelingDirection();
		} else {
			this.moveInTravelingDirection();
			this.currentNode = this.nextNode;
			this.advancePathToNode(this.farthestPoint);
			if (!this.nextNode) this.nextNode = this.currentNode;
			if (this.nextNode === this.farthestPoint) this.stateMachine.setState(this.patrolState);
		}
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/game-states/game.state.ts
var GameState = class {
	constructor() {
		this.gridFaces = [];
		this.hasPlayerLeftElevator = false;
		this.hasEnemySpawned = false;
		this.sfxPlayer = new SimplestMidiRev2();
		this.isGameEnded = false;
		this.playerDoorDifference = new EnhancedDOMPoint();
		this.playerHidingPlaceDifference = new EnhancedDOMPoint();
		this.deathTriggered = false;
		this.sfxPlayer.volume_.connect(biquadFilter);
		this.scene = new Scene();
		this.doors = [
			new LeverDoorObject3d(48, 4.75, 33.75, -1, -1, true),
			new LeverDoorObject3d(48, 4.75, 68.75, -1, -1, true),
			new LeverDoorObject3d(48, 4.75, 103.75, -1, -1, true),
			new LeverDoorObject3d(-4, 4.75, 26.25, 1, 1, true),
			new LeverDoorObject3d(4, 4.75, 33.75, -1, -1, true),
			new LeverDoorObject3d(-4, 4.75, 61.25, 1, 1, true),
			new LeverDoorObject3d(4, 4.75, 68.75, -1, -1, true),
			new LeverDoorObject3d(-4, 4.75, 96.25, 1, 1, true),
			new LeverDoorObject3d(4, 4.75, 103.75, -1, -1, true),
			new LeverDoorObject3d(-48, 4.75, 26.25, 1, 1, true),
			new LeverDoorObject3d(-48, 4.75, 61.25, 1, 1, true),
			new LeverDoorObject3d(-48, 4.75, 96.25, 1, 1, true),
			new LeverDoorObject3d(2.5, 4.75, 124, -1, -1, false, true),
			new LeverDoorObject3d(-2.5, 4.75, 124, 1, -1, false, true)
		];
		const firstKeyRoomNum = makeNavPoints(this.doors).roomNumber;
		this.player = new FirstPersonPlayer(new Camera(Math.PI / 3, 16 / 9, 1, 500), AiNavPoints[0]);
		this.player.heldKeyRoomNumber = firstKeyRoomNum;
		this.enemy = new Enemy();
		this.elevator = new Elevator();
	}
	onEnter() {
		const floor = new Mesh(new MoldableCubeGeometry(180, 1, 180, 20, 1, 20).spreadTextureCoords(5, 5).translate_(0, 0, 64).done_(), materials.redCarpet);
		const ceiling = new Mesh(new MoldableCubeGeometry(170, 1, 160).translate_(0, 12, 65).done_().spreadTextureCoords(5, 5), materials.ceilingTiles);
		const hotelRender = new Mesh(makeHotel(true).translate_(0, 0, 6).done_(), materials.wallpaper);
		const hotelCollision = new Mesh(makeHotel().translate_(0, 0, 6).done_(), materials.wallpaper);
		this.scene.add_(...this.elevator.meshes, ceiling, floor, hotelRender, ...this.doors, this.enemy.model_, ...items.map((i) => i.mesh));
		this.gridFaces = build2dGrid(meshToFaces([
			floor,
			hotelCollision,
			this.elevator.bodyCollision
		]));
		this.player.cameraRotation.set(0, Math.PI, 0);
		this.player.sfxPlayer.playNote(audioContext.currentTime, 60, 70, elevatorMotionRev1, audioContext.currentTime + 6);
		setTimeout(() => {
			this.elevator.isOpenTriggered = true;
			this.playElevatorSound();
		}, 7e3);
	}
	onUpdate() {
		tmpl.innerHTML = "";
		this.player.update(this.gridFaces);
		this.enemy.update_(this.player);
		this.elevator.update();
		this.scene.updateWorldMatrix();
		render(this.player.camera, this.scene);
		if (!this.elevator.isOpen) findWallCollisionsFromList(this.elevator.doorCollision, this.player);
		[
			this.player.closestNavPoint.door,
			this.doors[12],
			this.doors[13]
		].forEach((door, i) => {
			if (door) {
				const distance = this.playerDoorDifference.subtractVectors(this.player.feetCenter, door.placedPosition).magnitude;
				if (door.openClose === -1 && !door.isAnimating && distance < 7) findWallCollisionsFromList(door.closedDoorCollision, this.player);
				if (distance < 8) {
					const direction = this.player.normal.dot(this.playerDoorDifference.normalize_());
					if (distance < 1 || direction < -.77) {
						if (door.isLocked) {
							if (this.player.heldKeyRoomNumber === this.player.closestNavPoint.roomNumber) {
								tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">🗝️ &nbsp; Unlock and Open</div>`;
								if (controls.isConfirm) {
									door.pullLever();
									door.isLocked = false;
									this.player.heldKeyRoomNumber = void 0;
									if (i > 0) {
										this.doors[12].pullLever();
										this.doors[12].isLocked = false;
										this.doors[13].pullLever();
										this.doors[13].isLocked = false;
									}
								}
							} else tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">🔒 &nbsp; Locked</div>`;
						} else if (this.enemy.currentNode.door === door) tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">🚫</div>`;
						else {
							tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">${door.openClose === -1 ? "Open" : "Close"} Door</div>`;
							if (controls.isConfirm) door.pullLever();
						}
					}
				}
			}
		});
		this.doors.forEach((door) => {
			if (door.isAnimating) door.update_();
		});
		const hidingPlace = this.player.closestNavPoint.hidingPlace;
		if (hidingPlace) {
			if (this.playerHidingPlaceDifference.subtractVectors(this.player.camera.position, hidingPlace.position).magnitude < 8) {
				if (this.player.normal.dot(this.playerHidingPlaceDifference.normalize_()) < -.77 && !this.player.isHiding) {
					tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">Hide</div>`;
					if (controls.isConfirm && !controls.prevConfirm) this.player.hide(hidingPlace);
				}
			}
		}
		const item = this.player.closestNavPoint.item;
		if (item && !item.isTaken) {
			if (this.playerHidingPlaceDifference.subtractVectors(this.player.camera.position, item.mesh.position).magnitude < 6) {
				if (this.player.normal.dot(this.playerHidingPlaceDifference.normalize_()) < -.9) {
					if (item.roomNumber) {
						if (item.roomNumber === -1) tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">🎂 Make a Wish</div>`;
						else tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">🗝️ Take Room ${item.roomNumber} Key</div>`;
					} else tmpl.innerHTML += `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">Use Health Pack</div>`;
					if (controls.isConfirm && !controls.prevConfirm) {
						item.isTaken = true;
						if (item.roomNumber !== -1) {
							this.scene.remove_(item.mesh);
							this.sfxPlayer.playNote(audioContext.currentTime, 90, 30, hideSound, audioContext.currentTime + 1);
						}
						if (item.roomNumber) {
							this.player.heldKeyRoomNumber = item.roomNumber;
							this.enemy.increaseAggression();
							if (!this.hasEnemySpawned) {
								lightInfo.pointLightAttenuation.set(.001, .001, .4);
								this.enemy.aggression = 0;
								this.hasEnemySpawned = true;
								this.enemy.spawn(this.player);
							}
							if (item.roomNumber === 1313) {
								this.enemy.isSpawned = false;
								lightInfo.pointLightPosition.set(0, 3.7, 138);
							}
							if (item.roomNumber === -1) {
								this.sfxPlayer.playNote(audioContext.currentTime, 120, 30, hideSound, audioContext.currentTime + 1);
								lightInfo.pointLightPosition.set(0, 8, 0);
								setTimeout(() => {
									this.elevator.isOpenTriggered = true;
									this.playElevatorSound();
								}, 1e3);
							}
						}
						if (!item.roomNumber) this.player.heal();
					}
				}
			}
		}
		if (!this.hasPlayerLeftElevator) {
			if (new EnhancedDOMPoint().subtractVectors(this.player.feetCenter, AiNavPoints[0].position).magnitude > 17) {
				this.hasPlayerLeftElevator = true;
				this.elevator.isCloseTriggered = true;
				this.playElevatorSound();
			}
		}
		if (this.hasPlayerLeftElevator && this.player.feetCenter.z < 3) {
			this.player.isFrozen_ = true;
			tmpl.innerHTML += `<div style="font-size: 40px; text-align: center; position: absolute; bottom: 20px; width: 100%;">You Win!</div>`;
			if (!this.isGameEnded) {
				this.isGameEnded = true;
				this.elevator.isCloseTriggered = true;
				this.playElevatorSound();
			}
		}
		if (this.player.health <= 0 && !this.deathTriggered) {
			this.deathTriggered = true;
			alert("YOU DIED");
			location.reload();
		}
	}
	playElevatorSound() {
		this.player.sfxPlayer.playNote(audioContext.currentTime, 60, 70, elevatorDoor1, audioContext.currentTime + 4);
		this.player.sfxPlayer.playNote(audioContext.currentTime + .5, 60, 70, footstep, audioContext.currentTime + 2.5);
		this.player.sfxPlayer.playNote(audioContext.currentTime + 1.8, 60, 70, footstep, audioContext.currentTime + 2.5);
		this.sfxPlayer.playNote(audioContext.currentTime, 60, 70, elevatorDoorTest, audioContext.currentTime + 1);
	}
};
//#endregion
//#region game-sources/upstream/expansion/13th-floor/src/index.ts
var previousTime = 0;
var interval = 1e3 / 60;
tmpl.innerHTML = `<div style="font-size: 30px; text-align: center; position: absolute; bottom: 20px; width: 100%;">Click to Start</div>`;
document.onclick = async () => {
	document.onclick = null;
	Promise.resolve(tmpl.requestPointerLock()).catch(() => {});
	tmpl.innerHTML = "";
	await initTextures();
	const gameState = new GameState();
	gameState.onEnter();
	draw(0);
	document.onclick = () => Promise.resolve(tmpl.requestPointerLock()).catch(() => {});
	function draw(currentTime) {
		const delta = currentTime - previousTime;
		if (delta >= interval) {
			previousTime = currentTime - delta % interval;
			controls.queryController();
			gameState.onUpdate();
		}
		requestAnimationFrame(draw);
	}
};
//#endregion
