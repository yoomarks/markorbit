# Page State Model

Every page brief references this complete matrix; a page may mark a state not applicable only with a reason.

| State             | Trigger                                        | User sees                                      | Actions / retry                                    | Blocks flow           | Human intervention   |
| ----------------- | ---------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- | --------------------- | -------------------- |
| Initial           | Route entered; no request started              | Stable title and orientation, no false zeroes  | Begin or resume                                    | No                    | No                   |
| Loading           | Required request pending                       | Context, announced label and skeleton          | Cancel when safe; automatic retry policy disclosed | Only dependent action | No                   |
| Empty             | Valid response has no records                  | Meaningful absence and how to create/find data | Add, broaden filter or leave; no retry             | No                    | No                   |
| Partial           | Some sources/fields unavailable                | Available data plus named gaps                 | Retry missing source or continue where safe        | Only unsafe decisions | Sometimes            |
| Ready             | Required trusted data available                | Full decision surface and next action          | Continue/review                                    | No                    | As workflow requires |
| Stale             | Freshness threshold exceeded/conflict detected | Last-known time and stale marker               | Refresh; preserve context                          | Protected decisions   | Sometimes            |
| Warning           | Reviewable risk or assumption                  | Plain-language issue and consequence           | Review, amend, acknowledge where allowed           | Usually no            | Sometimes            |
| Recoverable Error | Transient/local operation failed               | Error without losing input                     | Retry, edit or contact support                     | Affected step         | If repeated          |
| Blocking Error    | Invariant or required dependency failed        | What stopped, reference and safe exit          | Contact/support or return                          | Yes                   | Yes                  |
| Unauthorized      | No authenticated session                       | Session requirement without leaking data       | Sign in                                            | Yes                   | No                   |
| Forbidden         | Authenticated but lacks permission             | Permission boundary and request path           | Return/request access; no blind retry              | Yes                   | Yes                  |
| Not Found         | Resource absent/removed                        | Safe absence, no private details               | Return/search                                      | Yes for resource      | Sometimes            |
| Offline           | Network unavailable                            | Offline status and retained safe content       | Retry when online                                  | Network actions       | No                   |

## Per-page application

- **Lite pages:** all states apply. Empty explains professional next actions; partial/stale blocks review where evidence is incomplete; forbidden respects Workplace permissions. Customer Summary, Intake Summary and Recommendation Review never expose another Workplace.
- **markreg pages:** all states apply. Anonymous Initial and draft recovery are explicit; partial preserves customer answers; warnings foreground assumptions; professional review and protected actions remain blocking gates. Payment success never says filing or completion.
- **Operations pages:** all states apply. Empty can be healthy (“no failed operations”); stale/offline are visually dominant because operational decisions require freshness; forbidden and blocking errors require auditable escalation.

Each future page test must fixture at least loading, empty, partial, error, permission and ready states. The Task 003 shells intentionally render Ready with fixture warnings; state components demonstrate loading/empty/error separately.
