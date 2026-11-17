import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A wall-mounted acrylic turntable. One unit is 100 px of the reference
// photograph, the origin is the centre of the acrylic plate and the wall is the
// plane z = 0. Every control is a part of the machine: lever keys beside the
// motor block, the brass wheel for volume, the grooves for seeking, a slide
// switch for the source and a lamp for the pinned window.
const PLATE = { w: 6.57, h: 5.13, corner: 0.16, thick: 0.12, back: 0.9 };
const TOP = PLATE.back + PLATE.thick;
const RECORD = { x: -0.585, y: 0, r: 2.5, z: TOP + 0.13, thick: 0.03 };
const LABEL = 1.02;
const PIVOT = { x: -2.735, y: -2.165 };
// The arm plays from beneath: its blade runs between the plate and the record,
// and the clear pressing lets it show through.
const ARM = { length: 2.02, z: TOP + 0.055 };
// Stylus radii: lead-in groove, run-out groove, and parked beside the record.
const GROOVE = { outer: 2.36, inner: 1.14, rest: 2.58 };
// The motor block is a stack of plain black volumes, as in the photograph.
const BODY = { x: 2.585, y: 1.3725, w: 1.04, h: 1.705, d: 0.42 };
const PANEL = { x: 2.75, y: 1.1, w: 0.64, h: 1.08, d: 0.035 };
const WING = { x: 1.7825, y: 1.8375, w: 0.565, h: 0.735, d: 0.2 };
const HOUSING = { x: 1.785, y: 1.26, w: 0.56, h: 0.34, d: 0.3 };
const STEP = { x: 2.47, y: 0.365, w: 1.01, h: 0.31, d: 0.34 };
const WHEEL = { y: 0.8275, z: RECORD.z + 0.24, worm: { x0: 1.5, x1: 1.74, r: 0.2 }, grip: { x0: 1.74, x1: 2.2, r: 0.135 } };
const SWITCH = { x: 2.2, spotify: 2.065, music: 1.845 };
const RIBS = { count: 12, x0: 2.488, pitch: 0.04764, y: 0.9, w: 0.026, h: 0.56 };
const KEY = { travel: 0.03, sunk: 0.022 };
const LAMP = { x0: -2.72, x1: -2.17, y: 2.235, r: 0.235 };
const PIN = { x: -2.02, y: 2.235, w: 0.3, h: 0.47, d: 0.42 };
const POSTS = [[-2.885, 2.165, 0.14], [-3.13, -2.41, 0.085], [3.13, -2.41, 0.085], [3.13, 2.41, 0.085]];
const CABLE = [[2.64, 0.3, 1.22], [2.64, 0.02, 1.22], [2.66, -0.7, 1.21], [2.76, -1.7, 1.15], [2.88, -2.7, 0.95], [2.95, -3.9, 0.55], [3, -5.6, 0.38], [3.02, -9.5, 0.34]];
// The light sits above and to the left: wall shadows shift by this much per
// unit of height, which is what throws the pool of record colour below the plate.
const LIGHT = { x: 0.36, y: -0.9 };
const FRAME = { w: 8.3, h: 6.9 };
const TILT = { x: -0.085, y: 0.045 };
const ENV_TILT = -0.5;
const SPIN = (2 * Math.PI) / 1.8; // 33⅓ rpm
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif';
const DENSITY = 420; // canvas pixels per unit for printed faces
const INK = { title: '#171717', artist: '#4d4d4d', time: '#696969', error: '#9a3b29' };
const ENGRAVED = { on: '#f2f2f0', idle: '#9a9a9a', off: '#5e5e5e' };
const DEFAULT_TINT = { h: 0.148, s: 0.72, l: 0.6 };

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const reach = Math.hypot(RECORD.x - PIVOT.x, RECORD.y - PIVOT.y);
const toCentre = Math.atan2(RECORD.y - PIVOT.y, RECORD.x - PIVOT.x);
const angleAtRadius = (radius) => toCentre + Math.acos((reach * reach + ARM.length * ARM.length - radius * radius) / (2 * reach * ARM.length));
const ANGLE = { rest: angleAtRadius(GROOVE.rest) };
const angleAtProgress = (progress) => angleAtRadius(GROOVE.outer + (GROOVE.inner - GROOVE.outer) * clamp(progress, 0, 1));
const progressAtRadius = (radius) => clamp((GROOVE.outer - radius) / (GROOVE.outer - GROOVE.inner), 0, 1);

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
  const part = (volume, extra = 0) => rect(volume.x, volume.y, volume.w, volume.h + extra);

  cast(0.13, 0.34, TOP, TOP, plate);
  // Clear acrylic barely shades the wall, but its edges do.
  g.save(); g.filter = `blur(${0.09 * k}px)`; g.strokeStyle = 'rgba(0,0,0,.34)'; g.lineWidth = 0.07 * k;
  g.beginPath(); plate(TOP - PLATE.thick / 2); g.stroke(); g.restore();
  cast(0.58, 0.24, TOP, TOP + BODY.d + PANEL.d, part(BODY));
  cast(0.5, 0.22, TOP, TOP + WING.d + 0.09, part(WING));
  cast(0.5, 0.22, TOP, TOP + HOUSING.d, part(HOUSING));
  cast(0.5, 0.22, TOP, TOP + STEP.d, part(STEP));
  cast(0.45, 0.2, WHEEL.z - WHEEL.worm.r, WHEEL.z + WHEEL.worm.r, rect((WHEEL.worm.x0 + WHEEL.grip.x1) / 2, WHEEL.y, WHEEL.grip.x1 - WHEEL.worm.x0, WHEEL.worm.r * 1.7));
  cast(0.54, 0.2, TOP, TOP + PIN.d, rect(PIN.x, PIN.y, PIN.w, PIN.h));
  cast(0.16, 0.16, TOP, TOP + LAMP.r * 2, rect((LAMP.x0 + LAMP.x1) / 2, LAMP.y, LAMP.x1 - LAMP.x0, LAMP.r * 1.6));
  cast(0.5, 0.26, RECORD.z, RECORD.z, disc(RECORD.x, RECORD.y, LABEL));
  for (const [x, y, cap] of POSTS) {
    cast(0.3, 0.1, 0, PLATE.back, disc(x, y, 0.055));
    cast(0.45, 0.16, TOP, TOP + 0.05, disc(x, y, cap));
  }
  g.save(); g.filter = `blur(${0.17 * k}px)`; g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath();
  for (const point of cable) { g.moveTo(X(point.x, point.z) + 0.085 * k, Y(point.y, point.z)); g.arc(X(point.x, point.z), Y(point.y, point.z), 0.085 * k, 0, Math.PI * 2); }
  g.fill(); g.restore();
  return { canvas, rect: new THREE.Vector4(left, top - span, span, span) };
}

// The tonearm turns, so its shadow is a strip the wall shader rotates with it.
function armShadeCanvas() {
  const k = 128, left = -0.8, width = 3.1, height = 0.8;
  const canvas = blank(width * k, height * k), g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  const x = (value) => (value - left) * k, mid = canvas.height / 2;
  g.filter = `blur(${0.17 * k}px)`; g.fillStyle = g.strokeStyle = 'rgba(0,0,0,.3)';
  g.lineWidth = 0.07 * k; g.beginPath(); g.moveTo(x(0.15), mid); g.lineTo(x(2.04), mid); g.stroke();
  g.fillRect(x(-0.36), mid - 0.17 * k, 0.56 * k, 0.34 * k);
  g.fillRect(x(-0.52), mid - 0.085 * k, 0.17 * k, 0.17 * k);
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
  const centre = new THREE.Vector2(RECORD.x + LIGHT.x * RECORD.z, RECORD.y + LIGHT.y * RECORD.z);
  return { canvas, centre, rect: new THREE.Vector4(centre.x - span / 2, centre.y - span / 2, span, span) };
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

// A cylinder whose radius ripples around its axis, so turning it is visible.
// A twist winds the ripples into the screw of the drive worm.
function ridged(radius, length, ridges, depth, twist = 0) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, ridges * 10, twist ? 28 : 1, true);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), z = position.getZ(i);
    const angle = Math.atan2(z, x) + twist * (position.getY(i) / length);
    const scale = 1 - depth * (0.5 - 0.5 * Math.cos(angle * ridges));
    position.setX(i, x * scale); position.setZ(i, z * scale);
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
// It stays translucent enough for the arm beneath to read through it.
function tintMaskCanvas() {
  const size = 512, canvas = blank(size), g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, alpha] of [[0, 0.64], [0.4, 0.64], [0.43, 0.58], [0.7, 0.64], [0.772, 0.62], [0.792, 0.06], [1, 0.05]]) gradient.addColorStop(at, `rgba(255,255,255,${alpha})`);
  g.fillStyle = gradient; g.beginPath(); g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); g.fill();
  return canvas;
}

// Clear vinyl: a faint body, the groove bands of each track, a bright rim, and
// a few soft glints that travel with the record so its turning can be seen.
function grooveCanvas() {
  const size = 1024, c = size / 2, canvas = blank(size), g = canvas.getContext('2d');
  const body = g.createRadialGradient(c, c, 0, c, c, c);
  body.addColorStop(0, 'rgba(214,214,214,0)'); body.addColorStop(0.77, 'rgba(214,214,214,0)');
  body.addColorStop(0.81, 'rgba(214,214,214,.13)'); body.addColorStop(0.97, 'rgba(220,220,220,.16)'); body.addColorStop(1, 'rgba(240,240,240,.3)');
  g.fillStyle = body; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
  const glint = g.createConicGradient(0.4, c, c);
  for (const [at, alpha] of [[0, 0], [0.035, 0.1], [0.07, 0], [0.36, 0], [0.4, 0.07], [0.44, 0], [0.7, 0], [0.73, 0.09], [0.76, 0], [1, 0]]) glint.addColorStop(at, `rgba(255,255,255,${alpha})`);
  g.fillStyle = glint; g.beginPath(); g.arc(c, c, 0.985 * c, 0, Math.PI * 2); g.arc(c, c, 0.43 * c, 0, Math.PI * 2, true); g.fill();
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
  // The wall behind the plate is soft everywhere, so the refraction pass can run at half size.
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
  const rig = new THREE.Group(); rig.position.set(-0.06, -0.02, 0); scene.add(rig);
  const deck = new THREE.Group(); rig.add(deck);
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-LIGHT.x * 10, -LIGHT.y * 10, 10);
  rig.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 0.35));

  const standard = (color, roughness, metalness = 0, envMapIntensity = 1) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMap: env, envMapIntensity });
  // Anodised housings stay matte; the caps a finger lands on are satin so they catch the light.
  const matte = new THREE.MeshPhysicalMaterial({ color: 0x0f0f0f, roughness: 0.74, clearcoat: 0.05, clearcoatRoughness: 0.6, envMap: env, envMapIntensity: 0.26 });
  const satin = () => new THREE.MeshPhysicalMaterial({ color: 0x161616, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.22, envMap: env, envMapIntensity: 0.6 });
  const inlay = standard(0x050505, 0.18, 0, 0.6);
  const graphite = standard(0x2b2b2b, 0.42, 0.55);
  const steel = standard(0x8b8b8b, 0.45, 0.35, 0.22);
  const darkSteel = standard(0x3b3b3b, 0.4, 0.85, 0.5);
  const brass = standard(0xd6c48a, 0.28, 1, 1.1);
  const rubber = standard(0x141414, 0.82, 0, 0.5);
  const hidden = new THREE.MeshBasicMaterial();
  const acrylic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transmission: 1, thickness: 0.14, ior: 1.49, attenuationColor: new THREE.Color(0xc6c6c6), attenuationDistance: 0.8, side: THREE.DoubleSide, envMap: env, envMapIntensity: 0.16 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transmission: 1, thickness: 0.4, ior: 1.52, envMap: env, envMapIntensity: 0.8, emissiveIntensity: 0 });

  function box(w, h, d, material, x, y, z, radius = 0.016, parent = deck) {
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
  const hits = [];
  // An unseen shape that only answers the pointer.
  function touchable(geometry, action, x, y, z, parent = deck) {
    const mesh = new THREE.Mesh(geometry, hidden);
    mesh.position.set(x, y, z); mesh.visible = false; mesh.userData.action = action; parent.add(mesh); hits.push(mesh);
    return mesh;
  }

  // ---- wall -------------------------------------------------------------
  const cablePath = new THREE.CatmullRomCurve3(CABLE.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const shade = shadeCanvas(cablePath.getPoints(110)), armShade = armShadeCanvas(), pool = poolCanvas();
  const wall = {
    near: { value: new THREE.Color(0xd2d2d2) }, mid: { value: new THREE.Color(0xb8b8b8) }, far: { value: new THREE.Color(0x8d8d8d) },
    shade: { value: dataTexture(shade.canvas) }, shadeRect: { value: shade.rect },
    pool: { value: dataTexture(pool.canvas) }, poolRect: { value: pool.rect }, poolCentre: { value: pool.centre }, poolColor: { value: new THREE.Color() },
    arm: { value: dataTexture(armShade.canvas) }, armRect: { value: armShade.rect }, armOrigin: { value: new THREE.Vector2() }, armAngle: { value: 0 },
    lamp: { value: new THREE.Vector3((LAMP.x0 + LAMP.x1) / 2 + LIGHT.x * 0.5, LAMP.y + LIGHT.y * 0.5, 0) }, lampColor: { value: new THREE.Color() },
    // glow: how far the machine's light is up; turn: the record's angle; clock: the phase of the ripples.
    glow: { value: 0 }, turn: { value: 0 }, clock: { value: 0 }, halo: { value: new THREE.Vector2(0.9, PLATE.h / 2 + 0.16) }
  };
  const wallMesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.ShaderMaterial({
    uniforms: wall,
    vertexShader: 'varying vec2 vPlane; void main() { vPlane = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 near; uniform vec3 mid; uniform vec3 far;
      uniform sampler2D shade; uniform vec4 shadeRect;
      uniform sampler2D pool; uniform vec4 poolRect; uniform vec2 poolCentre; uniform vec3 poolColor;
      uniform sampler2D arm; uniform vec4 armRect; uniform vec2 armOrigin; uniform float armAngle;
      uniform vec3 lamp; uniform vec3 lampColor;
      uniform float glow; uniform float turn; uniform float clock; uniform vec2 halo;
      varying vec2 vPlane;
      float inside(vec2 uv) { vec2 s = step(vec2(0.0), uv) * step(uv, vec2(1.0)); return s.x * s.y; }
      void main() {
        float r = length(vPlane - vec2(0.3, 1.6));
        vec3 colour = mix(near, mid, smoothstep(0.0, 7.5, r));
        colour = mix(colour, far, smoothstep(5.0, 16.0, r));
        // While a record plays the lamp behind it is up: the pool of record
        // colour brightens, its streaks turn with the record and slow rings
        // of light travel outward. At rest only a faint, still tint remains.
        vec2 fromPool = vPlane - poolCentre;
        float poolRadius = length(fromPool), poolAngle = atan(fromPool.y, fromPool.x) + turn;
        float streaks = 1.0 + glow * (0.22 * sin(3.0 * poolAngle) + 0.13 * sin(5.0 * poolAngle + 1.7));
        float rings = 1.0 + glow * 0.09 * sin(poolRadius * 6.5 - clock);
        vec2 poolUv = (vPlane - poolRect.xy) / poolRect.zw;
        float lit = texture2D(pool, poolUv).r * inside(poolUv) * mix(0.34, 1.0, glow) * streaks * rings;
        colour = mix(colour, poolColor, clamp(lit, 0.0, 1.0));
        vec2 fromHalo = (vPlane - halo) / vec2(1.7, 0.2);
        colour += vec3(0.2) * mix(0.25, 1.0, glow) * exp(-dot(fromHalo, fromHalo));
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

  // ---- printing ---------------------------------------------------------
  function face(w, h, x, y, z, parent = deck) {
    const source = blank(Math.round(w * DENSITY), Math.round(h * DENSITY)), texture = colourTexture(source);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.position.set(x, y, z); mesh.renderOrder = 6; parent.add(mesh);
    return { g: source.getContext('2d'), w: source.width, h: source.height, texture, mesh };
  }
  // Keyboard focus on a part that has no cap to print on: an outline edged in
  // dark so it reads on any colour behind it.
  function focusMark(w, h, x, y, z, parent, round) {
    const mark = face(w, h, x, y, z, parent), { g } = mark, inset = 0.04 * DENSITY;
    g.beginPath();
    if (round) g.arc(mark.w / 2, mark.h / 2, mark.w / 2 - inset, 0, Math.PI * 2);
    else g.roundRect(inset, inset, mark.w - inset * 2, mark.h - inset * 2, 0.05 * DENSITY);
    g.lineWidth = 0.05 * DENSITY; g.strokeStyle = 'rgba(23,23,23,.85)'; g.stroke();
    g.lineWidth = 0.026 * DENSITY; g.strokeStyle = ENGRAVED.on; g.stroke();
    mark.texture.needsUpdate = true; mark.mesh.visible = false;
    return mark.mesh;
  }

  // ---- record -----------------------------------------------------------
  const record = new THREE.Group(); record.position.set(RECORD.x, RECORD.y, RECORD.z); deck.add(record);
  cylinder(0.42, RECORD.z - TOP, matte, RECORD.x, RECORD.y, TOP);
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
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(RECORD.r, RECORD.r, RECORD.thick, 160, 1, true), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.32, depthWrite: false, envMap: env
  }));
  rim.rotation.x = Math.PI / 2; rim.position.z = -RECORD.thick / 2; rim.renderOrder = 2; record.add(rim);

  const labelCanvas = blank(512), labelContext = labelCanvas.getContext('2d'), labelTexture = colourTexture(labelCanvas);
  const label = new THREE.Mesh(new THREE.CircleGeometry(LABEL, 128), new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.82, envMap: env, envMapIntensity: 0.5 }));
  label.position.z = 0.004; label.userData.action = 'label'; record.add(label); hits.push(label);
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
  // Any groove can be touched to set the stylus down on it.
  touchable(new THREE.RingGeometry(GROOVE.inner - 0.08, GROOVE.outer + 0.1, 72), 'groove', RECORD.x, RECORD.y, RECORD.z + 0.012);

  // ---- tonearm ----------------------------------------------------------
  // A turret on the plate carries a flat blade under the record; the stylus at
  // its tip rides the underside of the grooves.
  const arm = new THREE.Group(); arm.position.set(PIVOT.x, PIVOT.y, 0); deck.add(arm);
  box(0.56, 0.34, 0.22, matte, -0.08, 0, TOP, 0.07, arm);
  box(0.32, 0.25, 0.045, satin(), -0.1, 0, TOP + 0.22, 0.05, arm);
  cylinder(0.05, 0.02, steel, 0, 0, TOP + 0.265, arm, 'z', 32);
  cylinder(0.085, 0.16, matte, -0.43, 0, TOP + 0.11, arm, 'x', 40);
  cylinder(0.088, 0.02, steel, -0.5, 0, TOP + 0.11, arm, 'x', 40);
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0.1, -0.046); bladeShape.lineTo(ARM.length + 0.01, -0.027);
  bladeShape.absarc(ARM.length + 0.01, 0, 0.027, -Math.PI / 2, Math.PI / 2, false);
  bladeShape.lineTo(0.1, 0.046); bladeShape.closePath();
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape, { depth: 0.03, bevelEnabled: false, curveSegments: 12 }), standard(0x1b1b1b, 0.5, 0.4, 0.4));
  blade.position.z = ARM.z - 0.015; arm.add(blade);
  cylinder(0.014, 0.008, steel, 0.74, 0, ARM.z + 0.015, arm, 'z', 16);
  // The stylus: a steel seat with a bright point that shows through the pressing.
  cylinder(0.05, 0.02, steel, ARM.length, 0, ARM.z + 0.015, arm, 'z', 32);
  const pointDark = new THREE.Color(0xf2f2f0), point = new THREE.MeshBasicMaterial({ color: pointDark });
  cylinder(0.022, 0.006, point, ARM.length, 0, ARM.z + 0.035, arm, 'z', 20);
  // While a record plays the point lights up, and its glow shows through the pressing.
  const haloCanvas = blank(128), haloContext = haloCanvas.getContext('2d'), haloGradient = haloContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  haloGradient.addColorStop(0, 'rgba(255,255,255,1)'); haloGradient.addColorStop(0.18, 'rgba(255,255,255,.55)'); haloGradient.addColorStop(0.5, 'rgba(255,255,255,.12)'); haloGradient.addColorStop(1, 'rgba(255,255,255,0)');
  haloContext.fillStyle = haloGradient; haloContext.fillRect(0, 0, 128, 128);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: colourTexture(haloCanvas), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
  halo.position.set(ARM.length, 0, RECORD.z + 0.02); halo.renderOrder = 5; arm.add(halo);
  const armFocus = focusMark(0.7, 0.7, ARM.length, 0, RECORD.z + 0.03, arm, true);

  // ---- motor block ------------------------------------------------------
  const bodyTop = TOP + BODY.d, panelTop = bodyTop + PANEL.d;
  box(BODY.w, BODY.h, BODY.d, matte, BODY.x, BODY.y, TOP);
  box(PANEL.w, PANEL.h, PANEL.d, matte, PANEL.x, PANEL.y, bodyTop, 0.012);
  box(WING.w, WING.h, WING.d, matte, WING.x, WING.y, TOP);
  box(HOUSING.w, HOUSING.h, HOUSING.d, matte, HOUSING.x, HOUSING.y, TOP);
  box(HOUSING.w, 0.525, 0.07, matte, HOUSING.x, WHEEL.y, TOP, 0.012);
  box(0.325, 0.135, 0.26, matte, 1.9025, 0.4975, TOP, 0.012);
  box(STEP.w, STEP.h, STEP.d, matte, STEP.x, STEP.y, TOP);

  const controls = {};
  // A key is a cap that travels into its seat, with its marking printed on top.
  function key(action, x, y, w, h, base, depth, radius = 0.02) {
    const group = new THREE.Group(); group.position.set(x, y, base); deck.add(group);
    const cap = box(w, h, depth, satin(), 0, 0, 0, radius, group);
    cap.userData.action = action; hits.push(cap);
    controls[action] = { group, cap, base, face: face(w, h, 0, 0, depth + 0.002, group), travel: 0, held: false, pulse: 0, sunk: false, mark: '' };
    return controls[action];
  }
  // Three lever keys beside the block, in the order a deck lays them out.
  key('previous', WING.x, 2.095, 0.545, 0.2, TOP + WING.d, 0.09);
  key('playPause', WING.x, 1.84, 0.545, 0.26, TOP + WING.d, 0.09);
  key('next', WING.x, 1.585, 0.545, 0.2, TOP + WING.d, 0.09);
  key('shuffle', 2.605, 1.435, 0.27, 0.27, panelTop, 0.045);
  key('repeat', 2.895, 1.435, 0.27, 0.27, panelTop, 0.045);

  // The source is a slide switch with its two positions named beside it.
  box(0.13, 0.37, 0.008, inlay, SWITCH.x, (SWITCH.spotify + SWITCH.music) / 2, bodyTop, 0.03);
  const thumb = box(0.1, 0.13, 0.05, steel, SWITCH.x, SWITCH.spotify, bodyTop + 0.008, 0.02);
  const sourceFace = face(0.8, 0.46, 2.69, 1.955, bodyTop + 0.003);
  for (const [action, y] of [['spotify', SWITCH.spotify], ['music', SWITCH.music]]) touchable(new THREE.BoxGeometry(BODY.w - 0.06, 0.22, 0.07), action, BODY.x, y, bodyTop + 0.035);

  // Cooling ribs double as the volume gauge: they light up from the left.
  const ribs = [];
  for (let i = 0; i < RIBS.count; i++) {
    const material = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.55, envMap: env, envMapIntensity: 0.35, emissiveIntensity: 0 });
    ribs.push(box(RIBS.w, RIBS.h, 0.03, material, RIBS.x0 + i * RIBS.pitch, RIBS.y, panelTop, 0.006));
  }

  // The drive: a worm that turns the record's rim, and on the same axle the
  // fluted brass wheel that sets the volume.
  const worm = new THREE.Group(); worm.position.set(0, WHEEL.y, WHEEL.z); deck.add(worm);
  const wormLength = WHEEL.worm.x1 - WHEEL.worm.x0, wormX = (WHEEL.worm.x0 + WHEEL.worm.x1) / 2;
  const screw = new THREE.Mesh(ridged(WHEEL.worm.r, wormLength - 0.02, 7, 0.15, Math.PI * 3.6), darkSteel);
  screw.rotation.z = Math.PI / 2; screw.position.x = wormX; worm.add(screw);
  cylinder(WHEEL.worm.r * 0.9, 0.02, darkSteel, WHEEL.worm.x0 + 0.01, 0, 0, worm, 'x');
  cylinder(0.045, 0.012, steel, WHEEL.worm.x0 - 0.002, 0, 0, worm, 'x', 24);
  const grip = new THREE.Group(); grip.position.set(0, WHEEL.y, WHEEL.z); deck.add(grip);
  const gripLength = BODY.x - BODY.w / 2 - WHEEL.grip.x0, gripX = WHEEL.grip.x0 + gripLength / 2;
  const flutes = new THREE.Mesh(ridged(WHEEL.grip.r, gripLength - 0.03, 12, 0.13), brass);
  flutes.rotation.z = Math.PI / 2; flutes.position.x = gripX; grip.add(flutes);
  cylinder(WHEEL.grip.r + 0.012, 0.022, brass, WHEEL.grip.x0 + 0.011, 0, 0, grip, 'x');
  cylinder(WHEEL.grip.r + 0.012, 0.022, brass, BODY.x - BODY.w / 2 - 0.011, 0, 0, grip, 'x');
  touchable(new THREE.BoxGeometry(WHEEL.grip.x1 - WHEEL.worm.x0 - 0.13, 0.44, 0.46), 'volume', (WHEEL.worm.x0 + BODY.x - BODY.w / 2) / 2, WHEEL.y, WHEEL.z);
  const wheelFocus = focusMark(0.36, 0.44, gripX, WHEEL.y, WHEEL.z + 0.22, deck, false);

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
  const relief = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.22, 32), rubber);
  relief.position.set(CABLE[0][0], STEP.y - STEP.h / 2 - 0.07, CABLE[0][2]); deck.add(relief);

  // ---- markings ---------------------------------------------------------
  // Track details are printed on the acrylic where a maker's mark would sit.
  const lettering = face(2.46, 1.08, 1.33, -1.96, TOP + 0.004);
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
  function mark(control, name, colour, size, focused) {
    const signature = `${name}|${colour}|${focused}`;
    if (control.mark === signature) return;
    control.mark = signature;
    const { g, w, h, texture } = control.face, u = size * DENSITY, x = w / 2, y = h / 2;
    g.clearRect(0, 0, w, h); g.fillStyle = g.strokeStyle = colour; g.lineJoin = g.lineCap = 'round';
    const triangle = (direction) => {
      g.beginPath(); g.moveTo(x - direction * 0.34 * u, y - 0.46 * u); g.lineTo(x + direction * 0.46 * u, y); g.lineTo(x - direction * 0.34 * u, y + 0.46 * u); g.closePath();
      g.lineWidth = 0.1 * u; g.fill(); g.stroke();
    };
    const arrowhead = (px, py, direction) => { g.moveTo(px - direction * 0.17 * u, py - 0.17 * u); g.lineTo(px, py); g.lineTo(px - direction * 0.17 * u, py + 0.17 * u); };
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
    } else if (name === 'shuffle') {
      // Two paths that cross on their way to the right.
      g.lineWidth = 0.11 * u; g.beginPath();
      for (const side of [1, -1]) {
        g.moveTo(x - 0.5 * u, y + side * 0.27 * u); g.lineTo(x - 0.24 * u, y + side * 0.27 * u);
        g.bezierCurveTo(x + 0.02 * u, y + side * 0.27 * u, x - 0.02 * u, y - side * 0.27 * u, x + 0.24 * u, y - side * 0.27 * u);
        g.lineTo(x + 0.48 * u, y - side * 0.27 * u);
        arrowhead(x + 0.5 * u, y - side * 0.27 * u, 1);
      }
      g.stroke();
    } else if (name === 'repeat' || name === 'repeat-one') {
      // A loop with an arrow on each run; a 1 inside when a single track repeats.
      g.lineWidth = 0.11 * u; g.beginPath(); g.roundRect(x - 0.5 * u, y - 0.3 * u, u, 0.6 * u, 0.24 * u);
      arrowhead(x + 0.14 * u, y - 0.3 * u, 1); arrowhead(x - 0.14 * u, y + 0.3 * u, -1); g.stroke();
      if (name === 'repeat-one') { g.font = `700 ${Math.round(0.4 * u)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', x, y + 0.02 * u); }
    }
    if (focused) {
      // Keyboard focus: a lit outline just inside the edge of the cap.
      const inset = 0.03 * DENSITY;
      g.strokeStyle = ENGRAVED.on; g.lineWidth = 0.018 * DENSITY;
      g.beginPath(); g.roundRect(inset, inset, w - inset * 2, h - inset * 2, 0.016 * DENSITY); g.stroke();
    }
    texture.needsUpdate = true;
  }
  let sourceMark = '';
  function markSource() {
    const signature = `${data.selected}|${data.focus}`;
    if (signature === sourceMark) return;
    sourceMark = signature;
    const { g, w, h, texture } = sourceFace, row = (y) => (2.185 - y) * DENSITY;
    g.clearRect(0, 0, w, h); g.font = type(600, 0.108); g.textAlign = 'left'; g.textBaseline = 'middle';
    for (const [name, text, y] of [['spotify', 'Spotify', SWITCH.spotify], ['music', 'Apple Music', SWITCH.music]]) {
      g.fillStyle = data.selected === name ? ENGRAVED.on : ENGRAVED.idle;
      g.fillText(text, 0.045 * DENSITY, row(y) + 0.008 * DENSITY);
      if (data.focus === name) {
        g.strokeStyle = ENGRAVED.on; g.lineWidth = 0.018 * DENSITY;
        g.beginPath(); g.roundRect(0.012 * DENSITY, row(y) - 0.095 * DENSITY, w - 0.024 * DENSITY, 0.19 * DENSITY, 0.03 * DENSITY); g.stroke();
      }
    }
    texture.needsUpdate = true;
  }

  // ---- state ------------------------------------------------------------
  let data = { selected: 'spotify', sources: {}, track: {}, error: '', alwaysOnTop: false, focus: null };
  let handler = () => {};
  let ready = false, playing = false, running = false, duration = 0;
  let trackId = '', reported = null, basePosition = 0, baseStamp = 0;
  let volume = null, shownVolume = 0, wheelVolume = 0, wheelStamp = 0;
  let seekPreview = null, dragging = null, dragY = 0, dragVolume = 0, hovered = null;
  let armAngle = ANGLE.rest, spin = 0, turn = 0, wormTurn = 0, lamp = 0, glow = 0;
  let printed = '', lastArt = '', imageRequest = 0;
  let tint = { ...DEFAULT_TINT }, tintFrom = tint, tintTo = tint, tintStart = -Infinity;
  const litColour = new THREE.Color();
  let lit = ENGRAVED.on;
  const lean = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Everything the machine lights takes the colour of the record on it.
  function applyTint(tone) {
    tint = tone;
    vinylTint.color.setHSL(tone.h, Math.min(1, tone.s * 1.35), THREE.MathUtils.lerp(0.5, tone.l, 0.35));
    wall.poolColor.value.setHSL(tone.h, Math.min(1, tone.s * 1.3), 0.62);
    wall.lampColor.value.setHSL(tone.h, Math.min(1, tone.s * 1.2), 0.6);
    glass.emissive.setHSL(tone.h, Math.min(1, tone.s * 1.2), 0.6);
    elementLit.setHSL(tone.h, Math.min(1, tone.s * 1.2), 0.66).multiplyScalar(1.9);
    litColour.setHSL(tone.h, Math.min(1, tone.s * 1.25), 0.68);
    for (const rib of ribs) rib.material.emissive.copy(litColour);
    halo.material.color.copy(litColour);
    lit = `#${litColour.getHexString()}`;
    markKeys();
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
    const track = data.track || {}, focus = data.focus;
    const transport = ready ? ENGRAVED.on : ENGRAVED.off;
    // A latching key that is on shows its legend lit in the record's colour.
    const latch = (on, available = running) => (!available ? ENGRAVED.off : on ? lit : ENGRAVED.idle);
    mark(controls.previous, 'previous', transport, 0.105, focus === 'previous');
    mark(controls.playPause, playing ? 'pause' : 'play', playing ? lit : transport, 0.15, focus === 'playPause');
    mark(controls.next, 'next', transport, 0.105, focus === 'next');
    mark(controls.shuffle, 'shuffle', latch(track.shuffle), 0.15, focus === 'shuffle');
    mark(controls.repeat, track.repeat === 'one' ? 'repeat-one' : 'repeat', latch(track.repeat && track.repeat !== 'off'), 0.15, focus === 'repeat');
    mark(controls.pin, 'pin', latch(data.alwaysOnTop, true), 0.16, focus === 'pin');
    controls.shuffle.sunk = running && !!track.shuffle;
    controls.repeat.sunk = running && !!track.repeat && track.repeat !== 'off';
    controls.pin.sunk = !!data.alwaysOnTop;
    markSource();
    armFocus.visible = focus === 'seek' && ready && duration > 0;
    wheelFocus.visible = focus === 'volume' && volume !== null;
    lightKeys();
  }
  // A cap under the pointer or holding keyboard focus catches a little more light.
  function lightKeys() {
    for (const [action, control] of Object.entries(controls)) control.cap.material.emissive.setScalar(control === hovered || data.focus === action ? 0.028 : 0);
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
    turn += spin * SPIN * dt; wormTurn += spin * 6.5 * dt;
    record.rotation.z = -turn; worm.rotation.x = wormTurn;
    if (playing && !still) moving = true;
    // The machine's light comes up as the record gets going and fades when it stops.
    glow = settle(glow, playing ? 1 : 0, 0.75, 0.003);
    // Angles are wrapped before they reach the shader so hours of playing do not cost precision.
    wall.glow.value = glow; wall.turn.value = turn % (Math.PI * 2); wall.clock.value = (now / 1000 * 2.2) % (Math.PI * 2);
    halo.material.opacity = glow * (ready ? 0.85 : 0); point.color.copy(pointDark).lerp(litColour, glow * 0.6);

    const position = positionAt(now);
    const target = !ready ? ANGLE.rest : angleAtProgress(duration > 0 ? position / duration : 0);
    armAngle = dragging === 'seek' ? target : settle(armAngle, target, 0.16, 0.0004);
    arm.rotation.z = armAngle;
    wall.armOrigin.value.set(PIVOT.x + LIGHT.x * (TOP + 0.12), PIVOT.y + LIGHT.y * (TOP + 0.12));
    wall.armAngle.value = armAngle;

    for (const control of Object.values(controls)) {
      const pressed = control.held || control.pulse > now;
      if (control.pulse > now) moving = true;
      control.travel = settle(control.travel, Math.max(pressed ? KEY.travel : 0, control.sunk ? KEY.sunk : 0), 0.045, 0.0005);
      control.group.position.z = control.base - control.travel;
    }
    thumb.position.y = settle(thumb.position.y, data.selected === 'music' ? SWITCH.music : SWITCH.spotify, 0.07, 0.0006);
    // The wheel turns with the volume and the ribs fill from the left.
    shownVolume = settle(shownVolume, volume === null ? 0 : volume, 0.09, 0.05);
    grip.rotation.x = -(shownVolume / 100) * 4.6;
    const level = (shownVolume / 100) * RIBS.count;
    ribs.forEach((rib, index) => { rib.material.emissiveIntensity = clamp(level - index, 0, 1) * 0.8; });

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
    if (action === 'shuffle' || action === 'repeat') return running;
    if (action === 'volume') return volume !== null;
    if (action === 'groove') return ready && duration > 0;
    return !!action && ready;
  };
  function pick(event) {
    aim(event);
    const action = ray.intersectObjects(hits, false)[0]?.object.userData.action;
    return enabled(action) ? action : null;
  }
  // The groove under the pointer, as a share of the side from lead-in to run-out.
  function grooveProgress(event) {
    aim(event);
    normal.set(0, 0, 1).transformDirection(deck.matrixWorld);
    anchor.set(RECORD.x, RECORD.y, RECORD.z).applyMatrix4(deck.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal, anchor);
    if (!ray.ray.intersectPlane(plane, touch)) return null;
    deck.worldToLocal(touch);
    return progressAtRadius(Math.hypot(touch.x - RECORD.x, touch.y - RECORD.y));
  }
  function hover(action) {
    const control = controls[action] || null;
    if (hovered !== control) { hovered = control; lightKeys(); schedule(); }
    canvas.style.cursor = dragging === 'volume' || action === 'volume' ? 'ns-resize' : action ? 'pointer' : 'default';
  }
  function setVolume(value) {
    const next = Math.round(clamp(value, 0, 100));
    if (next !== volume) handler('volume', next);
  }
  canvas.addEventListener('pointermove', (event) => {
    if (dragging === 'seek') {
      const progress = grooveProgress(event);
      if (progress !== null) { seekPreview = progress * duration; schedule(); }
    } else if (dragging === 'volume') setVolume(dragVolume + (dragY - event.clientY) * 0.6);
    else hover(pick(event));
  });
  canvas.addEventListener('pointerleave', () => { if (!dragging) hover(null); });
  canvas.addEventListener('pointerdown', (event) => {
    const action = pick(event);
    if (!action) return;
    if (action === 'groove') {
      const progress = grooveProgress(event);
      if (progress === null) return;
      dragging = 'seek'; seekPreview = progress * duration;
      canvas.setPointerCapture(event.pointerId); schedule();
      return;
    }
    if (action === 'volume') {
      dragging = 'volume'; dragY = event.clientY; dragVolume = volume;
      canvas.setPointerCapture(event.pointerId); hover('volume');
      return;
    }
    if (controls[action]) { controls[action].held = true; schedule(); }
    if (action === 'spotify' || action === 'music') handler('source', action);
    else if (action === 'pin') handler('pin');
    else handler(action === 'label' ? 'playPause' : action);
  });
  const release = (event) => {
    for (const control of Object.values(controls)) control.held = false;
    if (dragging === 'seek') {
      const value = seekPreview; seekPreview = null;
      if (event.type === 'pointerup' && value !== null) {
        // Hold the stylus where it was set down until the player confirms.
        basePosition = value; baseStamp = performance.now();
        handler('seek', value);
      }
    }
    if (dragging) { dragging = null; hover(event.type === 'pointerup' ? pick(event) : null); }
    schedule();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  // Rolling over the wheel turns it.
  canvas.addEventListener('wheel', (event) => {
    if (pick(event) !== 'volume') return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelStamp > 500) wheelVolume = volume;
    wheelStamp = now; wheelVolume = clamp(wheelVolume - event.deltaY * 0.12, 0, 100);
    setVolume(wheelVolume);
  }, { passive: false });
  window.addEventListener('pointermove', (event) => {
    lean.targetY = (event.clientX / window.innerWidth - 0.5) * 0.07;
    lean.targetX = (event.clientY / window.innerHeight - 0.5) * 0.05;
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
    // A key worked from the keyboard dips like one pressed by hand.
    press(action) { if (controls[action]) { controls[action].pulse = performance.now() + 150; schedule(); } },
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
      trackId = nextId; reported = position; ready = nextReady; playing = nextPlaying; running = !!track.running;
      volume = running && Number.isFinite(track.volume) ? clamp(track.volume, 0, 100) : null;
      showArtwork(ready ? track.artworkUrl || '' : '');
      markKeys(); schedule();
    }
  };

  // Seen head-on, every flat face would mirror the studio's key light and wash
  // out. Tipping the reflections keeps faces dark and lets edges catch the light.
  scene.traverse((object) => { if (object.material?.envMap) object.material.envMapRotation.set(ENV_TILT, 0, 0); });
  plainLabel(); applyTint(DEFAULT_TINT); resize();
}

(() => {
  const canvas = document.getElementById('turntable');
  const fallback = document.getElementById('turntable-fallback');
  // Without WebGL, or if the scene cannot be built, the plain controls take over.
  const fail = () => { fallback?.classList.add('visible'); canvas.style.display = 'none'; };
  try { build(canvas, fail); }
  catch (_) { fail(); window.turntable = { update() {}, onAction() {} }; }
})();
