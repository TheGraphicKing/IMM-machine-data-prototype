import { Html, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OC } from 'three-stdlib';
import IMM, { STATUS_HEX } from './IMM';
import { useSim } from '../sim/store';
import { machineKpis } from '../sim/kpi';
import { timer, fmt } from '../lib/format';
import type { Machine } from '../sim/types';
import type { World } from '../sim/engine';

export interface FactoryOpts {
  heat: boolean;
  people: boolean;
  trucks: boolean;
  labels: boolean;
}

/** Machine layout for a unit: halls side by side, two facing rows per hall. */
export function layout(ms: Machine[]) {
  const pos: Record<string, [number, number, number]> = {};
  const halls = [...new Set(ms.map((m) => m.hall))];
  const perRow = Math.max(5, ...halls.map((h) => Math.ceil(ms.filter((x) => x.hall === h).length / 2)));
  const hallW = perRow * 5 + 2;
  ms.forEach((m) => {
    const hi = halls.indexOf(m.hall);
    const inHall = ms.filter((x) => x.hall === m.hall);
    const idx = inHall.indexOf(m);
    const row = Math.floor(idx / perRow) % 2;
    const col = idx % perRow;
    const hallX = halls.length === 1 ? 0 : hi === 0 ? -(hallW / 2 + 1.5) : hallW / 2 + 1.5;
    pos[m.id] = [hallX + (col - (perRow - 1) / 2) * 5, 0, row === 0 ? -7.5 : 7.5];
  });
  return { pos, halls, hallW };
}

const floorMat = new THREE.MeshStandardMaterial({ color: '#212225', roughness: 0.9, metalness: 0.1 });
const floorMatLight = new THREE.MeshStandardMaterial({ color: '#E3E1DE', roughness: 0.95 });
const lineMat = new THREE.MeshBasicMaterial({ color: '#8A857C', transparent: true, opacity: 0.55 });
const truckMat = new THREE.MeshStandardMaterial({ color: '#38393C', metalness: 0.4, roughness: 0.5 });
const cabMat = new THREE.MeshStandardMaterial({ color: '#CFCCC7', metalness: 0.3, roughness: 0.5 });
const plateMat = new THREE.MeshBasicMaterial({ color: '#F4E3A1' });
const personMat = new THREE.MeshStandardMaterial({ color: '#FE4B1E', emissive: '#FE4B1E', emissiveIntensity: 0.6 });
const beltMat = new THREE.MeshStandardMaterial({ color: '#2E2F32', metalness: 0.4 });
const boxMat = new THREE.MeshStandardMaterial({ color: '#A8865A', roughness: 0.8 });
const craneMat = new THREE.MeshStandardMaterial({ color: '#6B675F', metalness: 0.7, roughness: 0.35 });

function oeeColor(oee: number) {
  const c = new THREE.Color();
  if (oee >= 75) c.set('#7DB08F');
  else if (oee >= 60) c.set('#D6B56E');
  else c.set('#E0826B');
  return c;
}

export default function Factory({ w, ms, opts, selected, onSelect, hover, setHover }: { w: World; ms: Machine[]; opts: FactoryOpts; selected: string | null; onSelect: (id: string | null) => void; hover: string | null; setHover: (id: string | null) => void }) {
  useSim((s) => s.version);
  const calm = useSim((s) => s.calm);
  const dark = useSim((s) => s.theme) === 'dark';
  const { pos, halls, hallW } = useMemo(() => layout(ms), [ms]);
  const controls = useRef<OC>(null);
  const { camera } = useThree();
  const fly = useRef<{ to: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null);
  const prevSel = useRef<string | null>(null);

  if (selected !== prevSel.current) {
    prevSel.current = selected;
    if (selected && pos[selected]) {
      const p = pos[selected];
      fly.current = { target: new THREE.Vector3(p[0], 1.5, p[2]), to: new THREE.Vector3(p[0] + 9, 9, p[2] + (p[2] < 0 ? -12 : 12)), t: 0 };
    } else if (!selected) {
      fly.current = { target: new THREE.Vector3(0, 0, 4), to: new THREE.Vector3(34, 44, 58), t: 0 };
    }
  }

  useFrame((_, dt) => {
    const f = fly.current;
    const c = controls.current;
    if (f && c) {
      f.t = Math.min(1, f.t + dt * (calm ? 4 : 1.1));
      const k = 1 - Math.pow(1 - f.t, 3);
      const a = f.t >= 1 ? 1 : 0.05 + k * 0.12;
      camera.position.lerp(f.to, a);
      c.target.lerp(f.target, a);
      c.update();
      if (f.t >= 1) fly.current = null;
    }
  });

  const unitTrucks = w.trucks.filter((k) => k.unitId === ms[0]?.unitId && k.phase < 3).slice(0, 6);

  return (
    <>
      <ambientLight intensity={dark ? 0.55 : 0.85} />
      <hemisphereLight args={[dark ? '#3A3B3E' : '#ffffff', dark ? '#18191B' : '#E3E1DE', dark ? 0.4 : 0.6]} />
      <directionalLight position={[20, 40, 25]} intensity={dark ? 1.6 : 2.0} />
      <pointLight position={[-15, 12, 0]} intensity={dark ? 160 : 60} color="#8AA6CF" distance={40} />
      <pointLight position={[15, 12, 0]} intensity={dark ? 160 : 60} color="#FE4B1E" distance={40} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 4]} material={dark ? floorMat : floorMatLight} onPointerDown={() => onSelect(null)}>
        <planeGeometry args={[90, 64]} />
      </mesh>
      <gridHelper args={[90, 45, dark ? '#38393C' : '#CFCCC7', dark ? '#27282B' : '#E3E1DE']} position={[0, 0.005, 4]} />

      {/* hall outlines + aisle markings */}
      {halls.map((h, i) => {
        const x = halls.length === 1 ? 0 : i === 0 ? -(hallW / 2 + 1.5) : hallW / 2 + 1.5;
        return (
          <group key={h} position={[x, 0.02, 0]}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[0, 0, s * 1.6]} material={lineMat} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[hallW - 2, 0.12]} />
              </mesh>
            ))}
            <lineSegments position={[0, 0.01, 0]}>
              <edgesGeometry args={[new THREE.BoxGeometry(hallW, 0.01, 30)]} />
              <lineBasicMaterial color={dark ? '#4A4744' : '#B8B4AD'} />
            </lineSegments>
            {opts.labels && (
              <Html position={[-hallW / 2 + 1, 0.1, -15.5]} center={false} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
                <div className="num whitespace-nowrap text-[13px] font-bold uppercase tracking-[0.14em] text-fg3">{h}</div>
              </Html>
            )}
            {/* overhead crane rails */}
            {[-15, 15].map((z) => (
              <mesh key={z} position={[0, 6.2, z]} material={craneMat}>
                <boxGeometry args={[hallW, 0.14, 0.14]} />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* conveyor to dispatch */}
      <Conveyor calm={calm} />

      {/* machines */}
      {ms.map((m) => {
        const p = pos[m.id];
        const k = machineKpis(w, m);
        const isSel = selected === m.id;
        const isHover = hover === m.id;
        const facing = p[2] < 0 ? 0 : Math.PI;
        return (
          <group key={m.id} position={p}>
            {opts.heat && (
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <planeGeometry args={[4.6, 9]} />
                <meshBasicMaterial color={oeeColor(k.oee)} transparent opacity={0.28} />
              </mesh>
            )}
            <group
              rotation={[0, Math.PI / 2 + facing, 0]}
              scale={isHover || isSel ? 1.04 : 1}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(m.id);
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHover(null);
                document.body.style.cursor = '';
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(m.id);
              }}
            >
              <IMM state={m.state} cycle={k.ct} tonnage={m.tonnage} seed={Number(m.code.slice(4))} calm={calm} />
            </group>
            {m.state === 'MC' && (
              <mesh position={[0, 6.2, 0]} material={craneMat}>
                <boxGeometry args={[0.3, 0.3, 30]} />
              </mesh>
            )}
            {opts.people && m.state !== 'OFF' && (
              <group position={[2.2, 0, p[2] < 0 ? 2 : -2]}>
                <mesh position={[0, 0.6, 0]} material={personMat}>
                  <capsuleGeometry args={[0.25, 0.7, 4, 8]} />
                </mesh>
                <mesh position={[0, 1.35, 0]} material={personMat}>
                  <sphereGeometry args={[0.2, 10, 10]} />
                </mesh>
              </group>
            )}
            {(opts.labels || m.state === 'DOWN') && (
              <Html position={[0, m.state === 'DOWN' ? 5.6 : 4.6, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                {m.state === 'DOWN' ? (
                  <div className="flex animate-pulse flex-col items-center whitespace-nowrap rounded-md border border-[#E0826B] bg-[#3A1E18]/90 px-2 py-1 text-center shadow-[0_0_24px_rgba(255,90,71,0.6)]">
                    <span className="num text-[13px] font-bold text-white">{m.code}</span>
                    <span className="num text-[16px] font-bold text-[#E0826B]">{timer(w.t - m.since)}</span>
                  </div>
                ) : (
                  <span className="num whitespace-nowrap rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white" style={{ borderBottom: `2px solid ${STATUS_HEX[m.state]}` }}>
                    {m.code}
                  </span>
                )}
              </Html>
            )}
            {isHover && !isSel && (
              <Html position={[0, 3.2, 0]} center zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
                <div className="glass-strong w-[210px] -translate-y-[70px] rounded-[10px] p-3 text-[12px] shadow-[var(--shadow)]" style={{ borderTop: `3px solid ${STATUS_HEX[m.state]}` }}>
                  <div className="flex items-center justify-between">
                    <span className="num text-[16px] font-bold">{m.code}</span>
                    <span className="text-[10px] font-bold uppercase" style={{ color: STATUS_HEX[m.state] }}>{m.state === 'MC' ? 'Mould change' : m.state === 'RUN' ? 'Running' : m.state}</span>
                  </div>
                  <div className="truncate text-fg3">{w.part[w.mould[m.mouldId]?.positions[0].partId ?? '']?.name} · {m.mouldId}</div>
                  <div className="mt-1 flex justify-between"><span className="text-fg3">Parts</span><span className="num font-semibold">{fmt(k.good)} / {fmt(k.target)}</span></div>
                  <div className="flex justify-between"><span className="text-fg3">Cycle</span><span className="num font-semibold" style={{ color: m.cycleFactor > 1.05 ? '#E0826B' : undefined }}>{k.ct.toFixed(1)} s / {k.std.toFixed(1)} s</span></div>
                  <div className="flex justify-between"><span className="text-fg3">OEE</span><span className="num font-semibold">{k.oee.toFixed(0)}%</span></div>
                  <div className="mt-1 text-[10px] text-brand">Click to fly in</div>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* gate + trucks */}
      {opts.trucks && (
        <group position={[0, 0, 21]} scale={0.62}>
          <mesh position={[-20, 2, 0]} material={craneMat}>
            <boxGeometry args={[0.3, 4, 0.3]} />
          </mesh>
          <mesh position={[-14, 4, 0]} material={craneMat}>
            <boxGeometry args={[12, 0.3, 0.3]} />
          </mesh>
          {opts.labels && (
            <Html position={[-20, 4.8, 0]} center style={{ pointerEvents: 'none' }}>
              <span className="num whitespace-nowrap rounded bg-[#F4E3A1] px-1.5 text-[11px] font-bold text-[#1F2022]">GATE · {unitTrucks.length} inside</span>
            </Html>
          )}
          {unitTrucks.map((k, i) => (
            <Truck3D key={k.id} x={-16 + i * 6.5} waiting={Math.round((w.t - k.gateIn) / 60)} plate={k.plate} calm={calm} labels={opts.labels} />
          ))}
        </group>
      )}

      <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={10} maxDistance={110} maxPolarAngle={Math.PI / 2.15} target={[0, 0, 4]} />
    </>
  );
}

function Conveyor({ calm }: { calm: boolean }) {
  const boxes = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!boxes.current || calm) return;
    boxes.current.children.forEach((b, i) => {
      b.position.z = ((clock.elapsedTime * 2 + i * 4) % 36) - 14;
    });
  });
  return (
    <group position={[0, 0, 4]}>
      <mesh position={[0, 0.5, 4]} material={beltMat}>
        <boxGeometry args={[1.4, 0.2, 36]} />
      </mesh>
      <group ref={boxes}>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[0, 0.85, i * 4 - 14]} material={boxMat}>
            <boxGeometry args={[0.9, 0.5, 0.9]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Truck3D({ x, waiting, plate, calm, labels }: { x: number; waiting: number; plate: string; calm: boolean; labels: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (g.current && !calm) g.current.position.y = Math.sin(clock.elapsedTime * 3 + x) * 0.02;
  });
  const c = waiting > 60 ? '#E0826B' : waiting > 30 ? '#D6B56E' : '#7DB08F';
  return (
    <group ref={g} position={[x, 0, 6]}>
      <mesh position={[0, 1.6, 0]} material={truckMat}>
        <boxGeometry args={[2.4, 2.4, 6]} />
      </mesh>
      <mesh position={[0, 1.2, -3.8]} material={cabMat}>
        <boxGeometry args={[2.3, 1.9, 1.6]} />
      </mesh>
      <mesh position={[0, 0.55, -4.62]} material={plateMat}>
        <planeGeometry args={[1, 0.25]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3.4, 3.7, 32]} />
        <meshBasicMaterial color={c} transparent opacity={0.6} />
      </mesh>
      {labels && (
        <Html position={[0, 3.4, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center gap-0.5">
            <span className="plate !px-1 text-[10px]">{plate}</span>
            <span className="num rounded bg-black/60 px-1 text-[11px] font-bold" style={{ color: c }}>{waiting}′</span>
          </div>
        </Html>
      )}
    </group>
  );
}
