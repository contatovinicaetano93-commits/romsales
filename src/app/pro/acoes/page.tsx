import Link from 'next/link'
import { ProShell } from '../_components/ProShell'

const BLOCKS = [
  {
    title: 'Reativação',
    subtitle: 'Clientes sem visita há 45+ dias — só da sua carteira',
    empty: 'Conecte a agenda para ver quem sumiu na sua base.',
    cols: ['Cliente', 'Sumiu', 'Último serviço', 'Ação'],
  },
  {
    title: 'Upsell / retorno',
    subtitle: 'Oportunidades só da sua carteira',
    empty: 'Sem oportunidades ainda — conecte a Avec primeiro.',
    cols: ['Cliente', 'Sugestão', 'Último serviço', 'Ação'],
  },
]

export default function ProAcoesPage() {
  return (
    <ProShell
      title="Ações"
      subtitle="Reativação e retorno só da sua carteira — nada do salão inteiro."
      actions={
        <Link href="/pro/hoje" className="pro-btn-ghost">
          Voltar ao Hoje
        </Link>
      }
    >
      <div className="space-y-4">
        {BLOCKS.map((block) => (
          <section key={block.title} className="pro-card p-5">
            <h2 className="text-lg font-semibold">{block.title}</h2>
            <p className="mt-1 text-sm text-muted">{block.subtitle}</p>
            <div className="mt-5 hidden grid-cols-4 gap-3 border-b border-border pb-2 text-[0.65rem] uppercase tracking-[0.16em] text-gold sm:grid">
              {block.cols.map((col) => (
                <span key={col}>{col}</span>
              ))}
            </div>
            <p className="py-10 text-center text-sm text-muted">
              {block.empty}{' '}
              <Link href="/pro/conectar" className="text-gold hover:underline">
                Conectar
              </Link>
            </p>
          </section>
        ))}
      </div>
    </ProShell>
  )
}
