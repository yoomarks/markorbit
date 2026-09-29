import type { TradingCommercialDirectionVersionV1 } from '@markorbit/contracts/trading-commercial-direction';

type DirectionRole = TradingCommercialDirectionVersionV1['role'];
export type DemoPalette = 'ORIGINAL' | 'RESTRAINED' | 'WARM';

const palette = {
  BEST_FIT: {
    ORIGINAL: ['#102b2a', '#e9ffcf', '#79d6b7', '#f6f5ec'],
    RESTRAINED: ['#152522', '#e8ede7', '#67877d', '#f7f6f1'],
    WARM: ['#3b2b20', '#ffe7bd', '#d49b5f', '#fff7e8']
  },
  VALUE_UP: {
    ORIGINAL: ['#1d1830', '#f4d27a', '#9c89c9', '#faf7ef'],
    RESTRAINED: ['#211f29', '#d9d2c0', '#77717f', '#f6f4ef'],
    WARM: ['#3a201b', '#f4c77d', '#a75d49', '#fff5e7']
  },
  POSSIBILITY: {
    ORIGINAL: ['#081e3d', '#7ff1e7', '#4677ff', '#f1fbff'],
    RESTRAINED: ['#182536', '#d6e0e2', '#607282', '#f3f6f5'],
    WARM: ['#40232d', '#ffcf9f', '#e27869', '#fff4e9']
  }
} as const;

function MarkGlyph({ role, fill }: { role: DirectionRole; fill: string }) {
  if (role === 'VALUE_UP') return <path d="M60 122 102 42l42 80-42-22-42 22Z" fill={fill} />;
  if (role === 'POSSIBILITY')
    return (
      <g fill="none" stroke={fill} strokeWidth="13">
        <circle cx="102" cy="84" r="43" />
        <path d="M70 116 134 52" />
      </g>
    );
  return <path d="M55 52h94v31H93v73H55V52Zm62 55h32v49h-32v-49Z" fill={fill} />;
}

export function CreativeDemoVisual({
  role,
  kind,
  paletteName = 'ORIGINAL',
  version = 1,
  label
}: {
  role: DirectionRole;
  kind: 'HERO' | 'BOARD' | 'PACKAGING' | 'WEB';
  paletteName?: DemoPalette;
  version?: number;
  label: string;
}) {
  const colors = palette[role][paletteName];
  const id = `${role}-${kind}-${paletteName}-${version}`.replaceAll('_', '-').toLowerCase();
  return (
    <svg
      className={`creative-demo-visual creative-demo-visual--${kind.toLowerCase()}`}
      viewBox="0 0 640 420"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[2]} />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodOpacity=".24" />
        </filter>
      </defs>
      <rect width="640" height="420" rx="28" fill={colors[3]} />
      <path d="M0 0h640v150C470 230 240 54 0 198V0Z" fill={`url(#${id}-bg)`} />
      {kind === 'HERO' ? (
        <>
          <circle cx="508" cy="100" r="148" fill={colors[1]} opacity=".2" />
          <g transform="translate(78 112)" filter={`url(#${id}-shadow)`}>
            <rect width="204" height="204" rx="44" fill={colors[3]} />
            <MarkGlyph role={role} fill={colors[0]} />
          </g>
          <rect x="330" y="236" width="226" height="18" rx="9" fill={colors[0]} />
          <rect x="330" y="270" width="158" height="10" rx="5" fill={colors[2]} />
          <rect x="330" y="294" width="195" height="10" rx="5" fill={colors[2]} opacity=".55" />
        </>
      ) : null}
      {kind === 'BOARD' ? (
        <>
          <g transform="translate(48 96)">
            <rect width="154" height="214" rx="18" fill={colors[0]} />
            <g transform="translate(0 25) scale(.72)">
              <MarkGlyph role={role} fill={colors[1]} />
            </g>
          </g>
          <rect x="224" y="118" width="166" height="112" rx="18" fill={colors[1]} />
          <rect x="408" y="84" width="178" height="168" rx="18" fill={colors[2]} />
          <circle cx="272" cy="310" r="44" fill={colors[0]} />
          <circle cx="372" cy="310" r="44" fill={colors[1]} />
          <circle cx="472" cy="310" r="44" fill={colors[2]} />
        </>
      ) : null}
      {kind === 'PACKAGING' ? (
        <>
          <rect
            x="90"
            y="92"
            width="218"
            height="274"
            rx="18"
            fill={colors[0]}
            filter={`url(#${id}-shadow)`}
          />
          <g transform="translate(98 126) scale(.72)">
            <MarkGlyph role={role} fill={colors[1]} />
          </g>
          <path d="m342 126 145-42 62 61-145 42-62-61Z" fill={colors[1]} />
          <path d="m342 126 62 61v154l-62-55V126Z" fill={colors[2]} />
          <path
            d="m404 187 145-42v151l-145 45V187Z"
            fill={colors[3]}
            stroke={colors[0]}
            strokeWidth="6"
          />
        </>
      ) : null}
      {kind === 'WEB' ? (
        <>
          <rect
            x="56"
            y="76"
            width="528"
            height="298"
            rx="22"
            fill={colors[3]}
            stroke={colors[0]}
            strokeWidth="8"
          />
          <rect x="56" y="76" width="528" height="56" rx="18" fill={colors[0]} />
          <circle cx="88" cy="104" r="8" fill={colors[1]} />
          <circle cx="114" cy="104" r="8" fill={colors[2]} />
          <rect x="92" y="172" width="194" height="20" rx="10" fill={colors[0]} />
          <rect x="92" y="212" width="146" height="10" rx="5" fill={colors[2]} />
          <rect x="92" y="238" width="178" height="10" rx="5" fill={colors[2]} opacity=".55" />
          <rect x="342" y="162" width="184" height="152" rx="24" fill={colors[1]} />
          <g transform="translate(356 154) scale(.72)">
            <MarkGlyph role={role} fill={colors[0]} />
          </g>
        </>
      ) : null}
      <g transform="translate(486 362)">
        <rect width="116" height="30" rx="15" fill={colors[0]} opacity=".9" />
        <text x="58" y="20" textAnchor="middle" fill={colors[3]} fontSize="12" fontWeight="700">
          SVG LAYOUT · V{version}
        </text>
      </g>
    </svg>
  );
}

export function DirectionPreviewPair({
  role,
  title,
  directionId,
  directionVersion,
  locale
}: {
  role: DirectionRole;
  title: string;
  directionId: string;
  directionVersion: number;
  locale: 'zh-CN' | 'en';
}) {
  return (
    <figure className="trading-studio__direction-media" data-direction-id={directionId}>
      <CreativeDemoVisual
        role={role}
        kind="HERO"
        label={`${title} · ${locale === 'zh-CN' ? 'SVG 主视觉布局示意' : 'SVG hero layout illustration'}`}
      />
      <CreativeDemoVisual
        role={role}
        kind="BOARD"
        label={`${title} · ${locale === 'zh-CN' ? 'SVG 资产拼图布局示意' : 'SVG asset-board layout illustration'}`}
      />
      <figcaption>
        {locale === 'zh-CN'
          ? '确定性 SVG 布局示意 · 未渲染原始商标'
          : 'Deterministic SVG layout set · source trademark not rendered'}{' '}
        · {directionId} · v{directionVersion}
      </figcaption>
    </figure>
  );
}
