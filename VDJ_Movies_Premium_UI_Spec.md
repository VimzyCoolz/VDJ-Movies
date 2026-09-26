# VDJ Movies — Premium Unlock UI & Access Specification

## 1. Objective

Redesign the VDJ Movies interface around a **Premium Unlock** model.

VDJ Movies will no longer display advertisements. Users may browse the catalog without Premium access, but **watching any movie requires an active Premium entitlement**.

The Premium system must be enforced by the backend. Frontend state, local storage, countdown timers, or modified JavaScript must never be sufficient to unlock playback.

---

## 2. Navigation Changes

### Remove

Remove the existing search bar displayed at the top of the Home screen.

Remove all advertisement-related UI and code associated with the previous advertising model.

### Bottom navigation

The bottom navigation should contain exactly five items:

1. **Home**
2. **Library**
3. **Search**
4. **Upload**
5. **Profile**

The Search feature should become its own navigation destination rather than appearing as a persistent search bar at the top of Home.

The existing visual language of VDJ Movies should be preserved:
- Dark/cinematic interface
- Strong VDJ Movies branding
- Existing typography and icon style
- Gold accent for Premium/Unlock
- Mobile-first layout

---

# 3. Top-Right Premium Area

Add a Premium access control in the **top-right corner** of the main app interface.

## When the user is not Premium

Display:

**UNLOCK**

- Text: black
- Background: gold/golden
- Compact rounded button
- Clearly tappable
- Positioned at the top-right without obstructing content

Immediately next to the Unlock button, display a continuously moving horizontal promotional text.

Example:

> KES 10/daily, KES 50/weekly, KES 200/monthly, KES 1200/yearly

### Moving-text behavior

- Text color: white
- No background
- Moves continuously from right to left
- Repeats indefinitely
- Smooth, seamless looping animation
- The animation must not interfere with button interaction
- It should remain visually subtle compared with the Unlock button

The moving text is promotional information, not a countdown.

---

# 4. Premium State

When the user has an active Premium entitlement:

Replace:

**UNLOCK**

with:

**PREMIUM**

The Premium button should retain the gold visual treatment.

The moving promotional pricing text should be replaced by:

> X time remaining

Example:

> 6d 14h 32m remaining

The remaining time should update continuously.

When the countdown reaches zero:

- Premium UI state ends
- **PREMIUM** changes back to **UNLOCK**
- Promotional pricing text resumes
- User must purchase another Premium period before watching again

### Important

The countdown is only a visual representation.

The backend/server timestamp is the authoritative source for Premium expiration.

---

# 5. Mandatory Account Requirement

VDJ Movies will require users to have an account.

On first opening/use:

1. Check whether the user is authenticated.
2. If not authenticated, present the VDJ Movies/CoolzTech authentication flow.
3. Do not allow anonymous users to access the application's content.

Users must be logged in before browsing or watching.

The authentication system should continue using the existing VDJ Movies/CoolzTech account architecture.

---

# 6. Browsing vs Watching

Premium is required for **watching**, not for browsing.

### Users without Premium CAN:

- Open the Home screen
- Browse categories
- Browse Packs
- Browse DJ profiles
- Search for movies
- View movie details
- Browse the Library
- View available content and metadata

### Users without Premium CANNOT:

- Start movie playback
- Access a playable movie stream
- Bypass the Premium requirement through direct stream URLs

When a non-Premium user attempts to watch:

> Show the Premium/Unlock flow instead of starting playback.

Example:

**Premium Required**

> Unlock VDJ Movies to watch this movie.

**[ Unlock ]**

---

# 7. Unlock Pricing Window

When the user presses **UNLOCK**, open a dedicated pricing window/page/modal.

All plans must appear on the same pricing screen.

## Plans

### Daily
**KES 10**

Expiry:
**1 day**

### Weekly
**KES 50**

Expiry:
**7 days**

### Monthly
**KES 200**

Expiry:
**30 days**

### Yearly
**KES 1,200**

Expiry:
**365 days**

Each plan must have its own visually distinct card.

The pricing screen should clearly communicate:

- Price
- Duration/expiry
- What Premium provides
- Selection state
- Payment action

---

# 8. Recommended Plan

The **Weekly — KES 50** plan should be visually marked as:

> **RECOMMENDED**

The badge should make the weekly plan easy to identify without making the other plans look unavailable.

Do not hide or disable other plans.

---

# 9. Premium Benefits

The Premium pricing screen should clearly communicate that Premium provides:

- Ad-free VDJ Movies experience
- Full movie streaming access
- Access to watch movies while the Premium period is active

Downloads are a separate paid feature and should **not** be implied to be included with Premium.

---

# 10. Paystack Payment Flow

When the user selects a Premium plan:

1. User selects a plan.
2. Frontend requests a payment transaction from the backend.
3. Backend creates/initializes the Paystack transaction.
4. User completes payment through Paystack.
5. Paystack sends the payment result/webhook to the backend.
6. Backend verifies the transaction with Paystack.
7. Only after successful server-side verification should Premium be activated.
8. Backend calculates the entitlement expiry.
9. User interface refreshes and displays the active Premium state.

Never activate Premium solely because the frontend receives a client-side success callback.

---

# 11. Premium Backend Enforcement

Premium status must be controlled by the backend.

Recommended user entitlement fields:

```text
premium_status
premium_started_at
premium_expires_at
premium_plan
```

The backend should use server time when determining whether Premium is active.

Conceptually:

```text
authenticated user
        ↓
check premium_expires_at
        ↓
expires_at > current server time?
        ↓
   YES          NO
    ↓            ↓
allow watch   reject watch
                 ↓
              show Unlock
```

---

# 12. Protected Streaming

Every movie-streaming request must be protected.

A user must not be able to bypass Premium by:

- Calling the stream endpoint directly
- Reusing an old stream URL
- Modifying frontend JavaScript
- Editing local storage
- Changing a Premium flag in browser storage
- Manipulating the countdown
- Calling Telegram media resources directly through exposed application data

The backend/media authorization layer must verify the user's entitlement before allowing playback.

This requirement remains important if VDJ Movies later implements direct Telegram/MTProto media transfer.

---

# 13. Countdown Security

The frontend may calculate and display a countdown, but it must not be authoritative.

Example:

```text
Server:
premium_expires_at = 2026-10-03T18:30:00Z
```

The client calculates the remaining time for display.

If the user changes their device clock, the Premium entitlement must **not** become longer.

The backend must continue using server-side time.

---

# 14. Premium Expiration

When:

```text
current_server_time >= premium_expires_at
```

Premium is considered expired.

The next protected watch attempt must be rejected.

The UI should then return to:

**UNLOCK**

and:

> KES 10/daily, KES 50/weekly, KES 200/monthly, KES 1200/yearly

The system should not depend on the user reopening the app for security. The backend must enforce expiration on every protected watch/access request.

---

# 15. Payment Idempotency

Payment processing must be idempotent.

A duplicate Paystack webhook or repeated callback must not accidentally:

- Grant duplicate Premium periods
- Create duplicate payment records
- Extend Premium multiple times from one transaction

Each payment should have a unique transaction/reference identifier.

---

# 16. Premium Renewal / Existing Premium

If a user purchases another plan while Premium is still active, define the behavior consistently.

Recommended behavior:

> Add the new plan's duration to the existing `premium_expires_at`.

Example:

```text
Current expiry: 10 October
New weekly purchase: +7 days

New expiry: 17 October
```

Do not reset the existing Premium period unless explicitly intended.

---

# 17. No Advertisement System

Remove all advertisement-related functionality from the VDJ Movies application.

This includes:

- Ad SDK integrations
- Advertisement components
- Rewarded-ad logic
- Ad timers
- Ad placeholders
- Ad-triggered viewing access
- Ad-related state
- Ad-related UI
- Ad configuration that is no longer required

The Premium subscription is now the primary viewing-access model.

---

# 18. Download System — Separate Feature

Movie downloads are **not included automatically with Premium**.

A separate download purchase is required per movie:

**KES 50 per movie**

After a successful download payment:

- Grant the user a download entitlement for that specific movie.
- Allow the movie to be downloaded to the user's device.
- Do not treat Premium streaming access as download authorization.

For each successful paid download:

**30% of the download revenue goes to the movie owner/creator.**

At KES 50:

```text
Movie download price: KES 50
Creator share (30%): KES 15
VDJ Movies share (70%): KES 35
```

Payment-processing fees and any other applicable costs should be accounted for separately in the financial implementation.

---

# 19. UX Principle

The Premium system should feel like an **access pass**, not an advertisement wall.

A user should be able to:

```text
Open VDJ Movies
      ↓
Browse freely
      ↓
Find a movie
      ↓
Press Watch
      ↓
If Premium → Play
If not Premium → Unlock
```

The user should never be surprised by an advertisement interrupting playback.

---

# 20. UI State Summary

## Logged in + no Premium

Top-right:

**UNLOCK** + moving pricing text

Browsing:

**Allowed**

Watching:

**Blocked → Unlock prompt**

---

## Logged in + active Premium

Top-right:

**PREMIUM** + countdown

Browsing:

**Allowed**

Watching:

**Allowed**

Ads:

**None**

---

## Logged in + Premium expired

Top-right:

**UNLOCK** + moving pricing text

Browsing:

**Allowed**

Watching:

**Blocked → Unlock prompt**

---

# 21. Visual Direction

Keep the existing VDJ Movies visual identity from the current application.

The Premium system should use:

- Dark background
- Gold Premium/Unlock accent
- White promotional text
- Existing VDJ Movies typography
- Existing card and navigation language
- Subtle animations rather than excessive effects

The Premium UI should feel like part of VDJ Movies rather than a separate payment application.

---

# 22. Important Implementation Rule

Do not remove or weaken backend authorization simply because the frontend visually blocks non-Premium users.

The frontend controls **presentation**.

The backend controls **access**.

The database/payment system controls **entitlement**.

The media layer controls **actual playback/download authorization**.

These responsibilities must remain separate.

---

## Final Product Model

VDJ Movies should ultimately operate as:

```text
                VDJ MOVIES
                    │
        ┌───────────┴───────────┐
        │                       │
     BROWSING                WATCHING
        │                       │
      FREE                 PREMIUM REQUIRED
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
           Daily             Weekly             Monthly
          KES 10             KES 50             KES 200
                                │
                              Yearly
                             KES 1,200

                    DOWNLOADS
                         │
                    KES 50/movie
                         │
                 30% → Movie owner
                 70% → VDJ Movies
```

The central product promise is:

> **Browse freely. Watch without ads when Premium is active. Download individual movies separately when you want to keep them.**
