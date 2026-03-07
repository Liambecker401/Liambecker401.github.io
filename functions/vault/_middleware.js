export async function onRequest(context) {
  const url = new URL(context.request.url);
  const authHeader = context.request.headers.get('Authorization');
  const user = context.env.VAULT_USER;
  const pass = context.env.VAULT_PASS;
  const hasReauthCookie = context.request.headers.get('Cookie')?.includes('vault_reauth=1');

  if (!user || !pass) {
    return new Response('Vault credentials are not configured.', {
      status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8' }
    });
  }

  if (url.searchParams.get('reauth') === '1' && !hasReauthCookie) {
    return unauthorized({
      realm: `Vault-${Date.now()}`,
      setCookie: 'vault_reauth=1; Max-Age=30; Path=/vault; HttpOnly; SameSite=Lax; Secure'
    });
  }

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorized();
  }

  const encoded = authHeader.slice(6);
  let decoded = '';

  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return unauthorized();
  }

  const suppliedUser = decoded.slice(0, separatorIndex);
  const suppliedPass = decoded.slice(separatorIndex + 1);

  if (suppliedUser !== user || suppliedPass !== pass) {
    return unauthorized();
  }

  if (url.searchParams.get('reauth') === '1') {
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/vault/',
        'Set-Cookie': 'vault_reauth=deleted; Max-Age=0; Path=/vault; HttpOnly; SameSite=Lax; Secure'
      }
    });
  }

  return context.next();
}

function unauthorized(options = {}) {
  const headers = {
    'WWW-Authenticate': `Basic realm="${options.realm || 'Vault'}"`,
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store'
  };

  if (options.setCookie) {
    headers['Set-Cookie'] = options.setCookie;
  }

  return new Response('Authentication required.', {
    status: 401,
    headers
  });
}
