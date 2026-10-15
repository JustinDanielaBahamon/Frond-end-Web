# Device Status Implementation

New diagnostic panel for the Alerta Mujer web app that surfaces device permissions, service status, browser capabilities, and critical app features. The implementation uses Angular signals and standalone components, following the project's recent patterns. The panel includes functionality tests, activity logging, and quick actions.

**Watch for:** Private SDK access for notifications (confirmed), permissions API unavailability handling falls back properly but could be clearer in the UI (confirmed), activity log persists across sessions which could leak info across user accounts (likely), test connectivity uses external endpoint without fallback (confirmed).

**Verdict**: NEEDS_CHANGES

## High-level view

The activity log writes to localStorage without scoping to user ID, which means logs persist across different user sessions on the same browser. The permissions service returns 'unavailable' for unsupported APIs, but the UI doesn't clarify whether this means the feature is broken or just the query mechanism. The notification test uses `new Notification()` which fails on mobile Safari and Android WebView even when permission is granted. The connectivity test fetches google.com/favicon.ico without fallback, so it fails in airgapped or restricted networks. The critical features check reads `auth_token` from localStorage but doesn't validate expiry, so expired sessions show as active. Accessibility attributes are missing from icon-only buttons throughout the template.

<details>
<summary>Issues (7)</summary>

1. **Notification constructor access** — `new Notification()` in `testNotifications()` accesses a private API that may fail on iOS/Android browsers. Wrap in try-catch and fall back to a permissions-only check.
2. **Activity log cross-user leak** — Activity logs are stored in localStorage without user scoping, so logs from one user appear for another on shared devices. Prefix keys with user ID or clear on logout.
3. **Permissions unavailable state unclear** — When permissions API is unsupported, the UI shows "No disponible" but doesn't explain what this means or whether functionality still works. Add tooltip or help text clarifying that geolocation/notifications may still be usable through fallback prompts.
4. **Test connectivity uses external endpoint** — `testConnectivity()` fetches google.com/favicon.ico, which fails in airgapped or restricted networks. Add fallback to backend health endpoint or make the test URL configurable.
5. **No aria-label on interactive buttons** — Most buttons lack aria-label attributes, making them opaque to screen readers. Add descriptive labels to all icon-only buttons and test controls.
6. **Notification test mixing concerns** — `testNotifications()` both requests permissions and shows test notifications in one flow, making it unclear whether the test passed because permissions work or because the notification displayed. Split into two distinct actions.
7. **Critical features session check is naive** — `localStorage.getItem('auth_token')` checks for token existence but doesn't validate expiry, so expired sessions appear as active. Use auth service for proper session validation.

</details>

<details>
<summary>Details</summary>

## Permissions API handling and browser compatibility

The permissions service uses a tiered fallback strategy. For notifications, it checks the Notification API directly since the permissions API doesn't consistently support it across browsers. For other permissions (geolocation, camera, microphone, clipboard), it queries `navigator.permissions` and catches exceptions when unsupported, returning `{ state: 'unavailable', canRequest: false }`. This prevents crashes but surfaces a UI ambiguity: when geolocation permission shows as "unavailable," the user doesn't know whether this means geolocation itself is broken or just the permissions query API. In practice, geolocation can still be requested via `navigator.geolocation.getCurrentPosition()` even when the permissions API returns unavailable.

The notification request path in `testNotifications()` uses `new Notification()` to show a test message after permission is granted. This constructor is not universally available—mobile Safari and some Android WebView contexts don't expose it even when `Notification.permission` is granted. The call should be wrapped in a try-catch block to handle environments where the permission exists but the constructor doesn't.

## Activity log persistence and user isolation

Activity logs write to `localStorage.setItem('device-activity-log', ...)` without any user-scoping prefix. On a shared device where multiple users log in sequentially, logs from one user remain visible to the next. The component loads logs on init via `localStorage.getItem('device-activity-log')` and never clears them except on manual cache clear (which has its own isolation issue). This leaks diagnostic history across accounts.

The clearCache action preserves `['auth_token', 'user_data', 'emergency_contacts']` but applies a substring match (`keysToKeep.some(keep => key.includes(keep))`), which prevents clearing user-scoped keys like `user_123_emergency_contacts`. However, it doesn't clear `device-activity-log` if a user explicitly clears cache, and it doesn't scope the activity log by user in the first place.

## Connectivity test endpoint dependency

The `testConnectivity()` method fetches `https://www.google.com/favicon.ico` with `mode: 'no-cors'` to verify network reachability. This fails in corporate or restricted networks that block external domains, and provides no fallback. The test reports success based on fetch resolution, but `mode: 'no-cors'` prevents reading response status, so a 404 or 500 from the endpoint would still resolve successfully. A more robust approach would be to test the app's own backend health endpoint first, then fall back to an external canary URL.

## Critical features validation

The `loadCriticalFeatures()` method checks session status via `!!localStorage.getItem('auth_token')`, which only confirms a token exists, not whether it's valid or expired. An expired token will show "Sesión: Activa" in the UI. The component should delegate to the auth service for proper session validation, or at minimum check token expiry if the token is a JWT.

## Accessibility gaps

Interactive buttons throughout the template lack `aria-label` attributes. Examples:

- The refresh button in `.device-header` has `title="Refrescar"` but no aria-label.
- Test buttons in `.device-test-grid` show visible text, so they're acceptable, but icon-only buttons like the clear cache action should have labels.
- The action buttons in `.device-actions-grid` combine icons and text, so they're partially accessible, but the icon-first layout may cause screen readers to announce the icon class name before the button text.

The project's other components (evidence, ubicaciones-guardadas, assistance) consistently use `aria-label` on icon-only buttons. This component should follow the same pattern.

## Service status and connection quality

The connection quality check uses `navigator.connection.effectiveType`, which is a Chrome-specific API (also supported in Edge and Opera). When unavailable, it returns "No disponible" rather than falling back to RTT or downlink estimates.

## Screen info and device detection

The device info service uses regex-based user-agent parsing, which is brittle but standard practice for this use case. It covers the major browsers (Chrome, Firefox, Safari, Edge, Opera, Samsung Internet) and platforms (Windows, macOS, Linux, Android, iOS).

## Test method implementation

The notification test combines permission request and test notification in one method. If permission is already granted, it shows a notification immediately. If denied, it alerts the user. If prompt, it requests permission and then shows a notification on grant. This conflates two actions (requesting permission vs. testing notification display) and makes it unclear which part failed if the test doesn't work. Splitting into "Request Permission" and "Show Test Notification" buttons would clarify the flow.

The connectivity test measures fetch roundtrip time and displays it in an alert. The test uses `method: 'HEAD'` and `mode: 'no-cors'`, which prevents reading the response but allows the fetch to complete. As noted earlier, this doesn't distinguish between successful responses and HTTP errors.

## Export diagnostic

The `exportDiagnostic()` method collects all signals and calls `deviceInfoService.getScreenInfo()` to build a JSON snapshot. It creates a blob and triggers a download via a temporary anchor element. The filename includes an ISO timestamp with colons and periods stripped.

The exported JSON includes `deviceInfo`, `permissions`, `services`, `isOnline`, `connectionQuality`, `criticalFeatures`, `activityLog`, and `screenInfo`.

## Responsive design and visual consistency

The SCSS uses the same color variables as home.scss (--color-principal, --color-acento, --color-exito, --color-advertencia, --color-peligro, --color-neutral). The panel layout uses CSS Grid with responsive breakpoints at 1200px, 1000px, 768px, and 640px. The `.device-row--2col` collapses to single-column at 1000px, and the `.device-grid--5col` reduces to 3-column at 1200px and 2-column at 640px.

</details>

---

<details>
<summary>File map</summary>

- **device.ts** — Component implementation with signals, service injection, lifecycle hooks, test methods, activity logging
- **device.html** — Template with 8 sections: header, permissions, services, device info, critical features, activity log, tests, actions
- **device.scss** — Styles using shared color palette, responsive grids, consistent with home.scss
- **device-info.service.ts** — Browser/OS detection, screen info, geolocation wrapper, connection quality
- **permissions.service.ts** — Permissions API queries with fallback for unsupported permissions, notification special-case handling
- **device-info.model.ts** — TypeScript interfaces for all data structures

Full diff: Compare feature branch against main

</details>
