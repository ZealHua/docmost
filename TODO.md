## Search

- [ ] Add Zhipuai search into the current search flow
- [ ] Ensure Hybrid Search, web search + page search

## AI UI

- [ ] Add Code Block

## mem0 doesn't work well with NestJS. seems the baseURL is hard coded. Pending this feature now

## Enterprise License Bypass Plan(Done)

This plan outlines the minimal code changes needed to completely unlock Docmost's Enterprise Edition (EE) features for personal use, bypassing the license verification checks.

Proposed Changes
Backend Overrides
By forcing the backend to always validate the license as true, we unlock EE-exclusive API routes and features (like AI features, SSO, and advanced roles).

[MODIFY]
license-check.service.ts
Force
isValidEELicense
to always return true, preventing the backend from restricting features based on license validity.

[MODIFY]
utils.ts
Force the
hasLicenseOrEE
utility to always return true. This utility is used in several places such as the Share controller.

[MODIFY]
user.controller.ts
When the frontend fetches the user and workspace info (/users/me), we will ensure hasLicenseKey is sent as true, regardless of what is in the database.

[MODIFY]
workspace.service.ts
Ensure any workspace data returned by the workspace service also forces hasLicenseKey: true.

Verification Plan
Manual Verification
I will apply these changes to the backend.
The user will be asked to restart the Docmost backend server or rely on hot-reloading.
The user will navigate to the Docmost application in their browser.
The user should observe that the "License & Edition" page shows the Enterprise edition, and the "AI Settings", "Security & SSO", and other EE features are no longer locked or hidden.
