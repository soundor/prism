import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import DefaultSearchDialog, {
  type DefaultSearchDialogProps,
} from 'fumadocs-ui/components/dialog/search-default';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';

import styles from '../styles.css?url';

const base = import.meta.env.BASE_URL;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Soundor Prism: a four-band equalizer' },
      {
        name: 'description',
        content: 'Soundor Prism is a four-band equalizer for VST3 hosts and the browser.',
      },
      { property: 'og:title', content: 'Soundor Prism' },
      {
        property: 'og:image',
        content: `${import.meta.env.VITE_PRISM_SITE_ORIGIN ?? ''}${base}social-preview.png`,
      },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: styles },
      { rel: 'icon', href: `${base}icon.svg`, type: 'image/svg+xml' },
      { rel: 'icon', href: `${base}favicon.ico`, sizes: '48x48' },
      { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png` },
    ],
  }),
  component: Root,
});

function Root() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <RootProvider search={{ SearchDialog }}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}

function SearchDialog(props: DefaultSearchDialogProps) {
  return <DefaultSearchDialog {...props} type="static" api={`${base}search-index.json`} />;
}
