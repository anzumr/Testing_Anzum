/*!
 * WAVE Digital - "Brand Ribbons" hero background (wave-bg.js)
 * ---------------------------------------------------------------------------
 * Glossy layered ribbons of water in the WAVE logo's own blues (royal blue ->
 * azure -> light cyan, separated by the logo's thin dark gap lines). On mount
 * the tide sweeps in from the bottom-left, the front ribbon curls into a
 * breaking crest and bursts into spray, and (optionally) the hero logo
 * surfaces out of the water. Afterwards the ribbons keep swelling, sheen
 * glides along them, foam laces the crests and sets of swell roll in.
 *
 * Classic script (works from file://), no dependencies, no network.
 *
 *   var bg = WaveBackground.mount(canvas, {
 *     logo:   el,      // optional - element that rises out of / bobs in the water
 *     textEl: el,      // optional - content block to protect with a soft scrim
 *     reducedMotion,   // optional - force the static frame
 *     intro: true,     // optional - play the tide-in intro
 *     interactive: true,
 *     renderer: 'auto' // 'auto' | '2d' (force the Canvas 2D fallback)
 *   });
 *   bg.splash(0.7, 0.65);   // fractions of the canvas size
 *   bg.destroy();
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var TAU = Math.PI * 2;
  var noop = function () {};

  /* ------------------------------------------------------------------ utils */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function eOut(t) { t = clamp(t, 0, 1); var u = 1 - t; return 1 - u * u * u; }
  function eInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function hex(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  function mix3(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function rgba(c, a) {
    return 'rgba(' + Math.round(clamp(c[0], 0, 1) * 255) + ',' + Math.round(clamp(c[1], 0, 1) * 255) + ',' +
      Math.round(clamp(c[2], 0, 1) * 255) + ',' + (+a).toFixed(3) + ')';
  }
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // Monotone cubic (Fritsch-Carlson) through control points - smooth, no overshoot.
  function monotone(xs, ys) {
    var n = xs.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var q = 3 / Math.sqrt(s); m[i] = q * a * d[i]; m[i + 1] = q * b * d[i]; }
    }
    return function (x) {
      if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
      if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
      var k = 0;
      while (k < n - 2 && x > xs[k + 1]) k++;
      var h = xs[k + 1] - xs[k], t = (x - xs[k]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * h * m[k] +
        (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * h * m[k + 1];
    };
  }

  /* ---------------------------------------------------------------- palette */
  // Taken from the WAVE logo (royal #0a3d9e/#0b5fd6, azure #12a8ec, cyan #7fdcf8/#b8ecfa)
  // and the site (bg #030d19, hero backdrop #19506a/#06243a/#020b15).
  var C = {
    topF: hex('#86defa'), topB: hex('#3f93bb'),
    midF: hex('#12a3ea'), midB: hex('#17679c'),
    deepF: hex('#0a3c9e'), deepB: hex('#0c3564'),
    abyss: hex('#03112c'),
    gap: hex('#030f22'),
    fog: hex('#0a2c46'),
    foam: hex('#effcff'),
    spray: hex('#dff8ff'),
    sprayB: hex('#8fdcf7'),
    bg: hex('#030d19')
  };

  /* ================================================================ WebGL */
  var GLSL_NOISE = [
    'float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }',
    'float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }'
  ].join('\n');

  var VS_FULL = 'attribute vec2 aP; void main(){ gl_Position = vec4(aP, 0.0, 1.0); }';

  var FS_SKY = [
    'uniform vec2 uRes; uniform vec2 uView; uniform vec4 uHalo; uniform float uT;',
    GLSL_NOISE,
    'void main(){',
    '  vec2 p = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y) * (uRes / uView);',
    // the original hero backdrop: radial-gradient(ellipse at 60% 30%, #19506a 0, #06243a 42%, #020b15 82%)
    '  vec2 c = vec2(0.60, 0.30) * uRes;',
    '  float t = length((p - c) / (uRes * vec2(0.849, 0.990)));',
    '  vec3 c0 = vec3(0.098, 0.314, 0.416); vec3 c1 = vec3(0.024, 0.141, 0.227); vec3 c2 = vec3(0.008, 0.043, 0.082);',
    '  vec3 col = t < 0.42 ? mix(c0, c1, t / 0.42) : mix(c1, c2, clamp((t - 0.42) / 0.40, 0.0, 1.0));',
    // slow moving sea haze so the sky is never a dead gradient
    '  float n = vn(p * 0.0021 + vec2(uT * 0.018, -uT * 0.007)) * 0.6 + vn(p * 0.0057 - vec2(uT * 0.025, 0.0)) * 0.4;',
    '  col *= 0.94 + 0.12 * n;',
    // moonlit halo behind the logo
    '  vec2 hd = (p - uHalo.xy) / uHalo.z; float hr = dot(hd, hd);',
    '  col += vec3(0.07, 0.34, 0.50) * exp(-hr * 1.5) * uHalo.w;',
    '  col += vec3(0.16, 0.50, 0.68) * exp(-hr * 5.5) * uHalo.w * 0.45;',
    '  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var VS_WATER = [
    'attribute vec2 aPos; attribute vec4 aA; attribute vec4 aB;',
    'uniform vec2 uRes; uniform vec4 uTop[8]; uniform vec4 uMid[8]; uniform vec4 uDeep[8]; uniform vec4 uPar[8]; uniform vec4 uLight;',
    'varying vec4 v0; varying vec4 v1; varying vec4 v2; varying vec4 v3; varying vec4 v4; varying vec4 v5; varying vec2 vP;',
    'void main(){',
    '  int b = int(aB.z + 0.5);',
    '  vP = aPos;',
    '  vec4 par = uPar[b];',
    '  v0 = aA;',
    '  v1 = vec4(aB.x, aB.y, par.x, par.y);',
    '  v2 = uTop[b]; v3 = uMid[b]; v4 = uDeep[b];',
    '  vec2 dl = (aPos - uLight.xy) / uLight.z;',
    '  v5 = vec4(exp(-dot(dl, dl)) * uLight.w, par.z, par.w, aB.w);',
    '  gl_Position = vec4(aPos / uRes * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);',
    '}'
  ].join('\n');

  var FS_WATER = [
    'varying vec4 v0; varying vec4 v1; varying vec4 v2; varying vec4 v3; varying vec4 v4; varying vec4 v5; varying vec2 vP;',
    'uniform vec4 uPtr;',
    'uniform float uT; uniform float uFw; uniform vec3 uGap; uniform vec3 uFog; uniform vec3 uAbyss; uniform vec3 uFoam; uniform vec4 uGlit;',
    GLSL_NOISE,
    'void main(){',
    '  float d = v0.x; float room = v0.y; float g = v0.z; float u = v0.w;',
    '  float fw = uFw; float depth = v4.a;',
    '  float a = smoothstep(-g - fw, -g + fw * 0.35, d);',          // outer edge of the dark gap line
    '  float dd = max(d, 0.0);',
    '  float rc = clamp(room, 26.0, 96.0 + 24.0 * depth);',
    '  float v = dd / rc;',
    // logo-style band gradient: light cyan rim -> azure -> royal -> deep
    '  vec3 col = mix(v2.rgb, v3.rgb, smoothstep(0.0, 0.2, v) * 0.6 + smoothstep(0.0, 9.0, dd) * 0.4);',
    '  col = mix(col, v4.rgb, smoothstep(0.18, 0.86, v));',
    '  col = mix(col, uAbyss, smoothstep(0.62, 2.1, v));',
    // slow, large-scale light variation inside the water body (never a flat fill)
    '  float cz = vn(vec2(u * 0.011 + uT * 0.07, dd * 0.028 - uT * 0.045 + v5.y));',
    '  col *= 0.9 + 0.2 * cz * smoothstep(14.0, 70.0, dd);',
    // moonlit glitter path on the water under the logo: broken horizontal dashes that shimmer
    '  float gx = (u - uGlit.x) / uGlit.z;',
    '  float gm = exp(-gx * gx) * smoothstep(0.55, 1.0, depth) * smoothstep(8.0, 26.0, dd) * (1.0 - smoothstep(50.0, 230.0, dd));',
    '  if (gm > 0.004) {',
    '    float g1 = vn(vec2(u * 0.05 + uT * 0.3, dd * 0.34 - uT * 1.1));',
    '    float g2 = vn(vec2(u * 0.13 - uT * 0.5, dd * 0.8 + uT * 0.7));',
    '    float gl = smoothstep(0.66, 0.9, g1 * 0.7 + g2 * 0.3);',
    '    col += vec3(0.62, 0.9, 1.0) * gl * gm * uGlit.w;',
    '  }',
    // gloss: segmented specular streak just under the crest + broad sheen, both gliding with the flow
    '  float fl = uT * v5.z;',
    '  float n1 = vn(vec2((u - fl) * 0.0042, v5.y));',
    '  float n2 = vn(vec2((u - fl * 1.35) * 0.0115, v5.y + 3.7));',
    '  float seg = smoothstep(0.40, 0.78, n1 * 0.68 + n2 * 0.32);',
    '  float lit = v1.y;',
    '  float sc = 3.0 + 2.6 * depth; float sw = 1.1 + 0.9 * depth;',
    '  float spec = exp(-pow((dd - sc) / sw, 2.0)) * seg * v2.a * (0.30 + 0.85 * lit);',
    '  float sheen = exp(-dd / 15.0) * (0.10 + 0.30 * seg) * (0.4 + 0.6 * lit) * v2.a;',
    '  col += vec3(0.55, 0.88, 1.0) * sheen * 0.42;',
    // soft inner flow line, like the thin highlight curves inside the logo bands
    '  float il = exp(-pow((v - 0.46 - 0.05 * sin(u * 0.006 + uT * 0.4 + v5.y)) / 0.022, 2.0));',
    '  col += vec3(0.45, 0.80, 1.0) * il * 0.07 * v2.a * smoothstep(40.0, 120.0, room);',
    // light from the logo halo catching nearby crests
    '  col += vec3(0.30, 0.72, 0.95) * v5.x * exp(-dd / 34.0) * 0.40;',
    '  col = mix(col, vec3(0.94, 0.99, 1.0), clamp(spec, 0.0, 1.0) * 0.92);',
    // the pointer's touch: crests near the cursor catch a soft light
    '  vec2 pd = (vP - uPtr.xy) / uPtr.z;',
    '  float pl = exp(-dot(pd, pd)) * uPtr.w;',
    '  col += vec3(0.30, 0.72, 1.0) * pl * (0.55 * exp(-dd / 10.0) + 0.10 * exp(-dd / 60.0));',
    // foam lace on disturbed / breaking crests
    '  float foam = v1.x;',
    '  if (foam > 0.01) {',
    '    float fz = 2.5 + 15.0 * foam;',
    '    float fn = vn(vec2(u * 0.17 + uT * 0.5, dd * 0.36 - uT * 0.4)) * 0.55 + vn(vec2(u * 0.45 - uT * 0.9, dd * 0.95 + 11.0)) * 0.45;',
    '    float fm = smoothstep(0.58 - 0.22 * foam, 0.9 - 0.2 * foam, fn) * (1.0 - smoothstep(fz * 0.2, fz, dd)) * clamp(foam * 1.3, 0.0, 1.0);',
    '    fm = max(fm, exp(-dd / 2.2) * clamp(foam, 0.0, 1.0) * 0.7);',
    '    col = mix(col, uFoam, clamp(fm, 0.0, 1.0) * 0.82);',
    '  }',
    '  col = mix(col, uFog, v1.z);',
    '  col *= v1.w;',
    '  col = mix(uGap, col, smoothstep(-fw * 0.55, fw * 0.55, d));',  // crisp gap line / crest edge
    '  a *= 1.0 - v3.a * smoothstep(room - fw * 1.5, room, d);',      // lip inner edge
    '  a *= v5.w;',
    '  col += (h21(gl_FragCoord.xy) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  var VS_FX = [
    'attribute vec2 aPos; attribute vec4 aLoc; attribute vec4 aCol;',
    'uniform vec2 uRes; varying vec4 vLoc; varying vec4 vCol;',
    'void main(){ vLoc = aLoc; vCol = aCol; gl_Position = vec4(aPos / uRes * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0); }'
  ].join('\n');

  var FS_FX = [
    'varying vec4 vLoc; varying vec4 vCol;',
    'void main(){',
    '  vec2 q = vLoc.xy; float k = vLoc.w; float a = 0.0;',
    '  if (k < 0.5) {',                                    // droplet: soft capsule stretched along velocity
    '    float hl = max(vLoc.z, 1.0);',
    '    float x = max(abs(q.x) * hl - (hl - 1.0), 0.0);',
    '    float r = length(vec2(x, q.y));',
    '    a = (1.0 - smoothstep(0.30, 1.0, r)) * (0.65 + 0.35 * smoothstep(-1.0, 1.0, q.x));',
    '  } else if (k < 1.5) {',                             // mist / glow
    '    float r2 = dot(q, q); a = exp(-r2 * 3.2) * (1.0 - smoothstep(0.7, 1.0, sqrt(r2)));',
    '  } else if (k < 2.5) {',                             // ripple ring (quad is already squashed to an ellipse)
    '    float r = length(q); float th = max(vLoc.z, 0.01);',
    '    a = exp(-pow((r - 0.84) / th, 2.0)) + 0.35 * exp(-pow((r - 0.64) / (th * 1.5), 2.0));',
    '    a *= 1.0 - smoothstep(0.96, 1.0, r);',
    '  } else {',                                          // sparkle glint
    '    float r = length(q);',
    '    float s1 = exp(-abs(q.x) * 15.0) * exp(-abs(q.y) * 2.4);',
    '    float s2 = exp(-abs(q.y) * 15.0) * exp(-abs(q.x) * 2.4);',
    '    a = (max(s1, s2) * 0.8 + exp(-r * r * 30.0)) * (1.0 - smoothstep(0.75, 1.0, r));',
    '  }',
    '  a *= vCol.a;',
    '  gl_FragColor = vec4(vCol.rgb * a, 0.0);',          // additive light
    '}'
  ].join('\n');

  var FS_SCRIM = [
    'uniform vec2 uRes; uniform vec2 uView; uniform vec4 uRect; uniform vec4 uS;',
    'void main(){',
    '  vec2 p = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y) * (uRes / uView);',
    '  vec2 c = (uRect.xy + uRect.zw) * 0.5; vec2 hs = (uRect.zw - uRect.xy) * 0.5;',
    '  vec2 q = abs(p - c) - hs + 48.0;',
    '  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 48.0;',
    '  float a = uS.x * (1.0 - smoothstep(-70.0, 190.0, sd));',
    '  float l = uS.y * (1.0 - smoothstep(0.0, uS.w, p.x));',
    '  float bt = uS.z * smoothstep(uRes.y - 96.0, uRes.y, p.y);',
    '  float A = 1.0 - (1.0 - a) * (1.0 - l) * (1.0 - bt);',
    '  gl_FragColor = vec4(vec3(0.012, 0.051, 0.098) * A, A);',
    '}'
  ].join('\n');

  function createGLRenderer(canvas) {
    var gl = null;
    var attrs = { alpha: false, antialias: true, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false };
    try { gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); } catch (e) { gl = null; }
    if (!gl) return null;

    var prec = 'mediump';
    try {
      var hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      if (hp && hp.precision > 0) prec = 'highp';
    } catch (e) { /* keep mediump */ }

    var R = { kind: 'gl', gl: gl, ok: false };
    var P = {}, buf = {}, maxAttr = 0;
    var wv = null, fxv = null, fxQuadsMax = 0;

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        var log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('shader ' + log);
      }
      return s;
    }
    function prog(vs, fs, attribs) {
      var p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, 'precision ' + prec + ' float;\n' + vs));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, 'precision ' + prec + ' float;\n' + fs));
      for (var i = 0; i < attribs.length; i++) gl.bindAttribLocation(p, i, attribs[i]);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error('link ' + gl.getProgramInfoLog(p));
      var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
      for (var j = 0; j < n; j++) {
        var info = gl.getActiveUniform(p, j);
        if (info) u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
      }
      return { p: p, u: u, n: attribs.length };
    }
    function use(pr) {
      gl.useProgram(pr.p);
      for (var i = 0; i < Math.max(maxAttr, pr.n); i++) {
        if (i < pr.n) gl.enableVertexAttribArray(i); else gl.disableVertexAttribArray(i);
      }
      maxAttr = pr.n;
    }

    function init() {
      maxAttr = 0;
      P.sky = prog(VS_FULL, FS_SKY, ['aP']);
      P.scrim = prog(VS_FULL, FS_SCRIM, ['aP']);
      P.water = prog(VS_WATER, FS_WATER, ['aPos', 'aA', 'aB']);
      P.fx = prog(VS_FX, FS_FX, ['aPos', 'aLoc', 'aCol']);
      buf.tri = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.tri);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      buf.wv = gl.createBuffer(); buf.wi = gl.createBuffer();
      buf.fv = gl.createBuffer(); buf.fi = gl.createBuffer();
      buf.wiCount = 0; buf.layoutKey = '';
      // static quad index buffer for fx
      fxQuadsMax = 1100;
      var qi = new Uint16Array(fxQuadsMax * 6);
      for (var q = 0; q < fxQuadsMax; q++) {
        var o = q * 4, k = q * 6;
        qi[k] = o; qi[k + 1] = o + 1; qi[k + 2] = o + 2; qi[k + 3] = o + 2; qi[k + 4] = o + 1; qi[k + 5] = o + 3;
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.fi);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, qi, gl.STATIC_DRAW);
      fxv = new Float32Array(fxQuadsMax * 4 * 10);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.fv);
      gl.bufferData(gl.ARRAY_BUFFER, fxv.byteLength, gl.DYNAMIC_DRAW);
      R.ok = true;
    }

    // index buffer for N bands x S samples (+ lip of LS samples), 3 verts per sample
    function ensureIndices(N, S, LS) {
      var key = N + ':' + S + ':' + LS;
      if (buf.layoutKey === key) return;
      buf.layoutKey = key;
      var bandIdx = N * (S - 1) * 12, lipIdx = (LS - 1) * 12;
      var idx = new Uint16Array(bandIdx + lipIdx), p = 0;
      function strip(base, count) {
        for (var j = 0; j < count - 1; j++) {
          var a0 = base + j * 3, a1 = a0 + 3;
          idx[p++] = a0; idx[p++] = a0 + 1; idx[p++] = a1;
          idx[p++] = a1; idx[p++] = a0 + 1; idx[p++] = a1 + 1;
          idx[p++] = a0 + 1; idx[p++] = a0 + 2; idx[p++] = a1 + 1;
          idx[p++] = a1 + 1; idx[p++] = a0 + 2; idx[p++] = a1 + 2;
        }
      }
      for (var b = 0; b < N; b++) strip(b * S * 3, S);
      strip(N * S * 3, LS);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.wi);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      buf.bandIdx = bandIdx; buf.lipIdx = lipIdx;
      wv = new Float32Array((N * S + LS) * 3 * 10);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.wv);
      gl.bufferData(gl.ARRAY_BUFFER, wv.byteLength, gl.DYNAMIC_DRAW);
    }

    var fxn = 0;
    function quad(cx, cy, ax, ay, bx, by, kind, param, col, alpha) {
      if (fxn >= fxQuadsMax) return;
      var o = fxn * 40, r = col[0], g = col[1], b = col[2];
      // corners (-1,-1) (1,-1) (-1,1) (1,1)
      var cs = [-1, -1, 1, -1, -1, 1, 1, 1];
      for (var c = 0; c < 4; c++) {
        var lx = cs[c * 2], ly = cs[c * 2 + 1], i = o + c * 10;
        fxv[i] = cx + ax * lx + bx * ly; fxv[i + 1] = cy + ay * lx + by * ly;
        fxv[i + 2] = lx; fxv[i + 3] = ly; fxv[i + 4] = param; fxv[i + 5] = kind;
        fxv[i + 6] = r; fxv[i + 7] = g; fxv[i + 8] = b; fxv[i + 9] = alpha;
      }
      fxn++;
    }

    R.draw = function (sc) {
      if (!R.ok || gl.isContextLost()) return;
      var N = sc.N, S = sc.S, LS = sc.LS, j, b;
      ensureIndices(N, S, LS);
      gl.viewport(0, 0, sc.pw, sc.ph);

      /* sky */
      gl.disable(gl.BLEND);
      use(P.sky);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.tri);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(P.sky.u.uRes, sc.W, sc.H);
      gl.uniform2f(P.sky.u.uView, sc.pw, sc.ph);
      gl.uniform4f(P.sky.u.uHalo, sc.halo[0], sc.halo[1], sc.halo[2], sc.halo[3]);
      gl.uniform1f(P.sky.u.uT, sc.t % 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      /* water ribbons (one draw call, back to front, lip last) */
      var p = 0, xs = sc.xs, fwp = sc.fw;
      for (b = 0; b < N; b++) {
        var B = sc.bands[b], y = B.y, minF = B.minF, gpx = B.gap, al = B.alpha;
        for (j = 0; j < S; j++) {
          var x = xs[j], yy = y[j];
          var jl = j > 0 ? j - 1 : j, jr = j < S - 1 ? j + 1 : j;
          var tx = xs[jr] - xs[jl], ty = y[jr] - y[jl], tl = Math.sqrt(tx * tx + ty * ty) || 1;
          var nx = ty / tl, ny = -tx / tl;                    // outward (up) normal
          var room = minF[j] - yy, gg = gpx + fwp;
          var bot = Math.max(yy + 2, minF[j] + 8);
          var fo = B.foam[j], li = B.lit[j];
          // gap top
          wv[p++] = x + nx * gg; wv[p++] = yy + ny * gg; wv[p++] = -gg; wv[p++] = room; wv[p++] = gpx; wv[p++] = x;
          wv[p++] = fo; wv[p++] = li; wv[p++] = b; wv[p++] = al;
          // crest
          wv[p++] = x; wv[p++] = yy; wv[p++] = 0; wv[p++] = room; wv[p++] = gpx; wv[p++] = x;
          wv[p++] = fo; wv[p++] = li; wv[p++] = b; wv[p++] = al;
          // body bottom
          wv[p++] = x; wv[p++] = bot; wv[p++] = bot - yy; wv[p++] = room; wv[p++] = gpx; wv[p++] = x;
          wv[p++] = fo; wv[p++] = li; wv[p++] = b; wv[p++] = al;
        }
      }
      var lip = sc.lip, count = buf.bandIdx;
      if (lip && lip.active) {
        for (j = 0; j < LS; j++) {
          var lx = lip.x[j], ly = lip.y[j], lnx = lip.nx[j], lny = lip.ny[j], w = lip.w[j], lg = lip.g + fwp;
          wv[p++] = lx - lnx * lg; wv[p++] = ly - lny * lg; wv[p++] = -lg; wv[p++] = w; wv[p++] = lip.g; wv[p++] = lip.u[j];
          wv[p++] = lip.foam[j]; wv[p++] = 0.85; wv[p++] = N; wv[p++] = lip.alpha;
          wv[p++] = lx; wv[p++] = ly; wv[p++] = 0; wv[p++] = w; wv[p++] = lip.g; wv[p++] = lip.u[j];
          wv[p++] = lip.foam[j]; wv[p++] = 0.85; wv[p++] = N; wv[p++] = lip.alpha;
          wv[p++] = lx + lnx * w; wv[p++] = ly + lny * w; wv[p++] = w; wv[p++] = w; wv[p++] = lip.g; wv[p++] = lip.u[j];
          wv[p++] = lip.foam[j]; wv[p++] = 0.85; wv[p++] = N; wv[p++] = lip.alpha;
        }
        count += buf.lipIdx;
      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      use(P.water);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.wv);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, wv.subarray(0, p));
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 40, 0);
      gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 8);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
      var u = P.water.u;
      gl.uniform2f(u.uRes, sc.W, sc.H);
      gl.uniform4fv(u.uTop, sc.pal.top);
      gl.uniform4fv(u.uMid, sc.pal.mid);
      gl.uniform4fv(u.uDeep, sc.pal.deep);
      gl.uniform4fv(u.uPar, sc.pal.par);
      gl.uniform4f(u.uLight, sc.light[0], sc.light[1], sc.light[2], sc.light[3]);
      gl.uniform1f(u.uT, sc.t % 1000);
      gl.uniform1f(u.uFw, fwp);
      gl.uniform3fv(u.uGap, C.gap);
      gl.uniform3fv(u.uFog, C.fog);
      gl.uniform3fv(u.uAbyss, C.abyss);
      gl.uniform3fv(u.uFoam, C.foam);
      gl.uniform4f(u.uGlit, sc.glit[0], sc.glit[1], sc.glit[2], sc.glit[3]);
      gl.uniform4f(u.uPtr, sc.ptr[0], sc.ptr[1], sc.ptr[2], sc.ptr[3]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.wi);
      gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);

      /* light: spray, mist, rings, glints (additive) */
      fxn = 0;
      var i, q;
      for (i = 0; i < sc.mists.length; i++) {
        q = sc.mists[i];
        quad(q.x, q.y, q.r, 0, 0, q.r * q.sq, 1, 0, q.col, q.a);
      }
      for (i = 0; i < sc.rings.length; i++) {
        q = sc.rings[i];
        quad(q.x, q.y, q.r, 0, 0, q.r * q.asp, 2, q.th, q.col, q.a);
      }
      for (i = 0; i < sc.drops.length; i++) {
        q = sc.drops[i];
        var sp = Math.sqrt(q.vx * q.vx + q.vy * q.vy) || 1;
        var len = q.s * (1 + Math.min(2.4, sp / 260));
        var dxn = q.vx / sp, dyn = q.vy / sp;
        quad(q.x, q.y, dxn * len, dyn * len, -dyn * q.s, dxn * q.s, 0, len / q.s, q.col, q.a);
      }
      for (i = 0; i < sc.sparks.length; i++) {
        q = sc.sparks[i];
        quad(q.x, q.y, q.r, 0, 0, q.r, 3, 0, q.col, q.a);
      }
      if (fxn > 0) {
        gl.blendFunc(gl.ONE, gl.ONE);
        use(P.fx);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.fv);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, fxv.subarray(0, fxn * 40));
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 40, 0);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 40, 8);
        gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
        gl.uniform2f(P.fx.u.uRes, sc.W, sc.H);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.fi);
        gl.drawElements(gl.TRIANGLES, fxn * 6, gl.UNSIGNED_SHORT, 0);
      }

      /* readability scrim + bottom fade into the next section */
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      use(P.scrim);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.tri);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(P.scrim.u.uRes, sc.W, sc.H);
      gl.uniform2f(P.scrim.u.uView, sc.pw, sc.ph);
      gl.uniform4f(P.scrim.u.uRect, sc.scrim[0], sc.scrim[1], sc.scrim[2], sc.scrim[3]);
      gl.uniform4f(P.scrim.u.uS, sc.scrim[4], sc.scrim[5], sc.scrim[6], sc.scrim[7]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    R.restore = function () { buf = {}; P = {}; init(); };
    R.dispose = function () {
      try {
        if (gl.isContextLost()) return;
        ['sky', 'scrim', 'water', 'fx'].forEach(function (k) { if (P[k]) gl.deleteProgram(P[k].p); });
        ['tri', 'wv', 'wi', 'fv', 'fi'].forEach(function (k) { if (buf[k]) gl.deleteBuffer(buf[k]); });
      } catch (e) { /* ignore */ }
    };

    try { init(); } catch (e) { R.ok = false; R.failed = true; }
    return R;
  }

  /* ========================================================= Canvas 2D fallback */
  function create2DRenderer(canvas) {
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return null;
    var R = { kind: '2d', ok: true };
    R.draw = function (sc) {
      var W = sc.W, H = sc.H, xs = sc.xs, S = sc.S, b, j;
      ctx.setTransform(sc.pw / W, 0, 0, sc.ph / H, 0, 0);
      // sky (original backdrop)
      ctx.fillStyle = '#020b15'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W * 0.6, H * 0.3); ctx.scale(W * 0.849, H * 0.99);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.82);
      g.addColorStop(0, '#19506a'); g.addColorStop(0.512, '#06243a'); g.addColorStop(1, '#020b15');
      ctx.fillStyle = g; ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
      if (sc.halo[3] > 0.01) {
        var hg = ctx.createRadialGradient(sc.halo[0], sc.halo[1], 0, sc.halo[0], sc.halo[1], sc.halo[2] * 1.3);
        hg.addColorStop(0, rgba([0.2, 0.62, 0.8], 0.32 * sc.halo[3])); hg.addColorStop(1, 'rgba(20,80,110,0)');
        ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
      }
      // ribbons: deep body fill + rim strokes that follow each crest (no per-pixel shading in 2D)
      var crest = function (y, off) {
        ctx.beginPath(); ctx.moveTo(xs[0], y[0] + off);
        for (var jj = 1; jj < S; jj++) ctx.lineTo(xs[jj], y[jj] + off);
      };
      for (b = 0; b < sc.N; b++) {
        var B = sc.bands[b], y = B.y, minF = B.minF, P = sc.pal, o = b * 4;
        var top = [P.top[o], P.top[o + 1], P.top[o + 2]], mid = [P.mid[o], P.mid[o + 1], P.mid[o + 2]], deep = [P.deep[o], P.deep[o + 1], P.deep[o + 2]];
        var fog = P.par[o], br = P.par[o + 1], dep = P.deep[o + 3];
        var tint = function (c) { var m = mix3(c, C.fog, fog); return [m[0] * br, m[1] * br, m[2] * br]; };
        var ysum = 0; for (j = 0; j < S; j++) ysum += y[j];
        var yavg = ysum / S;
        var lg = ctx.createLinearGradient(0, yavg - 40, 0, yavg + 120 + 140 * dep);
        lg.addColorStop(0, rgba(tint(deep), 1)); lg.addColorStop(1, rgba(tint(C.abyss), 1));
        ctx.beginPath(); ctx.moveTo(xs[0], y[0]);
        for (j = 1; j < S; j++) ctx.lineTo(xs[j], y[j]);
        for (j = S - 1; j >= 0; j--) ctx.lineTo(xs[j], Math.max(y[j] + 2, minF[j] + 8));
        ctx.closePath(); ctx.fillStyle = lg; ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.lineJoin = 'round';
        crest(y, 0); ctx.lineWidth = 2 * (26 + 20 * dep); ctx.strokeStyle = rgba(tint(mid), 0.55); ctx.stroke();
        crest(y, 0); ctx.lineWidth = 2 * (9 + 6 * dep); ctx.strokeStyle = rgba(tint(top), 0.6); ctx.stroke();
        crest(y, 3 + 2 * dep); ctx.lineWidth = 1.3 + dep; ctx.strokeStyle = rgba([0.92, 0.99, 1], 0.5 * P.top[o + 3] * (1 - fog)); ctx.stroke();
        ctx.restore();
        crest(y, -B.gap * 0.5);
        ctx.lineWidth = B.gap; ctx.strokeStyle = rgba(C.gap, 1); ctx.stroke();
      }
      var lip = sc.lip;
      if (lip && lip.active && lip.alpha > 0.02) {
        ctx.globalAlpha = lip.alpha;
        ctx.beginPath(); ctx.moveTo(lip.x[0], lip.y[0]);
        for (j = 1; j < sc.LS; j++) ctx.lineTo(lip.x[j], lip.y[j]);
        for (j = sc.LS - 1; j >= 0; j--) ctx.lineTo(lip.x[j] + lip.nx[j] * lip.w[j], lip.y[j] + lip.ny[j] * lip.w[j]);
        ctx.closePath(); ctx.fillStyle = '#1690e2'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(200,242,253,0.9)'; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // light
      ctx.globalCompositeOperation = 'lighter';
      var i, q;
      for (i = 0; i < sc.mists.length; i++) {
        q = sc.mists[i];
        var mg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * 0.7);
        mg.addColorStop(0, rgba(q.col, q.a * 0.6)); mg.addColorStop(1, rgba(q.col, 0));
        ctx.fillStyle = mg; ctx.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      }
      ctx.lineCap = 'round';
      for (i = 0; i < sc.drops.length; i++) {
        q = sc.drops[i];
        ctx.strokeStyle = rgba(q.col, q.a); ctx.lineWidth = q.s * 1.3;
        ctx.beginPath(); ctx.moveTo(q.x - q.vx * 0.014, q.y - q.vy * 0.014); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      for (i = 0; i < sc.rings.length; i++) {
        q = sc.rings[i];
        ctx.strokeStyle = rgba(q.col, q.a * 0.7); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, q.r * 0.84, q.r * q.asp * 0.84, 0, 0, TAU); ctx.stroke();
      }
      for (i = 0; i < sc.sparks.length; i++) {
        q = sc.sparks[i];
        ctx.fillStyle = rgba(q.col, q.a * 0.8);
        ctx.beginPath(); ctx.arc(q.x, q.y, 1.2, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // scrim
      var s = sc.scrim;
      var lgr = ctx.createLinearGradient(0, 0, s[7], 0);
      lgr.addColorStop(0, 'rgba(3,13,25,' + s[5] + ')'); lgr.addColorStop(1, 'rgba(3,13,25,0)');
      ctx.fillStyle = lgr; ctx.fillRect(0, 0, W, H);
      var cx = (s[0] + s[2]) / 2, cy = (s[1] + s[3]) / 2, rr = Math.max(s[2] - s[0], s[3] - s[1]) * 0.75;
      var rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, 'rgba(3,13,25,' + s[4] + ')'); rg.addColorStop(1, 'rgba(3,13,25,0)');
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      var bg = ctx.createLinearGradient(0, H - 96, 0, H);
      bg.addColorStop(0, 'rgba(3,13,25,0)'); bg.addColorStop(1, 'rgba(3,13,25,' + s[6] + ')');
      ctx.fillStyle = bg; ctx.fillRect(0, H - 96, W, 96);
    };
    R.dispose = noop;
    return R;
  }

  /* ================================================================== mount */
  function mount(canvas, opts) {
    var stub = { destroy: noop, splash: noop };
    if (!canvas || typeof canvas.getContext !== 'function') return stub;
    try { return mountImpl(canvas, opts || {}); } catch (e) { return stub; }
  }

  function mountImpl(canvas, opts) {
    var host = canvas.parentElement || canvas;
    var logo = opts.logo && opts.logo.style ? opts.logo : null;
    var textEl = opts.textEl && opts.textEl.getBoundingClientRect ? opts.textEl : null;
    var interactive = opts.interactive !== false;
    var mq = null;
    try { mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (e) { mq = null; }
    var reduced = !!opts.reducedMotion || !!(mq && mq.matches);

    var disposers = [];
    var destroyed = false;
    function on(target, type, fn, o) {
      target.addEventListener(type, fn, o);
      disposers.push(function () { target.removeEventListener(type, fn, o); });
    }

    /* ---- renderer ---- */
    var R = null;
    if (opts.renderer !== '2d') R = createGLRenderer(canvas);
    if (!R) R = create2DRenderer(canvas);
    if (!R || R.failed) {
      // WebGL context exists but could not be initialised: hide the canvas, keep the CSS backdrop.
      canvas.style.visibility = 'hidden';
      return { destroy: function () { canvas.style.visibility = ''; }, splash: noop };
    }

    /* ---- state ---- */
    var W = 0, H = 0, dpr = 1, dprScale = 1, pw = 0, ph = 0;
    var mobile = false, s = 1;
    var N = 7, S = 0, M = 0, LS = 48, sx = 6, dx = 12, pad = 44;
    var xs = null, bands = [];
    var lcx = 0, yb = 0, lw = 300, xBreak = 0;
    var logoR = null, textR = null, textLines = [];
    var t = 0;                                    // animation clock (s) - only advances while running
    var introT = (reduced || opts.intro === false) ? 99 : 0;
    var INTRO_END = 3.4;
    var surge = null, nextSet = 99;
    var drops = [], mists = [], rings = [], sparks = [];
    var pal = null;
    var lip = { active: false, alpha: 1, g: 2.5, x: new Float32Array(LS), y: new Float32Array(LS), nx: new Float32Array(LS), ny: new Float32Array(LS), w: new Float32Array(LS), u: new Float32Array(LS), foam: new Float32Array(LS) };
    var ptr = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, vx: 0, vy: 0, inside: false, str: 0, lastMove: 0, rawT: 0, prevSide: [] };
    var raf = 0, lastTs = 0, visible = true, dirty = true;
    var perf = { acc: 0, n: 0 };
    var logoSaved = logo ? {
      opacity: logo.style.opacity, transform: logo.style.transform, clipPath: logo.style.clipPath,
      webkitClipPath: logo.style.webkitClipPath, willChange: logo.style.willChange
    } : null;
    var animIntro = introT < INTRO_END;
    // the canvas must never eat clicks meant for the hero's buttons
    var savedPE = canvas.style.pointerEvents;
    canvas.style.pointerEvents = 'none';
    disposers.push(function () { canvas.style.pointerEvents = savedPE; });
    if (logo && animIntro) { logo.style.opacity = '0'; }
    if (logo) logo.style.willChange = 'transform, clip-path';

    var scene = {
      W: 0, H: 0, pw: 0, ph: 0, t: 0, N: 0, S: 0, LS: LS, xs: null, bands: null, lip: lip,
      drops: drops, mists: mists, rings: rings, sparks: sparks, pal: null,
      halo: [0, 0, 1, 0], light: [0, 0, 1, 0], glit: [0, 0, 1, 0], ptr: [0, 0, 1, 0], scrim: [0, 0, 0, 0, 0, 0, 0, 1], fw: 1
    };

    /* ---- measurement / layout ---- */
    function relRect(el) {
      var cr = canvas.getBoundingClientRect();
      var r = el.getBoundingClientRect();
      return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height };
    }
    function measure() {
      var cr = canvas.getBoundingClientRect();
      W = Math.max(1, cr.width); H = Math.max(1, cr.height);
      logoR = null; textR = null;
      if (logo) {
        var prevT = logo.style.transform;
        logo.style.transform = 'none';
        var lr = relRect(logo);
        logo.style.transform = prevT;
        if (lr.w > 4 && lr.h > 4) logoR = lr;
      }
      textLines = [];
      if (textEl) {
        // tight line boxes of the real text + buttons (not the full-width block)
        try {
          var walker = document.createTreeWalker(textEl, 4 /* SHOW_TEXT */, null), range = document.createRange(), node, i, rs;
          var add = function (q) {
            if (q.width > 0.5 && q.height > 0.5) textLines.push({ x0: q.left - cr.left, y0: q.top - cr.top, x1: q.right - cr.left, y1: q.bottom - cr.top });
          };
          while ((node = walker.nextNode())) {
            if (!node.nodeValue || !/\S/.test(node.nodeValue)) continue;
            range.selectNodeContents(node);
            rs = range.getClientRects();
            for (i = 0; i < rs.length; i++) add(rs[i]);
          }
          var els = textEl.querySelectorAll('a,button');
          for (i = 0; i < els.length; i++) add(els[i].getBoundingClientRect());
        } catch (e) { textLines = []; }
        if (textLines.length) {
          var u = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
          for (var q = 0; q < textLines.length; q++) {
            var tl = textLines[q];
            u.x0 = Math.min(u.x0, tl.x0); u.y0 = Math.min(u.y0, tl.y0); u.x1 = Math.max(u.x1, tl.x1); u.y1 = Math.max(u.y1, tl.y1);
          }
          textR = { x: u.x0, y: u.y0, w: u.x1 - u.x0, h: u.y1 - u.y0 };
        } else {
          var tr = relRect(textEl);
          if (tr.w > 4 && tr.h > 4) textR = tr;
        }
      }
      var dev = window.devicePixelRatio || 1;
      var cap = W < 700 ? 1.25 : 1.5;
      dpr = Math.min(dev, cap);
      var budget = W < 700 ? 1.1e6 : 3.0e6;                // max drawing-buffer pixels
      if (W * H * dpr * dpr > budget) dpr = Math.max(Math.min(1, dev), Math.sqrt(budget / (W * H)));
      dpr = Math.max(Math.min(dev, 0.75), dpr * dprScale);
      pw = Math.max(1, Math.round(W * dpr)); ph = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
    }

    function makeBand(b) {
      return {
        b: b, k: N - 1 - b,
        base: new Float32Array(S), y: new Float32Array(S), minF: new Float32Array(S),
        foam: new Float32Array(S), lit: new Float32Array(S), amp: new Float32Array(S), fan: new Float32Array(S),
        nd: new Float32Array(M), nv: new Float32Array(M), na: new Float32Array(M), nf: new Float32Array(M),
        gap: 2.5, alpha: 1, p1: 0, p2: 0, ampK: 1
      };
    }

    var lastLayoutW = 0, lastLayoutH = 0, lastClip = '';
    function layout() {
      if (Math.abs(W - lastLayoutW) > 1 || Math.abs(H - lastLayoutH) > 1) {
        drops.length = 0; mists.length = 0; rings.length = 0;     // positions belong to the old geometry
        lastLayoutW = W; lastLayoutH = H;
      }
      mobile = W < 700;
      s = clamp(Math.min(W / 1440, H / 850) * 0.5 + 0.5, 0.62, 1.2);
      if (mobile) s = clamp(W / 600, 0.55, 0.8);
      N = mobile ? 4 : 5;
      sx = Math.max(mobile ? 4 : 6, (W + 2 * pad) / 560);
      S = Math.ceil((W + 2 * pad) / sx) + 1;
      dx = mobile ? 9 : 12;
      M = Math.ceil((W + 2 * pad) / dx) + 2;
      xs = new Float32Array(S);
      for (var j = 0; j < S; j++) xs[j] = -pad + j * sx;

      // anchors: the logo (if any) decides where the swell rises to
      if (logoR) {
        lcx = logoR.x + logoR.w * 0.5; lw = logoR.w;
        yb = clamp(logoR.y + logoR.h * 0.78, H * 0.58, H * 0.95);
      } else {
        lcx = W * (mobile ? 0.8 : 0.76); lw = mobile ? 150 : clamp(W * 0.31, 240, 460);
        yb = H * (mobile ? 0.885 : 0.70);
      }
      lcx = clamp(lcx, W * 0.35, W * 0.97);
      xBreak = lcx - lw * (mobile ? 0.40 : 0.32);

      // front ribbon: low along the bottom-left, sweeping up to the logo's waterline, then nearly flat
      var yL = H * (mobile ? 0.975 : 0.958);
      var dY = Math.max(0, yL - yb);
      var fxp = [-0.12 * W, 0.3 * lcx, 0.58 * lcx, 0.8 * lcx, lcx, lcx + 0.5 * (W - lcx) + 1, W * 1.12 + 2];
      var fyp = [yL + 0.01 * H, yL - 0.03 * dY, yL - 0.26 * dY, yL - 0.76 * dY, yb, yb - (mobile ? 0.008 : 0.022) * H, yb - (mobile ? 0.012 : 0.034) * H];
      var front = monotone(fxp, fyp);
      // ribbons behind it: blade-like tapered tails emerging one after another (like the logo's lower bands)
      var sp = (mobile ? 0.042 : 0.058) * H;
      var spk = [0, 1.0, 0.84, 1.1, 0.9];
      var tailX = mobile ? [0, 0.0, 0.26, 0.5] : [0, 0.02, 0.17, 0.34, 0.5];
      var Lt = 0.38 * lcx;
      var fan = new Float32Array(S);
      for (j = 0; j < S; j++) {
        var xj = xs[j];
        fan[j] = xj <= lcx ? 0.55 + 0.45 * sstep(0.15 * lcx, lcx, xj) : 1 + 0.25 * (xj - lcx) / Math.max(1, W - lcx);
      }

      bands = [];
      var b, k, B;
      for (b = 0; b < N; b++) bands.push(makeBand(b));
      for (k = 0; k < N; k++) {
        B = bands[N - 1 - k];
        var P = k > 0 ? bands[N - k] : null;
        for (j = 0; j < S; j++) {
          var x = xs[j];
          if (!P) { B.base[j] = front(x); continue; }
          var tp = sstep(tailX[k] * lcx, tailX[k] * lcx + Lt, x);
          B.base[j] = P.base[j] - sp * spk[k] * fan[j] * tp + 5 * (1 - tp);
        }
      }

      // keep the water clear of the actual text lines (pushes the whole stack down where needed)
      if (textLines.length) {
        var keep = new Float32Array(S), margin = (mobile ? 0.035 : 0.05) * H;
        for (var r = 0; r < textLines.length; r++) {
          var L = textLines[r];
          for (j = 0; j < S; j++) if (xs[j] > L.x0 - 50 && xs[j] < L.x1 + 50) keep[j] = Math.max(keep[j], L.y1 + margin);
        }
        keep = blur1(blur1(keep, Math.round(70 / sx)), Math.round(70 / sx));
        var top = bands[0], push = new Float32Array(S);
        for (j = 0; j < S; j++) { var z = keep[j] - top.base[j]; push[j] = 0.5 * (z + Math.sqrt(z * z + 900)) - 15; }
        push = blur1(push, Math.round(40 / sx));
        for (b = 0; b < N; b++) for (j = 0; j < S; j++) bands[b].base[j] += Math.max(0, push[j]);
      }

      for (b = 0; b < N; b++) {
        B = bands[b]; k = B.k;
        var f = k / (N - 1);
        for (j = 0; j < S; j++) B.amp[j] = 0.4 + 0.6 * clamp((fan[j] - 0.55) / 0.45, 0, 1);
        B.ampK = lerp(mobile ? 7 : 12, mobile ? 4 : 7, f) * s;
        B.p1 = k * 0.55 + 0.3; B.p2 = k * 0.9 + 1.3;
        B.gap = lerp(2.1, 1.3, f) * (mobile ? 0.85 : 1);
      }
      ptr.prevSide = [];

      // per-band material (draw order; index N = curl lip)
      pal = { top: new Float32Array(32), mid: new Float32Array(32), deep: new Float32Array(32), par: new Float32Array(32) };
      for (b = 0; b <= N; b++) {
        var kk = b === N ? 0 : N - 1 - b, ff = kk / (N - 1), o = b * 4;
        var tc = mix3(C.topF, C.topB, Math.pow(ff, 0.8)), mc = mix3(C.midF, C.midB, ff), dc = mix3(C.deepF, C.deepB, ff);
        var alt = (kk % 2) ? 0.9 : 1.0;
        pal.top.set([tc[0], tc[1], tc[2], lerp(1.0, 0.45, ff)], o);
        pal.mid.set([mc[0], mc[1], mc[2], b === N ? 1 : 0], o);
        pal.deep.set([dc[0], dc[1], dc[2], 1 - ff], o);
        pal.par.set([0.5 * Math.pow(ff, 1.4), (1 - 0.08 * ff) * alt * (b === N ? 1.05 : 1), b * 1.73 + 0.5, lerp(34, 14, ff) * s], o);
      }

      scene.W = W; scene.H = H; scene.pw = pw; scene.ph = ph; scene.N = N; scene.S = S;
      scene.xs = xs; scene.bands = bands; scene.pal = pal; scene.fw = 1 / dpr;
      // scrim: soft protection around the tight text bounds + the original's left-to-right darkening
      var tr = textR || (mobile ? { x: 0, y: H * 0.12, w: W, h: H * 0.6 } : { x: W * 0.04, y: H * 0.26, w: W * 0.54, h: H * 0.5 });
      scene.scrim = [tr.x, tr.y, tr.x + tr.w, tr.y + tr.h, mobile ? 0.3 : 0.26, mobile ? 0.16 : 0.4, 0.92, mobile ? W * 1.1 : Math.max(W * 0.6, tr.x + tr.w + 60)];

      // particles that reference geometry are reset on layout
      sparks.length = 0;
      for (var i = 0; i < (mobile ? 6 : 13); i++) sparks.push(newSpark(Math.random));
      dirty = false;
    }
    function blur1(a, r) {
      if (r < 1) return a;
      var n = a.length, out = new Float32Array(n), acc = 0, i;
      for (i = -r; i <= r; i++) acc += a[clamp(i, 0, n - 1)];
      for (i = 0; i < n; i++) {
        out[i] = acc / (2 * r + 1);
        acc += a[clamp(i + r + 1, 0, n - 1)] - a[clamp(i - r, 0, n - 1)];
      }
      return out;
    }

    /* ---- sampling helpers ---- */
    function sampleIdx(x) { return clamp((x + pad) / sx, 0, S - 1.001); }
    function crestAt(B, x) {
      var f = sampleIdx(x), j = f | 0, u = f - j;
      return B.y[j] + (B.y[j + 1] - B.y[j]) * u;
    }
    function baseAt(B, x) {
      var f = sampleIdx(x), j = f | 0, u = f - j;
      return B.base[j] + (B.base[j + 1] - B.base[j]) * u;
    }
    function simAt(B, x) {                         // Catmull-Rom on the spring nodes
      var f = clamp((x + pad) / dx, 0, M - 1.001), k = f | 0, u = f - k;
      var p0 = B.nd[k > 0 ? k - 1 : 0], p1 = B.nd[k], p2 = B.nd[k + 1], p3 = B.nd[k + 2 < M ? k + 2 : M - 1];
      return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    }
    function foamAt(B, x) {
      var f = clamp((x + pad) / dx, 0, M - 1.001), k = f | 0, u = f - k;
      return B.nf[k] + (B.nf[k + 1] - B.nf[k]) * u;
    }
    function bandBelow(x, y) {                     // nearest ribbon whose crest is below (y down) the point
      var best = N - 1, bd = 1e9;
      for (var b = 0; b < N; b++) {
        var cy = crestAt(bands[b], x), d = cy - y;
        if (d > -6 && d < bd) { bd = d; best = b; }
      }
      return best;
    }

    /* ---- particles ---- */
    function newSpark(r) {
      var b = N - 1 - Math.floor(r() * Math.min(4, N));
      var x = 0, tries = 0;
      do { x = r() * W; tries++; } while (tries < 8 && inScrim(x, H * 0.5));
      return { b: b, x: x, life: r() * 2.5, max: 1.4 + r() * 1.8, r: (4 + r() * 6) * (mobile ? 0.8 : 1), col: [0.8, 0.95, 1], a: 0, y: 0 };
    }
    function inScrim(x) {
      var sc = scene.scrim;
      return x > sc[0] - 30 && x < sc[2] + 10 && !mobile;
    }
    function addDrop(x, y, vx, vy, size, life, minVx) {
      var max = mobile ? 200 : 460;
      if (minVx !== undefined && vx < minVx) vx = minVx + (vx - minVx) * 0.15;
      if (drops.length >= max) drops.shift();
      var c = Math.random() < 0.7 ? C.spray : C.sprayB;
      drops.push({ x: x, y: y, vx: vx, vy: vy, s: size, life: 0, max: life, col: c, a: 1, b: bandBelow(x, y + 30) });
    }
    function addMist(x, y, r, a, vx, vy, life) {
      if (mists.length > 60) mists.shift();
      mists.push({ x: x, y: y, r0: r, r: r, a0: a, a: a, vx: vx, vy: vy, life: 0, max: life, sq: 0.62, col: [0.62, 0.86, 1] });
    }
    function addRing(x, y, rmax, life, a) {
      if (rings.length > 10) rings.shift();
      rings.push({ x: x, y: y, r: 4, rmax: rmax, life: 0, max: life, a0: a, a: a, asp: 0.26, th: 0.04, col: [0.75, 0.95, 1] });
    }
    function impulse(b, x, v, sigma, foam) {
      var B = bands[b]; if (!B) return;
      var k0 = Math.max(0, Math.floor((x - 3 * sigma + pad) / dx)), k1 = Math.min(M - 1, Math.ceil((x + 3 * sigma + pad) / dx));
      for (var k = k0; k <= k1; k++) {
        var xx = -pad + k * dx, gk = Math.exp(-((xx - x) * (xx - x)) / (sigma * sigma));
        B.nv[k] += v * gk;
        if (foam) B.nf[k] = Math.max(B.nf[k], foam * gk);
      }
    }

    // a splash at (x,y): droplet fountain, mist, ripple rings, and a pulse through nearby ribbons
    function splashAt(x, y, power, dir) {
      power = power || 1; dir = dir || 0;
      var n = Math.round((mobile ? 38 : 76) * power), sc = mobile ? 0.72 : 1, pw = Math.min(dir > 0 ? 1.22 : 1.45, Math.sqrt(power));
      for (var i = 0; i < n; i++) {
        // a crown: most droplets go up and slightly outward, a few fly further
        var ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5 + dir * 0.32;
        var far = Math.random() < 0.18;
        var sp = rnd(140, 430) * pw * sc * (far ? 1.4 : 1);
        var sz = Math.random() < 0.75 ? rnd(0.9, 2.0) : rnd(2.0, 3.4);
        addDrop(x + rnd(-14, 14) * sc * pw, y + rnd(-4, 6), Math.cos(ang) * sp, Math.sin(ang) * sp, sz * sc, rnd(0.7, 1.35), dir > 0 ? -90 : undefined);
      }
      for (i = 0; i < Math.round(4 * power) + 2; i++) {
        addMist(x + rnd(-36, 36) * sc * pw, y + rnd(-26, 4), rnd(26, 56) * sc * pw, rnd(0.035, 0.07), rnd(-20, 20), rnd(-44, -12), rnd(1.3, 2.2));
      }
      if (power <= 1.01) { addRing(x, y, 120 * sc, 1.25, 0.32); addRing(x, y, 64 * sc, 0.9, 0.22); }
      for (var b = 0; b < N; b++) {
        var dy = crestAt(bands[b], x) - y, inf = Math.exp(-(dy * dy) / (140 * 140));
        if (inf > 0.04) impulse(b, x, 420 * s * power * inf, 50 * s, 0.9 * inf);
      }
    }

    /* ---- surges: the intro tide and the periodic sets ---- */
    function startSurge(big) {
      var A = big ? H * (mobile ? 0.11 : 0.19) : H * (mobile ? 0.045 : 0.065);
      surge = {
        t0: big ? 0 : introT, big: big,
        x0: big ? -0.15 * W : 0.12 * lcx, x1: xBreak,
        delay: big ? 0.1 : 0, travel: big ? 1.2 : 2.6,
        amp: A, curlStart: big ? 0.88 : 2.0, burstAt: big ? 1.42 : 2.75, curl: big ? 3.55 : 2.5,
        R: A * 0.42, w: A * 0.26, burst: false, xc: -1e4, A: 0, phi: 0, alpha: 1
      };
    }
    function updateSurge() {
      if (!surge) return;
      var g = surge, tt = introT - g.t0;
      var p = eOut((tt - g.delay) / g.travel);
      g.xc = lerp(g.x0, g.x1, p);
      g.A = g.amp * sstep(0.02, g.big ? 0.8 : 1.4, tt) * (1 - sstep(g.burstAt + 0.02, g.burstAt + 0.4, tt));
      g.phi = g.curl * eInOut((tt - g.curlStart) / (g.burstAt - g.curlStart));
      g.alpha = 1 - sstep(g.burstAt, g.burstAt + 0.13, tt);
      if (!g.burst && tt >= g.burstAt) { g.burst = true; burst(g); }
      if (tt > g.burstAt + 0.6) surge = null;
    }
    function surgeAt(k, x) {
      var g = surge;
      if (!g || g.A <= 0.01) return 0;
      var xc = g.xc - k * 16 * s, dxp = x - xc;
      var sig = dxp < 0 ? Math.max(120, W * (mobile ? 0.3 : 0.2)) : Math.max(40, W * (mobile ? 0.08 : 0.05));
      return g.A * Math.max(0.12, 1 - 0.24 * k) * Math.exp(-(dxp * dxp) / (sig * sig));
    }
    function burst(g) {
      var power = g.big ? (mobile ? 2.2 : 2.6) : 0.75;
      // the lip disintegrates into spray along its length
      if (lip.active) {
        for (var j = Math.floor(LS * 0.3); j < LS; j += (g.big ? 1 : 3)) {
          var tx = (lip.x[Math.min(LS - 1, j + 1)] - lip.x[Math.max(0, j - 1)]), ty = (lip.y[Math.min(LS - 1, j + 1)] - lip.y[Math.max(0, j - 1)]);
          var tl = Math.sqrt(tx * tx + ty * ty) || 1;
          var cnt = g.big ? 3 : 1;
          for (var c = 0; c < cnt; c++) {
            var sp = rnd(90, 300) * (mobile ? 0.7 : 1);
            addDrop(lip.x[j] + lip.nx[j] * rnd(0, lip.w[j]), lip.y[j] + lip.ny[j] * rnd(0, lip.w[j]),
              tx / tl * sp * 0.6 - lip.nx[j] * sp * 0.45 + rnd(-40, 40), ty / tl * sp * 0.3 - lip.ny[j] * sp * 0.45 - rnd(60, 200),
              rnd(0.9, 2.6) * (mobile ? 0.8 : 1), rnd(0.7, 1.3), -60);
          }
        }
      }
      var ix = lip.active ? lip.x[LS - 1] : g.xc + g.R, iy = lip.active ? lip.y[LS - 1] : crestAt(bands[N - 1], ix);
      splashAt(ix, iy, power, 1.25);
      impulse(N - 1, ix, 420 * s * (g.big ? 1 : 0.4), 60 * s, 1);
      if (N > 1) impulse(N - 2, ix + 20, 220 * s * (g.big ? 1 : 0.4), 70 * s, 0.6);
      if (g.big) addMist(ix + 30, iy - 50, 110 * (mobile ? 0.6 : 1), 0.07, 10, -26, 1.8);
    }

    function buildLip() {
      var g = surge;
      lip.active = !!(g && g.phi > 0.02 && g.alpha > 0.01);
      if (!lip.active) return;
      var FB = bands[N - 1];
      var px = g.xc, py = crestAt(FB, px);
      var R0 = g.R * (0.55 + 0.45 * sstep(0, 1, g.A / g.amp)), w0 = g.w;
      var rootN = 14, rootLen = R0 * 1.1, cX = px, cY = py + R0;
      var tot = 0, j;
      for (j = 0; j < LS; j++) {
        var x, y;
        if (j < rootN) {
          x = px - rootLen + rootLen * (j / rootN); y = crestAt(FB, x);
        } else {
          var th = g.phi * ((j - rootN + 1) / (LS - rootN));
          var r = R0 * (1 - 0.34 * th / Math.PI);
          x = cX + r * Math.sin(th); y = cY - r * Math.cos(th);
        }
        lip.x[j] = x; lip.y[j] = y;
      }
      for (j = 0; j < LS; j++) {
        var jl = j > 0 ? j - 1 : j, jr = j < LS - 1 ? j + 1 : j;
        var tx = lip.x[jr] - lip.x[jl], ty = lip.y[jr] - lip.y[jl], tl = Math.sqrt(tx * tx + ty * ty) || 1;
        lip.nx[j] = -ty / tl; lip.ny[j] = tx / tl;             // into the body (inside the curl)
        if (j > 0) tot += Math.sqrt(Math.pow(lip.x[j] - lip.x[j - 1], 2) + Math.pow(lip.y[j] - lip.y[j - 1], 2));
        lip.u[j] = px - rootLen + tot;
        var sN = j / (LS - 1);
        var taper = sstep(0, 0.28, sN) * Math.pow(1 - sstep(0.45, 1.0, sN), 0.85);
        lip.w[j] = Math.max(0, w0 * taper * (0.4 + 0.6 * clamp(g.phi / 1.2, 0, 1)));
        lip.foam[j] = sstep(0.55, 1, sN) * 0.9 * clamp(g.phi / g.curl, 0, 1);
      }
      lip.alpha = g.alpha;
      lip.g = FB.gap;
    }

    /* ---- per-frame simulation ---- */
    function introOffset(k, x) {
      if (introT >= INTRO_END) return 0;
      var tt = introT - k * 0.055;
      var front = lerp(-0.5 * W, 1.5 * W, eOut(tt / 1.2));
      var m = sstep(front - 0.45 * W, front, x);
      return m * 0.62 * H + (1 - eOut(tt / 1.0)) * 0.22 * H;
    }

    function simulate(dt) {
      if (dt <= 0) return;
      var steps = Math.min(12, Math.ceil(dt / (1 / 120))), h = dt / steps;
      var c2 = Math.pow(250 * s, 2), w02 = 2.6 * 2.6, damp = 1.5, cpl = 3.5;
      var pin = ptr.str > 0.01 && interactive;
      for (var st = 0; st < steps; st++) {
        for (var b = 0; b < N; b++) {
          var B = bands[b], nd = B.nd, nv = B.nv, na = B.na;
          var up = b > 0 ? bands[b - 1].nd : null, dn = b < N - 1 ? bands[b + 1].nd : null;
          for (var k = 0; k < M; k++) {
            var l = nd[k > 0 ? k - 1 : 0], r = nd[k < M - 1 ? k + 1 : M - 1], c = nd[k];
            var acc = c2 * (l - 2 * c + r) / (dx * dx) - w02 * c - damp * nv[k];
            if (up) acc += cpl * (up[k] - c);
            if (dn) acc += cpl * (dn[k] - c);
            na[k] = acc;
          }
          if (pin) {
            var cy = crestAt(B, ptr.sx), dy = ptr.sy - cy;
            var R0 = 150 * s, inf = Math.exp(-(dy * dy) / (R0 * R0)) * ptr.str;
            if (inf > 0.02) {
              var sig = 70 * s, k0 = Math.max(0, Math.floor((ptr.sx - 3 * sig + pad) / dx)), k1 = Math.min(M - 1, Math.ceil((ptr.sx + 3 * sig + pad) / dx));
              // swell toward the cursor (spring pull) ...
              var pull = clamp(dy, -95 * s, 95 * s) * 17 * inf;
              // ... plus a wake when the cursor drags sideways through the water
              var wake = Math.min(Math.abs(ptr.vx), 1600) / 1600 * 520 * s * inf * (dy > -30 * s ? 1 : 0.3);
              var drag = Math.min(1, 5 * h) * inf;
              for (k = k0; k <= k1; k++) {
                var xx = -pad + k * dx, gk = Math.exp(-((xx - ptr.sx) * (xx - ptr.sx)) / (sig * sig));
                na[k] += (pull + wake) * gk;
                nv[k] += (ptr.vy * 0.5 - nv[k]) * drag * gk;
              }
            }
          }
          var lim = 90 * s;
          for (k = 0; k < M; k++) {
            nv[k] += na[k] * h;
            nd[k] += nv[k] * h;
            if (nd[k] > lim) { nd[k] = lim; nv[k] *= 0.5; } else if (nd[k] < -lim) { nd[k] = -lim; nv[k] *= 0.5; }
          }
        }
      }
      var fd = Math.exp(-dt * 1.1);
      for (b = 0; b < N; b++) {
        B = bands[b];
        for (k = 0; k < M; k++) B.nf[k] = Math.max(B.nf[k] * fd, clamp(Math.abs(B.nv[k]) / (190 * s) - 0.12, 0, 1));
      }
    }

    function computeCrests() {
      var b, j, B, k;
      var k1 = TAU / (560 * s), w1 = TAU / 7.5, k2 = TAU / (290 * s), w2 = TAU / 4.8;
      var lx = scene.light[0], ly = scene.light[1];
      for (b = 0; b < N; b++) {
        B = bands[b]; k = B.k;
        var breath = 3.5 * s * Math.sin(t * TAU / 11 + k * 0.3);
        for (j = 0; j < S; j++) {
          var x = xs[j];
          var sw = B.ampK * B.amp[j] * (0.62 * Math.sin(x * k1 - t * w1 + B.p1) + 0.38 * Math.sin(x * k2 - t * w2 + B.p2));
          B.y[j] = B.base[j] + sw + breath + simAt(B, x) + introOffset(k, x) - surgeAt(k, x);
        }
      }
      // occlusion: crest of the highest ribbon in front of each ribbon
      for (j = 0; j < S; j++) {
        var m = H + 40;
        for (b = N - 1; b >= 0; b--) { bands[b].minF[j] = m; if (bands[b].y[j] < m) m = bands[b].y[j]; }
      }
      // lighting + foam per sample
      var ambientFoamX = logoR ? lcx : -1e4;
      for (b = 0; b < N; b++) {
        B = bands[b];
        for (j = 0; j < S; j++) {
          var jl = j > 0 ? j - 1 : j, jr = j < S - 1 ? j + 1 : j;
          var tx = xs[jr] - xs[jl], ty = B.y[jr] - B.y[jl], tl = Math.sqrt(tx * tx + ty * ty) || 1;
          var nx = ty / tl, ny = -tx / tl;
          var Lx = lx - xs[j], Ly = ly - B.y[j], Ll = Math.sqrt(Lx * Lx + Ly * Ly) || 1;
          B.lit[j] = clamp(0.5 + 0.5 * (nx * Lx + ny * Ly) / Ll, 0, 1) * 0.7 + 0.3 * clamp(-ny, 0, 1);
          var fo = foamAt(B, xs[j]);
          if (B.k === 0) {                          // churn where the logo meets the water
            var dl = (xs[j] - ambientFoamX) / (lw * 0.5);
            fo = Math.max(fo, 0.22 * Math.exp(-dl * dl * 1.6) * (0.75 + 0.25 * Math.sin(t * 1.3 + xs[j] * 0.02)));
          }
          B.foam[j] = fo;
        }
      }
    }

    function updateParticles(dt) {
      var g = 1050 * (mobile ? 0.8 : 1), i, q;
      for (i = drops.length - 1; i >= 0; i--) {
        q = drops[i];
        q.life += dt;
        q.vy += g * dt; q.vx *= Math.exp(-dt * 0.5); q.vy *= Math.exp(-dt * 0.25);
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.a = 1 - sstep(q.max * 0.6, q.max, q.life);
        var B = bands[q.b] || bands[N - 1];
        if ((q.vy > 0 && q.y > crestAt(B, q.x) + 4) || q.life > q.max || q.y > H + 20) {
          if (q.vy > 0 && q.life < q.max && q.s > 2.2) impulse(q.b, q.x, 9 * q.s * s, 26 * s, 0.2);
          drops.splice(i, 1);
        }
      }
      for (i = mists.length - 1; i >= 0; i--) {
        q = mists[i]; q.life += dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.r = q.r0 * (1 + q.life * 0.9);
        q.a = q.a0 * Math.sin(Math.PI * clamp(q.life / q.max, 0, 1));
        if (q.life > q.max) mists.splice(i, 1);
      }
      for (i = rings.length - 1; i >= 0; i--) {
        q = rings[i]; q.life += dt;
        var p = q.life / q.max;
        q.r = 6 + q.rmax * eOut(p); q.a = q.a0 * (1 - sstep(0.1, 1, p)); q.th = 0.035 + 0.04 * p;
        if (p >= 1) rings.splice(i, 1);
      }
      updateSparks(dt, Math.random);
      // drifting sea mist at the logo's waterline
      if (logoR && !reduced && Math.random() < dt * 1.6) {
        var mx = lcx + rnd(-0.45, 0.45) * lw;
        addMist(mx, crestAt(bands[N - 1], mx) - rnd(0, 18), rnd(28, 60) * (mobile ? 0.6 : 1), rnd(0.035, 0.07), rnd(-12, 12), rnd(-16, -6), rnd(2.5, 4));
      }
    }
    function updateSparks(dt, r) {
      for (var i = 0; i < sparks.length; i++) {
        var q = sparks[i];
        q.life += dt;
        if (q.life > q.max) { sparks[i] = q = newSpark(r); q.life = 0; }
        var B = bands[q.b] || bands[N - 1];
        q.y = crestAt(B, q.x) + 2.5;
        var p = q.life / q.max;
        q.a = Math.pow(Math.sin(Math.PI * clamp(p, 0, 1)), 3) * 0.7 * sstep(1.6, 2.4, introT);
      }
    }

    /* ---- pointer ---- */
    function localXY(e) {
      var r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function onMove(e) {
      var p = localXY(e);
      ptr.x = p[0]; ptr.y = p[1]; ptr.inside = true; ptr.lastMove = performance.now();
      if (ptr.sx < -1000) { ptr.sx = ptr.x; ptr.sy = ptr.y; }
      if (!raf && !reduced) kick();
    }
    function onLeave() { ptr.inside = false; }
    function onClick(e) {
      if (reduced || destroyed) return;
      var tg = e.target;
      if (tg && tg.closest && tg.closest('a,button,input,select,textarea,label,[role="button"]')) return;
      var p = localXY(e);
      if (p[0] < 0 || p[1] < 0 || p[0] > W || p[1] > H) return;
      splashAt(p[0], p[1], 1, 0);
      kick();
    }
    function updatePointer(dt) {
      if (dt <= 0) return;
      var idle = (performance.now() - ptr.lastMove) / 1000;
      var target = ptr.inside && idle < 2.5 ? 1 : 0;
      ptr.str += (target - ptr.str) * Math.min(1, dt * (target ? 6 : 1.6));
      var ox = ptr.sx, oy = ptr.sy, a = Math.min(1, dt * 18);
      ptr.sx += (ptr.x - ptr.sx) * a; ptr.sy += (ptr.y - ptr.sy) * a;
      var vx = (ptr.sx - ox) / dt, vy = (ptr.sy - oy) / dt;
      ptr.vx += (vx - ptr.vx) * Math.min(1, dt * 12); ptr.vy += (vy - ptr.vy) * Math.min(1, dt * 12);
      // flick spray when the pointer cuts quickly through a crest
      if (ptr.str > 0.3) {
        var speed = Math.sqrt(ptr.vx * ptr.vx + ptr.vy * ptr.vy);
        for (var b = 0; b < N; b++) {
          var cy = crestAt(bands[b], ptr.sx), side = ptr.sy < cy ? -1 : 1;
          if (ptr.prevSide[b] && ptr.prevSide[b] !== side && speed > 520 * s && ptr.sx > 0 && ptr.sx < W) {
            var n = mobile ? 4 : 8;
            for (var i = 0; i < n; i++) addDrop(ptr.sx + rnd(-8, 8), cy - 2, ptr.vx * rnd(0.15, 0.4) + rnd(-50, 50), -rnd(140, 380) * s, rnd(1, 2.6), rnd(0.6, 1.1));
            impulse(b, ptr.sx, ptr.vy * 0.4, 40 * s, 0.6);
          }
          ptr.prevSide[b] = side;
        }
      }
    }

    /* ---- logo choreography: rises out of the water, bobs, is clipped by the front ribbon ---- */
    function logoRise() {
      if (introT >= INTRO_END) return 1;
      return eOut((introT - 1.38) / 1.15);
    }
    function updateLogo() {
      if (!logo || !logoR) return;
      var FB = bands[N - 1];
      var rise = logoRise();
      var cx = logoR.x + logoR.w * 0.5;
      var wl = crestAt(FB, cx), rest = baseAt(FB, cx);
      var bob = clamp(wl - rest, -60, 60) * 0.5;
      var y1 = crestAt(FB, cx - logoR.w * 0.3), y2 = crestAt(FB, cx + logoR.w * 0.3);
      var rot = clamp(Math.atan2(y2 - y1, logoR.w * 0.6) * 0.35, -0.05, 0.05);
      var ty = (1 - rise) * logoR.h * 0.6 + bob;
      logo.style.transform = 'translate3d(0,' + ty.toFixed(2) + 'px,0) rotate(' + (rot * 57.2958).toFixed(3) + 'deg)';
      logo.style.opacity = (introT >= INTRO_END ? 1 : sstep(1.3, 1.46, introT)).toFixed(3);
      // water line (screen) -> logo-local coordinates (inverse of translate + rotate about centre)
      var ox = logoR.w * 0.5, oy = logoR.h * 0.5, cs = Math.cos(-rot), sn = Math.sin(-rot);
      var pts = [], NP = 22, top = -logoR.h;
      pts.push((-logoR.w * 0.5).toFixed(1) + 'px ' + top.toFixed(1) + 'px');
      pts.push((logoR.w * 1.5).toFixed(1) + 'px ' + top.toFixed(1) + 'px');
      for (var i = NP; i >= 0; i--) {
        var sxp = logoR.x - logoR.w * 0.5 + logoR.w * 2 * i / NP;
        var syp = crestAt(FB, sxp) - FB.gap - 0.6;
        var qx = sxp - logoR.x - ox, qy = syp - logoR.y - ty - oy;
        var lx = cs * qx - sn * qy + ox, ly = sn * qx + cs * qy + oy;
        pts.push((Math.round(lx * 2) / 2) + 'px ' + (Math.round(Math.max(top, ly) * 2) / 2) + 'px');
      }
      var cp = 'polygon(' + pts.join(',') + ')';
      if (cp !== lastClip) {
        lastClip = cp;
        logo.style.clipPath = cp;
        logo.style.webkitClipPath = cp;
      }
    }

    /* ---- frame ---- */
    function updateSceneLights() {
      var appear = introT >= INTRO_END ? 1 : sstep(1.2, 2.3, introT);
      var hx = lcx + lw * 0.06, hy = logoR ? logoR.y + logoR.h * 0.36 : yb - H * 0.22;
      var breathe = 1 + 0.08 * Math.sin(t * 0.7);
      scene.halo = [hx, hy, lw * (mobile ? 0.8 : 0.66), (mobile ? 0.5 : 0.62) * appear * breathe];
      scene.light = [lcx, yb - H * 0.06, lw * 0.7, 0.8 * appear];
      scene.glit = [lcx + lw * 0.04, 0, lw * 0.34, (mobile ? 0.45 : 0.6) * appear];
      scene.ptr = [ptr.sx, ptr.sy, 120 * s, interactive ? 0.55 * ptr.str : 0];
    }

    function step(dt) {
      t += dt;
      var prevIntro = introT;
      introT += dt;
      if (animIntro && prevIntro <= 0.0001 && !surge && introT < 1) startSurge(true);
      if (introT >= INTRO_END && nextSet > 90) nextSet = introT + rnd(7, 10);
      if (!surge && introT >= nextSet) { startSurge(false); nextSet = introT + rnd(10, 14); }
      updatePointer(dt);
      updateSurge();
      simulate(dt);
      updateSceneLights();
      computeCrests();
      buildLip();
      updateParticles(dt);
      updateLogo();
      scene.t = t;
    }

    function render() {
      scene.pw = pw; scene.ph = ph; scene.fw = 1 / dpr;
      try { R.draw(scene); } catch (e) { /* never throw from the loop */ }
    }

    var debugPaused = false;
    function running() { return !destroyed && !reduced && visible && !document.hidden && !lost && !debugPaused; }

    function frame(ts) {
      raf = 0;
      if (!running()) { lastTs = 0; return; }
      if (dirty) { measure(); layout(); }
      var now = ts / 1000;
      var dt = lastTs ? Math.min(now - lastTs, 0.25) : 0;
      lastTs = now;
      // adaptive resolution: if frames are consistently slow, drop the buffer scale (never below 1x CSS)
      if (dt > 0) {
        perf.acc += dt; perf.n++; perf.last = Math.round(dt * 1000);
        if (perf.n >= 90) {
          if (perf.acc / perf.n > 1 / 38 && dprScale > 0.7 && dpr > 1.01) { dprScale *= 0.85; dirty = true; }
          perf.acc = 0; perf.n = 0;
        }
      }
      try { step(dt); render(); } catch (e) { failSafe(); return; }
      raf = requestAnimationFrame(frame);
    }
    // Anything unexpected at runtime: stop, and leave the page on its static CSS backdrop.
    function failSafe() {
      cleanup();
      canvas.style.visibility = 'hidden';
    }
    function guard(fn) { return function (e) { try { fn(e); } catch (err) { failSafe(); } }; }
    function kick() {
      if (!raf && running()) { lastTs = 0; raf = requestAnimationFrame(frame); }
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; lastTs = 0; }

    // A single, composed still frame (prefers-reduced-motion): no intro, no loop.
    function drawStatic() {
      if (destroyed || lost) return;
      measure(); layout();
      introT = 99; t = 23.4;
      drops.length = 0; mists.length = 0; rings.length = 0; surge = null; lip.active = false;
      for (var b = 0; b < N; b++) { bands[b].nd.fill(0); bands[b].nv.fill(0); bands[b].nf.fill(0); }
      updateSceneLights();
      computeCrests();
      var r = mulberry(7);
      sparks.length = 0;
      for (var i = 0; i < (mobile ? 6 : 12); i++) { var q = newSpark(r); q.life = q.max * (0.35 + 0.3 * r()); sparks.push(q); }
      updateSparks(0, r);
      for (i = 0; i < sparks.length; i++) sparks[i].a *= 0.8;
      if (logoR) {
        for (i = 0; i < 5; i++) {
          var mx = lcx + (r() - 0.5) * lw * 0.8;
          mists.push({ x: mx, y: crestAt(bands[N - 1], mx) - 8, r: (40 + r() * 30) * (mobile ? 0.6 : 1), a: 0.05, sq: 0.62, col: [0.55, 0.85, 1] });
        }
      }
      updateLogo();
      scene.t = t;
      render();
      mists.length = 0;
    }

    /* ---- observers & listeners ---- */
    var ro = null, io = null, rafResize = 0;
    function onResize() {
      if (destroyed) return;
      dirty = true;
      if (reduced) {
        if (!rafResize) rafResize = requestAnimationFrame(function () { rafResize = 0; try { drawStatic(); } catch (e) { failSafe(); } });
      } else if (!raf) {
        // keep the frozen frame correct while paused (e.g. resized while offscreen)
        if (!rafResize) rafResize = requestAnimationFrame(function () {
          rafResize = 0;
          if (raf || destroyed || lost) return;
          try { measure(); layout(); updateSceneLights(); computeCrests(); buildLip(); updateLogo(); render(); } catch (e) { failSafe(); }
        });
      }
    }
    if (window.ResizeObserver) {
      ro = new ResizeObserver(onResize);
      ro.observe(canvas);
      if (logo) ro.observe(logo);
      if (textEl) ro.observe(textEl);
    } else {
      on(window, 'resize', onResize, { passive: true });
    }
    if (window.IntersectionObserver) {
      io = new IntersectionObserver(function (es) {
        visible = es[es.length - 1].isIntersecting;
        if (visible) kick(); else stop();
      }, { threshold: 0 });
      io.observe(canvas);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (!destroyed) onResize(); }, noop);
    }
    on(document, 'visibilitychange', function () { if (document.hidden) stop(); else kick(); });
    if (interactive) {
      on(host, 'pointermove', guard(onMove), { passive: true });
      on(host, 'pointerdown', guard(onMove), { passive: true });
      on(host, 'pointerleave', guard(onLeave), { passive: true });
      on(host, 'pointercancel', guard(onLeave), { passive: true });
      on(host, 'click', guard(onClick), { passive: true });
    }
    if (mq && !opts.reducedMotion) {
      var onMQ = function () {
        reduced = !!mq.matches;
        if (reduced) { stop(); drawStatic(); }
        else { introT = Math.max(introT, INTRO_END); lastTs = 0; dirty = true; kick(); }
      };
      if (mq.addEventListener) { mq.addEventListener('change', onMQ); disposers.push(function () { mq.removeEventListener('change', onMQ); }); }
      else if (mq.addListener) { mq.addListener(onMQ); disposers.push(function () { mq.removeListener(onMQ); }); }
    }
    // WebGL context loss: show the CSS backdrop until restored
    var lost = false;
    if (R.kind === 'gl') {
      on(canvas, 'webglcontextlost', function (e) { e.preventDefault(); lost = true; stop(); canvas.style.visibility = 'hidden'; if (logo) logo.style.opacity = '1'; });
      on(canvas, 'webglcontextrestored', function () {
        try { R.restore(); lost = false; canvas.style.visibility = ''; dirty = true; if (reduced) drawStatic(); else kick(); } catch (e) { /* stay on CSS backdrop */ }
      });
    }

    /* ---- go ---- */
    try {
      if (reduced) {
        drawStatic();
      } else {
        measure(); layout();
        step(0);
        render();
        kick();
      }
    } catch (e) {
      // anything unexpected: restore the page to its static CSS look
      cleanup();
      canvas.style.visibility = 'hidden';
      return { destroy: function () { canvas.style.visibility = ''; }, splash: noop };
    }

    function cleanup() {
      destroyed = true;
      stop();
      if (rafResize) cancelAnimationFrame(rafResize);
      if (ro) ro.disconnect();
      if (io) io.disconnect();
      for (var i = 0; i < disposers.length; i++) { try { disposers[i](); } catch (e) { /* ignore */ } }
      disposers.length = 0;
      if (logo && logoSaved) {
        logo.style.opacity = logoSaved.opacity === '0' ? '' : logoSaved.opacity; logo.style.transform = logoSaved.transform;
        logo.style.clipPath = logoSaved.clipPath; logo.style.webkitClipPath = logoSaved.webkitClipPath;
        logo.style.willChange = logoSaved.willChange;
      }
      try { R.dispose(); } catch (e) { /* ignore */ }
    }

    return {
      // diagnostics only (not part of the contract)
      stats: function () {
        return { renderer: R.kind, introT: introT, t: t, dpr: dpr, buffer: [pw, ph], running: !!raf, frameMs: perf.last, drops: drops.length, bands: N, surge: surge ? +(introT - surge.t0).toFixed(2) : null, nextSet: +nextSet.toFixed(2) };
      },
      // deterministic stepping for visual QA (pauses the live loop)
      _debug: {
        pause: function () { debugPaused = true; stop(); },
        resume: function () { debugPaused = false; kick(); },
        advance: function (sec) {
          if (destroyed || reduced) return introT;
          if (dirty) { measure(); layout(); }
          var n = Math.max(1, Math.round(sec * 60));
          for (var i = 0; i < n; i++) step(1 / 60);
          render();
          return introT;
        },
        pointer: function (x, y) { ptr.x = x; ptr.y = y; ptr.inside = true; ptr.lastMove = performance.now(); if (ptr.sx < -1000) { ptr.sx = x; ptr.sy = y; } }
      },
      destroy: function () { if (!destroyed) cleanup(); },
      splash: function (xf, yf) {
        if (destroyed || reduced || lost) return;
        if (dirty) { measure(); layout(); }
        splashAt(clamp(+xf || 0, 0, 1) * W, clamp(+yf || 0, 0, 1) * H, 1, 0);
        kick();
      }
    };
  }

  window.WaveBackground = { mount: mount };
})();
