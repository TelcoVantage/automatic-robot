// Single source of truth for the "Fraud Desk - Inbound" Genesys Cloud script.
// tools/build.mjs turns this into docs/BUILD_GUIDE.md (what to build in Script
// Designer) and preview/index.html (a clickable emulation of the result).
//
// Expressions use Genesys dynamic-variable syntax: {{variable}}, equal(a, b),
// ifElse(cond, a, b), and / or / not.

// ---------------------------------------------------------------- styles ---
// Every style maps to properties you can set natively on a component:
// Color (background or text), Font (size, bold), Padding, Margin.
export const styles = {
  canvas:      { on: 'container', bg: '#F3F5F9', pad: '0' },
  header:      { on: 'container', bg: '#101B3B', pad: '14 20' },
  hTitle:      { on: 'text', color: '#FFFFFF', size: 18, bold: true },
  hSub:        { on: 'text', color: '#B7C0DA', size: 12 },
  hMeta:       { on: 'text', color: '#FFFFFF', size: 13 },
  stepper:     { on: 'container', bg: '#FFFFFF', pad: '10 20' },
  stepDone:    { on: 'chip', bg: '#E3F5EA', color: '#0E6B3A', size: 12, bold: true, pad: '4 10' },
  stepNow:     { on: 'chip', bg: '#2447D8', color: '#FFFFFF', size: 12, bold: true, pad: '4 10' },
  stepNext:    { on: 'chip', bg: '#FFFFFF', color: '#7A8397', size: 12, pad: '4 10' },
  body:        { on: 'container', pad: '20' },
  main:        { on: 'container', width: 'Stretch, weight 2', margin: '0 16 0 0' },
  side:        { on: 'container', width: 'Stretch, weight 1' },
  card:        { on: 'container', bg: '#FFFFFF', pad: '20', margin: '0 0 16 0' },
  say:         { on: 'container', bg: '#EAF0FF', pad: '16', margin: '0 0 16 0' },
  sayLabel:    { on: 'text', color: '#2447D8', size: 11, bold: true },
  sayText:     { on: 'text', color: '#131A2B', size: 16 },
  h2:          { on: 'text', color: '#131A2B', size: 16, bold: true, margin: '0 0 6 0' },
  label:       { on: 'text', color: '#131A2B', size: 13, bold: true },
  muted:       { on: 'text', color: '#5B6478', size: 13 },
  bodyText:    { on: 'text', color: '#131A2B', size: 14 },
  field:       { on: 'container', margin: '12 0 0 0' },
  row:         { on: 'container', margin: '12 0 0 0' },
  bannerOk:    { on: 'container', bg: '#E3F5EA', color: '#0E6B3A', size: 13, pad: '12', margin: '12 0 0 0' },
  bannerWarn:  { on: 'container', bg: '#FFF1D6', color: '#8A4B00', size: 13, pad: '12', margin: '12 0 0 0' },
  bannerBad:   { on: 'container', bg: '#FDE7E4', color: '#A3221A', size: 13, pad: '12', margin: '12 0 0 0' },
  bannerInfo:  { on: 'container', bg: '#EDEFF4', color: '#3D4558', size: 13, pad: '12', margin: '12 0 0 0' },
  chipOk:      { on: 'chip', bg: '#E3F5EA', color: '#0E6B3A', size: 12, bold: true, pad: '4 10', margin: '2 0 2 0' },
  chipWarn:    { on: 'chip', bg: '#FFF1D6', color: '#8A4B00', size: 12, bold: true, pad: '4 10', margin: '2 0 2 0' },
  chipBad:     { on: 'chip', bg: '#FDE7E4', color: '#A3221A', size: 12, bold: true, pad: '4 10', margin: '2 0 2 0' },
  btnPrimary:  { on: 'button', bg: '#2447D8', color: '#FFFFFF', size: 14, bold: true },
  btnSecondary:{ on: 'button', bg: '#E6E9F0', color: '#131A2B', size: 14 },
  btnDanger:   { on: 'button', bg: '#B42318', color: '#FFFFFF', size: 14, bold: true },
  btnAssist:   { on: 'button', bg: '#101B3B', color: '#FFFFFF', size: 14, bold: true, margin: '12 0 0 0' },
  footer:      { on: 'container', pad: '0 20 20 20' },
};

// ------------------------------------------------------------- variables ---
const S = 'String', N = 'Number', B = 'True/False';
const basic = (name, type, def, description, extra = {}) => ({ name, kind: 'Basic', type, default: def, description, ...extra });
const dyn = (name, type, expr, description) => ({ name, kind: 'Dynamic', type, expr, description });

export const variables = [
  // Inputs set by the Architect flow (Set Screen Pop)
  basic('in_CustomerId', S, '', 'Internal customer ID from IVR identification. Not PII.', { group: 'Input', input: true, preview: 'C-104482' }),
  basic('in_CustomerName', S, '', 'Display name. Optional: prefer a data action lookup over passing PII as participant data.', { group: 'Input', input: true, preview: 'Alex Morgan' }),
  basic('in_CardLast4', S, '', 'Last four digits of the primary card. Never pass the full card number.', { group: 'Input', input: true, preview: '4821' }),
  basic('in_VerifiedLevel', S, 'none', 'IVR verification result: full, partial or none.', { group: 'Input', input: true }),
  basic('in_IvrIntent', S, '', 'Reason chosen in the IVR: card, scam, lost or empty. Pre-selects the triage answer.', { group: 'Input', input: true }),

  // Market configuration: change the default value, nothing else
  basic('cfg_BankName', S, 'Example Bank', 'Bank name used in greetings.', { group: 'Config' }),
  basic('cfg_Currency', S, '$', 'Currency symbol shown before amounts.', { group: 'Config' }),
  basic('cfg_DecisionTimeframe', S, '10 business days', 'PLACEHOLDER. Time to tell the customer the outcome. Set from your market rules.', { group: 'Config' }),
  basic('cfg_CardDeliveryEta', S, '5 to 7 business days', 'PLACEHOLDER. Replacement card delivery time.', { group: 'Config' }),
  basic('cfg_ReportingBody', S, 'your national fraud reporting service or local police', 'PLACEHOLDER. Where customers report scams in your market.', { group: 'Config' }),

  // Verify
  basic('callerType', S, 'holder', 'holder = account holder, third = calling on their behalf.', { group: 'Verify' }),
  basic('idv_Identity', B, false, 'Full name and date of birth confirmed.', { group: 'Verify' }),
  basic('idv_Address', B, false, 'Registered address confirmed.', { group: 'Verify' }),
  basic('idv_Knowledge', B, false, 'Account knowledge question answered.', { group: 'Verify' }),

  // Triage
  basic('fraudType', S, '', 'card, scam or lost. Saved as participant data.', { group: 'Triage', output: true }),
  basic('fraudOngoing', S, '', 'yes, no or unsure.', { group: 'Triage' }),

  // Card
  basic('card_HasCard', S, '', 'Customer still has the card: yes / no.', { group: 'Card' }),
  basic('card_OthersAccess', S, '', 'Someone else knows the PIN or uses the card: yes / no.', { group: 'Card' }),
  basic('card_SharedDetails', S, '', 'Card details, PIN or passcode shared recently: yes / no.', { group: 'Card' }),
  basic('card_TxnCount', N, 0, 'Number of payments not recognized.', { group: 'Card' }),
  basic('card_TotalAmount', N, 0, 'Total of payments not recognized (whole currency units).', { group: 'Card' }),
  basic('card_FirstTxnDate', S, '', 'Date of the first payment not recognized.', { group: 'Card' }),
  basic('card_Channel', S, '', 'How the payments were made.', { group: 'Card' }),
  basic('card_RuledOut', B, false, 'Trading names, family use, subscriptions and free trials ruled out.', { group: 'Card' }),
  basic('card_Notes', S, '', 'Free-text notes. No card numbers, PINs or codes.', { group: 'Card' }),

  // Scam
  basic('scam_PayMethod', S, '', 'transfer, card, crypto, cash, giftcard or other.', { group: 'Scam' }),
  basic('scam_LastPayment', S, '', 'hour, today, week or older.', { group: 'Scam' }),
  basic('scam_Amount', N, 0, 'Total sent (whole currency units).', { group: 'Scam' }),
  basic('scam_PaymentCount', N, 0, 'Number of payments sent.', { group: 'Scam' }),
  basic('scam_PaidTo', S, '', 'Name the customer paid, as shown on the payment.', { group: 'Scam' }),
  basic('scam_Type', S, '', 'Scam category. Saved as participant data.', { group: 'Scam', output: true }),
  basic('scam_Contact', S, '', 'How the scammer first made contact.', { group: 'Scam' }),
  basic('scam_StillInContact', S, '', 'yes / no.', { group: 'Scam' }),
  basic('scam_RemoteAccess', S, '', 'Software installed or screen shared: yes / no.', { group: 'Scam' }),
  basic('scam_SharedCreds', S, '', 'Login details or passcodes shared: yes / no.', { group: 'Scam' }),
  basic('scam_MorePending', S, '', 'Further payments scheduled or pending: yes / no.', { group: 'Scam' }),
  basic('scam_Coached', S, '', 'Customer was told what to say to the bank: yes / no.', { group: 'Scam' }),
  basic('support_Needed', B, false, 'Customer may need extra support. Record in the case system, not participant data.', { group: 'Scam' }),
  basic('support_Notes', S, '', 'Support needs in the customer\'s own words.', { group: 'Scam' }),
  basic('scam_Notes', S, '', 'Free-text notes.', { group: 'Scam' }),

  // Lost / stolen
  basic('lost_What', S, '', 'card, phone or both.', { group: 'Lost' }),
  basic('lost_How', S, '', 'lost or stolen.', { group: 'Lost' }),
  basic('lost_When', S, '', 'When the customer last had it.', { group: 'Lost' }),
  basic('lost_PinExposed', S, '', 'PIN written down or kept with the card: yes / no.', { group: 'Lost' }),
  basic('lost_PhoneLocked', S, '', 'Phone protected by passcode or biometrics: yes / no.', { group: 'Lost' }),
  basic('lost_Wallet', S, '', 'Card is in a mobile wallet on the phone: yes / no.', { group: 'Lost' }),
  basic('lost_Unrecognized', S, '', 'Payments since then the customer does not recognize: yes / no.', { group: 'Lost' }),
  basic('lost_PoliceRef', S, '', 'Police report reference, if stolen.', { group: 'Lost' }),

  // Protect and wrap-up
  basic('act_CardBlocked', B, false, 'Card block completed. Saved as participant data.', { group: 'Protect', output: true }),
  basic('act_ReplacementOrdered', B, false, 'Replacement card ordered.', { group: 'Protect' }),
  basic('act_AddressConfirmed', B, false, 'Delivery address confirmed with the customer.', { group: 'Protect' }),
  basic('act_RecallRaised', B, false, 'Payment recall raised. Saved as participant data.', { group: 'Protect', output: true }),
  basic('act_DigitalLocked', B, false, 'Online and mobile banking locked.', { group: 'Protect' }),
  basic('act_WalletRemoved', B, false, 'Card removed from mobile wallets.', { group: 'Protect' }),
  basic('act_CaseCreated', B, false, 'Fraud case created.', { group: 'Protect' }),
  basic('caseRef', S, '', 'Fraud case reference. Saved as participant data.', { group: 'Protect', output: true }),
  basic('out_AmountAtRisk', N, 0, 'Copy of dyn_AmountAtRisk, saved as participant data when the case is created.', { group: 'Protect', output: true }),
  basic('tl_Requested', B, false, 'Agent alerted a team lead during the interaction. Saved as participant data.', { group: 'Assistance', output: true }),
  basic('tl_Reason', S, '', 'Optional reason sent with the alert.', { group: 'Assistance' }),
  basic('adviceGiven', B, false, 'Safety advice read to the customer.', { group: 'Wrap-up' }),
  basic('outcome', S, '', 'completed, failed_idv or transferred. Saved as participant data.', { group: 'Wrap-up', output: true }),

  // Dynamic
  dyn('dyn_IsVerified', B, 'equal({{in_VerifiedLevel}}, "full") or ({{idv_Identity}} and {{idv_Address}} and {{idv_Knowledge}})', 'Caller is verified by IVR or by all three agent checks.'),
  dyn('dyn_LockVerify', B, 'not (equal({{in_VerifiedLevel}}, "full") or ({{idv_Identity}} and {{idv_Address}} and {{idv_Knowledge}}))', 'Disables Continue on Verify until verified.'),
  dyn('dyn_LockTriage', B, 'equal({{fraudType}}, "")', 'Disables Continue on Triage until a type is chosen.'),
  dyn('dyn_CardAtRisk', B, 'equal({{fraudType}}, "card") or (equal({{fraudType}}, "lost") and not equal({{lost_What}}, "phone")) or (equal({{fraudType}}, "scam") and equal({{scam_PayMethod}}, "card"))', 'The card needs blocking and replacing.'),
  dyn('dyn_RecallApplies', B, 'equal({{fraudType}}, "scam") and equal({{scam_PayMethod}}, "transfer")', 'A payment recall can be attempted.'),
  dyn('dyn_UrgentRecall', B, 'equal({{fraudType}}, "scam") and equal({{scam_PayMethod}}, "transfer") and not {{act_RecallRaised}} and (equal({{scam_LastPayment}}, "hour") or equal({{scam_LastPayment}}, "today"))', 'Recent transfer with no recall raised yet.'),
  dyn('dyn_DigitalAtRisk', B, '(equal({{fraudType}}, "scam") and (equal({{scam_RemoteAccess}}, "yes") or equal({{scam_SharedCreds}}, "yes"))) or (equal({{fraudType}}, "lost") and (equal({{lost_What}}, "phone") or equal({{lost_What}}, "both")))', 'Online and mobile banking should be locked.'),
  dyn('dyn_WalletAtRisk', B, 'equal({{fraudType}}, "lost") and equal({{lost_Wallet}}, "yes")', 'Mobile wallet tokens should be removed.'),
  dyn('dyn_LockReplacement', B, 'not {{act_CardBlocked}}', 'Disables Order replacement until the card is blocked.'),
  dyn('dyn_LockWrapUp', B, 'not {{act_CaseCreated}}', 'Disables Continue on Protect until a case exists.'),
  dyn('dyn_AmountAtRisk', N, 'ifElse(equal({{fraudType}}, "scam"), {{scam_Amount}}, {{card_TotalAmount}})', 'Amount reported, from whichever path was used.'),
  dyn('dyn_TypeLabel', S, 'ifElse(equal({{fraudType}}, "card"), "Card payments not recognized", ifElse(equal({{fraudType}}, "scam"), "Scam payment", ifElse(equal({{fraudType}}, "lost"), "Lost or stolen", "Not set yet")))', 'Readable fraud type for the summary.'),
  dyn('dyn_WrapUp', S, 'ifElse(equal({{fraudType}}, "card"), "Fraud - Card", ifElse(equal({{fraudType}}, "scam"), "Fraud - Scam", ifElse(equal({{fraudType}}, "lost"), "Fraud - Lost or Stolen", "Fraud - Other")))', 'Wrap-up code the agent should select.'),
];

// ---------------------------------------------------------- data actions ---
// Phase 2. Until these exist the custom actions below simply set the flag and
// the agent completes the step in the banking system.
export const dataActions = [
  { name: 'Fraud - Block Card', inputs: 'customerId, cardLast4, reason', outputs: 'status', purpose: 'Blocks the card in the card platform.' },
  { name: 'Fraud - Order Replacement Card', inputs: 'customerId, cardLast4', outputs: 'status', purpose: 'Orders a replacement to the registered address.' },
  { name: 'Fraud - Raise Payment Recall', inputs: 'customerId, amount', outputs: 'recallRef', purpose: 'Sends a recall request to the receiving bank.' },
  { name: 'Fraud - Lock Digital Access', inputs: 'customerId', outputs: 'status', purpose: 'Locks online and mobile banking and signs out all devices.' },
  { name: 'Fraud - Remove Wallet Tokens', inputs: 'customerId, cardLast4', outputs: 'status', purpose: 'Deletes the card from mobile wallets.' },
  { name: 'Fraud - Alert Team Lead', inputs: 'agentName, queueName, conversationId, fraudType, reason', outputs: 'id', required: true, purpose: 'Sends the assistance alert to the team leads. Runs on the Genesys Cloud Data Actions integration, not a banking API. Needed from day one.' },
  { name: 'Fraud - Create Case', inputs: 'customerId, conversationId, fraudType, scamType, amount', outputs: 'caseRef', purpose: 'Creates the fraud case and returns its reference.' },
];

// -------------------------------------------------------- custom actions ---
const set = (v, value) => ['set', v, value];
const go = (page) => ['page', page];
const run = (name) => ['run', name];
const data = (name, sets) => ['data', name, sets];

export const customActions = [
  { name: 'ca_StartTriage', description: 'Leaves Verify. Pre-selects the triage answer from the IVR when nothing is chosen yet.', steps: [
    ['if', 'equal({{fraudType}}, "") and not equal({{in_IvrIntent}}, "")', [set('fraudType', { x: '{{in_IvrIntent}}' })], []],
    go('triage'),
  ] },
  { name: 'ca_GoToDetails', description: 'Routes from Triage to the page for the chosen fraud type.', steps: [
    ['if', 'equal({{fraudType}}, "card")', [go('card')], [
      ['if', 'equal({{fraudType}}, "scam")', [go('scam')], [go('lost')]],
    ]],
  ] },
  { name: 'ca_BackToDetails', description: 'Back button on Protect. Returns to the details page for the chosen type, or Triage if none.', steps: [
    ['if', 'equal({{fraudType}}, "")', [go('triage')], [run('ca_GoToDetails')]],
  ] },
  { name: 'ca_SwitchToScam', description: 'Card path found the customer approved the payments under instruction.', steps: [
    set('fraudType', 'scam'), set('scam_PayMethod', 'card'), go('scam'),
  ] },
  { name: 'ca_BlockCard', description: 'Blocks the card.', steps: [
    data('Fraud - Block Card', { act_CardBlocked: true }),
  ] },
  { name: 'ca_OrderReplacement', description: 'Orders the replacement card.', steps: [
    data('Fraud - Order Replacement Card', { act_ReplacementOrdered: true }),
  ] },
  { name: 'ca_RaiseRecall', description: 'Raises the payment recall.', steps: [
    data('Fraud - Raise Payment Recall', { act_RecallRaised: true }),
  ] },
  { name: 'ca_LockDigital', description: 'Locks online and mobile banking.', steps: [
    data('Fraud - Lock Digital Access', { act_DigitalLocked: true }),
  ] },
  { name: 'ca_RemoveWallet', description: 'Removes the card from mobile wallets.', steps: [
    data('Fraud - Remove Wallet Tokens', { act_WalletRemoved: true }),
  ] },
  { name: 'ca_CreateCase', description: 'Creates the fraud case and stores the reference and amount for reporting.', steps: [
    set('out_AmountAtRisk', { x: '{{dyn_AmountAtRisk}}' }),
    data('Fraud - Create Case', { caseRef: 'FR-000417', act_CaseCreated: true }),
  ] },
  { name: 'ca_AlertTeamLead', description: 'Sends a silent alert to the team leads. The call is not touched: no hold, no transfer, nothing the customer can hear.', steps: [
    data('Fraud - Alert Team Lead', { tl_Requested: true }),
  ] },
  { name: 'ca_TransferToSpecialist', description: 'Records the outcome and transfers the call to the specialist queue.', steps: [
    set('outcome', 'transferred'), ['transfer', 'Fraud Specialists'],
  ] },
  { name: 'ca_BackToVerify', description: 'Leaves the Not verified page and clears the failed outcome.', steps: [
    set('outcome', ''), go('verify'),
  ] },
  { name: 'ca_FailedVerification', description: 'Records that the caller could not be verified.', steps: [
    set('outcome', 'failed_idv'), go('unverified'),
  ] },
  { name: 'ca_Finish', description: 'Marks the script complete.', steps: [
    set('outcome', 'completed'),
    ['alert', 'Fraud report {{caseRef}} is complete. Select wrap-up code "{{dyn_WrapUp}}".'],
  ] },
];

// ------------------------------------------------------- page components ---
const v = (s, kids, extra = {}) => ({ t: 'vstack', s, kids: kids.filter(Boolean), ...extra });
const h = (s, kids, extra = {}) => ({ t: 'hstack', s, kids: kids.filter(Boolean), ...extra });
const text = (s, t, extra = {}) => ({ t: 'text', s, text: t, ...extra });
const md = (t, extra = {}) => ({ t: 'markdown', text: t, ...extra });
const chip = (s, t, vis) => ({ t: 'chip', s, text: t, vis });
const banner = (s, t, vis, kids = []) => ({ t: 'vstack', s, vis, kids: [text(null, t, { inherit: s }), ...kids] });
const say = (t, vis) => v('say', [text('sayLabel', 'SAY'), text('sayText', t)], { vis });
const button = (s, label, click, extra = {}) => ({ t: 'button', s, text: label, click, ...extra });
const field = (label, control, hint) => v('field', [text('label', label), control, hint && text('muted', hint)]);
const input = (vr, ph, extra = {}) => ({ t: 'input', var: vr, ph, ...extra });
const number = (vr) => ({ t: 'number', var: vr });
const date = (vr) => ({ t: 'date', var: vr });
const check = (vr, label, extra = {}) => ({ t: 'checkbox', var: vr, text: label, ...extra });
const radio = (vr, opts) => ({ t: 'radio', var: vr, opts });
const dropdown = (vr, opts) => ({ t: 'dropdown', var: vr, opts });
const yesNo = (label, vr, hint) => field(label, radio(vr, [['yes', 'Yes'], ['no', 'No']]), hint);
const two = (a, b) => h('row', [{ ...a, w: 1 }, { ...b, w: 1 }], { gap: true });

const STEPS = ['Verify', 'Triage', 'Details', 'Protect', 'Wrap-up'];
const stepper = (current) => h('stepper', STEPS.map((name, i) =>
  chip(i < current ? 'stepDone' : i === current ? 'stepNow' : 'stepNext', `${i + 1}  ${name}`)), { gap: true });

const header = () => h('header', [
  v(null, [text('hTitle', 'Fraud Desk'), text('hSub', 'Inbound fraud report')], { w: 1 }),
  v(null, [
    text('hMeta', '{{in_CustomerName}}  ·  Card ending {{in_CardLast4}}', { align: 'right' }),
    text('hSub', 'On call {{Scripter.Customer Call Duration}}', { align: 'right' }),
  ], { w: 1 }),
]);

const side = () => v('side', [
  v('card', [
    text('h2', 'Case so far'),
    v('row', [
      chip('chipOk', 'Verified', '{{dyn_IsVerified}}'),
      chip('chipWarn', 'Not verified', 'not {{dyn_IsVerified}}'),
      chip('chipOk', 'Card blocked', '{{act_CardBlocked}}'),
      chip('chipBad', 'Card still active', '{{dyn_CardAtRisk}} and not {{act_CardBlocked}}'),
      chip('chipOk', 'Recall raised', '{{act_RecallRaised}}'),
      chip('chipBad', 'Recall needed', '{{dyn_UrgentRecall}}'),
      chip('chipOk', 'Banking locked', '{{act_DigitalLocked}}'),
      chip('chipWarn', 'Team lead alerted', '{{tl_Requested}}'),
    ]),
    md('**Type**  {{dyn_TypeLabel}}\n**Amount reported**  {{cfg_Currency}}{{dyn_AmountAtRisk}}', { margin: '12 0 0 0' }),
    md('**Reference**  {{caseRef}}', { vis: '{{act_CaseCreated}}' }),
  ]),
  v('card', [
    text('h2', 'Need a team lead?'),
    text('muted', 'Sends a silent alert with your name and this call. The customer stays on the line and hears nothing.'),
    field('Reason (optional)', dropdown('tl_Reason', [
      ['Customer distressed or abusive', 'Customer distressed or abusive'],
      ['High value or complex case', 'High value or complex case'],
      ['Caller may not be the customer', 'Caller may not be the customer'],
      ['Need a decision or approval', 'Need a decision or approval'],
      ['Other', 'Something else'],
    ])),
    button('btnAssist', 'Alert team lead', [run('ca_AlertTeamLead')], { vis: 'not {{tl_Requested}}' }),
    banner('bannerOk', 'Team lead alerted. Carry on with the call. They will listen in, join the call or come over to you.', '{{tl_Requested}}', [
      button('btnSecondary', 'Alert again', [run('ca_AlertTeamLead')], { margin: '8 0 0 0' }),
    ]),
  ]),
  v('card', [
    text('h2', 'Never ask for'),
    md('- A full PIN or password\n- The card security code\n- A one-time passcode\n\nIf the customer starts to read one out, stop them. Keep these out of your notes too.'),
  ]),
]);

const footer = (kids) => h('footer', kids, { gap: true });
const page = (id, name, step, mainKids, footKids, extra = {}) => ({
  id, name, ...extra,
  root: v('canvas', [
    header(),
    stepper(step),
    h('body', [v('main', mainKids), side()]),
    footer(footKids),
  ]),
});

const blockCardRow = () => v(null, [
  h('row', [
    button('btnDanger', 'Block card ending {{in_CardLast4}}', [run('ca_BlockCard')], { vis: 'not {{act_CardBlocked}}' }),
    chip('chipOk', 'Card ending {{in_CardLast4}} is blocked', '{{act_CardBlocked}}'),
  ], { gap: true }),
]);

const actionRow = (title, desc, doneVar, label, ca, vis, extra = {}) => h('row', [
  v(null, [text('label', title), text('muted', desc)], { w: 1 }),
  button(extra.btn || 'btnPrimary', label, [run(ca)], { vis: `not {{${doneVar}}}`, disVar: extra.dis }),
  chip('chipOk', 'Done', `{{${doneVar}}}`),
], { vis, gap: true, valign: 'center' });

export const notes = {
  card: 'FRAUD - CARD PAYMENTS NOT RECOGNIZED | Ref {{caseRef}}\nPayments: {{card_TxnCount}} totaling {{cfg_Currency}}{{card_TotalAmount}}, first on {{card_FirstTxnDate}}, made {{card_Channel}}\nHas card: {{card_HasCard}} | Others have access: {{card_OthersAccess}} | Details shared: {{card_SharedDetails}} | Other explanations ruled out: {{card_RuledOut}}\nCard blocked: {{act_CardBlocked}} | Replacement ordered: {{act_ReplacementOrdered}}\nNotes: {{card_Notes}}',
  scam: 'FRAUD - SCAM PAYMENT | Ref {{caseRef}}\nScam type: {{scam_Type}} | First contact: {{scam_Contact}}\nSent: {{scam_PaymentCount}} payment(s) totaling {{cfg_Currency}}{{scam_Amount}} by {{scam_PayMethod}}, last payment {{scam_LastPayment}}, paid to {{scam_PaidTo}}\nStill in contact: {{scam_StillInContact}} | Remote access: {{scam_RemoteAccess}} | Credentials shared: {{scam_SharedCreds}} | More pending: {{scam_MorePending}} | Coached: {{scam_Coached}}\nRecall raised: {{act_RecallRaised}} | Banking locked: {{act_DigitalLocked}} | Card blocked: {{act_CardBlocked}}\nSupport needs: {{support_Notes}}\nNotes: {{scam_Notes}}',
  lost: 'FRAUD - LOST OR STOLEN | Ref {{caseRef}}\nItem: {{lost_What}}, {{lost_How}}, last had {{lost_When}}\nPIN exposed: {{lost_PinExposed}} | Phone locked: {{lost_PhoneLocked}} | Card in wallet: {{lost_Wallet}}\nPayments not recognized since: {{lost_Unrecognized}} ({{card_TxnCount}} totaling {{cfg_Currency}}{{card_TotalAmount}})\nPolice reference: {{lost_PoliceRef}}\nCard blocked: {{act_CardBlocked}} | Replacement ordered: {{act_ReplacementOrdered}} | Banking locked: {{act_DigitalLocked}} | Wallet removed: {{act_WalletRemoved}}',
};

const isCard = 'equal({{fraudType}}, "card")';
const isScam = 'equal({{fraudType}}, "scam")';
const isLost = 'equal({{fraudType}}, "lost")';

customActions.push({ name: 'ca_CopyNotes', description: 'Copies the case notes for the chosen fraud type to the clipboard.', steps: [
  ['if', isCard, [['copy', notes.card]], [['if', isScam, [['copy', notes.scam]], [['copy', notes.lost]]]]],
] });

export const pages = [
  // ------------------------------------------------------------ 1 Verify ---
  page('verify', 'Verify', 0, [
    say('Thank you for calling the fraud team at {{cfg_BankName}}. My name is {{Scripter.Agent Name}}. I\'m sorry you\'ve had to call about this. First I\'ll make sure your money is safe, then I\'ll take the details.'),
    v('card', [
      text('h2', 'Confirm who you are speaking to'),
      banner('bannerOk', 'Verified in the IVR. No further checks needed. Confirm you are speaking to {{in_CustomerName}}.', 'equal({{in_VerifiedLevel}}, "full")'),
      v(null, [
        banner('bannerWarn', 'Partly verified in the IVR. Complete all three checks below.', 'equal({{in_VerifiedLevel}}, "partial")'),
        text('muted', 'Tick each check as the customer passes it.', { margin: '12 0 0 0' }),
        check('idv_Identity', 'Full name and date of birth match'),
        check('idv_Address', 'Registered address matches'),
        check('idv_Knowledge', 'Answered an account question, such as a recent payment they did make'),
      ], { vis: 'not equal({{in_VerifiedLevel}}, "full")' }),
      field('Who is calling?', radio('callerType', [['holder', 'The account holder'], ['third', 'Someone on their behalf']])),
      banner('bannerInfo', 'You can block the card to protect the account, but do not share any account information. Ask for the account holder to come on the line or call back.', 'equal({{callerType}}, "third")'),
    ]),
  ], [
    button('btnSecondary', 'Can\'t verify', [run('ca_FailedVerification')]),
    button('btnPrimary', 'Continue', [run('ca_StartTriage')], { disVar: 'dyn_LockVerify' }),
  ]),

  // ------------------------------------------------------------ 2 Triage ---
  page('triage', 'Triage', 1, [
    say('Can you tell me, in your own words, what\'s happened?'),
    v('card', [
      text('h2', 'What is the customer reporting?'),
      text('muted', 'Let them finish before you choose. If they made or approved the payment themselves, choose the scam option even if a card was used.'),
      field('Fraud type', radio('fraudType', [
        ['card', 'Card payments they don\'t recognize'],
        ['scam', 'They sent money or shared details and now think it was a scam'],
        ['lost', 'Their card or phone is lost or stolen'],
      ])),
      field('Is it still happening right now?', radio('fraudOngoing', [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']])),
      banner('bannerBad', 'Act first. Go to Protect and block before you take the details.', 'equal({{fraudOngoing}}, "yes")', [
        button('btnDanger', 'Protect now', [go('protect')], { margin: '8 0 0 0' }),
      ]),
    ]),
  ], [
    button('btnSecondary', 'Back', [go('verify')]),
    button('btnPrimary', 'Continue', [run('ca_GoToDetails')], { disVar: 'dyn_LockTriage' }),
  ]),

  // ------------------------------------------------------- 3a Card details ---
  page('card', 'Details - Card', 2, [
    say('I\'m going to stop your card now so nothing else can be taken. You\'ll get a replacement, and I\'ll explain that before we finish.'),
    v('card', [text('h2', 'Stop the card'), blockCardRow()]),
    v('card', [
      text('h2', 'About the card'),
      yesNo('Do you still have the card?', 'card_HasCard'),
      yesNo('Does anyone else know the PIN or use the card?', 'card_OthersAccess'),
      yesNo('Have you recently shared card details, a PIN or a passcode by phone, text, email or a link?', 'card_SharedDetails'),
      banner('bannerWarn', 'Likely phishing. Ask how they were contacted and add it to the notes. If they approved the payments because someone told them to, switch to the scam path.', 'equal({{card_SharedDetails}}, "yes")', [
        button('btnSecondary', 'Switch to scam path', [run('ca_SwitchToScam')], { margin: '8 0 0 0' }),
      ]),
    ]),
    v('card', [
      text('h2', 'The payments'),
      two(field('Number of payments', number('card_TxnCount')), field('Total amount ({{cfg_Currency}})', number('card_TotalAmount'))),
      two(field('Date of the first one', date('card_FirstTxnDate')), field('How were they made?', dropdown('card_Channel', [
        ['online', 'Online or in an app'], ['chip and PIN', 'In store with chip and PIN'], ['contactless', 'Contactless'],
        ['ATM', 'Cash machine'], ['mixed', 'A mix'], ['unknown', 'Not sure'],
      ]))),
      say('Before I raise this, can I check a few things? Could the name be a company trading under a different name, a family member using the card, or a subscription or free trial that has renewed?'),
      check('card_RuledOut', 'Checked with the customer and none of these explain the payments'),
      banner('bannerInfo', 'If the customer now recognizes a payment, handle it as a merchant dispute, not fraud.', 'not {{card_RuledOut}}'),
    ]),
    v('card', [
      text('h2', 'Notes'),
      { t: 'input', var: 'card_Notes', ph: 'What the customer told you, in brief', multi: true },
      banner('bannerInfo', 'Do not type card numbers, PINs or security codes. If the customer needs to read card details aloud, pause the recording first.', null, [
        h('row', [
          button('btnSecondary', 'Pause recording', [['securePause']]),
          button('btnSecondary', 'Resume recording', [['endSecurePause']]),
        ], { gap: true }),
      ]),
    ]),
  ], [
    button('btnSecondary', 'Back', [go('triage')]),
    button('btnPrimary', 'Continue to Protect', [go('protect')]),
  ]),

  // ------------------------------------------------------- 3b Scam details ---
  page('scam', 'Details - Scam', 2, [
    say('I\'m really sorry this has happened. These scams are run by professionals and are designed to be convincing, and you\'ve done the right thing by calling. I\'ll ask about the payment first so we can try to stop it.'),
    v('card', [
      text('h2', 'The payment'),
      text('muted', 'Take these first. Recovery chances fall quickly after a payment leaves.'),
      two(field('How was the money sent?', dropdown('scam_PayMethod', [
        ['transfer', 'Bank transfer'], ['card', 'Card payment'], ['crypto', 'Cryptocurrency'],
        ['cash', 'Cash'], ['giftcard', 'Gift cards or vouchers'], ['other', 'Something else'],
      ])), field('When was the last payment?', dropdown('scam_LastPayment', [
        ['hour', 'Within the last hour'], ['today', 'Earlier today'], ['week', 'In the last 7 days'], ['older', 'More than 7 days ago'],
      ]))),
      two(field('Total sent ({{cfg_Currency}})', number('scam_Amount')), field('Number of payments', number('scam_PaymentCount'))),
      field('Who was it paid to?', input('scam_PaidTo', 'Name shown on the payment')),
      banner('bannerBad', 'Time critical. Raise the recall now, then carry on with the questions.', '{{dyn_UrgentRecall}}', [
        button('btnDanger', 'Raise payment recall', [run('ca_RaiseRecall')], { margin: '8 0 0 0' }),
      ]),
      banner('bannerOk', 'Recall raised with the receiving bank.', '{{act_RecallRaised}}'),
      banner('bannerInfo', 'Card payment: the card will be blocked on Protect and the payment reviewed as a card claim.', 'equal({{scam_PayMethod}}, "card")'),
      banner('bannerWarn', 'This type of payment usually cannot be recalled. Do not promise recovery. Record the details for the investigation.', 'equal({{scam_PayMethod}}, "crypto") or equal({{scam_PayMethod}}, "cash") or equal({{scam_PayMethod}}, "giftcard")'),
    ]),
    v('card', [
      text('h2', 'What happened'),
      two(field('Type of scam', dropdown('scam_Type', [
        ['impersonation', 'Someone pretending to be the bank, police or government'],
        ['purchase', 'Goods or services that never arrived'],
        ['investment', 'Investment or cryptocurrency'],
        ['romance', 'Romance or friendship'],
        ['invoice', 'Fake or changed invoice'],
        ['remote access', 'Tech support or remote access'],
        ['job', 'Job or task offer'],
        ['advance fee', 'Fee paid up front for a loan, prize or refund'],
        ['other', 'Something else'],
      ])), field('How did they first make contact?', dropdown('scam_Contact', [
        ['phone', 'Phone call'], ['text', 'Text or messaging app'], ['social media', 'Social media'],
        ['email', 'Email'], ['website', 'Website or online ad'], ['in person', 'In person'],
      ]))),
      yesNo('Are they still in contact with you?', 'scam_StillInContact'),
      say('Please don\'t reply to them or tell them you\'ve spoken to us. They may call back pretending to be the bank or the police and offer to get your money back. We will never ask you to move money to keep it safe.', 'equal({{scam_StillInContact}}, "yes")'),
      yesNo('Did they ask you to install software or share your screen?', 'scam_RemoteAccess'),
      banner('bannerBad', 'The device may be compromised. Lock online and mobile banking on Protect. Advise the customer not to bank on that device until the software is removed and it has been checked.', 'equal({{scam_RemoteAccess}}, "yes")'),
      yesNo('Did you give them any login details or passcodes?', 'scam_SharedCreds'),
      yesNo('Are any more payments scheduled or pending?', 'scam_MorePending'),
      banner('bannerWarn', 'Cancel the pending payments in the banking system before you move on.', 'equal({{scam_MorePending}}, "yes")'),
      yesNo('Did they tell you what to say if the bank asked about the payment?', 'scam_Coached', 'Ask without blame. This helps the investigation and is common in these scams.'),
    ]),
    v('card', [
      text('h2', 'Support'),
      say('Is there anything that would make this easier for you to deal with, or anything you\'d like us to know?'),
      check('support_Needed', 'Customer may need extra support'),
      v(null, [
        field('In their words', input('support_Notes', 'For example: distressed, under pressure from someone, money worries')),
        text('muted', 'Record this in the case system under your vulnerable customer policy. It is not saved as participant data.'),
      ], { vis: '{{support_Needed}}' }),
    ]),
    v('card', [
      text('h2', 'Notes'),
      { t: 'input', var: 'scam_Notes', ph: 'What the customer told you, in brief', multi: true },
    ]),
  ], [
    button('btnSecondary', 'Back', [go('triage')]),
    button('btnPrimary', 'Continue to Protect', [go('protect')]),
  ]),

  // ------------------------------------------------ 3c Lost / stolen details ---
  page('lost', 'Details - Lost or stolen', 2, [
    say('Let\'s stop it being used straight away. Can I check what\'s missing?'),
    v('card', [
      text('h2', 'What is missing'),
      field('Item', radio('lost_What', [['card', 'Card'], ['phone', 'Phone with the banking app'], ['both', 'Both']])),
      two(field('Lost or stolen?', radio('lost_How', [['lost', 'Lost'], ['stolen', 'Stolen']])), field('When did you last have it?', dropdown('lost_When', [
        ['within the last hour', 'Within the last hour'], ['today', 'Earlier today'], ['yesterday', 'Yesterday'],
        ['2 to 7 days ago', '2 to 7 days ago'], ['over a week ago', 'More than a week ago'], ['not sure', 'Not sure'],
      ]))),
      v(null, [blockCardRow()], { vis: 'not equal({{lost_What}}, "phone")' }),
    ]),
    v('card', [
      text('h2', 'The card'),
      yesNo('Was the PIN written down or kept with the card?', 'lost_PinExposed'),
      banner('bannerWarn', 'Treat the PIN as known. The replacement card needs a new PIN.', 'equal({{lost_PinExposed}}, "yes")'),
    ], { vis: 'not equal({{lost_What}}, "phone")' }),
    v('card', [
      text('h2', 'The phone'),
      yesNo('Is the phone locked with a passcode, fingerprint or face?', 'lost_PhoneLocked'),
      yesNo('Is your card saved in a mobile wallet on that phone?', 'lost_Wallet'),
      say('Please also call your mobile network to block the SIM, so nobody can receive your calls or codes.'),
    ], { vis: 'equal({{lost_What}}, "phone") or equal({{lost_What}}, "both")' }),
    v('card', [
      text('h2', 'Since it went missing'),
      yesNo('Are there any payments since then that you don\'t recognize?', 'lost_Unrecognized'),
      v(null, [
        two(field('Number of payments', number('card_TxnCount')), field('Total amount ({{cfg_Currency}})', number('card_TotalAmount'))),
      ], { vis: 'equal({{lost_Unrecognized}}, "yes")' }),
      v(null, [
        say('As it was stolen, please report it to the police and keep the reference number.'),
        field('Police reference, if they have one', input('lost_PoliceRef', 'Optional')),
      ], { vis: 'equal({{lost_How}}, "stolen")' }),
    ]),
  ], [
    button('btnSecondary', 'Back', [go('triage')]),
    button('btnPrimary', 'Continue to Protect', [go('protect')]),
  ]),

  // ----------------------------------------------------------- 4 Protect ---
  page('protect', 'Protect', 3, [
    say('Here\'s what I\'m doing right now to secure your account.'),
    v('card', [
      text('h2', 'Protective actions'),
      text('muted', 'Only the actions that apply to this report are shown.'),
      actionRow('Block card ending {{in_CardLast4}}', 'Stops all new payments and withdrawals.', 'act_CardBlocked', 'Block card', 'ca_BlockCard', '{{dyn_CardAtRisk}}', { btn: 'btnDanger' }),
      actionRow('Raise payment recall', 'Asks the receiving bank to freeze and return the money.', 'act_RecallRaised', 'Raise recall', 'ca_RaiseRecall', '{{dyn_RecallApplies}}', { btn: 'btnDanger' }),
      actionRow('Lock online and mobile banking', 'Signs out every device. The customer sets new login details afterwards.', 'act_DigitalLocked', 'Lock banking', 'ca_LockDigital', '{{dyn_DigitalAtRisk}}'),
      actionRow('Remove card from mobile wallets', 'Deletes the card from phone and watch wallets.', 'act_WalletRemoved', 'Remove', 'ca_RemoveWallet', '{{dyn_WalletAtRisk}}'),
      v(null, [
        check('act_AddressConfirmed', 'Delivery address confirmed with the customer', { margin: '12 0 0 0' }),
        actionRow('Order replacement card', 'Sent to the registered address. Available once the card is blocked.', 'act_ReplacementOrdered', 'Order card', 'ca_OrderReplacement', null, { dis: 'dyn_LockReplacement' }),
      ], { vis: '{{dyn_CardAtRisk}}' }),
      actionRow('Create fraud case', 'Logs the report for investigation and gives the customer a reference.', 'act_CaseCreated', 'Create case', 'ca_CreateCase', null),
      field('Case reference', input('caseRef', 'From the case system'), 'Filled in automatically once the Create Case data action is connected. Until then, type the reference from the case system.'),
    ]),
    banner('bannerWarn', 'The card is still active. Block it before you continue.', '{{dyn_CardAtRisk}} and not {{act_CardBlocked}}'),
  ], [
    button('btnSecondary', 'Back', [run('ca_BackToDetails')]),
    button('btnPrimary', 'Continue to Wrap-up', [go('wrapup')], { disVar: 'dyn_LockWrapUp' }),
  ]),

  // ----------------------------------------------------------- 5 Wrap-up ---
  page('wrapup', 'Wrap-up', 4, [
    v('card', [
      text('h2', 'Tell the customer what happens next'),
      say('Your reference is {{caseRef}}. Your card ending {{in_CardLast4}} is blocked and a new one will arrive within {{cfg_CardDeliveryEta}}. We\'ll review the payments you\'ve told me about and tell you the outcome within {{cfg_DecisionTimeframe}}. You don\'t need to do anything else unless we contact you.', isCard),
      say('Your reference is {{caseRef}}. We will investigate and do what we can to recover the money. I can\'t promise we\'ll get it back, but we will tell you the outcome within {{cfg_DecisionTimeframe}}. Please also report this to {{cfg_ReportingBody}}.', isScam),
      say('Your reference is {{caseRef}}. A replacement card will arrive within {{cfg_CardDeliveryEta}}. If you find the old card, please destroy it, as it can\'t be unblocked.', isLost),
    ]),
    v('card', [
      text('h2', 'Safety advice'),
      md('- We will never ask you to move money to keep it safe, or ask for your full PIN, password or a passcode.\n- If someone calls saying they are from the bank, hang up and call the number on the back of your card.\n- Be careful of anyone who offers to recover your money for a fee.'),
      md('- Change the password on your email and any account that used the same one.', { vis: `${isScam} or equal({{card_SharedDetails}}, "yes")` }),
      check('adviceGiven', 'Safety advice given'),
    ]),
    v('card', [
      text('h2', 'Case notes'),
      text('muted', 'Built from your answers. Copy them into the case record.'),
      md(notes.card, { vis: isCard, box: true }),
      md(notes.scam, { vis: isScam, box: true }),
      md(notes.lost, { vis: isLost, box: true }),
      h('row', [
        button('btnSecondary', 'Copy notes', [run('ca_CopyNotes')]),
      ]),
      banner('bannerInfo', 'Wrap-up code to select: {{dyn_WrapUp}}'),
    ]),
    say('Is there anything else I can help you with today? Thank you for calling {{cfg_BankName}}.'),
  ], [
    button('btnSecondary', 'Back', [go('protect')]),
    button('btnSecondary', 'Transfer to fraud specialist', [run('ca_TransferToSpecialist')]),
    button('btnPrimary', 'Finish', [run('ca_Finish')]),
  ]),

  // ------------------------------------------------------ 6 Not verified ---
  page('unverified', 'Not verified', 0, [
    say('I\'m sorry, I haven\'t been able to confirm your identity, so I can\'t discuss the account. To keep it safe I can still block the card. To go further, please call back with your details to hand, or visit a branch with photo ID.'),
    v('card', [
      text('h2', 'Protect without disclosing'),
      text('muted', 'Blocking the card is allowed without verification. Do not confirm balances, payments or personal details.'),
      blockCardRow(),
      banner('bannerInfo', 'Wrap-up code to select: Fraud - Verification failed'),
    ]),
  ], [
    button('btnSecondary', 'Back to Verify', [run('ca_BackToVerify')]),
  ]),
];

export const meta = {
  name: 'Fraud Desk - Inbound',
  startPage: 'verify',
  wrapUpCodes: ['Fraud - Card', 'Fraud - Scam', 'Fraud - Lost or Stolen', 'Fraud - Other', 'Fraud - Verification failed'],
  transferQueue: 'Fraud Specialists',
  previewBuiltins: {
    'Scripter.Agent Name': 'Jordan Lee',
    'Scripter.Customer Call Duration': '00:00',
    'Scripter.Interaction Id': '5f1c2a9e-preview',
  },
};
