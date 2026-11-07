/**
 * Check and index the requirements in docs/.
 *
 * Usage:
 *   node scripts/requirements.ts check   # validate IDs, statuses, anchors and links
 *   node scripts/requirements.ts build   # regenerate docs/requirements/traceability.md
 *
 * Also available as `pnpm docs:check` and `pnpm docs:build`. The conventions this script
 * enforces are described in docs/requirements/README.md. It uses only Node built-ins and
 * runs directly on Node 24, which strips the TypeScript types itself.
 *
 * It also reads the prototypes in docs/design/screens: the comment at the top of each names the
 * requirements the screen fulfils, and each of those requirements names the screen back in its
 * **Screens:** field. `check` fails when the two sides differ.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const REQUIREMENTS = path.join(DOCS, 'requirements');
const MATRIX = path.join(REQUIREMENTS, 'traceability.md');
const SCREENS_DIR = path.join(DOCS, 'design', 'screens');
/** The overview of the screens is no screen of its own. */
const NOT_A_SCREEN = new Set(['index']);
const REPO_URL = 'https://github.com/immoscoop-be/immoscoop-dataplatform-datahub';

const ID = String.raw`(?:FR|TR|NFR|DEC|EC|OP)-[A-Z]{2,3}-\d{2,3}`;
const HEADING_KINDS = new Set(['FR', 'EC', 'TR', 'NFR']);
const LIST_KINDS = new Set(['DEC', 'OP']);
const STATUSES = ['Proposed', 'Specified', 'Implemented', 'Verified', 'Withdrawn'];

const HEADING_DEF = new RegExp(String.raw`^#{2,4}\s+(${ID})\s+·\s+(.+?)\s*$`);
const LIST_DEF = new RegExp(String.raw`^\s*-\s+(?:\[([ x])\]\s+)?<a id="([^"]+)"></a>\*\*(${ID})\*\*\s+·\s+(.+)$`);
const ANCHOR_LINE = /^<a id="([^"]+)"><\/a>\s*$/;
const ANCHOR = /<a id="([^"]+)"><\/a>/g;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const STATUS = /\*\*Status:\*\*\s+([A-Za-z]+)/;
const ALIAS = /\*\*Confluence:\*\*\s+([A-Z]+-\d+)/;
/** A field of the status line runs until the next field (` · **…:**`) or the end of the line. */
const field = (name: string): RegExp => new RegExp(String.raw`\*\*${name}:\*\*(.*?)(?=\s+·\s+\*\*|$)`, 'm');
const REALISES = field('Realises');
const APPLIES = field('Applies to');
const SCREENS = field('Screens');
const LINK = /(?<!!)\[([^\]]*)\]\(([^)\s]+)\)/g;
/** The comment at the top of a screen, and its line with the requirements the screen fulfils. */
const SCREEN_COMMENT = /<!--([\s\S]*?)-->/;
const SCREEN_REQUIREMENTS = /^\s*Requirements:(.*)$/;
const MENTION = new RegExp(String.raw`(?<![\w-])(${ID})(?![\w-])`, 'g');
const TRAILER = /^\W*(Implements|Refs):\s*(.+)$/gm;
const FENCE = /^(```|~~~)/;

interface Item {
  id: string;
  kind: string;
  title: string;
  file: string;
  line: number;
  status: string;
  alias: string;
  realises: string[];
  appliesTo: string[];
  /** The screens it names in its **Screens:** field, by file name without `.html`. */
  screens: string[];
}

interface Screen {
  name: string;
  file: string;
  /** The line of its `Requirements:` line, for messages. */
  line: number;
  requirements: string[];
}

interface Doc {
  path: string;
  lines: string[];
  title: string;
  anchors: Set<string>;
}

interface Commit {
  full: string;
  short: string;
  date: string;
  kind: string;
}

const rel = (file: string): string => path.relative(ROOT, file).split(path.sep).join('/');

/** Templates contain placeholder IDs; the matrix is generated from everything else. */
const isSkipped = (file: string): boolean => file.split(path.sep).includes('_templates') || file === MATRIX;

const mentions = (text: string): string[] => [...text.matchAll(MENTION)].map((m) => m[1] as string);

/** Blanks out fenced code blocks, inline code and HTML comments, keeping line numbers. */
function stripCode(lines: string[]): string[] {
  const out: string[] = [];
  let inFence = false;
  let inComment = false;
  for (let line of lines) {
    if (FENCE.test(line.trim())) {
      inFence = !inFence;
      out.push('');
      continue;
    }
    if (inFence) {
      out.push('');
      continue;
    }
    if (inComment) {
      const end = line.indexOf('-->');
      if (end === -1) {
        out.push('');
        continue;
      }
      inComment = false;
      line = line.slice(end + 3);
    }
    line = line.replace(/<!--.*?-->/g, '');
    const start = line.indexOf('<!--');
    if (start !== -1) {
      inComment = true;
      line = line.slice(0, start);
    }
    out.push(line.replace(/`[^`]*`/g, ''));
  }
  return out;
}

function githubSlug(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll('`', '')
    .replaceAll('*', '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, '')
    .replaceAll(' ', '-');
}

function markdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...markdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files.sort();
}

function parseDoc(file: string): Doc {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  if (lines.at(-1) === '') {
    lines.pop();
  }
  const doc: Doc = { path: file, lines, title: '', anchors: new Set() };
  const seen = new Map<string, number>();
  for (const line of stripCode(lines)) {
    const heading = HEADING.exec(line);
    if (heading) {
      const [, hashes = '', text = ''] = heading;
      if (!doc.title && hashes.length === 1) {
        doc.title = text;
      }
      const slug = githubSlug(text);
      const count = seen.get(slug) ?? 0;
      doc.anchors.add(count === 0 ? slug : `${slug}-${count}`);
      seen.set(slug, count + 1);
    }
    for (const match of line.matchAll(ANCHOR)) {
      doc.anchors.add(match[1] as string);
    }
  }
  return doc;
}

function loadDocs(): Map<string, Doc> {
  return new Map(markdownFiles(DOCS).map((file) => [file, parseDoc(file)]));
}

function parseItems(docs: Map<string, Doc>, errors: string[]): Map<string, Item> {
  const items = new Map<string, Item>();
  for (const [file, doc] of docs) {
    if (isSkipped(file)) {
      continue;
    }
    const lines = stripCode(doc.lines);
    lines.forEach((line, i) => {
      const where = `${rel(file)}:${i + 1}`;
      let item: Item | undefined;
      const heading = HEADING_DEF.exec(line);
      if (heading) {
        const [, id = '', title = ''] = heading;
        item = newItem(id, title, file, i + 1);
        const previous = lines.slice(0, i).findLast((l) => l.trim()) ?? '';
        const above = ANCHOR_LINE.exec(previous.trim());
        if (!above || above[1] !== id.toLowerCase()) {
          errors.push(`${where}: ${id} needs the line <a id="${id.toLowerCase()}"></a> right above it`);
        }
        if (!HEADING_KINDS.has(item.kind)) {
          errors.push(`${where}: ${id} must be a list item, not a heading`);
        }
        const block: string[] = [];
        for (const next of lines.slice(i + 1)) {
          if (HEADING.test(next)) {
            break;
          }
          block.push(next);
        }
        const text = block.join('\n');
        const status = STATUS.exec(text);
        if (!status) {
          errors.push(`${where}: ${id} has no **Status:** line`);
        } else if (!STATUSES.includes(status[1] as string)) {
          errors.push(`${where}: ${id} has unknown status '${status[1]}' (allowed: ${STATUSES.join(', ')})`);
        } else {
          item.status = status[1] as string;
        }
        item.alias = ALIAS.exec(text)?.[1] ?? '';
        item.realises = mentions(REALISES.exec(text)?.[1] ?? '');
        item.appliesTo = mentions(APPLIES.exec(text)?.[1] ?? '');
        for (const [, , target = ''] of (SCREENS.exec(text)?.[1] ?? '').matchAll(LINK)) {
          const dest = path.resolve(path.dirname(file), target);
          if (path.dirname(dest) !== SCREENS_DIR || !dest.endsWith('.html')) {
            errors.push(`${where}: ${id} names '${target}' in **Screens:**, which is not a screen in ${rel(SCREENS_DIR)}`);
            continue;
          }
          item.screens.push(path.basename(dest, '.html'));
        }
        if (item.kind === 'TR' && item.realises.length === 0) {
          errors.push(`${where}: ${id} must link at least one requirement in a **Realises:** line`);
        }
      }
      const list = item ? null : LIST_DEF.exec(line);
      if (list) {
        const [, box, anchor = '', id = '', text = ''] = list;
        item = newItem(id, text, file, i + 1);
        if (anchor !== id.toLowerCase()) {
          errors.push(`${where}: anchor '${anchor}' does not match ${id}`);
        }
        if (!LIST_KINDS.has(item.kind)) {
          errors.push(`${where}: ${id} must be a heading, not a list item`);
        }
        if (item.kind === 'OP') {
          if (box === undefined) {
            errors.push(`${where}: ${id} needs a checkbox, [ ] or [x]`);
          }
          item.status = box === 'x' ? 'Done' : 'Open';
        } else {
          item.status = 'Decided';
        }
      }
      if (item) {
        const other = items.get(item.id);
        if (other) {
          errors.push(`${where}: ${item.id} is already defined in ${rel(other.file)}:${other.line}`);
        } else {
          items.set(item.id, item);
        }
      }
    });
  }
  return items;
}

function newItem(id: string, title: string, file: string, line: number): Item {
  return { id, kind: id.split('-')[0] as string, title, file, line, status: '', alias: '', realises: [], appliesTo: [], screens: [] };
}

/**
 * Reads the comment at the top of every screen: every ID in it must exist, and its line
 * `Requirements:` names the requirements the screen fulfils, never a decision, an open point or a
 * withdrawn requirement. Each of those must name the screen back in its **Screens:** field.
 */
function checkScreens(items: Map<string, Item>, errors: string[]): Map<string, Screen> {
  const screens = new Map<string, Screen>();
  if (!existsSync(SCREENS_DIR)) {
    return screens;
  }
  for (const entry of readdirSync(SCREENS_DIR).filter((name) => name.endsWith('.html')).sort()) {
    const name = path.basename(entry, '.html');
    if (NOT_A_SCREEN.has(name)) {
      continue;
    }
    const file = path.join(SCREENS_DIR, entry);
    const text = readFileSync(file, 'utf8');
    const comment = SCREEN_COMMENT.exec(text);
    if (!comment) {
      errors.push(`${rel(file)}: has no comment at the top with the requirements it fulfils`);
      continue;
    }
    const firstLine = text.slice(0, comment.index).split('\n').length;
    const lines = (comment[1] as string).split('\n');
    lines.forEach((line, i) => {
      for (const id of mentions(line)) {
        if (!items.has(id)) {
          errors.push(`${rel(file)}:${firstLine + i}: ${id} is mentioned but not defined anywhere`);
        }
      }
    });
    const found = lines.flatMap((line, i) => {
      const match = SCREEN_REQUIREMENTS.exec(line);
      return match ? [{ line: firstLine + i, ids: mentions(match[1] as string) }] : [];
    });
    if (found.length !== 1) {
      errors.push(`${rel(file)}: its comment needs exactly one line 'Requirements:', found ${found.length}`);
      continue;
    }
    const [{ line, ids }] = found as [{ line: number; ids: string[] }];
    for (const id of ids) {
      const item = items.get(id);
      if (!item) {
        continue; // reported above
      }
      if (!HEADING_KINDS.has(item.kind)) {
        errors.push(`${rel(file)}:${line}: ${id} is no requirement; name it on another line of the comment`);
      } else if (item.status === 'Withdrawn') {
        errors.push(`${rel(file)}:${line}: ${id} is withdrawn`);
      }
    }
    screens.set(name, { name, file, line, requirements: ids });
  }

  for (const screen of screens.values()) {
    for (const id of screen.requirements) {
      const item = items.get(id);
      if (item && HEADING_KINDS.has(item.kind) && !item.screens.includes(screen.name)) {
        errors.push(`${rel(screen.file)}:${screen.line}: lists ${id}, but ${id} does not name ${screen.name} in its **Screens:** (${rel(item.file)}:${item.line})`);
      }
    }
  }
  for (const item of items.values()) {
    for (const name of item.screens) {
      const screen = screens.get(name);
      if (screen && !screen.requirements.includes(item.id)) {
        errors.push(`${rel(item.file)}:${item.line}: ${item.id} names ${name} in its **Screens:**, but ${rel(screen.file)} does not list it`);
      }
    }
  }
  return screens;
}

function checkLinks(docs: Map<string, Doc>, items: Map<string, Item>, errors: string[]): void {
  for (const [file, doc] of docs) {
    if (isSkipped(file)) {
      continue;
    }
    stripCode(doc.lines).forEach((line, i) => {
      const where = `${rel(file)}:${i + 1}`;
      for (const id of mentions(line)) {
        if (!items.has(id)) {
          errors.push(`${where}: ${id} is mentioned but not defined anywhere`);
        }
      }
      for (const match of line.matchAll(LINK)) {
        const target = match[2] as string;
        if (/^[a-z]+:/.test(target)) {
          continue;
        }
        const hash = target.indexOf('#');
        const filePart = hash === -1 ? target : target.slice(0, hash);
        const fragment = hash === -1 ? '' : target.slice(hash + 1);
        const dest = filePart ? path.resolve(path.dirname(file), filePart) : file;
        if (dest === MATRIX) {
          continue; // generated by build; check reports separately when it is missing
        }
        if (!existsSync(dest)) {
          errors.push(`${where}: link to missing file '${filePart}'`);
          continue;
        }
        if (fragment && dest.endsWith('.md')) {
          // Markdown outside docs/ (such as infra/README.md) is read when a link points into it.
          const target = docs.get(dest) ?? parseDoc(dest);
          if (!target.anchors.has(fragment)) {
            errors.push(`${where}: link to missing anchor '#${fragment}' in ${rel(dest)}`);
          }
          const item = items.get(fragment.toUpperCase());
          if (item && item.file !== dest) {
            errors.push(`${where}: ${item.id} is defined in ${rel(item.file)}, not in ${rel(dest)}`);
          }
        }
      }
    });
  }
}

function validate(): { docs: Map<string, Doc>; items: Map<string, Item>; screens: Map<string, Screen>; errors: string[] } {
  const errors: string[] = [];
  const docs = loadDocs();
  const items = parseItems(docs, errors);
  checkLinks(docs, items, errors);
  for (const item of items.values()) {
    for (const ref of [...item.realises, ...item.appliesTo]) {
      if (!items.has(ref)) {
        errors.push(`${rel(item.file)}:${item.line}: ${item.id} refers to unknown ${ref}`);
      }
    }
  }
  const screens = checkScreens(items, errors);
  return { docs, items, screens, errors };
}

/** Maps each ID to the commits whose Implements:/Refs: trailers name it. */
function gitCommits(items: Map<string, Item>, warnings: string[]): Map<string, Commit[]> {
  let log: string;
  try {
    log = execFileSync('git', ['log', '--date=short', '--format=%H%x1f%h%x1f%ad%x1f%B%x1e'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    warnings.push(`git log unavailable, commit column left empty: ${(error as Error).message}`);
    return new Map();
  }
  const commits = new Map<string, Commit[]>();
  for (const record of log.split('\x1e')) {
    if (!record.trim()) {
      continue;
    }
    const [full = '', short = '', date = '', body = ''] = record.replace(/^\n+|\n+$/g, '').split('\x1f');
    for (const [, kind = '', rest = ''] of body.matchAll(TRAILER)) {
      for (const id of mentions(rest)) {
        if (!items.has(id)) {
          warnings.push(`commit ${short} names unknown ${id} in its ${kind}: trailer`);
          continue;
        }
        const list = commits.get(id) ?? [];
        if (!list.some((c) => c.full === full && c.kind === kind)) {
          list.push({ full, short, date, kind });
        }
        commits.set(id, list);
      }
    }
  }
  return commits;
}

const relativeLink = (file: string, base: string): string =>
  path.relative(path.dirname(base), file).split(path.sep).join('/');

const linkTo = (item: Item, base: string): string => `[${item.id}](${relativeLink(item.file, base)}#${item.id.toLowerCase()})`;

function build(docs: Map<string, Doc>, items: Map<string, Item>, warnings: string[]): string {
  const commits = gitCommits(items, warnings);
  const realisedBy = new Map<string, string[]>();
  for (const item of items.values()) {
    for (const ref of item.realises) {
      realisedBy.set(ref, [...(realisedBy.get(ref) ?? []), item.id]);
    }
  }

  for (const item of items.values()) {
    const implemented = (commits.get(item.id) ?? []).some((c) => c.kind === 'Implements');
    if ((item.status === 'Implemented' || item.status === 'Verified') && !implemented) {
      warnings.push(`${item.id} is ${item.status} but no commit has 'Implements: ${item.id}'`);
    }
    if ((item.status === 'Proposed' || item.status === 'Specified') && implemented) {
      warnings.push(`${item.id} is still ${item.status} although a commit implements it`);
    }
  }

  const cellIds = (ids: string[]): string => ids.map((id) => linkTo(items.get(id) as Item, MATRIX)).join(', ') || '–';
  const cellScreens = (item: Item): string =>
    item.screens.map((name) => `[${name}](${relativeLink(path.join(SCREENS_DIR, `${name}.html`), MATRIX)})`).join(', ') || '–';
  const cellCommits = (id: string): string =>
    (commits.get(id) ?? [])
      .map((c) => `[${c.short}](${REPO_URL}/commit/${c.full}) ${c.kind.toLowerCase()}, ${c.date}`)
      .join('<br>') || '–';
  const breakdown = (group: Item[], order: string[]): string => {
    if (group.length === 0) {
      return '–';
    }
    const parts = order
      .map((status) => [status, group.filter((i) => i.status === status).length] as const)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => `${count} ${status.toLowerCase()}`);
    return `${group.length} (${parts.join(', ')})`;
  };

  const byFile = new Map<string, Item[]>();
  for (const item of items.values()) {
    byFile.set(item.file, [...(byFile.get(item.file) ?? []), item]);
  }
  const domainFiles = [...docs.keys()].filter(
    (file) => path.dirname(file) === path.join(REQUIREMENTS, 'functional') && /^\d\d-/.test(path.basename(file)),
  );
  const files = [...new Set([...byFile.keys(), ...domainFiles])].sort((a, b) => (rel(a) < rel(b) ? -1 : rel(a) > rel(b) ? 1 : 0));
  const fileLink = (file: string): string =>
    `[${docs.get(file)?.title || path.basename(file, '.md')}](${relativeLink(file, MATRIX)})`;

  const out = [
    '# Traceability matrix',
    '',
    '<!-- Generated by scripts/requirements.ts build. Do not edit by hand. -->',
    '',
    'Generated from the requirement files under `docs/` and from the `Implements:` and `Refs:` trailers in the git history.',
    'Regenerate it with `pnpm docs:build`; the conventions are in the [requirements README](README.md).',
    '',
    '## Summary',
    '',
    '| File | Requirements | Edge cases | Decisions | Open points |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const file of files) {
    const group = byFile.get(file) ?? [];
    const ofKind = (...kinds: string[]): Item[] => group.filter((i) => kinds.includes(i.kind));
    out.push(
      `| ${fileLink(file)} | ${breakdown(ofKind('FR', 'TR', 'NFR'), STATUSES)} | ${breakdown(ofKind('EC'), STATUSES)}` +
        ` | ${ofKind('DEC').length || '–'} | ${breakdown(ofKind('OP'), ['Open', 'Done'])} |`,
    );
  }

  const sections: [string, string, string[], (item: Item) => string[]][] = [
    ['Functional requirements', 'FR', ['ID', 'Title', 'Status', 'Confluence', 'Screens', 'Realised by', 'Commits'],
      (i) => [i.alias || '–', cellScreens(i), cellIds(realisedBy.get(i.id) ?? [])]],
    ['Edge cases', 'EC', ['ID', 'Title', 'Status', 'Screens', 'Realised by', 'Commits'], (i) => [cellScreens(i), cellIds(realisedBy.get(i.id) ?? [])]],
    ['Technical requirements', 'TR', ['ID', 'Title', 'Status', 'Realises', 'Commits'], (i) => [cellIds(i.realises)]],
    ['Non-functional requirements', 'NFR', ['ID', 'Title', 'Status', 'Applies to', 'Screens', 'Realised by', 'Commits'],
      (i) => [cellIds(i.appliesTo), cellScreens(i), cellIds(realisedBy.get(i.id) ?? [])]],
  ];
  for (const [heading, kind, columns, extra] of sections) {
    out.push('', `## ${heading}`, '');
    const groupFiles = files.filter((file) => (byFile.get(file) ?? []).some((i) => i.kind === kind));
    if (groupFiles.length === 0) {
      out.push('None yet.');
      continue;
    }
    for (const file of groupFiles) {
      out.push(`### ${fileLink(file)}`, '', `| ${columns.join(' | ')} |`, `|${' --- |'.repeat(columns.length)}`);
      for (const item of byFile.get(file) ?? []) {
        if (item.kind === kind) {
          const cells = [linkTo(item, MATRIX), item.title.replaceAll('|', '\\|'), item.status, ...extra(item), cellCommits(item.id)];
          out.push(`| ${cells.join(' | ')} |`);
        }
      }
      out.push('');
    }
    if (out.at(-1) === '') {
      out.pop();
    }
  }
  return `${out.join('\n')}\n`;
}

function main(command: string | undefined): number {
  if (command !== 'check' && command !== 'build') {
    console.log('Usage: node scripts/requirements.ts check|build');
    return 2;
  }
  const { docs, items, screens, errors } = validate();
  for (const error of errors) {
    console.log(`error: ${error}`);
  }
  if (errors.length > 0) {
    console.log(`\n${errors.length} error(s); see docs/requirements/README.md for the conventions.`);
    return 1;
  }
  const summary = ['FR', 'EC', 'TR', 'NFR', 'DEC', 'OP']
    .map((kind) => [kind, [...items.values()].filter((i) => i.kind === kind).length] as const)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${kind}`)
    .concat(screens.size > 0 ? [`${screens.size} screens`] : [])
    .join(', ');
  if (command === 'check') {
    if (!existsSync(MATRIX)) {
      console.log(`error: ${rel(MATRIX)} is missing; run: pnpm docs:build`);
      return 1;
    }
    console.log(`ok: ${summary}`);
    return 0;
  }
  const warnings: string[] = [];
  writeFileSync(MATRIX, build(docs, items, warnings), 'utf8');
  for (const warning of warnings) {
    console.log(`warning: ${warning}`);
  }
  console.log(`wrote ${rel(MATRIX)}: ${summary}`);
  return 0;
}

process.exitCode = main(process.argv[2]);
