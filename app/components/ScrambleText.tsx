"use client"

import { useEffect, useRef, useState } from "react"

/**
 * "Privacy / encrypted" text effect. Default state cycles through random
 * glyphs every ~60ms. On hover (detected via the nearest <a> or <button>
 * ancestor), characters are revealed left-to-right until the actual text
 * is fully visible. Unhover re-scrambles.
 *
 * SSR-safe: initial render emits the real text so search engines and the
 * pre-hydration HTML both see meaningful content. The scramble loop only
 * starts after client mount.
 */

const GLYPHS = "!@#$%^&*<>?:;{}[]+=_-~/\\|░▒▓▌▐█"

export function ScrambleText({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const [display, setDisplay] = useState(text)
  const [mounted, setMounted] = useState(false)
  const [hovered, setHovered] = useState(false)
  const spanRef = useRef<HTMLSpanElement>(null)

  // Attach pointer listeners to the nearest interactive ancestor.
  useEffect(() => {
    setMounted(true)
    const el = spanRef.current
    if (!el) return
    const target = el.closest("a, button") as HTMLElement | null
    if (!target) return
    const onEnter = () => setHovered(true)
    const onLeave = () => setHovered(false)
    target.addEventListener("pointerenter", onEnter)
    target.addEventListener("pointerleave", onLeave)
    return () => {
      target.removeEventListener("pointerenter", onEnter)
      target.removeEventListener("pointerleave", onLeave)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    let progress = 0 // count of characters revealed during hover

    const id = setInterval(() => {
      if (hovered) {
        // Reveal two characters per tick so the decryption feels snappy.
        progress = Math.min(text.length, progress + 2)
      } else {
        // Unscramble unwinds faster than the reveal so the privacy state
        // resumes quickly when the cursor moves off.
        progress = Math.max(0, progress - 3)
      }
      if (progress >= text.length) {
        setDisplay(text)
      } else {
        setDisplay(
          Array.from(text, (c, i) => {
            if (c === " ") return " "
            if (i < progress) return c
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          }).join(""),
        )
      }
    }, 70)
    return () => clearInterval(id)
  }, [hovered, mounted, text])

  return (
    <span ref={spanRef} className={className} aria-label={text}>
      {display}
    </span>
  )
}
