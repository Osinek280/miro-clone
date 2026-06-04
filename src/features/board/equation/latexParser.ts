import type { BinaryOp, Delimiter, Expr, UnaryOp } from './ast';
import { tokenizeLatex, type Token } from './latexTokenizer';

export type ParseResult =
  | { ok: true; ast: Expr }
  | { ok: false; message: string; pos?: number };

const RELATION_OPS = new Set<string>(['=', '<', '>', '<=', '>=', '!=']);

const MUL_COMMANDS: Record<string, BinaryOp> = {
  cdot: '*',
  times: '*',
};

const ADD_COMMANDS: Record<string, BinaryOp> = {
  pm: '±',
};

const REL_COMMANDS: Record<string, BinaryOp> = {
  le: '<',
  leq: '<=',
  ge: '>',
  geq: '>=',
  neq: '!=',
};

const ONE_ARG_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'ln',
  'log',
  'exp',
  'det',
  'dim',
  'gcd',
  'hom',
  'inf',
  'ker',
  'lg',
  'Pr',
  'sup',
]);

function charToDelimiter(ch: string): Delimiter | null {
  if (
    ch === '(' ||
    ch === ')' ||
    ch === '[' ||
    ch === ']' ||
    ch === '{' ||
    ch === '}' ||
    ch === '|' ||
    ch === '.'
  ) {
    return ch as Delimiter;
  }
  return null;
}

function matchingClose(open: Delimiter): Delimiter {
  switch (open) {
    case '(':
      return ')';
    case '[':
      return ']';
    case '{':
      return '}';
    case '|':
      return '|';
    case '.':
      return '.';
    default:
      return ')';
  }
}

function findMatchingRightTokenIndex(
  tokens: Token[],
  innerStart: number,
): { rightCmdIndex: number; afterCloseIndex: number } | null {
  let depth = 1;
  let i = innerStart;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (t.type === 'COMMAND' && t.name === 'left') {
      depth += 1;
      i += 1;
      continue;
    }
    if (t.type === 'COMMAND' && t.name === 'right') {
      depth -= 1;
      if (depth === 0) {
        const closeTok = tokens[i + 1];
        if (!closeTok || closeTok.type !== 'CHAR') {
          return null;
        }
        return { rightCmdIndex: i, afterCloseIndex: i + 2 };
      }
      i += 1;
      continue;
    }
    i += 1;
  }
  return null;
}

class Parser {
  private i = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | null {
    return this.tokens[this.i] ?? null;
  }

  private advance(): Token | null {
    return this.tokens[this.i++] ?? null;
  }

  parse(): ParseResult {
    if (this.tokens.length === 0) {
      return { ok: false, message: 'Puste wyrażenie', pos: 0 };
    }
    const ast = this.parseRelation();
    if (!ast) {
      const t = this.peek();
      return {
        ok: false,
        message: 'Nie udało się sparsować wyrażenia',
        pos: t?.pos,
      };
    }
    if (!this.atEnd()) {
      const t = this.peek()!;
      return {
        ok: false,
        message: 'Nieoczekiwany token po wyrażeniu',
        pos: t.pos,
      };
    }
    return { ok: true, ast };
  }

  /** Cały fragment tokenów jako lista przecinkowa (np. wnętrze `\left(...\right)`). */
  parseToEndAsCommaList(): ParseResult {
    const ast = this.parseCommaList();
    if (!ast) {
      const t = this.peek();
      return {
        ok: false,
        message: 'Nie udało się sparsować listy',
        pos: t?.pos,
      };
    }
    if (!this.atEnd()) {
      const t = this.peek()!;
      return { ok: false, message: 'Nieoczekiwany token w grupie', pos: t.pos };
    }
    return { ok: true, ast };
  }

  private atEnd(): boolean {
    return this.i >= this.tokens.length;
  }

  private parseRelation(): Expr | null {
    let left = this.parseAdditive();
    if (!left) {
      return null;
    }
    while (!this.atEnd()) {
      const op = this.tryReadRelationOp();
      if (!op) {
        break;
      }
      const right = this.parseAdditive();
      if (!right) {
        return null;
      }
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private tryReadRelationOp(): BinaryOp | null {
    const t = this.peek();
    if (!t) {
      return null;
    }
    if (t.type === 'CHAR' && RELATION_OPS.has(t.ch)) {
      this.advance();
      return t.ch as BinaryOp;
    }
    if (t.type === 'COMMAND' && t.name in REL_COMMANDS) {
      this.advance();
      return REL_COMMANDS[t.name]!;
    }
    return null;
  }

  private parseAdditive(): Expr | null {
    let left = this.parseMultiplicative();
    if (!left) {
      return null;
    }
    while (!this.atEnd()) {
      let op: BinaryOp | null = null;
      const t = this.peek()!;
      if (t.type === 'CHAR' && (t.ch === '+' || t.ch === '-')) {
        this.advance();
        op = t.ch as BinaryOp;
      } else if (t.type === 'COMMAND' && t.name in ADD_COMMANDS) {
        this.advance();
        op = ADD_COMMANDS[t.name]!;
      } else {
        break;
      }
      const right = this.parseMultiplicative();
      if (!right) {
        return null;
      }
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Expr | null {
    let left = this.parseUnary();
    if (!left) {
      return null;
    }
    while (!this.atEnd()) {
      let op: BinaryOp | null = null;
      const t = this.peek()!;
      if (t.type === 'CHAR' && (t.ch === '*' || t.ch === '/')) {
        this.advance();
        op = t.ch as BinaryOp;
      } else if (t.type === 'COMMAND' && t.name in MUL_COMMANDS) {
        this.advance();
        op = MUL_COMMANDS[t.name]!;
      } else if (this.implicitMultiplyAfter(left)) {
        op = '*';
      } else {
        break;
      }
      const right = this.parseUnary();
      if (!right) {
        return null;
      }
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  private implicitMultiplyAfter(_left: Expr): boolean {
    const t = this.peek();
    if (!t) {
      return false;
    }
    if (t.type === 'NUMBER' || t.type === 'IDENT' || t.type === 'COMMAND') {
      return this.canStartPrimary(t);
    }
    if (t.type === 'CHAR') {
      return t.ch === '(' || t.ch === '{' || t.ch === '[';
    }
    return false;
  }

  private canStartPrimary(t: Token): boolean {
    if (t.type === 'NUMBER' || t.type === 'IDENT') {
      return true;
    }
    if (t.type === 'COMMAND') {
      if (
        t.name === 'frac' ||
        t.name === 'sqrt' ||
        t.name === 'left' ||
        t.name === 'cdot' ||
        t.name === 'times' ||
        t.name === 'pm' ||
        t.name in REL_COMMANDS
      ) {
        return false;
      }
      if (t.name in MUL_COMMANDS) {
        return false;
      }
      return true;
    }
    return false;
  }

  private parseUnary(): Expr | null {
    const t = this.peek();
    if (t?.type === 'CHAR' && (t.ch === '+' || t.ch === '-')) {
      const op = t.ch as UnaryOp;
      this.advance();
      const inner = this.parseUnary();
      if (!inner) {
        return null;
      }
      return { type: 'Unary', op, argument: inner };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr | null {
    let base = this.parsePrimary();
    if (!base) {
      return null;
    }
    while (!this.atEnd()) {
      const t = this.peek()!;
      if (t.type === 'CHAR' && t.ch === '^') {
        this.advance();
        const exp = this.parseUnary();
        if (!exp) {
          return null;
        }
        base = { type: 'Power', base, exponent: exp };
        continue;
      }
      if (t.type === 'CHAR' && t.ch === '_') {
        this.advance();
        const sub = this.parseUnary();
        if (!sub) {
          return null;
        }
        base = { type: 'Subscript', base, sub };
        continue;
      }
      break;
    }
    return base;
  }

  private parsePrimary(): Expr | null {
    const t = this.peek();
    if (!t) {
      return null;
    }

    if (t.type === 'NUMBER') {
      this.advance();
      return { type: 'Number', value: t.value };
    }

    if (t.type === 'COMMAND' && t.name === 'frac') {
      return this.parseFrac();
    }

    if (t.type === 'COMMAND' && t.name === 'sqrt') {
      return this.parseSqrt();
    }

    if (t.type === 'COMMAND' && t.name === 'left') {
      return this.parseLeftRight();
    }

    if (t.type === 'COMMAND' && ONE_ARG_FUNCTIONS.has(t.name)) {
      return this.parseKnownFunctionCall(t.name);
    }

    if (t.type === 'COMMAND') {
      this.advance();
      return { type: 'Identifier', name: t.name };
    }

    if (t.type === 'IDENT') {
      this.advance();
      const afterIdent = this.peek();
      if (afterIdent?.type === 'CHAR' && afterIdent.ch === '(') {
        this.advance();
        const arg = this.parseRelation();
        const cl = this.peek();
        if (!arg || !cl || cl.type !== 'CHAR' || cl.ch !== ')') {
          return null;
        }
        this.advance();
        return { type: 'Call', name: t.name, arguments: [arg] };
      }
      return { type: 'Identifier', name: t.name };
    }

    if (t.type === 'CHAR' && t.ch === '(') {
      this.advance();
      const inner = this.parseCommaList();
      if (inner === null) {
        return null;
      }
      const close = this.peek();
      if (!close || close.type !== 'CHAR' || close.ch !== ')') {
        return null;
      }
      this.advance();
      return inner;
    }

    if (t.type === 'CHAR' && t.ch === '{') {
      this.advance();
      const inner = this.parseRelation();
      const close = this.peek();
      if (!inner || !close || close.type !== 'CHAR' || close.ch !== '}') {
        return null;
      }
      this.advance();
      return inner;
    }

    if (t.type === 'CHAR' && t.ch === '[') {
      this.advance();
      const inner = this.parseRelation();
      const close = this.peek();
      if (!inner || !close || close.type !== 'CHAR' || close.ch !== ']') {
        return null;
      }
      this.advance();
      return inner;
    }

    return null;
  }

  private parseCommaList(): Expr | null {
    const first = this.parseRelation();
    if (!first) {
      return null;
    }
    const parts: Expr[] = [first];
    while (!this.atEnd()) {
      const c = this.peek()!;
      if (c.type !== 'CHAR' || c.ch !== ',') {
        break;
      }
      this.advance();
      const next = this.parseRelation();
      if (!next) {
        return null;
      }
      parts.push(next);
    }
    if (parts.length === 1) {
      return parts[0]!;
    }
    return { type: 'Tuple', elements: parts };
  }

  private parseFrac(): Expr | null {
    const t = this.advance();
    if (!t || t.type !== 'COMMAND' || t.name !== 'frac') {
      return null;
    }
    const num = this.parseBraceGroup();
    if (!num) {
      return null;
    }
    const den = this.parseBraceGroup();
    if (!den) {
      return null;
    }
    return { type: 'Fraction', numerator: num, denominator: den };
  }

  private parseBraceGroup(): Expr | null {
    const open = this.peek();
    if (!open || open.type !== 'CHAR' || open.ch !== '{') {
      return null;
    }
    this.advance();
    const inner = this.parseRelation();
    const close = this.peek();
    if (!inner || !close || close.type !== 'CHAR' || close.ch !== '}') {
      return null;
    }
    this.advance();
    return inner;
  }

  private parseSqrt(): Expr | null {
    const t = this.advance();
    if (!t || t.type !== 'COMMAND' || t.name !== 'sqrt') {
      return null;
    }
    let index: Expr | undefined;
    const sqrtBracket = this.peek();
    if (sqrtBracket?.type === 'CHAR' && sqrtBracket.ch === '[') {
      this.advance();
      const idx = this.parseRelation();
      const cl = this.peek();
      if (!idx || !cl || cl.type !== 'CHAR' || cl.ch !== ']') {
        return null;
      }
      this.advance();
      index = idx;
    }
    const rad = this.parseBraceGroup();
    if (!rad) {
      return null;
    }
    return index !== undefined
      ? { type: 'Sqrt', radicand: rad, index }
      : { type: 'Sqrt', radicand: rad };
  }

  private parseLeftRight(): Expr | null {
    const leftCmd = this.advance();
    if (!leftCmd || leftCmd.type !== 'COMMAND' || leftCmd.name !== 'left') {
      return null;
    }
    const openTok = this.peek();
    if (!openTok || openTok.type !== 'CHAR') {
      return null;
    }
    const openDelim = charToDelimiter(openTok.ch);
    if (!openDelim) {
      return null;
    }
    this.advance();
    const innerStart = this.i;
    const matched = findMatchingRightTokenIndex(this.tokens, innerStart);
    if (!matched) {
      return null;
    }
    const closeExpected = matchingClose(openDelim);
    const closeCharTok = this.tokens[matched.rightCmdIndex + 1];
    if (
      !closeCharTok ||
      closeCharTok.type !== 'CHAR' ||
      charToDelimiter(closeCharTok.ch) !== closeExpected
    ) {
      return null;
    }
    const innerSlice = this.tokens.slice(innerStart, matched.rightCmdIndex);
    const innerResult = new Parser(innerSlice).parseToEndAsCommaList();
    if (!innerResult.ok) {
      return null;
    }
    this.i = matched.afterCloseIndex;
    return {
      type: 'Delimited',
      left: openDelim,
      right: closeExpected,
      body: innerResult.ast,
    };
  }

  private parseKnownFunctionCall(name: string): Expr | null {
    this.advance();
    const openParen = this.peek();
    if (openParen?.type === 'CHAR' && openParen.ch === '(') {
      this.advance();
      const arg = this.parseRelation();
      const cl = this.peek();
      if (!arg || !cl || cl.type !== 'CHAR' || cl.ch !== ')') {
        return null;
      }
      this.advance();
      return { type: 'Call', name, arguments: [arg] };
    }
    const openBrace = this.peek();
    if (openBrace?.type === 'CHAR' && openBrace.ch === '{') {
      const arg = this.parseBraceGroup();
      if (!arg) {
        return null;
      }
      return { type: 'Call', name, arguments: [arg] };
    }
    const arg = this.parsePostfix();
    if (!arg) {
      return null;
    }
    return { type: 'Call', name, arguments: [arg] };
  }
}

export function parseLatexToAst(latex: string): ParseResult {
  const trimmed = latex.trim();
  if (!trimmed) {
    return { ok: false, message: 'Puste wyrażenie', pos: 0 };
  }
  const tokens = tokenizeLatex(trimmed);
  return new Parser(tokens).parse();
}
