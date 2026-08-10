import type { DirectorProfessional } from './types'

/**
 * Equipe ROM Iguatemi — preencher com o portfólio oficial (como professionals.brasil.ts).
 *
 * Enquanto vazio, o Conectar Romsales usa o mesmo match-pro contra nomes já
 * sincronizados em client_services (cron Avec full). Assim IG não fica bloqueado.
 */
export const IGUATEMI_DIRECTOR_PROFESSIONALS: DirectorProfessional[] = []
