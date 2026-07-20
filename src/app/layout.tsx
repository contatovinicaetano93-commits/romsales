import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { AppShell } from './_components/AppShell'
import { getBrand } from '@/lib/brand'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const display = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
})

const brand = getBrand()

export const metadata: Metadata = {
  title: `Romsales · ${brand.displayName}`,
  description: `App do profissional · ${brand.displayName}: agenda, clientes e ações.`,
  applicationName: 'Romsales',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Romsales',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0908',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
