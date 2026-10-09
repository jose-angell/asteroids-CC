'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

// Silueta fija de asteroide grande (trazada de la imagen de referencia, en px de imagen).
// Se centra y normaliza para que el vértice más lejano quede a radio 1.
const BIG_SHAPE = (() => {
  const raw = [
    [188, 63], [267, 87], [251, 171], [330, 195], [307, 282],
    [238, 279], [205, 335], [107, 288], [62, 206], [83, 119],
  ];
  const cx = raw.reduce((s, p) => s + p[0], 0) / raw.length;
  const cy = raw.reduce((s, p) => s + p[1], 0) / raw.length;
  const max = Math.max(...raw.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  return raw.map(p => [(p[0] - cx) / max, (p[1] - cy) / max]);
})();
const BIG_SHAPE_CHANCE = 0.35;  // probabilidad de que un asteroide grande use esta silueta

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    this.verts = [];
    if (size === 3 && Math.random() < BIG_SHAPE_CHANCE) {
      // Variante grande con silueta fija
      for (const [vx, vy] of BIG_SHAPE)
        this.verts.push([vx * this.radius, vy * this.radius]);
    } else {
      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = ship.slowMo > 0 ? SLOW_COLOR : '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Meteor (lluvia de meteoritos) ─────────────────────────────────────────────
class Meteor {
  constructor(x, y, angle, speed) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = rand(7, 12);
    this.rotSpeed = rand(-2, 2);
    this.rot = rand(0, Math.PI * 2);
    this.entered = false;   // ya estuvo dentro del canvas
    this.ttl = 8;           // seguridad: nunca queda uno vivo para siempre
    this.dead = false;

    this.verts = [];
    const n = randInt(6, 8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.65, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    // Sin wrap: cruza la pantalla una sola vez
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rot += this.rotSpeed * dt;
    this.ttl -= dt;
    const m = this.radius + 20;
    const inside = this.x > -m && this.x < W + m && this.y > -m && this.y < H + m;
    if (inside) this.entered = true;
    else if (this.entered) this.dead = true;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const color = ship.slowMo > 0 ? SLOW_COLOR : SHOWER_COLOR;
    ctx.save();
    // Estela corta opuesta al movimiento
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.08, this.y - this.vy * 0.08);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.lineWidth = 1.5;
    ctx.lineJoin  = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Power-up: Disparo Triple ──────────────────────────────────────────────────
const TRIPLE_DURATION = 10;    // s de efecto
const TRIPLE_SPREAD   = 0.22;  // rad entre balas del abanico
const POWERUP_CHANCE  = 0.12;  // probabilidad por asteroide destruido (hasta que aparezca)
const POWERUP_TTL     = 10;    // s que el ítem permanece en pantalla
const POWERUP_COLOR   = '#0ff';

// ── Power-up: Escudo Temporal ─────────────────────────────────────────────────
const SHIELD_DURATION = 5;     // s de efecto
const SHIELD_RADIUS   = 22;    // radio del círculo de energía
const SHIELD_CHANCE   = 0.12;  // probabilidad por asteroide destruido (hasta que aparezca)
const SHIELD_GRACE    = 1;     // s de invencibilidad tras absorber un golpe
const SHIELD_COLOR    = '#4af';

// ── Power-up: Cámara Lenta ────────────────────────────────────────────────────
const SLOW_DURATION = 6;       // s de efecto
const SLOW_FACTOR   = 0.5;     // multiplicador de velocidad de los asteroides
const SLOW_CHANCE   = 0.12;    // probabilidad por asteroide destruido (hasta que aparezca)
const SLOW_COLOR    = '#c8f';

// ── Power-up: Bomba Nova ──────────────────────────────────────────────────────
const NOVA_CHANCE  = 0.004;    // muy escaso: prob. por asteroide destruido (~10-20% por nivel), nunca forzado
const NOVA_MIN_LEVEL = 3;      // no aparece en los primeros niveles
const NOVA_COLOR   = '#f84';
const NOVA_FX_TIME = 0.6;      // s de la onda expansiva visual

// ── Power-up: Hiperpropulsión ─────────────────────────────────────────────────
const HYPER_DURATION  = 8;     // s de efecto
const HYPER_THRUST    = 2.5;   // multiplicador de aceleración (260 → 650 px/s²)
const HYPER_ROT       = 1.4;   // multiplicador de giro
const HYPER_MAX_SPEED = 560;   // px/s, tope durante el efecto (normal ≈ 330)
const HYPER_CHANCE    = 0.12;  // probabilidad por asteroide destruido (hasta que aparezca)
const HYPER_COLOR     = '#8f4';

// ── Lluvia de meteoritos ──────────────────────────────────────────────────────
const SHOWER_MIN_DELAY = 20;   // s mínimos entre lluvias
const SHOWER_MAX_DELAY = 35;   // s máximos entre lluvias
const SHOWER_WARN      = 1;    // s de aviso (sin indicar dirección)
const SHOWER_BASE      = 6;    // meteoritos = min(SHOWER_BASE + nivel, SHOWER_MAX)
const SHOWER_MAX       = 14;
const METEOR_SPEED     = 210;  // px/s comunes a toda la oleada
const METEOR_SPREAD    = 0.06; // rad de desviación por meteorito
const METEOR_POINTS    = 30;
const SHOWER_COLOR     = '#fa4';

const ITEM_COLORS  = { triple: POWERUP_COLOR, shield: SHIELD_COLOR, slow: SLOW_COLOR, nova: NOVA_COLOR, hyper: HYPER_COLOR };

class PowerUp {
  constructor(x, y, type = 'triple') {
    this.x = x;
    this.y = y;
    this.type  = type;
    this.color = ITEM_COLORS[type];
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 30;
    this.vy = Math.sin(angle) * 30;
    this.radius = 10;
    this.ttl  = POWERUP_TTL;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo en los últimos 3 s
    if (this.ttl < 3 && Math.floor(this.ttl * 6) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = this.color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Reloj: arco exterior que se consume con el tiempo restante
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 5, -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * (this.ttl / POWERUP_TTL));
    ctx.stroke();
    ctx.lineWidth = 1.5;
    if (this.type === 'shield') {
      // Escudo: contorno heráldico
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, -6);
      ctx.lineTo(6, 1);
      ctx.quadraticCurveTo(6, 7, 0, 9);
      ctx.quadraticCurveTo(-6, 7, -6, 1);
      ctx.closePath();
      ctx.stroke();
    } else if (this.type === 'nova') {
      // Estallido: rayos radiales
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 2, Math.sin(a) * 2);
        ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
        ctx.stroke();
      }
    } else if (this.type === 'hyper') {
      // Doble chevrón apuntando hacia arriba
      for (const dy of [-3, 4]) {
        ctx.beginPath();
        ctx.moveTo(-6, dy + 4);
        ctx.lineTo(0, dy - 3);
        ctx.lineTo(6, dy + 4);
        ctx.stroke();
      }
    } else if (this.type === 'slow') {
      // Reloj de arena
      ctx.beginPath();
      ctx.moveTo(-5, -7);
      ctx.lineTo(5, -7);
      ctx.lineTo(-5, 7);
      ctx.lineTo(5, 7);
      ctx.closePath();
      ctx.stroke();
    } else {
      // Tres líneas en abanico
      for (const a of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.lineTo(Math.sin(a) * 8, 5 - Math.cos(a) * 11);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.tripleShot    = 0;
    this.shield        = 0;
    this.slowMo        = 0;
    this.hyper         = 0;
    this.nova          = false;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.tripleShot    > 0) this.tripleShot    -= dt;
    if (this.shield        > 0) this.shield        -= dt;
    if (this.slowMo        > 0) this.slowMo        -= dt;
    if (this.hyper         > 0) this.hyper         -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const hyper  = this.hyper > 0;
    const ROT    = 3.5 * (hyper ? HYPER_ROT : 1);     // rad/s
    const THRUST = 260 * (hyper ? HYPER_THRUST : 1);  // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    if (hyper) {
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > HYPER_MAX_SPEED) {
        this.vx *= HYPER_MAX_SPEED / speed;
        this.vy *= HYPER_MAX_SPEED / speed;
      }
    }
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0)
      return [-TRIPLE_SPREAD, 0, TRIPLE_SPREAD].map(d => new Bullet(ox, oy, this.angle + d));
    return [new Bullet(ox, oy, this.angle)];
  }

  draw() {
    if (this.dead) return;

    // Escudo: círculo pulsante, parpadea en el último segundo
    if (this.shield > 0 && (this.shield > 1 || Math.floor(this.shield * 8) % 2 === 1)) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(performance.now() / 120);
      ctx.strokeStyle = SHIELD_COLOR;
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, SHIELD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    const hyper = this.hyper > 0;
    if (this.thrusting && (hyper || Math.random() > 0.35)) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - (hyper ? rand(14, 26) : rand(6, 14)), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = hyper ? HYPER_COLOR : 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles;
let powerUp, powerUpSpawned;
let shieldItem, shieldSpawned;
let slowItem, slowSpawned;
let hyperItem, hyperSpawned;
let novaItem, novaSpawned;
let novaFx = 0, novaX = 0, novaY = 0;   // onda expansiva: s restantes y origen
let meteors, showerTimer, showerWarn;   // lluvia: meteoritos, s hasta la próxima, s de aviso restantes
let score, lives, level;
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

const nextShowerDelay = () => rand(SHOWER_MIN_DELAY, SHOWER_MAX_DELAY);

// Oleada: todos con la misma dirección (± un pequeño desvío), entrando escalonados desde fuera del canvas.
function spawnShower() {
  const theta = rand(0, Math.PI * 2);
  const dx = Math.cos(theta), dy = Math.sin(theta);
  const R = Math.hypot(W, H) / 2 + 40;
  const count = Math.min(SHOWER_BASE + level, SHOWER_MAX);
  for (let i = 0; i < count; i++) {
    const side = rand(-R, R);    // posición a lo largo de la perpendicular
    const back = rand(0, 250);   // escalonado hacia atrás
    const x = W / 2 - dx * (R + back) - dy * side;
    const y = H / 2 - dy * (R + back) + dx * side;
    meteors.push(new Meteor(x, y, theta + rand(-METEOR_SPREAD, METEOR_SPREAD), METEOR_SPEED + rand(-15, 15)));
  }
}

function destroyMeteor(m) {
  m.dead = true;
  score += METEOR_POINTS;
  explode(m.x, m.y, 6);
}

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUp = null;
  powerUpSpawned = false;
  shieldItem = null;
  shieldSpawned = false;
  slowItem = null;
  slowSpawned = false;
  hyperItem = null;
  hyperSpawned = false;
  novaItem = null;
  novaSpawned = false;
  novaFx = 0;
  meteors = [];
  showerTimer = nextShowerDelay();
  showerWarn = 0;
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUpSpawned = false;          // un power-up garantizado por nivel
  shieldSpawned = false;
  slowSpawned = false;
  hyperSpawned = false;
  novaSpawned = false;
  meteors = [];
  showerTimer = nextShowerDelay();
  showerWarn = 0;
  const triple = ship.tripleShot;  // los efectos sobreviven al cambio de nivel
  const shield = ship.shield;
  const slowMo = ship.slowMo;
  const hyper  = ship.hyper;
  const nova   = ship.nova;
  ship.reset();
  ship.tripleShot = triple;
  ship.shield = shield;
  ship.slowMo = slowMo;
  ship.hyper  = hyper;
  ship.nova   = nova;
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

// Destruye un asteroide: puntos, explosión, fragmentos y posible aparición de power-ups.
// `newAsteroids` acumula los fragmentos del frame en curso.
function destroyAsteroid(a, newAsteroids) {
  a.dead = true;
  score += POINTS[a.size];
  explode(a.x, a.y, a.size * 5);
  newAsteroids.push(...a.split());
  // Garantiza al menos un power-up de cada tipo por nivel: si era el último asteroide, aparece sí o sí
  const last = asteroids.filter(o => !o.dead).length + newAsteroids.length === 0;
  if (!powerUpSpawned && !powerUp && (last || Math.random() < POWERUP_CHANCE)) {
    powerUp = new PowerUp(a.x, a.y);
    powerUpSpawned = true;
  }
  if (!shieldSpawned && !shieldItem && (last || Math.random() < SHIELD_CHANCE)) {
    // Si salen a la vez, separar el escudo para que no se solapen
    shieldItem = new PowerUp(a.x + (powerUp ? 26 : 0), a.y, 'shield');
    shieldSpawned = true;
  }
  if (!slowSpawned && !slowItem && (last || Math.random() < SLOW_CHANCE)) {
    // Separar de los otros ítems si salen a la vez
    slowItem = new PowerUp(a.x - ((powerUp ? 1 : 0) + (shieldItem ? 1 : 0)) * 26, a.y, 'slow');
    slowSpawned = true;
  }
  if (!hyperSpawned && !hyperItem && (last || Math.random() < HYPER_CHANCE)) {
    hyperItem = new PowerUp(a.x, a.y - 26, 'hyper');
    hyperSpawned = true;
  }
  // Bomba Nova: escasa, nunca forzada; no aparece si ya hay una en reserva
  if (level >= NOVA_MIN_LEVEL && !novaSpawned && !novaItem && !ship.nova && Math.random() < NOVA_CHANCE) {
    novaItem = new PowerUp(a.x, a.y + 26, 'nova');
    novaSpawned = true;
  }
}

// Bomba Nova: desintegra todos los asteroides (sin fragmentos) y suma sus puntos.
// Con la lista vacía, el chequeo de "Nivel completado" pasa de nivel en el mismo frame.
function detonateNova() {
  ship.nova = false;
  for (const a of asteroids) {
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 5);
  }
  asteroids = [];
  for (const m of meteors) destroyMeteor(m);
  meteors = [];
  novaFx = NOVA_FX_TIME;
  novaX = ship.x;
  novaY = ship.y;
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  ship.slowMo = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function updatePowerUp(dt) {
  if (!powerUp) return;
  powerUp.update(dt);
  if (powerUp.dead) powerUp = null;
}

function updateShieldItem(dt) {
  if (!shieldItem) return;
  shieldItem.update(dt);
  if (shieldItem.dead) shieldItem = null;
}

function updateSlowItem(dt) {
  if (!slowItem) return;
  slowItem.update(dt);
  if (slowItem.dead) slowItem = null;
}

function updateHyperItem(dt) {
  if (!hyperItem) return;
  hyperItem.update(dt);
  if (hyperItem.dead) hyperItem = null;
}

function updateNovaItem(dt) {
  if (!novaItem) return;
  novaItem.update(dt);
  if (novaItem.dead) novaItem = null;
}

function update(dt) {
  if (novaFx > 0) novaFx -= dt;

  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    asteroids.forEach(a => a.update(dt));
    meteors.forEach(m => m.update(dt));
    meteors = meteors.filter(m => !m.dead);
    updatePowerUp(dt);
    updateShieldItem(dt);
    updateSlowItem(dt);
    updateHyperItem(dt);
    updateNovaItem(dt);
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (pressed('Space')) {
    bullets.push(...ship.tryShoot());
  }
  if (pressed('ArrowDown') && ship.nova) detonateNova();

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  const adt = ship.slowMo > 0 ? dt * SLOW_FACTOR : dt;  // cámara lenta: solo asteroides
  asteroids.forEach(a => a.update(adt));
  meteors.forEach(m => m.update(adt));
  particles.forEach(p => p.update(dt));

  // Lluvia de meteoritos: aviso de SHOWER_WARN s y luego la oleada
  if (showerWarn > 0) {
    showerWarn -= dt;
    if (showerWarn <= 0) { spawnShower(); showerTimer = nextShowerDelay(); }
  } else {
    showerTimer -= dt;
    if (showerTimer <= 0) showerWarn = SHOWER_WARN;
  }
  updatePowerUp(dt);
  updateShieldItem(dt);
  updateSlowItem(dt);
  updateHyperItem(dt);
  updateNovaItem(dt);

  bullets  = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);

  // Recoger power-up
  if (powerUp && dist(ship, powerUp) < ship.radius + powerUp.radius) {
    ship.tripleShot = TRIPLE_DURATION;
    explode(powerUp.x, powerUp.y, 6);
    powerUp = null;
  }

  // Recoger escudo
  if (shieldItem && dist(ship, shieldItem) < ship.radius + shieldItem.radius) {
    ship.shield = SHIELD_DURATION;
    explode(shieldItem.x, shieldItem.y, 6);
    shieldItem = null;
  }

  // Recoger cámara lenta
  if (slowItem && dist(ship, slowItem) < ship.radius + slowItem.radius) {
    ship.slowMo = SLOW_DURATION;
    explode(slowItem.x, slowItem.y, 6);
    slowItem = null;
  }

  // Recoger hiperpropulsión
  if (hyperItem && dist(ship, hyperItem) < ship.radius + hyperItem.radius) {
    ship.hyper = HYPER_DURATION;
    explode(hyperItem.x, hyperItem.y, 6);
    hyperItem = null;
  }

  // Recoger bomba nova
  if (novaItem && dist(ship, novaItem) < ship.radius + novaItem.radius) {
    ship.nova = true;
    explode(novaItem.x, novaItem.y, 6);
    novaItem = null;
  }

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        destroyAsteroid(a, newAsteroids);
      }
    }
  }
  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);

  // Bala vs meteorito
  for (const b of bullets) {
    for (const m of meteors) {
      if (!m.dead && !b.dead && dist(b, m) < m.radius) {
        b.dead = true;
        destroyMeteor(m);
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // Nave vs asteroide / meteorito
  if (ship.invincible <= 0) {
    const shielded = ship.shield > 0;
    const r = shielded ? SHIELD_RADIUS : ship.radius;
    const extra = [];
    let hit = false;
    for (const a of asteroids) {
      if (dist(ship, a) < r + a.radius * 0.82) {
        hit = true;
        if (shielded) {
          destroyAsteroid(a, extra);
          ship.shield = 0;
          ship.invincible = SHIELD_GRACE;  // evita morir con los fragmentos
        } else {
          killShip();
        }
        break;
      }
    }
    if (!hit) {
      for (const m of meteors) {
        if (dist(ship, m) < r + m.radius * 0.82) {
          if (shielded) {
            destroyMeteor(m);
            ship.shield = 0;
            ship.invincible = SHIELD_GRACE;
          } else {
            killShip();
          }
          break;
        }
      }
    }
    if (extra.length || shielded) asteroids = asteroids.filter(a => !a.dead).concat(extra);
  }
  meteors = meteors.filter(m => !m.dead);

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  ctx.textAlign = 'left';
  let y = 46;
  const effects = [
    ['TRIPLE', ship.tripleShot, TRIPLE_DURATION, POWERUP_COLOR],
    ['ESCUDO', ship.shield,     SHIELD_DURATION, SHIELD_COLOR],
    ['LENTO',  ship.slowMo,     SLOW_DURATION,   SLOW_COLOR],
    ['HIPER',  ship.hyper,      HYPER_DURATION,  HYPER_COLOR],
  ];
  for (const [name, left, total, color] of effects) {
    if (left <= 0) continue;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.fillText(`${name}  ${left.toFixed(1)}s`, 14, y);
    // Barra de tiempo restante
    ctx.lineWidth = 1;
    ctx.strokeRect(14.5, y + 8.5, 100, 6);
    ctx.fillRect(14, y + 8, 101 * (left / total), 7);
    y += 34;
  }

  if (ship.nova) {
    ctx.fillStyle = NOVA_COLOR;
    ctx.fillText('NOVA  [↓]', 14, y);
    y += 20;
  }

  for (const [item, label] of [[powerUp, 'POWER-UP'], [shieldItem, 'ESCUDO'], [slowItem, 'LENTO'], [hyperItem, 'HIPER'], [novaItem, 'NOVA']]) {
    if (!item) continue;
    ctx.fillStyle = item.color;
    ctx.fillText(`${label}  ${Math.ceil(item.ttl)}s`, 14, y);
    y += 20;
  }

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  meteors.forEach(m => m.draw());
  if (powerUp) powerUp.draw();
  if (shieldItem) shieldItem.draw();
  if (slowItem) slowItem.draw();
  if (hyperItem) hyperItem.draw();
  if (novaItem) novaItem.draw();
  bullets.forEach(b => b.draw());
  ship.draw();

  // Onda expansiva de la Bomba Nova
  if (novaFx > 0) {
    const t = 1 - novaFx / NOVA_FX_TIME;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = NOVA_COLOR;
    ctx.lineWidth   = 4;
    ctx.beginPath();
    ctx.arc(novaX, novaY, t * Math.hypot(W, H), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Aviso de lluvia: simétrico (texto + marco en los 4 bordes) para no revelar la dirección
  if (showerWarn > 0 && state === 'playing' && Math.floor(showerWarn * 8) % 2 === 1) {
    ctx.save();
    ctx.strokeStyle = SHOWER_COLOR;
    ctx.fillStyle   = SHOWER_COLOR;
    ctx.lineWidth   = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.textAlign = 'center';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('¡LLUVIA DE METEORITOS!', W / 2, H / 2 - 110);
    ctx.restore();
  }

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
