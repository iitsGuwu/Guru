import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'iitsGuru - Art & Lore',
  description: 'Digital mongrel exploring the internet.',
  icons: {
    icon: '/assets/images/guru-pfp.jpg',
    shortcut: '/assets/images/guru-pfp.jpg',
    apple: '/assets/images/guru-pfp.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white cursor-none">
        {children}
      </body>
    </html>
  )
}

