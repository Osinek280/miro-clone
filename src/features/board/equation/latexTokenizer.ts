export type Token =
  | { type: 'NUMBER'; value: string; pos: number }
  | { type: 'IDENT'; name: string; pos: number }
  | { type: 'COMMAND'; name: string; pos: number }
  | { type: 'CHAR'; ch: string; pos: number };

const isSpace = (c: string) => /\s/.test(c);

const isIdentStart = (c: string) => /[a-zA-Z]/.test(c);

const isIdentCont = (c: string) => /[a-zA-Z0-9]/.test(c);

function readCommandName(
  input: string,
  start: number,
): { name: string; end: number } {
  let i = start;
  while (i < input.length && isIdentCont(input[i]!)) {
    i += 1;
  }
  return { name: input.slice(start, i), end: i };
}

function readNumber(
  input: string,
  start: number,
): { value: string; end: number } {
  let i = start;
  if (input[i] === '.') {
    i += 1;
    while (i < input.length && /[0-9]/.test(input[i]!)) {
      i += 1;
    }
    return { value: input.slice(start, i), end: i };
  }
  while (i < input.length && /[0-9]/.test(input[i]!)) {
    i += 1;
  }
  if (i < input.length && input[i] === '.') {
    i += 1;
    while (i < input.length && /[0-9]/.test(input[i]!)) {
      i += 1;
    }
  }
  return { value: input.slice(start, i), end: i };
}

/** Tokenizacja LaTeX z MathQuill (podzbiór poleceń i znaków). */
export function tokenizeLatex(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i]!;
    if (isSpace(c)) {
      i += 1;
      continue;
    }
    const pos = i;

    if (c === '\\') {
      i += 1;
      if (i >= input.length) {
        tokens.push({ type: 'COMMAND', name: '', pos });
        break;
      }
      const { name, end } = readCommandName(input, i);
      i = end;
      tokens.push({ type: 'COMMAND', name, pos });
      continue;
    }

    if (
      /[0-9]/.test(c) ||
      (c === '.' && i + 1 < input.length && /[0-9]/.test(input[i + 1]!))
    ) {
      const { value, end } = readNumber(input, i);
      tokens.push({ type: 'NUMBER', value, pos });
      i = end;
      continue;
    }

    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < input.length && isIdentCont(input[j]!)) {
        j += 1;
      }
      tokens.push({ type: 'IDENT', name: input.slice(i, j), pos });
      i = j;
      continue;
    }

    if (c === '<' && input[i + 1] === '=') {
      tokens.push({ type: 'CHAR', ch: '<=', pos });
      i += 2;
      continue;
    }
    if (c === '>' && input[i + 1] === '=') {
      tokens.push({ type: 'CHAR', ch: '>=', pos });
      i += 2;
      continue;
    }
    if (c === '!' && input[i + 1] === '=') {
      tokens.push({ type: 'CHAR', ch: '!=', pos });
      i += 2;
      continue;
    }

    if (
      c === '(' ||
      c === ')' ||
      c === '[' ||
      c === ']' ||
      c === '{' ||
      c === '}' ||
      c === '^' ||
      c === '_' ||
      c === ',' ||
      c === '+' ||
      c === '-' ||
      c === '*' ||
      c === '/' ||
      c === '=' ||
      c === '<' ||
      c === '>' ||
      c === '|'
    ) {
      tokens.push({ type: 'CHAR', ch: c, pos });
      i += 1;
      continue;
    }

    // pojedynczy znak (np. Unicode) — traktuj jak identyfikator jednoliterowy / symbol
    tokens.push({ type: 'IDENT', name: c, pos });
    i += 1;
  }

  console.log('tokens: ', tokens);

  return tokens;
}
