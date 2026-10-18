/** What the server of the web app tells the page: where the services are, and the nonce for styles. */
export interface Config {
  identityUrl: string;
  registryUrl: string;
  /** Lets Mantine add its `<style>` elements under the Content-Security-Policy of the page. */
  styleNonce: string;
}

/** Reads the configuration the server put in the page (see `src/page.ts` of the server). */
export function readConfig(document: Document): Config {
  const { identity, registry } = document.documentElement.dataset;
  const nonce = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.nonce;
  if (!identity || !registry || !nonce) {
    throw new Error('The page lacks its configuration; it must be served by the server of the web app.');
  }
  return { identityUrl: identity, registryUrl: registry, styleNonce: nonce };
}
