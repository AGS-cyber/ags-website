# Deployment

## Prerequisites

Both must exit 0 before anything ships:

```bash
npm run build
npm run lint
```

There are **no environment variables**. All content is read from disk at build time, so a
successful local build is a successful deploy.

## Vercel

1. Push the repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import it.
3. The framework auto-detects as **Next.js**. Default build command and output settings are
   correct as-is — do not override them.
4. Deploy.

## Domain

Once the first deployment succeeds:

1. **Project → Settings → Domains**, add `allgamesuck.com` (and `www.allgamesuck.com` if you
   want it).
2. Vercel then shows the exact DNS records to apply. Either:
   - point your registrar's **nameservers** at Vercel, or
   - keep DNS where it is and add the records Vercel lists — an **A** record for the apex and a
     **CNAME** for `www`.
3. Use whatever values the Domains screen gives you. They are authoritative; anything written
   here would go stale.
4. Wait for DNS to propagate. Vercel issues the TLS certificate automatically once it resolves.

## After deploying

`metadataBase` in `app/layout.tsx` is hardcoded to `https://allgamesuck.com`. If the site ever
moves, that needs updating or Open Graph and Twitter card URLs will point at the wrong host.

## Local preview of the production build

```bash
npm run build
npm start
```

Worth doing before a deploy when the change touches the scene or anything static-generated —
`npm run dev` and the production build differ in timing and in how aggressively things are
prerendered.
