(function() {
	//#region game-sources/upstream/expansion/backcountry/src/components/com_index.ts
	var Get = /* @__PURE__ */ function(Get) {
		Get[Get["Transform"] = 1] = "Transform";
		Get[Get["Render"] = 2] = "Render";
		Get[Get["Draw"] = 3] = "Draw";
		Get[Get["Camera"] = 4] = "Camera";
		Get[Get["Light"] = 5] = "Light";
		Get[Get["AudioSource"] = 6] = "AudioSource";
		Get[Get["Animate"] = 7] = "Animate";
		Get[Get["Move"] = 8] = "Move";
		Get[Get["Collide"] = 9] = "Collide";
		Get[Get["Trigger"] = 10] = "Trigger";
		Get[Get["Navigable"] = 11] = "Navigable";
		Get[Get["Select"] = 12] = "Select";
		Get[Get["Shoot"] = 13] = "Shoot";
		Get[Get["PlayerControl"] = 14] = "PlayerControl";
		Get[Get["Health"] = 15] = "Health";
		Get[Get["Mimic"] = 16] = "Mimic";
		Get[Get["EmitParticles"] = 17] = "EmitParticles";
		Get[Get["Cull"] = 18] = "Cull";
		Get[Get["Walking"] = 19] = "Walking";
		Get[Get["NPC"] = 20] = "NPC";
		Get[Get["Projectile"] = 21] = "Projectile";
		Get[Get["Shake"] = 22] = "Shake";
		Get[Get["Lifespan"] = 23] = "Lifespan";
		return Get;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_draw.ts
	function draw(Widget, Args = []) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Draw;
			game[Get.Draw][entity] = {
				Widget,
				Args
			};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_lifespan.ts
	function lifespan(Max = Infinity) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Lifespan;
			game[Get.Lifespan][entity] = {
				Max,
				Age: 0
			};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/math/random.ts
	var seed = 1;
	function set_seed(new_seed) {
		seed = 198706 * new_seed;
	}
	function rand() {
		seed = seed * 16807 % 2147483647;
		return (seed - 1) / 2147483646;
	}
	function integer(min = 0, max = 1) {
		return ~~(rand() * (max - min + 1) + min);
	}
	function element(arr) {
		return arr[integer(0, arr.length - 1)];
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/sounds/snd_gold.ts
	var snd_gold = {
		Tracks: [{
			Instrument: [
				5,
				,
				,
				,
				,
				,
				,
				,
				[[
					"triangle",
					7,
					1,
					0,
					5,
					8
				]]
			],
			Notes: [86]
		}, {
			Instrument: [
				5,
				,
				,
				,
				,
				,
				,
				,
				[[
					"triangle",
					7,
					1,
					0,
					5,
					8
				]]
			],
			Notes: [96]
		}],
		Exit: 0
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/math/easing.ts
	function ease_in_cubic(t) {
		return t ** 3;
	}
	function ease_out_quart(t) {
		return 1 - (1 - t) ** 4;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/widgets/wid_player_hit.ts
	function widget_player_hit(game, entity, x, y) {
		let lifespan = game[Get.Lifespan][entity];
		let opacity = .4 * ease_in_cubic(1 - lifespan.Age / lifespan.Max);
		game.Context.fillStyle = `rgba(255,79,79,${opacity})`;
		game.Context.fillRect(0, 0, game.Canvas2.width, game.Canvas2.height);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/widgets/wid_value.ts
	function widget_value(game, entity, x, y) {
		let [value, prefix = ""] = game[Get.Draw][entity].Args;
		let lifespan = game[Get.Lifespan][entity];
		let relative = lifespan.Age / lifespan.Max;
		game.Context.font = `${value / 125 + 1}vmin Impact`;
		game.Context.textAlign = "center";
		game.Context.fillStyle = `rgba(255,${prefix ? "255,0" : "232,198"},${ease_out_quart(1 - relative)})`;
		game.Context.fillText(prefix + value.toFixed(0), prefix ? x + 100 : x, y - 50 - ease_out_quart(relative) * value / 5);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_cull.ts
	function cull(Component) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Cull;
			game[Get.Cull][entity] = { Component };
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/materials/mat_index.ts
	var Mat = /* @__PURE__ */ function(Mat) {
		Mat[Mat["Wireframe"] = 0] = "Wireframe";
		Mat[Mat["Instanced"] = 1] = "Instanced";
		Mat[Mat["Particles"] = 2] = "Particles";
		return Mat;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/shapes/Cube.ts
	var Cube = {
		Vertices: Float32Array.from([
			-.5,
			-.5,
			.5,
			-.5,
			.5,
			.5,
			-.5,
			.5,
			-.5,
			-.5,
			-.5,
			-.5,
			-.5,
			-.5,
			-.5,
			-.5,
			.5,
			-.5,
			.5,
			.5,
			-.5,
			.5,
			-.5,
			-.5,
			.5,
			-.5,
			-.5,
			.5,
			.5,
			-.5,
			.5,
			.5,
			.5,
			.5,
			-.5,
			.5,
			.5,
			-.5,
			.5,
			.5,
			.5,
			.5,
			-.5,
			.5,
			.5,
			-.5,
			-.5,
			.5,
			-.5,
			-.5,
			-.5,
			.5,
			-.5,
			-.5,
			.5,
			-.5,
			.5,
			-.5,
			-.5,
			.5,
			.5,
			.5,
			-.5,
			-.5,
			.5,
			-.5,
			-.5,
			.5,
			.5,
			.5,
			.5,
			.5
		]),
		Indices: Uint16Array.from([
			0,
			1,
			2,
			0,
			2,
			3,
			4,
			5,
			6,
			4,
			6,
			7,
			8,
			9,
			10,
			8,
			10,
			11,
			12,
			13,
			14,
			12,
			14,
			15,
			16,
			17,
			18,
			16,
			18,
			19,
			20,
			21,
			22,
			20,
			22,
			23
		]),
		Normals: Float32Array.from([
			-1,
			0,
			0,
			-1,
			0,
			0,
			-1,
			0,
			0,
			-1,
			0,
			0,
			0,
			0,
			-1,
			0,
			0,
			-1,
			0,
			0,
			-1,
			0,
			0,
			-1,
			1,
			0,
			0,
			1,
			0,
			0,
			1,
			0,
			0,
			1,
			0,
			0,
			0,
			0,
			1,
			0,
			0,
			1,
			0,
			0,
			1,
			0,
			0,
			1,
			0,
			-1,
			0,
			0,
			-1,
			0,
			0,
			-1,
			0,
			0,
			-1,
			0,
			0,
			1,
			0,
			0,
			1,
			0,
			0,
			1,
			0,
			0,
			1,
			0
		])
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/webgl.ts
	/**
	* Passed to clear to clear the current color buffer.
	* @constant {number}
	*/
	var GL_COLOR_BUFFER_BIT = 16384;
	/**
	* Passed to bufferData as a hint about whether the contents of the buffer are likely to be used often and not change often.
	* @constant {number}
	*/
	var GL_STATIC_DRAW = 35044;
	/**
	* Passed to bufferData as a hint about whether the contents of the buffer are likely to be used often and change often.
	* @constant {number}
	*/
	var GL_DYNAMIC_DRAW = 35048;
	/**
	* Passed to bindBuffer or bufferData to specify the type of buffer being used.
	* @constant {number}
	*/
	var GL_ARRAY_BUFFER = 34962;
	/**
	* Passed to bindBuffer or bufferData to specify the type of buffer being used.
	* @constant {number}
	*/
	var GL_ELEMENT_ARRAY_BUFFER = 34963;
	/**
	* Passed to enable/disable to turn on/off culling. Can also be used with getParameter to find the current culling method.
	* @constant {number}
	*/
	var GL_CULL_FACE = 2884;
	/**
	* Passed to enable/disable to turn on/off the depth test. Can also be used with getParameter to query the depth test.
	* @constant {number}
	*/
	var GL_DEPTH_TEST = 2929;
	/**
	* Passed to createShader to define a fragment shader.
	* @constant {number}
	*/
	var GL_FRAGMENT_SHADER = 35632;
	/**
	* Passed to createShader to define a vertex shader.
	* @constant {number}
	*/
	var GL_VERTEX_SHADER = 35633;
	var GL_UNSIGNED_SHORT = 5123;
	var GL_FLOAT = 5126;
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_render.ts
	var RenderKind = /* @__PURE__ */ function(RenderKind) {
		RenderKind[RenderKind["Basic"] = 0] = "Basic";
		RenderKind[RenderKind["Instanced"] = 1] = "Instanced";
		RenderKind[RenderKind["Particles"] = 2] = "Particles";
		return RenderKind;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_render_vox.ts
	function render_vox(model, Palette) {
		let shape = Cube;
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Render;
			game[Get.Render][entity] = {
				Kind: RenderKind.Instanced,
				Material: game.Materials[Mat.Instanced],
				VAO: buffer(game.GL, shape, model),
				IndexCount: shape.Indices.length,
				InstanceCount: model.length / 4,
				Palette
			};
		};
	}
	var InstancedAttribute = /* @__PURE__ */ function(InstancedAttribute) {
		InstancedAttribute[InstancedAttribute["Position"] = 1] = "Position";
		InstancedAttribute[InstancedAttribute["Normal"] = 2] = "Normal";
		InstancedAttribute[InstancedAttribute["Offset"] = 3] = "Offset";
		return InstancedAttribute;
	}({});
	var InstancedUniform = /* @__PURE__ */ function(InstancedUniform) {
		InstancedUniform[InstancedUniform["PV"] = 0] = "PV";
		InstancedUniform[InstancedUniform["World"] = 1] = "World";
		InstancedUniform[InstancedUniform["Self"] = 2] = "Self";
		InstancedUniform[InstancedUniform["Palette"] = 3] = "Palette";
		InstancedUniform[InstancedUniform["LightCount"] = 4] = "LightCount";
		InstancedUniform[InstancedUniform["LightPositions"] = 5] = "LightPositions";
		InstancedUniform[InstancedUniform["LightDetails"] = 6] = "LightDetails";
		return InstancedUniform;
	}({});
	function buffer(gl, shape, offsets) {
		let vao = gl.createVertexArray();
		gl.bindVertexArray(vao);
		gl.bindBuffer(GL_ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(GL_ARRAY_BUFFER, shape.Vertices, GL_STATIC_DRAW);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, GL_FLOAT, false, 0, 0);
		gl.bindBuffer(GL_ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(GL_ARRAY_BUFFER, shape.Normals, GL_STATIC_DRAW);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 3, GL_FLOAT, false, 0, 0);
		gl.bindBuffer(GL_ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(GL_ARRAY_BUFFER, offsets, GL_STATIC_DRAW);
		gl.enableVertexAttribArray(3);
		gl.vertexAttribPointer(3, 4, GL_FLOAT, false, 0, 0);
		gl.vertexAttribDivisor(3, 1);
		gl.bindBuffer(GL_ELEMENT_ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(GL_ELEMENT_ARRAY_BUFFER, shape.Indices, GL_STATIC_DRAW);
		gl.bindVertexArray(null);
		return vao;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/math/mat4.ts
	function create() {
		let out = /* @__PURE__ */ new Float32Array(16);
		out[0] = 1;
		out[5] = 1;
		out[10] = 1;
		out[15] = 1;
		return out;
	}
	function invert(out, a) {
		let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
		let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
		let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
		let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
		let b00 = a00 * a11 - a01 * a10;
		let b01 = a00 * a12 - a02 * a10;
		let b02 = a00 * a13 - a03 * a10;
		let b03 = a01 * a12 - a02 * a11;
		let b04 = a01 * a13 - a03 * a11;
		let b05 = a02 * a13 - a03 * a12;
		let b06 = a20 * a31 - a21 * a30;
		let b07 = a20 * a32 - a22 * a30;
		let b08 = a20 * a33 - a23 * a30;
		let b09 = a21 * a32 - a22 * a31;
		let b10 = a21 * a33 - a23 * a31;
		let b11 = a22 * a33 - a23 * a32;
		let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
		if (!det) return null;
		det = 1 / det;
		out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
		out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
		out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
		out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
		out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
		out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
		out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
		out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
		out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
		out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
		out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
		out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
		out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
		out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
		out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
		out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
		return out;
	}
	function multiply$1(out, a, b) {
		let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
		let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
		let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
		let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
		let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
		out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
		out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
		out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
		out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
		b0 = b[4];
		b1 = b[5];
		b2 = b[6];
		b3 = b[7];
		out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
		out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
		out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
		out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
		b0 = b[8];
		b1 = b[9];
		b2 = b[10];
		b3 = b[11];
		out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
		out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
		out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
		out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
		b0 = b[12];
		b1 = b[13];
		b2 = b[14];
		b3 = b[15];
		out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
		out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
		out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
		out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
		return out;
	}
	function from_rotation_translation_scale(out, q, v, s) {
		let x = q[0], y = q[1], z = q[2], w = q[3];
		let x2 = x + x;
		let y2 = y + y;
		let z2 = z + z;
		let xx = x * x2;
		let xy = x * y2;
		let xz = x * z2;
		let yy = y * y2;
		let yz = y * z2;
		let zz = z * z2;
		let wx = w * x2;
		let wy = w * y2;
		let wz = w * z2;
		let sx = s[0];
		let sy = s[1];
		let sz = s[2];
		out[0] = (1 - (yy + zz)) * sx;
		out[1] = (xy + wz) * sx;
		out[2] = (xz - wy) * sx;
		out[3] = 0;
		out[4] = (xy - wz) * sy;
		out[5] = (1 - (xx + zz)) * sy;
		out[6] = (yz + wx) * sy;
		out[7] = 0;
		out[8] = (xz + wy) * sz;
		out[9] = (yz - wx) * sz;
		out[10] = (1 - (xx + yy)) * sz;
		out[11] = 0;
		out[12] = v[0];
		out[13] = v[1];
		out[14] = v[2];
		out[15] = 1;
		return out;
	}
	function ortho(out, top, right, bottom, left, near, far) {
		let lr = 1 / (left - right);
		let bt = 1 / (bottom - top);
		let nf = 1 / (near - far);
		out[0] = -2 * lr;
		out[1] = 0;
		out[2] = 0;
		out[3] = 0;
		out[4] = 0;
		out[5] = -2 * bt;
		out[6] = 0;
		out[7] = 0;
		out[8] = 0;
		out[9] = 0;
		out[10] = 2 * nf;
		out[11] = 0;
		out[12] = (left + right) * lr;
		out[13] = (top + bottom) * bt;
		out[14] = (far + near) * nf;
		out[15] = 1;
		return out;
	}
	function get_forward(out, mat) {
		out[0] = mat[8];
		out[1] = mat[9];
		out[2] = mat[10];
		return normalize(out, out);
	}
	function get_translation(out, mat) {
		out[0] = mat[12];
		out[1] = mat[13];
		out[2] = mat[14];
		return out;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/math/vec3.ts
	function add(out, a, b) {
		out[0] = a[0] + b[0];
		out[1] = a[1] + b[1];
		out[2] = a[2] + b[2];
		return out;
	}
	function subtract(out, a, b) {
		out[0] = a[0] - b[0];
		out[1] = a[1] - b[1];
		out[2] = a[2] - b[2];
		return out;
	}
	function scale(out, a, b) {
		out[0] = a[0] * b;
		out[1] = a[1] * b;
		out[2] = a[2] * b;
		return out;
	}
	function normalize(out, a) {
		let x = a[0];
		let y = a[1];
		let z = a[2];
		let len = x * x + y * y + z * z;
		if (len > 0) len = 1 / Math.sqrt(len);
		out[0] = a[0] * len;
		out[1] = a[1] * len;
		out[2] = a[2] * len;
		return out;
	}
	function transform_point(out, a, m) {
		let x = a[0], y = a[1], z = a[2];
		let w = m[3] * x + m[7] * y + m[11] * z + m[15];
		w = w || 1;
		out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
		out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
		out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
		return out;
	}
	function length(a) {
		let x = a[0];
		let y = a[1];
		let z = a[2];
		return Math.hypot(x, y, z);
	}
	function lerp(out, a, b, t) {
		let ax = a[0];
		let ay = a[1];
		let az = a[2];
		out[0] = ax + t * (b[0] - ax);
		out[1] = ay + t * (b[1] - ay);
		out[2] = az + t * (b[2] - az);
		return out;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/math/quat.ts
	function multiply(out, a, b) {
		let ax = a[0], ay = a[1], az = a[2], aw = a[3];
		let bx = b[0], by = b[1], bz = b[2], bw = b[3];
		out[0] = ax * bw + aw * bx + ay * bz - az * by;
		out[1] = ay * bw + aw * by + az * bx - ax * bz;
		out[2] = az * bw + aw * bz + ax * by - ay * bx;
		out[3] = aw * bw - ax * bx - ay * by - az * bz;
		return out;
	}
	function from_euler(out, x, y, z) {
		let halfToRad = .5 * Math.PI / 180;
		x *= halfToRad;
		y *= halfToRad;
		z *= halfToRad;
		let sx = Math.sin(x);
		let cx = Math.cos(x);
		let sy = Math.sin(y);
		let cy = Math.cos(y);
		let sz = Math.sin(z);
		let cz = Math.cos(z);
		out[0] = sx * cy * cz - cx * sy * sz;
		out[1] = cx * sy * cz + sx * cy * sz;
		out[2] = cx * cy * sz - sx * sy * cz;
		out[3] = cx * cy * cz + sx * sy * sz;
		return out;
	}
	/**
	* Performs a spherical linear interpolation between two quat
	*
	* @param out - the receiving quaternion
	* @param a - the first operand
	* @param b - the second operand
	* @param t - interpolation amount, in the range [0-1], between the two inputs
	*/
	function slerp(out, a, b, t) {
		let ax = a[0], ay = a[1], az = a[2], aw = a[3];
		let bx = b[0], by = b[1], bz = b[2], bw = b[3];
		let omega, cosom, sinom, scale0, scale1;
		cosom = ax * bx + ay * by + az * bz + aw * bw;
		if (cosom < 0) {
			cosom = -cosom;
			bx = -bx;
			by = -by;
			bz = -bz;
			bw = -bw;
		}
		if (1 - cosom > 1e-6) {
			omega = Math.acos(cosom);
			sinom = Math.sin(omega);
			scale0 = Math.sin((1 - t) * omega) / sinom;
			scale1 = Math.sin(t * omega) / sinom;
		} else {
			scale0 = 1 - t;
			scale1 = t;
		}
		out[0] = scale0 * ax + scale1 * bx;
		out[1] = scale0 * ay + scale1 * by;
		out[2] = scale0 * az + scale1 * bz;
		out[3] = scale0 * aw + scale1 * bw;
		return out;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/models_map.ts
	var Models = /* @__PURE__ */ function(Models) {
		Models[Models["BODY"] = 0] = "BODY";
		Models[Models["CAC3"] = 1] = "CAC3";
		Models[Models["FOOT"] = 2] = "FOOT";
		Models[Models["HAND"] = 3] = "HAND";
		Models[Models["GUN1"] = 4] = "GUN1";
		Models[Models["CAMPFIRE"] = 5] = "CAMPFIRE";
		Models[Models["WINDOW"] = 6] = "WINDOW";
		Models[Models["ROCK"] = 7] = "ROCK";
		return Models;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_common.ts
	function create_tile(size, colors) {
		let offsets = [];
		for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) offsets.push(x - size / 2 + .5, .5, y - size / 2 + .5, rand() > .01 ? colors[0] : colors[1]);
		return Float32Array.from(offsets);
	}
	function create_block(size, height) {
		let offsets = [];
		for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) for (let z = 0; z < height; z++) offsets.push(x - size / 2 + .5, z - size / 2 + .5, y - size / 2 + .5, rand() > .4 ? PaletteColors.mine_ground_1 : PaletteColors.mine_ground_2);
		return Float32Array.from(offsets);
	}
	function create_line(from, to, color) {
		let len = length(subtract([], from, to));
		let step = 1 / len;
		let output = [];
		for (let i = 0; i < len; i++) output = output.concat([...lerp([], from, to, step * i), color]);
		return output;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_building.ts
	var main_palette = [
		.6,
		.4,
		0,
		.4,
		.2,
		0,
		.14,
		0,
		0,
		.2,
		.8,
		1,
		1,
		1,
		0,
		1,
		.8,
		.4,
		.6,
		.4,
		0,
		.2,
		.2,
		.2,
		.53,
		.53,
		.53
	];
	var additional_colors = [
		[
			.6,
			.4,
			0,
			.4,
			.2,
			0
		],
		[
			0,
			.47,
			0,
			0,
			.33,
			0
		],
		[
			.67,
			0,
			0,
			.54,
			0,
			0
		],
		[
			.4,
			.4,
			.4,
			.53,
			.53,
			.53
		]
	];
	var PaletteColors = /* @__PURE__ */ function(PaletteColors) {
		PaletteColors[PaletteColors["light_wood"] = 0] = "light_wood";
		PaletteColors[PaletteColors["wood"] = 1] = "wood";
		PaletteColors[PaletteColors["dark_wood"] = 2] = "dark_wood";
		PaletteColors[PaletteColors["windows"] = 3] = "windows";
		PaletteColors[PaletteColors["gold"] = 4] = "gold";
		PaletteColors[PaletteColors["desert_ground_1"] = 5] = "desert_ground_1";
		PaletteColors[PaletteColors["desert_ground_2"] = 6] = "desert_ground_2";
		PaletteColors[PaletteColors["mine_ground_1"] = 7] = "mine_ground_1";
		PaletteColors[PaletteColors["mine_ground_2"] = 8] = "mine_ground_2";
		PaletteColors[PaletteColors["color_1"] = 9] = "color_1";
		PaletteColors[PaletteColors["color_2"] = 10] = "color_2";
		return PaletteColors;
	}({});
	function get_building_blueprint(game) {
		let palette = [...main_palette, ...element(additional_colors)];
		let has_tall_front_facade = rand() > .4;
		let has_windows = rand() > .4;
		let building_size_x = 20 + integer() * 8;
		let building_size_z = 30 + integer(0, 5) * 8;
		let building_size_y = 15 + integer(0, 9);
		let porch_size = 8;
		let offsets = [];
		let Children = [];
		for (let x = 1; x < building_size_x; x++) offsets.push(...create_line([
			x,
			0,
			building_size_z - 1
		], [
			x,
			building_size_y,
			building_size_z - 1
		], x % 2 ? 9 : 10));
		for (let y = 1; y < building_size_z; y++) {
			offsets.push(...create_line([
				building_size_x,
				0,
				y
			], [
				building_size_x,
				building_size_y * (has_tall_front_facade ? 1.5 : 1),
				y
			], y % 2 ? 9 : 10));
			offsets.push(...create_line([
				0,
				building_size_y,
				y
			], [
				building_size_x + 1,
				building_size_y,
				y
			], 1));
		}
		for (let i = -1; i < building_size_x + 3 + porch_size; i++) offsets.push(...create_line([
			i - 1,
			0,
			0
		], [
			i - 1,
			0,
			building_size_z + 2
		], 1));
		if (has_windows && has_tall_front_facade) {
			let window_width = 5;
			let window_height = 4;
			for (let offset = window_width; offset < building_size_z - window_width - 1; offset += 15) Children.push({
				Rotation: from_euler([], 0, integer(0, 2) * 180, 0),
				Translation: [
					building_size_x + 1,
					building_size_y + window_height / 2,
					building_size_z - offset - window_width / 2
				],
				Using: [render_vox(game.Models[Models.WINDOW]), cull(Get.Render)]
			});
		} else {
			let banner_height = 5 + integer(0, 2);
			let bannner_width = ~~(building_size_z * .75);
			let banner_offset = ~~((building_size_z - bannner_width) / 2);
			for (let x = 2; x < bannner_width; x++) for (let y = 0; y < banner_height; y++) offsets.push(building_size_x + 1, ~~(building_size_y * (has_tall_front_facade ? 1.5 : 1)) + y - ~~(banner_height / 2), banner_offset + x, rand() > .4 || x == 2 || x == bannner_width - 1 || y == 0 || y == banner_height - 1 ? 1 : 2);
		}
		for (let i = 0; i < porch_size; i++) offsets.push(...create_line([
			building_size_x + i + 1,
			building_size_y * .75,
			1
		], [
			building_size_x + i + 1,
			building_size_y * .75,
			building_size_z + 1
		], 1));
		offsets.push(...create_line([
			building_size_x + porch_size,
			0,
			1
		], [
			building_size_x + porch_size,
			building_size_y * .75,
			1
		], 1), ...create_line([
			building_size_x + porch_size,
			0,
			building_size_z
		], [
			building_size_x + porch_size,
			building_size_y * .75,
			building_size_z
		], 1));
		let fence_height = 3;
		offsets.push(...create_line([
			building_size_x + porch_size,
			fence_height,
			1
		], [
			building_size_x + porch_size,
			fence_height,
			building_size_z
		], 1));
		for (let i = 1; i < building_size_z; i += 2) offsets.push(...create_line([
			building_size_x + porch_size,
			0,
			i
		], [
			building_size_x + porch_size,
			5,
			i
		], 1));
		let door_height = 8;
		let door_width = 8;
		for (let i = 0; i < door_width; i++) offsets.push(...create_line([
			building_size_x + 1,
			0,
			building_size_z - i - 8
		], [
			building_size_x + 1,
			door_height,
			building_size_z - i - 8
		], 1));
		return {
			Blueprint: {
				Translation: [
					0,
					1.5,
					0
				],
				Using: [render_vox(Float32Array.from(offsets), palette)],
				Children
			},
			Size_x: building_size_x + 3 + porch_size + 1,
			Size_z: building_size_z + 2
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_animate.ts
	function animate(clips) {
		return (game, entity) => {
			let States = {};
			for (let name in clips) {
				let { Keyframes, Flags = 7 } = clips[name];
				let Duration = Keyframes[Keyframes.length - 1].Timestamp;
				States[name] = {
					Keyframes: Keyframes.map((keyframe) => ({ ...keyframe })),
					Flags,
					Duration,
					Time: 0
				};
			}
			game.World[entity] |= 1 << Get.Animate;
			game[Get.Animate][entity] = {
				States,
				Current: States[1]
			};
		};
	}
	var AnimationFlag = /* @__PURE__ */ function(AnimationFlag) {
		/** Run the clip forward once, without early exits. */
		AnimationFlag[AnimationFlag["None"] = 0] = "None";
		/** Allow early exits from this clip. */
		AnimationFlag[AnimationFlag["EarlyExit"] = 1] = "EarlyExit";
		/** Loop the clip from the start. */
		AnimationFlag[AnimationFlag["Loop"] = 2] = "Loop";
		/** When restarting, alternate the clip's direction. */
		AnimationFlag[AnimationFlag["Alternate"] = 4] = "Alternate";
		/** The default setting used when flags is not defined on the clip. */
		AnimationFlag[AnimationFlag["Default"] = 7] = "Default";
		return AnimationFlag;
	}({});
	var Anim = /* @__PURE__ */ function(Anim) {
		Anim[Anim["Idle"] = 1] = "Idle";
		Anim[Anim["Move"] = 2] = "Move";
		Anim[Anim["Shoot"] = 3] = "Shoot";
		Anim[Anim["Hit"] = 4] = "Hit";
		Anim[Anim["Die"] = 5] = "Die";
		Anim[Anim["Select"] = 6] = "Select";
		return Anim;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/palette.ts
	var palette = [
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		1,
		.8,
		1,
		1,
		.6,
		1,
		1,
		.4,
		1,
		1,
		.2,
		1,
		1,
		0,
		0,
		.8,
		0,
		.47,
		.47,
		.47,
		.53,
		0,
		0,
		.4,
		.2,
		0,
		0,
		1,
		1,
		.93,
		0,
		0
	];
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_gun.ts
	function create_gun(game) {
		return {
			Rotation: from_euler([], 270, 0, 0),
			Translation: [
				0,
				-3,
				0
			],
			Using: [render_vox(game.Models[Models.GUN1])]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_hat.ts
	var hat_colors = [
		[
			.2,
			.2,
			.2
		],
		[
			.9,
			.9,
			.9
		],
		[
			.53,
			0,
			0
		],
		[
			1,
			0,
			0
		]
	];
	var extra_colors = [
		[
			0,
			0,
			0
		],
		[
			1,
			1,
			1
		],
		[
			1,
			1,
			0
		],
		[
			.9,
			0,
			0
		]
	];
	function get_hat_blueprint(game) {
		let hat_palette = palette.slice();
		hat_palette.splice(6, 3, ...element(hat_colors));
		hat_palette.splice(9, 3, ...element(extra_colors));
		let hat_z = integer(2, 3) * 2;
		let hat_x = integer(Math.max(2, hat_z / 2), 5) * 2;
		let top_height = integer(1, 3);
		let top_width = 2;
		let has_extra = top_height > 1;
		let has_sides = rand() > .4;
		let offsets = [];
		for (let i = 0; i < hat_z; i++) offsets.push(...create_line([
			-hat_x / 2 + .5,
			0,
			-hat_z / 2 + i + .5
		], [
			hat_x / 2 + .5,
			0,
			-hat_z / 2 + i + .5
		], 2));
		if (has_sides) offsets.push(...create_line([
			hat_x / 2 - .5,
			1,
			-hat_z / 2 + .5
		], [
			hat_x / 2 - .5,
			1,
			hat_z / 2 + .5
		], 2), ...create_line([
			-hat_x / 2 + .5,
			1,
			-hat_z / 2 + .5
		], [
			-hat_x / 2 + .5,
			1,
			hat_z / 2 + .5
		], 2));
		for (let y = 0; y < top_height; y++) for (let x = 0; x < top_width; x++) offsets.push(...create_line([
			-.5,
			y + 1,
			-1 + x + .5
		], [
			1.5,
			y + 1,
			-1 + x + .5
		], has_extra && y == 0 ? 3 : 2));
		return {
			Translation: [
				0,
				3,
				0
			],
			Children: [{ Using: [render_vox(Float32Array.from(offsets), hat_palette), animate({
				[Anim.Idle]: { Keyframes: [{ Timestamp: 0 }] },
				[Anim.Hit]: {
					Keyframes: [
						{
							Timestamp: 0,
							Translation: [
								0,
								0,
								0
							]
						},
						{
							Timestamp: .1,
							Translation: [
								0,
								2,
								0
							]
						},
						{
							Timestamp: .2,
							Translation: [
								0,
								0,
								0
							]
						}
					],
					Flags: AnimationFlag.None
				},
				[Anim.Select]: {
					Keyframes: [
						{
							Timestamp: 0,
							Translation: [
								0,
								0,
								0
							],
							Rotation: [
								0,
								0,
								0,
								1
							]
						},
						{
							Timestamp: .1,
							Translation: [
								0,
								2,
								0
							],
							Rotation: [
								0,
								1,
								0,
								0
							]
						},
						{
							Timestamp: .2,
							Translation: [
								0,
								0,
								0
							],
							Rotation: [
								0,
								0,
								0,
								-1
							]
						}
					],
					Flags: AnimationFlag.None
				}
			})] }]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_character.ts
	var shirt_colors = [
		[
			1,
			0,
			0
		],
		[
			0,
			1,
			0
		],
		[
			0,
			0,
			1
		],
		[
			1,
			1,
			1
		]
	];
	var skin_colors = [[
		1,
		.8,
		.6
	], [
		.6,
		.4,
		0
	]];
	var hair_colors = [
		[
			1,
			1,
			0
		],
		[
			0,
			0,
			0
		],
		[
			.6,
			.4,
			0
		],
		[
			.4,
			0,
			0
		]
	];
	var pants_colors = [
		[
			0,
			0,
			0
		],
		[
			.53,
			0,
			0
		],
		[
			.6,
			.4,
			.2
		],
		[
			.33,
			.33,
			.33
		]
	];
	function get_character_blueprint(game) {
		let hat = get_hat_blueprint(game);
		let character_palette = palette.slice();
		character_palette.splice(0, 3, ...element(shirt_colors));
		character_palette.splice(3, 3, ...element(pants_colors));
		character_palette.splice(12, 3, ...element(skin_colors));
		character_palette.splice(15, 3, ...element(hair_colors));
		return {
			Rotation: [
				0,
				1,
				0,
				0
			],
			Using: [animate({
				[Anim.Idle]: { Keyframes: [{ Timestamp: 0 }] },
				[Anim.Die]: {
					Keyframes: [
						{
							Timestamp: 0,
							Translation: [
								0,
								1,
								0
							],
							Rotation: [
								0,
								1,
								0,
								0
							]
						},
						{
							Timestamp: 1,
							Translation: [
								0,
								-4,
								0
							],
							Rotation: from_euler([], -90, 0, 0),
							Ease: ease_out_quart
						},
						{
							Timestamp: 5,
							Translation: [
								0,
								-9,
								0
							]
						}
					],
					Flags: AnimationFlag.None
				}
			})],
			Children: [
				{ Translation: [
					1.5,
					0,
					-5
				] },
				{
					Using: [render_vox(game.Models[Models.BODY], character_palette), animate({
						[Anim.Idle]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], 0, 5, 0)
						}, {
							Timestamp: .5,
							Rotation: from_euler([], 0, -5, 0)
						}] },
						[Anim.Move]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], 0, 5, 0)
						}, {
							Timestamp: .2,
							Rotation: from_euler([], 0, -5, 0)
						}] }
					})],
					Children: [hat]
				},
				{
					Translation: [
						1.5,
						0,
						.5
					],
					Using: [animate({
						[Anim.Idle]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], 5, 0, 0)
						}, {
							Timestamp: .5,
							Rotation: from_euler([], -5, 0, 0)
						}] },
						[Anim.Move]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], 60, 0, 0)
						}, {
							Timestamp: .2,
							Rotation: from_euler([], -30, 0, 0)
						}] },
						[Anim.Shoot]: {
							Keyframes: [
								{
									Timestamp: 0,
									Rotation: from_euler([], 50, 0, 0)
								},
								{
									Timestamp: .1,
									Rotation: from_euler([], 90, 0, 0),
									Ease: ease_out_quart
								},
								{
									Timestamp: .13,
									Rotation: from_euler([], 110, 0, 0)
								},
								{
									Timestamp: .3,
									Rotation: from_euler([], 0, 0, 0),
									Ease: ease_out_quart
								}
							],
							Flags: AnimationFlag.None
						}
					})],
					Children: [{
						Translation: [
							0,
							-1,
							0
						],
						Using: [render_vox(game.Models[Models.HAND], character_palette)]
					}, create_gun(game)]
				},
				{
					Translation: [
						-1.5,
						0,
						.5
					],
					Using: [animate({
						[Anim.Idle]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], -5, 0, 0)
						}, {
							Timestamp: .5,
							Rotation: from_euler([], 5, 0, 0)
						}] },
						[Anim.Move]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], -30, 0, 0)
						}, {
							Timestamp: .2,
							Rotation: from_euler([], 60, 0, 0)
						}] }
					})],
					Children: [{
						Translation: [
							0,
							-1,
							0
						],
						Using: [render_vox(game.Models[Models.HAND], character_palette)]
					}]
				},
				{
					Translation: [
						.5,
						-2,
						.5
					],
					Using: [animate({
						[Anim.Idle]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], 5, 0, 0)
						}, {
							Timestamp: 1,
							Rotation: from_euler([], 5, 0, 0)
						}] },
						[Anim.Move]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], -45, 0, 0)
						}, {
							Timestamp: .2,
							Rotation: from_euler([], 45, 0, 0)
						}] }
					})],
					Children: [{
						Translation: [
							0,
							-1.5,
							0
						],
						Using: [render_vox(game.Models[Models.FOOT], character_palette)]
					}]
				},
				{
					Translation: [
						-.5,
						-2,
						.5
					],
					Using: [animate({
						[Anim.Idle]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], -5, 0, 0)
						}, {
							Timestamp: 1,
							Rotation: from_euler([], -5, 0, 0)
						}] },
						[Anim.Move]: { Keyframes: [{
							Timestamp: 0,
							Rotation: from_euler([], 45, 0, 0)
						}, {
							Timestamp: .2,
							Rotation: from_euler([], -45, 0, 0)
						}] }
					})],
					Children: [{
						Translation: [
							0,
							-1.5,
							0
						],
						Using: [render_vox(game.Models[Models.FOOT], character_palette)]
					}]
				}
			]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_audio_source.ts
	/**
	* Add the AudioSource component.
	*
	* @param Idle The name of the clip to play by default, in a loop.
	*/
	function audio_source(Idle) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.AudioSource;
			game[Get.AudioSource][entity] = {
				Idle,
				Time: 0
			};
		};
	}
	var InstrumentParam = /* @__PURE__ */ function(InstrumentParam) {
		InstrumentParam[InstrumentParam["MasterGainAmount"] = 0] = "MasterGainAmount";
		InstrumentParam[InstrumentParam["FilterType"] = 1] = "FilterType";
		InstrumentParam[InstrumentParam["FilterFreq"] = 2] = "FilterFreq";
		InstrumentParam[InstrumentParam["FilterQ"] = 3] = "FilterQ";
		InstrumentParam[InstrumentParam["FilterDetuneLFO"] = 4] = "FilterDetuneLFO";
		InstrumentParam[InstrumentParam["LFOType"] = 5] = "LFOType";
		InstrumentParam[InstrumentParam["LFOAmount"] = 6] = "LFOAmount";
		InstrumentParam[InstrumentParam["LFOFreq"] = 7] = "LFOFreq";
		InstrumentParam[InstrumentParam["Sources"] = 8] = "Sources";
		return InstrumentParam;
	}({});
	var SourceParam = /* @__PURE__ */ function(SourceParam) {
		SourceParam[SourceParam["SourceType"] = 0] = "SourceType";
		SourceParam[SourceParam["GainAmount"] = 1] = "GainAmount";
		SourceParam[SourceParam["GainAttack"] = 2] = "GainAttack";
		SourceParam[SourceParam["GainSustain"] = 3] = "GainSustain";
		SourceParam[SourceParam["GainRelease"] = 4] = "GainRelease";
		SourceParam[SourceParam["DetuneAmount"] = 5] = "DetuneAmount";
		SourceParam[SourceParam["DetuneLFO"] = 6] = "DetuneLFO";
		SourceParam[SourceParam["FreqEnabled"] = 7] = "FreqEnabled";
		SourceParam[SourceParam["FreqAttack"] = 8] = "FreqAttack";
		SourceParam[SourceParam["FreqSustain"] = 9] = "FreqSustain";
		SourceParam[SourceParam["FreqRelease"] = 10] = "FreqRelease";
		return SourceParam;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_collide.ts
	function collide(Dynamic = true, Size = [
		1,
		1,
		1
	], Flag = 1) {
		return (game, EntityId) => {
			game.World[EntityId] |= 1 << Get.Collide;
			game[Get.Collide][EntityId] = {
				EntityId,
				New: true,
				Dynamic,
				Size,
				Min: [
					0,
					0,
					0
				],
				Max: [
					0,
					0,
					0
				],
				Collisions: [],
				Flags: Flag
			};
		};
	}
	var RayTarget = /* @__PURE__ */ function(RayTarget) {
		/** Ignored by raycasting. */
		RayTarget[RayTarget["None"] = 1] = "None";
		/** Considered by raycasting; doesn't do anything. */
		RayTarget[RayTarget["Targetable"] = 2] = "Targetable";
		/** Can be walked to. */
		RayTarget[RayTarget["Navigable"] = 4] = "Navigable";
		/** Can be attacked. */
		RayTarget[RayTarget["Attackable"] = 8] = "Attackable";
		/** The player; used with Anim.Select when playing. */
		RayTarget[RayTarget["Player"] = 16] = "Player";
		return RayTarget;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_navigable.ts
	function navigable(X, Y) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Navigable;
			game[Get.Navigable][entity] = {
				X,
				Y
			};
		};
	}
	function find_navigable(game, { X, Y }) {
		for (let i = 0; i < game.World.length; i++) if (game.World[i] & 1 << Get.Navigable) {
			if (game[Get.Navigable][i].X == X && game[Get.Navigable][i].Y == Y) return i;
		}
		throw `No entity with coords ${X}, ${Y}.`;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_cactus.ts
	function get_cactus_blueprint(game) {
		let model = game.Models[Models.CAC3];
		return {
			Translation: [
				0,
				integer(2, 5) + .5,
				0
			],
			Using: [render_vox(model), cull(Get.Render)]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_emit_particles.ts
	/**
	* Add EMIT_PARTICLES.
	*
	* @param Lifespan How long particles live for.
	* @param Frequency How often particles spawn.
	* @param SizeStart The initial size of a particle.
	*/
	function emit_particles(Lifespan, Frequency) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.EmitParticles;
			game[Get.EmitParticles][entity] = {
				Lifespan,
				Frequency,
				Instances: [],
				SinceLast: 0
			};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_light.ts
	/**
	*
	* @param Color The color of the light. It will tint the shaded objects taking
	* into account the angle and the distance from the light source. Grayscale can
	* be used to control how dim the light is.
	* @param range The distance at which the light has the same intensity as the
	* default light has at 1 unit away. If range is 0, then the light is a
	* directional light and its position relative to the world origin will be used
	* to compute the light normal.
	*/
	function light(color = [
		1,
		1,
		1
	], range = 1) {
		return (game, Entity) => {
			game.World[Entity] |= 1 << Get.Light;
			game[Get.Light][Entity] = [...color, range ** 2];
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_render_particles.ts
	function render_particles(color, size) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Render;
			game[Get.Render][entity] = {
				Kind: RenderKind.Particles,
				Material: game.Materials[Mat.Particles],
				Buffer: game.GL.createBuffer(),
				ColorSize: [...color, size]
			};
		};
	}
	var ParticleAttribute = /* @__PURE__ */ function(ParticleAttribute) {
		ParticleAttribute[ParticleAttribute["Origin"] = 1] = "Origin";
		return ParticleAttribute;
	}({});
	var ParticleUniform = /* @__PURE__ */ function(ParticleUniform) {
		ParticleUniform[ParticleUniform["PV"] = 0] = "PV";
		ParticleUniform[ParticleUniform["Detail"] = 1] = "Detail";
		return ParticleUniform;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_shake.ts
	function shake(Duration = 0) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Shake;
			game[Get.Shake][entity] = { Duration };
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_trigger.ts
	function trigger(Action) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Trigger;
			game[Get.Trigger][entity] = { Action };
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_campfire.ts
	function get_campfire_blueprint(game) {
		return {
			Translation: [
				0,
				1.5,
				0
			],
			Using: [render_vox(game.Models[Models.CAMPFIRE]), cull(Get.Render)],
			Children: [{
				Using: [collide(false, [
					15,
					15,
					15
				]), trigger(Action.HealCampfire)],
				Children: [{ Using: [
					shake(Infinity),
					emit_particles(2, .1),
					render_particles([
						1,
						0,
						0
					], 15)
				] }, {
					Translation: [
						0,
						3,
						0
					],
					Using: [light([
						1,
						.5,
						0
					], 3), cull(Get.Light)]
				}]
			}]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_gold.ts
	function get_gold_blueprint(game) {
		return {
			Translation: [
				0,
				1.5,
				0
			],
			Rotation: from_euler([], 0, integer(0, 3) * 90, 0),
			Using: [
				render_vox(Float32Array.from(create_line([
					-1,
					0,
					0
				], [
					1,
					0,
					0
				], PaletteColors.gold)), main_palette),
				cull(Get.Render),
				collide(false, [
					4,
					4,
					4
				]),
				trigger(Action.CollectGold),
				audio_source()
			],
			Children: [{
				Translation: [
					0,
					3,
					0
				],
				Using: [light([
					1,
					1,
					0
				], 3), cull(Get.Light)]
			}]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_ground_block.ts
	function get_block_blueprint(game) {
		let model = create_model();
		return {
			Translation: [
				0,
				1.5,
				0
			],
			Rotation: from_euler([], 0, integer(0, 3) * 90, 0),
			Using: [render_vox(model, main_palette), cull(Get.Render)]
		};
	}
	function create_model() {
		let number_of_elements = integer(1, 4);
		let offsets = [];
		for (let x = 0; x < number_of_elements; x++) {
			let y = integer(-1, 1);
			offsets.push(x, 0, y, PaletteColors.light_wood);
		}
		return Float32Array.from(offsets);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_rock.ts
	function get_rock_blueprint(game) {
		let model = game.Models[Models.ROCK];
		return {
			Translation: [
				.1,
				integer(0, 2) + .1,
				.1
			],
			Rotation: from_euler([], integer(0, 3) * 90, integer(0, 3) * 90, integer(0, 3) * 90),
			Using: [render_vox(model), cull(Get.Render)]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_ground_tile.ts
	function get_tile_blueprint(game, is_walkable, x = 0, y = 0, has_gold = true, colors = [PaletteColors.desert_ground_1, PaletteColors.desert_ground_2]) {
		let tile = {
			Using: [
				render_vox(create_tile(8, colors), main_palette),
				cull(Get.Render),
				audio_source(),
				animate({
					[Anim.Idle]: { Keyframes: [{
						Timestamp: 0,
						Translation: [
							0,
							0,
							0
						]
					}] },
					[Anim.Select]: {
						Keyframes: [
							{
								Timestamp: 0,
								Translation: [
									0,
									0,
									0
								]
							},
							{
								Timestamp: .1,
								Translation: [
									0,
									-.5,
									0
								]
							},
							{
								Timestamp: .2,
								Translation: [
									0,
									0,
									0
								]
							}
						],
						Flags: AnimationFlag.None
					}
				})
			],
			Children: []
		};
		if (!is_walkable) tile.Children.push(rand() > .5 ? get_cactus_blueprint(game) : rand() > .01 ? get_rock_blueprint(game) : get_campfire_blueprint(game));
		else if (rand() > .85) tile.Children.push(get_block_blueprint(game));
		else if (has_gold && rand() < .01) tile.Children.push(get_gold_blueprint(game));
		return {
			Rotation: from_euler([], 0, integer(0, 3) * 90, 0),
			Translation: [
				0,
				0,
				0
			],
			Using: [
				collide(false, [
					8,
					1,
					8
				], is_walkable ? RayTarget.Navigable : RayTarget.None),
				cull(Get.Collide),
				navigable(x, y)
			],
			Children: [tile]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_camera.ts
	function camera_ortho(radius, near, far) {
		return (game, EntityId) => {
			let Projection = ortho(create(), radius, radius * (game.Canvas3.width / game.Canvas3.height), -radius, -radius * (game.Canvas3.width / game.Canvas3.height), near, far);
			game.World[EntityId] |= 1 << Get.Camera;
			game[Get.Camera][EntityId] = {
				EntityId,
				Projection,
				Unproject: invert([], Projection),
				View: create(),
				PV: create()
			};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_mimic.ts
	function mimic(Target) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Mimic;
			game[Get.Mimic][entity] = { Target };
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_select.ts
	function select() {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Select;
			game[Get.Select][entity] = { Position: [] };
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_iso_camera.ts
	function create_iso_camera(player) {
		return {
			Translation: [
				0,
				200,
				0
			],
			Using: [mimic(player)],
			Children: [{
				Translation: [
					50,
					50,
					50
				],
				Rotation: [
					-.28,
					.364,
					.116,
					.88
				],
				Children: [{ Using: [
					camera_ortho(25, 1, 500),
					select(),
					shake()
				] }]
			}]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_mine_entrance.ts
	function get_mine_entrance_blueprint(game) {
		let wooden_part_length = 26;
		let half_entrrance_width = 6;
		let half_entrance_height = 14;
		let wooden_part_offset = [...create_line([
			-2,
			2,
			0
		], [
			-2,
			2,
			52
		], PaletteColors.mine_ground_2), ...create_line([
			2,
			2,
			0
		], [
			2,
			2,
			52
		], PaletteColors.mine_ground_2)];
		for (let i = 0; i < wooden_part_length; i++) wooden_part_offset.push(...create_line([
			-6,
			0,
			i
		], [
			-6,
			half_entrance_height,
			i
		], i % 2 ? PaletteColors.wood : PaletteColors.light_wood), ...create_line([
			half_entrrance_width,
			0,
			i
		], [
			half_entrrance_width,
			half_entrance_height,
			i
		], i % 2 ? PaletteColors.wood : PaletteColors.light_wood), ...create_line([
			-6,
			half_entrance_height,
			i
		], [
			half_entrrance_width,
			half_entrance_height,
			i
		], i % 2 ? PaletteColors.light_wood : PaletteColors.wood));
		for (let i = 0; i < 52; i += 2) wooden_part_offset.push(...create_line([
			-4,
			1,
			i
		], [
			4,
			1,
			i
		], PaletteColors.light_wood));
		return { Children: [
			{
				...get_rock_blueprint(game),
				Scale: [
					4,
					4,
					4
				]
			},
			{
				Translation: [
					4,
					0,
					0
				],
				Using: [render_vox(Float32Array.from(wooden_part_offset), main_palette)]
			},
			{
				Translation: [
					0,
					0,
					18
				],
				Using: [collide(false, [
					8,
					8,
					8
				]), trigger(Action.GoToMine)]
			}
		] };
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_control_player.ts
	function player_control() {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.PlayerControl;
			game[Get.PlayerControl][entity] = {};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_health.ts
	function health(Max) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Health;
			game[Get.Health][entity] = {
				Max,
				Current: Max
			};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_move.ts
	function move(MoveSpeed = 3.5, RotateSpeed = .5) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Move;
			game[Get.Move][entity] = {
				MoveSpeed,
				RotateSpeed
			};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_npc.ts
	function npc(Friendly = true, Bounty = false) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.NPC;
			game[Get.NPC][entity] = {
				Friendly,
				Bounty,
				LastShot: 0
			};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_shoot.ts
	function shoot() {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Shoot;
			game[Get.Shoot][entity] = { Target: null };
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_walking.ts
	function walking(X = 0, Y = 0) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Walking;
			game[Get.Walking][entity] = {
				X,
				Y,
				Destination: null,
				Route: [],
				DestinationX: 0,
				DestinationY: 0
			};
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/sounds/snd_baseline.ts
	var snd_baseline = {
		Tracks: [{
			Instrument: [
				5,
				"bandpass",
				10,
				3,
				,
				,
				,
				,
				[[
					"triangle",
					7,
					2,
					2,
					8,
					8
				]]
			],
			Notes: [
				69,
				74,
				69,
				74,
				69
			]
		}, {
			Instrument: [
				4,
				,
				,
				,
				,
				,
				,
				,
				[[
					false,
					2,
					1,
					1,
					6
				], [
					"sine",
					9,
					2,
					2,
					7,
					7
				]]
			],
			Notes: [
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				41,
				,
				43,
				,
				,
				,
				43,
				,
				,
				,
				43,
				,
				,
				,
				43,
				,
				41,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				41,
				,
				43,
				,
				,
				,
				48,
				,
				,
				,
				48,
				,
				,
				,
				48,
				,
				43,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				41,
				,
				,
				,
				36,
				,
				,
				,
				36,
				,
				,
				,
				36,
				,
				,
				,
				33,
				,
				36,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				33,
				,
				,
				,
				36,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				38
			]
		}],
		Exit: 19.2
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/sounds/snd_wind.ts
	var snd_wind = {
		Tracks: [{
			Instrument: [
				7,
				"lowpass",
				8,
				6,
				true,
				"sine",
				9,
				2,
				[[
					false,
					3,
					6,
					4,
					13
				]]
			],
			Notes: [57]
		}],
		Exit: 13
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/widgets/wid_healthbar.ts
	function widget_healthbar(game, entity, x, y) {
		let parent = game[Get.Transform][entity].Parent.EntityId;
		let health = game[Get.Health][parent];
		let height = .01 * game.Canvas2.height;
		if (game.World[parent] & 1 << Get.PlayerControl) game.Context.fillStyle = "#0f0";
		else if (game.World[parent] & 1 << Get.NPC && game[Get.NPC][parent].Bounty) {
			game.Context.fillStyle = "#ff0";
			height *= 2;
		} else game.Context.fillStyle = "#f00";
		game.Context.fillRect(x - .05 * game.Canvas2.width, y, .1 * game.Canvas2.width * health.Current / health.Max, height);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_lamp.ts
	function create_lamp() {
		return { Children: [{
			Translation: [
				0,
				0,
				4
			],
			Using: [render_vox(/* @__PURE__ */ new Float32Array(4), [
				1,
				.5,
				0
			]), cull(Get.Render)]
		}, {
			Translation: [
				0,
				1,
				7
			],
			Using: [cull(Get.Light), light([
				1,
				.5,
				0
			], 5)]
		}] };
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_mine_wall.ts
	function get_mine_wall_blueprint(game) {
		let Children = [{ Using: [render_vox(create_block(8, 6), main_palette), cull(Get.Render)] }];
		if (rand() < .1) Children.push(create_lamp());
		return {
			Translation: [
				0,
				4,
				0
			],
			Using: [collide(false, [
				8,
				4,
				8
			], RayTarget.None), cull(Get.Collide)],
			Children
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/worlds/wor_mine.ts
	function world_mine(game) {
		set_seed(game.BountySeed);
		game.World = [];
		game.Grid = [];
		game.GL.clearColor(.8, .3, .2, 1);
		let map_size = 30;
		for (let x = 0; x < map_size; x++) {
			game.Grid[x] = [];
			for (let y = 0; y < map_size; y++) if (x == 0 || x == 29 || y == 0 || y == 29) game.Grid[x][y] = NaN;
			else game.Grid[x][y] = Infinity;
		}
		generate_maze(game, [0, 29], [0, 29], map_size, .3);
		for (let x = 0; x < map_size; x++) for (let y = 0; y < map_size; y++) {
			let is_walkable = game.Grid[x][y] == Infinity;
			let tile_blueprint = is_walkable ? get_tile_blueprint(game, is_walkable, x, y, true, [PaletteColors.mine_ground_1, PaletteColors.mine_ground_2]) : get_mine_wall_blueprint(game);
			game.Add({
				...tile_blueprint,
				Translation: [
					(-15 + x) * 8,
					tile_blueprint.Translation[1],
					(-15 + y) * 8
				]
			});
		}
		game.Add({
			Translation: [
				1,
				2,
				-1
			],
			Using: [light([
				.5,
				.5,
				.5
			], 0), audio_source(snd_baseline)]
		});
		let x = 28;
		let y = 28;
		if (game.Grid[x] && game.Grid[x][y] && !isNaN(game.Grid[x][y])) game.Add({
			Scale: [
				1.5,
				1.5,
				1.5
			],
			Translation: [
				104,
				7.5,
				104
			],
			Rotation: from_euler([], 0, integer(0, 3) * 90, 0),
			Using: [
				npc(false, true),
				walking(x, y),
				move(integer(12, 16), 0),
				collide(true, [
					7,
					7,
					7
				], RayTarget.Attackable),
				health(5e3 * game.ChallengeLevel),
				shoot(),
				audio_source()
			],
			Children: [(set_seed(game.BountySeed), get_character_blueprint(game)), {
				Translation: [
					0,
					10,
					0
				],
				Using: [draw(widget_healthbar)]
			}]
		});
		let cowboys_count = 20;
		for (let i = 0; i < cowboys_count; i++) {
			let x = integer(4, map_size);
			let y = integer(4, map_size);
			if (game.Grid[x] && game.Grid[x][y] && !isNaN(game.Grid[x][y])) game.Add({
				Translation: [
					(-15 + x) * 8,
					4.3 + Math.random(),
					(-15 + y) * 8
				],
				Using: [
					npc(false),
					walking(x, y),
					move(integer(8, 15)),
					collide(true, [
						7,
						7,
						7
					], RayTarget.Attackable),
					health(2e3 * game.ChallengeLevel),
					shoot(),
					audio_source()
				],
				Children: [get_character_blueprint(game), {
					Translation: [
						0,
						10,
						0
					],
					Using: [draw(widget_healthbar)]
				}]
			});
		}
		set_seed(game.PlayerSeed);
		game.Player = game.Add({
			Translation: [
				-112,
				5,
				-112
			],
			Using: [
				player_control(),
				walking(1, 1),
				move(25, 0),
				collide(true, [
					3,
					7,
					3
				], RayTarget.Player),
				health(1e4),
				shoot(),
				audio_source()
			],
			Children: [
				get_character_blueprint(game),
				{
					Translation: [
						0,
						25,
						0
					],
					Using: [light([
						1,
						1,
						1
					], 20)]
				},
				{
					Translation: [
						0,
						10,
						0
					],
					Using: [draw(widget_healthbar)]
				}
			]
		});
		game.Add({
			Scale: [
				240,
				60,
				240
			],
			Translation: [
				-4,
				-29.51,
				-4
			],
			Using: [render_vox(Float32Array.from([
				0,
				0,
				0,
				PaletteColors.mine_ground_1
			]), main_palette)]
		});
		game.Add(create_iso_camera(game.Player));
	}
	function generate_maze(game, [x1, x2], [y1, y2], size, probablity) {
		if (x2 - x1 >= y2 - y1) {
			if (x2 - x1 > 3) {
				let bisection = Math.ceil((x1 + x2) / 2);
				let max = y2 - 1;
				let min = y1 + 1;
				let randomPassage = ~~(Math.random() * (max - min + 1)) + min;
				let first = false;
				let second = false;
				if (game.Grid[y2][bisection] == Infinity) {
					randomPassage = max;
					first = true;
				}
				if (game.Grid[y1][bisection] == Infinity) {
					randomPassage = min;
					second = true;
				}
				for (let i = y1 + 1; i < y2; i++) {
					if (first && second) {
						if (i == max || i == min) continue;
					} else if (i == randomPassage) continue;
					game.Grid[i][bisection] = Math.random() > probablity ? NaN : Infinity;
				}
				generate_maze(game, [x1, bisection], [y1, y2], size, probablity);
				generate_maze(game, [bisection, x2], [y1, y2], size, probablity);
			}
		} else if (y2 - y1 > 3) {
			let bisection = Math.ceil((y1 + y2) / 2);
			let max = x2 - 1;
			let min = x1 + 1;
			let randomPassage = ~~(Math.random() * (max - min + 1)) + min;
			let first = false;
			let second = false;
			if (game.Grid[bisection][x2] == Infinity) {
				randomPassage = max;
				first = true;
			}
			if (game.Grid[bisection][x1] == Infinity) {
				randomPassage = min;
				second = true;
			}
			for (let i = x1 + 1; i < x2; i++) {
				if (first && second) {
					if (i == max || i == min) continue;
				} else if (i == randomPassage) continue;
				game.Grid[bisection][i] = Math.random() > probablity ? NaN : Infinity;
			}
			generate_maze(game, [x1, x2], [y1, bisection], size, probablity);
			generate_maze(game, [x1, x2], [bisection, y2], size, probablity);
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/worlds/wor_desert.ts
	function world_desert(game) {
		set_seed(game.BountySeed);
		let map_size = 30;
		let entrance_position_x = integer(20, 25) || 20;
		let entrance_position_z = integer(10, 20) || 10;
		let entrance_width = 4;
		let entrance_length = 6;
		game.World = [];
		game.Grid = [];
		game.GL.clearColor(.8, .3, .2, 1);
		for (let x = 0; x < map_size; x++) {
			game.Grid[x] = [];
			for (let y = 0; y < map_size; y++) if (x == 0 || x == 29 || y == 0 || y == 29) game.Grid[x][y] = NaN;
			else game.Grid[x][y] = Infinity;
		}
		generate_maze(game, [0, 29], [0, 29], map_size, .6);
		for (let z = entrance_position_z; z < entrance_position_z + entrance_length + 3; z++) for (let x = entrance_position_x - 1; x < entrance_position_x + entrance_width - 1; x++) if (x == entrance_position_x - 1 + entrance_width - 2 && z !== entrance_position_z || z >= entrance_position_z + entrance_length) game.Grid[x][z] = Infinity;
		else game.Grid[x][z] = NaN;
		for (let x = 0; x < map_size; x++) for (let y = 0; y < map_size; y++) {
			let tile_blueprint = get_tile_blueprint(game, game.Grid[x][y] == Infinity, x, y);
			game.Add({
				...tile_blueprint,
				Translation: [
					(-15 + x) * 8,
					tile_blueprint.Translation[1],
					(-15 + y) * 8
				]
			});
		}
		game.Add({
			Translation: [
				1,
				2,
				-1
			],
			Using: [light([
				.5,
				.5,
				.5
			], 0), audio_source(snd_baseline)],
			Children: [{ Using: [audio_source(snd_wind)] }]
		});
		let cowboys_count = 20;
		for (let i = 0; i < cowboys_count; i++) {
			let x = integer(4, map_size);
			let y = integer(4, map_size);
			if (game.Grid[x] && game.Grid[x][y] && !isNaN(game.Grid[x][y])) game.Add({
				Translation: [
					(-15 + x) * 8,
					4.3 + Math.random(),
					(-15 + y) * 8
				],
				Using: [
					npc(false),
					walking(x, y),
					move(integer(8, 15)),
					collide(true, [
						7,
						7,
						7
					], RayTarget.Attackable),
					health(1500 * game.ChallengeLevel),
					shoot(),
					audio_source()
				],
				Children: [get_character_blueprint(game), {
					Translation: [
						0,
						10,
						0
					],
					Using: [draw(widget_healthbar)]
				}]
			});
		}
		let entrance = get_mine_entrance_blueprint(game);
		game.Add({
			Translation: [
				(-15 + entrance_position_x) * 8 + 4,
				0,
				(-15 + entrance_position_z) * 8 + 4
			],
			...entrance
		});
		set_seed(game.PlayerSeed);
		game.Player = game.Add({
			Translation: [
				-112,
				5,
				-112
			],
			Using: [
				player_control(),
				walking(1, 1),
				move(25, 0),
				collide(true, [
					3,
					7,
					3
				], RayTarget.Player),
				health(1e4),
				shoot(),
				audio_source()
			],
			Children: [
				get_character_blueprint(game),
				{
					Translation: [
						0,
						25,
						0
					],
					Using: [light([
						1,
						1,
						1
					], 20)]
				},
				{
					Translation: [
						0,
						10,
						0
					],
					Using: [draw(widget_healthbar)]
				}
			]
		});
		game.Add({
			Scale: [
				240,
				60,
				240
			],
			Translation: [
				-4,
				-29.51,
				-4
			],
			Using: [render_vox(Float32Array.from([
				0,
				0,
				0,
				PaletteColors.desert_ground_1
			]), main_palette)]
		});
		game.Add(create_iso_camera(game.Player));
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/worlds/wor_store.ts
	function world_store(game) {
		set_seed(game.PlayerSeed);
		game.World = [];
		game.GL.clearColor(.9, .7, .3, 1);
		let player = game.Add({
			Using: [animate({ [Anim.Idle]: {
				Keyframes: [
					{
						Timestamp: 0,
						Rotation: [
							0,
							0,
							0,
							1
						]
					},
					{
						Timestamp: 2,
						Rotation: [
							0,
							1,
							0,
							0
						]
					},
					{
						Timestamp: 4,
						Rotation: [
							0,
							0,
							0,
							-1
						]
					}
				],
				Flags: AnimationFlag.Loop
			} })],
			Children: [get_character_blueprint(game)]
		});
		game.Add(create_iso_camera(player));
		game.Add({
			Translation: [
				1,
				1,
				1
			],
			Using: [light([
				.5,
				.5,
				.5
			], 0)]
		});
		game.Add({
			Translation: [
				-15,
				15,
				15
			],
			Using: [light([
				1,
				1,
				1
			], 25)]
		});
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_town_gate.ts
	function get_town_gate_blueprint(game, gate_size, fence_line) {
		let height = 4;
		let map_size = 30;
		let fence_width = (240 - gate_size) / 2;
		let fence_offsets = [...create_line([
			4,
			height,
			-120
		], [
			4,
			height,
			-120 + fence_width
		], PaletteColors.wood), ...create_line([
			4,
			height,
			-120 + fence_width + gate_size
		], [
			4,
			height,
			120
		], PaletteColors.wood)];
		fence_offsets.push(...create_line([
			4,
			0,
			-120 + fence_width
		], [
			4,
			gate_size * 1.5,
			-120 + fence_width
		], PaletteColors.wood), ...create_line([
			4,
			0,
			-120 + fence_width + gate_size
		], [
			4,
			gate_size * 1.5,
			-120 + fence_width + gate_size
		], PaletteColors.wood), ...create_line([
			4,
			gate_size * 1.5,
			-120 + fence_width
		], [
			4,
			gate_size * 1.5,
			-120 + fence_width + gate_size + 1
		], PaletteColors.wood));
		if (game.BountySeed) for (let i = 0; i < gate_size / 8; i++) game.Grid[fence_line][fence_width / 8 + i] = Infinity;
		else fence_offsets.push(...create_line([
			4,
			height,
			-120 + fence_width
		], [
			4,
			height,
			-120 + fence_width + gate_size
		], PaletteColors.wood));
		for (let i = -112; i < map_size / 2 * 8; i += 8) if (i < -120 + fence_width || i > -120 + fence_width + gate_size) fence_offsets.push(...create_line([
			4,
			0,
			i
		], [
			4,
			6,
			i
		], PaletteColors.wood));
		return {
			Translation: [
				(-15 + fence_line) * 8 - 4,
				0,
				-3
			],
			Using: [render_vox(Float32Array.from(fence_offsets), main_palette)],
			Children: [{
				Translation: [
					20,
					0,
					0
				],
				Using: [collide(false, [
					8,
					8,
					800
				]), trigger(Action.GoToDesert)]
			}]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/sounds/snd_music.ts
	var snd_music = {
		Tracks: [{
			Instrument: [
				5,
				"bandpass",
				10,
				3,
				,
				,
				,
				,
				[[
					"triangle",
					7,
					2,
					2,
					8,
					8
				]]
			],
			Notes: [
				69,
				74,
				69,
				74,
				69,
				,
				,
				,
				,
				,
				,
				,
				65,
				,
				,
				,
				67,
				,
				,
				,
				62,
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
				69,
				74,
				69,
				74,
				69,
				,
				,
				,
				,
				,
				,
				,
				65,
				,
				,
				,
				67,
				,
				,
				,
				72,
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
				69,
				74,
				69,
				74,
				,
				,
				,
				,
				,
				,
				,
				,
				65,
				,
				,
				,
				64,
				,
				62,
				,
				60,
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
				69,
				74,
				69,
				74,
				69,
				,
				,
				,
				,
				,
				,
				,
				67,
				,
				,
				,
				62
			]
		}, {
			Instrument: [
				3,
				,
				,
				,
				,
				,
				,
				,
				[[
					false,
					2,
					1,
					1,
					6
				], [
					"sine",
					9,
					2,
					2,
					7,
					7
				]]
			],
			Notes: [
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				41,
				,
				43,
				,
				,
				,
				43,
				,
				,
				,
				43,
				,
				,
				,
				43,
				,
				41,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				41,
				,
				43,
				,
				,
				,
				48,
				,
				,
				,
				48,
				,
				,
				,
				48,
				,
				43,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				41,
				,
				,
				,
				36,
				,
				,
				,
				36,
				,
				,
				,
				36,
				,
				,
				,
				33,
				,
				36,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				33,
				,
				,
				,
				36,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				,
				,
				38,
				,
				38
			]
		}],
		Exit: 19.2
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/sounds/snd_neigh.ts
	var snd_neigh = {
		Tracks: [{
			Instrument: [
				4,
				"lowpass",
				9,
				5,
				true,
				"sawtooth",
				7,
				9,
				[[
					false,
					7,
					3,
					3,
					7
				]]
			],
			Notes: [57]
		}],
		Exit: 9
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_player_control.ts
	var QUERY$20 = 1 << Get.Transform | 1 << Get.PlayerControl | 1 << Get.Walking;
	function sys_player_control(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$20) == QUERY$20 && game.Camera) update$17(game, i);
	}
	function update$17(game, entity) {
		let cursor = game[Get.Select][game.Camera.EntityId];
		if (game.Input.d0 && cursor.Hit) {
			if (cursor.Hit.Flags & RayTarget.Navigable) {
				let route = get_route(game, entity, game[Get.Navigable][cursor.Hit.EntityId]);
				if (route) game[Get.Walking][entity].Route = route;
			}
			if (cursor.Hit.Flags & RayTarget.Attackable && game.World[entity] & 1 << Get.Shoot) {
				let other_transform = game[Get.Transform][cursor.Hit.EntityId];
				game[Get.Shoot][entity].Target = get_translation([], other_transform.World);
				game[Get.Shake][game.Camera.EntityId].Duration = .2;
			}
		}
		if (game.Input.d2 && game.World[entity] & 1 << Get.Shoot) {
			game[Get.Shoot][entity].Target = cursor.Position;
			game[Get.Shake][game.Camera.EntityId].Duration = .2;
		}
	}
	function get_neighbors(game, { X, Y }) {
		return [
			{
				X: X - 1,
				Y
			},
			{
				X: X + 1,
				Y
			},
			{
				X,
				Y: Y - 1
			},
			{
				X,
				Y: Y + 1
			},
			{
				X: X - 1,
				Y: Y - 1
			},
			{
				X: X + 1,
				Y: Y - 1
			},
			{
				X: X - 1,
				Y: Y + 1
			},
			{
				X: X + 1,
				Y: Y + 1
			}
		].filter(({ X, Y }) => X >= 0 && X < game.Grid.length && Y >= 0 && Y < game.Grid[0].length);
	}
	function calculate_distance(game, { X, Y }) {
		for (let x = 0; x < game.Grid.length; x++) for (let y = 0; y < game.Grid[0].length; y++) if (!Number.isNaN(game.Grid[x][y])) game.Grid[x][y] = Infinity;
		game.Grid[X][Y] = 0;
		let frontier = [{
			X,
			Y
		}];
		let current;
		while (current = frontier.shift()) if (game.Grid[current.X][current.Y] < 15) {
			for (let cell of get_neighbors(game, current)) if (game.Grid[cell.X][cell.Y] > game.Grid[current.X][current.Y] + 1) {
				game.Grid[cell.X][cell.Y] = game.Grid[current.X][current.Y] + 1;
				frontier.push(cell);
			}
		}
	}
	function get_route(game, entity, destination) {
		let walking = game[Get.Walking][entity];
		calculate_distance(game, walking);
		if (!(game.Grid[destination.X][destination.Y] < Infinity)) return false;
		let route = [];
		while (!(destination.X == walking.X && destination.Y == walking.Y)) {
			route.push(destination);
			let neighbors = get_neighbors(game, destination);
			for (let i = 0; i < neighbors.length; i++) {
				let neighbor_coords = neighbors[i];
				if (game.Grid[neighbor_coords.X][neighbor_coords.Y] < game.Grid[destination.X][destination.Y]) destination = game[Get.Navigable][find_navigable(game, neighbor_coords)];
			}
		}
		return route;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/widgets/wid_exclamation.ts
	function widget_exclamation(game, entity, x, y) {
		let [marker] = game[Get.Draw][entity].Args;
		let age = game[Get.Lifespan][entity].Age;
		game.Context.font = "10vmin Impact";
		game.Context.textAlign = "center";
		game.Context.fillStyle = "#FFE8C6";
		game.Context.fillText(marker, x, y + Math.sin(age * 5) * 10);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/worlds/wor_town.ts
	function world_town(game, is_intro = false) {
		set_seed(game.ChallengeSeed);
		let map_size = 30;
		let fence_line = 20;
		let back_fence_line = 1;
		let fence_gate_size = 16;
		let characters_spawning_points = [
			0,
			465,
			468,
			547
		];
		game.World = [];
		game.Grid = [];
		game.GL.clearColor(.8, .3, .2, 1);
		for (let x = 0; x < map_size; x++) {
			game.Grid[x] = [];
			for (let y = 0; y < map_size; y++) {
				let is_fence = x == fence_line || x == back_fence_line;
				let is_walkable = is_fence || x == 0 || characters_spawning_points.includes(x * 30 + y) || rand() > .04;
				game.Grid[x][y] = is_walkable && !is_fence ? Infinity : NaN;
				let tile_blueprint = get_tile_blueprint(game, is_walkable, x, y, false);
				game.Add({
					...tile_blueprint,
					Translation: [
						(-15 + x) * 8,
						0,
						(-15 + y) * 8
					]
				});
			}
		}
		game.Add(get_town_gate_blueprint(game, fence_gate_size, fence_line));
		let buildings_count = 4;
		let starting_position = 0;
		let building_x_tile = 10;
		for (let i = 0; i < buildings_count; i++) {
			let building_blu = get_building_blueprint(game);
			let building_x = building_blu.Size_x / 8;
			let building_z = building_blu.Size_z / 8;
			if (starting_position + building_z > map_size) break;
			game.Add({
				Translation: [
					-41.5,
					0,
					(-15 + starting_position) * 8 - 3.5
				],
				Children: [building_blu.Blueprint]
			});
			for (let z = starting_position; z < starting_position + building_z; z++) for (let x = building_x_tile; x < building_x_tile + building_x; x++) game.Grid[x][z] = NaN;
			starting_position += building_blu.Size_z / 8 + integer(1, 2);
		}
		let cowboys_count = 20;
		for (let i = 0; i < cowboys_count; i++) {
			let x = integer(0, map_size);
			let y = integer(0, map_size);
			if (game.Grid[x] && game.Grid[x][y] && !isNaN(game.Grid[x][y])) game.Add({
				Translation: [
					(-15 + x) * 8,
					4.3 + Math.random(),
					(-15 + y) * 8
				],
				Using: [
					npc(),
					walking(x, y),
					move(integer(15, 25), 0)
				],
				Children: [get_character_blueprint(game)]
			});
		}
		if (!game.PlayerXY) game.PlayerXY = {
			X: map_size / 2,
			Y: map_size / 2
		};
		calculate_distance(game, game.PlayerXY);
		if (is_intro) {
			game.Add({
				Translation: [
					1,
					2,
					-1
				],
				Using: [light([
					.7,
					.7,
					.7
				], 0)],
				Children: [{ Using: [audio_source(snd_wind)] }]
			});
			game.Player = game.Add({ Using: [walking(map_size / 2, map_size / 2)] });
		} else {
			game.Add({
				Translation: [
					1,
					2,
					-1
				],
				Using: [light([
					.5,
					.5,
					.5
				], 0), audio_source(snd_music)],
				Children: [{ Using: [audio_source(snd_neigh)] }, { Using: [audio_source(snd_wind)] }]
			});
			game.Add({
				Translation: [
					0,
					5,
					24
				],
				Rotation: from_euler([], 0, 90, 0),
				Using: [collide(false, [
					8,
					8,
					8
				]), trigger(Action.GoToWanted)],
				Children: [get_character_blueprint(game), {
					Translation: [
						0,
						10,
						0
					],
					Using: game.BountySeed ? [] : [draw(widget_exclamation, ["!"]), lifespan()]
				}]
			});
			game.Add({
				Translation: [
					24,
					5,
					-64
				],
				Using: [collide(false, [
					8,
					8,
					8
				]), trigger(Action.GoToStore)],
				Children: [get_character_blueprint(game), {
					Translation: [
						0,
						10,
						0
					],
					Using: [draw(widget_exclamation, ["$"]), lifespan()]
				}]
			});
			let player_position = game[Get.Transform][find_navigable(game, game.PlayerXY)].Translation;
			set_seed(game.PlayerSeed);
			game.Player = game.Add({
				Translation: [
					player_position[0],
					5,
					player_position[2]
				],
				Using: [
					player_control(),
					walking(game.PlayerXY.X, game.PlayerXY.Y),
					move(25, 0),
					collide(true, [
						3,
						7,
						3
					], RayTarget.Player),
					health(1e4)
				],
				Children: [get_character_blueprint(game), {
					Translation: [
						0,
						25,
						0
					],
					Using: [light([
						1,
						1,
						1
					], 20)]
				}]
			});
		}
		game.Add({
			...get_town_gate_blueprint(game, 0, 2),
			Rotation: from_euler([], 0, 180, 0)
		});
		if (game.Gold > 0 && game.Gold < 1e4) game.Grid[back_fence_line][15] = Infinity;
		game.Add({
			Translation: [
				-120,
				5,
				-120
			],
			Using: [collide(false, [
				8,
				8,
				8
			]), trigger(Action.GoToDesert)],
			Children: [get_character_blueprint(game)]
		});
		game.Add({
			...get_gold_blueprint(game),
			Translation: [
				56,
				1.5,
				0
			]
		});
		game.Add({
			Scale: [
				240,
				60,
				240
			],
			Translation: [
				-4,
				-29.51,
				-4
			],
			Using: [render_vox(Float32Array.from([
				0,
				0,
				0,
				PaletteColors.desert_ground_1
			]), main_palette)]
		});
		game.Add(create_iso_camera(game.Player));
	}
	function world_intro(game) {
		world_town(game, true);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/worlds/wor_wanted.ts
	function world_wanted(game) {
		set_seed(game.BountySeed);
		game.World = [];
		game.GL.clearColor(.9, .7, .3, 1);
		game.Add({
			Using: [animate({ [Anim.Idle]: {
				Keyframes: [
					{
						Timestamp: 0,
						Rotation: [
							0,
							0,
							0,
							1
						]
					},
					{
						Timestamp: 2,
						Rotation: [
							0,
							1,
							0,
							0
						]
					},
					{
						Timestamp: 4,
						Rotation: [
							0,
							0,
							0,
							-1
						]
					}
				],
				Flags: AnimationFlag.Loop
			} })],
			Children: [get_character_blueprint(game)]
		});
		game.Add({
			Translation: [
				0,
				2,
				10
			],
			Using: [camera_ortho(10, 1, 100)]
		});
		game.Add({
			Translation: [
				1,
				1,
				1
			],
			Using: [light([
				.5,
				.5,
				.5
			], 0)]
		});
		game.Add({
			Translation: [
				-15,
				15,
				15
			],
			Using: [light([
				1,
				1,
				1
			], 25)]
		});
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/actions.ts
	var PlayerState = /* @__PURE__ */ function(PlayerState) {
		PlayerState[PlayerState["Playing"] = 0] = "Playing";
		PlayerState[PlayerState["Victory"] = 1] = "Victory";
		PlayerState[PlayerState["Defeat"] = 2] = "Defeat";
		return PlayerState;
	}({});
	var Action = /* @__PURE__ */ function(Action) {
		Action[Action["CompleteBounty"] = 1] = "CompleteBounty";
		Action[Action["EndChallenge"] = 2] = "EndChallenge";
		Action[Action["GoToTown"] = 3] = "GoToTown";
		Action[Action["GoToStore"] = 4] = "GoToStore";
		Action[Action["GoToWanted"] = 5] = "GoToWanted";
		Action[Action["GoToDesert"] = 6] = "GoToDesert";
		Action[Action["GoToMine"] = 7] = "GoToMine";
		Action[Action["Hit"] = 8] = "Hit";
		Action[Action["Die"] = 9] = "Die";
		Action[Action["CollectGold"] = 10] = "CollectGold";
		Action[Action["ChangePlayerSeed"] = 11] = "ChangePlayerSeed";
		Action[Action["HealCampfire"] = 12] = "HealCampfire";
		return Action;
	}({});
	function dispatch(game, action, args) {
		switch (action) {
			case 1:
				game.Gold += game.ChallengeLevel * 1e3;
				game.ChallengeLevel += 1;
				game.PlayerState = 0;
				game.PlayerXY = void 0;
				game.BountySeed = 0;
				game.WorldFunc = world_town;
				setTimeout(game.WorldFunc, 0, game);
				break;
			case 2:
				game.Gold = 0;
				game.ChallengeLevel = 1;
				game.PlayerState = 0;
				game.PlayerXY = void 0;
				game.BountySeed = 0;
				game.WorldFunc = world_intro;
				setTimeout(game.WorldFunc, 0, game);
				break;
			case 3:
				game.Audio.close();
				game.Audio = new AudioContext();
				game.WorldFunc = world_town;
				setTimeout(game.WorldFunc, 0, game);
				break;
			case 5:
				game.PlayerXY = game[Get.Walking][game.Player];
				game.BountySeed = game.ChallengeSeed * game.ChallengeLevel - 1;
				game.WorldFunc = world_wanted;
				setTimeout(game.WorldFunc, 0, game);
				break;
			case 4:
				game.MonetizationEnabled = true;
				game.PlayerXY = game[Get.Walking][game.Player];
				game.WorldFunc = world_store;
				setTimeout(game.WorldFunc, 0, game);
				break;
			case 11:
				if (game.MonetizationEnabled) game.PlayerSeed = Math.random() * 1e4;
				setTimeout(game.WorldFunc, 0, game);
				break;
			case 6:
				game.Audio.close();
				game.Audio = new AudioContext();
				game.WorldFunc = world_desert;
				setTimeout(game.WorldFunc, 0, game);
				break;
			case 7:
				game.Audio.close();
				game.Audio = new AudioContext();
				game.WorldFunc = game.BountySeed ? world_mine : world_town;
				setTimeout(game.WorldFunc, 0, game);
				break;
			case 8: {
				let [entity, damage] = args;
				game.Add({
					Translation: game[Get.Transform][entity].Translation.slice(),
					Using: [draw(widget_value, [damage]), lifespan(1)]
				});
				if (game.World[entity] & 1 << Get.PlayerControl) game.Add({ Using: [draw(widget_player_hit), lifespan(1)] });
				break;
			}
			case 10: {
				let [entity] = args;
				let value = integer(100, 1e3);
				game.Gold += value;
				game[Get.AudioSource][entity].Trigger = snd_gold;
				game.Add({
					Translation: game[Get.Transform][game.Player].Translation.slice(),
					Using: [draw(widget_value, [value, "$"]), lifespan(1)]
				});
				lifespan(0)(game, entity);
				break;
			}
			case 9: {
				let entity = args[0];
				if (game.World[entity] & 1 << Get.PlayerControl) {
					game.World[entity] &= ~(1 << Get.PlayerControl | 1 << Get.Health | 1 << Get.Move | 1 << Get.Collide);
					game.PlayerState = 2;
				} else if (game.World[entity] & 1 << Get.NPC) {
					if (game[Get.NPC][entity].Bounty) {
						game.PlayerState = 1;
						for (let i = 0; i < game.World.length; i++) if (game.World[i] & 1 << Get.NPC) game.World[i] &= ~(1 << Get.Walking);
					}
					game.World[entity] &= ~(1 << Get.NPC | 1 << Get.Health | 1 << Get.Move | 1 << Get.Collide);
					setTimeout(() => game.Destroy(entity), 5e3);
				}
				break;
			}
			case 12: {
				let entity = args[0];
				game.Destroy(entity);
				let health = game[Get.Health][game.Player];
				health.Current = health.Max;
			}
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_transform.ts
	function transform(Translation = [
		0,
		0,
		0
	], Rotation = [
		0,
		0,
		0,
		1
	], Scale = [
		1,
		1,
		1
	]) {
		return (game, EntityId) => {
			game.World[EntityId] |= 1 << Get.Transform;
			game[Get.Transform][EntityId] = {
				EntityId,
				World: create(),
				Self: create(),
				Translation,
				Rotation,
				Scale,
				Children: [],
				Dirty: true
			};
		};
	}
	/**
	* Get all component instances of a given type from the current entity and all
	* its children.
	*
	* @param game Game object which stores the component data.
	* @param transform The transform to traverse.
	* @param component Component mask to look for.
	*/
	function* components_of_type(game, transform, component) {
		if (game.World[transform.EntityId] & 1 << component) yield game[component][transform.EntityId];
		for (let child of transform.Children) yield* components_of_type(game, child, component);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/materials/mat_common.ts
	function link(gl, vertex, fragment) {
		let program = gl.createProgram();
		gl.attachShader(program, compile(gl, GL_VERTEX_SHADER, vertex));
		gl.attachShader(program, compile(gl, GL_FRAGMENT_SHADER, fragment));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, 35714)) throw new Error(gl.getProgramInfoLog(program));
		return program;
	}
	function compile(gl, type, source) {
		let shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, 35713)) throw new Error(gl.getShaderInfoLog(shader));
		return shader;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/materials/mat_instanced.ts
	var vertex$2 = `#version 300 es\n
    // Matrices: PV, world, self
    uniform mat4 p,q,r;
    // Color palette
    uniform vec3 s[16];

    // Light count
    uniform int t;
    // Light positions
    uniform vec3 u[100];
    // Light details
    uniform vec4 v[100];

    layout(location=${InstancedAttribute.Position}) in vec3 k;
    layout(location=${InstancedAttribute.Normal}) in vec3 m;
    layout(location=${InstancedAttribute.Offset}) in vec4 n;

    // Vertex color
    out vec4 o;

    void main(){
        // World position
        vec4 a=q*vec4(k+n.rgb,1.);
        // World normal
        vec3 b=normalize((vec4(m,0.)* r).rgb);
        gl_Position=p*a;

        // Color
        vec3 c=s[int(n[3])].rgb*.1;
        for(int i=0;i<t;i++){
            if(v[i].a<1.) {
                // A directional light.
                // max(dot()) is the diffuse factor.
                c+=s[int(n[3])].rgb*v[i].rgb*max(dot(b,normalize(u[i])),0.);
            }else{
                // A point light.
                // Light direction
                vec3 ld=u[i]-a.xyz;
                // Distance
                float d=length(ld);
                // max(dot()) is the diffuse factor.
                c+=s[int(n[3])].rgb*v[i].rgb*max(dot(b,normalize(ld)),0.)*v[i].a/(d*d);
            }
        }

        o=vec4(c,1.);
    }
`;
	var fragment$2 = `#version 300 es\n
    precision mediump float;

    // Vertex color
    in vec4 o;
    // Fragment color
    out vec4 z;

    void main(){
        z=o;
    }
`;
	function mat_instanced(GL) {
		let material = {
			GL,
			Mode: 4,
			Program: link(GL, vertex$2, fragment$2),
			Uniforms: []
		};
		for (let name of [
			"p",
			"q",
			"r",
			"s",
			"t",
			"u",
			"v"
		]) material.Uniforms.push(GL.getUniformLocation(material.Program, name));
		return material;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/materials/mat_particles.ts
	var vertex$1 = `#version 300 es\n
    // Projection * View matrix
    uniform mat4 p;
    // [red, green, blue, size]
    uniform vec4 q;

    // [x, y, z, age]
    layout(location=${ParticleAttribute.Origin}) in vec4 k;

    // Vertex color
    out vec4 o;

    void main(){
        vec4 a=vec4(k.rgb,1.);
        if(q.a<10.) {
            // It's a projectile.
            a.y+=k.a*2.;
            gl_PointSize=mix(q.a,1.,k.a);
        }else{
            // It's a campfire.
            a.y+=k.a*10.;
            gl_PointSize=mix(q.a,1.,k.a);
        }
        gl_Position=p*a;
        o=mix(vec4(q.rgb,1.),vec4(1.,1.,0.,1.),k.a);
    }
`;
	var fragment$1 = `#version 300 es\n
    precision mediump float;

    // Vertex color
    in vec4 o;
    // Fragment color
    out vec4 z;

    void main(){
        z=o;
    }
`;
	function mat_particles(GL) {
		let material = {
			GL,
			Mode: 0,
			Program: link(GL, vertex$1, fragment$1),
			Uniforms: []
		};
		for (let name of ["p", "q"]) material.Uniforms.push(GL.getUniformLocation(material.Program, name));
		return material;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_render_basic.ts
	var BasicAttribute = /* @__PURE__ */ function(BasicAttribute) {
		BasicAttribute[BasicAttribute["Position"] = 1] = "Position";
		return BasicAttribute;
	}({});
	var BasicUniform = /* @__PURE__ */ function(BasicUniform) {
		BasicUniform[BasicUniform["PV"] = 0] = "PV";
		BasicUniform[BasicUniform["World"] = 1] = "World";
		BasicUniform[BasicUniform["Color"] = 2] = "Color";
		return BasicUniform;
	}({});
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/materials/mat_wireframe.ts
	var vertex = `#version 300 es\n
    // Matrices: PV, world
    uniform mat4 p,q;

    layout(location=${BasicAttribute.Position}) in vec3 k;

    void main(){
        gl_Position=p*q*vec4(k,1.);
    }
`;
	var fragment = `#version 300 es\n
    precision mediump float;
    // Line color
    uniform vec4 r;

    // Fragment color
    out vec4 z;

    void main() {
        z=r;
    }
`;
	function mat_wireframe(GL) {
		let material = {
			GL,
			Mode: 2,
			Program: link(GL, vertex, fragment),
			Uniforms: []
		};
		for (let name of [
			"p",
			"q",
			"r"
		]) material.Uniforms.push(GL.getUniformLocation(material.Program, name));
		return material;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_ai.ts
	var QUERY$19 = 1 << Get.Transform | 1 << Get.NPC | 1 << Get.Walking;
	function sys_ai(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$19) == QUERY$19) update$16(game, i, delta);
	}
	function update$16(game, entity, delta) {
		let walking = game[Get.Walking][entity];
		let is_friendly = game[Get.NPC][entity].Friendly;
		let can_shoot = game[Get.NPC][entity].LastShot <= 0;
		let player_walking = game[Get.Walking][game.Player];
		let distance_to_player = Math.abs(game.Grid[walking.X][walking.Y] - game.Grid[player_walking.X][player_walking.Y]);
		let route = [];
		if (!walking.Route.length && !walking.Destination) {
			if (is_friendly || distance_to_player > 5) {
				let destination_depth = integer(1, 15);
				while (destination_depth == game.Grid[walking.X][walking.Y]) destination_depth = integer(1, 15);
				route = get_random_route(game, entity, destination_depth);
			} else {
				route = get_route(game, game.Player, walking);
				if (route) {
					route.pop();
					route.pop();
					route = route.reverse();
				}
			}
			if (route && route.length > 1) walking.Route = route;
		}
		if (!is_friendly && game.World[entity] & 1 << Get.Shoot) {
			if (distance_to_player < 4 && can_shoot) {
				game[Get.Shoot][entity].Target = game[Get.Transform][game.Player].Translation;
				game[Get.NPC][entity].LastShot = .5;
				walking.Route = [];
			} else game[Get.NPC][entity].LastShot -= delta;
		}
	}
	function get_random_route(game, entity, destination_depth) {
		let walking = game[Get.Walking][entity];
		let current_cell = game[Get.Navigable][find_navigable(game, walking)];
		let current_depth = game.Grid[walking.X][walking.Y];
		let modifier = destination_depth > current_depth ? 1 : -1;
		let route = [];
		if (!(current_depth < 16)) return false;
		while (destination_depth !== current_depth) {
			if (route.length > 10) return false;
			route.push(current_cell);
			let neighbors = get_neighbors(game, current_cell).sort(() => .5 - Math.random());
			for (let i = 0; i < neighbors.length; i++) {
				let neighbor_coords = neighbors[i];
				if (game.Grid[neighbor_coords.X][neighbor_coords.Y] == current_depth + 1 * modifier) {
					current_cell = game[Get.Navigable][find_navigable(game, neighbor_coords)];
					current_depth = game.Grid[current_cell.X][current_cell.Y];
					break;
				}
			}
		}
		return route.reverse();
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_aim.ts
	var QUERY$18 = 1 << Get.Transform | 1 << Get.Shoot;
	function sys_aim(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$18) == QUERY$18) update$15(game, i);
	}
	function update$15(game, entity) {
		let shoot = game[Get.Shoot][entity];
		if (shoot.Target) {
			let transform = game[Get.Transform][entity];
			let move = game[Get.Move][entity];
			let forward = get_forward([], transform.World);
			let forward_theta = Math.atan2(forward[2], forward[0]);
			let dir = subtract([], shoot.Target, transform.Translation);
			move.Yaw = from_euler([], 0, (forward_theta - Math.atan2(dir[2], dir[0])) * 57, 0);
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_animate.ts
	var QUERY$17 = 1 << Get.Transform | 1 << Get.Animate;
	function sys_animate(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$17) == QUERY$17) update$14(game, i, delta);
	}
	function update$14(game, entity, delta) {
		let transform = game[Get.Transform][entity];
		let animate = game[Get.Animate][entity];
		let next = animate.Trigger && animate.States[animate.Trigger];
		if (next && animate.Current.Flags & AnimationFlag.EarlyExit) {
			animate.Current = next;
			animate.Trigger = void 0;
		}
		animate.Current.Time += delta;
		if (animate.Current.Time > animate.Current.Duration) animate.Current.Time = animate.Current.Duration;
		let current_keyframe = null;
		let next_keyframe = null;
		for (let keyframe of animate.Current.Keyframes) if (animate.Current.Time <= keyframe.Timestamp) {
			next_keyframe = keyframe;
			break;
		} else current_keyframe = keyframe;
		if (current_keyframe && next_keyframe) {
			let keyframe_duration = next_keyframe.Timestamp - current_keyframe.Timestamp;
			let interpolant = (animate.Current.Time - current_keyframe.Timestamp) / keyframe_duration;
			if (next_keyframe.Ease) interpolant = next_keyframe.Ease(interpolant);
			if (current_keyframe.Translation && next_keyframe.Translation) {
				lerp(transform.Translation, current_keyframe.Translation, next_keyframe.Translation, interpolant);
				transform.Dirty = true;
			}
			if (current_keyframe.Rotation && next_keyframe.Rotation) {
				slerp(transform.Rotation, current_keyframe.Rotation, next_keyframe.Rotation, interpolant);
				transform.Dirty = true;
			}
		}
		if (animate.Current.Time == animate.Current.Duration) {
			animate.Current.Time = 0;
			if (animate.Current.Flags & AnimationFlag.Alternate) for (let keyframe of animate.Current.Keyframes.reverse()) keyframe.Timestamp = animate.Current.Duration - keyframe.Timestamp;
			if (next) {
				animate.Current = next;
				animate.Trigger = void 0;
			} else if (!(animate.Current.Flags & AnimationFlag.Loop)) animate.Current = animate.States[Anim.Idle];
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/audio.ts
	function play_note(audio, instr, note, offset) {
		let time = audio.currentTime + offset;
		let total_duration = 0;
		let master = audio.createGain();
		master.gain.value = (instr[InstrumentParam.MasterGainAmount] / 9) ** 3;
		let lfa, lfo;
		if (instr[InstrumentParam.LFOType]) {
			lfo = audio.createOscillator();
			lfo.type = instr[InstrumentParam.LFOType];
			lfo.frequency.value = (instr[InstrumentParam.LFOFreq] / 3) ** 3;
			lfa = audio.createGain();
			lfa.gain.value = (instr[InstrumentParam.LFOAmount] + 3) ** 3;
			lfo.connect(lfa);
		}
		if (instr[InstrumentParam.FilterType]) {
			let filter = audio.createBiquadFilter();
			filter.type = instr[InstrumentParam.FilterType];
			filter.frequency.value = 2 ** instr[InstrumentParam.FilterFreq];
			filter.Q.value = instr[InstrumentParam.FilterQ] ** 1.5;
			if (lfa && instr[InstrumentParam.FilterDetuneLFO]) lfa.connect(filter.detune);
			master.connect(filter);
			filter.connect(audio.destination);
		} else master.connect(audio.destination);
		for (let source of instr[InstrumentParam.Sources]) {
			let amp = audio.createGain();
			amp.connect(master);
			let gain_amount = (source[SourceParam.GainAmount] / 9) ** 3;
			let gain_attack = (source[SourceParam.GainAttack] / 9) ** 3;
			let gain_sustain = (source[SourceParam.GainSustain] / 9) ** 3;
			let gain_release = (source[SourceParam.GainRelease] / 6) ** 3;
			let gain_duration = gain_attack + gain_sustain + gain_release;
			amp.gain.setValueAtTime(0, time);
			amp.gain.linearRampToValueAtTime(gain_amount, time + gain_attack);
			amp.gain.setValueAtTime(gain_amount, time + gain_attack + gain_sustain);
			amp.gain.exponentialRampToValueAtTime(1e-5, time + gain_duration);
			if (source[0]) {
				let hfo = audio.createOscillator();
				hfo.type = source[SourceParam.SourceType];
				hfo.connect(amp);
				hfo.detune.value = 3 * (source[SourceParam.DetuneAmount] - 7.5) ** 3;
				if (lfa && source[SourceParam.DetuneLFO]) lfa.connect(hfo.detune);
				let freq = 440 * 2 ** ((note - 69) / 12);
				if (source[SourceParam.FreqEnabled]) {
					let freq_attack = (source[SourceParam.FreqAttack] / 9) ** 3;
					let freq_sustain = (source[SourceParam.FreqSustain] / 9) ** 3;
					let freq_release = (source[SourceParam.FreqRelease] / 6) ** 3;
					hfo.frequency.linearRampToValueAtTime(0, time);
					hfo.frequency.linearRampToValueAtTime(freq, time + freq_attack);
					hfo.frequency.setValueAtTime(freq, time + freq_attack + freq_sustain);
					hfo.frequency.exponentialRampToValueAtTime(1e-5, time + freq_attack + freq_sustain + freq_release);
				} else hfo.frequency.setValueAtTime(freq, time);
				hfo.start(time);
				hfo.stop(time + gain_duration);
			} else {
				let noise = audio.createBufferSource();
				noise.buffer = lazy_noise_buffer(audio);
				noise.loop = true;
				noise.connect(amp);
				noise.start(time);
				noise.stop(time + gain_duration);
			}
			if (gain_duration > total_duration) total_duration = gain_duration;
		}
		if (lfo) {
			lfo.start(time);
			lfo.stop(time + total_duration);
		}
	}
	var noise_buffer;
	function lazy_noise_buffer(audio) {
		if (!noise_buffer) {
			noise_buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
			let channel = noise_buffer.getChannelData(0);
			for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
		}
		return noise_buffer;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_audio.ts
	function sys_audio(game, delta) {
		for (let i = 0; i < game.World.length; i++) if (game.World[i] & 1 << Get.AudioSource) update$13(game, i, delta);
	}
	function update$13(game, entity, delta) {
		let audio_source = game[Get.AudioSource][entity];
		let can_exit = !audio_source.Current || audio_source.Time > audio_source.Current.Exit;
		if (audio_source.Trigger && can_exit) {
			for (let track of audio_source.Trigger.Tracks) for (let i = 0; i < track.Notes.length; i++) if (track.Notes[i]) play_note(game.Audio, track.Instrument, track.Notes[i], i * .15);
			audio_source.Current = audio_source.Trigger;
			audio_source.Time = 0;
		} else audio_source.Time += delta;
		audio_source.Trigger = audio_source.Idle;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_camera.ts
	var QUERY$16 = 1 << Get.Transform | 1 << Get.Camera;
	function sys_camera(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$16) == QUERY$16) update$12(game, i);
	}
	function update$12(game, entity) {
		let transform = game[Get.Transform][entity];
		let camera = game[Get.Camera][entity];
		game.Camera = camera;
		invert(camera.View, transform.World);
		multiply$1(camera.PV, camera.Projection, camera.View);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_collide.ts
	var QUERY$15 = 1 << Get.Transform | 1 << Get.Collide;
	function sys_collide(game, delta) {
		let static_colliders = [];
		let dynamic_colliders = [];
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$15) == QUERY$15) {
			let transform = game[Get.Transform][i];
			let collider = game[Get.Collide][i];
			collider.Collisions = [];
			if (collider.New) {
				collider.New = false;
				compute_aabb(transform, collider);
			} else if (collider.Dynamic) {
				compute_aabb(transform, collider);
				dynamic_colliders.push(collider);
			} else static_colliders.push(collider);
		}
		for (let i = 0; i < dynamic_colliders.length; i++) {
			check_collisions(dynamic_colliders[i], static_colliders, static_colliders.length);
			check_collisions(dynamic_colliders[i], dynamic_colliders, i);
		}
	}
	/**
	* Check for collisions between a dynamic collider and other colliders. Length
	* is used to control how many colliders to check against. For collisions
	* with static colliders, length should be equal to colliders.length, since
	* we want to consider all static colliders in the scene. For collisions with
	* other dynamic colliders, we only need to check a pair of colliders once.
	* Varying length allows to skip half of the NxN checks matrix.
	*
	* @param game The game instance.
	* @param collider The current collider.
	* @param colliders Other colliders to test against.
	* @param length How many colliders to check.
	*/
	function check_collisions(collider, colliders, length) {
		for (let i = 0; i < length; i++) {
			let other = colliders[i];
			if (intersect_aabb(collider, other)) {
				collider.Collisions.push(other);
				other.Collisions.push(collider);
			}
		}
	}
	function compute_aabb(transform, collide) {
		let world_position = get_translation([], transform.World);
		let half = scale([], collide.Size, .5);
		subtract(collide.Min, world_position, half);
		add(collide.Max, world_position, half);
	}
	function intersect_aabb(a, b) {
		return a.Min[0] < b.Max[0] && a.Max[0] > b.Min[0] && a.Min[1] < b.Max[1] && a.Max[1] > b.Min[1] && a.Min[2] < b.Max[2] && a.Max[2] > b.Min[2];
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_control_projectile.ts
	var QUERY$14 = 1 << Get.Transform | 1 << Get.Collide | 1 << Get.Move | 1 << Get.Projectile;
	function sys_control_projectile(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$14) == QUERY$14) update$11(game, i);
	}
	function update$11(game, entity) {
		let projectile = game[Get.Projectile][entity];
		let move = game[Get.Move][entity];
		let collide = game[Get.Collide][entity];
		if (collide.Collisions.length > 0) {
			game.Destroy(entity);
			for (let collider of collide.Collisions) if (game.World[collider.EntityId] & 1 << Get.Health) game[Get.Health][collider.EntityId].Damage = Math.random() * projectile.Damage + Math.random() * projectile.Damage;
		} else move.Direction = get_forward([], game[Get.Transform][entity].World);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_cull.ts
	var QUERY$13 = 1 << Get.Transform | 1 << Get.Cull;
	function sys_cull(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$13) == QUERY$13 && game.Camera) update$10(game, i);
	}
	var position = [
		0,
		0,
		0
	];
	function update$10(game, entity) {
		let cull = game[Get.Cull][entity];
		get_translation(position, game[Get.Transform][entity].World);
		transform_point(position, position, game.Camera.View);
		if (Math.abs(position[0]) > 1 / game.Camera.Projection[0] + 8 || Math.abs(position[1]) > 1 / game.Camera.Projection[5] + 8) game.World[entity] &= ~(1 << cull.Component);
		else game.World[entity] |= 1 << cull.Component;
	}
	Float32Array.from([
		0,
		0,
		0,
		0,
		0,
		10
	]), Uint16Array.from([1, 2]), Float32Array.from([]);
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_draw.ts
	var QUERY$12 = 1 << Get.Transform | 1 << Get.Draw;
	function sys_draw(game, delta) {
		game.Context.clearRect(0, 0, game.Canvas2.width, game.Canvas2.height);
		let position = [];
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$12) == QUERY$12) {
			get_translation(position, game[Get.Transform][i].World);
			transform_point(position, position, game.Camera.PV);
			game[Get.Draw][i].Widget(game, i, .5 * (position[0] + 1) * game.Canvas3.width, .5 * (-position[1] + 1) * game.Canvas3.height);
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_framerate.ts
	var counter = document.getElementById("fps");
	function sys_framerate(game, delta) {
		if (counter) counter.textContent = (1 / delta).toFixed();
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_health.ts
	var QUERY$11 = 1 << Get.Health;
	function sys_health(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$11) == QUERY$11) update$9(game, i);
	}
	function update$9(game, entity) {
		let health = game[Get.Health][entity];
		if (health.Damage) {
			dispatch(game, Action.Hit, [entity, health.Damage]);
			health.Current -= health.Damage;
			health.Damage = 0;
			for (let animate of components_of_type(game, game[Get.Transform][entity], Get.Animate)) animate.Trigger = Anim.Hit;
		}
		if (health.Current <= 0) {
			health.Current = 0;
			dispatch(game, Action.Die, [entity]);
			for (let animate of components_of_type(game, game[Get.Transform][entity], Get.Animate)) animate.Trigger = Anim.Die;
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_lifespan.ts
	var QUERY$10 = 1 << Get.Transform | 1 << Get.Lifespan;
	function sys_lifespan(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$10) == QUERY$10) update$8(game, i, delta);
	}
	function update$8(game, entity, delta) {
		let lifespan = game[Get.Lifespan][entity];
		lifespan.Age += delta;
		if (lifespan.Age > lifespan.Max) game.Destroy(entity);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_mimic.ts
	var QUERY$9 = 1 << Get.Transform | 1 << Get.Mimic;
	function sys_mimic(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$9) == QUERY$9) {
			let follower_transform = game[Get.Transform][i];
			let follower_mimic = game[Get.Mimic][i];
			let target_transform = game[Get.Transform][follower_mimic.Target];
			let target_world_position = get_translation([], target_transform.World);
			follower_transform.Translation = lerp([], follower_transform.Translation, target_world_position, .1);
			follower_transform.Dirty = true;
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_move.ts
	var QUERY$8 = 1 << Get.Transform | 1 << Get.Move;
	function sys_move(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$8) == QUERY$8) update$7(game, i, delta);
	}
	function update$7(game, entity, delta) {
		let transform = game[Get.Transform][entity];
		let move = game[Get.Move][entity];
		if (move.Direction) {
			scale(move.Direction, move.Direction, move.MoveSpeed * delta);
			add(transform.Translation, transform.Translation, move.Direction);
			transform.Dirty = true;
			move.Direction = void 0;
			for (let animate of components_of_type(game, transform, Get.Animate)) animate.Trigger = Anim.Move;
		} else for (let animate of components_of_type(game, transform, Get.Animate)) animate.Trigger = Anim.Idle;
		if (move.Yaw) {
			multiply(transform.Rotation, move.Yaw, transform.Rotation);
			transform.Dirty = true;
			move.Yaw = void 0;
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_navigate.ts
	var QUERY$7 = 1 << Get.Transform | 1 << Get.Move | 1 << Get.Walking;
	function sys_navigate(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$7) == QUERY$7) update$6(game, i);
	}
	function update$6(game, entity) {
		let walking = game[Get.Walking][entity];
		if (!walking.Destination) {
			if (walking.Route.length) {
				let dest = walking.Route.pop();
				let destination_entity = find_navigable(game, dest);
				walking.DestinationX = dest.X;
				walking.DestinationY = dest.Y;
				walking.Destination = game[Get.Transform][destination_entity].Translation;
			}
		}
		if (walking.Destination) {
			let transform = game[Get.Transform][entity];
			let dir = subtract([], [
				walking.Destination[0],
				transform.Translation[1],
				walking.Destination[2]
			], transform.Translation);
			if (length(dir) < 1) {
				walking.X = walking.DestinationX;
				walking.Y = walking.DestinationY;
				walking.Destination = null;
			}
			let move = game[Get.Move][entity];
			move.Direction = normalize(dir, dir);
			let forward = get_forward([], transform.World);
			move.Yaw = from_euler([], 0, (Math.atan2(forward[2], forward[0]) - Math.atan2(dir[2], dir[0])) * 57, 0);
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_particles.ts
	var QUERY$6 = 1 << Get.Transform | 1 << Get.EmitParticles;
	function sys_particles(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$6) == QUERY$6) update$5(game, i, delta);
	}
	function update$5(game, entity, delta) {
		let emitter = game[Get.EmitParticles][entity];
		let transform = game[Get.Transform][entity];
		emitter.SinceLast += delta;
		if (emitter.SinceLast > emitter.Frequency) {
			emitter.SinceLast = 0;
			let origin = get_translation([], transform.World);
			emitter.Instances.push(...origin, 0);
		}
		for (let i = 0; i < emitter.Instances.length;) {
			emitter.Instances[i + 3] += delta / emitter.Lifespan;
			if (emitter.Instances[i + 3] > 1) emitter.Instances.splice(i, 4);
			else i += 4;
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_performance.ts
	function sys_performance(game, delta, target) {
		if (target) target.textContent = `${delta.toFixed(1)} ms`;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_render.ts
	var QUERY$5 = 1 << Get.Transform | 1 << Get.Render;
	var LIGHTS = 1 << Get.Transform | 1 << Get.Light;
	function sys_render(game, delta) {
		game.GL.clear(GL_COLOR_BUFFER_BIT | 256);
		let light_positions = [];
		let light_details = [];
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & LIGHTS) == LIGHTS) {
			let transform = game[Get.Transform][i];
			let position = get_translation([], transform.World);
			light_positions.push(...position);
			light_details.push(...game[Get.Light][i]);
		}
		let current_material = null;
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$5) == QUERY$5) {
			let transform = game[Get.Transform][i];
			let render = game[Get.Render][i];
			if (render.Material !== current_material) {
				current_material = render.Material;
				game.GL.useProgram(current_material.Program);
				game.GL.uniformMatrix4fv(current_material.Uniforms[0], false, game.Camera.PV);
				switch (render.Kind) {
					case RenderKind.Instanced:
						game.GL.uniform1i(current_material.Uniforms[InstancedUniform.LightCount], light_positions.length / 3);
						game.GL.uniform3fv(current_material.Uniforms[InstancedUniform.LightPositions], light_positions);
						game.GL.uniform4fv(current_material.Uniforms[InstancedUniform.LightDetails], light_details);
				}
			}
			switch (render.Kind) {
				case RenderKind.Basic:
					draw_basic(game, transform, render);
					break;
				case RenderKind.Instanced:
					draw_instanced(game, transform, render);
					break;
				case RenderKind.Particles: {
					let emitter = game[Get.EmitParticles][i];
					if (emitter.Instances.length) draw_particles(game, render, emitter);
					break;
				}
			}
		}
	}
	function draw_basic(game, transform, render) {
		game.GL.uniformMatrix4fv(render.Material.Uniforms[BasicUniform.World], false, transform.World);
		game.GL.uniform4fv(render.Material.Uniforms[BasicUniform.Color], render.Color);
		game.GL.bindVertexArray(render.VAO);
		game.GL.drawElements(render.Material.Mode, render.Count, GL_UNSIGNED_SHORT, 0);
		game.GL.bindVertexArray(null);
	}
	function draw_instanced(game, transform, render) {
		game.GL.uniformMatrix4fv(render.Material.Uniforms[InstancedUniform.World], false, transform.World);
		game.GL.uniformMatrix4fv(render.Material.Uniforms[InstancedUniform.Self], false, transform.Self);
		game.GL.uniform3fv(render.Material.Uniforms[InstancedUniform.Palette], render.Palette || game.Palette);
		game.GL.bindVertexArray(render.VAO);
		game.GL.drawElementsInstanced(render.Material.Mode, render.IndexCount, GL_UNSIGNED_SHORT, 0, render.InstanceCount);
		game.GL.bindVertexArray(null);
	}
	function draw_particles(game, render, emitter) {
		game.GL.uniform4fv(render.Material.Uniforms[ParticleUniform.Detail], render.ColorSize);
		game.GL.bindBuffer(GL_ARRAY_BUFFER, render.Buffer);
		game.GL.bufferData(GL_ARRAY_BUFFER, Float32Array.from(emitter.Instances), GL_DYNAMIC_DRAW);
		game.GL.enableVertexAttribArray(ParticleAttribute.Origin);
		game.GL.vertexAttribPointer(ParticleAttribute.Origin, 4, GL_FLOAT, false, 16, 0);
		game.GL.drawArrays(render.Material.Mode, 0, emitter.Instances.length / 4);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/math/raycast.ts
	function raycast_aabb(colliders, origin, direction) {
		let nearest_t = Infinity;
		let nearest_i = null;
		for (let i = 0; i < colliders.length; i++) {
			let t = distance(origin, direction, colliders[i]);
			if (t < nearest_t) {
				nearest_t = t;
				nearest_i = i;
			}
		}
		if (nearest_i !== null) return colliders[nearest_i];
	}
	function distance(origin, direction, aabb) {
		let max_lo = -Infinity;
		let min_hi = Infinity;
		for (let i = 0; i < 3; i++) {
			let lo = (aabb.Min[i] - origin[i]) / direction[i];
			let hi = (aabb.Max[i] - origin[i]) / direction[i];
			if (lo > hi) [lo, hi] = [hi, lo];
			if (hi < max_lo || lo > min_hi) return Infinity;
			if (lo > max_lo) max_lo = lo;
			if (hi < min_hi) min_hi = hi;
		}
		return max_lo > min_hi ? Infinity : max_lo;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/sounds/snd_click.ts
	var snd_click = {
		Tracks: [{
			Instrument: [
				7,
				"lowpass",
				8,
				8,
				,
				,
				,
				,
				[[
					"sine",
					4,
					1,
					0,
					3,
					8
				]]
			],
			Notes: [69]
		}],
		Exit: .2
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_select.ts
	var QUERY$4 = 1 << Get.Transform | 1 << Get.Camera | 1 << Get.Select;
	var TARGET = 1 << Get.Transform | 1 << Get.Collide;
	var ANIMATED = RayTarget.Navigable | RayTarget.Player;
	function sys_select(game, delta) {
		let colliders = [];
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & TARGET) == TARGET) {
			if (game[Get.Collide][i].Flags !== RayTarget.None) colliders.push(game[Get.Collide][i]);
		}
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$4) == QUERY$4) update$4(game, i, colliders);
	}
	function update$4(game, entity, colliders) {
		let transform = game[Get.Transform][entity];
		let camera = game[Get.Camera][entity];
		let select = game[Get.Select][entity];
		let x = game.Input.mx / game.Canvas3.width * 2 - 1;
		let y = -(game.Input.my / game.Canvas3.height) * 2 + 1;
		let origin = [
			x,
			y,
			-1
		];
		let target = [
			x,
			y,
			1
		];
		let direction = [
			0,
			0,
			0
		];
		transform_point(origin, origin, camera.Unproject);
		transform_point(origin, origin, transform.World);
		transform_point(target, target, camera.Unproject);
		transform_point(target, target, transform.World);
		subtract(direction, target, origin);
		normalize(direction, direction);
		select.Hit = raycast_aabb(colliders, origin, direction);
		let t = (5 - origin[1]) / direction[1];
		add(select.Position, origin, scale(direction, direction, t));
		if (select.Hit && select.Hit.Flags & ANIMATED && game.Input.d0) {
			let transform = game[Get.Transform][select.Hit.EntityId];
			for (let animate of components_of_type(game, transform, Get.Animate)) animate.Trigger = Anim.Select;
			for (let audio of components_of_type(game, transform, Get.AudioSource)) audio.Trigger = snd_click;
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_shake.ts
	var QUERY$3 = 1 << Get.Transform | 1 << Get.Shake;
	function sys_shake(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$3) == QUERY$3) update$3(game, i, delta);
	}
	function update$3(game, entity, delta) {
		let shake = game[Get.Shake][entity];
		if (shake.Duration > 0) {
			shake.Duration -= delta;
			let transform = game[Get.Transform][entity];
			transform.Translation = [
				Math.random() - .5,
				Math.random() - .5,
				Math.random() - .5
			];
			transform.Dirty = true;
			if (shake.Duration <= 0) {
				shake.Duration = 0;
				transform.Translation = [
					0,
					0,
					0
				];
			}
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_flash.ts
	function create_flash() {
		return { Using: [light([
			1,
			1,
			1
		], 5), lifespan(.2)] };
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/components/com_projectile.ts
	function projectile(Damage) {
		return (game, entity) => {
			game.World[entity] |= 1 << Get.Projectile;
			game[Get.Projectile][entity] = { Damage };
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/blueprints/blu_projectile.ts
	function create_projectile(damage, speed, color, size) {
		return {
			Using: [
				collide(true),
				projectile(damage),
				lifespan(3),
				move(speed),
				light(color, 2)
			],
			Children: [{
				Scale: [
					.3,
					.3,
					.3
				],
				Using: [render_vox(/* @__PURE__ */ new Float32Array(4), color)]
			}, { Using: [
				shake(5),
				emit_particles(1, .08),
				render_particles(color, size)
			] }]
		};
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/sounds/snd_shoot1.ts
	var snd_shoot1 = {
		Tracks: [{
			Instrument: [
				5,
				"lowpass",
				10,
				4,
				,
				,
				,
				,
				[[
					false,
					10,
					0,
					0,
					5
				], [
					"sine",
					7,
					0,
					2,
					2,
					8
				]]
			],
			Notes: [57]
		}],
		Exit: .2
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/sounds/snd_shoot2.ts
	var snd_shoot2 = {
		Tracks: [{
			Instrument: [
				4,
				"lowpass",
				10,
				4,
				,
				,
				,
				,
				[[
					false,
					10,
					0,
					0,
					5
				]]
			],
			Notes: [57]
		}],
		Exit: .2
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_shoot.ts
	var QUERY$2 = 1 << Get.Transform | 1 << Get.Shoot;
	function sys_shoot(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$2) == QUERY$2) update$2(game, i);
	}
	function update$2(game, entity) {
		let shoot = game[Get.Shoot][entity];
		if (shoot.Target) {
			let transform = game[Get.Transform][entity];
			let projectile;
			let snd_shoot;
			if (game.World[entity] & 1 << Get.PlayerControl) {
				projectile = create_projectile(500, 40, [
					1,
					1,
					1
				], 9);
				snd_shoot = snd_shoot1;
			} else {
				projectile = create_projectile(300, 30, [
					1,
					0,
					0
				], 7);
				snd_shoot = snd_shoot2;
			}
			let Translation = get_translation([], transform.Children[0].Children[0].World);
			game.Add({
				...projectile,
				Translation,
				Rotation: transform.Rotation.slice()
			});
			game.Add({
				...create_flash(),
				Translation
			});
			for (let audio of components_of_type(game, transform, Get.AudioSource)) audio.Trigger = snd_shoot;
			for (let animate of components_of_type(game, transform, Get.Animate)) animate.Trigger = Anim.Shoot;
		}
		shoot.Target = null;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_transform.ts
	var QUERY$1 = 1 << Get.Transform;
	function sys_transform(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY$1) == QUERY$1) update$1(game[Get.Transform][i]);
	}
	function update$1(transform) {
		if (transform.Dirty) {
			transform.Dirty = false;
			set_children_as_dirty(transform);
			from_rotation_translation_scale(transform.World, transform.Rotation, transform.Translation, transform.Scale);
			if (transform.Parent) multiply$1(transform.World, transform.Parent.World, transform.World);
			invert(transform.Self, transform.World);
		}
	}
	function set_children_as_dirty(transform) {
		for (let child of transform.Children) {
			child.Dirty = true;
			set_children_as_dirty(child);
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_trigger.ts
	var QUERY = 1 << Get.Transform | 1 << Get.Collide | 1 << Get.Trigger;
	function sys_trigger(game, delta) {
		for (let i = 0; i < game.World.length; i++) if ((game.World[i] & QUERY) == QUERY) update(game, i);
	}
	function update(game, entity) {
		let collisions = game[Get.Collide][entity].Collisions;
		for (let collide of collisions) if (game.World[collide.EntityId] & 1 << Get.PlayerControl) {
			game.World[entity] &= ~(1 << Get.Trigger);
			dispatch(game, game[Get.Trigger][entity].Action, [entity]);
		}
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/ui/Defeat.ts
	function Defeat(state) {
		return `
        <div style="
            width: 66%;
            margin: 5vh auto;
            text-align: center;
        ">
            YOU DIE
            <div style="
                font: italic 5vmin serif;
            ">
                You earned $${state.Gold.toLocaleString("en")}.
            </div>
        </div>

        <div onclick="$(${Action.EndChallenge});" style="
            font: italic bold small-caps 7vmin serif;
            position: absolute;
            bottom: 5%;
            right: 10%;
        ">
            Try Again
        </div>
    `;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/ui/Intro.ts
	function Intro() {
		return `
        <div style="
            width: 66%;
            margin: 10vh auto;
        ">
            BACK<br>COUNTRY
            <div onclick="$(${Action.GoToTown});" style="
                font: italic bold small-caps 15vmin serif;
                border-top: 20px solid #d45230;
            ">
                Play Now
            </div>
            <div style="
                font: italic 5vmin serif;
            ">
                Earn as much money as you can in today's challenge.
            </div>
        </div>
    `;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/ui/Playing.ts
	function Playing(state) {
		return `
        <div style="
            margin: 3vmin 4vmin;
            font: 10vmin Impact;
        ">
            $${state.Gold.toLocaleString("en")}
        </div>
    `;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/ui/Store.ts
	function Store(state) {
		return `
        <div style="
            width: 66%;
            margin: 5vh auto;
            text-align: center;
            color: #222;
        ">
            GENERAL STORE
        </div>

        <div onclick="$(${Action.ChangePlayerSeed});" style="
            font: italic bold small-caps 7vmin serif;
            position: absolute;
            bottom: 15%;
            left: 10%;
        ">
            ${state.MonetizationEnabled ? "Change Outfit" : `
                        <s>Change Outfit</s>
                        <div style="font: italic 5vmin serif;">
                            Become a Coil subscriber!
                        </div>
                    `}
        </div>

        <div onclick="$(${Action.GoToTown});" style="
            font: italic bold small-caps 7vmin serif;
            position: absolute;
            bottom: 5%;
            right: 10%;
        ">
            Confirm
        </div>
    `;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/ui/Victory.ts
	function Victory() {
		return `
        <div style="
            width: 66%;
            margin: 5vh auto;
            text-align: center;
        ">
            WELL DONE
        </div>

        <div onclick="$(${Action.CompleteBounty});" style="
            font: italic bold small-caps 7vmin serif;
            position: absolute;
            bottom: 5%;
            right: 10%;
        ">
            Collect Bounty
        </div>
    `;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/ui/Wanted.ts
	function Wanted(state) {
		return `
        <div style="
            width: 66%;
            margin: 5vh auto;
            text-align: center;
            color: #222;
        ">
            WANTED
            <div style="font-size: 7vmin;">
                REWARD $${state.ChallengeLevel},000
            </div>
        </div>
        <div onclick="$(${Action.GoToTown});" style="
            font: italic bold small-caps 7vmin serif;
            position: absolute;
            bottom: 5%;
            right: 10%;
        ">
            Accept Quest
        </div>
    `;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/ui/App.ts
	function App(state) {
		if (state.WorldFunc == world_intro) return Intro();
		if (state.WorldFunc == world_store) return Store(state);
		if (state.WorldFunc == world_wanted) return Wanted(state);
		if (state.PlayerState == PlayerState.Victory) return Victory();
		if (state.PlayerState == PlayerState.Defeat) return Defeat(state);
		return Playing(state);
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/systems/sys_ui.ts
	var prev;
	function sys_ui(game, delta) {
		let next = App(game);
		if (next !== prev) game.UI.innerHTML = prev = next;
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/game.ts
	var _Get$Transform;
	var _Get$Render;
	var _Get$Draw;
	var _Get$Camera;
	var _Get$Light;
	var _Get$AudioSource;
	var _Get$Animate;
	var _Get$Move;
	var _Get$Collide;
	var _Get$Trigger;
	var _Get$Navigable;
	var _Get$Select;
	var _Get$Shoot;
	var _Get$PlayerControl;
	var _Get$Health;
	var _Get$Mimic;
	var _Get$EmitParticles;
	var _Get$Cull;
	var _Get$Walking;
	var _Get$NPC;
	var _Get$Projectile;
	var _Get$Shake;
	var _Get$Lifespan;
	var MAX_ENTITIES = 1e4;
	var Game = class {
		static {
			_Get$Transform = Get.Transform, _Get$Render = Get.Render, _Get$Draw = Get.Draw, _Get$Camera = Get.Camera, _Get$Light = Get.Light, _Get$AudioSource = Get.AudioSource, _Get$Animate = Get.Animate, _Get$Move = Get.Move, _Get$Collide = Get.Collide, _Get$Trigger = Get.Trigger, _Get$Navigable = Get.Navigable, _Get$Select = Get.Select, _Get$Shoot = Get.Shoot, _Get$PlayerControl = Get.PlayerControl, _Get$Health = Get.Health, _Get$Mimic = Get.Mimic, _Get$EmitParticles = Get.EmitParticles, _Get$Cull = Get.Cull, _Get$Walking = Get.Walking, _Get$NPC = Get.NPC, _Get$Projectile = Get.Projectile, _Get$Shake = Get.Shake, _Get$Lifespan = Get.Lifespan;
		}
		constructor() {
			this.Grid = [];
			this[_Get$Transform] = [];
			this[_Get$Render] = [];
			this[_Get$Draw] = [];
			this[_Get$Camera] = [];
			this[_Get$Light] = [];
			this[_Get$AudioSource] = [];
			this[_Get$Animate] = [];
			this[_Get$Move] = [];
			this[_Get$Collide] = [];
			this[_Get$Trigger] = [];
			this[_Get$Navigable] = [];
			this[_Get$Select] = [];
			this[_Get$Shoot] = [];
			this[_Get$PlayerControl] = [];
			this[_Get$Health] = [];
			this[_Get$Mimic] = [];
			this[_Get$EmitParticles] = [];
			this[_Get$Cull] = [];
			this[_Get$Walking] = [];
			this[_Get$NPC] = [];
			this[_Get$Projectile] = [];
			this[_Get$Shake] = [];
			this[_Get$Lifespan] = [];
			this.Audio = new AudioContext();
			this.UI = document.querySelector("main");
			this.Input = {
				mx: 0,
				my: 0
			};
			this.WorldFunc = world_intro;
			this.ChallengeSeed = ~~(Date.now() / 864e5);
			this.PlayerSeed = this.ChallengeSeed;
			this.ChallengeLevel = 1;
			this.BountySeed = 0;
			this.PlayerState = PlayerState.Playing;
			this.Gold = 0;
			this.MonetizationEnabled = false;
			this.Materials = [];
			this.Models = [];
			this.Palette = palette;
			this.RAF = 0;
			this.World = [];
			document.addEventListener("visibilitychange", () => document.hidden ? this.Stop() : this.Start());
			this.Canvas3 = document.querySelector("canvas");
			this.Canvas2 = document.querySelector("canvas + canvas");
			this.Canvas3.width = this.Canvas2.width = window.innerWidth;
			this.Canvas3.height = this.Canvas2.height = window.innerHeight;
			this.GL = this.Canvas3.getContext("webgl2");
			this.Context = this.Canvas2.getContext("2d");
			for (let name in this.GL) if (typeof this.GL[name] == "function") this.GL[name.match(/^..|[A-Z]|([1-9].*)/g).join("")] = this.GL[name];
			this.UI.addEventListener("contextmenu", (evt) => evt.preventDefault());
			this.UI.addEventListener("mousedown", (evt) => {
				this.Input[`d${evt.button}`] = 1;
			});
			this.UI.addEventListener("mousemove", (evt) => {
				this.Input.mx = evt.offsetX;
				this.Input.my = evt.offsetY;
			});
			this.GL.enable(GL_DEPTH_TEST);
			this.GL.enable(GL_CULL_FACE);
			this.Materials[Mat.Wireframe] = mat_wireframe(this.GL);
			this.Materials[Mat.Instanced] = mat_instanced(this.GL);
			this.Materials[Mat.Particles] = mat_particles(this.GL);
		}
		CreateEntity(mask = 0) {
			for (let i = 0; i < MAX_ENTITIES; i++) if (!this.World[i]) {
				this.World[i] = mask;
				return i;
			}
			throw new Error("No more entities available.");
		}
		Update(delta) {
			let cpu = performance.now();
			sys_lifespan(this, delta);
			sys_select(this, delta);
			sys_player_control(this, delta);
			sys_ai(this, delta);
			sys_control_projectile(this, delta);
			sys_navigate(this, delta);
			sys_aim(this, delta);
			sys_particles(this, delta);
			sys_shake(this, delta);
			sys_animate(this, delta);
			sys_move(this, delta);
			sys_transform(this, delta);
			sys_collide(this, delta);
			sys_trigger(this, delta);
			sys_shoot(this, delta);
			sys_health(this, delta);
			sys_mimic(this, delta);
			sys_cull(this, delta);
			sys_audio(this, delta);
			sys_camera(this, delta);
			sys_performance(this, performance.now() - cpu, document.querySelector("#cpu"));
			let gpu = performance.now();
			sys_render(this, delta);
			sys_draw(this, delta);
			sys_ui(this, delta);
			sys_performance(this, performance.now() - gpu, document.querySelector("#gpu"));
			sys_framerate(this, delta);
			this.Input.d0 = 0;
			this.Input.d2 = 0;
		}
		Start() {
			let last = performance.now();
			let tick = (now) => {
				let delta = (now - last) / 1e3;
				this.Update(delta);
				last = now;
				this.RAF = requestAnimationFrame(tick);
			};
			this.Stop();
			this.Audio.resume();
			tick(last);
		}
		Stop() {
			this.Audio.suspend();
			cancelAnimationFrame(this.RAF);
		}
		Add({ Translation, Rotation, Scale, Using = [], Children = [] }) {
			let entity = this.CreateEntity(Get.Transform);
			transform(Translation, Rotation, Scale)(this, entity);
			for (let mixin of Using) mixin(this, entity);
			let entity_transform = this[Get.Transform][entity];
			for (let subtree of Children) {
				let child = this.Add(subtree);
				let child_transform = this[Get.Transform][child];
				child_transform.Parent = entity_transform;
				entity_transform.Children.push(child_transform);
			}
			return entity;
		}
		Destroy(entity) {
			if (this.World[entity] & 1 << Get.Transform) for (let child of this[Get.Transform][entity].Children) this.Destroy(child.EntityId);
			this.World[entity] = 0;
		}
	};
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/model.ts
	function load(path) {
		return fetch(path).then((response) => response.arrayBuffer()).then((buffer) => {
			let buffer_array = new Uint16Array(buffer);
			let model_data = [];
			let i = 0;
			while (i < buffer_array.length) {
				let Size = [
					0,
					0,
					0
				];
				let model_start = i + 1;
				let model_end = model_start + buffer_array[i];
				let model = [];
				for (i = model_start; i < model_end; i++) {
					let voxel = buffer_array[i];
					model.push((voxel & 15) >> 0, (voxel & 240) >> 4, (voxel & 3840) >> 8, (voxel & 61440) >> 12);
				}
				for (let j = 0; j < model.length; j++) if (Size[j % 4] < model[j] + 1) Size[j % 4] = model[j] + 1;
				model_data.push(new Float32Array(model).map((val, idx) => {
					switch (idx % 4) {
						case 0: return val - Size[0] / 2 + .5;
						case 1: return val - Size[1] / 2 + .5;
						case 2: return val - Size[2] / 2 + .5;
						default: return val;
					}
				}));
			}
			return model_data;
		});
	}
	//#endregion
	//#region game-sources/upstream/expansion/backcountry/src/index.ts
	var game = new Game();
	window.$ = (...args) => dispatch(game, ...args);
	window.game = game;
	load("./models.tfu").then((models) => {
		game.Models = models;
		world_intro(game);
		game.Start();
	});
	//#endregion
})();
