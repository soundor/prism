import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { ExternalLink } from 'lucide-react';

import logoDark from '../../../assets/brand/svg/soundor-prism-logo-on-dark.svg?url';
import logo from '../../../assets/brand/svg/soundor-prism-logo.svg?url';

export const repository = 'https://github.com/soundor/prism';
export const soundor = 'https://soundor.dev';
export const soundorLink = { text: 'Soundor', url: `${soundor}/`, external: true };

export const layoutOptions = {
  nav: {
    title: (
      <>
        <img src={logo} alt="Soundor Prism" height={36} className="h-9 w-auto dark:hidden" />
        <img
          src={logoDark}
          alt="Soundor Prism"
          height={36}
          className="hidden h-9 w-auto dark:block"
        />
      </>
    ),
  },
  githubUrl: repository,
  links: [
    { text: 'Changelog', url: '/docs/changelog' },
    {
      ...soundorLink,
      text: (
        <span className="inline-flex items-center gap-1">
          {soundorLink.text}
          <ExternalLink aria-hidden className="size-3" />
        </span>
      ),
    },
  ],
} satisfies BaseLayoutProps;
