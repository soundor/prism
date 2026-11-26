import { Link } from '@tanstack/react-router';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';

import { repository } from '../layout-options';

export function Downloads() {
  const button = buttonVariants({ variant: 'outline' });
  return (
    <div className="rounded-xl border bg-fd-card p-6 sm:p-8">
      <p className="text-sm text-fd-muted-foreground">
        The first VST3 release hasn’t been published yet. You can build Prism from source or check
        GitHub for releases.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link className={button} to="/docs/$" params={{ _splat: 'building' }}>
          Build from source
        </Link>
        <a className={button} href={`${repository}/releases`}>
          GitHub releases
        </a>
      </div>
    </div>
  );
}
