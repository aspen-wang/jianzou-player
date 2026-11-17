import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A wall-mounted acrylic turntable. One unit is 100 px of the reference
// photograph, the origin is the centre of the acrylic plate and the wall is the
// plane z = 0. Every control is a part of the machine: keys on the motor block,
// the tonearm for seeking, the lamp for the pinned window.
const PLATE = { w: 6.57, h: 5.13, corner: 0.16, thick: 0.12, back: 0.9 };
const TOP = PLATE.back + PLATE.thick;
const RECORD = { x: -0.585, y: 0, r: 2.5, z: TOP + 0.13 };
const LABEL = 1.02;
const PIVOT = { x: -2.735, y: -2.165 };
const ARM = { length: 2.02, z: RECORD.z + 0.13, lift: 0.075 };
// Stylus radii: lead-in groove, run-out groove, and parked beside the record.
const GROOVE = { outer: 2.36, inner: 1.14, rest: 2.56 };
const BLOCK = { x: 2.58, y: 1.215, w: 1.02, h: 2.05, d: 0.48 };
const KEY = { d: 0.06, travel: 0.032, sunk: 0.024 };
const ROLLER = { x0: 1.5, x1: 2.0, y: 0.815, r: 0.19, z: RECORD.z + 0.21 };
const LAMP = { x0: -2.72, x1: -2.17, y: 2.235, r: 0.235 };
const PIN = { x: -2.02, y: 2.235, w: 0.3, h: 0.47, d: 0.42 };
const POSTS = [[-2.885, 2.165, 0.14], [-3.13, -2.41, 0.085], [3.13, -2.41, 0.085], [3.13, 2.41, 0.085]];
const CABLE = [[2.68, 0.34, 1.27], [2.68, 0, 1.27], [2.7, -0.7, 1.24], [2.8, -1.7, 1.16], [2.9, -2.7, 0.95], [2.96, -3.9, 0.55], [3, -5.6, 0.38], [3.02, -9.5, 0.34]];
// The light sits above and to the left: wall shadows shift by this much per
// unit of height, which is what throws the pool of record colour below the plate.
const LIGHT = { x: 0.36, y: -0.9 };
const FRAME = { w: 8.5, h: 7 };
const TILT = { x: -0.2, y: 0.11 };
const SPIN = (2 * Math.PI) / 1.8; // 33⅓ rpm
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif';
const DENSITY = 420; // canvas pixels per unit for printed faces
const INK = { title: '#171717', artist: '#4d4d4d', time: '#696969', error: '#9a3b29' };
const ENGRAVED = { on: '#f2f2f0', idle: '#b0b0b0', off: '#6e6e6e' };
const DEFAULT_TINT = { h: 0.148, s: 0.72, l: 0.6 };

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const reach = Math.hypot(RECORD.x - PIVOT.x, RECORD.y - PIVOT.y);
const toCentre = Math.atan2(RECORD.y - PIVOT.y, RECORD.x - PIVOT.x);
const angleAtRadius = (radius) => toCentre + Math.acos((reach * reach + ARM.length * ARM.length - radius * radius) / (2 * reach * ARM.length));
const radiusAtAngle = (angle) => Math.sqrt(reach * reach + ARM.length * ARM.length - 2 * reach * ARM.length * Math.cos(angle - toCentre));
const ANGLE = { start: angleAtRadius(GROOVE.outer), end: angleAtRadius(GROOVE.inner), rest: angleAtRadius(GROOVE.rest) };
const angleAtProgress = (progress) => angleAtRadius(GROOVE.outer + (GROOVE.inner - GROOVE.outer) * clamp(progress, 0, 1));
const progressAtAngle = (angle) => clamp((GROOVE.outer - radiusAtAngle(clamp(angle, ANGLE.end, ANGLE.start))) / (GROOVE.outer - GROOVE.inner), 0, 1);

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3600), minutes = Math.floor((value % 3600) / 60), rest = String(value % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

function blank(width, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

// Everything that blocks or colours the light is drawn once, displaced by its
// height, so the wall carries soft shadows without a shadow-map pass.
function shadeCanvas(cable) {
  const size = 1024, left = -5.2, top = 4, span = 12.4, k = size / span;
  const canvas = blank(size), g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
  const X = (x, z) => (x + LIGHT.x * z - left) * k;
  const Y = (y, z) => (top - (y + LIGHT.y * z)) * k;
  // A caster is swept from its lowest to its highest point so a tall part
  // throws one connected shadow instead of a stack of overlapping ones.
  const cast = (alpha, blur, from, to, outline) => {
    g.save(); g.filter = `blur(${blur * k}px)`; g.fillStyle = `rgba(0,0,0,${alpha})`; g.beginPath();
    const steps = Math.max(1, Math.ceil((to - from) / 0.05));
    for (let i = 0; i <= steps; i++) outline(from + ((to - from) * i) / steps);
    g.fill(); g.restore();
  };
  const rect = (cx, cy, w, h) => (z) => g.rect(X(cx - w / 2, z), Y(cy + h / 2, z), w * k, h * k);
  const disc = (cx, cy, r) => (z) => { g.moveTo(X(cx, z) + r * k, Y(cy, z)); g.arc(X(cx, z), Y(cy, z), r * k, 0, Math.PI * 2); };
  const plate = (z) => g.roundRect(X(-PLATE.w / 2, z), Y(PLATE.h / 2, z), PLATE.w * k, PLATE.h * k, PLATE.corner * k);

  cast(0.13, 0.34, TOP, TOP, plate);
  // Clear acrylic barely shades the wall, but its edges do.
  g.save(); g.filter = `blur(${0.09 * k}px)`; g.strokeStyle = 'rgba(0,0,0,.34)'; g.lineWidth = 0.07 * k;
  g.beginPath(); plate(TOP - PLATE.thick / 2); g.stroke(); g.restore();
  cast(0.58, 0.24, TOP, TOP + BLOCK.d + KEY.d, rect(BLOCK.x, BLOCK.y, BLOCK.w, BLOCK.h));
  cast(0.5, 0.2, ROLLER.z - ROLLER.r, ROLLER.z + ROLLER.r, rect((ROLLER.x0 + BLOCK.x) / 2, ROLLER.y, BLOCK.x - ROLLER.x0, ROLLER.r * 1.7));
  cast(0.54, 0.2, TOP, TOP + PIN.d, rect(PIN.x, PIN.y, PIN.w, PIN.h));
  cast(0.16, 0.16, TOP, TOP + LAMP.r * 2, rect((LAMP.x0 + LAMP.x1) / 2, LAMP.y, LAMP.x1 - LAMP.x0, LAMP.r * 1.6));
  cast(0.5, 0.26, RECORD.z, RECORD.z, disc(RECORD.x, RECORD.y, LABEL));
  cast(0.22, 0.4, TOP, ARM.z + 0.1, disc(PIVOT.x, PIVOT.y, 0.21));
  for (const [x, y, cap] of POSTS) {
    cast(0.3, 0.1, 0, PLATE.back, disc(x, y, 0.055));
    cast(0.45, 0.16, TOP, TOP + 0.05, disc(x, y, cap));
  }
  g.save(); g.filter = `blur(${0.17 * k}px)`; g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath();
  for (const point of cable) { g.moveTo(X(point.x, point.z) + 0.085 * k, Y(point.y, point.z)); g.arc(X(point.x, point.z), Y(point.y, point.z), 0.085 * k, 0, Math.PI * 2); }
  g.fill(); g.restore();
  return { canvas, rect: new THREE.Vector4(left, top - span, span, span) };
}

// The tonearm moves, so its shadow is a strip the wall shader rotates with it.
function armShadeCanvas() {
  const k = 128, left = -0.7, width = 3, height = 0.75;
  const canvas = blank(width * k, height * k), g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  const x = (value) => (value - left) * k, mid = canvas.height / 2;
  g.filter = `blur(${0.16 * k}px)`; g.fillStyle = g.strokeStyle = 'rgba(0,0,0,.27)';
  g.lineWidth = 0.055 * k; g.beginPath(); g.moveTo(x(-0.3), mid); g.lineTo(x(1.9), mid); g.stroke();
  g.fillRect(x(-0.5), mid - 0.115 * k, 0.26 * k, 0.23 * k);
  g.fillRect(x(-0.17), mid - 0.13 * k, 0.34 * k, 0.26 * k);
  g.fillRect(x(1.84), mid - 0.075 * k, 0.3 * k, 0.15 * k);
  return { canvas, rect: new THREE.Vector4(left, -height / 2, width, height) };
}

// Light that has passed through the record: strongest behind the tinted band.
function poolCanvas() {
  const size = 256, span = 6.4, canvas = blank(size), g = canvas.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, size, size);
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const stop = (radius, value) => gradient.addColorStop(clamp(radius / (span / 2), 0, 1), `rgb(${value},${value},${value})`);
  stop(0, 150); stop(1.0, 170); stop(1.25, 235); stop(1.85, 235); stop(2.15, 60); stop(2.5, 22); stop(2.9, 0);
  g.fillStyle = gradient; g.fillRect(0, 0, size, size);
  const x = RECORD.x + LIGHT.x * RECORD.z - span / 2, y = RECORD.y + LIGHT.y * RECORD.z - span / 2;
  return { canvas, rect: new THREE.Vector4(x, y, span, span) };
}

function roundedRect(w, h, r) {
  const shape = new THREE.Shape(), x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y); shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r); shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h); shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r); shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

// Ridges run along the axis so the roller's rotation is visible.
function knurled(radius, length, ridges) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, ridges * 2, 1, true).toNonIndexed();
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const index = Math.round(Math.atan2(position.getZ(i), position.getX(i)) / (Math.PI / ridges));
    if (index % 2 !== 0) { position.setX(i, position.getX(i) * 0.93); position.setZ(i, position.getZ(i) * 0.93); }
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Grooves scatter light across their width, so a record's highlight stretches
// along the radius. The map hands that radial direction to the material.
function radialAnisotropy() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - size / 2, dy = y + 0.5 - size / 2, length = Math.hypot(dx, dy) || 1, i = (y * size + x) * 4;
    pixels[i] = Math.round((dx / length * 0.5 + 0.5) * 255); pixels[i + 1] = Math.round((dy / length * 0.5 + 0.5) * 255);
    pixels[i + 2] = 255; pixels[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}

// The tinted band of the pressing; the colour itself comes from the material.
function tintMaskCanvas() {
  const size = 512, canvas = blank(size), g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, alpha] of [[0, 0.8], [0.4, 0.8], [0.43, 0.72], [0.7, 0.8], [0.772, 0.78], [0.792, 0.07], [1, 0.05]]) gradient.addColorStop(at, `rgba(255,255,255,${alpha})`);
  g.fillStyle = gradient; g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fill();
  return canvas;
}

// Clear vinyl: a faint body, the groove bands of each track and a bright rim.
function grooveCanvas() {
  const size = 1024, c = size / 2, canvas = blank(size), g = canvas.getContext('2d');
  const body = g.createRadialGradient(c, c, 0, c, c, c);
  body.addColorStop(0, 'rgba(214,214,214,0)'); body.addColorStop(0.77, 'rgba(214,214,214,0)');
  body.addColorStop(0.81, 'rgba(214,214,214,.13)'); body.addColorStop(0.97, 'rgba(220,220,220,.16)'); body.addColorStop(1, 'rgba(240,240,240,.3)');
  g.fillStyle = body; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
  const gaps = [0.5, 0.585, 0.66, 0.735, 0.84, 0.915];
  for (let r = 0.435, i = 0; r < 0.972; r += 0.0046, i++) {
    if (gaps.some((gap) => Math.abs(gap - r) < 0.006)) continue;
    g.beginPath(); g.arc(c, c, r * c, 0, Math.PI * 2); g.lineWidth = 1;
    g.strokeStyle = i % 2 ? 'rgba(255,255,255,.11)' : 'rgba(24,24,24,.055)'; g.stroke();
  }
  for (const gap of gaps) {
    g.beginPath(); g.arc(c, c, gap * c, 0, Math.PI * 2); g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,255,255,.2)'; g.stroke();
  }
  g.beginPath(); g.arc(c, c, 0.993 * c, 0, Math.PI * 2); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.6)'; g.stroke();
  g.beginPath(); g.arc(c, c, 0.982 * c, 0, Math.PI * 2); g.lineWidth = 1.5; g.strokeStyle = 'rgba(30,30,30,.1)'; g.stroke();
  return canvas;
}

// The dominant colour of the artwork, grouped by hue so a busy photograph still
// yields one stable colour, and clamped so the pressing stays legible.
function artworkTint(image) {
  const sample = blank(48), g = sample.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, 48, 48);
  const pixels = g.getImageData(0, 0, 48, 48).data, bins = new Map();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 96) continue;
    const r = pixels[i] / 255, gr = pixels[i + 1] / 255, b = pixels[i + 2] / 255;
    const high = Math.max(r, gr, b), low = Math.min(r, gr, b), delta = high - low, light = (high + low) / 2;
    if (light < 0.1 || (light > 0.94 && delta < 0.12)) continue;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * light - 1));
    let hue = 0;
    if (delta) {
      if (high === r) hue = ((gr - b) / delta) % 6; else if (high === gr) hue = (b - r) / delta + 2; else hue = (r - gr) / delta + 4;
      hue = (hue / 6 + 1) % 1;
    }
    const key = saturation < 0.13 ? 'neutral' : Math.floor(hue * 24);
    const weight = (0.35 + 0.65 * saturation) * (0.65 + 0.35 * (1 - Math.abs(light - 0.5) * 2));
    const bin = bins.get(key) || { weight: 0, x: 0, y: 0, s: 0, l: 0, neutral: key === 'neutral' };
    bin.weight += weight; bin.x += Math.cos(hue * 2 * Math.PI) * weight; bin.y += Math.sin(hue * 2 * Math.PI) * weight;
    bin.s += saturation * weight; bin.l += light * weight; bins.set(key, bin);
  }
  let best = null;
  for (const bin of bins.values()) if (!best || bin.weight > best.weight) best = bin;
  if (!best) return DEFAULT_TINT;
  return {
    h: (Math.atan2(best.y, best.x) / (2 * Math.PI) + 1) % 1,
    s: best.neutral ? 0 : clamp(best.s / best.weight, 0.16, 0.76),
    l: clamp(best.l / best.weight, 0.49, 0.67)
  };
}

function build(canvas, fail) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.transmissionResolutionScale = 0.5;
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); fail(); });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 4, 90);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  pmrem.dispose();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();

  // The wall and the machine share one rig so the view can lean without the
  // shadows sliding off the surface they fall on.
  const rig = new THREE.Group(); rig.position.set(-0.15, -0.05, 0); scene.add(rig);
  const deck = new THREE.Group(); rig.add(deck);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-LIGHT.x * 10, -LIGHT.y * 10, 10);
  rig.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 0.35));

  const standard = (color, roughness, metalness = 0, envMapIntensity = 1) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: env, envMapIntensity });
  const body = new THREE.MeshPhysicalMaterial({ color: 0x101010, roughness: 0.6, clearcoat: 0.1, clearcoatRoughness: 0.55, envMap: env, envMapIntensity: 0.3 });
  const keycap = () => new THREE.MeshPhysicalMaterial({ color: 0x171717, roughness: 0.44, clearcoat: 0.4, clearcoatRoughness: 0.3, envMap: env, envMapIntensity: 0.5 });
  const graphite = standard(0x2b2b2b, 0.42, 0.55);
  const steel = standard(0x8b8b8b, 0.45, 0.35, 0.22);
  const brass = standard(0xcaa654, 0.25, 1, 1.15);
  const rubber = standard(0x141414, 0.82, 0, 0.5);
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transmission: 1, thickness: 0.14, ior: 1.49, attenuationColor: new THREE.Color(0xc6c6c6), attenuationDistance: 0.8, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.16 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.4, ior: 1.52, envMap: env, envMapIntensity: 0.8, emissiveIntensity: 0 });

  function box(w, h, d, material, x, y, z, radius = 0.035, parent = deck) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(radius, w / 2, h / 2, d / 2)), material);
    mesh.position.set(x, y, z + d / 2); parent.add(mesh);
    return mesh;
  }
  // Upright cylinders stand on z; a cylinder lying along x is placed by its centre.
  function cylinder(radius, length, material, x, y, z, parent = deck, axis = 'z', segments = 64) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
    if (axis === 'z') { mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, z + length / 2); }
    else { mesh.rotation.z = Math.PI / 2; mesh.position.set(x, y, z); }
    parent.add(mesh);
    return mesh;
  }
  const dataTexture = (source) => { const texture = new THREE.CanvasTexture(source); texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter; return texture; };
  const colourTexture = (source) => { const texture = new THREE.CanvasTexture(source); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = anisotropy; return texture; };

  // ---- wall -------------------------------------------------------------
  const cablePath = new THREE.CatmullRomCurve3(CABLE.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const shade = shadeCanvas(cablePath.getPoints(110)), armShade = armShadeCanvas(), pool = poolCanvas();
  const wall = {
    near: { value: new THREE.Color(0xd2d2d2) }, mid: { value: new THREE.Color(0xb8b8b8) }, far: { value: new THREE.Color(0x8d8d8d) },
    shade: { value: dataTexture(shade.canvas) }, shadeRect: { value: shade.rect },
    pool: { value: dataTexture(pool.canvas) }, poolRect: { value: pool.rect }, poolColor: { value: new THREE.Color() },
    arm: { value: dataTexture(armShade.canvas) }, armRect: { value: armShade.rect }, armOrigin: { value: new THREE.Vector2() }, armAngle: { value: 0 },
    lamp: { value: new THREE.Vector3((LAMP.x0 + LAMP.x1) / 2 + LIGHT.x * 0.5, LAMP.y + LIGHT.y * 0.5, 0) }, lampColor: { value: new THREE.Color() }
  };
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShaderMaterial({
    uniforms: wall,
    vertexShader: 'varying vec2 vPlane; void main() { vPlane = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 near; uniform vec3 mid; uniform vec3 far;
      uniform sampler2D shade; uniform vec4 shadeRect;
      uniform sampler2D pool; uniform vec4 poolRect; uniform vec3 poolColor;
      uniform sampler2D arm; uniform vec4 armRect; uniform vec2 armOrigin; uniform float armAngle;
      uniform vec3 lamp; uniform vec3 lampColor;
      varying vec2 vPlane;
      float inside(vec2 uv) { vec2 s = step(vec2(0.0), uv) * step(uv, vec2(1.0)); return s.x * s.y; }
      void main() {
        float r = length(vPlane - vec2(0.3, 1.6));
        vec3 colour = mix(near, mid, smoothstep(0.0, 7.5, r));
        colour = mix(colour, far, smoothstep(5.0, 16.0, r));
        vec2 poolUv = (vPlane - poolRect.xy) / poolRect.zw;
        colour = mix(colour, poolColor, texture2D(pool, poolUv).r * inside(poolUv));
        vec2 lampOffset = vPlane - lamp.xy;
        colour += lampColor * lamp.z * exp(-dot(lampOffset, lampOffset) / 0.55);
        vec2 shadeUv = (vPlane - shadeRect.xy) / shadeRect.zw;
        colour *= mix(1.0, texture2D(shade, shadeUv).r, inside(shadeUv));
        vec2 d = vPlane - armOrigin; float c = cos(armAngle), s = sin(armAngle);
        vec2 armUv = (vec2(c * d.x + s * d.y, c * d.y - s * d.x) - armRect.xy) / armRect.zw;
        colour *= mix(1.0, texture2D(arm, armUv).r, inside(armUv));
        // Hide banding in the long gradient.
        colour += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  rig.add(wallMesh);

  // ---- acrylic plate and its standoffs ----------------------------------
  const bevel = 0.028;
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(PLATE.w - bevel * 2, PLATE.h - bevel * 2, PLATE.corner), {
    depth: PLATE.thick - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 24
  }), acrylic);
  plate.position.z = PLATE.back + bevel; deck.add(plate);
  for (const [x, y, cap] of POSTS) {
    cylinder(0.055, PLATE.back, steel, x, y, 0);
    cylinder(cap, 0.045, steel, x, y, TOP);
    cylinder(cap * 0.32, 0.05, graphite, x, y, TOP);
  }

  // ---- record -----------------------------------------------------------
  const record = new THREE.Group(); record.position.set(RECORD.x, RECORD.y, RECORD.z); deck.add(record);
  cylinder(0.42, RECORD.z - TOP, body, RECORD.x, RECORD.y, TOP);
  const disc = new THREE.CircleGeometry(RECORD.r, 160);
  const layer = (material, z, order) => { const mesh = new THREE.Mesh(disc, material); mesh.position.z = z; mesh.renderOrder = order; record.add(mesh); return mesh; };
  const vinylTint = new THREE.MeshBasicMaterial({ map: colourTexture(tintMaskCanvas()), transparent: true, depthWrite: false });
  layer(vinylTint, 0, 2);
  layer(new THREE.MeshBasicMaterial({ map: colourTexture(grooveCanvas()), transparent: true, depthWrite: false }), 0.001, 3);
  // Reflections are added on top so the clear rim shines as brightly as the tinted band.
  layer(new THREE.MeshPhysicalMaterial({
    color: 0x050505, metalness: 1, roughness: 0.24, anisotropy: 0.82, anisotropyMap: radialAnisotropy(),
    envMap: env, envMapIntensity: 1.1, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  }), 0.002, 4);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(RECORD.r, RECORD.r, 0.03, 160, 1, true), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false, envMap: env
  }));
  rim.rotation.x = Math.PI / 2; rim.position.z = -0.015; rim.renderOrder = 2; record.add(rim);

  const labelCanvas = blank(512), labelContext = labelCanvas.getContext('2d'), labelTexture = colourTexture(labelCanvas);
  const label = new THREE.Mesh(new THREE.CircleGeometry(LABEL, 128), new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.82, envMap: env, envMapIntensity: 0.5 }));
  label.position.z = 0.004; label.userData.action = 'label'; record.add(label);
  function plainLabel() {
    labelContext.fillStyle = '#2b2b2b'; labelContext.fillRect(0, 0, 512, 512);
    labelContext.strokeStyle = 'rgba(214,214,214,.12)'; labelContext.lineWidth = 2;
    for (const radius of [120, 150, 236]) { labelContext.beginPath(); labelContext.arc(256, 256, radius, 0, Math.PI * 2); labelContext.stroke(); }
    labelTexture.needsUpdate = true;
  }
  function artworkLabel(image) {
    const side = Math.min(image.width, image.height);
    labelContext.clearRect(0, 0, 512, 512);
    labelContext.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 512, 512);
    labelTexture.needsUpdate = true;
  }
  cylinder(0.21, 0.06, steel, 0, 0, 0.004, record);
  cylinder(0.055, 0.11, graphite, 0, 0, 0.004, record);

  // ---- tonearm ----------------------------------------------------------
  cylinder(0.21, 0.17, body, PIVOT.x, PIVOT.y, TOP);
  cylinder(0.085, ARM.z - TOP, graphite, PIVOT.x, PIVOT.y, TOP);
  const arm = new THREE.Group(); arm.position.set(PIVOT.x, PIVOT.y, ARM.z); deck.add(arm);
  cylinder(0.023, 2.2, graphite, 0.8, 0, 0, arm, 'x', 20);
  box(0.34, 0.26, 0.15, body, 0, 0, -0.075, 0.04, arm);
  cylinder(0.05, 0.02, steel, 0, 0, 0.075, arm, 'z', 24);
  cylinder(0.115, 0.26, body, -0.37, 0, 0, arm, 'x', 40);
  box(0.3, 0.15, 0.035, body, 1.99, 0, -0.02, 0.012, arm);
  box(0.2, 0.12, 0.085, graphite, 2.0, 0, -0.11, 0.02, arm);
  // The finger lift on the outer side is where a hand takes the arm.
  const fingerLift = cylinder(0.013, 0.11, steel, 2.09, 0.115, 0, arm, 'x', 12); fingerLift.rotation.z = 0;
  const armGrip = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.32, 0.3), new THREE.MeshBasicMaterial());
  armGrip.position.set(0.86, 0, 0); armGrip.visible = false; armGrip.userData.action = 'seek'; arm.add(armGrip);

  // ---- motor block, its keys and the drive roller ------------------------
  box(BLOCK.w, BLOCK.h, BLOCK.d, body, BLOCK.x, BLOCK.y, TOP, 0.045);
  const roller = new THREE.Group(); roller.position.set(0, ROLLER.y, ROLLER.z); deck.add(roller);
  const sleeve = new THREE.Mesh(knurled(ROLLER.r, ROLLER.x1 - ROLLER.x0 - 0.06, 20), brass);
  sleeve.rotation.z = Math.PI / 2; sleeve.position.x = (ROLLER.x0 + ROLLER.x1) / 2; roller.add(sleeve);
  cylinder(ROLLER.r + 0.008, 0.03, brass, ROLLER.x0 + 0.015, 0, 0, roller, 'x');
  cylinder(ROLLER.r + 0.008, 0.03, brass, ROLLER.x1 - 0.015, 0, 0, roller, 'x');
  cylinder(0.05, 0.012, graphite, ROLLER.x0 - 0.004, 0, 0, roller, 'x', 24);
  cylinder(0.06, BLOCK.x - BLOCK.w / 2 - ROLLER.x1 + 0.06, steel, (ROLLER.x1 + BLOCK.x - BLOCK.w / 2) / 2 + 0.03, 0, 0, roller, 'x', 24);

  const hits = [label, armGrip];
  const controls = {};
  function face(w, h, x, y, z, parent) {
    const source = blank(Math.round(w * DENSITY), Math.round(h * DENSITY)), texture = colourTexture(source);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.position.set(x, y, z); mesh.renderOrder = 6; parent.add(mesh);
    return { g: source.getContext('2d'), w: source.width, h: source.height, texture, mesh };
  }
  // A key is a cap that travels into the block, with its marking printed on top.
  function key(action, x, y, w, h, base = TOP + BLOCK.d, depth = KEY.d) {
    const group = new THREE.Group(); group.position.set(x, y, base); deck.add(group);
    const cap = box(w, h, depth, keycap(), 0, 0, 0, 0.022, group);
    cap.userData.action = action; hits.push(cap);
    controls[action] = { group, cap, base, face: face(w, h, 0, 0, depth + 0.002, group), travel: 0, held: false, sunk: false, mark: '' };
    return controls[action];
  }
  const keyWidth = BLOCK.w - 0.16;
  key('spotify', BLOCK.x, 1.985, keyWidth, 0.24);
  key('music', BLOCK.x, 1.705, keyWidth, 0.24);
  key('playPause', BLOCK.x, 1.235, keyWidth, 0.52);
  key('previous', BLOCK.x - 0.2225, 0.71, 0.415, 0.4);
  key('next', BLOCK.x + 0.2225, 0.71, 0.415, 0.4);

  // ---- lamp and the key that pins the window -----------------------------
  const tubeLength = LAMP.x1 - LAMP.x0, tubeX = (LAMP.x0 + LAMP.x1) / 2, tubeZ = TOP + LAMP.r;
  cylinder(LAMP.r, tubeLength, glass, tubeX, LAMP.y, tubeZ, deck, 'x', 64);
  cylinder(LAMP.r + 0.012, 0.035, graphite, LAMP.x0 + 0.0175, LAMP.y, tubeZ, deck, 'x', 64);
  // The element inside the rod: wall-coloured when dark so the glass stays clear.
  const elementDark = new THREE.Color(0xc6c6c6), elementLit = new THREE.Color();
  const element = new THREE.MeshBasicMaterial({ color: elementDark });
  cylinder(0.032, tubeLength - 0.07, element, tubeX + 0.01, LAMP.y, tubeZ, deck, 'x', 20);
  key('pin', PIN.x, PIN.y, PIN.w, PIN.h, TOP, PIN.d);

  // ---- cable ------------------------------------------------------------
  deck.add(new THREE.Mesh(new THREE.TubeGeometry(cablePath, 110, 0.085, 16, false), rubber));
  const relief = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 32), rubber);
  relief.position.set(CABLE[0][0], BLOCK.y - BLOCK.h / 2 - 0.08, CABLE[0][2]); deck.add(relief);

  // ---- printing ---------------------------------------------------------
  // Track details are printed on the acrylic where a maker's mark would sit.
  const lettering = face(2.46, 1.08, 1.33, -1.96, TOP + 0.004, deck);
  lettering.mesh.renderOrder = 1;
  const type = (weight, size) => `${weight} ${Math.round(size * DENSITY)}px ${FONT}`;
  function fitted(g, value, limit) {
    const text = String(value || '');
    if (g.measureText(text).width <= limit) return text;
    let low = 0, high = text.length;
    while (low < high) { const middle = (low + high + 1) >> 1; if (g.measureText(`${text.slice(0, middle)}…`).width <= limit) low = middle; else high = middle - 1; }
    return `${text.slice(0, low).trimEnd()}…`;
  }
  function wrapped(g, value, limit, most) {
    const lines = []; let line = '';
    for (const character of Array.from(String(value || ''))) {
      if (character !== '\n' && g.measureText(line + character).width <= limit) { line += character; continue; }
      lines.push(line); line = character === '\n' ? '' : character;
      if (lines.length === most) break;
    }
    if (line && lines.length < most) lines.push(line);
    return lines;
  }
  function mark(control, name, colour, size) {
    const signature = `${name}|${colour}`;
    if (control.mark === signature) return;
    control.mark = signature;
    const { g, w, h, texture } = control.face, u = size * DENSITY, x = w / 2, y = h / 2;
    g.clearRect(0, 0, w, h); g.fillStyle = g.strokeStyle = colour; g.lineJoin = g.lineCap = 'round';
    const triangle = (direction) => {
      g.beginPath(); g.moveTo(x - direction * 0.34 * u, y - 0.46 * u); g.lineTo(x + direction * 0.46 * u, y); g.lineTo(x - direction * 0.34 * u, y + 0.46 * u); g.closePath();
      g.lineWidth = 0.1 * u; g.fill(); g.stroke();
    };
    if (name === 'play') triangle(1);
    else if (name === 'pause') { g.beginPath(); g.roundRect(x - 0.42 * u, y - 0.5 * u, 0.3 * u, u, 0.06 * u); g.roundRect(x + 0.12 * u, y - 0.5 * u, 0.3 * u, u, 0.06 * u); g.fill(); }
    else if (name === 'previous' || name === 'next') {
      const direction = name === 'next' ? 1 : -1;
      g.save(); g.translate(-direction * 0.1 * u, 0); triangle(direction); g.restore();
      g.beginPath(); g.roundRect(x + direction * 0.5 * u - 0.08 * u, y - 0.5 * u, 0.16 * u, u, 0.06 * u); g.fill();
    } else if (name === 'pin') {
      g.save(); g.translate(x, y); g.rotate(0.6); g.beginPath();
      g.roundRect(-0.27 * u, -0.52 * u, 0.54 * u, 0.13 * u, 0.04 * u);
      g.moveTo(-0.17 * u, -0.4 * u); g.lineTo(0.17 * u, -0.4 * u); g.lineTo(0.23 * u, 0); g.lineTo(-0.23 * u, 0); g.closePath();
      g.roundRect(-0.37 * u, -0.02 * u, 0.74 * u, 0.12 * u, 0.05 * u); g.fill();
      g.lineWidth = 0.075 * u; g.beginPath(); g.moveTo(0, 0.1 * u); g.lineTo(0, 0.56 * u); g.stroke(); g.restore();
    } else {
      g.font = type(600, size); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, x, y + 0.01 * DENSITY);
    }
    texture.needsUpdate = true;
  }

  // ---- state ------------------------------------------------------------
  let data = { selected: 'spotify', sources: {}, track: {}, error: '', alwaysOnTop: false };
  let handler = () => {};
  let ready = false, playing = false, duration = 0;
  let trackId = '', reported = null, basePosition = 0, baseStamp = 0;
  let seekPreview = null, dragging = false, grabOffset = 0, hovered = null;
  let armAngle = ANGLE.rest, armLift = 1, spin = 0, turn = 0, rollerTurn = 0, lamp = 0;
  let printed = '', lastArt = '', imageRequest = 0;
  let tint = { ...DEFAULT_TINT }, tintFrom = tint, tintTo = tint, tintStart = -Infinity;
  const lean = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function applyTint(tone) {
    tint = tone;
    vinylTint.color.setHSL(tone.h, Math.min(1, tone.s * 1.35), THREE.MathUtils.lerp(0.5, tone.l, 0.35));
    wall.poolColor.value.setHSL(tone.h, Math.min(1, tone.s * 1.3), 0.62);
    wall.lampColor.value.setHSL(tone.h, Math.min(1, tone.s * 1.2), 0.6);
    glass.emissive.setHSL(tone.h, Math.min(1, tone.s * 1.2), 0.6);
    elementLit.setHSL(tone.h, Math.min(1, tone.s * 1.2), 0.66).multiplyScalar(1.9);
  }
  function retint(target, now = performance.now()) {
    if (reduced.matches) { tintTo = target; tintStart = -Infinity; applyTint(target); schedule(); return; }
    tintFrom = { ...tint }; tintTo = target; tintStart = now; schedule();
  }

  // The player reports its position every 1.5 s; between reports the stylus
  // keeps moving at playing speed so the arm and the clock do not stutter.
  function positionAt(now) {
    if (seekPreview !== null) return seekPreview;
    const elapsed = playing ? (now - baseStamp) / 1000 : 0;
    return clamp(basePosition + elapsed, 0, duration || 0);
  }

  function print(now) {
    const track = data.track || {}, position = positionAt(now);
    const clock = ready && duration > 0 ? `${formatTime(position)} / ${formatTime(duration)}` : '';
    const signature = [ready, track.title, track.artist, clock, data.error, data.selected].join('|');
    if (signature === printed) return;
    printed = signature;
    const { g, w, h, texture } = lettering;
    const right = (2.5 - 0.1) * DENSITY, row = (y) => (-1.42 - y) * DENSITY, width = 2.25 * DENSITY;
    g.clearRect(0, 0, w, h); g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    const line = (text, y, font, colour) => { g.font = font; g.fillStyle = colour; g.fillText(fitted(g, text, width), right, row(y)); };
    if (data.error) {
      g.font = type(400, 0.125);
      const lines = wrapped(g, data.error, 2.0 * DENSITY, 4);
      g.fillStyle = INK.error;
      lines.forEach((text, index) => g.fillText(text, right, row(-2.4 + (lines.length - 1 - index) * 0.19)));
      if (ready) line(track.title, -2.4 + lines.length * 0.19 + 0.05, type(700, 0.165), INK.title);
    } else if (ready) {
      line(track.title, -2.02, type(700, 0.165), INK.title);
      line(track.artist || '未知艺术家', -2.23, type(400, 0.135), INK.artist);
      if (clock) line(clock, -2.42, type(500, 0.118), INK.time);
    } else {
      line('还没有播放音乐', -2.2, type(700, 0.165), INK.title);
      line(`打开 ${data.selected === 'music' ? 'Apple Music' : 'Spotify'}，播放一首歌。`, -2.42, type(400, 0.135), INK.artist);
    }
    texture.needsUpdate = true;
  }

  function markKeys() {
    const transport = ready ? ENGRAVED.on : ENGRAVED.off;
    mark(controls.spotify, 'Spotify', data.selected === 'spotify' ? ENGRAVED.on : ENGRAVED.idle, 0.118);
    mark(controls.music, 'Apple Music', data.selected === 'music' ? ENGRAVED.on : ENGRAVED.idle, 0.118);
    mark(controls.playPause, playing ? 'pause' : 'play', transport, 0.19);
    mark(controls.previous, 'previous', transport, 0.13);
    mark(controls.next, 'next', transport, 0.13);
    mark(controls.pin, 'pin', data.alwaysOnTop ? ENGRAVED.on : ENGRAVED.idle, 0.16);
    controls.spotify.sunk = data.selected === 'spotify';
    controls.music.sunk = data.selected === 'music';
    controls.pin.sunk = !!data.alwaysOnTop;
  }

  // ---- frame ------------------------------------------------------------
  let frame = 0, last = 0;
  function schedule() { if (!frame) frame = requestAnimationFrame(render); }
  function render(now) {
    // A record can spin for hours behind other windows: draw at most 60 frames a
    // second, and 30 while the window is not the one in use.
    if (now - last < (document.hasFocus() ? 15 : 31)) { frame = requestAnimationFrame(render); return; }
    frame = 0;
    const dt = Math.min((now - last) / 1000, 0.08), still = reduced.matches;
    last = now;
    const ease = (seconds) => (still ? 1 : 1 - Math.exp(-dt / seconds));
    let moving = false;
    const settle = (value, target, seconds, epsilon) => {
      const next = value + (target - value) * ease(seconds);
      if (Math.abs(target - next) < epsilon) return target;
      moving = true; return next;
    };

    spin = settle(spin, playing && !still ? 1 : 0, 0.5, 0.002);
    turn += spin * SPIN * dt; rollerTurn += spin * 5.5 * dt;
    record.rotation.z = -turn; roller.rotation.x = rollerTurn;
    if (playing && !still) moving = true;

    const position = positionAt(now);
    const target = !ready ? ANGLE.rest : angleAtProgress(duration > 0 ? position / duration : 0);
    armAngle = dragging ? target : settle(armAngle, target, 0.16, 0.0004);
    armLift = settle(armLift, ready && playing && !dragging ? 0 : 1, 0.14, 0.003);
    const height = ARM.z + armLift * ARM.lift;
    arm.rotation.z = armAngle; arm.position.z = height;
    wall.armOrigin.value.set(PIVOT.x + LIGHT.x * height, PIVOT.y + LIGHT.y * height);
    wall.armAngle.value = armAngle;

    for (const control of Object.values(controls)) {
      const depth = Math.max(control.held ? KEY.travel : 0, control.sunk ? KEY.sunk : 0);
      control.travel = settle(control.travel, depth, 0.045, 0.0005);
      control.group.position.z = control.base - control.travel;
    }
    lamp = settle(lamp, data.alwaysOnTop ? 1 : 0, 0.18, 0.004);
    glass.emissiveIntensity = lamp * 0.2; element.color.copy(elementDark).lerp(elementLit, lamp); wall.lamp.value.z = lamp * 0.16;

    if (tintStart > -Infinity) {
      const progress = clamp((now - tintStart) / 450, 0, 1), t = progress * progress * (3 - 2 * progress);
      const hue = ((tintTo.h - tintFrom.h + 1.5) % 1) - 0.5;
      applyTint({ h: (tintFrom.h + hue * t + 1) % 1, s: tintFrom.s + (tintTo.s - tintFrom.s) * t, l: tintFrom.l + (tintTo.l - tintFrom.l) * t });
      if (progress < 1) moving = true; else tintStart = -Infinity;
    }

    lean.x = settle(lean.x, still || dragging ? lean.x : lean.targetX, 0.22, 0.0002);
    lean.y = settle(lean.y, still || dragging ? lean.y : lean.targetY, 0.22, 0.0002);
    rig.rotation.set(TILT.x + lean.x, TILT.y + lean.y, 0);

    print(now);
    renderer.render(scene, camera);
    if (moving) frame = requestAnimationFrame(render);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    const slope = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, Math.max(FRAME.h / 2 / slope, FRAME.w / 2 / (slope * camera.aspect)) + TOP);
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    schedule();
  }
  new ResizeObserver(resize).observe(canvas);
  reduced.addEventListener('change', schedule);

  // ---- hands ------------------------------------------------------------
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
  const plane = new THREE.Plane(), normal = new THREE.Vector3(), anchor = new THREE.Vector3(), touch = new THREE.Vector3();
  function aim(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(pointer, camera);
  }
  const enabled = (action) => {
    if (action === 'spotify' || action === 'music' || action === 'pin') return true;
    if (action === 'seek') return ready && duration > 0;
    return !!action && ready;
  };
  function pick(event) {
    aim(event);
    const action = ray.intersectObjects(hits, false)[0]?.object.userData.action;
    return enabled(action) ? action : null;
  }
  // Where the pointer meets the plane the arm sweeps, as an angle about the pivot.
  function pointerAngle(event) {
    aim(event);
    normal.set(0, 0, 1).transformDirection(deck.matrixWorld);
    anchor.set(PIVOT.x, PIVOT.y, ARM.z).applyMatrix4(deck.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal, anchor);
    if (!ray.ray.intersectPlane(plane, touch)) return null;
    deck.worldToLocal(touch);
    return Math.atan2(touch.y - PIVOT.y, touch.x - PIVOT.x);
  }
  function hover(action) {
    const control = controls[action] || null;
    if (hovered !== control) {
      hovered?.cap.material.emissive.setScalar(0);
      hovered = control;
      hovered?.cap.material.emissive.setScalar(0.028);
      schedule();
    }
    canvas.style.cursor = dragging ? 'grabbing' : action === 'seek' ? 'grab' : action ? 'pointer' : 'default';
  }
  function drag(event) {
    const angle = pointerAngle(event);
    if (angle === null) return;
    seekPreview = progressAtAngle(angle - grabOffset) * duration;
    schedule();
  }
  canvas.addEventListener('pointermove', (event) => { if (dragging) drag(event); else hover(pick(event)); });
  canvas.addEventListener('pointerleave', () => { if (!dragging) hover(null); });
  canvas.addEventListener('pointerdown', (event) => {
    const action = pick(event);
    if (!action) return;
    if (action === 'seek') {
      const angle = pointerAngle(event);
      if (angle === null) return;
      dragging = true; grabOffset = angle - armAngle; seekPreview = positionAt(performance.now());
      canvas.setPointerCapture(event.pointerId); hover('seek'); schedule();
      return;
    }
    if (controls[action]) { controls[action].held = true; schedule(); }
    if (action === 'spotify' || action === 'music') handler('source', action);
    else if (action === 'pin') handler('pin');
    else handler(action === 'label' ? 'playPause' : action);
  });
  const release = (event) => {
    for (const control of Object.values(controls)) control.held = false;
    if (dragging) {
      dragging = false;
      const value = seekPreview; seekPreview = null;
      if (event.type === 'pointerup' && value !== null) {
        // Hold the stylus where it was dropped until the player confirms.
        basePosition = value; baseStamp = performance.now();
        handler('seek', value);
      }
      hover(event.type === 'pointerup' ? pick(event) : null);
    }
    schedule();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  window.addEventListener('pointermove', (event) => {
    lean.targetY = (event.clientX / window.innerWidth - 0.5) * 0.09;
    lean.targetX = (event.clientY / window.innerHeight - 0.5) * 0.06;
    schedule();
  });
  document.documentElement.addEventListener('pointerleave', () => { lean.targetX = lean.targetY = 0; schedule(); });

  // ---- bridge to the player ----------------------------------------------
  function showArtwork(url) {
    if (url === lastArt) return;
    lastArt = url;
    const token = ++imageRequest;
    const plain = () => { if (token !== imageRequest) return; plainLabel(); retint(DEFAULT_TINT); };
    if (!url) { plain(); return; }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (token !== imageRequest) return;
      try { artworkLabel(image); } catch (_) { plain(); return; }
      let tone = DEFAULT_TINT;
      try { tone = artworkTint(image); } catch (_) { /* a cover that cannot be read keeps the default pressing */ }
      retint(tone);
    };
    image.onerror = plain;
    image.src = url;
  }

  window.turntable = {
    onAction(fn) { handler = typeof fn === 'function' ? fn : () => {}; },
    update(next) {
      data = next || data;
      const track = data.track || {}, now = performance.now();
      const nextReady = !!(track.running && track.title), nextPlaying = nextReady && !!track.playing;
      const nextId = [data.selected, track.title, track.artist, track.album].join('|');
      const position = Math.max(0, Number(track.position) || 0);
      duration = nextReady ? Math.max(0, Number(track.duration) || 0) : 0;
      // Re-rendering with the same report must not rewind the stylus, and a
      // report that agrees with the running clock should not make it jump.
      if (nextId !== trackId || nextPlaying !== playing || position !== reported) {
        const drift = position - positionAt(now);
        const steady = nextId === trackId && nextPlaying && playing && Math.abs(drift) < 1.5;
        basePosition = steady ? positionAt(now) + drift * 0.5 : position;
        baseStamp = now;
      }
      trackId = nextId; reported = position; ready = nextReady; playing = nextPlaying;
      showArtwork(ready ? track.artworkUrl || '' : '');
      markKeys(); schedule();
    }
  };

  plainLabel(); applyTint(DEFAULT_TINT); markKeys(); resize();
}

(() => {
  const canvas = document.getElementById('turntable');
  const fallback = document.getElementById('turntable-fallback');
  // Without WebGL, or if the scene cannot be built, the plain controls take over.
  const fail = () => { fallback?.classList.add('visible'); canvas.style.display = 'none'; };
  try { build(canvas, fail); }
  catch (_) { fail(); window.turntable = { update() {}, onAction() {} }; }
})();
