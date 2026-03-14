# AI Development Rules for FINAPP

This document defines permanent development rules that must always be respected by AI agents working on the project.

These rules complement the development protocol used in the interactive session.

---

# 1. Source of truth

The system behavior is defined by:

* docs/ESSENCIAL.md
* docs/FINAPP_PRD.md
* docs/ARCHITECTURE_MVP.md

If implementation conflicts with these documents, the AI must stop and ask for clarification.

---

# 2. Layered architecture

The project must maintain separation between:

* UI
* Application / Use cases
* Domain
* Infrastructure

Rules:

* UI must not access persistence directly
* UI must not contain business rules
* domain logic must not depend on UI frameworks
* infrastructure must remain replaceable

---

# 3. Persistence abstraction

localStorage is temporary.

Persistence must be implemented through repository abstractions so the system can migrate to Supabase without rewriting the UI.

---

# 4. Financial domain invariants

The following rules must never be violated:

* real events and planned events must remain separate
* projections must never modify historical records
* credit card purchases must not reduce cash balance
* invoice totals must equal the sum of their transactions
* financial adjustments must create new records instead of rewriting history
* financial flows must avoid double counting

If a requested implementation risks violating these invariants, stop and ask before continuing.

---

# 5. Documentation alignment

Documentation is expected to evolve.

When implementation reveals inconsistencies or missing information, the AI should propose updates to:

* ESSENCIAL.md
* FINAPP_PRD.md
* ARCHITECTURE_MVP.md

Documentation must always remain aligned with the implemented system behavior.

---

# 6. When uncertain

When a rule is ambiguous, stop and ask before implementing.

Never guess financial behavior.
