'use client'

/** Sessão expirada/ inválida — quem chama deve redirecionar pro login, não mostrar um erro cru. */
export class ProSessionExpiredError extends Error {
  constructor() {
    super('Sessão expirada')
    this.name = 'ProSessionExpiredError'
  }
}

/**
 * fetch com credentials + tratamento uniforme pras páginas /pro/*:
 * - falha de rede vira Error com mensagem amigável (nunca uma exceção crua não tratada)
 * - 401 vira ProSessionExpiredError, pra quem chama redirecionar pro /login
 */
export async function proFetch(input: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(input, { ...init, credentials: 'include' })
  } catch {
    throw new Error('Falha de rede. Verifique sua conexão e tente de novo.')
  }
  if (res.status === 401) {
    throw new ProSessionExpiredError()
  }
  return res
}
