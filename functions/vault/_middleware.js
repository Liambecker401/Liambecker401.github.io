const COOKIE_NAME = 'vault_session';
const COOKIE_TTL_SECONDS = 300;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const user = env.VAULT_USER;
  const pass = env.VAULT_PASS;

  if (!user || !pass) {
    return new Response('Vault credentials are not configured.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  if (url.searchParams.get('reauth') === '1') {
    return redirectToLogin(url.pathname, true);
  }

  if (url.pathname === '/vault/login') {
    return handleLoginRoute(request, user, pass, url);
  }

  const token = readCookie(request.headers.get('Cookie'), COOKIE_NAME);
  const isAuthenticated = await validateSessionToken(token, user, pass);

  if (!isAuthenticated) {
    return redirectToLogin(url.pathname + url.search);
  }

  const response = await context.next();

  response.headers.set('Cache-Control', 'no-store');

  if (url.pathname.startsWith('/vault/files/')) {
    response.headers.append('Set-Cookie', clearSessionCookie());
  }

  return response;
}

async function handleLoginRoute(request, user, pass, url) {
  if (request.method === 'POST') {
    const formData = await request.formData();
    const suppliedUser = String(formData.get('username') || '');
    const suppliedPass = String(formData.get('password') || '');
    const returnTo = sanitizeReturnTo(String(formData.get('returnTo') || '/vault/'));

    if (suppliedUser === user && suppliedPass === pass) {
      const token = await createSessionToken(user, pass);
      const headers = new Headers({ Location: returnTo });
      headers.append('Set-Cookie', createSessionCookie(token));
      return new Response(null, { status: 302, headers });
    }

    return renderLoginPage({ returnTo, error: 'Invalid username or password.' }, 401);
  }

  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo') || '/vault/');
  return renderLoginPage({ returnTo });
}

function redirectToLogin(returnTo, clearCookie = false) {
  const loginUrl = `/vault/login?returnTo=${encodeURIComponent(sanitizeReturnTo(returnTo))}`;
  const headers = new Headers({ Location: loginUrl });

  if (clearCookie) {
    headers.append('Set-Cookie', clearSessionCookie());
  }

  return new Response(null, { status: 302, headers });
}

function sanitizeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/vault')) {
    return '/vault/';
  }

  return value;
}

function readCookie(cookieHeader, key) {
  if (!cookieHeader) {
    return '';
  }

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.trim().split('=');
    if (name === key) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return '';
}

function createSessionCookie(token) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/vault; HttpOnly; Secure; SameSite=Strict; Max-Age=${COOKIE_TTL_SECONDS}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/vault; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function createSessionToken(username, secret) {
  const expiresAt = Date.now() + COOKIE_TTL_SECONDS * 1000;
  const payload = `${username}:${expiresAt}`;
  const signature = await sign(payload, secret);
  return `${payload}:${signature}`;
}

async function validateSessionToken(token, expectedUser, secret) {
  if (!token) {
    return false;
  }

  const lastSeparator = token.lastIndexOf(':');
  if (lastSeparator === -1) {
    return false;
  }

  const payload = token.slice(0, lastSeparator);
  const signature = token.slice(lastSeparator + 1);
  const [username, expiresAtRaw] = payload.split(':');
  const expiresAt = Number(expiresAtRaw);

  if (username !== expectedUser || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = await sign(payload, secret);
  return signature === expectedSignature;
}

async function sign(value, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
  const bytes = new Uint8Array(signatureBuffer);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function renderLoginPage({ returnTo, error = '' }, status = 200) {
  const safeReturnTo = sanitizeReturnTo(returnTo);
  const errorMarkup = error ? `<p style="color:#b91c1c; margin-top:0;">${error}</p>` : '';

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vault Login</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; background:#f4f7fb; margin:0; color:#111827; }
    main { min-height:100vh; display:grid; place-items:center; padding:1.2rem; }
    .card { width:min(420px, 100%); background:#fff; border:1px solid #d5deea; border-radius:14px; padding:1.3rem; }
    h1 { margin-top:0; font-size:1.4rem; }
    label { display:block; margin-top:.75rem; font-weight:600; }
    input { width:100%; padding:.65rem; border:1px solid #cbd5e1; border-radius:8px; margin-top:.35rem; }
    button { margin-top:1rem; width:100%; border:0; border-radius:8px; padding:.7rem; background:#1d4ed8; color:white; font-weight:600; cursor:pointer; }
    p { color:#475569; }
  </style>
</head>
<body>
  <main>
    <section class="card">
      <h1>Vault Login</h1>
      <p>Sign in to open the protected vault.</p>
      ${errorMarkup}
      <form method="post" action="/vault/login">
        <input type="hidden" name="returnTo" value="${safeReturnTo}" />
        <label for="username">Username</label>
        <input id="username" name="username" autocomplete="username" required />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required />
        <button type="submit">Unlock Vault</button>
      </form>
    </section>
  </main>
</body>
</html>`;

  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
