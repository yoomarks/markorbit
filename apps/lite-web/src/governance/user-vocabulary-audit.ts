import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export type VocabularyCategory =
  | 'CAPABILITY_INTERNAL'
  | 'EXECUTION_INTERNAL'
  | 'OWNER_INTERNAL'
  | 'PREPARATION_INTERNAL'
  | 'PROTECTED_ACTION_INTERNAL'
  | 'REFERENCE_INTERNAL'
  | 'REFLECTION_INTERNAL'
  | 'REVIEW_INTERNAL'
  | 'TARGET_BINDING_INTERNAL'
  | 'TECHNICAL_EVIDENCE'
  | 'RAW_STATUS_ENUM';

export type VocabularySurface = 'USER' | 'ADVANCED';

export interface VocabularyFinding {
  file: string;
  line: number;
  category: VocabularyCategory;
  phrase: string;
  copy: string;
}

export interface VocabularyBaselineEntry {
  file: string;
  category: VocabularyCategory;
  phrase: string;
  count: number;
  surface: VocabularySurface;
  reason: string;
}

interface CopyCandidate {
  copy: string;
  line: number;
  directlyRendered: boolean;
}

interface VocabularyRule {
  category: VocabularyCategory;
  pattern: RegExp;
  directRenderOnly?: boolean;
}

const RULES: readonly VocabularyRule[] = [
  {
    category: 'OWNER_INTERNAL',
    pattern:
      /\b(?:owner-backed|owner state|exact owner|current owner truth|owner-permitted|preparation owner)\b/giu
  },
  { category: 'REFERENCE_INTERNAL', pattern: /\bexact (?:ref|reference)\b/giu },
  { category: 'PREPARATION_INTERNAL', pattern: /\bprepared actions?\b/giu },
  { category: 'REVIEW_INTERNAL', pattern: /\bprofessional review\b/giu },
  { category: 'EXECUTION_INTERNAL', pattern: /\bexecution releases?\b/giu },
  { category: 'PROTECTED_ACTION_INTERNAL', pattern: /\bprotected actions?\b/giu },
  { category: 'TARGET_BINDING_INTERNAL', pattern: /\btarget bindings?\b/giu },
  {
    category: 'CAPABILITY_INTERNAL',
    pattern: /\b(?:capability twins?|capability runtime|runtime capability ids?)\b/giu
  },
  { category: 'REFLECTION_INTERNAL', pattern: /\breflection candidates?\b/giu },
  {
    category: 'TECHNICAL_EVIDENCE',
    pattern: /\b(?:fingerprints?|schema details?|installation ids?)\b/giu
  },
  {
    category: 'RAW_STATUS_ENUM',
    pattern: /^(?:CURRENT|STALE|UNKNOWN|UNAVAILABLE)$/gu,
    directRenderOnly: true
  }
] as const;

const CATEGORY_SET = new Set<VocabularyCategory>(RULES.map((rule) => rule.category));
const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(SOURCE_ROOT, '..', '..', '..');

function normalizeCopy(copy: string): string {
  return copy.replace(/\s+/gu, ' ').trim();
}

function repositoryPath(path: string): string {
  return relative(REPOSITORY_ROOT, path).split(sep).join('/');
}

function isAuditedSource(path: string): boolean {
  const normalized = path.split(sep).join('/');
  return (
    /\.tsx?$/u.test(normalized) &&
    !/\.(?:test|stories)\.tsx?$/u.test(normalized) &&
    !normalized.endsWith('/governance/user-vocabulary-audit.ts')
  );
}

function componentPaths(root: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) paths.push(...componentPaths(path));
    else if (isAuditedSource(path)) paths.push(path);
  }
  return paths.sort((left, right) => left.localeCompare(right));
}

function directlyRendered(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxExpression(current) || ts.isJsxAttribute(current)) return true;
    if (
      ts.isConditionalExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isBinaryExpression(current)
    ) {
      current = current.parent;
      continue;
    }
    return false;
  }
  return false;
}

function isNonCopyString(node: ts.StringLiteralLike): boolean {
  const parent = node.parent;
  return (
    ts.isImportDeclaration(parent) ||
    ts.isExportDeclaration(parent) ||
    ts.isLiteralTypeNode(parent) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isPropertySignature(parent) && parent.name === node) ||
    (ts.isElementAccessExpression(parent) && parent.argumentExpression === node)
  );
}

function candidatesFromSource(file: string, source: string): CopyCandidate[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const candidates: CopyCandidate[] = [];

  const add = (node: ts.Node, copy: string, rendered: boolean) => {
    const normalized = normalizeCopy(copy);
    if (!normalized) return;
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    candidates.push({ copy: normalized, line: line + 1, directlyRendered: rendered });
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, node.getText(sourceFile), true);
    else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      !isNonCopyString(node)
    ) {
      add(node, node.text, directlyRendered(node));
    } else if (ts.isTemplateExpression(node)) {
      add(node.head, node.head.text, directlyRendered(node));
      for (const span of node.templateSpans) {
        add(span.literal, span.literal.text, directlyRendered(node));
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return candidates;
}

export function scanVocabularySource(file: string, source: string): VocabularyFinding[] {
  const findings: VocabularyFinding[] = [];
  for (const candidate of candidatesFromSource(file, source)) {
    for (const rule of RULES) {
      if (rule.directRenderOnly && !candidate.directlyRendered) continue;
      for (const match of candidate.copy.matchAll(rule.pattern)) {
        findings.push({
          file,
          line: candidate.line,
          category: rule.category,
          phrase: match[0],
          copy: candidate.copy
        });
      }
    }
  }
  return findings.sort(
    (left, right) =>
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.category.localeCompare(right.category) ||
      left.phrase.localeCompare(right.phrase)
  );
}

export function scanLiteVocabulary(root = SOURCE_ROOT): VocabularyFinding[] {
  return componentPaths(root).flatMap((path) =>
    scanVocabularySource(repositoryPath(path), readFileSync(path, 'utf8'))
  );
}

function baselineKey(
  value: Pick<VocabularyFinding | VocabularyBaselineEntry, 'file' | 'category' | 'phrase'>
): string {
  return `${value.file}|${value.category}|${value.phrase.toLocaleLowerCase('en-US')}`;
}

export function validateVocabularyBaseline(baseline: readonly VocabularyBaselineEntry[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const entry of baseline) {
    const key = baselineKey(entry);
    if (keys.has(key)) errors.push(`duplicate entry: ${key}`);
    keys.add(key);
    if (
      !entry.file.startsWith('apps/lite-web/src/') ||
      !/\.tsx?$/u.test(entry.file) ||
      /[*?{}[\]]/u.test(entry.file)
    ) {
      errors.push(`file must name one production TypeScript source file: ${entry.file}`);
    }
    if (!CATEGORY_SET.has(entry.category)) errors.push(`unknown category: ${entry.category}`);
    if (!entry.phrase.trim() || /[*?{}[\]]/u.test(entry.phrase)) {
      errors.push(`phrase must be exact: ${entry.phrase}`);
    }
    if (!Number.isInteger(entry.count) || entry.count < 1) {
      errors.push(`count must be a positive integer: ${key}`);
    }
    if (entry.surface !== 'USER' && entry.surface !== 'ADVANCED') {
      errors.push(`surface must be USER or ADVANCED: ${key}`);
    }
    if (entry.reason.trim().length < 12) errors.push(`reason is too short: ${key}`);
  }
  return errors.sort();
}

export function compareVocabularyBaseline(
  findings: readonly VocabularyFinding[],
  baseline: readonly VocabularyBaselineEntry[]
): string[] {
  const errors = validateVocabularyBaseline(baseline);
  if (errors.length) return errors.map((error) => `INVALID_BASELINE ${error}`);

  const actualCounts = new Map<string, number>();
  for (const finding of findings) {
    const key = baselineKey(finding);
    actualCounts.set(key, (actualCounts.get(key) ?? 0) + 1);
  }
  const baselineByKey = new Map(baseline.map((entry) => [baselineKey(entry), entry]));

  for (const finding of findings) {
    if (baselineByKey.has(baselineKey(finding))) continue;
    errors.push(
      [
        'USER_VOCABULARY_LEAKAGE',
        `file: ${finding.file}`,
        `line: ${finding.line}`,
        `category: ${finding.category}`,
        `phrase: ${JSON.stringify(finding.phrase)}`,
        'surface: USER'
      ].join('\n')
    );
  }

  for (const entry of baseline) {
    const actual = actualCounts.get(baselineKey(entry)) ?? 0;
    if (actual !== entry.count) {
      errors.push(
        `BASELINE_MISMATCH file=${entry.file} category=${entry.category} phrase=${JSON.stringify(entry.phrase)} expected=${entry.count} actual=${actual}`
      );
    }
  }
  return errors.sort();
}

export function summarizeVocabularyBaseline(
  baseline: readonly VocabularyBaselineEntry[]
): Record<string, number> {
  return baseline.reduce<Record<string, number>>((summary, entry) => {
    const key = `${entry.surface}:${entry.category}`;
    summary[key] = (summary[key] ?? 0) + entry.count;
    return summary;
  }, {});
}
