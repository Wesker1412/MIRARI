import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MascotState } from '../../types';

interface MirariMascot3DProps {
  state?: MascotState;
  size?: 'hero' | 'companion' | 'compact' | 'showcase' | 'full';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  tooltipText?: string;
}

export const MirariMascot3D: React.FC<MirariMascot3DProps> = ({
  state = 'idle',
  size = 'hero',
  interactive = true,
  onClick,
  className = '',
  tooltipText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const stateRef = useRef<MascotState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    const width = container.clientWidth || (size === 'hero' ? 240 : size === 'showcase' ? 360 : 120);
    const height = container.clientHeight || (size === 'hero' ? 240 : size === 'showcase' ? 360 : 120);

    // Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 0.2, 5.2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // ─── Studio Lighting (Soft Velvet SSS Aesthetic) ─────────────
    // Key light (soft warm white)
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.8);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);

    // Fill light (cool sky ambient fill)
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.85);
    fillLight.position.set(-3.5, 1, 2.5);
    scene.add(fillLight);

    // Rim / Back light for outline separation
    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.2);
    rimLight.position.set(0, 4, -4);
    scene.add(rimLight);

    // Soft ambient
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Character Root
    const characterRoot = new THREE.Group();
    characterRoot.position.set(0, -0.2, 0);
    scene.add(characterRoot);

    // Node references for animation
    let bodyGroup: THREE.Object3D | null = null;
    let leftEar: THREE.Object3D | null = null;
    let rightEar: THREE.Object3D | null = null;
    let leftEyelid: THREE.Object3D | null = null;
    let rightEyelid: THREE.Object3D | null = null;
    let leftPaw: THREE.Object3D | null = null;
    let rightPaw: THREE.Object3D | null = null;
    let tailGroup: THREE.Object3D | null = null;

    function bindHierarchy(rootObj: THREE.Object3D) {
      bodyGroup = rootObj.getObjectByName('BodyGroup') || rootObj;
      leftEar = rootObj.getObjectByName('LeftEarGroup') || null;
      rightEar = rootObj.getObjectByName('RightEarGroup') || null;
      leftEyelid = rootObj.getObjectByName('LeftEyelid') || null;
      rightEyelid = rootObj.getObjectByName('RightEyelid') || null;
      leftPaw = rootObj.getObjectByName('LeftPawGroup') || null;
      rightPaw = rootObj.getObjectByName('RightPawGroup') || null;
      tailGroup = rootObj.getObjectByName('TailGroup') || null;
    }

    // Load independent original GLB asset
    const loader = new GLTFLoader();
    loader.load(
      '/models/mirari.glb',
      (gltf) => {
        characterRoot.clear();
        const model = gltf.scene;
        model.scale.set(0.9, 0.9, 0.9);
        characterRoot.add(model);
        bindHierarchy(model);
      },
      undefined,
      (err) => {
        console.warn('GLB asset load deferred or failed, using procedural fallback:', err);
      }
    );

    // ─── Interaction & Gaze Tracking ─────────────────────────────
    let targetLookX = 0;
    let targetLookY = 0;
    let currentLookX = 0;
    let currentLookY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = (e.clientX - centerX) / (window.innerWidth * 0.5);
      const dy = (e.clientY - centerY) / (window.innerHeight * 0.5);
      targetLookX = Math.max(-1, Math.min(1, dx));
      targetLookY = Math.max(-1, Math.min(1, dy));
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    // ─── Blinking System ─────────────────────────────────────────
    let blinkTimer = 0;
    let nextBlinkTime = 2.5 + Math.random() * 2.5;
    let isBlinking = false;
    let blinkProgress = 0;

    // ─── Visibility Optimization (Intersection Observer & Page Visibility) ─
    let isVisible = true;
    let isPageVisible = !document.hidden;

    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ─── Animation Loop ──────────────────────────────────────────
    let animId: number;
    let lastTime = performance.now();
    let clockTime = 0;

    const animate = (currentTime: number) => {
      animId = requestAnimationFrame(animate);
      if (!isVisible || !isPageVisible) return; // Pause GPU rendering when scrolled out or tab hidden

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      clockTime += dt;

      // 1. Gaze & Tilt Tracking with Soft Damping
      const currentState = stateRef.current;
      let stateTargetX = targetLookX;
      let stateTargetY = targetLookY;
      let stateTiltZ = 0;

      if (currentState === 'thinking') {
        stateTargetX = -0.3;
        stateTargetY = -0.4; // Look up-sideways thoughtfully
        stateTiltZ = 0.22; // Curious head tilt
      } else if (currentState === 'excited') {
        stateTargetY = 0.15; // Bow / nod forward happily
        stateTiltZ = Math.sin(clockTime * 4.0) * 0.06;
      }

      currentLookX += (stateTargetX - currentLookX) * 0.06;
      currentLookY += (stateTargetY - currentLookY) * 0.06;

      characterRoot.rotation.y = currentLookX * 0.42;
      characterRoot.rotation.x = -currentLookY * 0.22;
      characterRoot.rotation.z = stateTiltZ - currentLookX * 0.1;

      // 2. Natural Blinking Animation
      blinkTimer += dt;
      if (blinkTimer >= nextBlinkTime && !isBlinking) {
        isBlinking = true;
        blinkProgress = 0;
      }

      if (isBlinking) {
        blinkProgress += dt / 0.16; // 0.16s complete blink cycle
        if (blinkProgress >= 1.0) {
          isBlinking = false;
          blinkTimer = 0;
          nextBlinkTime = 3.2 + Math.random() * 3.5;
          blinkProgress = 0;
        }
      }

      const blinkAngle = isBlinking
        ? Math.sin(blinkProgress * Math.PI) * (Math.PI * 0.52)
        : 0;

      if (leftEyelid) leftEyelid.rotation.x = -Math.PI * 0.52 + blinkAngle;
      if (rightEyelid) rightEyelid.rotation.x = -Math.PI * 0.52 + blinkAngle;

      // 3. Organic Breathing & Soft Floating
      if (bodyGroup) {
        const breathSpeed = currentState === 'thinking' ? 1.8 : currentState === 'excited' ? 4.2 : 2.4;
        const breath = Math.sin(clockTime * breathSpeed);
        
        // Volume-conserving squish & stretch
        const sy = 1.0 + breath * 0.035;
        const sxz = 1.0 - breath * 0.018;
        bodyGroup.scale.set(sxz, sy, sxz);

        // Gentle floating hover
        const hoverSpeed = currentState === 'excited' ? 4.8 : 2.0;
        const hoverAmp = currentState === 'excited' ? 0.12 : 0.06;
        bodyGroup.position.y = Math.sin(clockTime * hoverSpeed) * hoverAmp;
      }

      // 4. Secondary Spring Inertia on Ears
      if (leftEar && rightEar) {
        const earSway = Math.sin(clockTime * 2.4) * 0.04;
        const earLag = currentLookX * 0.15;
        leftEar.rotation.z = 0.2 - earLag + earSway;
        rightEar.rotation.z = -0.2 - earLag - earSway;

        if (currentState === 'thinking') {
          leftEar.rotation.z = 0.35 + earSway;
        } else if (currentState === 'excited') {
          // Perked up ears
          leftEar.rotation.z = 0.1 + Math.sin(clockTime * 6.0) * 0.05;
          rightEar.rotation.z = -0.1 - Math.sin(clockTime * 6.0) * 0.05;
        }
      }

      // 5. Paw Articulation
      if (leftPaw && rightPaw) {
        if (currentState === 'thinking') {
          // Left paw thoughtfully near chin
          leftPaw.position.set(-0.35, -0.18, 0.82);
          leftPaw.rotation.set(0.8, 0.5, -0.4);
          rightPaw.position.set(0.42, -0.42, 0.72);
        } else if (currentState === 'excited') {
          // Both paws lifted joyfully
          const bounce = Math.sin(clockTime * 6.0) * 0.06;
          leftPaw.position.set(-0.38, -0.26 + bounce, 0.78);
          rightPaw.position.set(0.38, -0.26 + bounce, 0.78);
        } else {
          // Rest on belly
          leftPaw.position.set(-0.42, -0.42, 0.72);
          leftPaw.rotation.set(0.5, 0.35, -0.3);
          rightPaw.position.set(0.42, -0.42, 0.72);
          rightPaw.rotation.set(0.5, -0.35, 0.3);
        }
      }

      // 6. Gentle Tail Swish
      if (tailGroup) {
        const tailSway = Math.sin(clockTime * 2.4 - 0.8) * 0.28;
        tailGroup.rotation.y = tailSway;
      }

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // ─── Continuous Smooth Resize Observer ─────────────────────────
    const handleUpdateDimensions = (w: number, h: number) => {
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        handleUpdateDimensions(w, h);
      }
    });
    resizeObserver.observe(container);

    const handleWindowResize = () => {
      if (!container) return;
      handleUpdateDimensions(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleWindowResize);

    // ─── Cleanup ─────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      window.removeEventListener('resize', handleWindowResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [interactive, size]);

  // Size styling classes
  const sizeClasses =
    size === 'full'
      ? 'w-full h-full'
      : size === 'hero'
      ? 'w-28 h-28 sm:w-36 sm:h-36'
      : size === 'showcase'
      ? 'w-64 h-64 sm:w-72 sm:h-72'
      : size === 'compact'
      ? 'w-12 h-12'
      : 'w-16 h-16 sm:w-20 sm:h-20';

  return (
    <div
      className={`relative select-none ${sizeClasses} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      title={tooltipText || 'MIRARI'}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full pointer-events-auto" />

      {/* Fallback 2D Representation if WebGL is unavailable */}
      {!webglSupported && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-mirari-paper border border-mirari-line flex items-center justify-center shadow-lg">
            <span className="font-serif text-lg text-mirari-ink font-bold tracking-widest">
              MIRARI
            </span>
          </div>
        </div>
      )}

      {/* Subtle mood aura glow behind mascot (Zero stars, zero particle noise) */}
      <div
        className={`absolute inset-4 rounded-full -z-10 blur-2xl transition-opacity duration-700 pointer-events-none ${
          state === 'thinking'
            ? 'bg-amber-200/30 opacity-90 scale-105'
            : state === 'excited'
            ? 'bg-amber-300/40 opacity-100 scale-115'
            : isHovered
            ? 'bg-amber-100/30 opacity-80'
            : 'bg-amber-50/20 opacity-50'
        }`}
      />
    </div>
  );
};
