import { redirect } from 'next/navigation'

type Props = {
  searchParams: Promise<{ mode?: string; next?: string }>
}

/** Alias legado → login profissional em `/login` (produto separado). */
export default async function ProLoginAliasPage({ searchParams }: Props) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  if (sp.mode) qs.set('mode', sp.mode)
  if (sp.next) qs.set('next', sp.next)
  const q = qs.toString()
  redirect(q ? `/login?${q}` : '/login')
}
