import { createFileRoute } from '@tanstack/react-router';
import { HomeLayout } from 'fumadocs-ui/layouts/home';

import { layoutOptions } from '../layout-options';

export const Route = createFileRoute('/demo')({
  head: () => ({
    meta: [
      { title: 'Demo | Soundor Prism' },
      {
        name: 'description',
        content:
          'Soundor Prism, playable in your browser: add bands, pick presets, play test signals.',
      },
    ],
  }),
  component: Demo,
});

/** The web build, as large as the window allows below the site's header. */
function Demo() {
  return (
    <HomeLayout {...layoutOptions} links={[{ text: 'Docs', url: '/docs' }, ...layoutOptions.links]}>
      <main className="flex h-[calc(100dvh-3.5rem)] min-h-96 flex-col">
        <iframe
          src={`${import.meta.env.BASE_URL}embed/index.html`}
          title="Soundor Prism, playable in the browser"
          allow="autoplay; microphone"
          className="block w-full flex-1 border-t bg-black"
        />
      </main>
    </HomeLayout>
  );
}
