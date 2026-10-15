# Implementation Plan: Dashboard Security Status Synchronization

## Context

The dashboard home component currently displays a static 5-item security status grid. The user requests:
1. Remove the "Evidencias almacenadas" (stored evidence) item
2. Synchronize the remaining 4 security items with real backend/mobile data
3. Display visual indicators: green circle (all OK), yellow circle (1 missing), red circle (2+ missing or < 2 contacts)
4. Connect contact count to the backend
5. Validate 4 security requirements: contacts (≥2), activation method configured, location active, notifications active

## Architecture Decisions

**Design Decision 1: Service Layer**
Create a dedicated `UserSecurityStatusService` that aggregates data from multiple sources (contacts, device settings, browser permissions) and computes the overall security status. This keeps the home component focused on presentation and makes the security logic reusable across other dashboard views.

**Design Decision 2: Browser Permission Checks**
Use the Browser Permissions API (`navigator.permissions.query`) for geolocation and the Notifications API (`Notification.permission`) to check if permissions are granted. These are client-side checks that reflect the user's browser state.

**Design Decision 3: Activation Method Source**
The activation method is stored in the `AlertActivationSetting` table linked to the device. Since the user has one or more devices, we'll check if ANY device has at least one enabled activation method via `GET /api/devices/user` which returns `UserDevice[]`. The backend already provides device information; we'll need to extend the device service to fetch activation settings or infer from existing device data.

**Design Decision 4: Status Color Rules**
- GREEN (`--color-exito`): All 4 requirements met AND ≥ 2 contacts
- YELLOW (`--color-advertencia`): Exactly 1 requirement missing (still has ≥ 2 contacts)
- RED (`--color-peligro`): 2+ requirements missing OR < 2 contacts

---

## Implementation Plan

- [ ] 1. **Create the security status model**
      Define TypeScript interfaces for security status, security requirements, and status color variants.
      Files: `src/app/core/models/security-status.model.ts` (new)
      Verify: Run `npm run build` and confirm no TypeScript errors.

- [ ] 2. **Create the UserSecurityStatusService**
      Implement service with methods: `getSecurityStatus(userId: number): Observable<SecurityStatus>`, `checkGeolocationPermission(): Promise<boolean>`, `checkNotificationPermission(): boolean`. Service should inject `EmergencyContactService`, `DeviceService`, and `AuthService`. Aggregate data: fetch contacts count, check if user has devices with activation methods configured, check browser permissions for location and notifications. Return computed status with color variant and list of 4 items with their individual states.
      Files: `src/app/core/services/user-security-status.service.ts` (new)
      Verify: Run `npm run build` and confirm service compiles without errors.

- [ ] 3. **Update home component TypeScript**
      Remove the 5th item ("Evidencias almacenadas") from `estadoSeguridad` array. Inject `UserSecurityStatusService` and `AuthService`. In `ngOnInit` (add if not present), subscribe to `authService.currentUser$`, then call `securityStatusService.getSecurityStatus(user.id)` and update `estadoSeguridad` array with real data. Add computed properties: `securityStatusColor: 'seguro' | 'advertencia' | 'critico'` and `securityStatusText: string` based on the service response. Change `estadoSeguridad` from hardcoded array to a property populated from the service.
      Files: `src/app/features/dashboard/home/home.ts`
      Verify: Run `npm run build` and confirm no TypeScript errors.

- [ ] 4. **Update home component HTML**
      Modify the "Estado de tu seguridad" panel header to display dynamic status text and color indicator. Change `estadoSeguridad` grid from `repeat(5, 1fr)` to `repeat(4, 1fr)` via CSS class. Update each security item to use `[ngClass]` to apply color variants to the check circle: `.home-seguridad-item__check--exito` (green, default), `.home-seguridad-item__check--advertencia` (yellow), `.home-seguridad-item__check--peligro` (red). Add a status badge or icon next to "Estado de tu seguridad" title showing overall status color.
      Files: `src/app/features/dashboard/home/home.html`
      Verify: Run `npm start`, navigate to `/dashboard`, and visually confirm the security status panel displays 4 items with correct data.

- [ ] 5. **Update home component styles**
      Change `.home-seguridad-grid` from `grid-template-columns: repeat(5, 1fr)` to `repeat(4, 1fr)`. Add color variant classes for the security check circle: `.home-seguridad-item__check--advertencia` with `background: var(--color-advertencia)` and `.home-seguridad-item__check--peligro` with `background: var(--color-peligro)`. Add styles for overall status indicator if needed (e.g., `.home-panel__status-badge` with color variants).
      Files: `src/app/features/dashboard/home/home.scss`
      Verify: Run `npm start`, inspect in browser DevTools, and confirm grid is 4 columns and color classes apply correctly.

- [ ] 6. **Handle loading and error states**
      In home component, add loading indicator while fetching security status. Add error handling for when the service call fails (e.g., backend unavailable). Display a fallback message or default "unknown" status if data cannot be loaded. Consider using RxJS operators like `startWith`, `catchError`, and `finalize` to manage loading states.
      Files: `src/app/features/dashboard/home/home.ts`, `src/app/features/dashboard/home/home.html`
      Verify: Run `npm start`, temporarily disconnect from backend or simulate error, and confirm graceful error handling.

- [ ] 7. **Add reactive updates**
      Ensure that if the user adds/removes contacts or changes device settings elsewhere in the app, the security status updates automatically. Consider making `UserSecurityStatusService` maintain a `BehaviorSubject` that can be refreshed, or use Angular's built-in change detection. Add a "Refresh" button or auto-refresh logic if needed.
      Files: `src/app/core/services/user-security-status.service.ts`, `src/app/features/dashboard/home/home.ts`
      Verify: Navigate to emergency contacts, add/remove a contact, return to dashboard, and confirm security status updates reflect the change.

- [ ] 8. **Test the complete integration**
      Manually test all 4 security requirements: (1) Add/remove contacts to cross the 2-contact threshold, (2) Toggle browser location permission and refresh, (3) Toggle browser notification permission and refresh, (4) Ensure activation method is shown as configured if user has a registered device. Verify color changes from green → yellow → red as requirements are unmet. Check responsive design on mobile viewport.
      Files: All modified files
      Verify: Run `npm run build` to confirm production build succeeds. Run `npm start` and complete manual test scenarios, confirming all security status logic works as expected.

---

## Notes

- **Backend Endpoint for Activation Method**: The current `GET /api/devices/user` returns `UserDevice[]` with fields like `gpsStatus`, `status`, etc. It does NOT currently return activation settings. Two options: (a) Extend the backend endpoint to include activation settings in the response, OR (b) Make a separate call to fetch activation settings by device ID. For simplicity, we assume if the user has at least one active device, they have an activation method configured. This is a simplification; if more precise logic is needed, the backend should be extended first.

- **Browser Permissions**: Geolocation and Notifications are browser-level permissions. The checks are asynchronous and may prompt the user. Handle permission states: 'granted', 'denied', 'prompt'. If 'prompt', treat as not configured.

- **Contacts Minimum**: The requirement is ≥ 2 contacts. If the user has 0 or 1 contact, status is RED regardless of other requirements.

- **CSS Variables**: The styles already define `--color-exito`, `--color-advertencia`, `--color-peligro`. Use these consistently for the color variants.

- **No Tests Yet**: The project uses Vitest but has no existing test files. Testing is recommended but not blocking; focus on functionality first. If time permits, add unit tests for `UserSecurityStatusService` using Vitest.

- **Commit Message**: All commits should be in English following the project convention (e.g., `feat(dashboard): sync security status with backend data`).
