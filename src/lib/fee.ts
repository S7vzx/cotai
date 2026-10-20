import type { FeeModel, FeeTier } from '@/types/domain'

export interface FeeConfig {
  enabled: boolean
  model: FeeModel
  fixed: number
  per_item: number
  per_item_max: number | null
  tiers: FeeTier[]
}

/**
 * Espelho de public.calculate_fee() — usado só para PREVIEW (formulário e
 * painel de administração). O valor cobrado de verdade sempre vem do banco.
 */
export function previewFee(config: FeeConfig, itemCount: number): number {
  if (!config.enabled) return 0
  const n = Math.max(1, Math.floor(itemCount || 1))
  switch (config.model) {
    case 'fixo_pedido':
      return round(config.fixed)
    case 'por_produto': {
      const total = config.per_item * n
      return round(config.per_item_max != null ? Math.min(total, config.per_item_max) : total)
    }
    case 'faixas': {
      const tier = [...config.tiers].filter((t) => t.from <= n && (t.to == null || t.to >= n)).sort((a, b) => b.from - a.from)[0]
      return round(tier?.amount ?? 0)
    }
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100
}

/** Verifica se as faixas cobrem de 1 em diante sem buracos nem sobreposição. */
export function validateTiers(tiers: FeeTier[]): string | null {
  if (tiers.length === 0) return 'Adicione pelo menos uma faixa'
  const sorted = [...tiers].sort((a, b) => a.from - b.from)
  if (sorted[0].from !== 1) return 'A primeira faixa deve começar em 1 produto'
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]
    if (t.amount < 0) return 'Valores não podem ser negativos'
    if (t.to != null && t.to < t.from) return `Faixa ${t.from}–${t.to} está invertida`
    const next = sorted[i + 1]
    if (next) {
      if (t.to == null) return 'Só a última faixa pode ficar sem limite'
      if (next.from !== t.to + 1) return `Há um buraco ou sobreposição entre ${t.to} e ${next.from}`
    }
  }
  return null
}
