import { Link } from '@tanstack/react-router';

import { repository, soundor } from '../layout-options';

const link = 'hover:text-fd-foreground focus-visible:text-fd-foreground';

function Legal() {
  return (
    <div className="flex flex-col gap-2 text-xs text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p>
        Prism is licensed under the{' '}
        <a
          className={`underline underline-offset-2 ${link}`}
          href={`${repository}/blob/main/LICENSE`}
        >
          GNU Affero General Public License v3
        </a>
        .
      </p>
      <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
        <a className={link} href={`${soundor}/privacy`}>
          Privacy
        </a>
        <a className={link} href={`${soundor}/brand`}>
          Brand
        </a>
      </nav>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 text-sm text-fd-muted-foreground">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>A free four-band equalizer, built with Soundor.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className={link} to="/docs/$" params={{ _splat: '' }}>
              Docs
            </Link>
            <Link className={link} to="/" hash="download">
              Download
            </Link>
            <Link className={link} to="/docs/$" params={{ _splat: 'changelog' }}>
              Changelog
            </Link>
            <a className={link} href={repository}>
              GitHub
            </a>
            <a className={link} href={`${soundor}/`}>
              Soundor
            </a>
          </nav>
        </div>
        <div className="border-t pt-6">
          <Legal />
        </div>
      </div>
    </footer>
  );
}

export function PageLegal() {
  return (
    <footer className="mt-10 border-t pt-6">
      <Legal />
    </footer>
  );
}
