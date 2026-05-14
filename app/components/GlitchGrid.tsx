'use client'

import { useEffect, useRef, useState } from 'react'

const GRID_SPACING = 40
const WARP_RADIUS = 160
const WARP_STRENGTH = 18

export default function GlitchGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -500, y: -500 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    let cols = 0
    let rows = 0
    let frame: number | null = null

    let glitchLines: { y: number; opacity: number; width: number; speed: number }[] = []

    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
      cols = Math.ceil(w / GRID_SPACING) + 2
      rows = Math.ceil(h / GRID_SPACING) + 2
    }
    resize()
    window.addEventListener('resize', resize)

    const handlePointerMove = (e: PointerEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', handlePointerMove, { passive: true })

    const getWarpedPoint = (gx: number, gy: number): [number, number] => {
      const dx = gx - mouse.current.x
      const dy = gy - mouse.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < WARP_RADIUS && dist > 0) {
        const force = (1 - dist / WARP_RADIUS) * WARP_STRENGTH
        const angle = Math.atan2(dy, dx)
        return [gx + Math.cos(angle) * force, gy + Math.sin(angle) * force]
      }
      return [gx, gy]
    }

    const render = () => {
      ctx.fillStyle = '#050505'
      ctx.fillRect(0, 0, w, h)

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
      ctx.lineWidth = 0.5

      for (let row = 0; row < rows; row++) {
        ctx.beginPath()
        for (let col = 0; col < cols; col++) {
          const gx = col * GRID_SPACING
          const gy = row * GRID_SPACING
          const [wx, wy] = getWarpedPoint(gx, gy)
          if (col === 0) ctx.moveTo(wx, wy)
          else ctx.lineTo(wx, wy)
        }
        ctx.stroke()
      }

      for (let col = 0; col < cols; col++) {
        ctx.beginPath()
        for (let row = 0; row < rows; row++) {
          const gx = col * GRID_SPACING
          const gy = row * GRID_SPACING
          const [wx, wy] = getWarpedPoint(gx, gy)
          if (row === 0) ctx.moveTo(wx, wy)
          else ctx.lineTo(wx, wy)
        }
        ctx.stroke()
      }

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const gx = col * GRID_SPACING
          const gy = row * GRID_SPACING
          const dx = gx - mouse.current.x
          const dy = gy - mouse.current.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < WARP_RADIUS) {
            const [wx, wy] = getWarpedPoint(gx, gy)
            const alpha = (1 - dist / WARP_RADIUS) * 0.7
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
            ctx.fillRect(wx - 1.5, wy - 1.5, 3, 3)
          }
        }
      }

      if (Math.random() < 0.03) {
        glitchLines.push({
          y: Math.random() * h,
          opacity: 0.15 + Math.random() * 0.15,
          width: 1 + Math.random() * 3,
          speed: 0.02 + Math.random() * 0.04,
        })
      }

      glitchLines = glitchLines.filter((line) => {
        line.opacity -= line.speed
        if (line.opacity <= 0) return false
        ctx.fillStyle = `rgba(255, 255, 255, ${line.opacity})`
        ctx.fillRect(0, line.y, w, line.width)
        return true
      })

      frame = requestAnimationFrame(render)
    }

    const start = () => {
      if (frame == null) frame = requestAnimationFrame(render)
    }
    const stop = () => {
      if (frame != null) {
        cancelAnimationFrame(frame)
        frame = null
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    start()

    return () => {
      stop()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden
    />
  )
}
