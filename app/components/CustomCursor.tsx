'use client'

import { useEffect, useRef, useState } from 'react'

const TRAIL_LENGTH = 12

export default function CustomCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -100, y: -100 })
  const trail = useRef(
    Array.from({ length: TRAIL_LENGTH }, () => ({ x: -100, y: -100, rot: 0 }))
  )
  const [hovering, setHovering] = useState(false)
  const hoveringRef = useRef(false)

  useEffect(() => {
    hoveringRef.current = hovering
  }, [hovering])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const handlePointerMove = (e: PointerEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }

    const isHoverable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false
      return !!(
        el.closest('a') ||
        el.closest('button') ||
        el.closest('[role="button"]') ||
        el.closest('.hover-trigger') ||
        el.closest('input') ||
        el.closest('textarea') ||
        el.closest('select')
      )
    }

    const handlePointerOver = (e: PointerEvent) => {
      if (isHoverable(e.target)) setHovering(true)
    }
    const handlePointerOut = (e: PointerEvent) => {
      if (isHoverable(e.target)) setHovering(false)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerover', handlePointerOver, { passive: true })
    window.addEventListener('pointerout', handlePointerOut, { passive: true })

    let frame: number | null = null
    let time = 0

    const drawShape = (
      x: number,
      y: number,
      size: number,
      rotation: number,
      opacity: number,
      filled: boolean
    ) => {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.globalAlpha = opacity

      if (filled) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(-size / 2, -size / 2, size, size)
      } else {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.strokeRect(-size / 2, -size / 2, size, size)
      }

      ctx.restore()
    }

    const render = () => {
      time += 0.02
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = trail.current.length - 1; i > 0; i--) {
        trail.current[i].x += (trail.current[i - 1].x - trail.current[i].x) * 0.35
        trail.current[i].y += (trail.current[i - 1].y - trail.current[i].y) * 0.35
        trail.current[i].rot += 0.08 + i * 0.01
      }
      trail.current[0].x += (mouse.current.x - trail.current[0].x) * 0.5
      trail.current[0].y += (mouse.current.y - trail.current[0].y) * 0.5
      trail.current[0].rot += 0.06

      const isHover = hoveringRef.current

      for (let i = trail.current.length - 1; i >= 0; i--) {
        const t = trail.current[i]
        const progress = i / trail.current.length
        const opacity = (1 - progress) * 0.6
        const size = isHover ? 6 + (1 - progress) * 14 : 3 + (1 - progress) * 6

        const glitchX = Math.random() < 0.05 ? (Math.random() - 0.5) * 8 : 0
        const glitchY = Math.random() < 0.05 ? (Math.random() - 0.5) * 8 : 0

        drawShape(t.x + glitchX, t.y + glitchY, size, t.rot, opacity, i % 2 === 0)
      }

      const mainSize = isHover ? 18 : 10
      ctx.save()
      ctx.translate(trail.current[0].x, trail.current[0].y)
      ctx.rotate(time * 2)
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = isHover ? 2 : 1.5

      ctx.beginPath()
      ctx.moveTo(0, -mainSize / 2)
      ctx.lineTo(mainSize / 2, 0)
      ctx.lineTo(0, mainSize / 2)
      ctx.lineTo(-mainSize / 2, 0)
      ctx.closePath()
      ctx.stroke()

      if (isHover) {
        ctx.globalAlpha = 0.4
        ctx.beginPath()
        ctx.moveTo(-mainSize, 0)
        ctx.lineTo(mainSize, 0)
        ctx.moveTo(0, -mainSize)
        ctx.lineTo(0, mainSize)
        ctx.stroke()
      }
      ctx.restore()

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
      ctx.clearRect(0, 0, canvas.width, canvas.height)
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
      window.removeEventListener('pointerover', handlePointerOver)
      window.removeEventListener('pointerout', handlePointerOut)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ mixBlendMode: 'difference' }}
      aria-hidden
    />
  )
}
