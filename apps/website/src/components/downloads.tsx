import { Link } from '@tanstack/react-router';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Download } from 'lucide-react';

import { checksums, platforms, released, releases } from '../release';

export function Downloads({ centered = false }: { readonly centered?: boolean }) {
  const align = centered ? 'text-center' : '';
  if (!released) {
    return (
      <p className={`text-fd-muted-foreground ${align}`}>
        Prism has no release yet.{' '}
        <Link className="underline" to="/docs/$" params={{ _splat: 'building' }}>
          Build it from source
        </Link>
        , or check{' '}
        <a className="underline" href={releases}>
          GitHub Releases
        </a>{' '}
        for the first one.
      </p>
    );
  }
  return (
    <div>
      <Cards className="text-left sm:grid-cols-2">
        {platforms.map((platform) => (
          <Card
            key={platform.id}
            icon={<Download />}
            title={`${platform.name} (${platform.arch})`}
            href={platform.url}
            external
            description={
              <>
                {platform.file}. Unzip it into <code>{platform.folder}</code>, then rescan plugins
                in your DAW.
              </>
            }
          />
        ))}
      </Cards>
      <p className={`mt-4 text-sm text-fd-muted-foreground ${align}`}>
        Check a download against{' '}
        <a className="underline" href={checksums}>
          its checksum
        </a>
        , or see{' '}
        <a className="underline" href={releases}>
          every release
        </a>
        .
      </p>
    </div>
  );
}
