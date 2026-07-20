'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getRomsalesProduct } from '@/lib/pro/product'
import { getBrand, isMultiUnitDeploy, type RomPanelId } from '@/lib/brand'

function LoginForm() {
  const product = getRomsalesProduct()
  const multiUnit = isMultiUnitDeploy()
  const params = useSearchParams()
  const initialMode = params.get('mode') === 'register' ? 'register' : 'login'
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [panel, setPanel] = useState<RomPanelId>('brasil')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const brand = getBrand(multiUnit ? panel : undefined)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const endpoint = mode === 'register' ? '/api/pro/register' : '/api/pro/login'
      const body =
        mode === 'register'
          ? {
              fullName: fullName.trim(),
              email: email.trim(),
              password,
              ...(multiUnit ? { panel } : {}),
            }
          : { email: email.trim(), password }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'Não foi possível entrar')
        return
      }
      window.location.assign(json.data?.next ?? '/pro/conectar')
    } catch {
      setError('Falha de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, color-mix(in srgb, var(--gold) 18%, transparent), transparent 55%)',
        }}
      />
      <form onSubmit={(e) => void submit(e)} className="pro-card relative w-full max-w-md p-6">
        <p className="text-[0.62rem] uppercase tracking-[0.22em] text-gold">App do profissional</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight text-foreground">
          {product.productName}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {mode === 'register' ? 'Criar conta Free' : 'Entrar'}
          {mode === 'login' || !multiUnit ? ` · ${brand.displayName}` : null}
        </p>

        {mode === 'register' ? (
          <>
            <label className="mt-6 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
              Nome
              <input
                className="pro-input mt-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>

            {multiUnit ? (
              <label className="mt-4 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
                Unidade
                <select
                  className="pro-input mt-2"
                  value={panel}
                  onChange={(e) => setPanel(e.target.value as RomPanelId)}
                >
                  <option value="brasil">ROM Club Brasil</option>
                  <option value="iguatemi">ROM Club Iguatemi</option>
                </select>
              </label>
            ) : null}
          </>
        ) : null}

        <label className="mt-4 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
          E-mail
          <input
            type="email"
            className="pro-input mt-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="mt-4 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
          Senha
          <input
            type="password"
            className="pro-input mt-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </label>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

        <button type="submit" disabled={loading} className="pro-btn mt-6 w-full">
          {loading ? 'Aguarde…' : mode === 'register' ? 'Criar conta Free' : 'Entrar'}
        </button>

        <button
          type="button"
          className="mt-3 w-full text-sm text-muted hover:text-gold"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
        >
          {mode === 'login' ? 'Criar conta Free' : 'Já tenho conta — entrar'}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <LoginForm />
    </Suspense>
  )
}
