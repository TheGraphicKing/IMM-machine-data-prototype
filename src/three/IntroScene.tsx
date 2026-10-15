import { Sparkles } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import IMM from './IMM';
import type { MState } from '../sim/types';

const STATES: MState[] = ['RUN', 'RUN', 'RUN', 'IDLE', 'RUN', 'DOWN', 'RUN', 'RUN', 'MC', 'RUN', 'RUN', 'RUN'];

/** A stylised factory assembling: wireframe envelopes draw in, machines rise and turn solid, camera dollies in. */
export default function IntroScene({ calm }: { calm: boolean }) {
  const { camera } = useThree();
  const t0 = useRef<number | null>(null);
  const groups = useRef<(THREE.Group | null)[]>([]);
  const wires = useRef<(THREE.LineSegments | null)[]>([]);
  const floor = useRef<THREE.Mesh>(null);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(7.4, 3.4, 2.2)), []);
  const positions = useMemo(() => STATES.map((_, i) => [((i % 6) - 2.5) * 5.2, 0, i < 6 ? -5 : 5] as [number, number, number]), []);

  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = calm ? 99 : clock.elapsedTime - t0.current;
    // camera dolly-in + slow orbit
    const k = Math.min(1, t / 5);
    const e = 1 - Math.pow(1 - k, 3);
    const ang = 0.6 + t * 0.04;
    const r = 70 - e * 34;
    camera.position.set(Math.sin(ang) * r, 34 - e * 16, Math.cos(ang) * r);
    camera.lookAt(0, 0, 0);
    positions.forEach((_, i) => {
      const delay = 0.6 + i * 0.12;
      const p = Math.max(0, Math.min(1, (t - delay) / 1.1));
      const solid = Math.max(0, Math.min(1, (t - delay - 0.9) / 0.9));
      const g = groups.current[i];
      const wl = wires.current[i];
      if (wl) {
        wl.scale.set(1, Math.max(0.001, p), 1);
        wl.position.y = (3.4 * p) / 2;
        (wl.material as THREE.LineBasicMaterial).opacity = (1 - solid) * 0.9;
      }
      if (g) {
        g.position.y = -4 + solid * 4;
        g.visible = solid > 0.01;
      }
    });
    if (floor.current) (floor.current.material as THREE.MeshStandardMaterial).opacity = Math.min(1, t / 1.2);
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[20, 30, 15]} intensity={1.6} />
      <pointLight position={[-18, 10, 0]} intensity={220} color="#8AA6CF" distance={50} />
      <pointLight position={[18, 10, 0]} intensity={200} color="#FE4B1E" distance={50} />
      <mesh ref={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#1A1B1D" roughness={0.9} transparent />
      </mesh>
      <gridHelper args={[120, 60, '#38393C', '#1C1D1F']} />
      {positions.map((p, i) => (
        <group key={i} position={p}>
          <lineSegments ref={(el) => (wires.current[i] = el)} geometry={edgeGeo}>
            <lineBasicMaterial color="#8AA6CF" transparent opacity={0.9} toneMapped={false} />
          </lineSegments>
          <group ref={(el) => (groups.current[i] = el)} rotation={[0, i < 6 ? 0 : Math.PI, 0]} visible={false}>
            <IMM state={STATES[i]} cycle={24 + i} tonnage={250 + (i % 3) * 150} seed={i} calm={calm} />
          </group>
        </group>
      ))}
      <Conveyor />
      {!calm && <Sparkles count={140} scale={[70, 18, 40]} size={2.4} speed={0.35} opacity={0.5} color="#CFCCC7" />}
    </>
  );
}

function Conveyor() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => (c.position.x = ((clock.elapsedTime * 3 + i * 5) % 40) - 20));
  });
  return (
    <group>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[40, 0.15, 1.1]} />
        <meshStandardMaterial color="#2E2F32" metalness={0.5} />
      </mesh>
      <group ref={ref}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[0, 0.75, 0]}>
            <boxGeometry args={[0.8, 0.5, 0.8]} />
            <meshStandardMaterial color="#A8865A" emissive="#FE4B1E" emissiveIntensity={0.15} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
