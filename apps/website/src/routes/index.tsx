import { createFileRoute } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { AudioWaveform } from 'lucide-react';

import { Downloads } from '../components/downloads';
import { Gallery } from '../components/gallery';
import { HeroActions } from '../components/hero-actions';
import { Bands, Docs, Graph, Questions } from '../components/home-sections';
import { SiteFooter } from '../components/site-footer';
import { layoutOptions, soundor } from '../layout-options';
import { released, version } from '../release';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  return (
    <HomeLayout {...layoutOptions} links={[{ text: 'Docs', url: '/docs' }, ...layoutOptions.links]}>
      <main className="relative isolate w-full overflow-hidden">
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] [background-image:linear-gradient(to_right,var(--color-fd-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-fd-border)_1px,transparent_1px)] [background-size:48px_48px] opacity-60 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_0%,black,transparent)]"
          />
          <section
            aria-labelledby="hero-heading"
            className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-14 pb-10 text-center sm:pt-28 sm:pb-14"
          >
            <a
              href={`${soundor}/`}
              className="mb-6 inline-flex items-center gap-2 rounded-full border bg-fd-card/80 px-3 py-1 text-xs text-fd-muted-foreground backdrop-blur hover:text-fd-foreground"
            >
              <AudioWaveform aria-hidden className="size-3.5" />
              Built with Soundor · VST3 and the web
            </a>
            <h1
              id="hero-heading"
              className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
            >
              Soundor Prism, a parametric equalizer
            </h1>
            <p className="mt-5 max-w-xl text-lg text-balance text-fd-muted-foreground">
              Up to 24 bands, shaped right on the response graph, with a spectrum analyzer behind
              the curves.
            </p>
            <HeroActions />
          </section>
        </div>
        {/* Screenshots of the demo, the ones either side peeking in from the edges. */}
        <section id="play" aria-label="Prism in action" className="pb-16 sm:pb-24">
          <Gallery />
        </section>
        <div className="mx-auto max-w-6xl px-6">
          <section
            id="download"
            aria-labelledby="download-heading"
            className="mx-auto max-w-3xl scroll-mt-20 pb-16 text-center sm:pb-24"
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
          <div className="mx-auto max-w-[960px]">
            <Bands />
            <Graph />
            <Questions />
            <Docs />
          </div>
        </div>
      </main>
      <SiteFooter />
    </HomeLayout>
  );
}
