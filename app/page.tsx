"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

type GameStatus = "ready" | "playing" | "paused" | "won" | "lost";

const TOTAL_SHARDS = 12;
const GAME_TIME = 60;

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function GameCanvas({
  status,
  onScore,
  onTime,
  onFinish,
}: {
  status: GameStatus;
  onScore: (score: number) => void;
  onTime: (time: number) => void;
  onFinish: (result: "won" | "lost") => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(status);
  const scoreRef = useRef(0);
  const timeRef = useRef(GAME_TIME);
  const callbacksRef = useRef({ onScore, onTime, onFinish });

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { callbacksRef.current = { onScore, onTime, onFinish }; }, [onScore, onTime, onFinish]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x101817, 10, 27);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 50);
    camera.position.set(0, 10.5, 8.2);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x101817, 0);
    mount.appendChild(renderer.domElement);

    const arena = new THREE.Group();
    scene.add(arena);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8.5, 64),
      new THREE.MeshStandardMaterial({ color: 0x172a27, roughness: 0.9, metalness: 0.1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    arena.add(floor);

    const grid = new THREE.GridHelper(17, 17, 0x5c8f83, 0x27453f);
    grid.position.y = 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    arena.add(grid);

    const player = new THREE.Group();
    const ship = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.25, 4),
      new THREE.MeshStandardMaterial({ color: 0xa7d8c8, emissive: 0x275c50, emissiveIntensity: 0.7, metalness: 0.65, roughness: 0.25 }),
    );
    ship.rotation.x = Math.PI / 2;
    player.add(ship);
    const engine = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xf4d35e }),
    );
    engine.position.z = 0.54;
    player.add(engine);
    player.position.set(0, 0.55, 5.8);
    arena.add(player);

    const shards: THREE.Mesh[] = [];
    const shardPositions = [
      [-5.8, -4.8], [-2.8, -2.7], [1.2, -4.8], [5.4, -3.2],
      [-6.2, 0.5], [-2.2, 1.4], [2.4, 0.2], [6.1, 1.8],
      [-5.2, 4.6], [-1, 4.2], [3.2, 4.8], [6.2, 5.8],
    ];
    shardPositions.forEach(([x, z], index) => {
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.27, 0),
        new THREE.MeshStandardMaterial({ color: 0xf4d35e, emissive: 0xd56f25, emissiveIntensity: 1.2, metalness: 0.25, roughness: 0.2 }),
      );
      shard.position.set(x, 0.55, z);
      shard.userData.index = index;
      arena.add(shard);
      shards.push(shard);
    });

    const hazards: THREE.Mesh[] = [];
    [[-4, -1.3], [0.4, -1.9], [4.3, 3.7], [-3.7, 3.4]].forEach(([x, z]) => {
      const hazard = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.13, 10, 24),
        new THREE.MeshStandardMaterial({ color: 0xf26449, emissive: 0x6b1f15, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.3 }),
      );
      hazard.position.set(x, 0.45, z);
      hazard.rotation.x = Math.PI / 2;
      arena.add(hazard);
      hazards.push(hazard);
    });

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(420 * 3);
    for (let index = 0; index < starPositions.length; index += 3) {
      starPositions[index] = (Math.random() - 0.5) * 32;
      starPositions[index + 1] = Math.random() * 8 - 1;
      starPositions[index + 2] = (Math.random() - 0.5) * 32;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xa7d8c8, size: 0.045, transparent: true, opacity: 0.65 }));
    scene.add(stars);

    scene.add(new THREE.HemisphereLight(0xcde8da, 0x101817, 2.4));
    const keyLight = new THREE.PointLight(0xf26449, 18, 18);
    keyLight.position.set(3, 6, 4);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x9edec8, 14, 15);
    rimLight.position.set(-4, 4, -2);
    scene.add(rimLight);

    const keys = new Set<string>();
    const down = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(event.key)) event.preventDefault();
      keys.add(event.key.toLowerCase());
    };
    const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();
    window.addEventListener("resize", resize);

    gsap.fromTo(arena.scale, { x: 0.82, y: 0.82, z: 0.82 }, { x: 1, y: 1, z: 1, duration: 1.2, ease: "expo.out" });
    gsap.fromTo(player.position, { y: 3 }, { y: 0.55, duration: 1.1, ease: "bounce.out", delay: 0.15 });

    const clock = new THREE.Clock();
    let frameId = 0;
    let lastSecond = GAME_TIME;
    let finished = false;
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const active = statusRef.current === "playing";
      shards.forEach((shard, index) => {
        if (shard.visible) {
          shard.rotation.y += delta * 2.2;
          shard.position.y = 0.55 + Math.sin(elapsed * 2.4 + index) * 0.1;
        }
      });
      hazards.forEach((hazard, index) => { hazard.rotation.z += delta * (index % 2 ? -1.2 : 1.2); });
      stars.rotation.y += delta * 0.008;

      if (active && !finished) {
        const xAxis = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
        const zAxis = Number(keys.has("s") || keys.has("arrowdown")) - Number(keys.has("w") || keys.has("arrowup"));
        const direction = new THREE.Vector3(xAxis, 0, zAxis);
        if (direction.lengthSq() > 0) {
          direction.normalize();
          player.position.addScaledVector(direction, delta * 5.2);
          player.rotation.y = THREE.MathUtils.lerp(player.rotation.y, Math.atan2(direction.x, direction.z), delta * 8);
        }
        player.position.x = THREE.MathUtils.clamp(player.position.x, -7.2, 7.2);
        player.position.z = THREE.MathUtils.clamp(player.position.z, -6.8, 6.8);
        const remaining = Math.max(0, GAME_TIME - Math.floor(clock.elapsedTime));
        if (remaining !== lastSecond) { lastSecond = remaining; timeRef.current = remaining; callbacksRef.current.onTime(remaining); }

        shards.forEach((shard) => {
          if (shard.visible && player.position.distanceTo(shard.position) < 0.72) {
            shard.visible = false;
            scoreRef.current += 1;
            callbacksRef.current.onScore(scoreRef.current);
            gsap.to(shard.scale, { x: 2.8, y: 2.8, z: 2.8, duration: 0.18, yoyo: true, repeat: 1, ease: "back.out" });
          }
        });
        const hitHazard = hazards.some((hazard) => player.position.distanceTo(hazard.position) < 0.75);
        if (scoreRef.current === TOTAL_SHARDS) { finished = true; callbacksRef.current.onFinish("won"); }
        else if (hitHazard || remaining === 0) { finished = true; callbacksRef.current.onFinish("lost"); }
      }
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x * 0.1, delta * 2);
      camera.lookAt(player.position.x * 0.08, 0, player.position.z * 0.08);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("resize", resize);
      starGeometry.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="game-canvas" ref={mountRef} aria-label="3D shard runner game" />;
}

export default function Home() {
  const [status, setStatus] = useState<GameStatus>("ready");
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(GAME_TIME);

  const reset = () => { window.location.reload(); };
  const begin = () => setStatus("playing");

  return (
    <main className="game-shell">
      <header className="game-header">
        <a className="brand" href="#game" aria-label="Shard runner home"><span className="brand-mark" />SHARD / RUNNER</a>
        <p className="mission">Mission 01 <span>/</span> Collect the signal</p>
        <div className="header-right"><span className="status"><i /> System online</span><button className="pause-button" onClick={() => setStatus(status === "playing" ? "paused" : "playing")} aria-label="Pause or resume game">{status === "playing" ? "Ⅱ" : "▶"}</button></div>
      </header>

      <section className="game-stage" id="game">
        <GameCanvas status={status} onScore={setScore} onTime={setTime} onFinish={setStatus} />
        <div className="hud top-left"><span>Sector 07</span><b>Neon meadow</b></div>
        <div className="hud top-right"><span>Time remaining</span><b className={time < 10 ? "danger" : ""}>{formatTime(time)}</b></div>
        <div className="score-panel"><span>Shards recovered</span><strong>{String(score).padStart(2, "0")} <small>/ {TOTAL_SHARDS}</small></strong><div className="progress"><i style={{ width: `${(score / TOTAL_SHARDS) * 100}%` }} /></div></div>
        {status === "ready" && <div className="game-overlay"><p className="eyebrow">A signal is waiting</p><h1>Run the<br /><em>meadow.</em></h1><p>Steer your ship through the field. Collect every shard. Red rings end the run.</p><button className="start-button" onClick={begin}><span>Start mission</span><b>↗</b></button><small>WASD / ARROW KEYS TO MOVE</small></div>}
        {status === "paused" && <div className="game-overlay compact"><p className="eyebrow">Transmission held</p><h2>Paused.</h2><button className="start-button" onClick={() => setStatus("playing")}><span>Resume mission</span><b>▶</b></button></div>}
        {(status === "won" || status === "lost") && <div className="game-overlay compact"><p className="eyebrow">{status === "won" ? "Signal secured" : "Signal lost"}</p><h2>{status === "won" ? "You found it." : "Run ended."}</h2><p>You recovered {score} of {TOTAL_SHARDS} shards.</p><button className="start-button" onClick={reset}><span>Run it again</span><b>↗</b></button></div>}
        <div className="touch-controls"><button onPointerDown={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft" }))}>←</button><div><button onPointerDown={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowUp" }))}>↑</button><button onPointerDown={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowDown" }))}>↓</button></div><button onPointerDown={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))} onPointerUp={() => window.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight" }))}>→</button></div>
      </section>
      <footer className="game-footer"><span>Best run <b>{score === TOTAL_SHARDS ? "12 / 12" : "-- / 12"}</b></span><span>Move with intention <i>●</i></span><span>© 2026 Orbit Systems</span></footer>
    </main>
  );
}
