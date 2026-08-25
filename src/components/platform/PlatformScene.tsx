"use client";

import { Float, MeshTransmissionMaterial, OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

function SignalCore() {
  return <Float speed={1.3} rotationIntensity={0.45} floatIntensity={0.6}><mesh rotation={[0.3, 0.5, 0.1]}><torusKnotGeometry args={[1.35, 0.28, 180, 32, 2, 3]} /><MeshTransmissionMaterial color="#e86f51" emissive="#651f16" emissiveIntensity={1.1} roughness={0.16} metalness={0.7} thickness={0.5} /></mesh></Float>;
}

export function PlatformScene() {
  return <div className="platform-scene" aria-label="Animated NEXORA signal core"><Canvas camera={{ position: [0, 1.5, 7], fov: 42 }} dpr={[1, 2]}><ambientLight intensity={1.8} /><pointLight color="#f26449" intensity={28} position={[3, 4, 4]} /><pointLight color="#9edec8" intensity={20} position={[-4, 1, -3]} /><SignalCore /><Sparkles count={180} scale={9} size={2} speed={0.28} color="#a7d8c8" /><OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.35} /></Canvas></div>;
}
