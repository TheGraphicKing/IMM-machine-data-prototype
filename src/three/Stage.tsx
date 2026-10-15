import { Canvas, type CanvasProps } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { useSim } from '../sim/store';

const CA_OFFSET = new THREE.Vector2(0.0006, 0.0006);

/** Canvas wrapper: DPR capped at 1.75, pauses when off-screen / tab hidden, bloom unless calm. */
export default function Stage({
  children,
  camera,
  bloom = true,
  hero = false,
  className,
  bg,
  ...rest
}: { children: ReactNode; camera?: CanvasProps['camera']; bloom?: boolean; hero?: boolean; className?: string; bg?: string } & Omit<CanvasProps, 'children' | 'camera'>) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const calm = useSim((s) => s.calm);
  const theme = useSim((s) => s.theme);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    const v = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', v);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', v);
    };
  }, []);
  const background = bg ?? (theme === 'dark' ? '#0B0D10' : '#E9E7E1');
  return (
    <div ref={ref} className={className} style={className?.includes('absolute') ? undefined : { position: 'relative' }}>
      <Canvas
        dpr={[1, 1.75]}
        frameloop={visible && tabVisible ? 'always' : 'never'}
        camera={camera}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        shadows={false}
        {...rest}
      >
        <color attach="background" args={[background]} />
        <Suspense fallback={null}>{children}</Suspense>
        {bloom && !calm && hero && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={theme === 'dark' ? 1.0 : 0.45} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
            <Vignette eskil={false} offset={0.25} darkness={theme === 'dark' ? 0.7 : 0.3} />
            <ChromaticAberration blendFunction={BlendFunction.NORMAL} offset={CA_OFFSET} radialModulation={false} modulationOffset={0} />
          </EffectComposer>
        )}
        {bloom && !calm && !hero && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={theme === 'dark' ? 0.9 : 0.45} luminanceThreshold={0.6} luminanceSmoothing={0.2} mipmapBlur />
            <Vignette eskil={false} offset={0.25} darkness={theme === 'dark' ? 0.7 : 0.3} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
