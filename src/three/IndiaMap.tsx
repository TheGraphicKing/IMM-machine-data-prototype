import { Html, OrbitControls, QuadraticBezierLine, Sparkles } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OC } from 'three-stdlib';
import { useSim } from '../sim/store';

/** Simplified India outline (lng, lat), clockwise from Kutch. Stylised, not survey-grade. */
export const INDIA: [number, number][] = [
  [68.2, 23.7], [69.0, 24.3], [70.5, 24.4], [71.0, 24.6], [70.3, 25.7], [70.0, 27.0], [71.0, 27.9], [72.3, 28.9], [73.4, 29.9], [74.0, 30.8], [74.6, 31.9], [74.7, 32.5], [73.9, 33.6], [73.9, 34.6], [74.3, 35.6], [75.5, 36.6], [77.0, 35.9], [78.0, 35.5], [79.4, 35.3], [80.0, 34.6], [79.5, 33.9], [78.9, 33.0], [79.3, 32.5], [78.9, 31.5], [79.5, 30.9], [80.6, 30.4], [80.1, 28.8], [81.8, 27.9], [83.3, 27.4], [84.6, 27.3], [85.9, 26.6], [87.0, 26.4], [88.1, 26.4], [88.2, 27.2], [88.9, 27.9], [88.8, 27.1], [89.6, 26.8], [90.6, 26.8], [91.9, 26.9], [92.1, 27.6], [93.8, 28.3], [95.4, 29.2], [96.6, 28.9], [97.4, 28.2], [97.1, 27.4], [96.1, 27.2], [95.2, 26.5], [94.6, 25.6], [94.3, 24.3], [93.7, 23.9], [93.4, 23.0], [93.2, 22.2], [92.6, 22.0], [92.3, 23.7], [91.4, 24.1], [92.2, 24.9], [91.8, 25.2], [90.1, 25.2], [89.8, 25.9], [89.0, 26.1], [88.5, 25.5], [88.0, 24.9], [88.7, 24.2], [88.7, 23.3], [88.9, 22.0], [87.9, 21.6], [86.8, 20.5], [85.3, 19.5], [84.2, 18.3], [82.6, 17.0], [81.3, 16.3], [80.3, 15.4], [80.2, 13.4], [79.8, 11.7], [79.8, 10.3], [79.1, 9.3], [78.2, 8.9], [77.5, 8.1], [76.6, 8.9], [76.2, 10.0], [75.6, 11.6], [74.8, 13.0], [74.4, 14.6], [73.7, 15.8], [73.2, 17.4], [72.8, 19.0], [72.9, 20.6], [72.6, 21.5], [72.4, 22.3], [72.0, 21.3], [70.9, 20.7], [69.6, 21.6], [69.0, 22.4], [70.3, 22.9], [68.9, 23.0],
];
export const proj = (lng: number, lat: number): [number, number] => [(lng - 81) * 1.0, -(lat - 22) * 1.0];

export interface MapPoint {
  id: string;
  lng: number;
  lat: number;
  height: number; // 0..1
  color: string;
  label: string;
  sub: string;
  pulse: boolean;
}

const HUBS = [
  { name: 'Orion Motors · Gurugram', lng: 77.03, lat: 28.46 },
  { name: 'Orion Motors · Chennai', lng: 80.04, lat: 12.82 },
  { name: 'Nova Appliances · Pune', lng: 73.85, lat: 18.52 },
  { name: 'Nova Appliances · Noida', lng: 77.39, lat: 28.53 },
  { name: 'Kestrel · Hosur', lng: 77.82, lat: 12.73 },
  { name: 'Kestrel · Jamshedpur', lng: 86.18, lat: 22.9 },
];

export default function IndiaMap({ points, selected, onSelect, hover, setHover, arcs = true }: { points: MapPoint[]; selected: string | null; onSelect: (id: string | null) => void; hover: string | null; setHover: (id: string | null) => void; arcs?: boolean }) {
  const dark = useSim((s) => s.theme) === 'dark';
  const calm = useSim((s) => s.calm);
  const geom = useMemo(() => {
    const shape = new THREE.Shape();
    INDIA.forEach(([lng, lat], i) => {
      const [x, z] = proj(lng, lat);
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geom, 30), [geom]);
  const controls = useRef<OC>(null);
  const { camera } = useThree();
  const fly = useRef<{ to: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null);
  const prev = useRef<string | null>(null);
  if (selected !== prev.current) {
    prev.current = selected;
    const p = points.find((x) => x.id === selected);
    if (p) {
      const [x, z] = proj(p.lng, p.lat);
      fly.current = { target: new THREE.Vector3(x, 0.5, z), to: new THREE.Vector3(x + 4, 14, z + 13), t: 0 };
    } else fly.current = { target: new THREE.Vector3(0, 0, 0), to: new THREE.Vector3(0, 30, 27), t: 0 };
  }
  useFrame((_, dt) => {
    const f = fly.current;
    const c = controls.current;
    if (f && c) {
      f.t = Math.min(1, f.t + dt * (calm ? 4 : 1));
      const a = f.t >= 1 ? 1 : 0.04 + f.t * 0.1;
      camera.position.lerp(f.to, a);
      c.target.lerp(f.target, a);
      c.update();
      if (f.t >= 1) fly.current = null;
    }
  });

  return (
    <>
      <ambientLight intensity={dark ? 0.5 : 0.9} />
      <directionalLight position={[10, 30, 20]} intensity={dark ? 1.4 : 1.8} />
      <pointLight position={[-10, 8, 6]} intensity={80} color="#8AA6CF" distance={40} />
      <mesh geometry={geom} position={[0, -0.6, 0]} onPointerDown={() => onSelect(null)}>
        <meshStandardMaterial color={dark ? '#222326' : '#FFFFFF'} metalness={0.3} roughness={0.6} />
      </mesh>
      <lineSegments geometry={edges} position={[0, -0.6, 0]}>
        <lineBasicMaterial color={dark ? '#8AA6CF' : '#A8A298'} transparent opacity={dark ? 0.55 : 0.8} />
      </lineSegments>
      <gridHelper args={[80, 80, dark ? '#27282B' : '#E3E1DE', dark ? '#1B1C1E' : '#EFEFED']} position={[0, -0.62, 0]} />
      {!calm && dark && <Sparkles count={60} scale={[34, 6, 34]} size={2} speed={0.25} opacity={0.35} color="#8A857C" />}
      {points.map((p) => (
        <Pillar key={p.id} p={p} selected={selected === p.id} hover={hover === p.id} onSelect={onSelect} setHover={setHover} calm={calm} />
      ))}
      {arcs && HUBS.map((h) => {
        const [hx, hz] = proj(h.lng, h.lat);
        return (
          <group key={h.name}>
            <mesh position={[hx, 0.06, hz]}>
              <octahedronGeometry args={[0.28]} />
              <meshStandardMaterial color="#CFCCC7" emissive="#CFCCC7" emissiveIntensity={0.6} />
            </mesh>
            {points
              .filter((p) => Math.hypot(p.lng - h.lng, p.lat - h.lat) < 9)
              .slice(0, 3)
              .map((p) => {
                const [px, pz] = proj(p.lng, p.lat);
                return <Arc key={p.id} start={[px, 0.1, pz]} end={[hx, 0.1, hz]} calm={calm} color={p.color} />;
              })}
          </group>
        );
      })}
      <OrbitControls ref={controls} enablePan enableDamping minDistance={8} maxDistance={60} maxPolarAngle={Math.PI / 2.4} target={[0, 0, 0]} />
    </>
  );
}

function Arc({ start, end, calm, color }: { start: [number, number, number]; end: [number, number, number]; calm: boolean; color: string }) {
  const ref = useRef<{ material: { dashOffset: number } } | null>(null);
  const mid: [number, number, number] = [(start[0] + end[0]) / 2, 2.2 + Math.hypot(start[0] - end[0], start[2] - end[2]) * 0.25, (start[2] + end[2]) / 2];
  useFrame((_, dt) => {
    if (ref.current && !calm) ref.current.material.dashOffset -= dt * 0.6;
  });
  return <QuadraticBezierLine ref={ref as never} start={start} end={end} mid={mid} color={color} lineWidth={1.4} dashed dashScale={6} dashSize={0.6} gapSize={0.6} transparent opacity={0.75} />;
}

function Pillar({ p, selected, hover, onSelect, setHover, calm }: { p: MapPoint; selected: boolean; hover: boolean; onSelect: (id: string) => void; setHover: (id: string | null) => void; calm: boolean }) {
  const [x, z] = proj(p.lng, p.lat);
  const h = 0.5 + p.height * 4.5;
  const ring = useRef<THREE.Mesh>(null);
  const grow = useRef(0);
  const col = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    grow.current = Math.min(1, grow.current + dt * (calm ? 10 : 1.2));
    const k = 1 - Math.pow(1 - grow.current, 3);
    if (col.current) {
      col.current.scale.y = Math.max(0.01, k);
      col.current.position.y = (h * k) / 2;
    }
    if (ring.current) {
      const s = 1 + ((performance.now() / 1000) % 1.6) * (p.pulse && !calm ? 1.4 : 0);
      ring.current.scale.set(s, s, s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = p.pulse && !calm ? 0.7 - ((performance.now() / 1000) % 1.6) * 0.42 : 0.4;
    }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh
        ref={col}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(p.id);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(null);
          document.body.style.cursor = '';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(p.id);
        }}
        scale={[selected || hover ? 1.25 : 1, 1, selected || hover ? 1.25 : 1]}
      >
        <cylinderGeometry args={[0.22, 0.22, h, 20]} />
        <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={selected ? 2.2 : 1.1} transparent opacity={0.92} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.32, 0.44, 32]} />
        <meshBasicMaterial color={p.color} transparent opacity={0.5} />
      </mesh>
      {(hover || selected) && (
        <Html position={[0, h + 0.8, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
          <div className="glass-strong whitespace-nowrap rounded-[8px] px-2.5 py-1.5 text-[12px] shadow-[var(--shadow)]" style={{ borderTop: `3px solid ${p.color}` }}>
            <div className="num text-[14px] font-bold">{p.label}</div>
            <div className="text-fg3">{p.sub}</div>
          </div>
        </Html>
      )}
    </group>
  );
}
