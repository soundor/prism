import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { AudioWaveform, Code, Globe, Play, SlidersHorizontal } from 'lucide-react';

import { Player } from '../components/player';
import { layoutOptions } from '../layout-options';

export const Route = createFileRoute('/')({ component: Home });

const bands = [
  { frequency: '100 Hz', shape: 'Low shelf', color: 'var(--prism-low)' },
  { frequency: '400 Hz', shape: 'Low-mid bell', color: 'var(--prism-low-mid)' },
  { frequency: '2 kHz', shape: 'High-mid bell', color: 'var(--prism-high-mid)' },
  { frequency: '8 kHz', shape: 'High shelf', color: 'var(--prism-high)' },
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
              href="https://soundor.dev/"
              className="mb-6 inline-flex items-center gap-2 rounded-full border bg-fd-card/80 px-3 py-1 text-xs text-fd-muted-foreground backdrop-blur hover:text-fd-foreground"
            >
              <AudioWaveform aria-hidden className="size-3.5" />
              Built with Soundor · VST3 and the web
            </a>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Soundor Prism, a four-band equalizer
            </h1>
            <p className="mt-5 max-w-xl text-lg text-balance text-fd-muted-foreground">
              Shape bass, mids, and treble with four fixed-frequency bands. Switch to Original to
              hear what changed.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="#play"
                className={buttonVariants({ variant: 'primary', className: 'gap-1.5 px-4 py-2.5' })}
              >
                <Play aria-hidden className="size-4" /> Try in browser
              </a>
              <Link
                to="/docs/$"
                params={{ _splat: '' }}
                className={buttonVariants({ variant: 'outline', className: 'px-4 py-2.5' })}
              >
                Read the docs
              </Link>
            </div>
          </section>
          <section id="play" aria-label="Try Prism" className="scroll-mt-20 pb-20">
            <div className="mx-auto max-w-[960px] rounded-xl shadow-2xl shadow-black/10 dark:shadow-black/40">
              <Player />
            </div>
            <p className="mx-auto mt-5 max-w-xl text-center text-sm text-fd-muted-foreground">
              Press Play below the plugin to start the synth loop. Use the settings button to switch
              to an audio file from your device.
            </p>
          </section>
          <section aria-labelledby="bands" className="mx-auto max-w-[960px] pb-24">
            <h2
              id="bands"
              className="text-center text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Four bands, ±12 dB each
            </h2>
            <dl className="mt-8 mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {bands.map(({ frequency, shape, color }) => (
                <div key={frequency} className="border-t-2 pt-4" style={{ borderColor: color }}>
                  <dt className="text-2xl font-semibold tracking-tight">{frequency}</dt>
                  <dd className="mt-1 text-sm text-fd-muted-foreground">{shape}</dd>
                </div>
              ))}
            </dl>
            <Cards className="sm:grid-cols-3">
              <Card
                icon={<SlidersHorizontal />}
                title="Controls"
                href="/docs/controls"
                description="Set band gains and compare the EQ with the dry signal."
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
      <footer className="border-t px-6 py-8 text-sm text-fd-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4">
          <a href="https://soundor.dev/" className="hover:text-fd-foreground">
            Built with Soundor
          </a>
          <a
            href={`${layoutOptions.githubUrl}/blob/main/LICENSE`}
            className="hover:text-fd-foreground"
          >
            AGPL-3.0
          </a>
        </div>
      </footer>
    </HomeLayout>
  );
}
