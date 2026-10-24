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

## Browser coverage

All 30 page definitions were loaded in Chromium at **390×700** and **1280×720**,
using synthetic employee, manager and administrator accounts in an isolated
worktree database. Dynamic routes used valid employee/schedule IDs; invite and
password-reset routes used valid synthetic tokens. Current published and open
draft schedules were available in the fixture database.

Each route returned HTTP 200. Checks verified the expected scroll owner,
programmatic scrolling to the bottom and back to the top, no document-level
horizontal overflow, and no nested vertical overflow in the rendered mobile page
content outside overlays. Short pages correctly have zero scroll distance.

| Route | Mobile | Desktop |
| --- | --- | --- |
| `/` (login redirect) | Pass | Pass |
| `/login` | Pass | Pass |
| `/forgot-password` | Pass | Pass |
| `/invite/[token]` | Pass | Pass |
| `/reset-password/[token]` | Pass | Pass |
| `/employee` | Pass | Pass |
| `/employee/home` | Pass | Pass |
| `/employee/availability` | Pass | Pass |
| `/employee/profile` | Pass | Pass |
| `/employee/requests` | Pass | Pass |
| `/employee/submissions` | Pass | Pass |
| `/employee/submissions/[periodId]` | Pass | Pass |
| `/employee/schedules` | Pass | Pass |
| `/employee/schedules/[id]` | Pass | Pass |
| `/manager` | Pass | Pass |
| `/manager/draft` | Pass | Pass |
| `/manager/schedule` | Pass | Pass |
| `/manager/schedules` | Pass | Pass |
| `/manager/schedules/[id]` | Pass | Pass |
| `/manager/employees` | Pass | Pass |
| `/manager/employees/[employeeId]` | Pass | Pass |
| `/manager/employees/[employeeId]/submissions` | Pass | Pass |
| `/manager/profile` | Pass | Pass |
| `/manager/requests` | Pass | Pass |
| `/manager/settings` | Pass | Pass |
| `/admin` | Pass | Pass |
| `/admin/courts` | Pass | Pass |
| `/admin/employees` | Pass | Pass |
| `/admin/profile` | Pass | Pass |
| `/admin/config` | Pass | Pass |

Additional browser checks:

- Login at **667×320**: all content reachable, 172px of document scrolling.
- Mobile menu open/close for all three roles: body scroll lock released.
- Court-creation dialog at **667×320**: top/bottom within viewport, 78px of
  internal scrolling, close button unobstructed, body lock released on close.
  Screenshot visually inspected after correcting the modal stacking order.
- Employee-detail assignment table: local horizontal scrolling in both
  directions in RTL, without document-level horizontal overflow.

TypeScript, focused ESLint, and diff whitespace checks passed. All 26 tests in
the six relevant existing suites passed: availability calendar, mobile day
schedule, schedule stats, manual employee picker, manager schedule screen and
mobile schedule defaults.

## Limits

These are browser layout and programmatic scroll checks, not physical iPhone
gesture tests. The user previously confirmed the profile change on their Home
Screen app; extending that same structure removes the shared inner scroller
from the other mobile pages. Actual iOS momentum, bounce, keyboard behavior and
every overlay/data combination still require device verification. No claim is
made that Chromium reproduces the iOS Home Screen scroll-latching bug.
