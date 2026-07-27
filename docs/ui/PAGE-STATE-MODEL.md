# Page State Model

| State             | Trigger                            | User sees                                 | Actions                          | Retry      | Blocks               | Human intervention   |
| ----------------- | ---------------------------------- | ----------------------------------------- | -------------------------------- | ---------- | -------------------- | -------------------- |
| Initial           | Surface entered before work starts | Orientation and next action               | Start or leave                   | No         | No                   | No                   |
| Loading           | Required request is active         | Named progress/skeleton                   | Cancel if safe                   | Not yet    | Usually              | No                   |
| Empty             | Successful result has no items     | Explanation, creation/filter action       | Create, clear filter             | No         | No                   | No                   |
| Partial           | Some sources succeeded             | Available data and missing-data notice    | Continue safely or refresh       | Yes        | Only dependent steps | Sometimes            |
| Ready             | Required data is current           | Complete working surface                  | Primary and secondary actions    | No         | No                   | As workflow requires |
| Stale             | Data age/version is exceeded       | Last known data, timestamp, stale warning | Refresh or inspect               | Yes        | Protected actions    | Sometimes            |
| Warning           | Material non-blocking risk exists  | Specific risk and consequence             | Review or continue where allowed | Contextual | No                   | Sometimes            |
| Recoverable Error | Temporary/correctable failure      | Safe error and retained input             | Retry or correct                 | Yes        | Affected action      | No                   |
| Blocking Error    | Unsafe/unrecoverable failure       | Block reason and support reference        | Exit/contact support             | No         | Yes                  | Yes                  |
| Unauthorized      | Authentication absent/expired      | Sign-in requirement                       | Sign in/recover                  | Yes        | Yes                  | No                   |
| Forbidden         | Actor lacks permission             | Permission boundary without private data  | Request access/return            | No         | Yes                  | Yes                  |
| Not Found         | Resource absent or concealed       | Neutral missing-resource message          | Return/search                    | Contextual | Yes                  | Sometimes            |
| Offline           | Network unavailable                | Offline status and safe cached content    | Reconnect/retry                  | Yes        | Network actions      | No                   |

Success is represented inside Ready or as action feedback; it states exactly what completed and never implies official acceptance. Permission, partial-data, loading, empty, error, and success fixtures belong in Storybook for future data surfaces.
