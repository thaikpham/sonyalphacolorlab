/**
 * Mints the `REDDIT_REFRESH_TOKEN` the server needs to read r/<SUBREDDIT>.
 *
 * Run once, by hand:
 *
 *   1. https://www.reddit.com/prefs/apps → "create another app"
 *      type: **web app**  ·  redirect uri: http://localhost:8080/callback
 *   2. put the id and secret in .env.local as REDDIT_CLIENT_ID / _SECRET
 *   3. npm run reddit:token   → open the printed URL, press Allow
 *   4. paste the printed refresh token into .env.local
 *
 * The target sub is private, so an app-only (`client_credentials`) token is not
 * enough: it authenticates the *app*, which is not a member of the sub and gets
 * a 403. The token this mints belongs to whichever account presses Allow, so
 * press it as an account that is a member — u/thaikpham, u/sonysandbox.
 *
 * `duration=permanent` is what makes Reddit return a refresh token at all;
 * without it the response carries a one-hour access token and nothing else.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = ['identity', 'read', 'submit'];

const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.local first.');
  process.exit(1);
}

/* Reddit echoes `state` back on the callback. Comparing it is what stops a
   stray request to localhost from handing this script someone else's code. */
const state = randomBytes(16).toString('hex');

const authUrl =
  'https://www.reddit.com/api/v1/authorize?' +
  new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    state,
    redirect_uri: REDIRECT_URI,
    duration: 'permanent',
    scope: SCOPES.join(' '),
  }).toString();

console.log('\nOpen this URL and press Allow, signed in as an account that is a member of the sub:\n');
console.log(authUrl);
console.log(`\nWaiting for the callback on ${REDIRECT_URI} …\n`);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }

  const reply = (message: string) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(message);
  };

  const error = url.searchParams.get('error');
  if (error) {
    reply(`Reddit returned: ${error}. You can close this tab.`);
    console.error(`\nReddit refused: ${error}`);
    server.close();
    process.exitCode = 1;
    return;
  }

  if (url.searchParams.get('state') !== state) {
    reply('State mismatch — ignored. You can close this tab.');
    console.error('\nState mismatch: the callback did not come from the URL this script printed.');
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    reply('No code in the callback. You can close this tab.');
    return;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'web:alpha-colorlab:v2.0 (token bootstrap)',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = (await tokenRes.json()) as { refresh_token?: string; error?: string };

  if (!data.refresh_token) {
    reply('No refresh token returned. Check the terminal.');
    console.error('\nReddit did not return a refresh token:', data);
    server.close();
    process.exitCode = 1;
    return;
  }

  reply('Refresh token captured. You can close this tab and return to the terminal.');
  console.log('\nAdd this line to .env.local:\n');
  console.log(`REDDIT_REFRESH_TOKEN=${data.refresh_token}\n`);
  server.close();
});

server.listen(PORT);
