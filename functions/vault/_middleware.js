export async function onRequest(context) {
      const authHeader = context.request.headers.get('Authorization');
      const user = context.env.VAULT_USER;
      const pass = context.env.VAULT_PASS;
    
      if (!user || !pass) {
        return new Response('Vault credentials are not configured.', {
          status: 500,
          headers: { 'content-type': 'text/plain; charset=utf-8' }
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
    
      return context.next();
    }
    
    function unauthorized() {
      return new Response('Authentication required.', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Vault"',
          'content-type': 'text/plain; charset=utf-8'
        }
      });
    }
    
