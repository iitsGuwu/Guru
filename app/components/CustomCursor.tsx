'use client';

import { useEffect, useRef, useState } from 'react';

const TRAIL_LENGTH = 12;

export default function CustomCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -100, y: -100 });
  const trail = useRef(
    Array.from({ length: TRAIL_LENGTH }, () => ({ x: -100, y: -100, rot: 0 }))
  );
  const [hovering, setHovering] = useState(false);
  const hoveringRef = useRef(false);

  useEffect(() => {
    hoveringRef.current = hovering;
  }, [hovering]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName.toLowerCase() === 'a' ||
        target.tagName.toLowerCase() === 'button' ||
        target.closest('.hover-trigger') ||
        target.closest('a') ||
        target.closest('button')
      ) {
        setHovering(true);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName.toLowerCase() === 'a' ||
        target.tagName.toLowerCase() === 'button' ||
        target.closest('.hover-trigger') ||
        target.closest('a') ||
        target.closest('button')
      ) {
        setHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mouseout', handleMouseOut);

    let frame: number;
    let time = 0;

    const drawShape = (
      x: number,
      y: number,
      size: number,
      rotation: number,
      opacity: number,
      filled: boolean
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity;

      if (filled) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-size / 2, -size / 2, size, size);
      } else {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
      }

      ctx.restore();
    };

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update trail positions with easing
      for (let i = trail.current.length - 1; i > 0; i--) {
        trail.current[i].x += (trail.current[i - 1].x - trail.current[i].x) * 0.35;
        trail.current[i].y += (trail.current[i - 1].y - trail.current[i].y) * 0.35;
        trail.current[i].rot += 0.08 + i * 0.01;
      }
      trail.current[0].x += (mouse.current.x - trail.current[0].x) * 0.5;
      trail.current[0].y += (mouse.current.y - trail.current[0].y) * 0.5;
      trail.current[0].rot += 0.06;

      const isHover = hoveringRef.current;

      // Draw trail (back to front)
      for (let i = trail.current.length - 1; i >= 0; i--) {
        const t = trail.current[i];
        const progress = i / trail.current.length;
        const opacity = (1 - progress) * 0.6;
        const size = isHover ? 6 + (1 - progress) * 14 : 3 + (1 - progress) * 6;

        // Geometric glitch: occasional offset
        const glitchX = Math.random() < 0.05 ? (Math.random() - 0.5) * 8 : 0;
        const glitchY = Math.random() < 0.05 ? (Math.random() - 0.5) * 8 : 0;

        drawShape(
          t.x + glitchX,
          t.y + glitchY,
          size,
          t.rot,
          opacity,
          i % 2 === 0
        );
      }

      // Main cursor: rotating diamond
      const mainSize = isHover ? 18 : 10;
      ctx.save();
      ctx.translate(trail.current[0].x, trail.current[0].y);
      ctx.rotate(time * 2);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = isHover ? 2 : 1.5;

      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -mainSize / 2);
      ctx.lineTo(mainSize / 2, 0);
      ctx.lineTo(0, mainSize / 2);
      ctx.lineTo(-mainSize / 2, 0);
      ctx.closePath();
      ctx.stroke();

      // Inner crosshair
      if (isHover) {
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.moveTo(-mainSize, 0);
        ctx.lineTo(mainSize, 0);
        ctx.moveTo(0, -mainSize);
        ctx.lineTo(0, mainSize);
        ctx.stroke();
      }

      ctx.restore();

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', handleMouseOut);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ mixBlendMode: 'difference' }}
    />
  );
}
