import { ContactShadows, Html, OrbitControls, QuadraticBezierLine, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useSim } from '../sim/store';

export interface NetUnit {
  id: string;
  name: string;
  plan: number; // %
  oee: number;
  good: number;
  down: number;
}
export interface NetOrg {
  id: string;
  name: string;
  plan: number;
  units: NetUnit[];
}

const tone = (p: number, dark: boolean) => (p >= 95 ? (dark ? '#7DB08F' : '#4E8A68') : p >= 88 ? (dark ? '#D6B56E' : '#B8954A') : dark ? '#E0826B' : '#B9533F');

/** Isometric diagram: headquarters hub → regional platforms → plant towers (height = output, cap = plan status). */
export default function GroupNetwork({ orgs, onUnit, focus }: { orgs: NetOrg[]; onUnit: (id: string) => void; focus?: string | null }) {
  const dark = useSim((s) => s.theme) === 'dark';
  const calm = useSim((s) => s.calm);
  const [hover, setHover] = useState<string | null>(null);
  const maxGood = Math.max(1, ...orgs.flatMap((o) => o.units.map((u) => u.good)));
  const slots: [number, number][] = [
    [-7.5, -6],
    [7.5, -6],
    [-7.5, 6],
    [7.5, 6],
  ];
  const body = dark ? '#3A3B3E' : '#FFFFFF';
  const plate = dark ? '#2A2B2E' : '#F1F0EE';
  const line = dark ? '#5B5D61' : '#B8B4AD';

  return (
    <>
      <ambientLight intensity={dark ? 0.7 : 1.1} />
      <directionalLight position={[8, 18, 10]} intensity={dark ? 1.3 : 1.6} />
      <directionalLight position={[-10, 8, -6]} intensity={0.35} />

      {/* headquarters hub */}
      <group>
        <RoundedBox args={[2.6, 0.6, 2.6]} radius={0.22} smoothness={4} position={[0, 0.3, 0]}>
          <meshStandardMaterial color={dark ? '#2E2F32' : '#1F2022'} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.86, 48]} />
          <meshBasicMaterial color="#FE4B1E" />
        </mesh>
        <Html position={[0, -0.2, 1.9]} center style={{ pointerEvents: 'none' }} zIndexRange={[5, 0]}>
          <span className="eyebrow whitespace-nowrap !text-[9.5px]">Apex Polymers · HQ</span>
        </Html>
      </group>

      {orgs.map((o, oi) => {
        const [ox, oz] = slots[oi % 4];
        const w = o.units.length * 1.9 + 0.8;
        return (
          <group key={o.id}>
            <Flow from={[0, 0.65, 0]} to={[ox, 0.4, oz]} color={line} calm={calm} delay={oi * 0.7} accent={tone(o.plan, dark)} />
            <group position={[ox, 0, oz]}>
              <RoundedBox args={[w, 0.3, 3.2]} radius={0.12} smoothness={4} position={[0, 0.15, 0]}>
                <meshStandardMaterial color={plate} roughness={0.9} />
              </RoundedBox>
              {o.units.map((u, ui) => {
                const h = 0.5 + (u.good / maxGood) * 4.2;
                const x = -w / 2 + 1.35 + ui * 1.9;
                const lift = hover === u.id || focus === u.id;
                return (
                  <Tower key={u.id} u={u} x={x} h={h} body={body} cap={tone(u.plan, dark)} lift={lift} calm={calm} delay={oi * 0.15 + ui * 0.08} onOver={() => setHover(u.id)} onOut={() => setHover(null)} onClick={() => onUnit(u.id)} />
                );
              })}
              <Html position={[0, 0, 2.2]} center style={{ pointerEvents: 'none' }} zIndexRange={[5, 0]}>
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone(o.plan, dark) }} />
                  <span className="eyebrow !text-[9.5px] !text-fg2">{o.name}</span>
                  <span className="num text-[11px] text-fg3">{o.plan.toFixed(0)}%</span>
                </div>
              </Html>
            </group>
          </group>
        );
      })}
      <ContactShadows position={[0, 0, 0]} opacity={dark ? 0.55 : 0.28} scale={44} blur={2.8} far={8} resolution={512} color="#1F2022" />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate={!calm} autoRotateSpeed={0.35} minPolarAngle={0.7} maxPolarAngle={1.1} />
    </>
  );
}

function Tower({ u, x, h, body, cap, lift, calm, delay, onOver, onOut, onClick }: { u: NetUnit; x: number; h: number; body: string; cap: string; lift: boolean; calm: boolean; delay: number; onOver: () => void; onOut: () => void; onClick: () => void }) {
  const g = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const dot = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const k = calm ? 1 : Math.min(1, Math.max(0, (clock.elapsedTime - t0.current - delay) / 0.9));
    const e = 1 - Math.pow(1 - k, 3);
    if (g.current) {
      g.current.scale.y = Math.max(0.001, e);
      g.current.position.y = 0.3 + (lift ? 0.25 : 0);
    }
    if (dot.current) dot.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.25);
  });
  return (
    <group position={[x, 0, 0]}>
      <group
        ref={g}
        onPointerOver={(e) => {
          e.stopPropagation();
          onOver();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          onOut();
          document.body.style.cursor = '';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <RoundedBox args={[1.1, h, 1.1]} radius={0.12} smoothness={4} position={[0, h / 2, 0]}>
          <meshStandardMaterial color={body} roughness={0.55} />
        </RoundedBox>
        <RoundedBox args={[1.12, 0.14, 1.12]} radius={0.06} smoothness={3} position={[0, h + 0.02, 0]}>
          <meshStandardMaterial color={cap} roughness={0.4} emissive={cap} emissiveIntensity={0.15} />
        </RoundedBox>
      </group>
      {u.down > 0 && (
        <mesh ref={dot} position={[0.62, h + 0.75, 0.62]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#E0826B" />
        </mesh>
      )}
      {lift && (
        <Html position={[0, h + 1.2, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[30, 10]}>
          <div className="glass-strong whitespace-nowrap rounded-[10px] px-3 py-2 shadow-[var(--shadow)]">
            <div className="text-[12px] font-medium">{u.name}</div>
            <div className="num text-[11px] text-fg3">
              {u.plan.toFixed(1)}% of plan · OEE {u.oee.toFixed(0)}% · {u.down} down
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Flow({ from, to, color, accent, calm, delay }: { from: [number, number, number]; to: [number, number, number]; color: string; accent: string; calm: boolean; delay: number }) {
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, 2.4, (from[2] + to[2]) / 2];
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(...from), new THREE.Vector3(...mid), new THREE.Vector3(...to)), [from, mid, to]);
  const dots = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!dots.current || calm) return;
    dots.current.children.forEach((c, i) => {
      const t = ((clock.elapsedTime * 0.28 + delay + i / 3) % 1 + 1) % 1;
      c.position.copy(curve.getPoint(1 - t));
    });
  });
  return (
    <group>
      <QuadraticBezierLine start={from} end={to} mid={mid} color={color} lineWidth={1} dashed dashSize={0.25} gapSize={0.18} />
      <group ref={dots}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshBasicMaterial color={accent} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
