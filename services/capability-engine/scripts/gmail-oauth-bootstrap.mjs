#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const credentialsPath = process.argv[2];
if (!credentialsPath) {
  throw new Error(
    'Usage: node services/capability-engine/scripts/gmail-oauth-bootstrap.mjs /path/to/desktop-oauth.json'
  );
}

const parsed = JSON.parse(await readFile(credentialsPath, 'utf8'));
const installed = parsed.installed;
if (!installed?.client_id || !installed?.client_secret) {
  throw new Error('Expected a Google Desktop OAuth credentials JSON with an installed client.');
}

const state = randomBytes(24).toString('hex');
const scopes = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
];

let resolveCode;
let rejectCode;
const codePromise = new Promise((resolve, reject) => {
  resolveCode = resolve;
  rejectCode = reject;
});

const server = createServer((request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (url.pathname !== '/oauth2/callback') {
      response.writeHead(404).end('Not found');
      return;
    }
    if (url.searchParams.get('state') !== state) {
      response.writeHead(400).end('OAuth state mismatch');
      rejectCode(new Error('OAuth state mismatch.'));
      return;
    }
    const error = url.searchParams.get('error');
    if (error) {
      response.writeHead(400).end('OAuth authorization failed. You may close this window.');
      rejectCode(new Error(`Google OAuth authorization failed: ${error}`));
      return;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      response.writeHead(400).end('Missing authorization code');
      rejectCode(new Error('Google OAuth callback did not contain an authorization code.'));
      return;
    }
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('MarkOrbit Gmail OAuth authorization received. You may close this window.');
    resolveCode(code);
  } catch (error) {
    rejectCode(error);
  }
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') {
  throw new Error('Could not allocate local OAuth callback port.');
}
const redirectUri = `http://127.0.0.1:${address.port}/oauth2/callback`;
const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authorizationUrl.search = new URLSearchParams({
  client_id: installed.client_id,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: scopes.join(' '),
  access_type: 'offline',
  prompt: 'consent',
  state
}).toString();

process.stdout.write(
  '\nOpen this URL in your browser and authorize the approved Gmail test account:\n\n'
);
process.stdout.write(`${authorizationUrl.toString()}\n\n`);

try {
  const code = await codePromise;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: installed.client_id,
      client_secret: installed.client_secret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    }).toString()
  });
  if (!tokenResponse.ok) {
    throw new Error(`Google OAuth token exchange failed with HTTP ${tokenResponse.status}.`);
  }
  const token = await tokenResponse.json();
  if (typeof token.refresh_token !== 'string' || !token.refresh_token) {
    throw new Error(
      'Google did not return a refresh_token. Revoke the test app grant if necessary and rerun with consent.'
    );
  }
  process.stdout.write(
    '\nAuthorization succeeded. Store the following value in your local secret manager only.\n'
  );
  process.stdout.write('Do not commit it, paste it into GitHub, or send it in chat.\n\n');
  process.stdout.write(`MO_MANAGED_COMMUNICATION_GMAIL_REFRESH_TOKEN=${token.refresh_token}\n`);
} finally {
  server.close();
}
