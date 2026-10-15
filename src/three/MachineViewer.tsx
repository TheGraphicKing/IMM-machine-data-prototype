import { ContactShadows, Grid, OrbitControls } from '@react-three/drei';
import Stage from './Stage';
import IMM from './IMM';
import { useSim } from '../sim/store';
import type { Machine } from '../sim/types';

/** Interactive 3D model of one machine. Barrel heater zones glow by temperature; click a zone. */
export default function MachineViewer({ m, cycle, zone, onZone }: { m: Machine; cycle: number; zone: number | null; onZone: (i: number) => void }) {
  useSim((s) => s.version);
  const calm = useSim((s) => s.calm);
  const dark = useSim((s) => s.theme) === 'dark';
  const a = m.act;
  const st = m.set;
  return (
    <Stage className="h-full w-full" camera={{ position: [7.2, 4.6, 9.6], fov: 32 }}>
      <ambientLight intensity={dark ? 0.35 : 0.7} />
      <directionalLight position={[6, 9, 5]} intensity={dark ? 1.6 : 2.2} />
      <pointLight position={[-4, 3, 3]} intensity={18} color="#8AA6CF" distance={12} />
      <pointLight position={[4, 2, -3]} intensity={14} color="#FE4B1E" distance={10} />
      <group position={[0.3, -1.5, 0]}>
        <IMM state={m.state} cycle={cycle} tonnage={420} zones={[a.z1, a.z2, a.z3, a.z4, a.z5]} zoneSet={[st.z1, st.z2, st.z3, st.z4, st.z5]} highlightZone={zone} onZone={onZone} calm={calm} />
        <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={14} blur={2.6} far={4} />
        <Grid position={[0, 0, 0]} args={[30, 30]} cellSize={0.5} cellThickness={0.5} sectionSize={2.5} sectionThickness={1} cellColor={dark ? '#252629' : '#CFCCC7'} sectionColor={dark ? '#38393C' : '#CFCCC7'} fadeDistance={22} infiniteGrid />
      </group>
      <OrbitControls target={[0, 0.1, 0]} enablePan={false} minDistance={5} maxDistance={16} maxPolarAngle={Math.PI / 2.1} autoRotate={!calm} autoRotateSpeed={0.5} />
    </Stage>
  );
}
