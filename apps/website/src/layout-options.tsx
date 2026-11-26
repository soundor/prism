import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import logoDark from '../../../assets/brand/svg/soundor-prism-logo-on-dark.svg?url';
import logo from '../../../assets/brand/svg/soundor-prism-logo.svg?url';

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
  githubUrl: 'https://github.com/soundor/prism',
  links: [{ text: 'Soundor', url: 'https://soundor.dev/', external: true }],
} satisfies BaseLayoutProps;
