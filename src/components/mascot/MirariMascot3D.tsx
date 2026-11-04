import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MascotState } from '../../types';

interface MirariMascot3DProps {
  state?: MascotState;
  dragging?: boolean;
  size?: 'hero' | 'companion' | 'compact' | 'showcase' | 'full';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
  tooltipText?: string;
}

export const MirariMascot3D: React.FC<MirariMascot3DProps> = ({
  state = 'idle',
  dragging = false,
  size = 'hero',
  interactive = true,
  onClick,
  className = '',
  tooltipText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglSupported, setWebglSupported] = useState(true);
  const stateRef = useRef({ state, dragging });

  useEffect(() => {
    stateRef.current = { state, dragging };
  }, [state, dragging]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
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
    camera.position.set(0, 0, 5.3);

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
    characterRoot.position.set(0, -0.12, 0);
    scene.add(characterRoot);

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    let body: THREE.Object3D | undefined;
    let sprout: THREE.Object3D | undefined;
    let cape: THREE.Object3D | undefined;
    let eyes: (THREE.Object3D | undefined)[] = [];
    let mouth: THREE.Object3D | undefined;
    let smile: THREE.Object3D | undefined;

    function disposeModel(model: THREE.Object3D) {
      model.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => material.dispose());
      });
    }

    new GLTFLoader().load('/models/seed.glb', ({ scene: model }) => {
      if (disposed) {
        disposeModel(model);
        return;
      }
      characterRoot.add(model);
      body = model.getObjectByName('BodyGroup');
      sprout = model.getObjectByName('SproutGroup');
      cape = model.getObjectByName('CapeGroup');
      eyes = ['LeftEye', 'RightEye'].map((name) => model.getObjectByName(name));
      mouth = model.getObjectByName('Mouth');
      smile = model.getObjectByName('Smile');
    }, undefined, () => {
      if (!disposed) setWebglSupported(false);
    });

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

    // Inspection & Photography gaze setter
    (window as any).__mirariSetGaze = (x: number, y: number) => {
      targetLookX = x;
      targetLookY = y;
      currentLookX = x;
      currentLookY = y;
    };

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

    let previousPose = '';
    let poseTime = 0;

    const animate = (currentTime: number) => {
      animId = requestAnimationFrame(animate);
      if (!isVisible || !isPageVisible) return; // Pause GPU rendering when scrolled out or tab hidden

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      clockTime += dt;

      const { state: mood, dragging: held } = stateRef.current;
      const pose = held ? 'held' : mood;
      if (pose !== previousPose) {
        previousPose = pose;
        poseTime = 0;
      }
      poseTime += dt;

      const reduced = motionPreference.matches;
      const thinking = pose === 'thinking';
      const greeting = pose === 'excited';
      const found = pose === 'pointing';
      const lift = greeting || found
        ? Math.sin(Math.min(poseTime / 0.65, 1) * Math.PI)
        : 0;
      const damp = 1 - Math.exp(-dt * 9);
      currentLookX = THREE.MathUtils.lerp(currentLookX, thinking ? -0.36 : targetLookX, damp);
      currentLookY = THREE.MathUtils.lerp(currentLookY, thinking ? -0.42 : targetLookY, damp);

      const targetPitch = found ? 0.21 * lift : -currentLookY * 0.16;
      const targetRoll = held ? -0.21 : thinking ? 0.13 : -currentLookX * 0.08;
      characterRoot.rotation.x = reduced ? 0 : THREE.MathUtils.lerp(characterRoot.rotation.x, targetPitch, damp);
      characterRoot.rotation.y = reduced ? 0 : currentLookX * 0.29;
      characterRoot.rotation.z = reduced ? 0 : THREE.MathUtils.lerp(characterRoot.rotation.z, targetRoll, damp);

      blinkTimer += dt;
      if (blinkTimer >= nextBlinkTime && !isBlinking) {
        isBlinking = true;
        blinkProgress = 0;
      }
      if (isBlinking) {
        blinkProgress += dt / 0.17;
        if (blinkProgress >= 1) {
          isBlinking = false;
          blinkTimer = 0;
          nextBlinkTime = 3.2 + Math.random() * 3.5;
        }
      }
      const blink = !reduced && isBlinking ? Math.sin(blinkProgress * Math.PI) : 0;
      const eyeOpening = held ? 1.42 : thinking ? 0.75 : greeting || found ? 1.17 : 1;
      for (const eye of eyes) {
        if (eye) eye.scale.y = Math.max(0.07, eyeOpening * (1 - blink));
      }
      if (mouth && smile) {
        const smiling = greeting || found;
        smile.visible = smiling;
        for (const part of mouth.children) {
          if (part !== smile) {
            part.visible = !smiling;
            part.scale.set(held ? 0.64 : 1, held ? 2.3 : 1, 1);
          }
        }
      }

      if (body) {
        const breath = reduced ? 0 : Math.sin(clockTime * 2) * 0.014;
        const stretch = reduced ? 0 : breath + lift * 0.04 + (held ? 0.06 : 0);
        body.scale.set(1 - stretch / 2, 1 + stretch, 1 - stretch / 2);
        const hover = reduced ? 0 : Math.sin(clockTime * 1.7) * 0.029 + lift * 0.11;
        body.position.y = reduced ? 0 : THREE.MathUtils.lerp(body.position.y, hover, damp);
      }
      if (sprout) {
        const sway = Math.sin(clockTime * 2.2) * 0.035;
        const settle = Math.sin(poseTime * 14) * Math.exp(-poseTime * 5) * 0.14;
        const target = held ? 0.22 : thinking ? -0.10 : sway + settle - currentLookX * 0.08;
        sprout.rotation.z = reduced ? 0 : THREE.MathUtils.lerp(sprout.rotation.z, target, damp);
      }
      if (cape) cape.rotation.x = reduced ? 0 : -lift * 0.022;

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
      disposed = true;
      cancelAnimationFrame(animId);
      disposeModel(characterRoot);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      delete (window as any).__mirariSetGaze;
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
      onClick={onClick}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      title={tooltipText || 'MIRARI'}
    >
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full pointer-events-auto" />

      {/* Fallback 2D Representation if WebGL is unavailable */}
      {!webglSupported && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-mirari-paper border border-mirari-line flex items-center justify-center shadow-lg">
            <span className="font-serif text-xs text-mirari-ink font-bold tracking-widest">
              MIRARI
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
