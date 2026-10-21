import { Segmented } from '@/components/ui/controls'
import { Group, Row } from '@/components/ui/group'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { PRIORITY } from '@/lib/status'
import type { FieldMode, Priority } from '@/types/domain'
import { SaveBar, SectionShell, useSettingsDraft } from './shared'

const KEYS = [
  'sla_hours',
  'eta_text',
  'default_validity_days',
  'max_items_per_request',
  'max_photos_per_item',
  'max_photo_mb',
  'form_fields_config',
  'max_options_per_item',
  'min_margin_alert',
  'assignment_mode',
  'default_priority',
  'terms_text',
] as const

const FIELDS: { key: string; label: string; allowRequired: boolean; fallback: FieldMode }[] = [
  { key: 'category', label: 'Categoria do produto', allowRequired: true, fallback: 'oculto' },
  { key: 'unit', label: 'Unidade de medida', allowRequired: false, fallback: 'opcional' },
  { key: 'reference_url', label: 'Link de referência', allowRequired: true, fallback: 'opcional' },
  { key: 'notes', label: 'Observações do produto', allowRequired: true, fallback: 'opcional' },
]

function NumberRow({
  label,
  description,
  value,
  onChange,
  suffix,
  min = 1,
  max,
}: {
  label: string
  description?: string
  value: number
  onChange: (n: number) => void
  suffix?: string
  min?: number
  max?: number
}) {
  return (
    <Row label={label} description={description}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          className="h-9 w-24 text-right tabular"
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(Math.min(max ?? Infinity, Math.max(min, n)))
          }}
        />
        {suffix && <span className="w-14 text-[15px] text-fg-2">{suffix}</span>}
      </div>
    </Row>
  )
}

export default function AdminRegras() {
  const { draft, set, dirty, save, reset, saving, isLoading, error, refetch } = useSettingsDraft(KEYS)

  return (
    <SectionShell
      title="Regras de cotação"
      description="Prazos, limites e o que o formulário pede ao cliente."
      loading={isLoading || !draft}
      error={error}
      onRetry={() => refetch()}
    >
      {draft && (
        <>
          <Group title="Prazos" footer="Pedidos parados por mais tempo que o SLA ficam em vermelho no painel.">
            <NumberRow label="SLA de atendimento" value={draft.sla_hours} onChange={(n) => set('sla_hours', n)} suffix="horas" />
            <Row label="Prazo mostrado ao cliente" stacked>
              <Input value={draft.eta_text} placeholder="em até 48 horas úteis" onChange={(e) => set('eta_text', e.target.value)} />
            </Row>
            <NumberRow
              label="Validade padrão da cotação"
              value={draft.default_validity_days}
              onChange={(n) => set('default_validity_days', n)}
              suffix="dias"
            />
          </Group>

          <Group title="Limites">
            <NumberRow
              label="Produtos por pedido"
              value={draft.max_items_per_request}
              onChange={(n) => set('max_items_per_request', n)}
              max={50}
            />
            <NumberRow
              label="Fotos por produto"
              value={draft.max_photos_per_item}
              onChange={(n) => set('max_photos_per_item', n)}
              max={10}
            />
            <NumberRow
              label="Tamanho máximo da foto"
              value={draft.max_photo_mb}
              onChange={(n) => set('max_photo_mb', n)}
              suffix="MB"
              max={25}
            />
            <NumberRow
              label="Opções por produto"
              description="A, B, C…"
              value={draft.max_options_per_item}
              onChange={(n) => set('max_options_per_item', n)}
              max={10}
            />
          </Group>

          <Group
            title="Campos do formulário"
            footer="Nome, empresa, WhatsApp, e-mail, foto, nome do produto, quantidade e preço-alvo são sempre obrigatórios."
          >
            {FIELDS.map((f) => (
              <Row key={f.key} label={f.label} stacked>
                <Segmented<FieldMode>
                  size="sm"
                  className="w-full sm:w-auto"
                  value={(draft.form_fields_config?.[f.key] as FieldMode) ?? f.fallback}
                  onChange={(v) => set('form_fields_config', { ...draft.form_fields_config, [f.key]: v })}
                  options={[
                    { value: 'oculto', label: 'Oculto' },
                    { value: 'opcional', label: 'Opcional' },
                    ...(f.allowRequired ? [{ value: 'obrigatorio' as FieldMode, label: 'Obrigatório' }] : []),
                  ]}
                />
              </Row>
            ))}
          </Group>

          <Group title="Equipe">
            <Row
              label="Distribuição de tarefas"
              description={
                draft.assignment_mode === 'rodizio'
                  ? 'Novos pedidos vão para o cotador com menos tarefas abertas'
                  : 'Alguém assume cada pedido'
              }
              stacked
            >
              <Segmented
                value={draft.assignment_mode}
                onChange={(v) => set('assignment_mode', v)}
                options={[
                  { value: 'manual', label: 'Manual' },
                  { value: 'rodizio', label: 'Rodízio' },
                ]}
              />
            </Row>
            <Row label="Prioridade padrão">
              <NativeSelect
                className="h-9 w-40"
                value={draft.default_priority}
                onChange={(e) => set('default_priority', e.target.value as Priority)}
              >
                {Object.entries(PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </NativeSelect>
            </Row>
            <NumberRow
              label="Alerta de margem mínima"
              description="Avisa o cotador se a margem ficar abaixo"
              value={Number(draft.min_margin_alert)}
              onChange={(n) => set('min_margin_alert', n)}
              suffix="%"
              min={0}
              max={100}
            />
          </Group>

          <Group title="Termos de uso" footer="O cliente precisa aceitar antes de enviar o pedido.">
            <Row label="Texto" stacked>
              <Textarea rows={8} value={draft.terms_text} onChange={(e) => set('terms_text', e.target.value)} />
            </Row>
          </Group>

          <SaveBar
            dirty={dirty}
            saving={saving}
            onReset={reset}
            onSave={() => save((d) => (!d.eta_text.trim() ? 'Informe o prazo mostrado ao cliente' : null))}
          />
        </>
      )}
    </SectionShell>
  )
}
