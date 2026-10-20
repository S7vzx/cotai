/**
 * Ilustração do hero: a pessoa fotografa o produto, o pedido converge no Cotaí
 * e volta como opções de preço, com a melhor destacada e a mensagem chegando.
 * Original do Cotaí (inspirada na referência enviada pelo cliente); sem marcas de terceiros.
 */

const FG = 'var(--fg)'
const FG2 = 'var(--fg-2)'
const LINE = 'color-mix(in srgb, var(--fg) 18%, transparent)'
const ACCENT = 'var(--accent)'
const SURFACE = 'var(--surface)'
const SURFACE2 = 'var(--surface-2)'

const SYMBOL_C = 'M188.41 90.43 A88 88 0 1 0 188.41 203.57 L154.71 175.28 A44 44 0 1 1 154.71 118.72 Z'
const SYMBOL_ACCENT = 'M161 59H201L222.94 21H182.94Z'

function appear(delay: number): React.CSSProperties {
  return { animation: `rise 600ms cubic-bezier(0.25,0.1,0.25,1) ${delay}ms both` }
}

/** Cadeira de escritório genérica (produto de exemplo). */
function Chair({ x, y, s = 1, color = FG }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={color}>
      <rect x="-22" y="-46" width="44" height="40" rx="12" />
      <rect x="-4" y="-8" width="8" height="10" rx="2" />
      <rect x="-28" y="0" width="56" height="12" rx="6" />
      <rect x="-3" y="12" width="6" height="18" rx="2" />
      <rect x="-24" y="28" width="48" height="5" rx="2.5" />
      <circle cx="-22" cy="37" r="4" />
      <circle cx="22" cy="37" r="4" />
      <circle cx="0" cy="37" r="4" />
    </g>
  )
}

function Phone({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="150" height="250" rx="30" fill={FG} />
      <rect x="7" y="7" width="136" height="236" rx="24" fill={SURFACE2} />
      <rect x="55" y="15" width="40" height="11" rx="5.5" fill={FG} />
      {/* visor da câmera */}
      <g stroke={ACCENT} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M30 70 V56 H44" />
        <path d="M106 56 H120 V70" />
        <path d="M30 156 V170 H44" />
        <path d="M120 156 V170 H106" />
      </g>
      <Chair x={75} y={120} s={1.05} />
      {/* botão do obturador */}
      <circle cx="75" cy="208" r="17" fill={SURFACE} stroke={FG} strokeOpacity="0.15" strokeWidth="1" />
      <circle cx="75" cy="208" r="12" fill={FG} fillOpacity="0.85" />
    </g>
  )
}

function Chip({ x, y, w, label, value }: { x: number; y: number; w: number; label: string; value: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height="44" rx="22" fill={SURFACE} stroke={LINE} />
      <text x="18" y="27" fontSize="13" fill={FG2} fontWeight="500">
        {label}
      </text>
      <text x={w - 18} y="28" fontSize="15" fill={FG} fontWeight="600" textAnchor="end" className="tabular">
        {value}
      </text>
    </g>
  )
}

function Node({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={{ animation: 'pulse-soft 3.2s ease-in-out infinite' }}>
        <circle r="64" fill={ACCENT} fillOpacity="0.1" />
      </g>
      <circle r="46" fill={SURFACE} stroke={LINE} />
      <g transform="translate(-23 -24) scale(0.21)">
        <path d={SYMBOL_C} fill={FG} />
        <path d={SYMBOL_ACCENT} fill={ACCENT} />
      </g>
    </g>
  )
}

function Price({ x, y, value, best }: { x: number; y: number; value: string; best?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {best && <rect x="-6" y="-6" width="188" height="68" rx="20" fill={ACCENT} opacity="0.14" />}
      <rect width="176" height="56" rx="16" fill={SURFACE} stroke={best ? ACCENT : LINE} strokeWidth={best ? 2 : 1} />
      <g transform="translate(18 16)">
        <rect width="24" height="24" rx="7" fill={best ? ACCENT : SURFACE2} />
        {best ? (
          <path d="M7 12.5l3.2 3.2L17 9" stroke="var(--on-accent)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <circle cx="12" cy="12" r="3" fill={FG2} />
        )}
      </g>
      <text x="56" y="35" fontSize="20" fontWeight="600" fill={FG} className="tabular">
        {value}
      </text>
      {best && (
        <g transform="translate(72 -14)">
          <rect width="108" height="24" rx="12" fill={ACCENT} />
          <text x="54" y="16" fontSize="11" fontWeight="700" fill="var(--on-accent)" textAnchor="middle" letterSpacing="0.03em">
            MELHOR PREÇO
          </text>
        </g>
      )}
    </g>
  )
}

function Bubble({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="168" height="88" rx="20" fill={SURFACE} stroke={LINE} />
      <path d="M22 88 L14 100 L34 88 Z" fill={SURFACE} />
      <text x="18" y="32" fontSize="13" fill={FG2} fontWeight="500">
        WhatsApp · agora
      </text>
      <text x="18" y="56" fontSize="15" fill={FG} fontWeight="600">
        Sua cotação está
      </text>
      <text x="18" y="75" fontSize="15" fill={FG} fontWeight="600">
        pronta <tspan fill={ACCENT}>✓</tspan>
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

export function HeroFlow() {
  return (
    <div className="w-full select-none" aria-hidden>
      {/* desktop / tablet */}
      <svg viewBox="0 0 1100 380" className="hidden w-full sm:block">
        <Flow d="M196 150 C 260 150, 270 92, 330 92" delay={250} />
        <Flow d="M196 240 C 260 240, 270 280, 330 280" delay={300} />
        <Flow d="M446 92 C 500 92, 480 190, 504 190" delay={450} />
        <Flow d="M446 280 C 500 280, 480 190, 504 190" delay={500} />
        <Flow d="M596 190 C 660 190, 650 96, 720 96" delay={700} />
        <Flow d="M596 190 C 660 190, 650 188, 720 188" delay={750} />
        <Flow d="M596 190 C 660 190, 650 282, 720 282" delay={800} />
        <Flow d="M902 282 C 920 282, 920 282, 924 282" delay={1100} />

        <g style={appear(0)}>
          <Phone x={46} y={64} />
        </g>
        <g style={appear(350)}>
          <g transform="translate(330 56)">
            <rect width="116" height="72" rx="16" fill={SURFACE} stroke={LINE} />
            <rect x="10" y="10" width="52" height="52" rx="10" fill={SURFACE2} />
            <Chair x={36} y={41} s={0.5} />
            <text x="72" y="32" fontSize="12" fill={FG2}>
              Foto
            </text>
            <text x="72" y="50" fontSize="14" fill={FG} fontWeight="600">
              2 fotos
            </text>
          </g>
        </g>
        <g style={appear(400)}>
          <Chip x={330} y={258} w={116} label="Qtd." value="20 un" />
        </g>
        <g style={appear(120)}>
          <Chip x={36} y={326} w={176} label="Preço-alvo" value="R$ 160" />
        </g>
        <g style={appear(600)}>
          <Node x={550} y={190} />
        </g>
        <g style={appear(900)}>
          <Price x={720} y={68} value="R$ 189" />
        </g>
        <g style={appear(980)}>
          <Price x={720} y={160} value="R$ 174" />
        </g>
        <g style={appear(1060)}>
          <Price x={720} y={254} value="R$ 152" best />
        </g>
        <g style={appear(1300)}>
          <Bubble x={924} y={208} />
        </g>
      </svg>

      {/* celular: versão vertical */}
      <svg viewBox="0 0 360 640" className="w-full sm:hidden">
        <Flow d="M180 286 C 180 310, 180 312, 180 330" delay={300} />
        <Flow d="M180 422 C 180 450, 70 440, 70 470" delay={700} />
        <Flow d="M180 422 C 180 450, 180 450, 180 470" delay={750} />
        <Flow d="M180 422 C 180 450, 290 440, 290 470" delay={800} />

        <g style={appear(0)}>
          <g transform="translate(105 20) scale(0.88)">
            <Phone x={0} y={0} />
          </g>
        </g>
        <g style={appear(150)}>
          <Chip x={12} y={240} w={164} label="Preço-alvo" value="R$ 160" />
        </g>
        <g style={appear(200)}>
          <Chip x={188} y={240} w={160} label="Qtd." value="20 un" />
        </g>
        <g style={appear(500)}>
          <Node x={180} y={376} />
        </g>
        <g style={appear(900)}>
          <g transform="translate(14 474) scale(0.62)">
            <Price x={0} y={0} value="R$ 189" />
          </g>
        </g>
        <g style={appear(960)}>
          <g transform="translate(125 474) scale(0.62)">
            <Price x={0} y={0} value="R$ 174" />
          </g>
        </g>
        <g style={appear(1020)}>
          <g transform="translate(236 474) scale(0.62)">
            <Price x={0} y={0} value="R$ 152" best />
          </g>
        </g>
        <g style={appear(1250)}>
          <g transform="translate(96 540)">
            <Bubble x={0} y={0} />
          </g>
        </g>
      </svg>
    </div>
  )
}
