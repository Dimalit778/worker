# iPhone Home Screen navigation

Status: the reported Home Screen navigation issue is resolved.

## Configuration

The app has a web app manifest (`src/app/manifest.ts`) with `display: standalone`, `start_url: /` and `scope: /`. Its URLs are relative, so the installed origin (including a LAN IP, port and protocol) is retained. The root layout supplies the standard and Apple web-app-capable metadata on login and authenticated pages.

## Login flow

1. `LoginForm` calls `signIn('credentials', { redirect: false, ... })`; the client does not navigate to the callback URL returned by the server.
2. The form calls `router.push('/')` and `router.refresh()`.
3. The proxy redirects `/` to `/employee`, `/manager` or `/admin` according to the session, building the redirect from the incoming request URL. The root page also uses relative role redirects.

There is no `window.open`, `target="_blank"` or external full-page navigation in this flow. Sign-out uses NextAuth's full-page redirect to its validated `/login` callback, whose canonical base comes from `NEXTAUTH_URL`; keep that setting consistent with the public URL when testing on an iPhone.

## Testing on a device

- Remove the existing Home Screen entry and add it again after changes to the manifest or metadata.
- Use the same hostname/IP, port and protocol throughout: a different origin leaves the installed web app even with `scope: /`.
- Plain HTTP on a LAN IP is not a secure context; trusted HTTPS is needed for secure-context features such as service workers.
- To diagnose again, run in Safari's remote Web Inspector before and after login and compare:

```js
({
  url: location.href,
  origin: location.origin,
  standalone: matchMedia('(display-mode: standalone)').matches,
  appleStandalone: navigator.standalone,
  secureContext: isSecureContext,
  manifest: document.querySelector('link[rel="manifest"]')?.href,
})
```

Safari 26 can launch any site as a web app with "Open as Web App" enabled, even without a manifest, and desktop browsers cannot reproduce the iOS Home Screen container.

References: [Safari 26 Home Screen behavior](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [Apple: web app scope](https://developer.apple.com/videos/play/wwdc2023/10120/), [Apple: standalone metadata](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).
