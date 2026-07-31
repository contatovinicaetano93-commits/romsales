import { AsyncLocalStorage } from 'node:async_hooks'
import type { RomPanelId } from '@/lib/brand'

/**
 * Config efetiva de uma unidade durante o sync — presa ao contexto assíncrono da
 * requisição (não a uma variável global), então duas execuções concorrentes na mesma
 * instância (ex.: cron fast sobrepondo um full atrasado) nunca pisam uma na outra.
 */
export interface UnitRuntimeEnv {
  panel: RomPanelId
  databaseUrl?: string
  avecApiToken?: string
  avecUnitId?: string
  avecBaseUrl?: string
  avecLakeAccessKeyId?: string
  avecLakeSecretAccessKey?: string
}

const storage = new AsyncLocalStorage<UnitRuntimeEnv>()

export function runWithUnitEnv<T>(env: UnitRuntimeEnv, fn: () => Promise<T>): Promise<T> {
  return storage.run(env, fn)
}

export function getUnitEnvOverride(): UnitRuntimeEnv | undefined {
  return storage.getStore()
}
