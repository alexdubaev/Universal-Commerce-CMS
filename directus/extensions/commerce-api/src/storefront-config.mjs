const noStore = { 'Cache-Control': 'no-store' };

export function normalizeStorefrontBaseUrl(value) {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/u.test(value)) return null;
  if (value.includes('?') || value.includes('#')) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.pathname = `${url.pathname.replace(/\/+$/u, '')}/`;
    return url.toString();
  } catch {
    return null;
  }
}

export function createStorefrontConfigHandler(context) {
  const env = context.env ?? process.env;
  return (req, res) => {
    if (typeof req?.accountability?.user !== 'string' || !req.accountability.user) {
      return res.status(403).set(noStore).json({ error: 'forbidden' });
    }
    return res.set(noStore).json({
      data: { public_base_url: normalizeStorefrontBaseUrl(env.COMMERCE_STOREFRONT_URL) },
    });
  };
}

export function registerStorefrontConfig(router, context) {
  router.get('/config/storefront', createStorefrontConfigHandler(context));
}
