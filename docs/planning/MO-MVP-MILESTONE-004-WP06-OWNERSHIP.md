# M4-WP-06 Ownership

| Truth                                               | Owner     | Persistence           |
| --------------------------------------------------- | --------- | --------------------- |
| Provider Return / correction lineage                | MGSN      | MGSN DB (`0031`)      |
| Evidence handoff receipt / pending review candidate | Execution | Execution DB (`0032`) |
| Execution Release / Filing Execution Task Draft     | Execution | Execution DB (`0027`) |
| Formal Matter                                       | MarkReg   | MarkReg DB            |
| Workspace / Principal                               | Core      | Core DB               |

There is no cross-service SQL and no distributed transaction claim. MGSN hands an exact Provider Return contract to Execution; Execution makes the retry-safe receipt durable in its own database.
