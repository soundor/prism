import { createFileRoute } from '@tanstack/react-router';
import { createFromSource } from 'fumadocs-core/search/server';

import { source } from '../source';

const search = createFromSource(source, { language: 'english' });

export const Route = createFileRoute('/search-index.json')({
  server: { handlers: { GET: () => search.staticGET() } },
});
