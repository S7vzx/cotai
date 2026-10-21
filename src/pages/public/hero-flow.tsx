import * as React from 'react'

/**
 * Ilustração do hero: a pessoa fotografa o produto, o pedido converge no Cotaí
 * e volta como opções de preço, com a melhor destacada e a mensagem chegando.
 * Original do Cotaí (inspirada na referência enviada pelo cliente); sem marcas de terceiros.
 */

const FG = 'var(--fg)'
const FG2 = 'var(--fg-2)'
const LINE = 'color-mix(in srgb, var(--fg) 16%, transparent)'
const ACCENT = 'var(--accent)'
const ACCENT_TEXT = 'var(--accent-text)'
const ACCENT_SOFT = 'var(--accent-soft)'
const SURFACE = 'var(--surface)'
const SURFACE2 = 'var(--surface-2)'

// O aparelho e o ícone do app têm cores fixas (iguais nos dois temas), como objetos reais.
const DEVICE = '#1D1D1F'
const SCENE = '#F2F2F4'
const FLOOR = '#E6E6EA'
const BRAND_GREEN_DARK = '#2BC48F'

// Geometria copiada de brand/svg/cotai-app-icon.svg (não redesenhe o logo).
const SYMBOL_C = 'M188.41 90.43 A88 88 0 1 0 188.41 203.57 L154.71 175.28 A44 44 0 1 1 154.71 118.72 Z'
const SYMBOL_ACCENT = 'M161 59H201L222.94 21H182.94Z'

function appear(delay: number): React.CSSProperties {
  return { animation: `rise 600ms cubic-bezier(0.25,0.1,0.25,1) ${delay}ms both` }
}

/** Cadeira de escritório genérica (produto de exemplo). Origem no centro do assento. */
function Chair({ x, y, s = 1, color = FG }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g fill={color}>
        {/* encosto */}
        <rect x="-24" y="-54" width="48" height="46" rx="15" />
        <rect x="-3.5" y="-10" width="7" height="10" rx="2" />
        {/* braços */}
        <rect x="-37" y="-9" width="15" height="5" rx="2.5" />
        <rect x="22" y="-9" width="15" height="5" rx="2.5" />
        <rect x="-33" y="-6" width="5" height="14" rx="2" />
        <rect x="28" y="-6" width="5" height="14" rx="2" />
        {/* assento */}
        <rect x="-31" y="0" width="62" height="13" rx="6.5" />
        {/* pistão */}
        <rect x="-3" y="13" width="6" height="15" rx="2" />
      </g>
      {/* brilho do estofado */}
      <rect x="-17" y="-47" width="34" height="30" rx="10" fill="#FFFFFF" opacity="0.1" />
      <rect x="-25" y="2.5" width="50" height="3.5" rx="1.75" fill="#FFFFFF" opacity="0.14" />
      {/* base em estrela e rodízios */}
      <g stroke={color} strokeWidth="4.5" strokeLinecap="round">
        <path d="M0 28 L-27 35" />
        <path d="M0 28 L27 35" />
        <path d="M0 28 L-11 38" />
        <path d="M0 28 L11 38" />
      </g>
      <g fill={color}>
        <circle cx="-27" cy="39" r="3.6" />
        <circle cx="27" cy="39" r="3.6" />
        <circle cx="-11" cy="42" r="3.6" />
        <circle cx="11" cy="42" r="3.6" />
      </g>
    </g>
  )
}

/** Celular com a câmera aberta fotografando o produto. 168 × 304. */
function Phone({ x, y }: { x: number; y: number }) {
  const clip = React.useId()
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <clipPath id={clip}>
          <rect x="6" y="6" width="156" height="292" rx="30" />
        </clipPath>
      </defs>
      {/* botões laterais */}
      <g fill={DEVICE}>
        <rect x="-2.5" y="74" width="3" height="22" rx="1.5" />
        <rect x="-2.5" y="104" width="3" height="38" rx="1.5" />
        <rect x="167.5" y="96" width="3" height="54" rx="1.5" />
      </g>
      <rect width="168" height="304" rx="36" fill={DEVICE} stroke={LINE} />

      <g clipPath={`url(#${clip})`}>
        {/* cena fotografada */}
        <rect x="6" y="6" width="156" height="230" fill={SCENE} />
        <rect x="6" y="178" width="156" height="58" fill={FLOOR} />
        <ellipse cx="84" cy="196" rx="46" ry="6" fill={DEVICE} opacity="0.12" />
        <Chair x={84} y={154} s={1} color={DEVICE} />

        {/* foco */}
        <g stroke={ACCENT} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M38 104 V90 H52" />
          <path d="M116 90 H130 V104" />
          <path d="M38 190 V204 H52" />
          <path d="M130 190 V204 H116" />
        </g>

        {/* barra superior da câmera */}
        <rect x="62" y="14" width="44" height="13" rx="6.5" fill={DEVICE} />
        <g transform="translate(26 48)">
          <circle r="11" fill={DEVICE} opacity="0.55" />
          <path d="M1.5 -6 L-4 1 H0 L-1.5 6 L4 -1 H0 Z" fill="#FFFFFF" />
        </g>
        <g transform="translate(142 48)">
          <circle r="11" fill={DEVICE} opacity="0.55" />
          <circle r="4.5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
        </g>

        {/* zoom */}
        <g transform="translate(84 220)" fontSize="9" fontWeight="700" textAnchor="middle">
          <circle cx="-24" r="10" fill={DEVICE} opacity="0.45" />
          <text x="-24" y="3" fill="#FFFFFF">.5</text>
          <circle r="12" fill={DEVICE} opacity="0.7" />
          <text y="3" fill={BRAND_GREEN_DARK}>1×</text>
          <circle cx="24" r="10" fill={DEVICE} opacity="0.45" />
          <text x="24" y="3" fill="#FFFFFF">2</text>
        </g>

        {/* controles inferiores */}
        <rect x="6" y="236" width="156" height="62" fill={DEVICE} />
        <text x="84" y="250" fontSize="8.5" fontWeight="700" fill={BRAND_GREEN_DARK} textAnchor="middle" letterSpacing="0.08em">
          FOTO
        </text>
        <g transform="translate(30 274)">
          <rect x="-13" y="-13" width="26" height="26" rx="6" fill={SCENE} />
          <Chair x={0} y={1} s={0.24} color={DEVICE} />
        </g>
        <circle cx="84" cy="274" r="17" fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
        <circle cx="84" cy="274" r="13" fill="#FFFFFF" />
        <g transform="translate(138 274)">
          <circle r="12" fill="#FFFFFF" opacity="0.14" />
          <path d="M-5 -1.5 A5.5 5.5 0 0 1 5 -2.5 M5 1.5 A5.5 5.5 0 0 1 -5 2.5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 -6 V-2.5 H1.5 M-5 6 V2.5 H-1.5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </g>
  )
}

/** Cartão do produto pedido: fotos, nome e preço-alvo. 248 × 112. */
function Product({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="248" height="112" rx="20" fill={SURFACE} stroke={LINE} />
      {/* duas fotos empilhadas */}
      <rect x="20" y="14" width="72" height="72" rx="14" fill={SURFACE2} stroke={LINE} transform="rotate(7 56 50)" />
      <rect x="14" y="20" width="72" height="72" rx="14" fill={SCENE} stroke={LINE} />
      <ellipse cx="50" cy="83" rx="21" ry="3" fill={DEVICE} opacity="0.12" />
      <Chair x={50} y={58} s={0.56} color={DEVICE} />
      <g transform="translate(84 22)">
        <circle r="11" fill={ACCENT} stroke={SURFACE} strokeWidth="2.5" />
        <text y="4" fontSize="11" fontWeight="700" fill="var(--on-accent)" textAnchor="middle">
          2
        </text>
      </g>

      <text x="104" y="40" fontSize="14" fontWeight="600" fill={FG}>
        Cadeira giratória
      </text>
      <text x="104" y="59" fontSize="12" fill={FG2}>
        2 fotos · cor preta
      </text>
      <g transform="translate(104 70)">
        <rect width="128" height="26" rx="13" fill={ACCENT_SOFT} />
        <text x="64" y="17.5" fontSize="12" fontWeight="600" fill={ACCENT_TEXT} textAnchor="middle" className="tabular">
          Alvo R$ 160/un
        </text>
      </g>
    </g>
  )
}

function Chip({ x, y, w, label, value }: { x: number; y: number; w: number; label: string; value: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height="48" rx="24" fill={SURFACE} stroke={LINE} />
      <text x="20" y="29" fontSize="13" fill={FG2} fontWeight="500">
        {label}
      </text>
      <text x={w - 20} y="30" fontSize="16" fill={FG} fontWeight="600" textAnchor="end" className="tabular">
        {value}
      </text>
    </g>
  )
}

/** Ícone do app no centro (cotai-app-icon.svg). */
function Hub({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g transform="translate(-34 -34) scale(0.265625)">
        <rect width="256" height="256" rx="56" fill={DEVICE} />
        <g transform="translate(128 128) scale(0.68) translate(-128 -128)">
          <path d={SYMBOL_C} fill="#FFFFFF" />
          <path d={SYMBOL_ACCENT} fill={BRAND_GREEN_DARK} />
        </g>
      </g>
    </g>
  )
}

/** Opção de preço de um fornecedor. 200 × 60. */
function Price({ x, y, supplier, value, delta, best }: { x: number; y: number; supplier: string; value: string; delta: string; best?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {best && <rect x="-6" y="-6" width="212" height="72" rx="22" fill={ACCENT} opacity="0.12" />}
      <rect width="200" height="60" rx="16" fill={SURFACE} stroke={best ? ACCENT : LINE} strokeWidth={best ? 2 : 1} />
      <g transform="translate(14 16)">
        <rect width="28" height="28" rx="8" fill={best ? ACCENT : SURFACE2} />
        {best ? (
          <path d="M8.5 14.5l3.6 3.6L20 10.5" stroke="var(--on-accent)" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <text x="14" y="18.5" fontSize="12" fontWeight="700" fill={FG2} textAnchor="middle">
            {supplier.slice(-1)}
          </text>
        )}
      </g>
      <text x="54" y="25" fontSize="11.5" fill={FG2}>
        {supplier}
      </text>
      <text x="54" y="46" fontSize="19" fontWeight="600" fill={FG} className="tabular">
        {value}
      </text>
      <text x="186" y="40" fontSize="13" fontWeight="600" fill={best ? ACCENT_TEXT : FG2} textAnchor="end" className="tabular">
        {delta}
      </text>
      {best && (
        <g transform="translate(86 -13)">
          <rect width="104" height="24" rx="12" fill={ACCENT} />
          <text x="52" y="16" fontSize="10.5" fontWeight="700" fill="var(--on-accent)" textAnchor="middle" letterSpacing="0.04em">
            MELHOR PREÇO
          </text>
        </g>
      )}
    </g>
  )
}

/** Notificação de mensagem recebida no celular do cliente. 204 × 96. */
function Notice({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="204" height="96" rx="20" fill={SURFACE} stroke={LINE} />
      <g transform="translate(14 14)">
        <rect width="22" height="22" rx="6" fill={ACCENT} />
        <path
          d="M11 5.5c-3.3 0-6 2.3-6 5.2 0 1.6.8 3 2.1 3.9L6.6 17l2.9-1.4c.5.1 1 .2 1.5.2 3.3 0 6-2.3 6-5.1S14.3 5.5 11 5.5Z"
          fill="var(--on-accent)"
        />
      </g>
      <text x="44" y="29" fontSize="11.5" fontWeight="600" fill={FG2} letterSpacing="0.02em">
        WhatsApp
      </text>
      <text x="190" y="29" fontSize="11.5" fill={FG2} textAnchor="end">
        agora
      </text>
      <text x="14" y="59" fontSize="14" fontWeight="600" fill={FG}>
        Sua cotação está pronta
      </text>
      <text x="14" y="79" fontSize="12" fill={FG2} className="tabular">
        3 opções · a melhor por R$ 152
      </text>
    </g>
  )
}

function Flow({ d, delay = 0 }: { d: string; delay?: number }) {
  return (
    <g style={appear(delay)}>
      <path d={d} fill="none" stroke={LINE} strokeWidth="1.5" />
      <path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth="2"
        strokeDasharray="3 9"
        strokeLinecap="round"
        style={{ animation: 'flow 1.6s linear infinite' }}
      />
    </g>
  )
}

const PRICES = [
  { supplier: 'Fornecedor A', value: 'R$ 189', delta: '+18%' },
  { supplier: 'Fornecedor B', value: 'R$ 174', delta: '+9%' },
  { supplier: 'Fornecedor C', value: 'R$ 152', delta: '−5%', best: true },
]

export function HeroFlow() {
  return (
    <div className="w-full select-none" aria-hidden>
      {/* desktop / tablet */}
      <svg viewBox="0 0 1180 400" className="hidden w-full sm:block">
        <Flow d="M212 150 C 256 150, 252 126, 296 126" delay={250} />
        <Flow d="M212 250 C 256 250, 252 286, 296 286" delay={300} />
        <Flow d="M544 126 C 566 126, 572 196, 596 196" delay={450} />
        <Flow d="M476 286 C 530 286, 560 196, 596 196" delay={500} />
        <Flow d="M664 196 C 704 196, 704 100, 744 100" delay={700} />
        <Flow d="M664 196 L 744 196" delay={750} />
        <Flow d="M664 196 C 704 196, 704 292, 744 292" delay={800} />
        <Flow d="M944 292 L 966 292" delay={1100} />

        <g style={appear(0)}>
          <Phone x={44} y={44} />
        </g>
        <g style={appear(350)}>
          <Product x={296} y={70} />
        </g>
        <g style={appear(400)}>
          <Chip x={296} y={262} w={180} label="Quantidade" value="20 un" />
        </g>
        <g style={appear(600)}>
          <Hub x={630} y={196} />
        </g>
        {PRICES.map((p, i) => (
          <g key={p.supplier} style={appear(900 + i * 80)}>
            <Price x={744} y={70 + i * 96} {...p} />
          </g>
        ))}
        <g style={appear(1300)}>
          <Notice x={966} y={244} />
        </g>
      </svg>

      {/* celular: versão vertical */}
      <svg viewBox="0 0 360 670" className="w-full sm:hidden">
        <Flow d="M145 92 C 158 92, 156 70, 168 70" delay={250} />
        <Flow d="M145 172 C 160 172, 160 181, 176 181" delay={300} />
        <Flow d="M246 200 C 246 232, 180 240, 180 273" delay={450} />
        <Flow d="M180 327 L 180 372" delay={700} />
        <Flow d="M180 548 L 180 576" delay={1100} />

        <g style={appear(0)}>
          <g transform="translate(24 16) scale(0.72)">
            <Phone x={0} y={0} />
          </g>
        </g>
        <g style={appear(350)}>
          <g transform="translate(168 30) scale(0.72)">
            <Product x={0} y={0} />
          </g>
        </g>
        <g style={appear(400)}>
          <g transform="translate(176 162) scale(0.78)">
            <Chip x={0} y={0} w={180} label="Quantidade" value="20 un" />
          </g>
        </g>
        <g style={appear(600)}>
          <g transform="translate(180 300) scale(0.8)">
            <Hub x={0} y={0} />
          </g>
        </g>
        {PRICES.map((p, i) => (
          <g key={p.supplier} style={appear(900 + i * 80)}>
            <g transform={`translate(100 ${372 + i * 64}) scale(0.8)`}>
              <Price x={0} y={0} {...p} />
            </g>
          </g>
        ))}
        <g style={appear(1300)}>
          <g transform="translate(98 576) scale(0.8)">
            <Notice x={0} y={0} />
          </g>
        </g>
      </svg>
    </div>
  )
}
