/**
 * The first page of the web app: it signs the User in and shows who identity says they are. The
 * real interface comes later; this proves the sign-in in a browser.
 */
export function pageHtml(identityUrl: string): string {
  return `<!doctype html>
<html lang="en" data-identity="${escapeAttribute(identityUrl)}">
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
  </main>
</body>
</html>
`;
}

export const pageScript = `const identity = document.documentElement.dataset.identity;
const $ = (id) => document.getElementById(id);
const problems = {
  access_denied: 'Only active accounts of the company can sign in.',
  server_error: 'Data Hub could not check your account with Google. Please try again in a minute.',
  temporarily_unavailable: 'Data Hub could not check your account with Google. Please try again in a minute.',
  expired: 'This sign-in took too long or was started in another window. Please try again.',
  refused: 'identity did not accept this sign-in. Please try again.',
};
const problem = (code) => problems[code] ?? 'Signing in did not work (' + code + ').';

// The server of the web app exchanges the Refresh Token in its cookie for an Access Token. If the
// renewal was refused, another tab may have renewed at the same moment and changed the cookie:
// try once more. Without a session at all, there is nothing to try.
async function accessToken() {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('/auth/token', { method: 'POST' });
    if (response.ok) {
      return (await response.json()).access_token;
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
}

$('sign-out').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  location.replace('/');
});

show();
`;

export const pageStyle = `body { font-family: system-ui, sans-serif; margin: 0; background: #fff; color: #1a1a1a; }
main { max-width: 40rem; margin: 3rem auto; padding: 0 1rem; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1.5rem; }
dt { font-weight: 600; }
dd { margin: 0; overflow-wrap: anywhere; }
.button, button { display: inline-block; padding: 0.6rem 1rem; border: 1px solid #1a1a1a; border-radius: 0.4rem; background: #1a1a1a; color: #fff; text-decoration: none; font: inherit; cursor: pointer; }
.error { color: #b00020; }
@media (prefers-color-scheme: dark) {
  body { background: #121212; color: #eee; }
  .button, button { background: #eee; color: #121212; border-color: #eee; }
  .error { color: #ff6b6b; }
}
`;

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}
