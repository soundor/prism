// The seven filter types, each drawn from its own transfer function: the
// biquads of Robert Bristow-Johnson's cookbook at 48 kHz, as in the plugin.
// Cuts are two in a row, for 24 dB/oct.

const RATE = 48_000;
const LOW = 20;
const HIGH = 20_000;
/** The gain axis runs from +RANGE dB at the top to -RANGE dB at the bottom. */
const RANGE = 18;
const WIDTH = 200;
const HEIGHT = 110;
const STEPS = 160;

type Kind = 'bell' | 'lowShelf' | 'highShelf' | 'lowCut' | 'highCut' | 'notch' | 'bandPass';

export interface Shape {
  readonly kind: Kind;
  readonly name: string;
  readonly frequency: number;
  readonly gain?: number;
  readonly q: number;
  /** Cascaded sections: 2 makes a 12 dB/oct cut 24 dB/oct. */
  readonly stages?: number;
  /** What it does, in a line. */
  readonly use: string;
}

function coefficients({ kind, frequency, gain = 0, q }: Shape) {
  const w0 = (2 * Math.PI * frequency) / RATE;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a = 10 ** (gain / 40);
  const root = 2 * Math.sqrt(a) * alpha;
  switch (kind) {
    case 'bell':
      return [1 + alpha * a, -2 * cos, 1 - alpha * a, 1 + alpha / a, -2 * cos, 1 - alpha / a];
    case 'lowShelf':
      return [
        a * (a + 1 - (a - 1) * cos + root),
        2 * a * (a - 1 - (a + 1) * cos),
        a * (a + 1 - (a - 1) * cos - root),
        a + 1 + (a - 1) * cos + root,
        -2 * (a - 1 + (a + 1) * cos),
        a + 1 + (a - 1) * cos - root,
      ];
    case 'highShelf':
      return [
        a * (a + 1 + (a - 1) * cos + root),
        -2 * a * (a - 1 + (a + 1) * cos),
        a * (a + 1 + (a - 1) * cos - root),
        a + 1 - (a - 1) * cos + root,
        2 * (a - 1 - (a + 1) * cos),
        a + 1 - (a - 1) * cos - root,
      ];
    case 'lowCut':
      return [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
    case 'highCut':
      return [(1 - cos) / 2, 1 - cos, (1 - cos) / 2, 1 + alpha, -2 * cos, 1 - alpha];
    case 'notch':
      return [1, -2 * cos, 1, 1 + alpha, -2 * cos, 1 - alpha];
    case 'bandPass':
      return [alpha, 0, -alpha, 1 + alpha, -2 * cos, 1 - alpha];
  }
}

/** The shape's gain at `frequency`, in dB. */
function response(shape: Shape, frequency: number) {
  const [b0, b1, b2, a0, a1, a2] = coefficients(shape);
  const w = (2 * Math.PI * frequency) / RATE;
  const part = (c0: number, c1: number, c2: number) => {
    const re = c0 + c1 * Math.cos(w) + c2 * Math.cos(2 * w);
    const im = -c1 * Math.sin(w) - c2 * Math.sin(2 * w);
    return re * re + im * im;
  };
  return (shape.stages ?? 1) * 10 * Math.log10(part(b0!, b1!, b2!) / part(a0!, a1!, a2!));
}

const x = (frequency: number) => (WIDTH * Math.log(frequency / LOW)) / Math.log(HIGH / LOW);
const y = (db: number) => {
  const clamped = Math.max(-RANGE - 2, Math.min(RANGE, db));
  return HEIGHT / 2 - (clamped / RANGE) * (HEIGHT / 2);
};

function curve(shape: Shape) {
  const points = Array.from({ length: STEPS + 1 }, (_, i) => {
    const frequency = LOW * (HIGH / LOW) ** (i / STEPS);
    // The point's x is exact: through log and pow, the server and the browser
    // could round it apart, and React would find the SVG it hydrates changed.
    return `${((WIDTH * i) / STEPS).toFixed(1)},${y(response(shape, frequency)).toFixed(1)}`;
  });
  return `M${points.join('L')}`;
}

const isCut = (kind: Kind) => kind === 'lowCut' || kind === 'highCut';

/** The shape's response on a log frequency axis, with its marker. */
export function Curve({ shape }: { readonly shape: Shape }) {
  const line = curve(shape);
  const mx = x(shape.frequency);
  const flat = shape.kind === 'notch' || shape.kind === 'bandPass' || isCut(shape.kind);
  const my = y(flat ? 0 : (shape.gain ?? 0));
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mb-3 aspect-[200/110] max-sm:mb-0 w-full overflow-hidden rounded-lg border bg-fd-background"
      aria-hidden
    >
      {[100, 1000, 10_000].map((frequency) => (
        <line
          key={frequency}
          x1={x(frequency)}
          x2={x(frequency)}
          y1={0}
          y2={HEIGHT}
          className="stroke-fd-border"
          strokeWidth={0.6}
        />
      ))}
      <line x1={0} x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} className="stroke-fd-border" />
      <path
        d={`${line}L${WIDTH},${HEIGHT / 2}L0,${HEIGHT / 2}Z`}
        fill="var(--shape)"
        fillOpacity={0.14}
      />
      <path
        d={line}
        fill="none"
        stroke="var(--shape)"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {isCut(shape.kind) ? (
        <rect x={mx - 4} y={my - 4} width={8} height={8} rx={1.5} className="fill-fd-foreground" />
      ) : (
        <circle cx={mx} cy={my} r={4.2} className="fill-fd-foreground" />
      )}
    </svg>
  );
}

export const groups: readonly {
  readonly title: string;
  readonly detail: string;
  readonly color: string;
  readonly shapes: readonly Shape[];
}[] = [
  {
    title: 'Gain and Q',
    detail: 'Up to ±30 dB, Q from 0.025 to 40.',
    color: 'var(--prism-low)',
    shapes: [
      {
        kind: 'bell',
        name: 'Bell',
        frequency: 1000,
        gain: 9,
        q: 1.2,
        use: 'Lifts or dips around its frequency.',
      },
      {
        kind: 'lowShelf',
        name: 'Low shelf',
        frequency: 150,
        gain: 8,
        q: 0.707,
        use: 'Lifts or dips everything below it.',
      },
      {
        kind: 'highShelf',
        name: 'High shelf',
        frequency: 5000,
        gain: -8,
        q: 0.707,
        use: 'Lifts or dips everything above it.',
      },
    ],
  },
  {
    title: 'Slope',
    detail: '6 to 48 dB per octave, and a Q from 12 up.',
    color: 'var(--prism-low-mid)',
    shapes: [
      {
        kind: 'lowCut',
        name: 'Low cut',
        frequency: 90,
        q: 0.707,
        stages: 2,
        use: 'Removes rumble below it.',
      },
      {
        kind: 'highCut',
        name: 'High cut',
        frequency: 9000,
        q: 0.707,
        stages: 2,
        use: 'Removes hiss and air above it.',
      },
    ],
  },
  {
    title: 'Q alone',
    detail: 'Q from 0.025 to 40, without gain.',
    color: 'var(--prism-high-mid)',
    shapes: [
      {
        kind: 'notch',
        name: 'Notch',
        frequency: 1000,
        q: 2,
        use: 'Cuts out one narrow frequency.',
      },
      {
        kind: 'bandPass',
        name: 'Band pass',
        frequency: 1000,
        q: 1.4,
        use: 'Keeps only the frequencies around it.',
      },
    ],
  },
];
