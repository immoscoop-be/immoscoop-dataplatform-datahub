/** What the server of the web app tells the page: where the services are. */
export interface Config {
  identityUrl: string;
  catalogueUrl: string;
  registryUrl: string;
  /** semgraph, the Chart Server: open to everyone, so the page calls it without Access Token. */
  semgraphUrl: string;
}

/** Reads the configuration the server put in the page (see `src/page.ts` of the server). */
export function readConfig(document: Document): Config {
  const { identity, catalogue, registry, semgraph } = document.documentElement.dataset;
  if (!identity || !catalogue || !registry || !semgraph) {
    throw new Error('The page lacks its configuration; it must be served by the server of the web app.');
  }
  return { identityUrl: identity, catalogueUrl: catalogue, registryUrl: registry, semgraphUrl: semgraph };
}
