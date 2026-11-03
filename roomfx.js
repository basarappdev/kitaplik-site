/* Başar! Kitaplık — resimli oda motoru
   WebGL: resmi hafifçe esnetir (nefes, baş, perde), vapur gibi hareketli parçayı çizer,
   günün saatine göre ortam ışığını ve lambaların/mumların gerçek aydınlatmasını hesaplar, şimşek.
   2D: alevler, mumlar, toz, buhar, yağmur, yıldız, kuş vb. */
(function () {
  var VS = 'attribute vec2 p;varying vec2 u;void main(){u=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision mediump float;varying vec2 u;',
    'uniform sampler2D im;uniform sampler2D sp;uniform vec2 sc;uniform vec2 of;uniform float t;uniform float asp;',
    'uniform int n;uniform vec4 C[10];uniform vec4 A[10];uniform float K[10];',
    'uniform int nl;uniform vec4 LP[16];uniform vec3 LC[16];uniform vec3 amb;',
    'uniform int nw;uniform vec4 WR[4];uniform vec3 wcol;uniform float wmix;uniform float flash;',
    'uniform int hs;uniform vec4 SB;uniform vec2 SO;uniform int ng;uniform vec4 GR[3];',
    'float inR(vec2 q,vec4 r,float e){vec2 a=smoothstep(r.xy-e,r.xy+e,q)*(1.-smoothstep(r.xy+r.zw-e,r.xy+r.zw+e,q));return a.x*a.y;}',
    'void main(){vec2 q=of+u*sc;vec2 d=vec2(0.);',
    'for(int i=0;i<10;i++){if(i>=n)break;vec2 z=(q-C[i].xy)/C[i].zw;float f=exp(-dot(z,z)*2.2);',
    'if(K[i]>.5){f*=clamp((q.y-(C[i].y-C[i].w))/(2.*C[i].w),0.,1.);}d+=A[i].xy*sin(t*A[i].z+A[i].w)*f;}',
    'vec2 p=q-d;vec3 c=texture2D(im,p).rgb;',
    'if(hs==1){float g=0.;for(int i=0;i<3;i++){if(i>=ng)break;g=max(g,inR(p,GR[i],.0006));}',
    ' if(g>0.){vec2 s=(p-SB.xy-SO)/SB.zw;if(s.x>0.&&s.x<1.&&s.y>0.&&s.y<1.){vec4 k=texture2D(sp,s);c=mix(c,k.rgb,k.a*g);}}}',
    'float w=0.;for(int i=0;i<4;i++){if(i>=nw)break;w=max(w,inR(q,WR[i],.012));}',
    'float wl=dot(c,vec3(.3,.59,.11));w*=smoothstep(.42,.72,wl);c=mix(c,c*wcol,w*wmix);',
    'vec3 L=vec3(0.);for(int i=0;i<16;i++){if(i>=nl)break;vec2 z=q-LP[i].xy;z.y*=asp;float r=LP[i].z;L+=LC[i]*LP[i].w*exp(-dot(z,z)/(r*r));}',
    'vec3 col=c*(amb+L);',
    'float lu=dot(c,vec3(.3,.59,.11));col+=flash*(c*.45+vec3(lu*lu*1.1))*vec3(.85,.9,1.);',
    'gl_FragColor=vec4(col,1.);}'
  ].join('\n');
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function mk(tag, css, parent) { var e = document.createElement(tag); e.style.cssText = css; parent.appendChild(e); return e; }
  var AMB = { g: [1, 1, 1], a: [.86, .7, .6], n: [.22, .26, .42] };
  var WIN = { g: [[1, 1, 1], 0], a: [[1.08, .72, .52], .55], n: [[.2, .27, .55], .85] };
  var COL = { warm: [1, .62, .3], candle: [1, .56, .24], lamp: [1, .7, .38], moon: [.45, .55, .9], sunset: [1, .5, .3], neon: [1, .25, .65], cyan: [.35, 1, .9], green: [.9, 1, .55], pink: [1, .55, .55] };

  function RoomFX(box, spec, imgs) {
    this.box = box; this.spec = spec; this.imgs = imgs; this.tod = 'g'; this.on = true; this.flash = 0;
    box.style.position = 'absolute'; box.style.overflow = 'hidden';
    this.base = mk('img', 'position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;display:block', box);
    this.base.alt = ''; this.base.src = imgs[spec.id];
    this.glc = mk('canvas', 'position:absolute;inset:0;width:100%;height:100%;display:block', box);
    this.tint = mk('div', 'position:absolute;inset:0;pointer-events:none;mix-blend-mode:multiply;transition:background 1.2s', box);
    this.cv = mk('canvas', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none', box);
    this.ctx = this.cv.getContext('2d');
    this.parts = (spec.fx || []).map(this.init, this);
    this.lights = (spec.lights || []).map(function (l) { return { l: l, ph: rnd(0, 60) }; });
    var self = this, need = 1 + (spec.sprite ? 1 : 0) + (spec.plate ? 1 : 0), got = 0;
    this.texImg = spec.plate ? new Image() : this.base; if (spec.plate) this.texImg.src = imgs[spec.plate];
    this.spImg = spec.sprite ? new Image() : null; if (this.spImg) this.spImg.src = imgs[spec.sprite.img];
    var ready = function () { if (++got >= need) self.setupGL(); };
    [this.base, this.texImg !== this.base ? this.texImg : null, this.spImg].forEach(function (im) { if (!im) return; if (im.complete && im.naturalWidth) ready(); else im.addEventListener('load', ready); });
    this.size();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  var P = RoomFX.prototype;
  P.destroy = function () { this.on = false; if (this.gl) { var x = this.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); this.gl = null; } };
  P.setTod = function (v) {
    this.tod = v;
    this.tint.style.background = this.gl || v === 'g' ? 'transparent' : v === 'a' ? 'linear-gradient(rgba(255,170,110,.32),rgba(150,80,110,.42))' : 'linear-gradient(rgba(40,55,110,.72),rgba(25,30,70,.78))';
  };
  // ölçüler: transform'dan etkilenmeyen yerleşim boyutu (yakınlaşırken iki kez büyümesin)
  P.size = function () {
    var w = this.box.offsetWidth || 1, h = this.box.offsetHeight || 1, d = Math.min(2, window.devicePixelRatio || 1);
    this.W = w; this.H = h;
    this.cv.width = w * d; this.cv.height = h * d; this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.glc.width = Math.round(w * d); this.glc.height = Math.round(h * d);
    if (this.gl) this.gl.viewport(0, 0, this.glc.width, this.glc.height);
    this.cover();
  };
  P.cover = function () {
    var iw = this.base.naturalWidth || 9, ih = this.base.naturalHeight || 19, fw = this.W || 1, fh = this.H || 1;
    var s = Math.max(fw / iw, fh / ih), vw = fw / (iw * s), vh = fh / (ih * s);
    this.sc = [vw, vh]; this.of = [(1 - vw) / 2, (1 - vh) / 2]; this.asp = ih / iw;
  };
  P.X = function (px) { return ((px / 100 - this.of[0]) / this.sc[0]) * this.W; };
  P.Y = function (py) { return ((py / 100 - this.of[1]) / this.sc[1]) * this.H; };
  P.Lx = function (w) { return w / 100 / this.sc[0] * this.W; };
  P.Ly = function (h) { return h / 100 / this.sc[1] * this.H; };
  P.setupGL = function () {
    if (this.gl || !this.on) return;
    var gl = this.glc.getContext('webgl', { premultipliedAlpha: false, alpha: false }); if (!gl) return;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    function tex(unit, img) { var tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
    try { tex(0, this.texImg); if (this.spImg) tex(1, this.spImg); } catch (e) { return; }
    var U = function (n) { return gl.getUniformLocation(pr, n); };
    gl.uniform1i(U('im'), 0); gl.uniform1i(U('sp'), 1);
    var w = this.spec.warp || [], C = [], A = [], K = [];
    w.slice(0, 10).forEach(function (q) { C.push(q.c[0] / 100, q.c[1] / 100, q.r[0] / 100, q.r[1] / 100); A.push(q.a[0] / 100, q.a[1] / 100, 6.2832 / (q.T || 4), q.ph || Math.random() * 6); K.push(q.k || 0); });
    while (K.length < 10) { C.push(0, 0, 1, 1); A.push(0, 0, 0, 0); K.push(0); }
    gl.uniform4fv(U('C'), C); gl.uniform4fv(U('A'), A); gl.uniform1fv(U('K'), K); gl.uniform1i(U('n'), Math.min(10, w.length));
    var wr = (this.spec.windows || []).slice(0, 4), WR = []; wr.forEach(function (r) { WR.push(r[0] / 100, r[1] / 100, r[2] / 100, r[3] / 100); }); while (WR.length < 16) WR.push(0, 0, 0, 0);
    gl.uniform4fv(U('WR'), WR); gl.uniform1i(U('nw'), wr.length);
    var S = this.spec.sprite;
    gl.uniform1i(U('hs'), S ? 1 : 0);
    if (S) { gl.uniform4f(U('SB'), S.box[0] / 100, S.box[1] / 100, S.box[2] / 100, S.box[3] / 100); var GR = []; S.glass.forEach(function (r) { GR.push(r[0] / 100, r[1] / 100, r[2] / 100, r[3] / 100); }); while (GR.length < 12) GR.push(0, 0, 0, 0); gl.uniform4fv(U('GR'), GR); gl.uniform1i(U('ng'), S.glass.length); }
    this.u = { t: U('t'), sc: U('sc'), of: U('of'), asp: U('asp'), LP: U('LP'), LC: U('LC'), nl: U('nl'), amb: U('amb'), wcol: U('wcol'), wmix: U('wmix'), flash: U('flash'), SO: U('SO') };
    this.gl = gl; this.cover(); gl.viewport(0, 0, this.glc.width, this.glc.height);
    this.base.style.visibility = 'hidden'; this.setTod(this.tod);
  };
  P.init = function (f) {
    var o = {}; for (var k in f) o[k] = f[k];
    if (f.t === 'dust') o.p = Array.from({ length: f.n || 40 }, function () { return { x: Math.random(), y: Math.random(), r: rnd(1, 2.6), s: rnd(.4, 1.2), ph: rnd(0, 6) }; });
    if (f.t === 'glass') o.p = Array.from({ length: f.n || 22 }, function () { return { x: Math.random(), y: Math.random(), v: rnd(.2, 1), r: rnd(1, 2.2), wait: rnd(0, 3000) }; });
    if (f.t === 'stars') o.p = Array.from({ length: f.n || 30 }, function () { var a = rnd(0, 6.28), d = Math.sqrt(Math.random()); return f.round ? { x: .5 + .5 * d * Math.cos(a), y: .5 + .5 * d * Math.sin(a), ph: rnd(0, 6), s: rnd(.6, 2), r: rnd(.7, 1.8) } : { x: Math.random(), y: Math.random(), ph: rnd(0, 6), s: rnd(.6, 2), r: rnd(.7, 1.8) }; }), o.shoot = null, o.nextShoot = 0;
    if (f.t === 'fog') o.p = Array.from({ length: 7 }, function () { return { x: rnd(-.2, 1.2), y: rnd(.1, .9), r: rnd(.3, .5), v: rnd(.006, .016) * (Math.random() < .5 ? -1 : 1) }; });
    if (f.t === 'shimmer') o.p = Array.from({ length: 16 }, function () { return { x: Math.random(), y: Math.random(), ph: rnd(0, 6), w: rnd(5, 12) }; });
    if (f.t === 'lightning') o.next = performance.now() + rnd(1500, 3500), o.at = -1e9;
    if (f.t === 'birds') o.next = performance.now() + rnd(1500, 4000), o.at = -1e9, o.fl = [];
    if (f.t === 'sand') o.p = Array.from({ length: 10 }, function () { return { y: Math.random() }; });
    if (f.t === 'sparkle' || f.t === 'blink' || f.t === 'bulbs') o.ph = f.pts.map(function () { return rnd(0, 6); }), o.sp = f.pts.map(function () { return rnd(.6, 1.6); });
    if (f.t === 'nightstars') o.p = Array.from({ length: f.n || 14 }, function () { return { x: Math.random(), y: Math.random() * .7, ph: rnd(0, 6), s: rnd(.5, 1.6) }; });
    return o;
  };
  P.flick = function (amt, ph, t) { return 1 - amt * (.5 + .25 * Math.sin(t / 97 + ph) + .15 * Math.sin(t / 41 + ph * 2) + .1 * Math.sin(t / 233 + ph * 3)); };
  /* Alev: yumuşak hale + damla biçimli alev (beyaz çekirdek, sarı, turuncu kenar, mavi dip) */
  P.drawFlame = function (x, y, s, k, t, ph) {
    var ctx = this.ctx, fl = this.flick(.35, ph, t), R = s * 6.5 * (.6 + .4 * k);
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createRadialGradient(x, y - s * .6, 0, x, y - s * .6, R);
    g.addColorStop(0, 'rgba(255,190,110,' + (.5 * k * fl) + ')'); g.addColorStop(.35, 'rgba(255,150,70,' + (.18 * k * fl) + ')'); g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g; ctx.fillRect(x - R, y - s * .6 - R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
    var h = s * 2.3 * (.85 + .2 * fl), w = s * .62, sw = Math.sin(t / 170 + ph) * s * .22 + Math.sin(t / 61 + ph) * s * .06;
    ctx.save(); ctx.globalAlpha = .35 + .65 * k;
    ctx.beginPath(); ctx.moveTo(x, y + s * .18); ctx.bezierCurveTo(x - w * 1.25, y - h * .15, x - w * .35 + sw, y - h * .7, x + sw * 1.4, y - h);
    ctx.bezierCurveTo(x + w * .35 + sw, y - h * .7, x + w * 1.25, y - h * .15, x, y + s * .18);
    var fg = ctx.createLinearGradient(x, y - h, x, y + s * .2);
    fg.addColorStop(0, 'rgba(255,170,60,.85)'); fg.addColorStop(.35, 'rgba(255,215,120,.97)'); fg.addColorStop(.75, 'rgba(255,248,225,1)'); fg.addColorStop(.92, 'rgba(255,200,120,.9)'); fg.addColorStop(1, 'rgba(110,140,255,.7)');
    ctx.fillStyle = fg; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + sw * .5, y - h * .3, w * .32, h * .22, 0, 0, 7); ctx.fillStyle = 'rgba(255,255,245,.9)'; ctx.fill();
    ctx.restore();
  };
  /* Bizim mumumuz: pirinç tabak, krem gövde, erimiş tepe, fitil */
  P.drawCandle = function (bx, by, s, k, t, ph) {
    var ctx = this.ctx, w = s * 1.05, h = s * 3.1, top = by - h;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(bx, by + s * .25, s * 1.9, s * .42, 0, 0, 7); ctx.fill();
    var pg = ctx.createLinearGradient(bx - s * 1.7, 0, bx + s * 1.7, 0); pg.addColorStop(0, '#7a5422'); pg.addColorStop(.4, '#e7b85e'); pg.addColorStop(.6, '#f6d791'); pg.addColorStop(1, '#8a6128');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(bx, by, s * 1.7, s * .42, 0, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(50,30,10,.8)'; ctx.lineWidth = .8; ctx.stroke();
    var cg = ctx.createLinearGradient(bx - w / 2, 0, bx + w / 2, 0); cg.addColorStop(0, '#cdbb99'); cg.addColorStop(.45, '#fbf2dc'); cg.addColorStop(1, '#b9a47f');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.moveTo(bx - w / 2, by - s * .05); ctx.lineTo(bx - w / 2, top); ctx.quadraticCurveTo(bx, top - s * .28, bx + w / 2, top); ctx.lineTo(bx + w / 2, by - s * .05); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,20,.75)'; ctx.lineWidth = .9; ctx.stroke();
    ctx.fillStyle = 'rgba(255,245,220,.9)'; ctx.beginPath(); ctx.moveTo(bx + w * .12, top + s * .05); ctx.quadraticCurveTo(bx + w * .26, top + s * .9, bx + w * .2, top + s * 1.15); ctx.quadraticCurveTo(bx + w * .05, top + s * .6, bx + w * .12, top + s * .05); ctx.fill();
    if (k > .05) { var g = ctx.createRadialGradient(bx, top, 0, bx, top, w); g.addColorStop(0, 'rgba(255,200,120,' + .6 * k + ')'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(bx - w, top - w, w * 2, w * 2); }
    ctx.strokeStyle = '#2a1a0c'; ctx.lineWidth = Math.max(1, s * .14); ctx.beginPath(); ctx.moveTo(bx, top - s * .1); ctx.lineTo(bx + s * .05, top - s * .5); ctx.stroke();
    ctx.restore();
    if (k > .05) this.drawFlame(bx + s * .05, top - s * .42, s * .95, k, t, ph);
  };
  P.loop = function (t) {
    if (!this.on) return;
    var ctx = this.ctx, self = this, tod = this.tod;
    if (Math.abs(this.box.offsetWidth - this.W) > 1 || Math.abs(this.box.offsetHeight - this.H) > 1) this.size();
    var W = this.W, H = this.H;
    var X = this.X.bind(this), Y = this.Y.bind(this), LX = this.Lx.bind(this), LY = this.Ly.bind(this);
    var lampK = tod === 'g' ? .3 : tod === 'a' ? .8 : 1, candleK = tod === 'g' ? 0 : tod === 'a' ? .85 : 1;
    var S = this.spec.sprite, sdx = S ? Math.sin(t / 1000 * 6.2832 / (S.T || 18)) * (S.ax || 2) : 0, sdy = S ? Math.sin(t / 1000 * 6.2832 / 3.3) * (S.ay || 0) : 0;
    // şimşek
    var fl = 0; this.parts.forEach(function (f) { if (f.t !== 'lightning') return; if (t > f.next) { f.at = t; f.next = t + rnd(5500, 10000); } var e = t - f.at; if (e < 90) fl = .9; else if (e < 170) fl = .08; else if (e < 290) fl = .65; else if (e < 950) fl = .65 * Math.pow(1 - (e - 290) / 660, 2); });
    if (this.gl) {
      var gl = this.gl, u = this.u, LP = [], LC = [], am = AMB[tod], wn = WIN[tod];
      this.lights.forEach(function (o) { var l = o.l; if (l.tod === 'an' && tod === 'g') return; if (l.tod === 'n' && tod !== 'n') return; if (l.tod === 'a' && tod !== 'a') return;
        var k = l.kind === 'candle' ? candleK : l.kind === 'lamp' ? lampK : 1, i = (l.i || 1) * k * self.flick(l.fl || 0, o.ph, t);
        if (l.neon) { var kk = (t / 1000 + o.ph) % 6; if (kk > 5 && kk < 5.15 || kk > 5.3 && kk < 5.4) i *= .1; }
        if (i <= 0) return; var c = typeof l.c === 'string' ? COL[l.c] : (l.c || COL.warm);
        LP.push(l.p[0] / 100 + (l.ship ? sdx / 100 : 0), l.p[1] / 100, (l.r || 20) / 100, i); LC.push(c[0], c[1], c[2]); });
      var nl = Math.min(16, LP.length / 4); while (LP.length < 64) { LP.push(0, 0, 1, 0); LC.push(0, 0, 0); }
      gl.uniform4fv(u.LP, LP); gl.uniform3fv(u.LC, LC); gl.uniform1i(u.nl, nl);
      gl.uniform3f(u.amb, am[0], am[1], am[2]); gl.uniform3f(u.wcol, wn[0][0], wn[0][1], wn[0][2]); gl.uniform1f(u.wmix, wn[1]);
      gl.uniform1f(u.flash, fl); gl.uniform1f(u.t, t / 1000); gl.uniform1f(u.asp, this.asp);
      gl.uniform2f(u.sc, this.sc[0], this.sc[1]); gl.uniform2f(u.of, this.of[0], this.of[1]); gl.uniform2f(u.SO, sdx / 100, sdy / 100);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    ctx.clearRect(0, 0, W, H);
    var dm = tod === 'g' ? 1 : tod === 'a' ? .7 : .35;
    this.parts.forEach(function (f, fi) {
      if (f.on === 'an' && tod === 'g') return; if (f.on === 'n' && tod !== 'n') return; if (f.on === 'g' && tod !== 'g') return;
      ctx.save();
      if (f.t === 'dust') { ctx.globalCompositeOperation = 'lighter'; var R = f.r; f.p.forEach(function (p) { p.y -= .0005 * p.s; p.x += Math.sin(t / 1800 + p.ph) * .0007; if (p.y < 0) { p.y = 1; p.x = Math.random(); } var a = (.45 + .35 * Math.sin(t / 700 * p.s + p.ph)) * dm; if (a <= 0) return; ctx.fillStyle = 'rgba(255,238,205,' + a + ')'; ctx.beginPath(); ctx.arc(X(R[0] + R[2] * p.x), Y(R[1] + R[3] * p.y), p.r, 0, 7); ctx.fill(); }); }
      if (f.t === 'glass') { var g0 = f.r; ctx.beginPath(); ctx.rect(X(g0[0]), Y(g0[1]), LX(g0[2]), LY(g0[3])); ctx.clip(); f.p.forEach(function (p) { if (p.wait > 0) p.wait -= 16; else p.y += .0025 * p.v; if (p.y > 1) { p.y = 0; p.x = Math.random(); p.wait = rnd(200, 2500); } var px = X(g0[0] + g0[2] * p.x), py = Y(g0[1] + g0[3] * p.y); var tr = ctx.createLinearGradient(px, py - 14, px, py); tr.addColorStop(0, 'rgba(210,225,255,0)'); tr.addColorStop(1, 'rgba(210,225,255,.5)'); ctx.strokeStyle = tr; ctx.lineWidth = p.r * .8; ctx.beginPath(); ctx.moveTo(px, py - 14 * (p.wait > 0 ? .2 : 1)); ctx.lineTo(px, py); ctx.stroke(); ctx.fillStyle = 'rgba(235,242,255,.8)'; ctx.beginPath(); ctx.arc(px, py, p.r, 0, 7); ctx.fill(); }); }
      if (f.t === 'steam') { var x = X(f.p[0]), y = Y(f.p[1]), k = (f.s || 1) * W / 390; for (var i = 0; i < 9; i++) { var q = ((t / 3200) + i / 9) % 1, px = x + Math.sin(t / 650 + i * 1.7) * 9 * q * k, py = y - q * H * .085 * (f.s || 1), rad = (4 + q * 18) * k; var g = ctx.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, 'rgba(255,255,255,' + (.42 * (1 - q) * Math.min(1, q * 6)) * (tod === 'n' ? .55 : 1) + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rad, 0, 7); ctx.fill(); } }
      if (f.t === 'flame') self.drawFlame(X(f.p[0]), Y(f.p[1]), LX(f.s || 1), f.always ? 1 : Math.max(.35, lampK), t, fi);
      if (f.t === 'candle') { if (candleK > 0) self.drawCandle(X(f.b[0]), Y(f.b[1]), LX(f.s || 1.3), candleK, t, fi); }
      if (f.t === 'sun') { if (tod === 'n') { ctx.restore(); return; } ctx.globalCompositeOperation = 'lighter'; var s0 = f.r, a0 = (.12 + .08 * Math.sin(t / 2200)) * (tod === 'a' ? .5 : 1), c0 = tod === 'a' ? '255,170,110' : (f.c || '255,230,170'), cx = X(s0[0] + s0[2] / 2), cy = Y(s0[1] + s0[3] / 2), RR = Math.max(LX(s0[2]), LY(s0[3])) * .85; var sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, RR); sg.addColorStop(0, 'rgba(' + c0 + ',' + a0 + ')'); sg.addColorStop(1, 'rgba(' + c0 + ',0)'); ctx.fillStyle = sg; ctx.fillRect(cx - RR, cy - RR, RR * 2, RR * 2); }
      if (f.t === 'fog') { var fr = f.r; f.p.forEach(function (p) { p.x += p.v * .03; if (p.x > 1.4) p.x = -.4; if (p.x < -.4) p.x = 1.4; var px = X(fr[0] + fr[2] * p.x), py = Y(fr[1] + fr[3] * p.y), R2 = LX(p.r * fr[2]); var g = ctx.createRadialGradient(px, py, 0, px, py, R2); g.addColorStop(0, 'rgba(225,232,240,' + (tod === 'n' ? .14 : .26) + ')'); g.addColorStop(1, 'rgba(225,232,240,0)'); ctx.fillStyle = g; ctx.fillRect(px - R2, py - R2, R2 * 2, R2 * 2); }); }
      if (f.t === 'shimmer') { ctx.globalCompositeOperation = 'lighter'; var sr = f.r; f.p.forEach(function (p) { var a2 = Math.max(0, Math.sin(t / 450 + p.ph)) * .7 * (tod === 'n' ? .35 : 1); ctx.fillStyle = 'rgba(255,250,230,' + a2 + ')'; ctx.fillRect(X(sr[0] + sr[2] * p.x), Y(sr[1] + sr[3] * p.y), p.w, 1.4); p.x += .0006; if (p.x > 1) p.x = 0; }); }
      if (f.t === 'stars' || f.t === 'nightstars') { if (f.t === 'nightstars' && tod !== 'n') { ctx.restore(); return; } ctx.globalCompositeOperation = 'lighter'; var bx, by, bw, bh; if (f.round) { bx = X(f.c[0]) - LX(f.rr); by = Y(f.c[1]) - LX(f.rr); bw = bh = LX(f.rr) * 2; } else { bx = X(f.r[0]); by = Y(f.r[1]); bw = LX(f.r[2]); bh = LY(f.r[3]); }
        f.p.forEach(function (p) { var a3 = .3 + .7 * Math.max(0, Math.sin(t / 550 * p.s + p.ph)); ctx.fillStyle = 'rgba(255,255,240,' + a3 + ')'; ctx.beginPath(); ctx.arc(bx + bw * p.x, by + bh * p.y, p.r || 1, 0, 7); ctx.fill(); });
        if (f.t === 'stars') { if (!f.shoot && t > f.nextShoot) { f.shoot = { x: rnd(.15, .55), y: rnd(.1, .45), t: t }; var ev = f.every || [3500, 7000]; f.nextShoot = t + rnd(ev[0], ev[1]); }
          if (f.shoot) { var e2 = (t - f.shoot.t) / 1000; if (e2 > 1) f.shoot = null; else { var sx = bx + bw * (f.shoot.x + e2 * .4), sy = by + bh * (f.shoot.y + e2 * .3), lg = ctx.createLinearGradient(sx, sy, sx - bw * .16, sy - bh * .12); lg.addColorStop(0, 'rgba(255,255,255,' + (1 - e2) + ')'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - bw * .16, sy - bh * .12); ctx.stroke(); } } } }
      if (f.t === 'sparkle' || f.t === 'blink' || f.t === 'bulbs') { ctx.globalCompositeOperation = 'lighter'; f.pts.forEach(function (q, i) { var s1 = .5 + .5 * Math.sin(t / 650 * f.sp[i] + f.ph[i]), px = X(q[0]), py = Y(q[1]);
          if (f.t === 'bulbs') { var R3 = LX(2.2) * (tod === 'g' ? .8 : 1.3), a4 = (tod === 'g' ? .35 : .7) * (.6 + .4 * s1); var g = ctx.createRadialGradient(px, py, 0, px, py, R3); g.addColorStop(0, 'rgba(255,240,200,' + a4 + ')'); g.addColorStop(.3, 'rgba(255,190,100,' + a4 * .6 + ')'); g.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = g; ctx.fillRect(px - R3, py - R3, R3 * 2, R3 * 2); }
          else if (f.t === 'blink') { ctx.fillStyle = 'rgba(' + (f.c || '120,255,230') + ',' + (s1 > .6 ? .95 : .15) + ')'; ctx.beginPath(); ctx.arc(px, py, 2.2, 0, 7); ctx.fill(); }
          else { var L2 = 7 + 9 * s1; ctx.strokeStyle = 'rgba(255,245,200,' + (.35 + .6 * s1) + ')'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(px - L2, py); ctx.lineTo(px + L2, py); ctx.moveTo(px, py - L2); ctx.lineTo(px, py + L2); ctx.stroke(); } }); }
      if (f.t === 'portholes') { if (tod === 'g') { ctx.restore(); return; } ctx.beginPath(); S.glass.forEach(function (r) { ctx.rect(X(r[0]), Y(r[1]), LX(r[2]), LY(r[3])); }); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
        f.pts.forEach(function (q, i) { var px = X(q[0] + sdx), py = Y(q[1] + sdy), R4 = LX(1.6), a5 = (tod === 'a' ? .55 : .95) * (.85 + .15 * Math.sin(t / 400 + i)); var g = ctx.createRadialGradient(px, py, 0, px, py, R4); g.addColorStop(0, 'rgba(255,225,150,' + a5 + ')'); g.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = g; ctx.fillRect(px - R4, py - R4, R4 * 2, R4 * 2); }); }
      if (f.t === 'sand') { var sx2 = X(f.p[0]), sy2 = Y(f.p[1]), hh = LY(f.h || 1.2); ctx.fillStyle = 'rgba(240,200,120,.9)'; f.p.forEach(function (p) { p.y += .02; if (p.y > 1) p.y = 0; ctx.fillRect(sx2 - .6, sy2 + hh * p.y, 1.3, 1.3); }); }
      if (f.t === 'birds') { if (tod === 'n') { ctx.restore(); return; } var br = f.r; ctx.beginPath(); ctx.rect(X(br[0]), Y(br[1]), LX(br[2]), LY(br[3])); ctx.clip(); if (t > f.next) { f.at = t; f.next = t + rnd(8500, 11500); f.fl = Array.from({ length: 2 + (Math.random() * 3 | 0) }, function () { return { dx: rnd(-.1, .1), dy: rnd(-.12, .12), ph: rnd(0, 6), s: rnd(.8, 1.2) }; }); }
        var e3 = (t - f.at) / 5200; if (e3 >= 0 && e3 <= 1) { ctx.strokeStyle = 'rgba(60,35,40,.85)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; f.fl.forEach(function (b) { var bx2 = X(br[0] + br[2] * (1.1 - e3 * 1.3 + b.dx)), by2 = Y(br[1] + br[3] * (.45 + b.dy - e3 * .15 + .03 * Math.sin(e3 * 9 + b.ph))), wv = Math.sin(t / 110 + b.ph), sz = 4.5 * b.s * W / 390; ctx.beginPath(); ctx.moveTo(bx2 - sz, by2 - sz * .6 * wv); ctx.quadraticCurveTo(bx2 - sz * .4, by2 - sz * .2, bx2, by2); ctx.quadraticCurveTo(bx2 + sz * .4, by2 - sz * .2, bx2 + sz, by2 - sz * .6 * wv); ctx.stroke(); }); } }
      ctx.restore();
    });
    requestAnimationFrame(this.loop);
  };
  window.RoomFX = RoomFX;
})();
