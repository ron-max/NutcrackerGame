import * as THREE from 'three';
import './styles.css';

const canvas = document.querySelector('#gameCanvas');
const waveValue = document.querySelector('#waveValue');
const scoreValue = document.querySelector('#scoreValue');
const healthFill = document.querySelector('#healthFill');
const bombRack = document.querySelector('#bombRack');
const pauseButton = document.querySelector('#pauseButton');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayMessage = document.querySelector('#overlayMessage');
const overlayAction = document.querySelector('#overlayAction');
const bombButton = document.querySelector('#bombButton');
const moveStick = document.querySelector('#moveStick');
const stickKnob = document.querySelector('#stickKnob');

const MAX_HEALTH = 100;
const MAX_BOMBS = 4;
const ARENA_RADIUS = 19;
const GRAVITY = 17;
const PLAYER_TURN_SPEED = 3.2;
const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11131a);
scene.fog = new THREE.Fog(0x11131a, 20, 52);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
camera.position.set(0, 8.4, -12);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const clock = new THREE.Clock();

const materials = {
  soldierBlue: new THREE.MeshStandardMaterial({ color: 0x244e9f, roughness: 0.52 }),
  soldierRed: new THREE.MeshStandardMaterial({ color: 0xbb2f3a, roughness: 0.58 }),
  trimGold: new THREE.MeshStandardMaterial({
    color: 0xf2ce62,
    metalness: 0.32,
    roughness: 0.35,
  }),
  face: new THREE.MeshStandardMaterial({ color: 0xf0bd83, roughness: 0.55 }),
  black: new THREE.MeshStandardMaterial({ color: 0x17191f, roughness: 0.7 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf7efe2, roughness: 0.45 }),
  mouse: new THREE.MeshStandardMaterial({ color: 0x7a7b86, roughness: 0.68 }),
  mouseDark: new THREE.MeshStandardMaterial({ color: 0x4e505b, roughness: 0.72 }),
  mousePower: new THREE.MeshStandardMaterial({
    color: 0x60e7ff,
    emissive: 0x0a91c2,
    emissiveIntensity: 0.9,
    roughness: 0.36,
  }),
  bomb: new THREE.MeshStandardMaterial({ color: 0x191a1f, roughness: 0.42 }),
  fuse: new THREE.MeshStandardMaterial({
    color: 0xfff0a8,
    emissive: 0xffa000,
    emissiveIntensity: 0.8,
  }),
  wood: new THREE.MeshStandardMaterial({ color: 0x7b5032, roughness: 0.76 }),
  snow: new THREE.MeshStandardMaterial({ color: 0xdfeeed, roughness: 0.62 }),
  pine: new THREE.MeshStandardMaterial({ color: 0x1e6e43, roughness: 0.7 }),
  candyRed: new THREE.MeshStandardMaterial({ color: 0xc73a45, roughness: 0.55 }),
};

const state = {
  running: true,
  gameOver: false,
  score: 0,
  wave: 1,
  health: MAX_HEALTH,
  bombs: MAX_BOMBS,
  bombRecharge: 0,
  playerCooldown: 0,
  spawnTimer: 0.2,
  miceToSpawn: 7,
  waveBannerTimer: 0,
  keys: new Set(),
  moveInput: new THREE.Vector2(),
  touchMove: new THREE.Vector2(),
  aimYaw: 0,
  playerVelocity: new THREE.Vector3(),
  mice: [],
  bombsLive: [],
  particles: [],
  allies: [],
  hitTimers: new WeakMap(),
};

let audioContext;

initLights();
initWorld();

const player = createSoldier({
  coat: materials.soldierBlue,
  plume: 0x5cc8ff,
  scale: 1.05,
});
player.position.set(0, 0, 0);
scene.add(player);

createAllies();
seedOpeningWave();
syncBombRack();
resize();
window.addEventListener('resize', resize);
bindInput();
animate();

function initLights() {
  const ambient = new THREE.HemisphereLight(0xe8f6ff, 0x2c1812, 1.8);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xd8f3ff, 2.7);
  moon.position.set(-12, 18, -8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -28;
  moon.shadow.camera.right = 28;
  moon.shadow.camera.top = 28;
  moon.shadow.camera.bottom = -28;
  scene.add(moon);

  const stageGlow = new THREE.PointLight(0xffd16f, 120, 30, 1.8);
  stageGlow.position.set(0, 6, 0);
  scene.add(stageGlow);
}

function initWorld() {
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(ARENA_RADIUS, ARENA_RADIUS, 0.5, 96),
    materials.wood,
  );
  floor.receiveShadow = true;
  floor.position.y = -0.28;
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA_RADIUS, 0.22, 12, 128),
    materials.trimGold,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  ring.receiveShadow = true;
  scene.add(ring);

  const snowRing = new THREE.Mesh(
    new THREE.TorusGeometry(ARENA_RADIUS - 2.2, 0.08, 8, 128),
    materials.snow,
  );
  snowRing.rotation.x = Math.PI / 2;
  snowRing.position.y = 0.07;
  scene.add(snowRing);

  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    const radius = ARENA_RADIUS - 1.1;
    const post = new THREE.Group();
    const stripeA = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 2.2, 14),
      i % 2 === 0 ? materials.candyRed : materials.white,
    );
    stripeA.castShadow = true;
    stripeA.position.y = 1.1;
    post.add(stripeA);

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), materials.trimGold);
    cap.position.y = 2.32;
    cap.castShadow = true;
    post.add(cap);

    post.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    scene.add(post);
  }

  createTree();
  createToyBlocks();
}

function createTree() {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.5, 1.5, 12), materials.wood);
  trunk.castShadow = true;
  trunk.position.y = 0.75;
  tree.add(trunk);

  for (let i = 0; i < 4; i += 1) {
    const layer = new THREE.Mesh(
      new THREE.ConeGeometry(2.8 - i * 0.48, 1.7, 22),
      materials.pine,
    );
    layer.position.y = 1.55 + i * 0.9;
    layer.castShadow = true;
    tree.add(layer);
  }

  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), materials.trimGold);
  star.position.y = 5.2;
  star.castShadow = true;
  tree.add(star);

  tree.position.set(0, 0, 7.8);
  scene.add(tree);
}

function createToyBlocks() {
  const blockMaterials = [
    materials.soldierRed,
    materials.trimGold,
    materials.pine,
    new THREE.MeshStandardMaterial({ color: 0x5a78d6, roughness: 0.65 }),
  ];

  for (let i = 0; i < 22; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 7 + Math.random() * 9;
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      blockMaterials[i % blockMaterials.length],
    );
    block.position.set(Math.sin(angle) * radius, 0.35, Math.cos(angle) * radius);
    block.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  }
}

function createSoldier({ coat, plume, scale = 1 }) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const bootL = box(0.26, 0.32, 0.32, materials.black, -0.22, 0.16, 0);
  const bootR = box(0.26, 0.32, 0.32, materials.black, 0.22, 0.16, 0);
  const legL = box(0.22, 0.74, 0.24, materials.white, -0.2, 0.65, 0);
  const legR = box(0.22, 0.74, 0.24, materials.white, 0.2, 0.65, 0);
  const torso = box(0.82, 1.05, 0.42, coat, 0, 1.35, 0);
  const sash = box(0.9, 0.13, 0.46, materials.trimGold, 0, 1.53, 0.01);
  sash.rotation.z = -0.55;
  const shoulderL = sphere(0.18, materials.trimGold, -0.52, 1.78, 0);
  const shoulderR = sphere(0.18, materials.trimGold, 0.52, 1.78, 0);
  const head = sphere(0.31, materials.face, 0, 2.1, 0.02);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.58, 20), materials.black);
  hat.position.y = 2.55;
  hat.castShadow = true;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), materials.trimGold);
  brim.position.y = 2.26;
  brim.castShadow = true;
  const plumeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 8),
    new THREE.MeshStandardMaterial({
      color: plume,
      emissive: plume,
      emissiveIntensity: 0.35,
      roughness: 0.45,
    }),
  );
  plumeMesh.position.set(0.2, 2.85, 0.06);
  plumeMesh.castShadow = true;

  const armL = box(0.18, 0.72, 0.18, coat, -0.58, 1.35, 0);
  armL.rotation.z = 0.22;
  const armR = box(0.18, 0.72, 0.18, coat, 0.58, 1.35, 0);
  armR.rotation.z = -0.22;

  const baton = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.05, 8), materials.trimGold);
  baton.position.set(0.63, 1.2, 0.25);
  baton.rotation.x = Math.PI / 2.8;
  baton.rotation.z = -0.3;
  baton.castShadow = true;

  group.add(
    bootL,
    bootR,
    legL,
    legR,
    torso,
    sash,
    shoulderL,
    shoulderR,
    head,
    hat,
    brim,
    plumeMesh,
    armL,
    armR,
    baton,
  );
  return group;
}

function createAllies() {
  const spots = [
    { x: -5.5, z: 3.7, yaw: -0.4, color: 0xd14b49 },
    { x: 5.5, z: 3.7, yaw: 0.4, color: 0x2f7d55 },
  ];

  for (const spot of spots) {
    const soldier = createSoldier({
      coat: new THREE.MeshStandardMaterial({ color: spot.color, roughness: 0.58 }),
      plume: 0xf5d36c,
      scale: 0.9,
    });
    soldier.position.set(spot.x, 0, spot.z);
    soldier.rotation.y = spot.yaw;
    scene.add(soldier);
    state.allies.push({
      group: soldier,
      cooldown: 1 + Math.random() * 1.5,
    });
  }
}

function box(width, height, depth, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sphere(radius, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function bindInput() {
  window.addEventListener('keydown', (event) => {
    ensureAudio();
    if (event.code === 'Escape') {
      togglePause();
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      throwPlayerBomb();
      return;
    }
    state.keys.add(event.code);
  });

  window.addEventListener('keyup', (event) => {
    state.keys.delete(event.code);
  });

  canvas.addEventListener('pointerdown', () => {
    ensureAudio();
    throwPlayerBomb();
  });

  pauseButton.addEventListener('click', () => {
    ensureAudio();
    togglePause();
  });

  overlayAction.addEventListener('click', () => {
    ensureAudio();
    if (state.gameOver) {
      restartGame();
      return;
    }
    setPaused(false);
  });

  bombButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    ensureAudio();
    throwPlayerBomb();
  });

  bindStick();
}

function bindStick() {
  let activePointerId = null;
  const center = new THREE.Vector2();

  moveStick.addEventListener('pointerdown', (event) => {
    activePointerId = event.pointerId;
    moveStick.setPointerCapture(activePointerId);
    const rect = moveStick.getBoundingClientRect();
    center.set(rect.left + rect.width / 2, rect.top + rect.height / 2);
    updateStick(event, center);
  });

  moveStick.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return;
    updateStick(event, center);
  });

  const clearStick = (event) => {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    state.touchMove.set(0, 0);
    stickKnob.style.transform = 'translate(0px, 0px)';
  };

  moveStick.addEventListener('pointerup', clearStick);
  moveStick.addEventListener('pointercancel', clearStick);
}

function updateStick(event, center) {
  event.preventDefault();
  const dx = event.clientX - center.x;
  const dy = event.clientY - center.y;
  const length = Math.min(44, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * length;
  const y = Math.sin(angle) * length;
  stickKnob.style.transform = `translate(${x}px, ${y}px)`;
  state.touchMove.set(x / 44, y / 44);
}

function togglePause() {
  if (state.gameOver) return;
  setPaused(state.running);
}

function setPaused(paused) {
  state.running = !paused;
  overlay.classList.toggle('is-hidden', !paused);
  if (paused) {
    overlayTitle.textContent = 'Paused';
    overlayMessage.textContent = 'The mouse charge is waiting.';
    overlayAction.textContent = 'Resume';
  }
}

function restartGame() {
  for (const mouse of state.mice) scene.remove(mouse.group);
  for (const bomb of state.bombsLive) scene.remove(bomb.group);
  for (const particle of state.particles) scene.remove(particle.mesh);
  state.mice = [];
  state.bombsLive = [];
  state.particles = [];
  state.score = 0;
  state.wave = 1;
  state.health = MAX_HEALTH;
  state.bombs = MAX_BOMBS;
  state.bombRecharge = 0;
  state.playerCooldown = 0;
  state.spawnTimer = 0.2;
  state.miceToSpawn = 7;
  state.waveBannerTimer = 0;
  state.gameOver = false;
  state.running = true;
  player.position.set(0, 0, 0);
  state.aimYaw = 0;
  seedOpeningWave();
  overlay.classList.add('is-hidden');
  syncBombRack();
  updateHud();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  if (state.running) update(dt);
  render();
}

function update(dt) {
  state.playerCooldown = Math.max(0, state.playerCooldown - dt);
  rechargeBombs(dt);
  updatePlayer(dt);
  updateWave(dt);
  updateMice(dt);
  updateAllies(dt);
  updateBombs(dt);
  updateParticles(dt);
  updateCamera(dt);
  updateHud();
}

function updatePlayer(dt) {
  const keyboard = state.moveInput.set(0, 0);
  if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) keyboard.y += 1;
  if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) keyboard.y -= 1;
  if (state.keys.has('KeyA') || state.keys.has('ArrowLeft')) keyboard.x -= 1;
  if (state.keys.has('KeyD') || state.keys.has('ArrowRight')) keyboard.x += 1;

  const turnInput = THREE.MathUtils.clamp(keyboard.x + state.touchMove.x, -1, 1);
  const forwardInput = THREE.MathUtils.clamp(keyboard.y - state.touchMove.y, -1, 1);

  if (Math.abs(turnInput) > 0.001) {
    state.aimYaw += turnInput * PLAYER_TURN_SPEED * dt;
  }

  if (Math.abs(forwardInput) > 0.001) {
    const moveSpeed = forwardInput > 0 ? 6.8 : 4.2;
    tmpVec.set(
      Math.sin(state.aimYaw) * forwardInput * moveSpeed,
      0,
      Math.cos(state.aimYaw) * forwardInput * moveSpeed,
    );
    state.playerVelocity.lerp(tmpVec, 0.22);
  } else {
    state.playerVelocity.multiplyScalar(0.78);
  }

  player.position.addScaledVector(state.playerVelocity, dt);
  clampToArena(player.position, ARENA_RADIUS - 4);
  player.rotation.y = smoothAngle(player.rotation.y, state.aimYaw, 0.22);

  const stride = state.playerVelocity.length() * 0.05;
  player.position.y = Math.sin(performance.now() * 0.012) * stride;
}

function updateWave(dt) {
  if (state.miceToSpawn > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.mice.length < 22) {
      spawnMouse();
      state.miceToSpawn -= 1;
      state.spawnTimer = Math.max(0.42, 1.1 - state.wave * 0.05);
    }
  } else if (state.mice.length === 0) {
    state.wave += 1;
    state.miceToSpawn = 6 + state.wave * 2;
    state.spawnTimer = 1.1;
    state.health = Math.min(MAX_HEALTH, state.health + 16);
    state.bombs = MAX_BOMBS;
    syncBombRack();
    playTone(660, 0.09, 'triangle', 0.06);
    playTone(990, 0.1, 'triangle', 0.05, 0.08);
  }
}

function seedOpeningWave() {
  const openingSpots = [
    { position: new THREE.Vector3(-6.2, 0, 11.2), launch: true },
    { position: new THREE.Vector3(6.1, 0, 10.7), launch: true },
    { position: new THREE.Vector3(0.4, 0, 14.2), launch: false },
  ];

  for (const spot of openingSpots) {
    if (state.miceToSpawn <= 0) break;
    spawnMouse(spot);
    state.miceToSpawn -= 1;
  }
}

function spawnMouse(spawn = {}) {
  const group = createMouse();
  if (spawn.position) {
    group.position.copy(spawn.position);
  } else {
    const angle = Math.random() * Math.PI * 2;
    const radius = ARENA_RADIUS - 1.8;
    group.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
  }
  scene.add(group);

  const elite = state.wave >= 3 && Math.random() < Math.min(0.35, state.wave * 0.045);
  const mouse = {
    group,
    velocity: new THREE.Vector3(),
    speed: (elite ? 3.4 : 2.65) + state.wave * 0.12,
    jumpPower: (elite ? 11.2 : 9.4) + state.wave * 0.16,
    jumpTimer: 0.35 + Math.random() * 1.2,
    attackTimer: 0,
    alive: true,
    elite,
    wiggle: Math.random() * Math.PI * 2,
  };

  if (elite) {
    group.scale.setScalar(1.18);
    group.userData.powerBand.material.emissiveIntensity = 1.45;
  }

  if (spawn.launch) {
    mouse.velocity.y = mouse.jumpPower * 0.86;
    mouse.jumpTimer = 1.1 + Math.random() * 0.6;
    spawnJumpSpark(group.position, mouse.elite);
  }

  state.mice.push(mouse);
}

function createMouse() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 22, 16), materials.mouse);
  body.scale.set(1.25, 0.72, 0.74);
  body.position.y = 0.44;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 14), materials.mouse);
  head.position.set(0, 0.62, 0.46);
  head.scale.set(0.95, 0.82, 1.1);
  head.castShadow = true;
  group.add(head);

  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), materials.mouseDark);
  earL.scale.set(0.82, 1, 0.22);
  earL.position.set(-0.2, 0.84, 0.38);
  earL.castShadow = true;
  group.add(earL);

  const earR = earL.clone();
  earR.position.x = 0.2;
  group.add(earR);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), materials.black);
  nose.position.set(0, 0.62, 0.74);
  group.add(nose);

  const tail = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.04, 0.8, 6, 10),
    new THREE.MeshStandardMaterial({ color: 0xc78393, roughness: 0.55 }),
  );
  tail.position.set(0, 0.45, -0.78);
  tail.rotation.x = Math.PI / 2.8;
  tail.castShadow = true;
  group.add(tail);

  const powerBand = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 32), materials.mousePower);
  powerBand.position.y = 0.54;
  powerBand.rotation.x = Math.PI / 2;
  group.add(powerBand);
  group.userData.powerBand = powerBand;
  group.userData.body = body;
  return group;
}

function updateMice(dt) {
  for (let i = state.mice.length - 1; i >= 0; i -= 1) {
    const mouse = state.mice[i];
    const group = mouse.group;
    const onGround = group.position.y <= 0.02;
    mouse.attackTimer = Math.max(0, mouse.attackTimer - dt);
    mouse.jumpTimer -= dt;

    tmpVec.subVectors(player.position, group.position);
    tmpVec.y = 0;
    const distanceToPlayer = tmpVec.length();
    if (distanceToPlayer > 0.001) tmpVec.normalize();

    const sidestep = Math.sin(performance.now() * 0.0025 + mouse.wiggle) * 0.45;
    tmpVec2.set(tmpVec.z * sidestep, 0, -tmpVec.x * sidestep);
    tmpVec.add(tmpVec2).normalize();

    mouse.velocity.x = THREE.MathUtils.lerp(mouse.velocity.x, tmpVec.x * mouse.speed, 0.05);
    mouse.velocity.z = THREE.MathUtils.lerp(mouse.velocity.z, tmpVec.z * mouse.speed, 0.05);

    if (onGround && mouse.jumpTimer <= 0) {
      mouse.velocity.y = mouse.jumpPower;
      mouse.jumpTimer = 1.35 + Math.random() * 1.35;
      spawnJumpSpark(group.position, mouse.elite);
      playTone(mouse.elite ? 860 : 720, 0.035, 'sine', 0.025);
    }

    mouse.velocity.y -= GRAVITY * dt;
    group.position.addScaledVector(mouse.velocity, dt);

    if (group.position.y < 0) {
      group.position.y = 0;
      mouse.velocity.y = Math.abs(mouse.velocity.y) * 0.12;
    }

    clampToArena(group.position, ARENA_RADIUS - 1.3);
    group.rotation.y = Math.atan2(mouse.velocity.x, mouse.velocity.z);
    group.rotation.z = Math.sin(performance.now() * 0.012 + mouse.wiggle) * 0.08;
    group.userData.powerBand.rotation.z += dt * (mouse.elite ? 7 : 5);
    group.userData.powerBand.material.emissiveIntensity = mouse.elite
      ? 1.15 + Math.sin(performance.now() * 0.011) * 0.35
      : 0.72 + Math.sin(performance.now() * 0.009) * 0.2;

    if (distanceToPlayer < 0.95 && group.position.y < 0.8 && mouse.attackTimer <= 0) {
      mouse.attackTimer = 0.75;
      state.health = Math.max(0, state.health - (mouse.elite ? 14 : 10));
      mouse.velocity.add(tmpVec.multiplyScalar(-4.2));
      playNoise(0.08, 0.08);
      flashPlayer();
      if (state.health <= 0) endGame();
    }
  }
}

function updateAllies(dt) {
  for (const ally of state.allies) {
    ally.cooldown -= dt;
    const target = findBestAirborneMouse(ally.group.position);
    if (target) {
      tmpVec.subVectors(target.group.position, ally.group.position);
      ally.group.rotation.y = smoothAngle(ally.group.rotation.y, Math.atan2(tmpVec.x, tmpVec.z), 0.08);
    }

    if (target && ally.cooldown <= 0) {
      throwBombFrom(ally.group.position, ally.group.rotation.y, true, target);
      ally.cooldown = 2.55 + Math.random() * 1.35;
    }
  }
}

function findBestAirborneMouse(origin) {
  let best = null;
  let bestDistance = Infinity;
  for (const mouse of state.mice) {
    if (mouse.group.position.y < 1.25) continue;
    const distance = origin.distanceToSquared(mouse.group.position);
    if (distance < bestDistance) {
      best = mouse;
      bestDistance = distance;
    }
  }
  return best;
}

function rechargeBombs(dt) {
  if (state.bombs >= MAX_BOMBS) return;
  state.bombRecharge += dt;
  if (state.bombRecharge >= 1.18) {
    state.bombRecharge = 0;
    state.bombs += 1;
    syncBombRack();
  }
}

function throwPlayerBomb() {
  if (!state.running || state.gameOver || state.playerCooldown > 0 || state.bombs <= 0) return;
  state.playerCooldown = 0.36;
  state.bombs -= 1;
  syncBombRack();
  throwBombFrom(player.position, state.aimYaw, false);
}

function throwBombFrom(origin, yaw, allied, target = null) {
  const start = new THREE.Vector3(
    origin.x + Math.sin(yaw) * 0.78,
    origin.y + (allied ? 1.65 : 1.7),
    origin.z + Math.cos(yaw) * 0.78,
  );

  const group = createBomb();
  group.position.copy(start);
  scene.add(group);

  const velocity = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  let fuse = allied ? 1.05 : 0.92;
  if (target) {
    const targetPos = target.group.position.clone();
    targetPos.y += 0.28;
    const horizontal = targetPos.clone().sub(start);
    horizontal.y = 0;
    const distance = Math.max(horizontal.length(), 0.1);
    horizontal.normalize();
    fuse = THREE.MathUtils.clamp(distance / 7, 0.72, 1.18);
    velocity.copy(horizontal.multiplyScalar(distance / fuse));
    velocity.y = (targetPos.y - start.y + 0.5 * GRAVITY * fuse * fuse) / fuse;
  } else {
    velocity.multiplyScalar(7.7);
    velocity.y = 9.8;
  }

  state.bombsLive.push({
    group,
    velocity,
    fuse,
    age: 0,
    allied,
  });

  playTone(allied ? 440 : 520, 0.05, 'square', allied ? 0.025 : 0.04);
}

function createBomb() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), materials.bomb);
  body.castShadow = true;
  group.add(body);

  const fuse = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.23, 4, 8), materials.fuse);
  fuse.position.set(0.13, 0.19, 0);
  fuse.rotation.z = -0.55;
  group.add(fuse);
  group.userData.body = body;
  return group;
}

function updateBombs(dt) {
  for (let i = state.bombsLive.length - 1; i >= 0; i -= 1) {
    const bomb = state.bombsLive[i];
    bomb.age += dt;
    bomb.fuse -= dt;
    bomb.velocity.y -= GRAVITY * dt;
    bomb.group.position.addScaledVector(bomb.velocity, dt);
    bomb.group.rotation.x += dt * 8;
    bomb.group.rotation.z += dt * 5;

    const nearbyAirHit = state.mice.some(
      (mouse) =>
        mouse.group.position.y > 1 &&
        mouse.group.position.distanceToSquared(bomb.group.position) < 0.72,
    );

    if (bomb.fuse <= 0 || nearbyAirHit || (bomb.group.position.y <= 0.24 && bomb.age > 0.25)) {
      explodeBomb(bomb.group.position, bomb.allied);
      scene.remove(bomb.group);
      state.bombsLive.splice(i, 1);
    }
  }
}

function explodeBomb(position, allied) {
  const radius = allied ? 2.2 : 2.75;
  const blast = new THREE.PointLight(0xffcf65, allied ? 65 : 100, radius * 5, 2);
  blast.position.copy(position);
  scene.add(blast);

  const shock = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 18, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffd369,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  shock.position.copy(position);
  scene.add(shock);
  state.particles.push({
    mesh: shock,
    velocity: new THREE.Vector3(),
    age: 0,
    life: 0.28,
    kind: 'shock',
    light: blast,
    radius,
  });

  for (let i = 0; i < 18; i += 1) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.045 + Math.random() * 0.035, 8, 6),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.45 ? 0xffd369 : 0x5cc8ff }),
    );
    spark.position.copy(position);
    scene.add(spark);
    const velocity = randomSphereVector().multiplyScalar(3 + Math.random() * 5);
    velocity.y = Math.abs(velocity.y) + 1.5;
    state.particles.push({
      mesh: spark,
      velocity,
      age: 0,
      life: 0.45 + Math.random() * 0.25,
      kind: 'spark',
    });
  }

  for (let i = state.mice.length - 1; i >= 0; i -= 1) {
    const mouse = state.mice[i];
    const distance = mouse.group.position.distanceTo(position);
    if (distance > radius) continue;

    const airborne = mouse.group.position.y > 0.85;
    if (airborne || distance < radius * 0.48) {
      removeMouse(i, airborne, allied);
    } else {
      tmpVec.subVectors(mouse.group.position, position).normalize();
      mouse.velocity.add(tmpVec.multiplyScalar(5.5));
      mouse.velocity.y = Math.max(mouse.velocity.y, 5.2);
    }
  }

  playNoise(allied ? 0.18 : 0.22, allied ? 0.1 : 0.15);
  playTone(120, 0.16, 'sawtooth', allied ? 0.04 : 0.06);
}

function removeMouse(index, airborne, allied) {
  const mouse = state.mice[index];
  spawnDefeatBurst(mouse.group.position, airborne);
  scene.remove(mouse.group);
  state.mice.splice(index, 1);
  state.score += airborne ? (allied ? 80 : 150) : allied ? 35 : 60;
  playTone(airborne ? 900 : 620, 0.055, 'triangle', airborne ? 0.05 : 0.035);
}

function spawnDefeatBurst(position, airborne) {
  const count = airborne ? 14 : 8;
  for (let i = 0; i < count; i += 1) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.08 + Math.random() * 0.06, 8, 6),
      new THREE.MeshBasicMaterial({
        color: airborne && i % 2 === 0 ? 0x60e7ff : 0xb7bac4,
        transparent: true,
        opacity: 0.8,
      }),
    );
    puff.position.copy(position);
    scene.add(puff);
    const velocity = randomSphereVector().multiplyScalar(1.5 + Math.random() * 2.4);
    velocity.y = Math.abs(velocity.y) + 0.9;
    state.particles.push({
      mesh: puff,
      velocity,
      age: 0,
      life: 0.5 + Math.random() * 0.25,
      kind: 'puff',
    });
  }
}

function spawnJumpSpark(position, elite) {
  for (let i = 0; i < 5; i += 1) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshBasicMaterial({ color: elite ? 0x60e7ff : 0xf5d36c }),
    );
    spark.position.set(position.x, 0.14, position.z);
    scene.add(spark);
    const velocity = randomSphereVector().multiplyScalar(1.2 + Math.random() * 1.2);
    velocity.y = Math.abs(velocity.y) + 0.5;
    state.particles.push({
      mesh: spark,
      velocity,
      age: 0,
      life: 0.32 + Math.random() * 0.16,
      kind: 'spark',
    });
  }
}

function flashPlayer() {
  for (const child of player.children) {
    if (!child.material || child.userData.originalColor) continue;
    child.userData.originalColor = child.material.color.clone();
    child.material.color.offsetHSL(0, 0.28, 0.18);
  }
  setTimeout(() => {
    for (const child of player.children) {
      if (!child.material || !child.userData.originalColor) continue;
      child.material.color.copy(child.userData.originalColor);
      child.userData.originalColor = null;
    }
  }, 90);
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.age += dt;
    const t = particle.age / particle.life;
    if (particle.velocity.lengthSq() > 0) {
      particle.velocity.y -= GRAVITY * 0.35 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
    }

    if (particle.kind === 'shock') {
      const scale = THREE.MathUtils.lerp(0.4, particle.radius, t);
      particle.mesh.scale.setScalar(scale);
      particle.mesh.material.opacity = Math.max(0, 0.85 * (1 - t));
      if (particle.light) particle.light.intensity = 100 * (1 - t);
    } else {
      particle.mesh.material.opacity = Math.max(0, 1 - t);
      particle.mesh.scale.setScalar(Math.max(0.1, 1 - t * 0.45));
    }

    if (particle.age >= particle.life) {
      if (particle.light) scene.remove(particle.light);
      scene.remove(particle.mesh);
      state.particles.splice(i, 1);
    }
  }
}

function updateCamera(dt) {
  const yaw = state.aimYaw;
  const behind = new THREE.Vector3(-Math.sin(yaw) * 8.4, 6.6, -Math.cos(yaw) * 8.4);
  const targetPosition = tmpVec.copy(player.position).add(behind);
  targetPosition.y += 1.3;
  camera.position.lerp(targetPosition, 1 - Math.pow(0.001, dt));

  const lookAt = tmpVec2.copy(player.position);
  lookAt.y += 1.6;
  camera.lookAt(lookAt);
}

function render() {
  renderer.render(scene, camera);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function clampToArena(position, radius) {
  const length = Math.hypot(position.x, position.z);
  if (length > radius) {
    position.x = (position.x / length) * radius;
    position.z = (position.z / length) * radius;
  }
}

function syncBombRack() {
  bombRack.innerHTML = '';
  for (let i = 0; i < MAX_BOMBS; i += 1) {
    const pip = document.createElement('span');
    pip.className = `bombPip${i >= state.bombs ? ' empty' : ''}`;
    bombRack.appendChild(pip);
  }
}

function updateHud() {
  waveValue.textContent = String(state.wave);
  scoreValue.textContent = String(state.score);
  const percent = Math.max(0, state.health / MAX_HEALTH) * 100;
  healthFill.style.width = `${percent}%`;
  healthFill.style.background =
    percent > 55 ? '#38b96a' : percent > 26 ? '#f5d36c' : '#ba3b3f';
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  overlay.classList.remove('is-hidden');
  overlayTitle.textContent = 'Toy Box Overrun';
  overlayMessage.textContent = `Score ${state.score}`;
  overlayAction.textContent = 'Restart';
}

function randomSphereVector() {
  const theta = Math.random() * Math.PI * 2;
  const y = Math.random() * 2 - 1;
  const r = Math.sqrt(1 - y * y);
  return new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r);
}

function smoothAngle(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}

function ensureAudio() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
}

function playTone(frequency, duration, type = 'sine', gain = 0.05, delay = 0) {
  if (!audioContext) return;
  const start = audioContext.currentTime + delay;
  const osc = audioContext.createOscillator();
  const volume = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(volume).connect(audioContext.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function playNoise(duration, gain) {
  if (!audioContext) return;
  const sampleRate = audioContext.sampleRate;
  const frameCount = Math.floor(sampleRate * duration);
  const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
  }
  const source = audioContext.createBufferSource();
  const volume = audioContext.createGain();
  volume.gain.value = gain;
  source.buffer = buffer;
  source.connect(volume).connect(audioContext.destination);
  source.start();
}
