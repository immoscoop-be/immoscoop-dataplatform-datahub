/** What the server of the web app tells the page: where the services are. */
export interface Config {
  identityUrl: string;
  catalogueUrl: string;
  registryUrl: string;
  /** query, which writes and runs queries over the Resources (TR-SR-16). */
  queryUrl: string;
  /** eda, which keeps the EDA of each Resource and runs its EDA-Probes through query (TR-ED-07). */
  edaUrl: string;
  /** semgraph, the Chart Server: open to everyone, so the page calls it without Access Token. */
  semgraphUrl: string;
  /** The nonce of this page, for the styles the editor of Query adds; the server makes one per page. */
  styleNonce?: string;
  /** uat or prod: a Learning Card still in draft shows everywhere but in prod (DEC-LR-25). */
  environment?: string;
}

/** Reads the configuration the server put in the page (see `src/page.ts` of the server). */
export function readConfig(document: Document): Config {
  const { identity, catalogue, registry, query, eda, semgraph, nonce, environment } = document.documentElement.dataset;
  if (!identity || !catalogue || !registry || !query || !eda || !semgraph) {
    throw new Error('The page lacks its configuration; it must be served by the server of the web app.');
  }
  return { identityUrl: identity, catalogueUrl: catalogue, registryUrl: registry, queryUrl: query, edaUrl: eda, semgraphUrl: semgraph, ...(nonce ? { styleNonce: nonce } : {}), ...(environment ? { environment } : {}) };
}
