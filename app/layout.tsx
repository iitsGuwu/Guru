import type { Metadata } from "next"
import { Pirata_One, Cinzel, Space_Mono } from "next/font/google"
import { Providers } from "./providers"
import CustomCursor from "./components/CustomCursor"
import { getConfig } from "@/lib/config"
import { getArtistDisplayName } from "@/lib/artist"
import "./globals.css"

const pirataOne = Pirata_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pirata-one",
  display: "swap",
})

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cinzel",
  display: "swap",
})

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
})

export async function generateMetadata(): Promise<Metadata> {
  const cfg = getConfig()
  const name = await getArtistDisplayName()
  const description =
    cfg.artistBio ?? `Digital mongrel exploring the internet — art, builds, and on-chain auctions by ${name}.`
  return {
    title: {
      default: `${name} — Art & Lore`,
      template: `%s | ${name}`,
    },
    description,
    metadataBase: new URL("https://iitsguru.com"),
    openGraph: {
      type: "website",
      title: `${name} — Art & Lore`,
      description,
      siteName: name,
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — Art & Lore`,
      description,
    },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${pirataOne.variable} ${cinzel.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>
          {/* Shared CRT chrome — mounted once at the root so it doesn't
              flicker / reinit on client-side route transitions. */}
          <CustomCursor />
          <div className="scanlines" aria-hidden />
          <div className="crt-flicker" aria-hidden />

          {children}
        </Providers>
      </body>
    </html>
  )
}
