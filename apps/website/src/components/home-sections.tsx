import { Link } from '@tanstack/react-router';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import {
  AudioLines,
  BookOpen,
  Code,
  ExternalLink,
  History,
  KeyboardMusic,
  ListChecks,
  MousePointer2,
  MousePointerClick,
  Move,
  Radar,
  SlidersHorizontal,
  SquareDashedMousePointer,
  Undo2,
  Waves,
  WavesLadder,
} from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { soundor } from '../layout-options';
import { Curve, groups } from './filter-shapes';

/**
 * On a phone, where every card takes the full width, a card puts its icon
 * beside its text rather than above it, so a list of them stays short.
 */
const row =
  'max-sm:grid max-sm:grid-cols-[auto_1fr] max-sm:gap-x-3 max-sm:[&>div:first-child]:row-span-2 max-sm:[&>div:first-child]:mb-0 max-sm:[&>div:first-child]:self-start';

/** The same for a filter shape: its curve to the left of its name. */
const shapeRow =
  'max-sm:grid max-sm:grid-cols-[7.5rem_1fr] max-sm:items-center max-sm:gap-x-4 max-sm:p-3 max-sm:[&>div:last-child]:col-start-1 max-sm:[&>div:last-child]:row-span-2 max-sm:[&>div:last-child]:row-start-1 max-sm:[&>h3]:col-start-2 max-sm:[&>h3]:self-end max-sm:[&>p]:col-start-2 max-sm:[&>p]:self-start';

/** A block of the home page, headed as the Download section is. */
function Block({
  id,
  title,
  lead,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly lead: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20 pb-16 sm:pb-24">
      <div className="mx-auto mb-6 max-w-2xl text-center sm:mb-8">
        <h2 id={id} className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 text-balance text-fd-muted-foreground">{lead}</p>
      </div>
      {children}
    </section>
  );
}

export function Bands() {
  return (
    <Block
      id="bands"
      title="Seven filter shapes, up to 24 bands"
      lead="Every band takes one shape, at any frequency from 10 Hz to 30 kHz."
    >
      <Tabs items={groups.map((group) => group.title)}>
        {groups.map((group) => (
          <Tab
            key={group.title}
            value={group.title}
            style={{ '--shape': group.color } as React.CSSProperties}
          >
            <p className="mb-4 text-sm text-fd-muted-foreground">{group.detail}</p>
            <Cards className="sm:grid-cols-3">
              {group.shapes.map((shape) => (
                <Card
                  key={shape.kind}
                  title={shape.name}
                  description={shape.use}
                  className={`flex flex-col [&>div:last-child]:order-first ${shapeRow}`}
                >
                  <Curve shape={shape} />
                </Card>
              ))}
            </Cards>
          </Tab>
        ))}
      </Tabs>
      <Card
        className={`mt-3 ${row}`}
        icon={<AudioLines />}
        title="Stereo, left, right, mid or side"
        description="Each band works on both channels or just one. A band on one channel shows L, R, M or S beside its marker, so a mid boost and a side cut at the same frequency stay apart."
      />
    </Block>
  );
}

const gestures = [
  {
    icon: <MousePointerClick />,
    title: 'Double-click to add',
    text: 'A cut near either end of the graph, a bell anywhere between.',
  },
  { icon: <Move />, title: 'Drag to shape', text: 'Frequency across, gain up and down.' },
  {
    icon: <MousePointer2 />,
    title: 'Scroll to narrow',
    text: 'Q, wider or narrower; Shift for fine steps.',
  },
  {
    icon: <SquareDashedMousePointer />,
    title: 'Select several',
    text: 'Drag a rectangle, then move the bands together.',
  },
  {
    icon: <ListChecks />,
    title: 'Right-click for more',
    text: 'Bypass, solo, type, duplicate, delete.',
  },
  {
    icon: <Undo2 />,
    title: 'Undo and A/B',
    text: 'Every edit undoes, and A and B keep two setups.',
  },
];

const views = [
  { icon: <Waves />, title: 'Spectrum', text: 'Before the EQ as a line, after it as a fill.' },
  { icon: <WavesLadder />, title: 'Spectrogram', text: 'The last four seconds of the output.' },
  { icon: <KeyboardMusic />, title: 'Pitch keyboard', text: 'A piano along the frequency axis.' },
  { icon: <Radar />, title: 'Phase', text: 'The combined phase of your filters.' },
];

export function Graph() {
  return (
    <Block
      id="graph"
      title="Shape it on the graph"
      lead="Bands are markers you move with the mouse or the keyboard, over an analyzer that shows what they do."
    >
      <Cards className="sm:grid-cols-3">
        {gestures.map(({ icon, title, text }) => (
          <Card key={title} className={row} icon={icon} title={title} description={text} />
        ))}
      </Cards>
      <h3 className="mt-10 mb-4 text-sm font-medium text-fd-muted-foreground">Behind the curves</h3>
      <Cards className="sm:grid-cols-2 lg:grid-cols-4">
        {views.map(({ icon, title, text }) => (
          <Card key={title} className={row} icon={icon} title={title} description={text} />
        ))}
      </Cards>
    </Block>
  );
}

export function Questions() {
  return (
    <Block id="questions" title="Questions" lead="What people ask before they install it.">
      <Accordions className="mx-auto max-w-4xl">
        <Accordion title="Is Prism free?">
          Yes. Its software is released under the GNU Affero General Public License v3, and the
          music you make with it is yours.
        </Accordion>
        <Accordion title="Which systems and DAWs does it run in?">
          Any DAW that loads VST3 effects, on 64-bit Linux and Windows.
        </Accordion>
        <Accordion title="Does the browser demo upload my audio?">
          No. An audio file you choose stays on your device, and so does your microphone.
        </Accordion>
        <Accordion title="Can I build it myself?">
          Yes, with Node and Rust.{' '}
          <Link className="underline" to="/docs/$" params={{ _splat: 'building' }}>
            Build from source
          </Link>{' '}
          has the steps.
        </Accordion>
      </Accordions>
    </Block>
  );
}

export function Docs() {
  return (
    <Block
      id="docs"
      title="Documentation"
      lead="What every control does, what changed, and how to build Prism."
    >
      <Cards className="sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className={row}
          icon={<SlidersHorizontal />}
          title="Controls"
          href="/docs/controls"
          description="Bands, the inspector, presets, A/B and keys."
        />
        <Card
          className={row}
          icon={<BookOpen />}
          title="Analyzer and views"
          href="/docs/analyzer"
          description="Every setting behind the curves."
        />
        <Card
          className={row}
          icon={<History />}
          title="Changelog"
          href="/docs/changelog"
          description="What changed in each release."
        />
        <Card
          className={row}
          icon={<Code />}
          title="Build the VST3"
          href="/docs/building"
          description="From source, for Linux and Windows."
        />
      </Cards>
    </Block>
  );
}

/** A Prism curve with four bands, one in each of the plugin's band colours. */
const signoffCurve =
  'M0 50 C 80 50, 140 50, 200 62 S 320 100, 380 100 S 460 70, 500 66 S 580 35, 620 35 S 700 66, 740 66 S 820 55, 960 55';
const signoffBands = [
  { x: 110, y: 50, color: 'var(--prism-low)' },
  { x: 380, y: 100, color: 'var(--prism-low-mid)' },
  { x: 620, y: 35, color: 'var(--prism-high-mid)' },
  { x: 880, y: 55, color: 'var(--prism-high)' },
];

function SignoffGraph() {
  const id = useId();
  return (
    <svg
      aria-hidden
      viewBox="0 0 960 130"
      preserveAspectRatio="none"
      className="block h-24 w-full sm:h-28"
    >
      <defs>
        <linearGradient id={`${id}-line`} x1="0" x2="1" y1="0" y2="0">
          {signoffBands.map((band, i) => (
            <stop
              key={band.x}
              offset={i / (signoffBands.length - 1)}
              style={{ stopColor: band.color }}
            />
          ))}
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--prism-low-mid)', stopOpacity: 0.16 }} />
          <stop offset="1" style={{ stopColor: 'var(--prism-low-mid)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <line
        x1="0"
        x2="960"
        y1="70"
        y2="70"
        className="stroke-fd-border"
        strokeDasharray="4 6"
        vectorEffect="non-scaling-stroke"
      />
      <path d={`${signoffCurve} L 960 130 L 0 130 Z`} fill={`url(#${id}-fill)`} />
      <path
        d={signoffCurve}
        fill="none"
        stroke={`url(#${id}-line)`}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The page's sign-off: a panel that points to the other plugins, above a small
 * Prism curve, so it reads as the end of the page rather than one more card.
 */
export function MorePlugins() {
  return (
    <section aria-labelledby="more-plugins" className="pb-16 sm:pb-24">
      <div className="overflow-hidden rounded-2xl border bg-fd-card">
        <div className="flex flex-col items-start gap-6 px-6 pt-10 sm:flex-row sm:items-end sm:justify-between sm:px-10 sm:pt-12">
          <div className="max-w-md">
            <h2
              id="more-plugins"
              className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
            >
              More plugins built with Soundor
            </h2>
            <p className="mt-2 text-balance text-fd-muted-foreground">
              Prism is one of them. The rest are listed on soundor.dev.
            </p>
          </div>
          <a
            href={`${soundor}/plugins`}
            className={buttonVariants({
              variant: 'primary',
              className: 'shrink-0 gap-1.5 px-4 py-2.5',
            })}
          >
            Browse plugins <ExternalLink aria-hidden className="size-4" />
          </a>
        </div>
        <div className="relative mt-6 sm:mt-8">
          <SignoffGraph />
          {/* Markers as HTML, so they stay round whatever the panel's width. */}
          {signoffBands.map((band) => (
            <span
              key={band.x}
              aria-hidden
              className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fd-card shadow-sm"
              style={{
                left: `${(band.x / 960) * 100}%`,
                top: `${(band.y / 130) * 100}%`,
                backgroundColor: band.color,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
