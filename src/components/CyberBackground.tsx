import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  color: string;
  glow: number;
}

interface CircuitTrace {
  points: { x: number; y: number }[];
  progress: number;
  speed: number;
  color: string;
}

export const CyberBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
      initCircuits();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    // Subtle Particle Grid System
    const particleCount = Math.min(Math.floor((width * height) / 22000), 40);
    let particles: Particle[] = [];

    const initParticles = () => {
      particles = [];
      const colors = ['#c084fc', '#a855f7', '#9333ea', '#7e22ce'];
      for (let i = 0; i < particleCount; i++) {
        const radius = Math.random() * 1.6 + 0.6;
        const baseAlpha = Math.random() * 0.28 + 0.12;
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          radius,
          alpha: baseAlpha,
          baseAlpha,
          color: colors[Math.floor(Math.random() * colors.length)],
          glow: Math.random() * 8 + 3,
        });
      }
    };

    // Minimal elegant circuit traces
    let circuits: CircuitTrace[] = [];
    const initCircuits = () => {
      circuits = [];
      const numCircuits = Math.min(Math.floor(width / 260), 5);
      for (let i = 0; i < numCircuits; i++) {
        const startX = Math.random() * width;
        const startY = Math.random() * height;
        const points = [{ x: startX, y: startY }];
        let curX = startX;
        let curY = startY;
        const segments = 2 + Math.floor(Math.random() * 3);

        for (let s = 0; s < segments; s++) {
          const isHorizontal = s % 2 === 0;
          const dist = (Math.random() * 100 + 50) * (Math.random() > 0.5 ? 1 : -1);
          if (isHorizontal) {
            curX += dist;
          } else {
            curY += dist;
          }
          points.push({ x: curX, y: curY });
        }

        circuits.push({
          points,
          progress: Math.random(),
          speed: 0.0012 + Math.random() * 0.0018,
          color: '#a855f7',
        });
      }
    };

    initParticles();
    initCircuits();

    let time = 0;

    const render = () => {
      time += 0.008;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw subtle circuit traces & pulses
      ctx.lineWidth = 1;
      for (let c = 0; c < circuits.length; c++) {
        const circuit = circuits[c];
        const pts = circuit.points;

        // Static faint track
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.035)';
        ctx.stroke();

        // Node joints
        for (let i = 0; i < pts.length; i++) {
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, 1.8, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
          ctx.fill();
        }

        // Pulse moving along trace
        circuit.progress += circuit.speed;
        if (circuit.progress > 1) {
          circuit.progress = 0;
        }

        const totalSegments = pts.length - 1;
        const currentSegmentIndex = Math.min(
          Math.floor(circuit.progress * totalSegments),
          totalSegments - 1
        );
        const segmentProgress = (circuit.progress * totalSegments) % 1;
        const p1 = pts[currentSegmentIndex];
        const p2 = pts[currentSegmentIndex + 1];

        const pulseX = p1.x + (p2.x - p1.x) * segmentProgress;
        const pulseY = p1.y + (p2.y - p1.y) * segmentProgress;

        ctx.beginPath();
        ctx.arc(pulseX, pulseY, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(192, 132, 252, 0.7)';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 2. Slow elegant floating particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) {
          p.alpha = p.baseAlpha + (1 - dist / 140) * 0.25;
        } else {
          p.alpha = p.baseAlpha + Math.sin(time * 1.5 + i) * 0.05;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0.04, Math.min(0.7, p.alpha));
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.glow;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Subtle connections between nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const pjdx = p.x - p2.x;
          const pjdy = p.y - p2.y;
          const pjdist = Math.sqrt(pjdx * pjdx + pjdy * pjdy);

          if (pjdist < 90) {
            const lineAlpha = (1 - pjdist / 90) * 0.08;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(168, 85, 247, ${lineAlpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#06020c]">
      {/* 1. Deep Space Ambient Nebula Glows */}
      <div className="absolute -top-[15%] left-[10%] w-[50vw] h-[50vw] rounded-full bg-purple-950/25 blur-[140px] animate-pulse-slow pointer-events-none" />
      <div className="absolute top-[45%] -right-[10%] w-[45vw] h-[45vw] rounded-full bg-violet-950/20 blur-[150px] animate-pulse-slow pointer-events-none" style={{ animationDelay: '4s' }} />
      <div className="absolute -bottom-[10%] left-[25%] w-[40vw] h-[40vw] rounded-full bg-purple-900/15 blur-[160px] animate-pulse-slow pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* 2. Very subtle digital grid */}
      <div className="absolute inset-0 cyber-grid opacity-40 pointer-events-none" />

      {/* 3. Interactive Floating Particles & Circuits Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* 4. Vignette for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(6,2,12,0.85)_75%,#06020c_100%)] pointer-events-none" />
    </div>
  );
};
