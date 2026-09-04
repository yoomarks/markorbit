# MO Control Plane Current-State Refresh — 2026-09-05

- Issue: #770
- Parent Epic: #735
- Historical baseline audit: #736 / `MO_CONTROL_PLANE_CURRENT_STATE.md`
- Verified baseline: `main@0750f0cac0898392c9ff4bb14694b4f3c407b9d5`

## Purpose

This document is a **refresh overlay**, not a rewrite of the accepted #736 audit.

The #736 document remains the historical current-state baseline that froze the Control Center product boundary. This overlay records material repository changes that have happened since that baseline so later lanes do not create duplicate Commercial, Overview or Cognitive read-plane work.

All permanent architecture rules from #735/#736 remain in force:

- one Control Center UI, distributed owner truth;
- no super-admin database;
- no cross-service SQL;
- no generic catch-all Gateway proxy;
- no browser-visible service credentials;
- read projection is not mutation authority;
- runtime reachability is not correctness;
- no automatic Brain activation, Capability admission, filing, payment, provider action/contact or Official Truth creation.

---

## 1. Superseded baseline rows

### `CommercialAdminWorkspace`

- #736 baseline: `IMPLEMENTED_NOT_MOUNTED`.
- Current truth: **Mounted and product-visible.** Current `OperationsApp` imports and renders `CommercialAdminWorkspace`, and SideNavigation contains `Commercial`. Historical implementation landed in commit `32904d77ae490ba63a616a2c223d3eabd30dab3b` / PR #109.
- Action: Do not create another Commercial mounting task.

### Operations overview placeholders

- #736 baseline: `STATIC_PLACEHOLDER` / `REMOVE_PLACEHOLDER`.
- Current truth: **Already removed.** Current `App.tsx` explicitly states that aggregate platform health is not authoritatively connected and does not infer healthy/degraded state or synthetic counts.
- Action: Do not recreate fake health/count cleanup work.

### Commercial read plane

- #736 baseline: `READY_NOT_MOUNTED`.
- Current truth: **READY_MOUNTED.** Existing owner-routed commercial reads are consumed by the mounted Commercial workspace.
- Action: Preserve the existing commercial authority boundary.

### Brain Asset / BrainGap Control Center read

- #736 baseline: `NEW_BOUNDED_READ_CONTRACT_REQUIRED`.
- Current truth: **OWNER_READ_READY.** Core bounded Brain/BrainGap cognitive read merged via #744 / PR #745. Browser/Gateway consumption is still pending.
- Action: Consume only through bounded Gateway forwarding after operator authority is valid.

### Runtime Capability inventory

- #736 baseline: `NEW_BOUNDED_READ_CONTRACT_REQUIRED`.
- Current truth: **OWNER_READ_READY.** Capability Engine bounded Runtime Capability read merged via #755 / PR #764.
- Action: Gateway/browser consumption is pending.

### Implementation Profile inventory

- #736 baseline: `NEW_BOUNDED_READ_CONTRACT_REQUIRED`.
- Current truth: **OWNER_READ_READY.** Capability Engine bounded Implementation Profile read merged via #755 / PR #764.
- Action: Gateway/browser consumption is pending.

### Cognitive operator vocabulary

- #736 baseline: not yet frozen.
- Current truth: **CONTRACT_READY.** `control-plane:cognitive:read` is accepted in canonical `INTERNAL_OPERATOR` capability vocabulary via #742 / PR #743.
- Action: Vocabulary exists, but real grant issuance is still missing.

---

## 2. Current Cognitive Platform dependency chain

The owner read contracts are no longer the main blocker.

The current blocker is **operator authority issuance**.

### Completed substrate

1. #742 / PR #743 — canonical `control-plane:cognitive:read` vocabulary.
2. #744 / PR #745 — Core Brain/BrainGap bounded owner read.
3. #755 / PR #764 — Capability Engine Runtime Capability / Implementation Profile bounded owner read.

### Current blocking sequence

`#768 explicit Core cognitive grant resolution -> #769 bounded Gateway forwarding -> Operations Console Cognitive Platform UI`

This ordering is intentional.

Gateway must not manufacture or append `control-plane:cognitive:read` merely because the user is:

- an `INTERNAL` account;
- a commercial admin;
- a Workspace member;
- a privileged browser client.

Core must issue one canonical Internal Operator principal from explicit owner-side authority. Gateway may then encode and forward that exact principal to the owner read routes.

---

## 3. Parallel owner-read expansion

#767 tracks the next Core-owned Cognitive Platform slice:

- bounded Method Improvement admission read;
- truthful Brain Build Run availability;
- explicit `NOT_DURABLY_RECORDED` Build Run state rather than fabricated history.

#767 may proceed in parallel with #768.

It is **not** a reason to widen #769 before #767 stabilizes. The first Gateway cognitive forwarding slice should stay bounded to the already-merged Brain/BrainGap and Runtime Capability/Implementation Profile owner contracts.

A later Gateway/UI slice may consume Method Improvement only after its owner contract is merged and stable.

---

## 4. Current Control Center V1 status

### Overview

Current status: **truthful partial product**.

The UI now reports only connected governed surfaces and explicit unavailable aggregate health. Unknown/unavailable is not converted into healthy/empty.

### Operations

Current status: **productized partial**.

Evidence Review and Lifecycle Provenance remain real governed flows.

### Commercial

Current status: **mounted and usable through existing owner-routed reads**.

`commercial-admin:read` remains commercial inspection authority only. It does not imply Cognitive Platform authority.

### Cognitive Platform

Current status: **owner read plane ready, browser read plane blocked by explicit grant issuance**.

No production UI should bypass #768/#769.

### Knowledge / Data

Current decision remains unchanged from #736:

- keep specialist admin ownership;
- federate bounded summaries/deep links only when a concrete cross-platform decision requires them;
- do not clone specialist admin products into Control Center;
- no destructive Data Engine controls in early Control Center work.

---

## 5. Do-not-duplicate list

As of this refresh, do **not** create new tasks for:

- mounting `CommercialAdminWorkspace` into Operations Console;
- removing the old fake Overview health/count cards;
- inventing a second Brain/BrainGap Control Center owner endpoint;
- inventing a second Runtime Capability / Implementation Profile Control Center owner endpoint;
- adding another cognitive-read capability string;
- making `commercial-admin:read` imply cognitive access.

The current high-value path is authority issuance and bounded consumption of already-merged owner truth.

---

## Refresh rule

Before creating new #735 child work, check both:

1. the historical #736 baseline audit; and
2. this refresh overlay plus current `main`.

If repository truth has advanced again, create another small refresh or update the active child issue rather than treating the historical baseline as live implementation truth.
