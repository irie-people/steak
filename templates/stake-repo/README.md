# {{NAME}} stake

The public record of who built {{NAME}} and how money, if any ever arrives, is
shared. Read [STAKE.md](STAKE.md). It follows the [Steak framework](https://github.com/irie-people/steak) ({{STEAK_VERSION}}).

| Path | What |
|---|---|
| `events/YYYY/MM.jsonl` | One line per sized contribution, append-only |
| `vouch.txt` | Who earns Steak, and from when |
| `payees/<handle>.toml` | Opt-outs; nothing personal |
| `distributions/YYYY-Qn.json` | Each payout, recomputable |
| `tools/steak.ts` | `bun tools/steak.ts steak .` · `verify .` |

Event line:

```json
{"id":"2027-03-0007","at":"2027-03-04T18:22:10Z","who":"bob","kind":"change","ref":"{{ORG}}/{{NAME}}#142","commit":"3f9c2e1a","steak":8,"sized_by":"carol","note":"short description"}
```

`kind` is `change`, `review`, `report`, `docs`, `support` or `revert` (negative
Steak, with `of` naming the event it cancels).
