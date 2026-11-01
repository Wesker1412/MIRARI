import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { MascotState } from '../../types';

interface MirariMascot3DProps {
  state?: MascotState;
  size?: 'hero' | 'companion' | 'compact';
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

    // Determine dimensions
    const width = container.clientWidth || (size === 'hero' ? 280 : 120);
    const height = container.clientHeight || (size === 'hero' ? 280 : 120);

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2);

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

    // ─── Lighting ────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight1.position.set(3, 4, 4);
    scene.add(dirLight1);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    rimLight.position.set(-3, -2, -2);
    scene.add(rimLight);

    const bottomGlow = new THREE.PointLight(0xf59e0b, 1.4, 6);
    bottomGlow.position.set(0, -1.8, 1);
    scene.add(bottomGlow);

    // ─── Mascot Hierarchy ────────────────────────────────────────
    const mascotGroup = new THREE.Group();
    scene.add(mascotGroup);

    // 1. Main Soft Pearlescent Body (Round, squishy, teardrop-sphere)
    const bodyGeometry = new THREE.SphereGeometry(1.0, 48, 48);
    // Deform geometry slightly for organic soft pear shape
    const pos = bodyGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      let x = pos.getX(i);
      let z = pos.getZ(i);
      // Soft bottom taper and slightly wider belly
      if (y < 0) {
        x *= 1.12;
        z *= 1.08;
      } else {
        x *= 0.96;
        z *= 0.96;
      }
      pos.setXYZ(i, x, y, z);
    }
    bodyGeometry.computeVertexNormals();

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbfdff,
      roughness: 0.22,
      metalness: 0.04,
      emissive: 0x161e2e,
      emissiveIntensity: 0.25,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    mascotGroup.add(bodyMesh);

    // 2. Ears / Antennae (Soft fairy creature ears)
    const earGeometry = new THREE.ConeGeometry(0.24, 0.75, 24);
    earGeometry.translate(0, 0.35, 0);
    const earMaterial = new THREE.MeshStandardMaterial({
      color: 0xfee6c8,
      roughness: 0.3,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.2,
    });

    const leftEar = new THREE.Mesh(earGeometry, earMaterial);
    leftEar.position.set(-0.55, 0.75, 0);
    leftEar.rotation.z = 0.55;
    leftEar.rotation.x = -0.15;
    mascotGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeometry, earMaterial);
    rightEar.position.set(0.55, 0.75, 0);
    rightEar.rotation.z = -0.55;
    rightEar.rotation.x = -0.15;
    mascotGroup.add(rightEar);

    // Ear tip glowing starlight pearls
    const tipGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const leftTip = new THREE.Mesh(tipGeo, tipMat);
    leftTip.position.set(0, 0.72, 0);
    leftEar.add(leftTip);

    const rightTip = new THREE.Mesh(tipGeo, tipMat);
    rightTip.position.set(0, 0.72, 0);
    rightEar.add(rightTip);

    // 3. Eyes (Curious, sparkling, blinking)
    const eyeGroup = new THREE.Group();
    mascotGroup.add(eyeGroup);

    const eyeGeo = new THREE.SphereGeometry(0.13, 24, 24);
    eyeGeo.scale(1, 1.35, 0.6);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111827 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.34, 0.15, 0.88);
    leftEye.rotation.y = -0.18;
    eyeGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.34, 0.15, 0.88);
    rightEye.rotation.y = 0.18;
    eyeGroup.add(rightEye);

    // Eye Star Highlights (Gleam)
    const gleamGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const gleamMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftGleam = new THREE.Mesh(gleamGeo, gleamMat);
    leftGleam.position.set(0.03, 0.05, 0.08);
    leftEye.add(leftGleam);

    const rightGleam = new THREE.Mesh(gleamGeo, gleamMat);
    rightGleam.position.set(0.03, 0.05, 0.08);
    rightEye.add(rightGleam);

    // 4. Soft Rosy Blushes
    const blushGeo = new THREE.CircleGeometry(0.12, 24);
    const blushMat = new THREE.MeshBasicMaterial({
      color: 0xf472b6,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const leftBlush = new THREE.Mesh(blushGeo, blushMat);
    leftBlush.position.set(-0.46, -0.06, 0.82);
    leftBlush.rotation.y = -0.4;
    mascotGroup.add(leftBlush);

    const rightBlush = new THREE.Mesh(blushGeo, blushMat);
    rightBlush.position.set(0.46, -0.06, 0.82);
    rightBlush.rotation.y = 0.4;
    mascotGroup.add(rightBlush);

    // 5. Celestial Orbital Ring (Torus representing planetary science & orbit)
    const ringGeo = new THREE.TorusGeometry(1.35, 0.022, 16, 80);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI * 0.38;
    ringMesh.rotation.y = -Math.PI * 0.12;
    mascotGroup.add(ringMesh);

    // Orbiting mini planet spark
    const miniPlanetGeo = new THREE.SphereGeometry(0.085, 16, 16);
    const miniPlanetMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const miniPlanet = new THREE.Mesh(miniPlanetGeo, miniPlanetMat);
    mascotGroup.add(miniPlanet);

    // 6. Floating Ambient Sparkles (Particles)
    const particleCount = 20;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 3.2;
      particlePos[i + 1] = (Math.random() - 0.5) * 3.2;
      particlePos[i + 2] = (Math.random() - 0.5) * 2.5;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.055,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ─── Interaction & Animation Variables ────────────────────────
    let targetRotationX = 0;
    let targetRotationY = 0;
    let blinkTimer = 0;
    let nextBlink = 2.5 + Math.random() * 2.0;
    let jumpOffset = 0;
    let jumpVelocity = 0;
    let ringAngle = 0;
    let animationFrameId: number;
    let lastTime = performance.now();

    const onPointerMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotationY = normX * 0.35;
      targetRotationX = -normY * 0.25;
    };

    const handlePointerLeave = () => {
      targetRotationX = 0;
      targetRotationY = 0;
    };

    window.addEventListener('mousemove', onPointerMove);
    container.addEventListener('mouseleave', handlePointerLeave);

    // ─── Render Loop ──────────────────────────────────────────────
    const animate = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const currentState = stateRef.current;
      const t = currentTime * 0.001;

      // 1. Natural idle floating bob
      const floatAmplitude = currentState === 'thinking' ? 0.14 : 0.08;
      const floatFreq = currentState === 'thinking' ? 2.5 : 1.8;
      const floatY = Math.sin(t * floatFreq) * floatAmplitude;

      // 2. Jump physics when excited or clicked
      if (currentState === 'excited') {
        if (jumpOffset === 0 && jumpVelocity === 0) {
          jumpVelocity = 2.4;
        }
      }
      if (jumpVelocity !== 0 || jumpOffset > 0) {
        jumpOffset += jumpVelocity * dt;
        jumpVelocity -= 9.8 * dt;
        if (jumpOffset <= 0) {
          jumpOffset = 0;
          jumpVelocity = 0;
        }
      }

      // 3. Smooth rotation interpolation (look at mouse or posture)
      let desiredRotX = targetRotationX;
      let desiredRotY = targetRotationY;
      let desiredRotZ = 0;

      if (currentState === 'thinking') {
        desiredRotZ = 0.18 * Math.sin(t * 2); // Cute head tilt
        desiredRotX += 0.1;
      } else if (currentState === 'pointing') {
        desiredRotY += 0.35;
        desiredRotZ = -0.12;
      }

      mascotGroup.rotation.x += (desiredRotX - mascotGroup.rotation.x) * (dt * 6);
      mascotGroup.rotation.y += (desiredRotY - mascotGroup.rotation.y) * (dt * 6);
      mascotGroup.rotation.z += (desiredRotZ - mascotGroup.rotation.z) * (dt * 6);
      mascotGroup.position.y = floatY + jumpOffset;

      // 4. Soft breathing squash & stretch
      const breath = 1.0 + Math.sin(t * 2.2) * 0.025;
      bodyMesh.scale.set(breath, 2.0 - breath, breath);

      // 5. Ear / Antenna sway
      const earSway = Math.sin(t * 3.5) * 0.08;
      leftEar.rotation.z = 0.55 + earSway + (currentState === 'thinking' ? 0.15 : 0);
      rightEar.rotation.z = -0.55 - earSway - (currentState === 'thinking' ? -0.15 : 0);

      // 6. Natural Eye Blinking
      blinkTimer += dt;
      if (blinkTimer > nextBlink) {
        // Quick blink
        eyeGroup.scale.y = Math.max(0.08, Math.sin((blinkTimer - nextBlink) * Math.PI * 15));
        if (blinkTimer > nextBlink + 0.15) {
          eyeGroup.scale.y = 1;
          blinkTimer = 0;
          nextBlink = 2.5 + Math.random() * 3.5;
        }
      } else {
        eyeGroup.scale.y = 1;
      }

      // 7. Celestial Orbital Ring and mini planet
      const ringSpeed = currentState === 'thinking' ? 2.5 : 0.8;
      ringAngle += dt * ringSpeed;
      ringMesh.rotation.z = ringAngle * 0.3;

      // Mini planet follows the torus orbit
      const orbitR = 1.35;
      miniPlanet.position.x = Math.cos(ringAngle) * orbitR;
      miniPlanet.position.y = Math.sin(ringAngle) * orbitR * Math.sin(Math.PI * 0.38);
      miniPlanet.position.z = Math.sin(ringAngle) * orbitR * Math.cos(Math.PI * 0.38);

      // 8. Sparkle particle gentle drift
      particles.rotation.y = t * 0.05;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || (size === 'hero' ? 280 : 120);
      const h = container.clientHeight || (size === 'hero' ? 280 : 120);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mouseleave', handlePointerLeave);
      renderer.dispose();
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      earGeometry.dispose();
      earMaterial.dispose();
      eyeGeo.dispose();
      eyeMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
    };
  }, [interactive, size]);

  const sizeClasses = {
    hero: 'w-64 h-64 sm:w-72 sm:h-72 lg:w-80 lg:h-80',
    companion: 'w-24 h-24 sm:w-28 sm:h-28',
    compact: 'w-16 h-16 sm:w-20 sm:h-20',
  }[size];

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
            <span className="font-serif text-lg text-mirari-ink font-bold tracking-widest">MIRARI</span>
          </div>
        </div>
      )}

      {/* Subtle mood aura glow behind mascot */}
      <div
        className={`absolute inset-4 rounded-full -z-10 blur-2xl transition-opacity duration-700 pointer-events-none ${
          state === 'thinking'
            ? 'bg-mirari-amber/25 opacity-100 scale-110'
            : state === 'excited'
            ? 'bg-mirari-cyan/30 opacity-100 scale-125'
            : isHovered
            ? 'bg-mirari-cyan/20 opacity-90'
            : 'bg-mirari-amber/10 opacity-60'
        }`}
      />
    </div>
  );
};
