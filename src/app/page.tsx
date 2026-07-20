import Link from 'next/link'
import { getRomsalesProduct } from '@/lib/pro/product'

export default function Home() {
  const product = getRomsalesProduct()

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% -8%, color-mix(in srgb, var(--gold) 22%, transparent), transparent 58%), linear-gradient(180deg, #120f0c 0%, var(--background) 55%)',
        }}
      />
      <main className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-[0.65rem] uppercase tracking-[0.24em] text-gold">App do profissional</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl tracking-tight text-foreground">
          {product.productName}
        </h1>
        <p className="mt-4 text-base text-muted">{product.landingSupport}</p>
        <p className="mt-2 text-sm text-muted">
          Cadastro Free · todas as funções liberadas · sem planos nem checkout.
        </p>

        <div className="mt-10 flex flex-col gap-3">
          <Link href="/login" className="pro-btn py-3.5">
            Entrar
          </Link>
          <Link href="/login?mode=register" className="pro-btn-ghost py-3.5">
            Criar conta
          </Link>
        </div>
      </main>
    </div>
  )
}
