import { Link } from '@tanstack/react-router';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import {
  AudioLines,
  BookOpen,
  Code,
  History,
  KeyboardMusic,
  LayoutGrid,
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
import type { ReactNode } from 'react';

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

export function MorePlugins() {
  return (
    <Block
      id="more-plugins"
      title="More plugins"
      lead="Prism is one of the plugins built with Soundor."
    >
      <Cards className="mx-auto max-w-md grid-cols-1">
        <Card
          className={row}
          icon={<LayoutGrid />}
          title="All Soundor plugins"
          href={`${soundor}/plugins`}
          description="See the others on soundor.dev."
        />
      </Cards>
    </Block>
  );
}
