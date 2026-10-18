/**
 * The first page of the web app: it signs the User in, shows who identity says they are, and lets
 * the Data Team search the dbt projects in registry. The real interface comes later.
 */
export function pageHtml(identityUrl: string, registryUrl: string): string {
  return `<!doctype html>
<html lang="en" data-identity="${escapeAttribute(identityUrl)}" data-registry="${escapeAttribute(registryUrl)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Data Hub</title>
  <link rel="stylesheet" href="/app.css">
  <script type="module" src="/app.js"></script>
</head>
<body>
  <main>
    <h1>Data Hub</h1>
    <p id="status">Checking whether you are signed in…</p>
    <section id="signed-out" hidden>
      <p><a class="button" href="/auth/login">Sign in with Google</a></p>
      <p id="error" class="error" hidden></p>
    </section>
    <section id="signed-in" hidden>
      <dl>
        <dt>Name</dt><dd id="name"></dd>
        <dt>Email</dt><dd id="email"></dd>
        <dt>Roles</dt><dd id="roles"></dd>
        <dt>Groups</dt><dd id="groups"></dd>
      </dl>
      <p><button id="sign-out" type="button">Sign out</button></p>
    </section>
    <section id="registry" hidden>
      <h2>The dbt projects</h2>
      <ul id="projects" class="muted"></ul>
      <form id="search-form" role="search">
        <input id="search" type="search" placeholder="A model, source, column or description" autocomplete="off" required>
        <button type="submit">Search</button>
      </form>
      <p id="search-status" class="muted"></p>
      <ul id="results" class="results"></ul>
      <article id="node" hidden>
        <h3 id="node-name"></h3>
        <p id="node-meta" class="muted"></p>
        <p id="node-description"></p>
        <h4>Columns</h4>
        <table><thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead><tbody id="node-columns"></tbody></table>
        <h4>Tests</h4>
        <ul id="node-tests"></ul>
        <div class="lineage">
          <div><h4>Upstream</h4><ul id="upstream"></ul></div>
          <div><h4>Downstream</h4><ul id="downstream"></ul></div>
        </div>
      </article>
    </section>
    <p id="registry-closed" class="muted" hidden>Searching the dbt projects is for the Data Team for now.</p>
  </main>
</body>
</html>
`;
}

export const pageScript = `const identity = document.documentElement.dataset.identity;
const registry = document.documentElement.dataset.registry;
const $ = (id) => document.getElementById(id);
const problems = {
  access_denied: 'Only active accounts of the company can sign in.',
  server_error: 'Data Hub could not check your account with Google. Please try again in a minute.',
  temporarily_unavailable: 'Data Hub could not check your account with Google. Please try again in a minute.',
  expired: 'This sign-in took too long or was started in another window. Please try again.',
  refused: 'identity did not accept this sign-in. Please try again.',
};
const problem = (code) => problems[code] ?? 'Signing in did not work (' + code + ').';

// The server of the web app exchanges the Refresh Token in its cookie for an Access Token, which is
// kept until shortly before it expires. If the renewal was refused, another tab may have renewed at
// the same moment and changed the cookie: try once more. Without a session, there is nothing to try.
let cached = null;
async function accessToken() {
  if (cached && Date.now() < cached.until) {
    return cached.token;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('/auth/token', { method: 'POST' });
    if (response.ok) {
      const body = await response.json();
      cached = { token: body.access_token, until: Date.now() + (body.expires_in - 60) * 1000 };
      return cached.token;
    }
    const { error } = await response.json();
    if (error === 'temporarily_unavailable') {
      throw new Error(error);
    }
    if (error !== 'renewal_refused') {
      return null;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function show() {
  let token;
  try {
    token = await accessToken();
  } catch (failure) {
    $('status').textContent = problem(failure.message);
    return;
  }
  if (!token) {
    $('status').textContent = 'You are not signed in.';
    const error = new URLSearchParams(location.search).get('error');
    if (error) {
      $('error').textContent = problem(error);
      $('error').hidden = false;
    }
    $('signed-out').hidden = false;
    return;
  }
  const response = await fetch(identity + '/me', { headers: { authorization: 'Bearer ' + token } });
  if (!response.ok) {
    $('status').textContent = 'identity did not accept the Access Token (' + response.status + ').';
    return;
  }
  const me = await response.json();
  $('status').textContent = 'You are signed in. identity knows you as:';
  $('name').textContent = me.name;
  $('email').textContent = me.email;
  $('roles').textContent = me.roles.length ? me.roles.join(', ') : 'none';
  $('groups').textContent = me.groups.length ? me.groups.join(', ') : 'none';
  $('signed-in').hidden = false;
  if (me.roles.includes('datateam')) {
    $('registry').hidden = false;
    showProjects();
    if (location.hash.length > 1) {
      showNode(decodeURIComponent(location.hash.slice(1)));
    }
  } else {
    $('registry-closed').hidden = false;
  }
}

$('sign-out').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  location.replace('/');
});

// ---- registry: the dbt projects, for the Data Team ----

async function fromRegistry(path) {
  const token = await accessToken();
  if (!token) {
    location.replace('/');
    throw new Error('signed out');
  }
  const response = await fetch(registry + path, { headers: { authorization: 'Bearer ' + token } });
  if (!response.ok) {
    throw new Error('registry answered ' + response.status);
  }
  return response.json();
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) {
    node.textContent = text;
  }
  if (className) {
    node.className = className;
  }
  return node;
}

/** A clickable name that opens a Node; its ID goes in the address, so back and forward work. */
function nodeLink(node) {
  const link = element('a', node.name);
  link.href = '#' + encodeURIComponent(node.uniqueId);
  return link;
}

function describeNode(node) {
  return node.resourceType + ' in ' + (node.projectName ?? node.projectId);
}

async function showProjects() {
  try {
    const { projects } = await fromRegistry('/projects');
    $('projects').replaceChildren(
      ...projects.map((project) =>
        element(
          'li',
          (project.name ?? project.projectId) + ': ' +
            (project.runId ? 'run ' + project.runId + ', ' + project.nodeCount + ' Nodes, processed ' + new Date(project.processedAt).toLocaleString() : 'nothing processed yet'),
        ),
      ),
    );
    if (projects.length === 0) {
      $('projects').replaceChildren(element('li', 'No run of a Source Job has come in yet.'));
    }
  } catch (failure) {
    $('projects').replaceChildren(element('li', 'registry did not answer: ' + failure.message));
  }
}

$('search-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = $('search').value.trim();
  if (!query) {
    return;
  }
  $('search-status').textContent = 'Searching…';
  try {
    const { nodes } = await fromRegistry('/nodes?q=' + encodeURIComponent(query));
    $('search-status').textContent = nodes.length ? nodes.length + ' found' : 'Nothing found for ' + query + '.';
    $('results').replaceChildren(
      ...nodes.map((node) => {
        const item = element('li');
        item.append(nodeLink(node), element('span', describeNode(node), 'muted'));
        if (node.description) {
          item.append(element('p', node.description.length > 200 ? node.description.slice(0, 200) + '…' : node.description));
        }
        if (node.matchedColumns.length) {
          item.append(element('p', 'Columns: ' + node.matchedColumns.join(', '), 'muted'));
        }
        return item;
      }),
    );
  } catch (failure) {
    $('search-status').textContent = 'The search did not work: ' + failure.message;
  }
});

function lineageList(target, lineage) {
  const others = lineage.nodes.filter((node) => node.distance > 0);
  if (others.length === 0) {
    target.replaceChildren(element('li', 'Nothing', 'muted'));
    return;
  }
  target.replaceChildren(
    ...others.map((node) => {
      const item = element('li');
      item.append(element('span', node.distance + ' · ', 'muted'), nodeLink(node), element('span', describeNode(node), 'muted'));
      return item;
    }),
  );
  if (lineage.truncated) {
    target.append(element('li', 'and more…', 'muted'));
  }
}

async function showNode(uniqueId) {
  try {
    const id = encodeURIComponent(uniqueId);
    const [node, upstream, downstream] = await Promise.all([
      fromRegistry('/nodes/' + id),
      fromRegistry('/nodes/' + id + '/lineage?direction=upstream'),
      fromRegistry('/nodes/' + id + '/lineage?direction=downstream'),
    ]);
    $('node-name').textContent = node.name;
    $('node-meta').textContent = describeNode(node) + (node.relation ? ' · ' + node.relation : '') + (node.materialized ? ' · ' + node.materialized : '');
    $('node-description').textContent = node.description || 'No description.';
    $('node-columns').replaceChildren(
      ...node.columns.map((column) => {
        const row = element('tr');
        row.append(element('td', column.name), element('td', column.dataType ?? ''), element('td', column.description));
        return row;
      }),
    );
    $('node-tests').replaceChildren(
      ...(node.tests.length
        ? node.tests.map((test) =>
            element('li', test.name + (test.columnName ? ' on ' + test.columnName : '') + (test.targetColumn ? ' → ' + test.targetColumn : '') + (test.severity ? ' (' + test.severity + ')' : '')),
          )
        : [element('li', 'None', 'muted')]),
    );
    lineageList($('upstream'), upstream);
    lineageList($('downstream'), downstream);
    $('node').hidden = false;
    $('node').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (failure) {
    $('search-status').textContent = 'This Node could not be read: ' + failure.message;
  }
}

window.addEventListener('hashchange', () => {
  if (location.hash.length > 1 && !$('registry').hidden) {
    showNode(decodeURIComponent(location.hash.slice(1)));
  }
});

show();
`;

export const pageStyle = `body { font-family: system-ui, sans-serif; margin: 0; background: #fff; color: #1a1a1a; }
main { max-width: 56rem; margin: 3rem auto; padding: 0 1rem; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1.5rem; }
dt { font-weight: 600; }
dd { margin: 0; overflow-wrap: anywhere; }
.button, button { display: inline-block; padding: 0.6rem 1rem; border: 1px solid #1a1a1a; border-radius: 0.4rem; background: #1a1a1a; color: #fff; text-decoration: none; font: inherit; cursor: pointer; }
.error { color: #b00020; }
.muted { color: #666; }
h2 { margin-top: 2.5rem; }
form { display: flex; gap: 0.5rem; }
input[type=search] { flex: 1; padding: 0.6rem; font: inherit; border: 1px solid #999; border-radius: 0.4rem; }
.results { list-style: none; padding: 0; }
.results li { padding: 0.6rem 0; border-bottom: 1px solid #ddd; }
.results p { margin: 0.25rem 0 0; }
li .muted { margin-left: 0.5rem; }
a { color: inherit; font-weight: 600; }
table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th, td { text-align: left; padding: 0.3rem 0.5rem; border-bottom: 1px solid #ddd; vertical-align: top; overflow-wrap: anywhere; }
.lineage { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
@media (max-width: 40rem) { .lineage { grid-template-columns: 1fr; } }
@media (prefers-color-scheme: dark) {
  body { background: #121212; color: #eee; }
  .button, button { background: #eee; color: #121212; border-color: #eee; }
  .error { color: #ff6b6b; }
  .muted { color: #aaa; }
  input[type=search] { background: #1e1e1e; color: #eee; border-color: #555; }
  .results li, th, td { border-color: #333; }
}
`;

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
