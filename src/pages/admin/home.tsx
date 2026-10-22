import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CircleDashed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/controls'
import { Group, Row } from '@/components/ui/group'
import { useSettings } from '@/features/settings/api'
import { useTeamMap } from '@/features/team/api'
import { ago, money } from '@/lib/format'
import { invoke, supabase, unwrap } from '@/lib/supabase'
import type { AuditLog } from '@/types/domain'
import { SectionShell } from './shared'
import { FIELD_LABELS } from './logs'

export interface IntegrationStatus {
  email: { configured: boolean; secrets: Record<string, boolean> }
  whatsapp: { configured: boolean; provider: string; secrets: Record<string, boolean> }
  payment: { configured: boolean; provider: string; env: string; webhook_url: string; secrets: Record<string, boolean> }
}

export function useIntegrationStatus() {
  return useQuery({
    queryKey: ['integration-status'],
    queryFn: () => invoke<IntegrationStatus>('integration-status'),
    retry: false,
    staleTime: 60_000,
  })
}

function StatusDot({ ok, label }: { ok: boolean | undefined; label?: string }) {
  if (ok === undefined) return <Skeleton className="h-5 w-24" />
  return (
    <span
      className={
        ok ? 'inline-flex items-center gap-1.5 text-[15px] text-accent-text' : 'inline-flex items-center gap-1.5 text-[15px] text-fg-3'
      }
    >
      {ok ? <CheckCircle2 className="size-4" /> : <CircleDashed className="size-4" />}
      {label ?? (ok ? 'Configurado' : 'Não configurado')}
    </span>
  )
}

export default function AdminHome() {
  const { data: s, isLoading, error, refetch } = useSettings()
  const { data: integ, error: integError } = useIntegrationStatus()
  const team = useTeamMap()
  const { data: audit } = useQuery({
    queryKey: ['audit', 'recent'],
    queryFn: async () =>
      unwrap(await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(10)) as AuditLog[],
  })

  const chargeLabel = !s?.charge_enabled
    ? 'Desativada (cotação gratuita)'
    : s.fee_model === 'fixo_pedido'
      ? `${money(s.fee_fixed)} por pedido`
      : s.fee_model === 'por_produto'
        ? `${money(s.fee_per_item)} por produto`
        : 'Por faixas de quantidade'

  return (
    <SectionShell
      title="Visão geral"
      description="Status das configurações e integrações."
      loading={isLoading}
      error={error}
      onRetry={() => refetch()}
    >
      <Group title="Status">
        <Row label="Cobrança" description={chargeLabel} to="/painel/admin/cobranca">
          <StatusDot ok={s?.charge_enabled} label={s?.charge_enabled ? 'Ativa' : 'Inativa'} />
        </Row>
        <Row label="E-mail" description="Resend" to="/painel/admin/integracoes">
          <StatusDot ok={integError ? false : integ?.email.configured} />
        </Row>
        <Row
          label="WhatsApp"
          description={integ?.whatsapp.provider === 'none' ? 'Envio manual por link' : integ?.whatsapp.provider}
          to="/painel/admin/integracoes"
        >
          <StatusDot ok={integError ? false : integ?.whatsapp.configured} />
        </Row>
        <Row
          label="Pagamento automático"
          description={integ?.payment.provider === 'none' ? 'Pix manual (chave)' : integ?.payment.provider}
          to="/painel/admin/integracoes"
        >
          <StatusDot ok={integError ? false : integ?.payment.configured} />
        </Row>
      </Group>
      {integError && (
        <p className="-mt-6 px-4 text-[13px] text-fg-3">Não foi possível consultar as integrações. As Edge Functions estão publicadas?</p>
      )}

      <Group
        title="Últimas alterações"
        action={
          <Link to="/painel/admin/logs" className="text-[13px] text-accent-text">
            Ver tudo
          </Link>
        }
      >
        {(audit ?? []).length === 0 ? (
          <Row label={<span className="text-fg-3">Nenhuma alteração registrada</span>} />
        ) : (
          audit!.map((a) => (
            <Row
              key={a.id}
              label={
                <span className="text-[15px]">
                  {a.action === 'update'
                    ? `Alterou ${FIELD_LABELS[a.field ?? ''] ?? a.field}`
                    : a.action === 'insert'
                      ? `Criou item em ${a.section}`
                      : `Removeu item de ${a.section}`}
                </span>
              }
              description={`${a.user_id ? (team.get(a.user_id)?.full_name ?? 'Usuário') : 'Sistema'} · ${ago(a.created_at)}`}
            />
          ))
        )}
      </Group>
    </SectionShell>
  )
}
