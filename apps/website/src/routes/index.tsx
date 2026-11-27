import { createFileRoute } from '@tanstack/react-router';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { AudioWaveform, Code, Globe, SlidersHorizontal } from 'lucide-react';

import { Downloads } from '../components/downloads';
import { HeroActions } from '../components/hero-actions';
import { Player } from '../components/player';
import { SiteFooter } from '../components/site-footer';
import { layoutOptions, soundor } from '../layout-options';
import { released, version } from '../release';

export const Route = createFileRoute('/')({ component: Home });

const facts = [
  { value: '24', label: 'Bands', color: 'var(--prism-low)' },
  { value: '7', label: 'Filter types', color: 'var(--prism-low-mid)' },
  { value: '±30 dB', label: 'Gain per band', color: 'var(--prism-high-mid)' },
  { value: 'L R M S', label: 'Per-band channels', color: 'var(--prism-high)' },
];

function Home() {
  return (
    <HomeLayout {...layoutOptions} links={[{ text: 'Docs', url: '/docs' }, ...layoutOptions.links]}>
      <main className="relative isolate w-full overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] [background-image:linear-gradient(to_right,var(--color-fd-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-fd-border)_1px,transparent_1px)] [background-size:48px_48px] opacity-60 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_0%,black,transparent)]"
        />
        <div className="mx-auto max-w-6xl px-6">
          <section className="flex flex-col items-center pt-20 pb-14 text-center sm:pt-28">
            <a
              href={`${soundor}/`}
              className="mb-6 inline-flex items-center gap-2 rounded-full border bg-fd-card/80 px-3 py-1 text-xs text-fd-muted-foreground backdrop-blur hover:text-fd-foreground"
            >
              <AudioWaveform aria-hidden className="size-3.5" />
              Built with Soundor · VST3 and the web
            </a>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Soundor Prism, a parametric equalizer
            </h1>
            <p className="mt-5 max-w-xl text-lg text-balance text-fd-muted-foreground">
              Up to 24 bands, shaped right on the response graph, with a spectrum analyzer behind
              the curves.
            </p>
            <HeroActions />
          </section>
          <section id="play" aria-label="Try Prism" className="scroll-mt-20 pb-20">
            <div className="mx-auto max-w-[960px] rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/40">
              <Player />
            </div>
            <p className="mx-auto mt-5 max-w-xl text-center text-sm text-fd-muted-foreground">
              Double-click the graph to add a band, or pick a preset. Press Play below the plugin
              for the synth loop. Prism is in development: the audio passes through unchanged for
              now.
            </p>
          </section>
          <section
            id="download"
            aria-labelledby="download-heading"
            className="mx-auto max-w-3xl scroll-mt-20 pb-24 text-center"
          >
            <p className="mb-2 font-mono text-xs tracking-wider text-fd-primary uppercase">
              Download
            </p>
            <h2 id="download-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {released ? `Soundor Prism ${version}` : 'Soundor Prism'}
            </h2>
            <p className="mt-2 mb-8 text-fd-muted-foreground">
              A VST3 equalizer for Linux and Windows.
            </p>
            <Downloads centered />
          </section>
          <section aria-labelledby="bands" className="mx-auto max-w-[960px] pb-24">
            <h2
              id="bands"
              className="text-center text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Every band, every shape
            </h2>
            <dl className="mt-8 mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {facts.map(({ value, label, color }) => (
                // The label is the term; the value shows first.
                <div
                  key={label}
                  className="flex flex-col-reverse border-t-2 pt-4"
                  style={{ borderColor: color }}
                >
                  <dt className="mt-1 text-sm text-fd-muted-foreground">{label}</dt>
                  <dd className="text-2xl font-semibold tracking-tight">{value}</dd>
                </div>
              ))}
            </dl>
            <Cards className="sm:grid-cols-3">
              <Card
                icon={<SlidersHorizontal />}
                title="Controls"
                href="/docs/controls"
                description="Add and shape bands, use presets and compare A and B."
              />
              <Card
                icon={<Globe />}
                title="Browser demo"
                href="/docs/browser"
                description="Play the built-in synth loop or bring an audio file."
              />
              <Card
                icon={<Code />}
                title="Build the VST3"
                href="/docs/building"
                description="Build the plugin from source for your VST3 host."
              />
            </Cards>
          </section>
        </div>
      </main>
      <SiteFooter />
    </HomeLayout>
  );
}
