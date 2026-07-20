'use client'

/**
 * Romsales é produto só do profissional.
 * Não embute sidebar/nav do painel da equipe (ROM Brasil / Iguatemi).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
