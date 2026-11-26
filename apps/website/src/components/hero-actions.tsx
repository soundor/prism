import { Link } from '@tanstack/react-router';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { ArrowRight, Download } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { platforms, released, version } from '../release';

const subscribe = () => () => {};

function visitorPlatform() {
  const { userAgent } = navigator;
  if (/Android|CrOS|iPhone|iPad|iPod/.test(userAgent)) return null;
  if (/Windows/.test(userAgent)) return 'windows';
  if (/Linux|X11/.test(userAgent)) return 'linux';
  return null;
}

export function HeroActions() {
  const visitor = useSyncExternalStore(subscribe, visitorPlatform, () => null);
  const platform = released && platforms.find((entry) => entry.id === visitor);
  const primary = buttonVariants({ variant: 'primary', className: 'gap-1.5 px-4 py-2.5' });
  const outline = buttonVariants({ variant: 'outline', className: 'px-4 py-2.5' });

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        {platform ? (
          <a className={primary} href={platform.url}>
            <Download aria-hidden className="size-4" /> Download for {platform.name}
          </a>
        ) : (
          <a className={primary} href="#download">
            {released ? `Download ${version}` : 'Download'}{' '}
            <ArrowRight aria-hidden className="size-4" />
          </a>
        )}
        <Link className={outline} to="/docs/$" params={{ _splat: '' }}>
          Read the docs
        </Link>
      </div>
      <p className="min-h-5 text-sm text-fd-muted-foreground">
        {platform && (
          <>
            Version {version} for {platform.name} ({platform.arch}).{' '}
            <a className="underline" href="#download">
              Other downloads
            </a>
          </>
        )}
      </p>
    </div>
  );
}
