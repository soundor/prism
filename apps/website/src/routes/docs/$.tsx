import { createFileRoute, notFound } from '@tanstack/react-router';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  PageFooter,
} from 'fumadocs-ui/layouts/docs/page';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { ComponentProps } from 'react';

import { Player } from '../../components/player';
import { PageLegal } from '../../components/site-footer';
import { layoutOptions, soundorLink } from '../../layout-options';
import { source } from '../../source';

export const Route = createFileRoute('/docs/$')({
  loader: ({ params }) => {
    const slugs = params._splat?.split('/').filter(Boolean) ?? [];
    const page = source.getPage(slugs);
    if (!page) throw notFound();
    return { slugs, title: page.data.title, description: page.data.description };
  },
  head: ({ loaderData }) => ({
    meta: loaderData && [
      { title: `${loaderData.title} | Soundor Prism` },
      { name: 'description', content: loaderData.description },
    ],
  }),
  component: Documentation,
});

function Documentation() {
  const { slugs, title, description } = Route.useLoaderData();
  const page = source.getPage(slugs)!;
  const Content = page.data.body;
  return (
    <DocsLayout
      {...layoutOptions}
      links={[soundorLink]}
      tree={source.getPageTree()}
      sidebar={{ tabs: false }}
    >
      <DocsPage toc={page.data.toc} slots={{ footer: PageFooterWithLegal }}>
        <DocsTitle>{title}</DocsTitle>
        <DocsDescription>{description}</DocsDescription>
        <DocsBody>
          <Content components={{ ...defaultMdxComponents, Player }} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

function PageFooterWithLegal(props: ComponentProps<typeof PageFooter>) {
  return (
    <>
      <PageFooter {...props} />
      <PageLegal />
    </>
  );
}
