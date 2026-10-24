# Mobile scrolling audit — 2026-10-24

The profile fix was extended to every authenticated screen: below 768px, the
document owns vertical scrolling and the app shell grows with its content.
Desktop retains its fixed-height shell and internal main scroller.

## Changes

- Removed the profile-only exception from `AppShell`; all roles now share the
  same mobile scroll behavior.
- Let the employee submission list and missing-submission list expand on mobile.
- Removed redundant mobile scrolling inside warning popovers, publication review
  dialogs, employee deactivation results, and the guard picker. Their enclosing
  overlay remains scrollable when necessary.
- Limited mobile dialogs and alert dialogs to the viewport, with their own
  vertical scrolling. Moved the mobile header below the existing modal layer so
  it cannot cover dialog titles or close buttons.
- Allowed the login page to grow on mobile instead of clipping the form in short
  viewports. Desktop login behavior is unchanged.
- Contained the employee-detail grid so its wide assignment table scrolls
  horizontally inside its wrapper instead of widening the entire page.

Horizontal table/calendar scrolling, fixed menus, dropdowns, drawers and their
necessary bounded scroll areas were retained. Authentication, database schema,
business logic and dependencies were not changed.

## Verification

All 30 page definitions (login, employee, manager and admin routes) were loaded
in Chromium at **390×700** and **1280×720**, using synthetic accounts in an
isolated worktree database. Every route returned HTTP 200 and passed checks for
the expected scroll owner, scrolling to the bottom and back to the top, no
document-level horizontal overflow, and no nested vertical overflow outside
overlays.

Additional checks: login at 667×320 (all content reachable); mobile menu
open/close for all three roles (body scroll lock released); the court-creation
dialog at 667×320 (within the viewport, close button unobstructed); and local
horizontal scrolling of the employee-detail table in RTL. TypeScript, focused
ESLint, diff whitespace checks and the six relevant existing test suites passed.

## Limits

These are browser layout and programmatic scroll checks, not physical iPhone
gesture tests. The user previously confirmed the profile change on their Home
Screen app; extending that same structure removes the shared inner scroller
from the other mobile pages. Actual iOS momentum, bounce, keyboard behavior and
every overlay/data combination still require device verification. No claim is
made that Chromium reproduces the iOS Home Screen scroll-latching bug.
