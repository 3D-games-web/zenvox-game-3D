"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

type Mode = "foot" | "car" | "bike";
type Status = "ready" | "playing" | "paused";

const TRAFFIC_MODELS = ["sedan", "suv", "taxi", "van", "truck", "police", "hatchback-sports", "delivery", "ambulance", "sedan-sports"];

// ----- City grid -----
const GRID = 6;
const SPAN = 52;
const ROAD_W = 12;
const BLOCK = SPAN - ROAD_W;
const HALF = (GRID * SPAN) / 2;
const lineCoord = (k: number) => k * SPAN - HALF;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

export function DriveGame() {
  const [status, setStatus] = useState<Status>("ready");
  const [mode, setMode] = useState<Mode>("foot");
  const [speed, setSpeed] = useState(0);
  const [prompt, setPrompt] = useState("");
  const gameRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef(status);
  const modeRef = useRef(mode);
  const callbacksRef = useRef({ setSpeed, setPrompt, setMode });

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { callbacksRef.current = { setSpeed, setPrompt, setMode }; }, [setSpeed, setPrompt, setMode]);

  useEffect(() => {
    const mount = gameRef.current;
    if (!mount) return;

    // ---------- Scene / sky / fog ----------
    const scene = new THREE.Scene();
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 512; skyCanvas.height = 256;
    const sc = skyCanvas.getContext("2d");
    if (sc) {
      const g = sc.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#2b6fb0"); g.addColorStop(0.45, "#6db0e0"); g.addColorStop(0.78, "#a9d2ea"); g.addColorStop(1, "#dcebf0");
      sc.fillStyle = g; sc.fillRect(0, 0, 512, 256);
      const cloud = (cx: number, cy: number, s: number, a: number) => {
        sc.save(); sc.globalAlpha = a; sc.fillStyle = "#ffffff";
        [[0, 0, 26], [22, 6, 20], [-24, 6, 19], [10, -8, 18], [-12, -6, 16], [40, 10, 15], [-42, 10, 14]].forEach(([dx, dy, r]) => {
          sc.beginPath(); sc.ellipse(cx + dx * s, cy + dy * s, r * s, r * s * 0.72, 0, 0, Math.PI * 2); sc.fill();
        });
        sc.restore();
      };
      [[70, 60, 1, 0.9], [200, 40, 0.7, 0.75], [330, 78, 1.15, 0.85], [450, 46, 0.8, 0.7], [150, 95, 0.6, 0.6]].forEach(([x, y, s, a]) => cloud(x, y, s, a));
      const tex = new THREE.CanvasTexture(skyCanvas); tex.colorSpace = THREE.SRGBColorSpace; scene.background = tex;
    } else scene.background = new THREE.Color(0x8bc7ed);
    scene.fog = new THREE.Fog(0xc4dce6, 90, 330);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
    camera.position.set(0, 4, 8);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75)); // capped for smoothness
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);

    // ---------- Lights (shadow follows the player) ----------
    scene.add(new THREE.HemisphereLight(0xdff0ff, 0x59605c, 1.6));
    const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
    sun.position.set(-30, 55, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
    sun.shadow.bias = -0.0005;
    scene.add(sun); scene.add(sun.target);

    // ---------- Ground ----------
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 3, HALF * 3), new THREE.MeshStandardMaterial({ color: 0x5f7355, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);

    // ---------- Roads ----------
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c3130, roughness: 0.95 });
    const roadLen = GRID * SPAN + ROAD_W;
    for (let k = 0; k <= GRID; k += 1) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, roadLen), roadMat);
      v.rotation.x = -Math.PI / 2; v.position.set(lineCoord(k), 0, 0); v.receiveShadow = true; scene.add(v);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, ROAD_W), roadMat);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.001, lineCoord(k)); h.receiveShadow = true; scene.add(h);
    }
    // dashed centre lines via InstancedMesh (2 draw calls total)
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd9d6b8 });
    const dummy = new THREE.Object3D();
    const zSteps: number[] = []; for (let d = -HALF; d <= HALF; d += 6) zSteps.push(d);
    const vGeo = new THREE.PlaneGeometry(0.28, 2.6); vGeo.rotateX(-Math.PI / 2);
    const vDash = new THREE.InstancedMesh(vGeo, dashMat, (GRID + 1) * zSteps.length);
    let vi = 0;
    for (let k = 0; k <= GRID; k += 1) for (const z of zSteps) { dummy.position.set(lineCoord(k), 0.02, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); vDash.setMatrixAt(vi++, dummy.matrix); }
    scene.add(vDash);
    const hGeo = new THREE.PlaneGeometry(2.6, 0.28); hGeo.rotateX(-Math.PI / 2);
    const hDash = new THREE.InstancedMesh(hGeo, dashMat, (GRID + 1) * zSteps.length);
    let hi = 0;
    for (let k = 0; k <= GRID; k += 1) for (const x of zSteps) { dummy.position.set(x, 0.02, lineCoord(k)); dummy.updateMatrix(); hDash.setMatrixAt(hi++, dummy.matrix); }
    scene.add(hDash);

    // ---------- Buildings (shared facade materials) ----------
    const facadeMats = Array.from({ length: 6 }, (_, seed) => {
      const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = ["#9a9488", "#7f8788", "#b0a494", "#6f777b", "#8a7f74", "#95a0a3"][seed];
      ctx.fillRect(0, 0, 128, 256);
      for (let row = 0; row < 12; row += 1) for (let col = 0; col < 4; col += 1) {
        const lit = (row * 5 + col * 7 + seed) % 4 !== 0;
        ctx.fillStyle = lit ? (row % 3 ? "#9ad9e7" : "#f1d995") : "#26363b";
        ctx.fillRect(12 + col * 28, 12 + row * 20, 18, 12);
      }
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, roughness: 0.9 });
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x555a58, roughness: 0.9 });
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9ba29b, roughness: 0.95 });
    const buildingBoxes: { x: number; z: number; hx: number; hz: number }[] = [];
    const blockRects: { cx: number; cz: number; half: number }[] = [];
    for (let bi = 0; bi < GRID; bi += 1) for (let bj = 0; bj < GRID; bj += 1) {
      const cx = lineCoord(bi) + SPAN / 2, cz = lineCoord(bj) + SPAN / 2;
      blockRects.push({ cx, cz, half: BLOCK / 2 });
      const sw = new THREE.Mesh(new THREE.BoxGeometry(BLOCK + 3, 0.3, BLOCK + 3), sidewalkMat);
      sw.position.set(cx, 0.12, cz); sw.receiveShadow = true; scene.add(sw);
      const count = 1 + Math.floor(Math.random() * 3);
      for (let b = 0; b < count; b += 1) {
        const w = 8 + Math.random() * 12, depth = 8 + Math.random() * 12, height = 8 + Math.random() * 34;
        const px = cx + (Math.random() - 0.5) * (BLOCK - w - 4), pz = cz + (Math.random() - 0.5) * (BLOCK - depth - 4);
        const bld = new THREE.Mesh(new THREE.BoxGeometry(w, height, depth), facadeMats[Math.floor(Math.random() * facadeMats.length)]);
        bld.position.set(px, height / 2 + 0.25, pz); bld.castShadow = true; bld.receiveShadow = true; scene.add(bld);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.6, depth * 0.7), roofMat); roof.position.set(px, height + 0.55, pz); scene.add(roof);
        buildingBoxes.push({ x: px, z: pz, hx: w / 2 + 0.3, hz: depth / 2 + 0.3 });
      }
    }

    // ---------- Model loading ----------
    const loader = new GLTFLoader();
    const modelCache = new Map<string, Promise<GLTF>>();
    const load = (path: string) => { if (!modelCache.has(path)) modelCache.set(path, loader.loadAsync(path)); return modelCache.get(path)!; };

    const buildRealCar = (gltf: GLTF, targetWidth: number, tint?: number) => {
      const model = gltf.scene.clone(true);
      model.rotation.y = Math.PI; model.updateMatrixWorld(true);
      const size = new THREE.Vector3(); new THREE.Box3().setFromObject(model).getSize(size);
      const scale = targetWidth / (size.x || 1); model.scale.setScalar(scale); model.updateMatrixWorld(true);
      model.position.y = -new THREE.Box3().setFromObject(model).min.y;
      const wheels: THREE.Object3D[] = [];
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true; o.receiveShadow = true;
          if (tint !== undefined && o.material instanceof THREE.MeshStandardMaterial) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color(tint), 0.4); }
        }
        if (o.name.toLowerCase().includes("wheel")) wheels.push(o);
      });
      return { model, wheels };
    };
    const fitCar = (holder: THREE.Group, gltf: GLTF, targetWidth: number, tint?: number) => {
      const { model, wheels } = buildRealCar(gltf, targetWidth, tint);
      holder.clear(); holder.add(model); holder.userData.wheels = wheels;
    };
    const CAR_TINTS = [0xc0392b, 0x2e86c1, 0x27ae60, 0xf1c40f, 0xe67e22, 0x8e44ad, 0x16a085, 0xe8eef1, 0x2c3e50, 0xd35400, 0x1abc9c, 0xff6b6b];
    const BIKE_TINTS = [0xd9382e, 0x2f6f6f, 0xe2b03c, 0x3a3f7a, 0x1abc9c, 0xff6b6b, 0x9b59b6, 0xecf0f1];
    const placeholderCar = (color: number) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3), new THREE.MeshStandardMaterial({ color, roughness: 0.4 })); body.position.y = 0.5; body.castShadow = true; g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.4), new THREE.MeshStandardMaterial({ color: 0x223, roughness: 0.3 })); cab.position.set(0, 0.95, -0.1); g.add(cab);
      return g;
    };

    // ---------- Procedural motorcycle ----------
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.75 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.35 });
    const buildBike = (color: number) => {
      const g = new THREE.Group();
      const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.3 });
      const wheels: THREE.Object3D[] = [];
      [-0.62, 0.62].forEach((z) => {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.14, 18), tireMat);
        w.rotation.z = Math.PI / 2; w.position.set(0, 0.4, z); w.castShadow = true; g.add(w); wheels.push(w);
      });
      const tank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.9), paint); tank.position.set(0, 0.72, -0.05); tank.castShadow = true; g.add(tank);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.7), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.8 })); seat.position.set(0, 0.74, 0.5); g.add(seat);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.3), metalMat); frame.position.set(0, 0.52, 0.1); g.add(frame);
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), metalMat); fork.position.set(0, 0.62, -0.6); fork.rotation.x = 0.35; g.add(fork);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.05), metalMat); bar.position.set(0, 0.95, -0.55); g.add(bar);
      const light = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), new THREE.MeshBasicMaterial({ color: 0xfff4c7 })); light.rotation.x = Math.PI / 2; light.position.set(0, 0.78, -0.72); g.add(light);
      g.userData.wheels = wheels;
      return g;
    };

    // ---------- Box humanoid (bike rider, posed) ----------
    const buildRider = () => {
      const p = new THREE.Group();
      const shirt = new THREE.MeshStandardMaterial({ color: 0x35507a, roughness: 0.85 });
      const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.88 });
      const hips = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.17), pants); hips.position.y = 0.54; p.add(hips);
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.19), shirt); torso.position.set(0, 0.82, 0); torso.rotation.x = -0.5; p.add(torso);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.2, 0.19), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.6 })); head.position.set(0, 1.08, -0.14); p.add(head); // helmet
      [-1, 1].forEach((s) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.09), shirt); arm.position.set(s * 0.2, 0.86, -0.22); arm.rotation.x = -1.1; p.add(arm);
      });
      [-1, 1].forEach((s) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.46, 0.12), pants); leg.position.set(s * 0.13, 0.42, 0.12); leg.rotation.x = 0.85; p.add(leg);
      });
      p.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      p.visible = false;
      return p;
    };
    const bikeRider = buildRider();

    // ---------- Vehicles (cars + bikes), all enterable ----------
    type Vehicle = { group: THREE.Group; kind: "car" | "bike"; axis: "h" | "v"; road: number; dir: number; speed: number; turnCd: number; controlled: boolean; parked: boolean };
    const vehicles: Vehicle[] = [];
    const laneOffset = 3;
    const placeVehicle = (v: Vehicle, along: number) => {
      if (v.axis === "v") {
        v.group.position.set(lineCoord(v.road) + (v.dir > 0 ? -laneOffset : laneOffset), 0, along);
        v.group.rotation.y = v.dir > 0 ? Math.PI : 0;
      } else {
        v.group.position.set(along, 0, lineCoord(v.road) + (v.dir > 0 ? laneOffset : -laneOffset));
        v.group.rotation.y = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    };
    const spawnVehicle = (kind: "car" | "bike", i: number) => {
      const group = new THREE.Group();
      const carTint = CAR_TINTS[Math.floor(Math.random() * CAR_TINTS.length)];
      group.add(kind === "car" ? placeholderCar(carTint) : buildBike(BIKE_TINTS[Math.floor(Math.random() * BIKE_TINTS.length)]));
      const v: Vehicle = { group, kind, axis: Math.random() < 0.5 ? "v" : "h", road: Math.floor(Math.random() * (GRID + 1)), dir: Math.random() < 0.5 ? 1 : -1, speed: (kind === "bike" ? 12 : 9) + Math.random() * 6, turnCd: 2 + Math.random() * 5, controlled: false, parked: false };
      placeVehicle(v, (Math.random() - 0.5) * 2 * HALF);
      scene.add(group); vehicles.push(v);
      if (kind === "car") load(`/models/cars/${TRAFFIC_MODELS[i % TRAFFIC_MODELS.length]}.glb`).then((g) => fitCar(group, g, 1.7, carTint)).catch(() => {});
    };
    for (let i = 0; i < 18; i += 1) spawnVehicle("car", i);
    for (let i = 0; i < 6; i += 1) spawnVehicle("bike", i);

    // ---------- Animated people (Soldier) ----------
    const mixers: THREE.AnimationMixer[] = [];
    type Ped = { root: THREE.Group; cx: number; cz: number; half: number; t: number; speed: number };
    const peds: Ped[] = [];
    const avatarRoot = new THREE.Group();
    avatarRoot.position.set(lineCoord(3) + ROAD_W / 2 + 2, 0, lineCoord(3));
    // coral marker ring so the player is always identifiable among pedestrians
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 28), new THREE.MeshBasicMaterial({ color: 0xf26449, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.06; avatarRoot.add(marker);
    scene.add(avatarRoot);
    let footHeading = 0;
    let playerMixer: THREE.AnimationMixer | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let walkAction: THREE.AnimationAction | null = null;
    let activeAction: THREE.AnimationAction | null = null;

    const setupCharacter = (gltf: GLTF, target: THREE.Group, targetHeight: number, tint?: number) => {
      const model = cloneSkeleton(gltf.scene) as THREE.Group;
      model.updateMatrixWorld(true);
      const size = new THREE.Vector3(); new THREE.Box3().setFromObject(model).getSize(size);
      const scale = targetHeight / (size.y || 1); model.scale.setScalar(scale);
      model.position.y = 0; // Soldier's origin is at the feet — sits flat on the ground
      model.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true; o.frustumCulled = true;
          if (tint !== undefined && !Array.isArray(o.material)) {
            const mat = (o.material as THREE.Material).clone();
            (mat as THREE.MeshStandardMaterial).color?.lerp(new THREE.Color(tint), 0.55);
            o.material = mat;
          }
        }
      });
      target.add(model);
      return new THREE.AnimationMixer(model);
    };

    load("/models/soldier.glb").then((gltf) => {
      const clips = gltf.animations;
      const walkClip = THREE.AnimationClip.findByName(clips, "Walk");
      const idleClip = THREE.AnimationClip.findByName(clips, "Idle");
      if (!walkClip || !idleClip) return;
      // player avatar
      playerMixer = setupCharacter(gltf, avatarRoot, 1.8);
      idleAction = playerMixer.clipAction(idleClip); walkAction = playerMixer.clipAction(walkClip);
      idleAction.play(); activeAction = idleAction;
      mixers.push(playerMixer);
      // pedestrians — varied heights (male/female mix) and outfit colours
      const DRESS_TINTS = [0x3a6ea5, 0x9c4a3c, 0x4e7a4e, 0x8a6d3b, 0x6d4b7a, 0xb0553f, 0x3f7a7a, 0xc9a24b, 0xd06a8c, 0x556070, 0xa14b8c, 0x2e7d5b, 0xcf5c36, 0x4062a8];
      const PED_COUNT = 18;
      for (let i = 0; i < PED_COUNT; i += 1) {
        let block = blockRects[Math.floor(Math.random() * blockRects.length)];
        let guard = 0;
        while (guard++ < 8 && Math.hypot(block.cx - avatarRoot.position.x, block.cz - avatarRoot.position.z) < 26) block = blockRects[Math.floor(Math.random() * blockRects.length)];
        const root = new THREE.Group();
        const height = 1.5 + Math.random() * 0.38; // shorter (fem) to taller (male)
        const mixer = setupCharacter(gltf, root, height, DRESS_TINTS[Math.floor(Math.random() * DRESS_TINTS.length)]);
        const action = mixer.clipAction(walkClip);
        action.time = Math.random() * walkClip.duration; action.timeScale = 0.85 + Math.random() * 0.4; action.play();
        mixers.push(mixer); scene.add(root);
        peds.push({ root, cx: block.cx, cz: block.cz, half: block.half + 2.4, t: Math.random() * 8 * (block.half + 2.4), speed: 1.4 + Math.random() * 1.1 });
      }
    }).catch(() => {});

    const perimeterPoint = (p: Ped, out: THREE.Vector3) => {
      const side = 2 * p.half, P = 4 * side;
      let t = ((p.t % P) + P) % P; let hx = 0, hz = 0, dx = 0, dz = 0;
      if (t < side) { hx = -p.half + t; hz = -p.half; dx = 1; }
      else if (t < 2 * side) { t -= side; hx = p.half; hz = -p.half + t; dz = 1; }
      else if (t < 3 * side) { t -= 2 * side; hx = p.half - t; hz = p.half; dx = -1; }
      else { t -= 3 * side; hx = -p.half; hz = p.half - t; dz = -1; }
      out.set(p.cx + hx, 0, p.cz + hz);
      return Math.atan2(dx, dz);
    };

    // ---------- Player vehicle state ----------
    let current: Vehicle | null = null;
    let heading = 0;
    let carSpeed = 0;

    // ---------- Input ----------
    const keys = new Set<string>();
    const nearestVehicle = () => {
      let best: Vehicle | null = null, bestD = 5;
      for (const v of vehicles) { const d = avatarRoot.position.distanceTo(v.group.position); if (d < bestD) { bestD = d; best = v; } }
      return best;
    };
    const enterExit = () => {
      if (statusRef.current !== "playing") return;
      if (modeRef.current === "foot") {
        const v = nearestVehicle();
        if (!v) return;
        current = v; v.controlled = true; v.parked = false; carSpeed = 0;
        heading = v.group.rotation.y;
        avatarRoot.visible = false;
        if (v.kind === "bike") { v.group.add(bikeRider); bikeRider.position.set(0, 0, 0.15); bikeRider.visible = true; }
        modeRef.current = v.kind; callbacksRef.current.setMode(v.kind);
      } else if (current) {
        const rx = Math.cos(heading), rz = -Math.sin(heading);
        avatarRoot.position.set(current.group.position.x + rx * 2.2, 0, current.group.position.z + rz * 2.2);
        footHeading = heading; avatarRoot.visible = true;
        if (current.kind === "bike") { bikeRider.visible = false; current.group.remove(bikeRider); }
        current.parked = true; current.controlled = false; current = null;
        modeRef.current = "foot"; callbacksRef.current.setMode("foot");
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "f" && !keys.has("f")) enterExit();
      keys.add(k);
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "w", "a", "s", "d"].includes(k)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // ---------- Drag-to-look camera ----------
    let camRadius = 7, camTheta = 0, camPhi = 1.02, velTheta = 0, velPhi = 0;
    const canvasEl = renderer.domElement;
    canvasEl.style.touchAction = "none"; canvasEl.style.cursor = "grab";
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const onPointerDown = (e: PointerEvent) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvasEl.style.cursor = "grabbing"; velTheta = 0; velPhi = 0; if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } };
    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId); if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y; prev.x = e.clientX; prev.y = e.clientY;
      if (pointers.size >= 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); camRadius = THREE.MathUtils.clamp(camRadius - (d - pinch) * 0.04, 3.5, 26); pinch = d; }
      else { velTheta = -dx * 0.006; velPhi = dy * 0.006; camTheta += velTheta; camPhi = THREE.MathUtils.clamp(camPhi + velPhi, 0.2, 1.45); }
    };
    const onPointerUp = (e: PointerEvent) => { pointers.delete(e.pointerId); if (pointers.size === 0) canvasEl.style.cursor = "grab"; };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); camRadius = THREE.MathUtils.clamp(camRadius + e.deltaY * 0.012, 3.5, 26); };
    canvasEl.addEventListener("pointerdown", onPointerDown);
    canvasEl.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    canvasEl.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => { const w = mount.clientWidth, h = mount.clientHeight; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); };
    resize(); window.addEventListener("resize", resize);

    const resolveCollision = (pos: THREE.Vector3, radius: number) => {
      let hit = false;
      for (const box of buildingBoxes) {
        const nx = THREE.MathUtils.clamp(pos.x, box.x - box.hx, box.x + box.hx);
        const nz = THREE.MathUtils.clamp(pos.z, box.z - box.hz, box.z + box.hz);
        const dx = pos.x - nx, dz = pos.z - nz, d2 = dx * dx + dz * dz;
        if (d2 < radius * radius && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x += (dx / d) * (radius - d); pos.z += (dz / d) * (radius - d); hit = true; }
      }
      return hit;
    };

    // ---------- Minimap ----------
    const drawMinimap = () => {
      const canvas = minimapRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return;
      const size = canvas.width, R = HALF + 14, map = (v: number) => ((v + R) / (2 * R)) * size;
      ctx.fillStyle = "#20262a"; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#39413c";
      for (const b of blockRects) ctx.fillRect(map(b.cx - b.half), map(b.cz - b.half), (b.half * 2) / (2 * R) * size, (b.half * 2) / (2 * R) * size);
      for (const v of vehicles) { ctx.fillStyle = v.kind === "bike" ? "#7ee0d4" : "#e2b03c"; ctx.fillRect(map(v.group.position.x) - 1.5, map(v.group.position.z) - 1.5, 3, 3); }
      const t = current ? current.group.position : avatarRoot.position;
      const h = current ? heading : footHeading;
      ctx.save(); ctx.translate(map(t.x), map(t.z)); ctx.rotate(Math.atan2(-Math.sin(h), -Math.cos(h)));
      ctx.fillStyle = "#f26449"; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    };

    // ---------- Loop ----------
    const camTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3(), currentLook = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
    let previous = performance.now(), frameId = 0, miniCd = 0;
    const animate = () => {
      const now = performance.now(); const delta = Math.min((now - previous) / 1000, 0.05); previous = now;
      const active = statusRef.current === "playing";
      const m = modeRef.current;
      const left = keys.has("a") || keys.has("arrowleft");
      const right = keys.has("d") || keys.has("arrowright");
      const up = keys.has("w") || keys.has("arrowup");
      const down = keys.has("s") || keys.has("arrowdown");

      // ---- driving (car or bike) ----
      if (active && m !== "foot" && current) {
        const isBike = current.kind === "bike";
        const throttle = (up ? 1 : 0) - (down ? 1 : 0);
        const accel = isBike ? 30 : 26, maxF = isBike ? 40 : 34, maxR = -12, friction = 12;
        if (throttle > 0) carSpeed += accel * delta; else if (throttle < 0) carSpeed -= accel * delta;
        else carSpeed -= Math.sign(carSpeed) * Math.min(Math.abs(carSpeed), friction * delta);
        if (keys.has(" ")) carSpeed -= Math.sign(carSpeed) * Math.min(Math.abs(carSpeed), 45 * delta);
        carSpeed = THREE.MathUtils.clamp(carSpeed, maxR, maxF);
        const steer = (left ? 1 : 0) - (right ? 1 : 0);
        const grip = THREE.MathUtils.clamp(Math.abs(carSpeed) / 6, 0, 1);
        heading += steer * (isBike ? 2 : 1.7) * delta * grip * Math.sign(carSpeed || 1);
        const fx = -Math.sin(heading), fz = -Math.cos(heading);
        const gp = current.group.position;
        gp.x = THREE.MathUtils.clamp(gp.x + fx * carSpeed * delta, -HALF - 4, HALF + 4);
        gp.z = THREE.MathUtils.clamp(gp.z + fz * carSpeed * delta, -HALF - 4, HALF + 4);
        if (resolveCollision(gp, isBike ? 0.9 : 1.6)) carSpeed *= 0.35;
        current.group.rotation.y = heading;
        current.group.rotation.z = THREE.MathUtils.lerp(current.group.rotation.z, isBike ? -steer * grip * 0.25 : -steer * grip * 0.05, delta * 6);
        const spin = carSpeed * delta * 5;
        (current.group.userData.wheels as THREE.Object3D[] | undefined)?.forEach((w) => { w.rotation.x -= spin; });
        callbacksRef.current.setSpeed(Math.round(Math.abs(carSpeed) * 3.2));
      } else carSpeed *= 0.9;

      // ---- on foot (camera-relative movement: W = into screen, A/D = left/right) ----
      if (active && m === "foot") {
        const fwdIn = (up ? 1 : 0) - (down ? 1 : 0);
        const rgtIn = (right ? 1 : 0) - (left ? 1 : 0);
        const isMoving = fwdIn !== 0 || rgtIn !== 0;
        if (isMoving) {
          const psi = camTheta;
          let mx = -Math.sin(psi) * fwdIn + Math.cos(psi) * rgtIn;
          let mz = -Math.cos(psi) * fwdIn - Math.sin(psi) * rgtIn;
          const len = Math.hypot(mx, mz) || 1; mx /= len; mz /= len;
          avatarRoot.position.x += mx * 4.6 * delta;
          avatarRoot.position.z += mz * 4.6 * delta;
          resolveCollision(avatarRoot.position, 0.5);
          footHeading = lerpAngle(footHeading, Math.atan2(-mx, -mz), Math.min(1, delta * 12));
          avatarRoot.rotation.y = footHeading;
        }
        const want = isMoving ? walkAction : idleAction;
        if (want && want !== activeAction && activeAction) { activeAction.fadeOut(0.2); want.reset().fadeIn(0.2).play(); activeAction = want; }
        callbacksRef.current.setSpeed(0);
      }

      if (active) {
        const p = m !== "foot" ? "Press F to get out" : (nearestVehicle() ? "Press F to get in" : "");
        callbacksRef.current.setPrompt(p);
      }

      // ---- AI vehicles (stop for the player / each other, GTA-style) ----
      const playerPos = current ? current.group.position : avatarRoot.position;
      for (const v of vehicles) {
        if (v.controlled || v.parked) continue;
        const rot = v.group.rotation.y, fxo = -Math.sin(rot), fzo = -Math.cos(rot);
        const isAhead = (px: number, pz: number, reach: number) => {
          const rx = px - v.group.position.x, rz = pz - v.group.position.z;
          const ahead = rx * fxo + rz * fzo;
          if (ahead > 0.4 && ahead < reach) { const lx = rx - ahead * fxo, lz = rz - ahead * fzo; return lx * lx + lz * lz < 3.2; }
          return false;
        };
        let blocked = isAhead(playerPos.x, playerPos.z, 7);
        if (!blocked) for (const o of vehicles) { if (o !== v && isAhead(o.group.position.x, o.group.position.z, 5.5)) { blocked = true; break; } }
        if (blocked) continue; // wait — don't advance, don't spin wheels
        const along = v.axis === "v" ? v.group.position.z : v.group.position.x;
        const next = along + v.dir * v.speed * delta;
        if (v.axis === "v") v.group.position.z = next; else v.group.position.x = next;
        if (next > HALF + 6) { if (v.axis === "v") v.group.position.z = -HALF - 6; else v.group.position.x = -HALF - 6; }
        if (next < -HALF - 6) { if (v.axis === "v") v.group.position.z = HALF + 6; else v.group.position.x = HALF + 6; }
        v.turnCd -= delta;
        if (v.turnCd <= 0) {
          const adv = v.axis === "v" ? v.group.position.z : v.group.position.x;
          const idx = Math.round((adv + HALF) / SPAN);
          if (idx >= 0 && idx <= GRID && Math.abs(adv - lineCoord(idx)) < 2.4) {
            const keep = v.axis === "v" ? v.group.position.x : v.group.position.z; // coordinate that must stay
            v.axis = v.axis === "v" ? "h" : "v"; v.road = idx; v.dir = Math.random() < 0.5 ? 1 : -1;
            placeVehicle(v, keep); v.turnCd = 3 + Math.random() * 5;
          }
        }
        const spin = v.speed * delta * 5;
        (v.group.userData.wheels as THREE.Object3D[] | undefined)?.forEach((w) => { w.rotation.x -= spin; });
      }

      // ---- pedestrians ----
      if (active) for (const ped of peds) { ped.t += ped.speed * delta; const face = perimeterPoint(ped, tmp); ped.root.position.copy(tmp); ped.root.rotation.y = face; }

      // ---- animations (keep characters alive on the menu too, freeze only when paused) ----
      if (statusRef.current !== "paused") for (const mixer of mixers) mixer.update(delta);

      // ---- camera ----
      const targetObj = current ? current.group : avatarRoot;
      if (pointers.size === 0) {
        camTheta += velTheta; camPhi = THREE.MathUtils.clamp(camPhi + velPhi, 0.2, 1.45); velTheta *= 0.9; velPhi *= 0.9;
        // chase camera: smoothly swing behind the player as they move (driving or on foot)
        const followHeading = current ? heading : footHeading;
        const isMoving = current ? Math.abs(carSpeed) > 2 : (up || down || left || right);
        if (active && isMoving) camTheta = lerpAngle(camTheta, followHeading, delta * (current ? 1.6 : 1.1));
      }
      lookTarget.set(targetObj.position.x, targetObj.position.y + (current ? 1.1 : 1.4), targetObj.position.z);
      const sinPhi = Math.sin(camPhi);
      camTarget.set(lookTarget.x + camRadius * sinPhi * Math.sin(camTheta), lookTarget.y + camRadius * Math.cos(camPhi), lookTarget.z + camRadius * sinPhi * Math.cos(camTheta));
      camera.position.lerp(camTarget, Math.min(1, delta * 6));
      currentLook.lerp(lookTarget, Math.min(1, delta * 8));
      camera.lookAt(currentLook);

      sun.position.set(targetObj.position.x - 30, 55, targetObj.position.z + 25);
      sun.target.position.copy(targetObj.position); sun.target.updateMatrixWorld();

      miniCd -= delta; if (miniCd <= 0) { drawMinimap(); miniCd = 0.12; }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize); window.removeEventListener("pointerup", onPointerUp);
      canvasEl.removeEventListener("pointerdown", onPointerDown); canvasEl.removeEventListener("pointermove", onPointerMove); canvasEl.removeEventListener("wheel", onWheel);
      renderer.dispose(); mount.removeChild(renderer.domElement);
    };
  }, []);

  const dispatchKey = (key: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { key }));
  const badge = mode === "foot" ? "🚶 On foot" : mode === "bike" ? "🏍️ Riding" : "🚗 Driving";

  return (
    <main className="drive-shell">
      <header className="drive-header">
        <a className="drive-brand" href="#drive"><span className="brand-mark" />ZENVOX <b>/</b> CITY</a>
        <span className="drive-mode">Open world <i /> {badge.slice(3)}</span>
        <button className="drive-pause" onClick={() => setStatus(status === "playing" ? "paused" : "playing")} aria-label="Pause or resume">{status === "playing" ? "Ⅱ" : "▶"}</button>
      </header>
      <section className="drive-stage" id="drive">
        <div className="drive-canvas" ref={gameRef} aria-label="Open world city game" />
        <div className="drive-hud drive-right"><span>Speed</span><strong>{speed}<small> KM/H</small></strong></div>
        <div className="drive-badge">{badge}</div>
        <canvas className="drive-minimap" ref={minimapRef} width={176} height={176} aria-label="City map" />
        {status === "playing" && prompt && <div className="drive-prompt">{prompt}</div>}
        {status === "ready" && (
          <div className="drive-overlay">
            <p className="drive-kicker">Zenvox City / Free roam</p>
            <h1>Walk the<br /><em>living city.</em></h1>
            <p>Start on foot, explore the streets, then walk up to any car or bike and press F to jump in and drive.</p>
            <button className="drive-start" onClick={() => setStatus("playing")}>Enter city <b>↗</b></button>
          </div>
        )}
        {status === "paused" && (
          <div className="drive-overlay compact-drive">
            <p className="drive-kicker">City on hold</p><h2>Paused.</h2>
            <button className="drive-start" onClick={() => setStatus("playing")}>Resume <b>▶</b></button>
          </div>
        )}
        <div className="control-guide" aria-label="Game controls">
          <span><b>W</b><b>A</b><b>S</b><b>D</b> Move / Drive</span>
          <span><b>F</b> Get in / out</span>
          <span><b>SPACE</b> Brake</span>
          <span><b>Drag</b> Look</span>
          <span><b>Scroll</b> Zoom</span>
        </div>
        <div className="drive-touch">
          <button onPointerDown={() => dispatchKey("a", true)} onPointerUp={() => dispatchKey("a", false)}>←</button>
          <button onPointerDown={() => dispatchKey("w", true)} onPointerUp={() => dispatchKey("w", false)}>↑</button>
          <button onPointerDown={() => dispatchKey("s", true)} onPointerUp={() => dispatchKey("s", false)}>↓</button>
          <button onPointerDown={() => dispatchKey("d", true)} onPointerUp={() => dispatchKey("d", false)}>→</button>
          <button onPointerDown={() => dispatchKey("f", true)} onPointerUp={() => dispatchKey("f", false)}>F</button>
        </div>
      </section>
      <footer className="drive-footer">
        <span>City <b>ZENVOX METRO</b></span>
        <span>Traffic <b>HEAVY</b></span>
        <span>Controls <b>Keyboard + touch</b></span>
        <span>© 2026 ZENVOX MOTORSPORT</span>
      </footer>
    </main>
  );
}
