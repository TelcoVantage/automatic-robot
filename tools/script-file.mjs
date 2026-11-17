// Converts script/definition.mjs into a Genesys Cloud .script file (the JSON
// that Script Designer exports and imports).
//
// The structure follows two sources:
//   - the example exports in Genesys's own Terraform provider
//     (MyPureCloud/terraform-provider-genesyscloud, genesyscloud_script), which
//     are uploaded through the same endpoint the GUI import uses;
//   - the property and action schemas in the Scripter web app.
// SCHEMA below records, per component, which property types the editor accepts.
// check() fails the build if the output uses anything outside it.
import { createHash } from 'node:crypto';

const FONT = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
const ORG = '00000000-0000-0000-0000-000000000000';
const BUILTINS = {
  'Scripter.Agent Name': 'scripter.agentName',
  'Scripter.Customer Call Duration': 'scripter.customersCallDuration',
  'Scripter.Interaction Id': 'scripter.interactionId',
  'Scripter.Queue Name': 'scripter.queueName',
};
const TYPE = { String: 'string', Number: 'number', 'True/False': 'boolean' };

const COLOR = ['null', 'color', 'variable'];
const BASE = { margin: ['spacing'], alignment: ['alignment'], width: ['sizing'], height: ['sizing'], visible: ['variable', 'booleanExpression'], preserveLayoutLocation: ['boolean'] };
const FONTS = { bold: ['boolean'], italic: ['boolean'], underline: ['boolean'], font: ['font'], fontSize: ['integer'], justification: ['text'] };
const VALUE = { value: ['variable'], changeAction: ['action'], disabled: ['variable'] };
const CONTAINER = { ...BASE, backgroundColor: COLOR, padding: ['spacing'], childArrangement: ['childArrangement'], border: ['border'] };
const SCHEMA = {
  verticalStackContainer: CONTAINER,
  horizontalStackContainer: CONTAINER,
  text: { ...BASE, text: ['interpolatedText'], ...FONTS, backgroundColor: COLOR, textColor: COLOR, padding: ['spacing'] },
  markdown: { ...BASE, text: ['interpolatedText'], fontSize: ['integer'] },
  button: { ...BASE, text: ['interpolatedText'], clickAction: ['action', 'interpolatedText'], backgroundColor: COLOR, textColor: COLOR, ...FONTS, disabled: ['variable'] },
  checkbox: { ...BASE, text: ['interpolatedText'], ...FONTS, textColor: COLOR, clickAction: ['action'], ...VALUE },
  radioButton: { ...BASE, text: ['interpolatedText'], ...FONTS, textColor: COLOR, selectedValueText: ['interpolatedText'], ...VALUE },
  dropdown: { ...BASE, placeholderText: ['interpolatedText'], options: ['list', 'listPair'], doesRequireValue: ['boolean', 'variable'], label: ['interpolatedText'], ...VALUE },
  input: { ...BASE, placeholderText: ['interpolatedText'], label: ['interpolatedText'], doesRequireValue: ['boolean', 'variable'], isMultilineInput: ['boolean'], isPasswordInput: ['boolean'], ...VALUE },
  numeric: { ...BASE, minValue: ['null', 'integer'], maxValue: ['null', 'integer'], label: ['interpolatedText'], ...VALUE },
  date: { ...BASE, doesIncludeTime: ['boolean'], doesRequireValue: ['boolean', 'variable'], label: ['interpolatedText'], ...VALUE },
};
const ACTIONS = new Set(['scripter.changePage', 'scripter.setVariable', 'scripter.alert', 'scripter.copyToClipboard', 'scripter.blindTransfer', 'screenPop.securePause', 'screenPop.secureUnpause']);

export function toScriptFile({ styles, variables, customActions, dataActions, pages, meta }) {
  const uuid = (key) => {
    const h = createHash('sha1').update(`${meta.name}:${key}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };
  const scriptId = uuid('script'), versionId = uuid('version');
  const varByName = Object.fromEntries(variables.map((v) => [v.name, v]));
  const varId = (name) => { if (!varByName[name]) throw new Error(`Unknown variable ${name}`); return uuid(`var:${name}`); };
  const pageId = (id) => uuid(`page:${id}`);
  const caByName = Object.fromEntries(customActions.map((a) => [a.name, a]));
  const caId = (name) => { if (!caByName[name]) throw new Error(`Unknown custom action ${name}`); return uuid(`ca:${name}`); };

  // {{My Variable}} -> {{<variable id>}}; built-ins -> {{scripter.xxx}}
  const tr = (s) => String(s).replace(/\{\{([^}]+)\}\}/g, (_, n) => `{{${BUILTINS[n.trim()] || varId(n.trim())}}}`);
  const T = (typeName, value) => (value === undefined ? { typeName } : { typeName, value });
  const four = (s, d = [0, 0, 0, 0]) => {
    if (s === undefined || s === null) return [...d];
    const n = String(s).split(' ').map(Number);
    return n.length === 1 ? [n[0], n[0], n[0], n[0]] : n.length === 2 ? [n[0], n[1], n[0], n[1]] : n;
  };
  const color = (hex) => (hex ? T('color', hex.toLowerCase()) : T('null'));
  const noAction = () => T('action', {});
  const visible = (expr) => {
    if (!expr) return T('variable');
    const m = /^\{\{([^}]+)\}\}$/.exec(expr);
    return m && varByName[m[1]] ? T('variable', varId(m[1])) : T('booleanExpression', tr(expr));
  };
  const fonts = (size, bold, justification = 'left') => ({
    bold: T('boolean', !!bold), italic: T('boolean', false), underline: T('boolean', false),
    font: T('font', FONT), fontSize: T('integer', size), justification: T('text', justification),
  });

  // ---- actions -----------------------------------------------------------
  const setArg = (name, value) => {
    const kind = TYPE[varByName[name].type];
    let v;
    if (value && typeof value === 'object') {
      v = kind === 'string' ? T('interpolatedText', tr(value.x)) : T(kind === 'number' ? 'mathExpression' : 'booleanExpression', tr(value.x));
    } else v = T(kind === 'string' ? 'interpolatedText' : kind, value);
    return T('variableWithValue', { variable: T('variable', varId(name)), variableTypeName: kind, valueOfVariableProperty: v });
  };
  const builtin = ([op, a, b]) => {
    switch (op) {
      case 'set': return { actionName: 'scripter.setVariable', actionArgumentValues: [setArg(a, b)] };
      case 'page': return { actionName: 'scripter.changePage', actionArgumentValues: [T('page', pageId(a))] };
      case 'alert': return { actionName: 'scripter.alert', actionArgumentValues: [T('interpolatedText', tr(a))] };
      case 'copy': return { actionName: 'scripter.copyToClipboard', actionArgumentValues: [T('interpolatedText', tr(a))] };
      // The queue is org-specific, so it is left unselected for the builder to choose.
      case 'transfer': return { actionName: 'scripter.blindTransfer', actionArgumentValues: [T('queue')] };
      case 'securePause': return { actionName: 'screenPop.securePause', actionArgumentValues: [] };
      case 'endSecurePause': return { actionName: 'screenPop.secureUnpause', actionArgumentValues: [] };
      default: throw new Error(`No built-in action for ${op}`);
    }
  };
  const block = (steps) => steps.flatMap((s) => {
    const [op, a, b, c] = s;
    if (op === 'run') return block(caByName[a].steps); // inline, so no nested custom action calls
    if (op === 'if') return [{ type: 'if', condition: { type: 'dynamic', dynamicValue: T('booleanExpression', tr(a)) }, ifBlock: block(b), elseBlock: block(c) }];
    if (op === 'data') {
      // Data action IDs belong to the target org, so they cannot be in the file.
      const da = dataActions.find((d) => d.name === a);
      if (da.required) {
        return [
          { type: 'comment', text: `Replace the alert below with Data Actions > Execute Data Action "${a}", then Set Variable for the flag. See the build guide.` },
          { type: 'action', ...builtin(['alert', `Not connected yet: add the "${a}" data action to this button before go-live.`]) },
        ];
      }
      const flags = Object.entries(b).filter(([, val]) => typeof val === 'boolean').map(([k, val]) => ({ type: 'action', ...builtin(['set', k, val]) }));
      return [{ type: 'comment', text: `Phase 2: add Data Actions > Execute Data Action "${a}" above this step.` }, ...flags];
    }
    return [{ type: 'action', ...builtin(s) }];
  });
  const clickAction = (steps) => {
    if (steps.length !== 1 || steps[0][0] === 'if' || steps[0][0] === 'data') throw new Error('A click must be one built-in action or one custom action');
    return steps[0][0] === 'run' ? T('action', { actionName: caId(steps[0][1]) }) : T('action', builtin(steps[0]));
  };

  // ---- components --------------------------------------------------------
  const base = (n, ctx, { margin, width }) => {
    const m = four(margin);
    if (ctx.gapRight) m[1] += 10;
    return {
      margin: T('spacing', m),
      alignment: T('alignment', ctx.valign ? 'center' : n.align === 'right' ? 'end' : 'start'),
      width: T('sizing', width),
      height: T('sizing', ctx.root ? { sizeType: 'stretch', size: 100 } : { sizeType: 'auto' }),
      visible: visible(n.vis),
      preserveLayoutLocation: T('boolean', false),
    };
  };
  const stretch = (weight = 1) => ({ sizeType: 'stretch', size: weight * 100 });
  const auto = { sizeType: 'auto' };
  const widthOf = (n, ctx, st, fill) => {
    if (n.w) return stretch(n.w);
    if (st.width) return stretch(Number(st.width.match(/\d+/)[0]));
    return ctx.inRow || !fill ? auto : stretch();
  };
  const valueProps = (n) => ({ value: T('variable', varId(n.var)), changeAction: noAction(), disabled: T('variable') });
  const mdText = (t) => {
    const lines = t.split('\n').filter((l) => l.trim());
    return lines.map((l, i) => l + (i === lines.length - 1 ? '' : l.startsWith('- ') && lines[i + 1].startsWith('- ') ? '\n' : '\n\n')).join('');
  };

  const comp = (n, ctx) => {
    const st = (n.s && styles[n.s]) || {};
    if (n.t === 'vstack' || n.t === 'hstack') {
      const row = n.t === 'hstack';
      return {
        type: row ? 'horizontalStackContainer' : 'verticalStackContainer',
        properties: {
          ...base(n, ctx, { margin: n.margin ?? st.margin, width: widthOf(n, ctx, st, true) }),
          backgroundColor: color(st.bg),
          padding: T('spacing', four(st.pad)),
          childArrangement: T('childArrangement', n.s === 'footer' ? 'end' : 'start'),
          border: T('border', { width: 0, style: 'solid', color: '000000' }),
        },
        children: n.kids.map((k, i) => comp(k, { inRow: row, gapRight: row && n.gap && i < n.kids.length - 1, valign: row && !!n.valign })),
      };
    }
    if (n.t === 'text' || n.t === 'chip') {
      const look = n.inherit ? styles[n.inherit] : st;
      const chip = n.t === 'chip';
      return { type: 'text', properties: {
        ...base(n, ctx, { margin: n.margin ?? st.margin, width: widthOf(n, ctx, st, !chip) }),
        text: T('interpolatedText', tr(n.text)),
        ...fonts(look.size || 14, look.bold, n.align === 'right' ? 'right' : 'left'),
        backgroundColor: color(chip ? st.bg : null),
        textColor: color(look.color),
        padding: T('spacing', chip ? four(st.pad) : 0),
      } };
    }
    if (n.t === 'markdown') {
      const md = (node, c) => ({ type: 'markdown', properties: {
        ...base(node, c, { margin: node.margin, width: widthOf(node, c, {}, true) }),
        text: T('interpolatedText', tr(mdText(n.text))), fontSize: T('integer', n.box ? 13 : 14),
      } });
      if (!n.box) return md(n, ctx);
      // "Boxed" Markdown: a tinted container carries the visibility rule.
      return comp({ t: 'vstack', s: 'bannerInfo', vis: n.vis, kids: [{ t: 'raw', build: (c) => md({}, c) }] }, ctx);
    }
    if (n.t === 'raw') return n.build(ctx);
    if (n.t === 'button') {
      return { type: 'button', properties: {
        ...base(n, ctx, { margin: n.margin ?? st.margin, width: auto }),
        text: T('interpolatedText', tr(n.text)),
        clickAction: clickAction(n.click),
        backgroundColor: color(st.bg), textColor: color(st.color),
        ...fonts(st.size || 14, st.bold, 'center'),
        disabled: n.disVar ? T('variable', varId(n.disVar)) : T('variable'),
      } };
    }
    if (n.t === 'checkbox') {
      return { type: 'checkbox', properties: {
        ...base(n, ctx, { margin: n.margin ?? '8 0 0 0', width: widthOf(n, ctx, {}, true) }),
        text: T('interpolatedText', tr(n.text)), ...fonts(14, false), textColor: color(styles.bodyText.color),
        clickAction: noAction(), ...valueProps(n),
      } };
    }
    if (n.t === 'radio') {
      // One Radio Button component per option; sharing a variable makes them a group.
      const inline = n.opts.every(([, label]) => label.length < 12);
      const option = ([val, label]) => ({ t: 'raw', build: (c) => ({ type: 'radioButton', properties: {
        ...base({}, c, { margin: inline ? '8 18 0 0' : '8 0 0 0', width: c.inRow ? auto : stretch() }),
        text: T('interpolatedText', label), ...fonts(14, false), textColor: color(styles.bodyText.color),
        selectedValueText: T('interpolatedText', val), ...valueProps(n),
      } }) });
      return comp({ t: inline ? 'hstack' : 'vstack', vis: n.vis, kids: n.opts.map(option) }, ctx);
    }
    const field = { margin: n.margin ?? '4 0 0 0', width: widthOf(n, ctx, {}, true) };
    const label = { label: T('interpolatedText', '') };
    if (n.t === 'dropdown') {
      return { type: 'dropdown', properties: {
        ...base(n, ctx, field),
        placeholderText: T('interpolatedText', 'Select'),
        options: T('list', n.opts.map(([val, text]) => [T('interpolatedText', val), T('interpolatedText', text)])),
        doesRequireValue: T('boolean', false), ...label, ...valueProps(n),
      } };
    }
    if (n.t === 'input') {
      return { type: 'input', properties: {
        ...base(n, ctx, field),
        placeholderText: T('interpolatedText', n.ph || ''), ...label, doesRequireValue: T('boolean', false),
        isMultilineInput: T('boolean', !!n.multi), isPasswordInput: T('boolean', false), ...valueProps(n),
      } };
    }
    if (n.t === 'number') {
      return { type: 'numeric', properties: { ...base(n, ctx, field), minValue: T('integer', 0), maxValue: T('null'), ...label, ...valueProps(n) } };
    }
    if (n.t === 'date') {
      return { type: 'date', properties: { ...base(n, ctx, field), doesIncludeTime: T('boolean', false), doesRequireValue: T('boolean', false), ...label, ...valueProps(n) } };
    }
    throw new Error(`No component mapping for ${n.t}`);
  };

  const off = { properties: { enabled: T('boolean', false) } };
  const on = { properties: { enabled: T('boolean', true) } };
  const file = {
    id: scriptId,
    name: meta.name,
    organizationId: ORG,
    versionId,
    startPageId: pageId(meta.startPage),
    pages: pages.map((p) => ({
      id: pageId(p.id), name: p.name, organizationId: ORG, versionId, scriptId,
      properties: { onLoadAction: noAction(), backgroundColor: T('null') },
      dataVersion: 0,
      rootContainer: comp(p.root, { root: true }),
    })),
    features: {
      dialer: { properties: { enabled: T('boolean', false), contactListId: T('text', ''), onContactDataLoadAction: noAction() } },
      scripter: on,
      screenPop: on, // "Inbound": input variables from Set Screen Pop, Secure Pause actions
      callback: off, chat: off, email: off, message: off,
      bridge: off, // "Data Actions": turn on when the first data action is added
      uuiData: off, customerSecuredData: off, list: off, workItem: off,
    },
    variables: variables.map((v) => ({
      id: varId(v.name), name: v.name, description: v.description,
      type: { isDynamic: v.kind === 'Dynamic', isList: false, name: TYPE[v.type] },
      value: v.kind === 'Dynamic' ? tr(v.expr) : v.default,
      input: !!v.input, output: !!v.output,
    })),
    customActions: customActions.map((a) => ({ id: caId(a.name), name: a.name, action: { block: block(a.steps) } })),
    dataVersion: 0,
  };
  check(file);
  return file;
}

// Independent pass over the finished file: every reference must resolve and
// every property must use a type the editor accepts for that component.
function check(file) {
  const problems = [];
  const varIds = new Set(file.variables.map((v) => v.id));
  const pageIds = new Set(file.pages.map((p) => p.id));
  const caIds = new Set(file.customActions.map((a) => a.id));
  const builtinRefs = new Set(Object.values(BUILTINS));
  const refs = (s, where) => { for (const m of String(s).matchAll(/\{\{([^}]+)\}\}/g)) if (!varIds.has(m[1]) && !builtinRefs.has(m[1])) problems.push(`${where}: unresolved reference ${m[1]}`); };
  const action = (a, where) => {
    if (!a || !a.actionName) return;
    if (!ACTIONS.has(a.actionName) && !caIds.has(a.actionName)) problems.push(`${where}: unknown action ${a.actionName}`);
    for (const arg of a.actionArgumentValues || []) {
      if (arg.typeName === 'page' && !pageIds.has(arg.value)) problems.push(`${where}: unknown page`);
      if (arg.typeName === 'interpolatedText') refs(arg.value, where);
      if (arg.typeName === 'variableWithValue') {
        if (!varIds.has(arg.value.variable.value)) problems.push(`${where}: set of unknown variable`);
        const v = arg.value.valueOfVariableProperty;
        if (typeof v.value === 'string') refs(v.value, where);
      }
    }
  };
  const steps = (list, where) => { for (const s of list) {
    if (s.type === 'action') action(s, where);
    else if (s.type === 'if') { refs(s.condition.dynamicValue.value, where); steps(s.ifBlock, where); steps(s.elseBlock, where); }
    else if (s.type !== 'comment') problems.push(`${where}: unknown step type ${s.type}`);
  } };
  const walk = (c, where) => {
    const schema = SCHEMA[c.type];
    if (!schema) { problems.push(`${where}: unknown component ${c.type}`); return; }
    for (const [key, p] of Object.entries(c.properties)) {
      if (!schema[key]) problems.push(`${where}: ${c.type} has no property ${key}`);
      else if (!schema[key].includes(p.typeName)) problems.push(`${where}: ${c.type}.${key} cannot be ${p.typeName}`);
      if (p.typeName === 'variable' && p.value !== undefined && !varIds.has(p.value)) problems.push(`${where}: ${c.type}.${key} bound to unknown variable`);
      if (p.typeName === 'interpolatedText' || p.typeName === 'booleanExpression') refs(p.value, where);
      if (p.typeName === 'action') action(p.value, where);
      if (p.typeName === 'list') for (const row of p.value) for (const cell of row) refs(cell.value, where);
    }
    for (const key of Object.keys(schema)) if (!(key in c.properties)) problems.push(`${where}: ${c.type} is missing ${key}`);
    if (c.children) { if (!c.type.endsWith('Container')) problems.push(`${where}: ${c.type} cannot have children`); c.children.forEach((k) => walk(k, where)); }
  };
  if (!pageIds.has(file.startPageId)) problems.push('startPageId does not match a page');
  for (const v of file.variables) if (v.type.isDynamic) refs(v.value, `variable ${v.name}`);
  for (const a of file.customActions) steps(a.action.block, `custom action ${a.name}`);
  for (const p of file.pages) walk(p.rootContainer, `page ${p.name}`);
  const ids = [file.id, ...varIds, ...pageIds, ...caIds];
  if (new Set(ids).size !== ids.length) problems.push('duplicate ids');
  if (problems.length) throw new Error('Script file check failed:\n' + [...new Set(problems)].join('\n'));
}
