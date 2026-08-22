// schema/lexer.mjs - Tokenizer for brosurface IDL

export const TokenType = {
  DOC_COMMENT: 'DOC_COMMENT',
  IDENTIFIER: 'IDENTIFIER',
  KEYWORD: 'KEYWORD',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  NULL: 'NULL',
  UNDEFINED: 'UNDEFINED',
  LBRACE: '{',
  RBRACE: '}',
  LBRACKET: '[',
  RBRACKET: ']',
  LPAREN: '(',
  RPAREN: ')',
  LANGLE: '<',
  RANGLE: '>',
  SEMICOLON: ';',
  COLON: ':',
  COMMA: ',',
  EQUALS: '=',
  QUESTION: '?',
  DOT: '.',
  ELLIPSIS: '...',
  PIPE: '|',
  EOF: 'EOF',
};

const KEYWORDS = new Set([
  'interface',
  'namespace',
  'dictionary',
  'enum',
  'typedef',
  'attribute',
  'readonly',
  'static',
  'const',
  'constructor',
  'optional',
  'required',
  'Promise',
  'sequence',
  'record',
  'or',
  'void',
  'any',
  'true',
  'false',
  'null',
  'undefined',
]);

export class Lexer {
  /**
   * @param {string} source
   * @param {string} [fileName='<input>']
   */
  constructor(source, fileName = '<input>') {
    this.source = source;
    this.fileName = fileName;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.tokens = [];
  }

  tokenize() {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
        continue;
      }

      if (ch === '\n') {
        this.line++;
        this.col = 1;
        this.pos++;
        continue;
      }

      // Comments
      if (ch === '/' && this.peek(1) === '/') {
        this.skipLineComment();
        continue;
      }

      if (ch === '/' && this.peek(1) === '*') {
        if (this.peek(2) === '*' && this.peek(3) !== '/') {
          // JSDoc comment: /** ... */
          this.readDocComment();
        } else {
          // Regular block comment: /* ... */
          this.skipBlockComment();
        }
        continue;
      }

      // Ellipsis: ...
      if (ch === '.' && this.peek(1) === '.' && this.peek(2) === '.') {
        const startCol = this.col;
        this.advance();
        this.advance();
        this.advance();
        this.addToken(TokenType.ELLIPSIS, '...', startCol);
        continue;
      }

      // Single character symbols
      if (ch === '{') { this.addSingle(TokenType.LBRACE); continue; }
      if (ch === '}') { this.addSingle(TokenType.RBRACE); continue; }
      if (ch === '[') { this.addSingle(TokenType.LBRACKET); continue; }
      if (ch === ']') { this.addSingle(TokenType.RBRACKET); continue; }
      if (ch === '(') { this.addSingle(TokenType.LPAREN); continue; }
      if (ch === ')') { this.addSingle(TokenType.RPAREN); continue; }
      if (ch === '<') { this.addSingle(TokenType.LANGLE); continue; }
      if (ch === '>') { this.addSingle(TokenType.RANGLE); continue; }
      if (ch === ';') { this.addSingle(TokenType.SEMICOLON); continue; }
      if (ch === ':') { this.addSingle(TokenType.COLON); continue; }
      if (ch === ',') { this.addSingle(TokenType.COMMA); continue; }
      if (ch === '=') { this.addSingle(TokenType.EQUALS); continue; }
      if (ch === '?') { this.addSingle(TokenType.QUESTION); continue; }
      if (ch === '.') { this.addSingle(TokenType.DOT); continue; }
      if (ch === '|') { this.addSingle(TokenType.PIPE); continue; }

      // Strings
      if (ch === '"' || ch === "'") {
        this.readString(ch);
        continue;
      }

      // Numbers (including negative numbers and hex numbers)
      if (this.isDigit(ch) || (ch === '-' && (this.isDigit(this.peek(1)) || (this.peek(1) === '.' && this.isDigit(this.peek(2)))))) {
        this.readNumber();
        continue;
      }

      // Identifiers / Keywords
      if (this.isIdentStart(ch)) {
        this.readIdentifier();
        continue;
      }

      // Unknown character
      throw this.error(`Unexpected character '${ch}'`);
    }

    this.tokens.push({
      type: TokenType.EOF,
      value: '',
      raw: '',
      line: this.line,
      col: this.col,
      file: this.fileName,
    });

    return this.tokens;
  }

  peek(offset = 0) {
    const idx = this.pos + offset;
    return idx < this.source.length ? this.source[idx] : '\0';
  }

  advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  addSingle(type) {
    const col = this.col;
    const ch = this.advance();
    this.addToken(type, ch, col);
  }

  addToken(type, value, col = this.col, raw = value) {
    this.tokens.push({
      type,
      value,
      raw,
      line: this.line,
      col,
      file: this.fileName,
    });
  }

  skipLineComment() {
    this.advance(); // /
    this.advance(); // /
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') {
      this.advance();
    }
  }

  skipBlockComment() {
    const startLine = this.line;
    const startCol = this.col;
    this.advance(); // /
    this.advance(); // *
    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '*' && this.peek(1) === '/') {
        this.advance(); // *
        this.advance(); // /
        return;
      }
      this.advance();
    }
    throw this.error('Unterminated block comment', startLine, startCol);
  }

  readDocComment() {
    const startLine = this.line;
    const startCol = this.col;
    const startPos = this.pos;

    this.advance(); // /
    this.advance(); // *
    this.advance(); // *

    while (this.pos < this.source.length) {
      if (this.source[this.pos] === '*' && this.peek(1) === '/') {
        this.advance(); // *
        this.advance(); // /
        const raw = this.source.slice(startPos, this.pos);
        // Extract comment content inside /** and */
        const content = raw.slice(3, -2);
        this.tokens.push({
          type: TokenType.DOC_COMMENT,
          value: content,
          raw,
          line: startLine,
          col: startCol,
          file: this.fileName,
        });
        return;
      }
      this.advance();
    }
    throw this.error('Unterminated JSDoc comment', startLine, startCol);
  }

  readString(quote) {
    const startLine = this.line;
    const startCol = this.col;
    const startPos = this.pos;

    this.advance(); // opening quote
    let str = '';

    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === quote) {
        this.advance(); // closing quote
        const raw = this.source.slice(startPos, this.pos);
        this.tokens.push({
          type: TokenType.STRING,
          value: str,
          raw,
          line: startLine,
          col: startCol,
          file: this.fileName,
        });
        return;
      }
      if (ch === '\\') {
        this.advance();
        const esc = this.advance();
        if (esc === 'n') str += '\n';
        else if (esc === 't') str += '\t';
        else if (esc === 'r') str += '\r';
        else if (esc === '\\') str += '\\';
        else if (esc === '"') str += '"';
        else if (esc === "'") str += "'";
        else str += esc;
        continue;
      }
      if (ch === '\n') {
        throw this.error('Unterminated string literal on newline', startLine, startCol);
      }
      str += this.advance();
    }
    throw this.error('Unterminated string literal', startLine, startCol);
  }

  readNumber() {
    const startLine = this.line;
    const startCol = this.col;
    const startPos = this.pos;

    if (this.source[this.pos] === '-') {
      this.advance();
    }

    if (this.source[this.pos] === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
      this.advance(); // 0
      this.advance(); // x
      while (this.isHexDigit(this.source[this.pos])) {
        this.advance();
      }
    } else {
      while (this.isDigit(this.source[this.pos])) {
        this.advance();
      }
      if (this.source[this.pos] === '.' && this.isDigit(this.peek(1))) {
        this.advance(); // .
        while (this.isDigit(this.source[this.pos])) {
          this.advance();
        }
      }
      if (this.source[this.pos] === 'e' || this.source[this.pos] === 'E') {
        this.advance();
        if (this.source[this.pos] === '+' || this.source[this.pos] === '-') {
          this.advance();
        }
        while (this.isDigit(this.source[this.pos])) {
          this.advance();
        }
      }
    }

    const raw = this.source.slice(startPos, this.pos);
    const value = raw.startsWith('0x') || raw.startsWith('0X') || raw.startsWith('-0x')
      ? parseInt(raw, 16)
      : Number(raw);

    this.tokens.push({
      type: TokenType.NUMBER,
      value,
      raw,
      line: startLine,
      col: startCol,
      file: this.fileName,
    });
  }

  readIdentifier() {
    const startLine = this.line;
    const startCol = this.col;
    const startPos = this.pos;

    while (this.pos < this.source.length && this.isIdentPart(this.source[this.pos])) {
      this.advance();
    }

    const ident = this.source.slice(startPos, this.pos);

    if (ident === 'true' || ident === 'false') {
      this.tokens.push({
        type: TokenType.BOOLEAN,
        value: ident === 'true',
        raw: ident,
        line: startLine,
        col: startCol,
        file: this.fileName,
      });
      return;
    }

    if (ident === 'null') {
      this.tokens.push({
        type: TokenType.NULL,
        value: null,
        raw: ident,
        line: startLine,
        col: startCol,
        file: this.fileName,
      });
      return;
    }

    if (ident === 'undefined') {
      this.tokens.push({
        type: TokenType.UNDEFINED,
        value: undefined,
        raw: ident,
        line: startLine,
        col: startCol,
        file: this.fileName,
      });
      return;
    }

    const type = KEYWORDS.has(ident) ? TokenType.KEYWORD : TokenType.IDENTIFIER;
    this.tokens.push({
      type,
      value: ident,
      raw: ident,
      line: startLine,
      col: startCol,
      file: this.fileName,
    });
  }

  isDigit(ch) {
    return ch >= '0' && ch <= '9';
  }

  isHexDigit(ch) {
    return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
  }

  isIdentStart(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
  }

  isIdentPart(ch) {
    return this.isIdentStart(ch) || this.isDigit(ch);
  }

  error(msg, line = this.line, col = this.col) {
    const err = new Error(`Lexer error in ${this.fileName} (${line}:${col}): ${msg}`);
    err.file = this.fileName;
    err.line = line;
    err.col = col;
    return err;
  }
}

/**
 * Tokenizes IDL source text.
 * @param {string} source
 * @param {string} [fileName='<input>']
 * @returns {Array<Object>}
 */
export function tokenize(source, fileName = '<input>') {
  const lexer = new Lexer(source, fileName);
  return lexer.tokenize();
}
