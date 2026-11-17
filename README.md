# Fraud Desk - Inbound

A native Genesys Cloud agent script for inbound fraud reports at a bank. It covers
card payments the customer does not recognize, scams where the customer sent the
money, and lost or stolen cards and phones.

| File | What it is |
|---|---|
| `docs/BUILD_GUIDE.md` | Page-by-page build spec for Script Designer: styles, variables, custom actions, data actions, every component and its properties, Architect wiring and a test plan. |
| `script/fraud-desk-inbound.script` | The script itself, ready to import in Admin > Contact Center > Scripts > Import. See "Before you build" in the guide for the four steps to finish after importing. |
| `data-actions/Fraud-Alert-Team-Lead.custom.json` | The team lead alert data action, ready to import in Admin > Integrations > Actions > Import. Replace the two placeholder email addresses before publishing. |
| `preview/index.html` | Clickable preview of the finished script. Open it in a browser. It runs the same visibility rules and actions the guide specifies. |
| `script/definition.mjs` | Single source of truth. Wording, questions, variables and logic all live here. |
| `tools/build.mjs` | Regenerates the guide and the preview from the definition and checks every reference. |

## Changing the script

Edit `script/definition.mjs`, then run:

```
node tools/build.mjs
```

The build fails if a page, variable, style or custom action is referenced but not defined.

## Before go-live

- Set the `cfg_` variable defaults for your market. The time frames are placeholders.
- Replace the three verification checks with your own identification standard.
- Work through "Confirm in your org" at the end of the build guide.
