import { Link } from '@tanstack/react-router';

import { repository } from '../layout-options';

export function Downloads() {
  return (
    <p className="text-fd-muted-foreground">
      Prism has no release yet.{' '}
      <Link className="underline" to="/docs/$" params={{ _splat: 'building' }}>
        Build it from source
      </Link>
      , or check{' '}
      <a className="underline" href={`${repository}/releases`}>
        GitHub Releases
      </a>{' '}
      for the first one.
    </p>
  );
}
