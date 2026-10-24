# iPhone Home Screen navigation

## Findings

The app previously had neither a web app manifest nor Apple web app metadata.
The root manifest now declares `display: standalone`, `start_url: /`, and
`scope: /`. Its URLs are relative, so the installed origin (including the LAN
IP, port and protocol) is retained. The root layout supplies both the standard
and Apple web-app-capable metadata on login and authenticated pages.

The successful credentials flow is:

1. `LoginForm` calls `signIn('credentials', { redirect: false, ... })`.
2. NextAuth posts to the current origin's `/api/auth/callback/credentials`.
   Its default callback URL is the current page URL. The client does not
   navigate to the callback URL returned by the server.
3. The form calls `router.push('/')` and `router.refresh()`.
4. The proxy redirects `/` to `/employee`, `/manager`, or `/admin` according
   to the session. Its redirect is constructed from the incoming request URL.
   The root page also uses relative role redirects.

There is no `window.open`, `target="_blank"`, or external full-page navigation
in this login flow. Authentication and session settings are unchanged.
Sign-out separately uses NextAuth's full-page redirect to its validated
`/login` callback; its canonical base comes from `NEXTAUTH_URL`. Keep that
deployment setting consistent with the public URL when testing on an iPhone.

Desktop browser checks with synthetic manager and employee accounts confirmed
successful login and unchanged origin after login on the isolated loopback
server. The manifest was accessible without authentication and after login.
All destination paths are in scope. LAN Host-header checks returned relative
login redirects. A temporary LAN forwarding browser test stalled before React
hydration, so it did not verify the LAN login flow or mobile behavior. The
temporary forwarding server and development allowlist adjustment were removed.

## Confirm on the affected iPhone

The missing configuration is a confirmed defect, but does not establish the
cause of the reported iOS transition. Safari 26 can launch any site as a web
app with "Open as Web App" enabled, even without a manifest. Desktop browser
checks cannot verify the iOS Home Screen container or its browser controls.

Remove the existing Home Screen entry and add it again from the updated app,
using the same IP, port, and protocol throughout. Check login, successful login,
refresh, and relaunch. In Safari's remote Web Inspector, run this before and
after login:

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

Expect the same origin and standalone mode to remain enabled. If the controls
still appear, capture both snapshots and the document redirect chain. A
different hostname, IP, port, or protocol leaves the installed origin even
with `scope: /`; a manifest cannot include another origin. If the origin stays
the same, investigate the device's iOS behavior and installed app state rather
than changing authentication speculatively. HTTP on a LAN IP is not a secure
context; trusted HTTPS is needed for secure-context features such as service
workers, but adding a service worker or CSS cannot remove Safari controls.

References:

- [Safari 26 Home Screen behavior](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [Apple: web app scope and out-of-scope navigation](https://developer.apple.com/videos/play/wwdc2023/10120/)
- [Apple: standalone metadata and navigator.standalone](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
