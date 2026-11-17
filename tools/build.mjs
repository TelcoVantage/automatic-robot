// Generates docs/BUILD_GUIDE.md and preview/index.html from script/definition.mjs.
// Run: node tools/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as def from '../script/definition.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { styles, variables, dataActions, customActions, pages, meta } = def;
const pageName = (id) => pages.find((p) => p.id === id).name;

// ------------------------------------------------------------ validation ---
// Every variable, page, style and custom action referenced must exist.
const known = new Set([...variables.map((v) => v.name), ...Object.keys(meta.previewBuiltins)]);
const problems = [];
const checkRefs = (str, where) => {
  for (const m of String(str ?? '').matchAll(/\{\{([^}]+)\}\}/g)) if (!known.has(m[1].trim())) problems.push(`${where}: unknown variable ${m[1]}`);
};
const checkSteps = (steps, where) => {
  for (const [op, a, b, c] of steps) {
    if (op === 'set') { if (!known.has(a)) problems.push(`${where}: set unknown ${a}`); if (b && typeof b === 'object') checkRefs(b.x, where); }
    if (op === 'page' && !pages.some((p) => p.id === a)) problems.push(`${where}: unknown page ${a}`);
    if (op === 'run' && !customActions.some((x) => x.name === a)) problems.push(`${where}: unknown custom action ${a}`);
    if (op === 'data') { if (!dataActions.some((x) => x.name === a)) problems.push(`${where}: unknown data action ${a}`); for (const k of Object.keys(b)) if (!known.has(k)) problems.push(`${where}: data sets unknown ${k}`); }
    if (op === 'if') { checkRefs(a, where); checkSteps(b, where); checkSteps(c, where); }
    if (op === 'alert' || op === 'copy') checkRefs(a, where);
  }
};
const walk = (n, where) => {
  if (n.s && !styles[n.s]) problems.push(`${where}: unknown style ${n.s}`);
  checkRefs(n.text, where); checkRefs(n.vis, where);
  if (n.var && !known.has(n.var)) problems.push(`${where}: unknown bound variable ${n.var}`);
  if (n.disVar && !known.has(n.disVar)) problems.push(`${where}: unknown disabled variable ${n.disVar}`);
  if (n.dis) problems.push(`${where}: use disVar, not dis`);
  if (n.click) checkSteps(n.click, where);
  for (const k of n.kids || []) walk(k, where);
};
for (const v of variables) if (v.expr) checkRefs(v.expr, `variable ${v.name}`);
for (const a of customActions) checkSteps(a.steps, `custom action ${a.name}`);
for (const p of pages) walk(p.root, `page ${p.id}`);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

// --------------------------------------------------------------- preview ---
const template = readFileSync(join(root, 'preview/template.html'), 'utf8');
const payload = JSON.stringify({ styles, variables, customActions, pages, meta }).replace(/</g, '\\u003c');
writeFileSync(join(root, 'preview/index.html'), template.replace('/*__DEF__*/null', () => payload));

// ----------------------------------------------------------- build guide ---
const code = (s) => '`' + String(s).replace(/`/g, "'") + '`';
const q = (s) => '"' + s + '"';
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

function stepText(step) {
  const [op, a, b] = step;
  switch (op) {
    case 'set': return `Scripter.Set Variable: ${code(a)} = ${b && typeof b === 'object' ? code(b.x) + ' (expression)' : typeof b === 'string' ? q(b) : code(b)}`;
    case 'page': return `Scripter.Change Page: *${pageName(a)}*`;
    case 'run': return `Custom action ${code(a)}`;
    case 'alert': return `Scripter.Alert: ${q(a)}`;
    case 'copy': return 'Copy to Clipboard: the case notes text for this fraud type (see Case notes text)';
    case 'data': return `Data Actions.Execute Data Action: *${a}*, then Scripter.Set Variable ${Object.entries(b).map(([k, val]) => `${code(k)} = ${typeof val === 'string' ? 'the returned value' : val}`).join(', ')}`;
    case 'transfer': return `Scripter.Blind Transfer: queue *${a}*`;
    case 'securePause': return 'Secure Pause';
    case 'endSecurePause': return 'End Secure Pause';
    default: return op;
  }
}
function stepLines(steps, depth = 0) {
  const pad = '  '.repeat(depth);
  const out = [];
  for (const s of steps) {
    if (s[0] === 'if') {
      out.push(`${pad}- **If** ${code(s[1])} (Dynamic Expression)`);
      out.push(...stepLines(s[2], depth + 1));
      if (s[3].length) { out.push(`${pad}- **Else**`); out.push(...stepLines(s[3], depth + 1)); }
    } else out.push(`${pad}- ${stepText(s)}`);
  }
  return out;
}
const clickText = (steps) => steps.length === 1 && steps[0][0] !== 'if' ? stepText(steps[0]) : 'in order: ' + flat(steps).join('; then ');
const flat = (steps) => steps.map((s) => s[0] === 'if'
  ? `if ${code(s[1])} { ${flat(s[2]).join('; ')} }${s[3].length ? ` else { ${flat(s[3]).join('; ')} }` : ''}`
  : stepText(s));

const typeName = { vstack: 'Vertical stack', hstack: 'Horizontal stack', text: 'Text', chip: 'Chip', markdown: 'Markdown', input: 'Text input', number: 'Numeric input', date: 'Date input', checkbox: 'Checkbox', radio: 'Radio button', dropdown: 'Dropdown', button: 'Button' };
function nodeLines(n, depth = 0) {
  const pad = '  '.repeat(depth);
  const bits = [`**${typeName[n.t]}**`];
  if (n.s) bits.push(code(n.s));
  const props = [];
  if (n.t === 'text' || n.t === 'chip' || n.t === 'button' || n.t === 'checkbox') bits.push(q(n.text));
  if (n.inherit) props.push(`text color and size from ${code(n.inherit)}`);
  if (n.var) props.push(`variable ${code(n.var)}`);
  if (n.ph) props.push(`placeholder ${q(n.ph)}`);
  if (n.multi) props.push('Multiline');
  if (n.opts) props.push('options ' + n.opts.map(([val, label]) => `${q(label)} = ${code(val)}`).join(', '));
  if (n.click) props.push(`Click Action: ${clickText(n.click)}`);
  if (n.disVar) props.push(`Disabled: ${code(n.disVar)}`);
  if (n.vis) props.push(`Visible: ${code(n.vis)}`);
  if (n.w) props.push(`Width: Stretch, weight ${n.w}`);
  if (n.align) props.push(`Align: ${n.align}`);
  if (n.margin) props.push(`Margin: ${n.margin}`);
  if (n.box) props.push('inside a stack with background #F3F5F9, padding 12');
  const out = [`${pad}- ${bits.join(' ')}${props.length ? ' · ' + props.join(' · ') : ''}`];
  if (n.t === 'markdown') out.push('', ...('```\n' + n.text + '\n```').split('\n').map((l) => pad + '  ' + l), '');
  for (const k of n.kids || []) out.push(...nodeLines(k, depth + 1));
  return out;
}

const first = pages[0].root.kids; // header, stepper, body(main, side), footer
const frameHeader = first[0], frameStepper = first[1], frameSide = first[2].kids[1];
const groups = [...new Set(variables.filter((v) => v.kind === 'Basic').map((v) => v.group))];

const L = [];
const add = (...lines) => L.push(...lines);

add(`# ${meta.name}: Script Designer build guide`, '',
  '> Generated from `script/definition.mjs` by `node tools/build.mjs`. Edit the definition, not this file.', '',
  `A native Genesys Cloud script for agents taking inbound fraud reports at a bank. It covers card payments the customer does not recognize, scams where the customer sent the money, and lost or stolen cards and phones. A clickable preview of the finished script is in \`preview/index.html\`.`, '',
  '## Contents', '',
  '1. [How the script flows](#1-how-the-script-flows)',
  '2. [Before you build](#2-before-you-build)',
  '3. [Styles](#3-styles)',
  '4. [Variables](#4-variables)',
  '5. [Custom actions](#5-custom-actions)',
  '6. [Data actions](#6-data-actions)',
  '7. [Page frame](#7-page-frame)',
  '8. [Pages](#8-pages)',
  '9. [Case notes text](#9-case-notes-text)',
  '10. [Architect wiring](#10-architect-wiring)',
  '11. [Compliance and data handling](#11-compliance-and-data-handling)',
  '12. [Test plan](#12-test-plan)',
  '13. [Confirm in your org](#13-confirm-in-your-org)', '');

add('## 1. How the script flows', '',
  '```mermaid', 'flowchart LR',
  '  V[1 Verify] -->|verified| T[2 Triage]',
  '  V -->|cannot verify| U[Not verified]',
  '  T -->|card| C[3 Details - Card]',
  '  T -->|scam| S[3 Details - Scam]',
  '  T -->|lost or stolen| L[3 Details - Lost or stolen]',
  '  T -->|still happening| P',
  '  C -->|customer approved the payments| S',
  '  C --> P[4 Protect]', '  S --> P', '  L --> P',
  '  P -->|case created| W[5 Wrap-up]',
  '```', '',
  'Design rules the script follows:', '',
  '- **Protect before paperwork.** The card block and the payment recall are offered as soon as the script knows they apply, not at the end.',
  '- **One question at a time, in the customer\'s words.** Each blue SAY block is read aloud. Everything else is for the agent.',
  '- **Show only what applies.** Follow-up questions, warnings and protective actions appear through the Visible property, so the agent never scrolls past irrelevant fields.',
  '- **No blame, no promises.** Scam wording reassures the customer and never commits to a refund.',
  '- **Nothing sensitive is stored.** No full card numbers, PINs, security codes or passcodes. Only non-personal outcomes are saved as participant data.', '');

add('## 2. Before you build', '',
  '| Item | What to do |', '|---|---|',
  `| Script | Admin > Contact Center > Scripts > Create. Name it **${meta.name}**. Start from a blank script. |`,
  '| Script properties | Turn on **Inbound** (makes Secure Pause and End Secure Pause available). Turn on **Data Actions** when you reach phase 2. |',
  `| Queue | A queue named **${meta.transferQueue}** for the transfer button on Wrap-up. |`,
  `| Wrap-up codes | ${meta.wrapUpCodes.map((c) => `**${c}**`).join(', ')}. Assign them to the fraud queue. |`,
  '| Agent permissions (phase 2) | Integrations > Action > View and Bridge > Actions > Execute, so agents can run data actions from the script. |',
  '| Market settings | Set the default value of each `cfg_` variable (section 4). The time frames are placeholders until Compliance confirms them. |', '',
  '**Build order.** Variables first, then custom actions, then the page frame on page 1. Copy the frame containers and paste them into each new page (toolbar Cut, Copy, Paste), then add the page content. Publish, then point the Architect flow at the script.', '',
  '**Phase 1 and phase 2.** In phase 1 the six protective custom actions only set their flag: the agent does the step in the banking system and clicks the button to record it. In phase 2 each custom action runs its data action first. Pages and wording do not change between phases.', '');

add('## 3. Styles', '',
  'Script Designer has no shared stylesheet, so these names are a convention. Set the listed properties on each component that uses the style. A **Chip** is a stack container with a background color and padding that holds a single Text component. Padding and margin are in pixels, written top right bottom left.', '',
  '| Style | Used on | Background | Text color | Font size | Bold | Padding | Margin | Width |', '|---|---|---|---|---|---|---|---|---|');
for (const [name, s] of Object.entries(styles)) add(`| ${code(name)} | ${s.on} | ${s.bg || ''} | ${s.color || ''} | ${s.size || ''} | ${s.bold ? 'Yes' : ''} | ${s.pad || ''} | ${s.margin || ''} | ${s.width || ''} |`);
add('', 'Palette: ink `#131A2B`, muted `#5B6478`, canvas `#F3F5F9`, accent `#2447D8`, good `#0E6B3A` on `#E3F5EA`, caution `#8A4B00` on `#FFF1D6`, critical `#A3221A` on `#FDE7E4`. All text and background pairs meet WCAG AA contrast.', '');

add('## 4. Variables', '');
for (const g of groups) {
  add(`### ${g}`, '', '| Name | Type | Default | Input | Output | Description |', '|---|---|---|---|---|---|');
  for (const v of variables.filter((x) => x.kind === 'Basic' && x.group === g)) {
    add(`| ${code(v.name)} | ${v.type} | ${v.default === '' ? '(empty)' : cell(v.default)} | ${v.input ? 'Yes' : ''} | ${v.output ? 'Yes' : ''} | ${cell(v.description)} |`);
  }
  add('');
}
add('### Dynamic', '', '| Name | Type | Expression | Purpose |', '|---|---|---|---|');
for (const v of variables.filter((x) => x.kind === 'Dynamic')) add(`| ${code(v.name)} | ${v.type} | ${code(cell(v.expr))} | ${cell(v.description)} |`);
add('', 'Text comparisons use `equal()`, which Genesys provides for strict matching. Combine conditions with `and`, `or` and `not`.', '');

add('## 5. Custom actions', '');
for (const a of customActions) add(`### ${a.name}`, '', a.description, '', ...stepLines(a.steps), '');
add('For the six actions that run a data action, wrap the steps in **Try / On Error** in phase 2. In On Error add a Scripter.Alert telling the agent to complete the step in the banking system, and do not set the flag.', '');

add('## 6. Data actions', '',
  'Build these in Admin > Integrations > Actions against your banking APIs (Web Services Data Actions integration). Write-back actions need POST endpoints. Data actions cannot run in script preview, so test them on a real interaction.', '',
  '| Data action | Inputs | Outputs | Purpose |', '|---|---|---|---|');
for (const d of dataActions) add(`| ${d.name} | ${d.inputs} | ${d.outputs} | ${d.purpose} |`);
add('', 'Map `customerId` to `in_CustomerId`, `cardLast4` to `in_CardLast4`, `conversationId` to `{{Scripter.Interaction Id}}`, `fraudType` to `fraudType`, `scamType` to `scam_Type` and `amount` to `out_AmountAtRisk`.', '');

add('## 7. Page frame', '',
  'Every page has the same root structure. Only the highlighted step and the content of `main` and `footer` change.', '',
  '```', 'Vertical stack  canvas            (root container, background #F3F5F9)',
  '├─ Horizontal stack  header', '├─ Horizontal stack  stepper',
  '├─ Horizontal stack  body', '│  ├─ Vertical stack  main      (page content, weight 2)', '│  └─ Vertical stack  side      (case summary, weight 1)',
  '└─ Horizontal stack  footer     (navigation buttons, aligned right)', '```', '',
  '### Header', '', ...nodeLines(frameHeader), '',
  '### Stepper', '',
  'Five chips. Steps already passed use `stepDone`, the current step uses `stepNow`, later steps use `stepNext`. Shown here as it appears on page 1.', '',
  ...nodeLines(frameStepper), '',
  '### Side panel', '', ...nodeLines(frameSide), '',
  '### SAY block', '',
  'Wherever a page lists a Vertical stack with style `say`, it contains a Text `sayLabel` reading "SAY" and a Text `sayText` with the wording. Agents read these aloud.', '');

add('## 8. Pages', '');
pages.forEach((p, i) => {
  const [, stepperNode, body, foot] = p.root.kids;
  const now = stepperNode.kids.findIndex((k) => k.s === 'stepNow');
  add(`### Page ${i + 1}: ${p.name}`, '',
    `Stepper: step ${now + 1} is current.${p.id === meta.startPage ? ' This is the start page.' : ''}`, '',
    '**Main column**', '', ...nodeLines(body.kids[0]).slice(1).map((l) => l.replace(/^ {2}/, '')), '',
    '**Footer**', '', ...nodeLines(foot).slice(1).map((l) => l.replace(/^ {2}/, '')), '');
});

add('## 9. Case notes text', '',
  'Used twice on Wrap-up: in a Markdown component so the agent can read it, and in the Copy to Clipboard action. Paste the same text in both.', '');
for (const [k, t] of Object.entries(def.notes)) add(`**${k}**`, '', '```', t, '```', '');

add('## 10. Architect wiring', '',
  '1. In the inbound call flow, identify and verify the caller in the IVR where you can.',
  `2. Before the Transfer to ACD action, add **Set Screen Pop** and select the published **${meta.name}** script.`,
  '3. Fill the script inputs:', '',
  '| Script input | Set from |', '|---|---|',
  '| `in_CustomerId` | Customer ID returned by your IVR lookup data action |',
  '| `in_CustomerName` | Optional. Leave empty and look the name up in the script if you prefer not to pass it |',
  '| `in_CardLast4` | Last four digits of the primary card from the lookup |',
  '| `in_VerifiedLevel` | `full`, `partial` or `none` from your IVR verification |',
  '| `in_IvrIntent` | `card`, `scam`, `lost` or empty, from the IVR menu or bot intent |', '',
  '4. Transfer to the fraud queue. The script opens when the agent answers. Pop-up scripts only open on ACD transfers.',
  '5. Output variables are saved on the conversation as the script runs. Use them in analytics, in a post-call flow, or to route a transferred call.', '',
  '| Output | Example use |', '|---|---|');
for (const v of variables.filter((x) => x.output)) add(`| ${code(v.name)} | ${cell(v.description)} |`);
add('');

add('## 11. Compliance and data handling', '',
  '- **Time frames are placeholders.** `cfg_DecisionTimeframe`, `cfg_CardDeliveryEta` and `cfg_ReportingBody` must be set from the rules in your market and signed off by Compliance before go-live. No market was chosen for this build.',
  '- **Card data.** The script never asks for or stores a full card number, PIN, security code or one-time passcode. If the customer must read card details aloud, the agent uses Pause recording (Secure Pause). For payments or card capture, use Scripter.Invoke Secure Flow.',
  '- **Participant data.** Values passed in through Set Screen Pop and all Output variables are visible as participant data and are not removed by GDPR deletion requests. Keep names, addresses, payee names and support needs out of them. This script outputs only the fields listed in section 10.',
  '- **Support needs.** `support_Needed` and `support_Notes` are for the case record under your vulnerable customer policy. They are deliberately not Output variables.',
  '- **Verification policy.** The three agent checks are an example. Replace them with your own identification and verification standard.',
  '- **Unverified callers.** The Not verified page allows a protective card block only. Confirm this matches your policy.', '');

add('## 12. Test plan', '',
  'Use script preview for navigation and visibility, then a test call for data actions and participant data.', '',
  '| # | Scenario | Expected |', '|---|---|---|',
  '| 1 | `in_VerifiedLevel` = full | Green banner shows, checkboxes hidden, Continue enabled |',
  '| 2 | `in_VerifiedLevel` = none, tick two checks | Continue stays disabled until the third is ticked |',
  '| 3 | Click Can\'t verify | Not verified page, `outcome` = failed_idv, card block available |',
  '| 4 | `in_IvrIntent` = scam, Continue from Verify | Triage opens with the scam option selected |',
  '| 5 | Triage: still happening = Yes | Red banner and Protect now button appear |',
  '| 6 | Card path, details shared = Yes | Phishing warning and Switch to scam path appear; switching sets pay method to card |',
  '| 7 | Scam, bank transfer, within the last hour | Red time-critical banner with Raise payment recall; side panel shows Recall needed |',
  '| 8 | Scam, remote access = Yes | Device warning; Lock online and mobile banking appears on Protect |',
  '| 9 | Scam, cryptocurrency | Cannot-recall warning; no recall row on Protect |',
  '| 10 | Lost, phone only | Card sections hidden; Lock banking shown on Protect; no card block |',
  '| 11 | Lost, card, stolen | Police reference field appears; block and replacement rows on Protect |',
  '| 12 | Protect without creating a case | Continue to Wrap-up disabled |',
  '| 13 | Create case | Reference appears in the side panel and Wrap-up wording; `caseRef` and `out_AmountAtRisk` saved |',
  '| 14 | Wrap-up for each type | Correct next-steps wording, notes and wrap-up code |',
  '| 15 | Data action failure (phase 2) | Alert shown, flag not set, agent can retry |', '');

add('## 13. Confirm in your org', '',
  'These points could not be confirmed from the Genesys Cloud Resource Center and may differ by release. Check each one while building.', '',
  '- **Borders and rounded corners.** The design uses background color and spacing only, so it does not depend on a Border property. If your editor offers borders or a corner radius, a 6 px radius on `card`, `say` and the chips is a good addition.',
  '- **Toolbar names.** The read-only text component appears as "Text" or "Read-only text" depending on the page of the documentation.',
  '- **Disabled property.** Documented as bound to a True/False variable. This guide binds it to dynamic True/False variables (`dyn_Lock...`). If your editor only lists basic variables there, add a basic True/False variable and set it with Scripter.Set Variable from each control\'s Change Action.',
  '- **Dynamic variables that use other dynamic variables.** `dyn_UrgentRecall`-style expressions are written out in full to avoid this, except where the side panel and custom actions read `dyn_` values. Check they evaluate in preview.',
  '- **Number variables hold whole numbers.** Amounts are captured in whole currency units.',
  '- **Date input.** Bound here to a String variable.',
  '- **Output variable names.** Confirm how each Output variable is named in participant data on a test conversation before building reports on it.',
  '- **If/Else in custom actions.** Conditions here use the Dynamic Expression toggle.', '',
  'Documentation used: [Script components](https://help.genesys.cloud/articles/script-components/), [Available script actions](https://help.genesys.cloud/articles/available-script-actions/), [Dynamic script variables](https://help.genesys.cloud/articles/dynamic-script-variables/), [Define a custom script action](https://help.genesys.cloud/articles/define-custom-script-action/), [Built-in script variables](https://help.genesys.cloud/articles/built-in-script-variables/), [Scripting best practices](https://help.genesys.cloud/articles/scripting-best-practices-and-recommendations/), [Markdown component](https://help.genesys.cloud/articles/markdown-script-component/), [Set Screen Pop action](https://help.genesys.cloud/articles/set-screen-pop-action/).', '');

writeFileSync(join(root, 'docs/BUILD_GUIDE.md'), L.join('\n'));
const count = (n) => 1 + (n.kids || []).reduce((s, k) => s + count(k), 0);
console.log(`OK: ${pages.length} pages, ${variables.length} variables, ${customActions.length} custom actions, ${pages.reduce((s, p) => s + count(p.root), 0)} components`);
