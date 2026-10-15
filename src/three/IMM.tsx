import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { MState } from '../sim/types';

export const STATUS_HEX: Record<MState, string> = { RUN: '#34C77B', IDLE: '#FFC233', MC: '#5B8DFF', DOWN: '#FF5A47', OFF: '#4A4F57' };

// shared materials (one GPU program each)
const M = {
  body: new THREE.MeshStandardMaterial({ color: '#2B3036', metalness: 0.55, roughness: 0.45 }),
  bodyLight: new THREE.MeshStandardMaterial({ color: '#3A4048', metalness: 0.6, roughness: 0.35 }),
  steel: new THREE.MeshStandardMaterial({ color: '#8C939C', metalness: 0.9, roughness: 0.25 }),
  dark: new THREE.MeshStandardMaterial({ color: '#16191D', metalness: 0.3, roughness: 0.7 }),
  mould: new THREE.MeshStandardMaterial({ color: '#4E6278', metalness: 0.85, roughness: 0.3 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#9fb6cc', transparent: true, opacity: 0.08, roughness: 0.1, metalness: 0, depthWrite: false }),
  hopper: new THREE.MeshStandardMaterial({ color: '#C9CDD3', metalness: 0.7, roughness: 0.3 }),
  accent: new THREE.MeshStandardMaterial({ color: '#6B7079', metalness: 0.6, roughness: 0.4 }),
  part: new THREE.MeshStandardMaterial({ color: '#E6E1D3', roughness: 0.6 }),
  bin: new THREE.MeshStandardMaterial({ color: '#2F6FEB', roughness: 0.6, metalness: 0.1 }),
};

export function tempColor(t: number, set: number) {
  // blue (cold) -> orange (at setpoint) -> red (over)
  const c = new THREE.Color();
  const k = (t - (set - 110)) / 110; // 0 cold .. 1 at set
  if (k < 1) c.setHSL(0.6 - Math.max(0, k) * 0.52, 0.85, 0.5);
  else c.setHSL(0.08 - Math.min(1, (t - set) / 10) * 0.08, 0.95, 0.52);
  return c;
}

export interface IMMProps {
  state: MState;
  cycle?: number; // seconds
  tonnage?: number;
  zones?: number[]; // actual temps z1..z5
  zoneSet?: number[];
  highlightZone?: number | null;
  onZone?: (i: number) => void;
  seed?: number;
  wire?: number; // 0..1 wireframe mix (intro)
  showHalo?: boolean;
  calm?: boolean;
}

export default function IMM({ state, cycle = 30, tonnage = 350, zones, zoneSet, highlightZone, onZone, seed = 0, showHalo = true, calm }: IMMProps) {
  const s = 0.75 + Math.min(650, tonnage) / 900; // scale by tonnage
  const moving = useRef<THREE.Group>(null);
  const mouldRef = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const lamp = useRef<THREE.Mesh>(null);
  const partRef = useRef<THREE.Mesh>(null);
  const hook = useRef<THREE.Group>(null);
  const status = STATUS_HEX[state];
  const haloMat = useMemo(() => new THREE.MeshBasicMaterial({ color: status, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [status]);
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: status, emissive: status, emissiveIntensity: state === 'OFF' ? 0.1 : 2.4, toneMapped: false }), [status, state]);
  const screenMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#0b1220', emissive: state === 'DOWN' ? '#ff5a47' : '#5B8DFF', emissiveIntensity: state === 'OFF' ? 0.05 : 0.9, toneMapped: false }), [state]);
  const zoneMats = useMemo(() => Array.from({ length: 5 }, () => new THREE.MeshStandardMaterial({ color: '#333', emissive: '#f97316', emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.5, toneMapped: false })), []);
  const phase0 = (seed * 0.137) % 1;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // clamp cycle: open → close → hold → open
    if (moving.current) {
      let x = -1.25;
      if (state === 'RUN' && !calm) {
        const p = ((t / Math.max(6, cycle / 3)) + phase0) % 1;
        const close = p < 0.15 ? p / 0.15 : p < 0.7 ? 1 : p < 0.85 ? 1 - (p - 0.7) / 0.15 : 0;
        x = -2.05 + close * 0.8;
        if (partRef.current) {
          const dp = p > 0.85 ? (p - 0.85) / 0.15 : -1;
          partRef.current.visible = dp >= 0;
          if (dp >= 0) partRef.current.position.set(-1.2, 1.4 - dp * 1.1, 0.25 + dp * 0.9);
        }
      } else if (state === 'MC') x = -2.25;
      moving.current.position.x = x;
    }
    if (halo.current) {
      const pulse = state === 'DOWN' ? 0.35 + Math.sin(t * 5) * 0.25 : state === 'RUN' ? 0.2 + Math.sin(t * 1.4 + seed) * 0.05 : 0.22;
      (halo.current.material as THREE.MeshBasicMaterial).opacity = calm ? 0.3 : pulse;
    }
    if (lamp.current && state === 'DOWN' && !calm) lampMat.emissiveIntensity = 1.4 + Math.abs(Math.sin(t * 5)) * 2.4;
    if (mouldRef.current) {
      if (state === 'MC' && !calm) {
        const k = (Math.sin(t * 0.6 + seed) + 1) / 2;
        mouldRef.current.position.y = 1.7 + k * 1.6;
        mouldRef.current.rotation.y = t * 0.6;
        if (hook.current) hook.current.position.y = 3.95 + k * 1.6 - 1.6;
      } else {
        mouldRef.current.position.y = 1.7;
        mouldRef.current.rotation.y = 0;
      }
    }
    // heater zones
    if (zones && zoneSet) {
      zones.forEach((z, i) => {
        const m = zoneMats[i];
        const c = tempColor(z, zoneSet[i]);
        m.emissive.copy(c);
        m.emissiveIntensity = (highlightZone === i ? 2.6 : 1.1) + (highlightZone === i && !calm ? Math.sin(t * 6) * 0.6 : 0);
      });
    } else {
      zoneMats.forEach((m, i) => {
        m.emissive.set(state === 'RUN' ? '#f97316' : state === 'OFF' ? '#222' : '#b4561c');
        m.emissiveIntensity = state === 'RUN' ? 0.9 + Math.sin(t * 2 + i) * 0.1 : 0.4;
      });
    }
  });

  return (
    <group scale={s}>
      {/* bed */}
      <mesh material={M.body} position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 0.9, 1.4]} />
      </mesh>
      <mesh material={M.accent} position={[0, 0.92, 0.71]}>
        <boxGeometry args={[6, 0.04, 0.02]} />
      </mesh>
      {/* clamp: rear + fixed platen */}
      <mesh material={M.bodyLight} position={[-2.85, 1.7, 0]} castShadow>
        <boxGeometry args={[0.3, 1.5, 1.4]} />
      </mesh>
      <mesh material={M.bodyLight} position={[-0.25, 1.7, 0]} castShadow>
        <boxGeometry args={[0.28, 1.65, 1.5]} />
      </mesh>
      {/* tie bars */}
      {[
        [0.55, 0.55],
        [0.55, -0.55],
        [-0.55, 0.55],
        [-0.55, -0.55],
      ].map(([y, z], i) => (
        <mesh key={i} material={M.steel} position={[-1.55, 1.7 + y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.055, 0.055, 2.75, 10]} />
        </mesh>
      ))}
      {/* moving platen */}
      <group ref={moving} position={[-1.25, 0, 0]}>
        <mesh material={M.bodyLight} position={[0, 1.7, 0]} castShadow>
          <boxGeometry args={[0.24, 1.5, 1.42]} />
        </mesh>
        <mesh material={M.mould} position={[0.3, 1.7, 0]}>
          <boxGeometry args={[0.36, 0.95, 0.95]} />
        </mesh>
      </group>
      {/* fixed mould half (lifted during mould change) */}
      <mesh ref={mouldRef} material={M.mould} position={[-0.6, 1.7, 0]} castShadow>
        <boxGeometry args={[0.4, 0.95, 0.95]} />
      </mesh>
      {state === 'MC' && (
        <group ref={hook} position={[-0.6, 3.95, 0]}>
          <mesh material={M.steel} position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
          </mesh>
          <mesh material={M.accent} position={[0, 0, 0]}>
            <boxGeometry args={[0.2, 0.08, 0.2]} />
          </mesh>
        </group>
      )}
      {/* safety guard */}
      <mesh material={M.glass} position={[-1.55, 1.75, 0]}>
        <boxGeometry args={[2.9, 1.75, 1.6]} />
      </mesh>
      {/* injection unit: barrel + heater bands + nozzle */}
      <mesh material={M.steel} position={[1.05, 1.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.13, 0.13, 2.3, 16]} />
      </mesh>
      <mesh material={M.steel} position={[-0.05, 1.7, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.1, 0.25, 12]} />
      </mesh>
      {[0.25, 0.65, 1.05, 1.45, 1.85].map((x, i) => (
        <mesh
          key={i}
          material={zoneMats[i]}
          position={[x, 1.7, 0]}
          rotation={[0, 0, Math.PI / 2]}
          onClick={
            onZone
              ? (e) => {
                  e.stopPropagation();
                  onZone(i);
                }
              : undefined
          }
          onPointerOver={onZone ? () => (document.body.style.cursor = 'pointer') : undefined}
          onPointerOut={onZone ? () => (document.body.style.cursor = '') : undefined}
        >
          <cylinderGeometry args={[0.2, 0.2, 0.26, 20]} />
        </mesh>
      ))}
      <mesh material={M.body} position={[2.65, 1.7, 0]} castShadow>
        <boxGeometry args={[0.9, 0.75, 0.85]} />
      </mesh>
      {/* hopper */}
      <mesh material={M.hopper} position={[1.85, 2.35, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
      </mesh>
      <mesh material={M.hopper} position={[1.85, 2.85, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.36, 0.55, 16]} />
      </mesh>
      <mesh material={M.hopper} position={[1.85, 3.3, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.35, 16]} />
      </mesh>
      {/* control cabinet + screen */}
      <mesh material={M.body} position={[0.55, 1.6, 0.95]} castShadow>
        <boxGeometry args={[0.55, 1.4, 0.35]} />
      </mesh>
      <mesh material={screenMat} position={[0.55, 1.85, 1.13]}>
        <planeGeometry args={[0.42, 0.3]} />
      </mesh>
      {/* light tower */}
      <mesh material={M.dark} position={[-0.25, 2.85, 0.55]}>
        <cylinderGeometry args={[0.025, 0.025, 0.6, 6]} />
      </mesh>
      <mesh ref={lamp} material={lampMat} position={[-0.25, 3.25, 0.55]}>
        <cylinderGeometry args={[0.09, 0.09, 0.28, 14]} />
      </mesh>
      {/* parts bin + dropping part */}
      <mesh material={M.bin} position={[-1.2, 0.25, 1.35]}>
        <boxGeometry args={[0.7, 0.5, 0.55]} />
      </mesh>
      <mesh ref={partRef} material={M.part} visible={false}>
        <boxGeometry args={[0.16, 0.06, 0.22]} />
      </mesh>
      {/* floor halo */}
      {showHalo && (
        <mesh ref={halo} material={haloMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} scale={[1.25, 0.62, 1]}>
          <ringGeometry args={[3.0, 3.35, 48]} />
        </mesh>
      )}
    </group>
  );
}
