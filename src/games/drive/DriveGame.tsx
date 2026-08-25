"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

type DriveStatus = "ready" | "playing" | "paused" | "crashed";

const formatDistance = (meters: number) => `${(meters / 1000).toFixed(2)} km`;

export function DriveGame() {
  const [status, setStatus] = useState<DriveStatus>("ready");
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [points, setPoints] = useState(0);
  const [best, setBest] = useState(0);
  const gameRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(status);
  const callbacksRef = useRef({ setSpeed, setDistance, setStatus });

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { callbacksRef.current = { setSpeed, setDistance, setStatus }; }, [setSpeed, setDistance, setStatus]);

  useEffect(() => {
    const mount = gameRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8bc7ed);
    scene.fog = new THREE.Fog(0x8bc7ed, 32, 180);
    const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 250);
    camera.position.set(0, 3.2, 8.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xd9f3ff, 0x59605c, 2.1));
    const sun = new THREE.DirectionalLight(0xfff0d2, 3.5);
    sun.position.set(-25, 35, 20);
    sun.castShadow = true;
    scene.add(sun);

    const world = new THREE.Group();
    scene.add(world);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 260), new THREE.MeshStandardMaterial({ color: 0x252b2b, roughness: 0.92 }));
    road.rotation.x = -Math.PI / 2;
    road.position.z = -95;
    road.receiveShadow = true;
    world.add(road);
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(32, 260), new THREE.MeshStandardMaterial({ color: 0x8c958e, roughness: 1 }));
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.y = -0.02;
    shoulder.position.z = -95;
    world.add(shoulder);

    const laneMarkers: THREE.Mesh[] = [];
    for (let index = 0; index < 32; index += 1) {
      [-2.34, 2.34].forEach((x) => {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 4.2), new THREE.MeshBasicMaterial({ color: 0xe5e4cd }));
        marker.position.set(x, 0.025, 8 - index * 8);
        world.add(marker);
        laneMarkers.push(marker);
      });
    }

    const scenery: THREE.Object3D[] = [];
    const pedestrians: THREE.Group[] = [];
    [-1, 1].forEach((side) => {
      const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 260), new THREE.MeshStandardMaterial({ color: 0x9ba29b, roughness: 0.92 }));
      sidewalk.rotation.x = -Math.PI / 2;
      sidewalk.position.set(side * 8.2, 0.01, -95);
      world.add(sidewalk);
    });
    const createBuilding = (side: number, index: number) => {
      const width = 2 + Math.random() * 3;
      const height = 3 + Math.random() * 12;
      const depth = 5 + Math.random() * 5;
      const buildingGroup = new THREE.Group();
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), new THREE.MeshStandardMaterial({ color: [0xb4aaa0, 0x978f86, 0x777c7a, 0xc1b7a8][index % 4], roughness: 0.88 }));
      building.position.y = height / 2;
      building.castShadow = true;
      buildingGroup.add(building);
      const windowMaterial = new THREE.MeshStandardMaterial({ color: 0x92d7e8, emissive: 0x1b4e59, emissiveIntensity: 0.45, roughness: 0.25 });
      const columns = Math.max(2, Math.floor(width / 0.72));
      const rows = Math.max(2, Math.floor(height / 1.55));
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const windows = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.035), windowMaterial);
          windows.position.set(side * (-width / 2 - 0.02), 1.1 + row * 1.55, -depth / 2 + 0.7 + column * ((depth - 1.2) / Math.max(1, columns - 1)));
          buildingGroup.add(windows);
        }
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.65, 0.35, depth * 0.5), new THREE.MeshStandardMaterial({ color: 0x555a58, roughness: 0.9 }));
      roof.position.set(0, height + 0.18, 0);
      buildingGroup.add(roof);
      const rooftopUnit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.8), new THREE.MeshStandardMaterial({ color: 0x626866, roughness: 0.8 }));
      rooftopUnit.position.set(width * 0.18, height + 0.65, 0);
      buildingGroup.add(rooftopUnit);
      buildingGroup.position.set(side * (10 + Math.random() * 8), 0, 7 - index * 13);
      world.add(buildingGroup);
      scenery.push(buildingGroup);
    };
    for (let index = 0; index < 20; index += 1) { createBuilding(-1, index); createBuilding(1, index); }

    const createPedestrian = (side: number, index: number) => {
      const person = new THREE.Group();
      const skin = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x7b4e39 : 0xc88963, roughness: 0.85 });
      const clothes = new THREE.MeshStandardMaterial({ color: [0x315b78, 0x7c3f45, 0x4e6744, 0x8b6e3c][index % 4], roughness: 0.9 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.48, 0.16), clothes);
      torso.position.y = 0.75;
      person.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), skin);
      head.position.y = 1.12;
      person.add(head);
      [-0.07, 0.07].forEach((x) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.08), clothes);
        leg.position.set(x, 0.3, 0);
        person.add(leg);
      });
      person.position.set(side * (7.35 + Math.random() * 1.1), 0.03, 4 - index * 18);
      person.userData.walkPhase = Math.random() * Math.PI * 2;
      person.userData.walkSide = side;
      world.add(person);
      scenery.push(person);
      pedestrians.push(person);
    };
    for (let index = 0; index < 12; index += 1) { createPedestrian(-1, index); createPedestrian(1, index + 12); }

    const createLamp = (side: number, index: number) => {
      const pole = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 3.8, 8), new THREE.MeshStandardMaterial({ color: 0x303636, metalness: 0.5 }));
      post.position.y = 1.9;
      pole.add(post);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.18), new THREE.MeshBasicMaterial({ color: 0xfff4c7 }));
      light.position.set(-side * 0.15, 3.7, 0);
      pole.add(light);
      pole.position.set(side * 8.2, 0, 6 - index * 12);
      world.add(pole);
      scenery.push(pole);
    };
    for (let index = 0; index < 22; index += 1) { createLamp(-1, index); createLamp(1, index); }

    const createCar = (color: number, x: number, z: number) => {
      const car = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.38, 2.65), new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.25 }));
      body.position.y = 0.5;
      body.castShadow = true;
      car.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.42, 1.1), new THREE.MeshStandardMaterial({ color: 0x24343b, metalness: 0.4, roughness: 0.1 }));
      cabin.position.set(0, 0.85, -0.1);
      car.add(cabin);
      const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff4c7 });
      [-0.42, 0.42].forEach((wheelX) => {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x121817 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wheelX, 0.28, 0.85);
        car.add(wheel);
        const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.04), lightMaterial);
        headlight.position.set(wheelX, 0.56, -1.34);
        car.add(headlight);
      });
      car.position.set(x, 0, z);
      world.add(car);
      return car;
    };

    const player = createCar(0xd9382e, 0, 5.6);
    const traffic = [createCar(0x1d555f, -2.6, -28), createCar(0xe2b03c, 2.5, -49), createCar(0x464b9d, -2.5, -75), createCar(0xf2f2e7, 2.55, -105), createCar(0x2c834a, -2.5, -138)];
    traffic.forEach((car, index) => { car.userData.baseSpeed = 0.58 + index * 0.08; });

    const checkpoints: THREE.Mesh[] = [];
    [-2.5, 2.5, 0, -2.5, 2.5].forEach((x, index) => {
      const checkpoint = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.11, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0xf4d35e, emissive: 0xd56f25, emissiveIntensity: 1.4, metalness: 0.35, roughness: 0.2 }),
      );
      checkpoint.rotation.x = Math.PI / 2;
      checkpoint.position.set(x, 0.65, -16 - index * 30);
      world.add(checkpoint);
      checkpoints.push(checkpoint);
    });

    const keys = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => { keys.add(event.key.toLowerCase()); if (["arrowleft", "arrowright", "a", "d", "arrowup", "arrowdown", "w", "s"].includes(event.key.toLowerCase())) event.preventDefault(); };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const resize = () => { const width = mount.clientWidth; const height = mount.clientHeight; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); };
    resize();
    window.addEventListener("resize", resize);
    gsap.fromTo(player.position, { y: 2 }, { y: 0, duration: 1.1, ease: "bounce.out" });

    const clock = new THREE.Clock();
    let frameId = 0;
    let totalDistance = 0;
    let currentSpeed = 0;
    let crashed = false;
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const active = statusRef.current === "playing";
      const steer = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
      const throttle = Number(keys.has("w") || keys.has("arrowup"));
      const brake = Number(keys.has("s") || keys.has("arrowdown"));
      if (active && !crashed) {
        const targetSpeed = throttle ? 1 : brake ? 0.12 : 0.54;
        currentSpeed = THREE.MathUtils.lerp(currentSpeed, targetSpeed, delta * 2.8);
        player.position.x = THREE.MathUtils.clamp(player.position.x + steer * delta * 4.5, -5.2, 5.2);
        player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -steer * 0.12, delta * 8);
        totalDistance += currentSpeed * delta * 72;
        callbacksRef.current.setSpeed(Math.round(currentSpeed * 150));
        callbacksRef.current.setDistance(totalDistance);
        setPoints(Math.floor(totalDistance * 10));
        laneMarkers.forEach((marker) => { marker.position.z += currentSpeed * delta * 34; if (marker.position.z > 13) marker.position.z -= 256; });
        scenery.forEach((object) => { object.position.z += currentSpeed * delta * 34; if (object.position.z > 15) object.position.z -= 270; });
        pedestrians.forEach((person) => {
          person.userData.walkPhase += delta * 7;
          const walkAmount = Math.sin(person.userData.walkPhase) * 0.16;
          person.position.x = person.userData.walkSide * (7.7 + Math.sin(person.userData.walkPhase * 0.35) * 0.15);
          person.children[2].rotation.x = walkAmount;
          person.children[3].rotation.x = -walkAmount;
        });
        traffic.forEach((car) => { car.position.z += (currentSpeed - car.userData.baseSpeed) * delta * 19; if (car.position.z > 13) car.position.z = -140 - Math.random() * 25; });
        checkpoints.forEach((checkpoint) => {
          checkpoint.rotation.z += delta * 2.5;
          checkpoint.position.z += currentSpeed * delta * 34;
          if (checkpoint.position.z > 13) checkpoint.position.z = -165 - Math.random() * 35;
          if (Math.abs(checkpoint.position.x - player.position.x) < 0.95 && Math.abs(checkpoint.position.z - player.position.z) < 1.1) {
            setPoints((currentPoints) => currentPoints + 100);
            gsap.to(checkpoint.scale, { x: 2.2, y: 2.2, z: 2.2, duration: 0.16, yoyo: true, repeat: 1, ease: "back.out" });
            checkpoint.position.z = -165 - Math.random() * 35;
          }
        });
        const collision = traffic.some((car) => Math.abs(car.position.x - player.position.x) < 1.15 && Math.abs(car.position.z - player.position.z) < 1.6);
        if (collision) { crashed = true; callbacksRef.current.setStatus("crashed"); gsap.to(player.rotation, { z: 0.35, duration: 0.25, yoyo: true, repeat: 3 }); }
      }
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.18, delta * 4);
      camera.lookAt(player.position.x * 0.15, 0.65, -18);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(frameId); window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); window.removeEventListener("resize", resize); renderer.dispose(); mount.removeChild(renderer.domElement); };
  }, []);

  const start = () => setStatus("playing");
  const reset = () => { setBest((value) => Math.max(value, Math.round(distance))); setSpeed(0); setDistance(0); setPoints(0); setStatus("ready"); window.location.reload(); };
  return <main className="drive-shell"><header className="drive-header"><a className="drive-brand" href="#drive"><span className="brand-mark" />ZENVOX <b>/</b> DRIVE</a><span className="drive-mode">Freeway run <i /> Solo session</span><button className="drive-pause" onClick={() => setStatus(status === "playing" ? "paused" : "playing")} aria-label="Pause or resume">{status === "playing" ? "Ⅱ" : "▶"}</button></header><section className="drive-stage" id="drive"><div className="drive-canvas" ref={gameRef} aria-label="3D driving game" /><div className="drive-hud drive-left"><span>Distance</span><strong>{formatDistance(distance)}</strong><small>Best {formatDistance(best)}</small></div><div className="drive-hud drive-score"><span>Points</span><strong>{points.toLocaleString()}</strong></div><div className="drive-hud drive-right"><span>Current speed</span><strong>{speed}<small> KM/H</small></strong><div className="speed-line"><i style={{ width: `${Math.min(100, (speed / 150) * 100)}%` }} /></div></div><div className="drive-reticle">+</div>{status === "ready" && <div className="drive-overlay"><p className="drive-kicker">Route 01 / City limits</p><h1>Own the<br /><em>open road.</em></h1><p>Thread through traffic, hold your line, and make the city blur.</p><button className="drive-start" onClick={start}>Start drive <b>↗</b></button><small>WASD / ARROWS TO STEER · W TO ACCELERATE</small></div>}{status === "paused" && <div className="drive-overlay compact-drive"><p className="drive-kicker">Transmission held</p><h2>Paused.</h2><button className="drive-start" onClick={start}>Resume <b>▶</b></button></div>}{status === "crashed" && <div className="drive-overlay compact-drive"><p className="drive-kicker">Impact detected</p><h2>Run ended.</h2><p>You travelled {formatDistance(distance)} and scored {points.toLocaleString()} points.</p><button className="drive-start" onClick={reset}>Drive again <b>↗</b></button></div>}<div className="drive-touch"><button onPointerDown={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft" }))}>←</button><button onPointerDown={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowUp" }))}>↑</button><button onPointerDown={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight" }))}>→</button></div></section><footer className="drive-footer"><span>Traffic <b>ACTIVE</b></span><span>Weather <b>Clear / 24°</b></span><span>Controls <b>Keyboard + touch</b></span><span>© 2026 ZENVOX MOTORSPORT</span></footer></main>;
}
