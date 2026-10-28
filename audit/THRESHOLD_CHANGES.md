# Threshold Changes Log

This file records any test threshold or algorithmic parameter changes made during the audit, including the old value, new value, and rationale.

| Date | Parameter / Constant | File | Old Value | New Value | Rationale |
|------|----------------------|------|-----------|-----------|-----------|
| 2026-10-28 | Toolbar Scale Bounds | `src/ui/toolbar.ts` & `tests/toolbarEnhancements.test.ts` | Min: 0.60 (60%), Max: 1.60 (160%) | Min: 0.50 (50%), Max: 2.50 (250%) | Mandated by Part D item TB-4: "scale 0.5×–2.5× by handle, pinch and slider". Old unit test checked deprecated 0.6-1.6 range. |
