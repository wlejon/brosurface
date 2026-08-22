// schema/parser.mjs - Parser for brosurface IDL

import { TokenType } from './lexer.mjs';
import * as ast from './ast.mjs';

/**
 * Normalizes JSDoc comment content into canonical lines.
 * @param {string} rawDoc
 * @returns {string}
 */
export function normalizeDoc(rawDoc) {
  if (!rawDoc) return '';
  const lines = rawDoc.split('\n');
  const cleaned = lines.map(line => {
    return line.replace(/^\s*\* ?/, '').trimEnd();
  });
  while (cleaned.length > 0 && cleaned[0].trim() === '') {
    cleaned.shift();
  }
  while (cleaned.length > 0 && cleaned[cleaned.length - 1].trim() === '') {
    cleaned.pop();
  }
  return cleaned.join('\n');
}

export class Parser {
  /**
   * @param {Array<Object>} tokens
   * @param {string} [fileName='<input>']
   */
  constructor(tokens, fileName = '<input>') {
    this.tokens = tokens;
    this.fileName = fileName;
    this.pos = 0;
    this.pendingDoc = null;
  }

  parse() {
    const definitions = [];
    let fileHeaderDoc = '';

    // If first token is a doc comment and followed by another doc comment or top-level item without definition
    if (this.check(TokenType.DOC_COMMENT)) {
      const doc = normalizeDoc(this.advance().value);
      if (this.check(TokenType.DOC_COMMENT)) {
        fileHeaderDoc = doc;
      } else {
        this.pendingDoc = doc;
      }
    }

    while (!this.isAtEnd()) {
      if (this.check(TokenType.DOC_COMMENT)) {
        this.pendingDoc = normalizeDoc(this.advance().value);
        continue;
      }

      if (this.check(TokenType.SEMICOLON)) {
        // Extra stray semicolons at top level
        this.advance();
        continue;
      }

      const def = this.parseDefinition();
      if (def) {
        definitions.push(def);
      }
    }

    return ast.createIDLFile(this.fileName, definitions, {
      headerDoc: fileHeaderDoc,
      loc: ast.createLocation(this.fileName, 1, 1),
    });
  }

  // --- Definitions -----------------------------------------------------------

  parseDefinition() {
    const doc = this.consumeDoc();
    const attributes = this.parseExtendedAttributes();
    const loc = this.currentLocation();

    if (this.matchKeyword('interface')) {
      return this.parseInterface(attributes, doc, loc);
    }
    if (this.matchKeyword('namespace')) {
      return this.parseNamespace(attributes, doc, loc);
    }
    if (this.matchKeyword('dictionary')) {
      return this.parseDictionary(attributes, doc, loc);
    }
    if (this.matchKeyword('enum')) {
      return this.parseEnum(attributes, doc, loc);
    }
    if (this.matchKeyword('typedef')) {
      return this.parseTypedef(attributes, doc, loc);
    }

    throw this.error(`Unexpected token '${this.peek().raw}' - expected definition (interface, namespace, dictionary, enum, typedef)`);
  }

  parseInterface(attributes, doc, loc) {
    const name = this.consumeIdentifier('Expected interface name');
    let parent = null;

    if (this.match(TokenType.COLON)) {
      parent = this.consumeIdentifier('Expected parent interface name after ":"');
    }

    this.consume(TokenType.LBRACE, "Expected '{' before interface body");

    const members = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.DOC_COMMENT)) {
        this.pendingDoc = normalizeDoc(this.advance().value);
        continue;
      }
      if (this.check(TokenType.SEMICOLON)) {
        this.advance();
        continue;
      }
      members.push(this.parseInterfaceMember());
    }

    this.consume(TokenType.RBRACE, "Expected '}' after interface body");
    this.match(TokenType.SEMICOLON); // Optional trailing semicolon

    return ast.createInterface(name, {
      parent,
      members,
      attributes,
      doc,
      loc,
    });
  }

  parseNamespace(attributes, doc, loc) {
    const name = this.consumeIdentifier('Expected namespace name');

    this.consume(TokenType.LBRACE, "Expected '{' before namespace body");

    const members = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.DOC_COMMENT)) {
        this.pendingDoc = normalizeDoc(this.advance().value);
        continue;
      }
      if (this.check(TokenType.SEMICOLON)) {
        this.advance();
        continue;
      }
      members.push(this.parseNamespaceMember());
    }

    this.consume(TokenType.RBRACE, "Expected '}' after namespace body");
    this.match(TokenType.SEMICOLON); // Optional trailing semicolon

    return ast.createNamespace(name, {
      members,
      attributes,
      doc,
      loc,
    });
  }

  parseDictionary(attributes, doc, loc) {
    const name = this.consumeIdentifier('Expected dictionary name');
    let parent = null;

    if (this.match(TokenType.COLON)) {
      parent = this.consumeIdentifier('Expected parent dictionary name after ":"');
    }

    this.consume(TokenType.LBRACE, "Expected '{' before dictionary body");

    const members = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      if (this.check(TokenType.DOC_COMMENT)) {
        this.pendingDoc = normalizeDoc(this.advance().value);
        continue;
      }
      if (this.check(TokenType.SEMICOLON)) {
        this.advance();
        continue;
      }
      members.push(this.parseDictionaryMember());
    }

    this.consume(TokenType.RBRACE, "Expected '}' after dictionary body");
    this.match(TokenType.SEMICOLON); // Optional trailing semicolon

    return ast.createDictionary(name, {
      parent,
      members,
      attributes,
      doc,
      loc,
    });
  }

  parseEnum(attributes, doc, loc) {
    const name = this.consumeIdentifier('Expected enum name');
    this.consume(TokenType.LBRACE, "Expected '{' before enum values");

    const values = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      let enumDoc = '';
      if (this.check(TokenType.DOC_COMMENT)) {
        enumDoc = normalizeDoc(this.advance().value);
      }

      if (this.check(TokenType.STRING)) {
        const valToken = this.advance();
        values.push({
          value: valToken.value,
          doc: enumDoc,
          loc: ast.createLocation(this.fileName, valToken.line, valToken.col),
        });

        if (!this.match(TokenType.COMMA)) {
          break;
        }
      } else {
        throw this.error("Expected string literal enum value", this.peek());
      }
    }

    this.consume(TokenType.RBRACE, "Expected '}' after enum values");
    this.match(TokenType.SEMICOLON); // Optional trailing semicolon

    return ast.createEnum(name, values, {
      attributes,
      doc,
      loc,
    });
  }

  parseTypedef(attributes, doc, loc) {
    const targetType = this.parseType();
    const name = this.consumeIdentifier('Expected typedef identifier name');
    this.consume(TokenType.SEMICOLON, "Expected ';' after typedef");

    return ast.createTypedef(name, targetType, {
      attributes,
      doc,
      loc,
    });
  }

  // --- Members ---------------------------------------------------------------

  parseInterfaceMember() {
    const doc = this.consumeDoc();
    const attributes = this.parseExtendedAttributes();
    const loc = this.currentLocation();

    // Constructor: constructor(args...);
    if (this.matchKeyword('constructor')) {
      this.consume(TokenType.LPAREN, "Expected '(' after constructor");
      const parameters = this.parseParameterList();
      this.consume(TokenType.RPAREN, "Expected ')' after constructor parameters");
      this.consume(TokenType.SEMICOLON, "Expected ';' after constructor declaration");
      return ast.createConstructorMember(parameters, { attributes, doc, loc });
    }

    // Constant: const Type NAME = value;
    if (this.matchKeyword('const')) {
      const dataType = this.parseType();
      const name = this.consumeIdentifier('Expected constant name');
      this.consume(TokenType.EQUALS, "Expected '=' after constant name");
      const value = this.parseConstantValue();
      this.consume(TokenType.SEMICOLON, "Expected ';' after constant declaration");
      return ast.createConstantMember(name, dataType, value, { attributes, doc, loc });
    }

    // Attribute / static attribute / readonly attribute
    let isStatic = false;
    let readonly = false;

    if (this.matchKeyword('static')) {
      isStatic = true;
    }
    if (this.matchKeyword('readonly')) {
      readonly = true;
    }

    if (this.matchKeyword('attribute')) {
      const dataType = this.parseType();
      const name = this.consumeIdentifier('Expected attribute name');
      this.consume(TokenType.SEMICOLON, "Expected ';' after attribute declaration");
      return ast.createAttributeMember(name, dataType, {
        readonly,
        isStatic,
        attributes,
        doc,
        loc,
      });
    }

    // If it's static operation: static ReturnType name(args...);
    // Or regular operation: ReturnType name(args...);
    const returnType = this.parseType();
    const name = this.consumeIdentifier('Expected operation or attribute name');

    this.consume(TokenType.LPAREN, "Expected '(' after operation name");
    const parameters = this.parseParameterList();
    this.consume(TokenType.RPAREN, "Expected ')' after operation parameters");
    this.consume(TokenType.SEMICOLON, "Expected ';' after operation declaration");

    return ast.createOperationMember(name, returnType, parameters, {
      isStatic,
      attributes,
      doc,
      loc,
    });
  }

  parseNamespaceMember() {
    const doc = this.consumeDoc();
    const attributes = this.parseExtendedAttributes();
    const loc = this.currentLocation();

    // Constant: const Type NAME = value;
    if (this.matchKeyword('const')) {
      const dataType = this.parseType();
      const name = this.consumeIdentifier('Expected constant name');
      this.consume(TokenType.EQUALS, "Expected '=' after constant name");
      const value = this.parseConstantValue();
      this.consume(TokenType.SEMICOLON, "Expected ';' after constant declaration");
      return ast.createConstantMember(name, dataType, value, { attributes, doc, loc });
    }

    let readonly = false;
    if (this.matchKeyword('readonly')) {
      readonly = true;
    }

    if (this.matchKeyword('attribute')) {
      const dataType = this.parseType();
      const name = this.consumeIdentifier('Expected attribute name');
      this.consume(TokenType.SEMICOLON, "Expected ';' after attribute declaration");
      return ast.createAttributeMember(name, dataType, {
        readonly,
        isStatic: true,
        attributes,
        doc,
        loc,
      });
    }

    const returnType = this.parseType();
    const name = this.consumeIdentifier('Expected operation name');

    this.consume(TokenType.LPAREN, "Expected '(' after operation name");
    const parameters = this.parseParameterList();
    this.consume(TokenType.RPAREN, "Expected ')' after operation parameters");
    this.consume(TokenType.SEMICOLON, "Expected ';' after operation declaration");

    return ast.createOperationMember(name, returnType, parameters, {
      isStatic: true,
      attributes,
      doc,
      loc,
    });
  }

  parseDictionaryMember() {
    const doc = this.consumeDoc();
    const attributes = this.parseExtendedAttributes();
    const loc = this.currentLocation();

    let required = false;
    if (this.matchKeyword('required')) {
      required = true;
    }

    let optional = false;
    if (this.matchKeyword('optional')) {
      optional = true;
    }

    const dataType = this.parseType();
    const name = this.consumeIdentifierOrKeyword('Expected dictionary member name');
    let defaultValue = undefined;

    if (this.match(TokenType.EQUALS)) {
      defaultValue = this.parseDefaultValue();
    }

    this.consume(TokenType.SEMICOLON, "Expected ';' after dictionary member");

    return ast.createDictionaryMember(name, dataType, {
      defaultValue,
      required,
      attributes,
      doc,
      loc,
    });
  }

  // --- Parameters & Arguments ------------------------------------------------

  parseParameterList() {
    const params = [];
    while (!this.check(TokenType.RPAREN) && !this.isAtEnd()) {
      params.push(this.parseParameter());
      if (!this.match(TokenType.COMMA)) {
        break;
      }
    }
    return params;
  }

  parseParameter() {
    const attributes = this.parseExtendedAttributes();
    const loc = this.currentLocation();
    let optional = false;

    if (this.matchKeyword('optional')) {
      optional = true;
    }

    const dataType = this.parseType();
    let variadic = false;

    if (this.match(TokenType.ELLIPSIS)) {
      variadic = true;
    }

    const name = this.consumeIdentifierOrKeyword('Expected parameter name');
    let defaultValue = undefined;

    if (this.match(TokenType.EQUALS)) {
      defaultValue = this.parseDefaultValue();
      optional = true;
    }

    return ast.createParameter(name, dataType, {
      optional,
      defaultValue,
      variadic,
      attributes,
      loc,
    });
  }

  // --- Types -----------------------------------------------------------------

  parseType() {
    const loc = this.currentLocation();

    // Union type: (Type1 or Type2 or Type3) or (Type1 | Type2)
    if (this.match(TokenType.LPAREN)) {
      const unionMembers = [];
      unionMembers.push(this.parseType());

      while (this.matchKeyword('or') || this.match(TokenType.PIPE)) {
        unionMembers.push(this.parseType());
      }

      this.consume(TokenType.RPAREN, "Expected ')' after union type");
      const nullable = this.match(TokenType.QUESTION);

      return ast.createType('union', {
        isUnion: true,
        unionMembers,
        nullable,
        loc,
      });
    }

    // Generic types: Promise<T>, sequence<T>, record<K, V>, Array<T>
    if (this.checkKeyword('Promise') || this.checkKeyword('sequence') || this.checkKeyword('record') || this.checkKeyword('Array')) {
      const genericName = this.advance().value;
      this.consume(TokenType.LANGLE, `Expected '<' after generic type '${genericName}'`);

      const genericArgs = [];
      genericArgs.push(this.parseType());

      while (this.match(TokenType.COMMA)) {
        genericArgs.push(this.parseType());
      }

      this.consume(TokenType.RANGLE, `Expected '>' after generic arguments of '${genericName}'`);
      const nullable = this.match(TokenType.QUESTION);

      return ast.createType(genericName, {
        genericArgs,
        nullable,
        loc,
      });
    }

    // Multi-word types (e.g. 'unsigned short', 'unsigned long long', 'unrestricted double', 'long long')
    let typeName = this.consumeTypeName();

    while (this.check(TokenType.IDENTIFIER) || this.check(TokenType.KEYWORD)) {
      const nextWord = this.peek().value;
      if (['short', 'long', 'float', 'double', 'int'].includes(nextWord)) {
        typeName += ' ' + this.advance().value;
      } else {
        break;
      }
    }

    // Array shorthand: Type[]
    let isArray = false;
    if (this.match(TokenType.LBRACKET)) {
      this.consume(TokenType.RBRACKET, "Expected ']' after '[' for array type");
      isArray = true;
    }

    // Nullable: Type?
    const nullable = this.match(TokenType.QUESTION);

    return ast.createType(typeName, {
      nullable,
      isArray,
      loc,
    });
  }

  consumeTypeName() {
    if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.KEYWORD)) {
      return this.advance().value;
    }
    throw this.error(`Expected type name, found '${this.peek().raw}'`, this.peek());
  }

  // --- Extended Attributes ---------------------------------------------------

  parseExtendedAttributes() {
    const attributes = [];
    if (!this.match(TokenType.LBRACKET)) {
      return attributes;
    }

    while (!this.check(TokenType.RBRACKET) && !this.isAtEnd()) {
      const loc = this.currentLocation();
      const name = this.consumeIdentifierOrKeyword('Expected attribute name in extended attribute list');
      let value = true;

      if (this.match(TokenType.EQUALS)) {
        if (this.check(TokenType.STRING)) {
          value = this.advance().value;
        } else if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.KEYWORD)) {
          value = this.advance().value;
        } else if (this.check(TokenType.NUMBER)) {
          value = this.advance().value;
        } else if (this.check(TokenType.BOOLEAN)) {
          value = this.advance().value;
        } else {
          throw this.error("Expected value after '=' in attribute", this.peek());
        }
      }

      attributes.push(ast.createAttribute(name, value, loc));

      if (!this.match(TokenType.COMMA)) {
        break;
      }
    }

    this.consume(TokenType.RBRACKET, "Expected ']' after extended attribute list");
    return attributes;
  }

  // --- Values (Constants / Defaults) -----------------------------------------

  parseConstantValue() {
    if (this.check(TokenType.NUMBER)) return this.advance().value;
    if (this.check(TokenType.STRING)) return this.advance().value;
    if (this.check(TokenType.BOOLEAN)) return this.advance().value;
    if (this.check(TokenType.NULL)) { this.advance(); return null; }
    throw this.error(`Expected constant value literal (number, string, boolean), found '${this.peek().raw}'`, this.peek());
  }

  parseDefaultValue() {
    if (this.check(TokenType.NUMBER)) return this.advance().value;
    if (this.check(TokenType.STRING)) return this.advance().value;
    if (this.check(TokenType.BOOLEAN)) return this.advance().value;
    if (this.check(TokenType.NULL)) { this.advance(); return null; }
    if (this.check(TokenType.UNDEFINED)) { this.advance(); return undefined; }

    // Empty array []
    if (this.match(TokenType.LBRACKET)) {
      this.consume(TokenType.RBRACKET, "Expected ']' for default array");
      return [];
    }

    // Empty dictionary {}
    if (this.match(TokenType.LBRACE)) {
      this.consume(TokenType.RBRACE, "Expected '}' for default dictionary");
      return {};
    }

    if (this.check(TokenType.IDENTIFIER)) {
      return this.advance().value;
    }

    throw this.error(`Expected default value literal, found '${this.peek().raw}'`, this.peek());
  }

  // --- Helpers ---------------------------------------------------------------

  consumeDoc() {
    const doc = this.pendingDoc || '';
    this.pendingDoc = null;
    return doc;
  }

  currentLocation() {
    const tok = this.peek();
    return ast.createLocation(this.fileName, tok.line, tok.col);
  }

  consume(type, msg) {
    if (this.check(type)) {
      return this.advance();
    }
    throw this.error(msg, this.peek());
  }

  consumeIdentifier(msg) {
    if (this.check(TokenType.IDENTIFIER)) {
      return this.advance().value;
    }
    throw this.error(msg, this.peek());
  }

  consumeIdentifierOrKeyword(msg) {
    if (this.check(TokenType.IDENTIFIER) || this.check(TokenType.KEYWORD)) {
      return this.advance().value;
    }
    throw this.error(msg, this.peek());
  }

  match(type) {
    if (this.check(type)) {
      this.advance();
      return true;
    }
    return false;
  }

  matchKeyword(name) {
    if (this.checkKeyword(name)) {
      this.advance();
      return true;
    }
    return false;
  }

  check(type) {
    if (this.isAtEnd()) return type === TokenType.EOF;
    return this.peek().type === type;
  }

  checkKeyword(name) {
    if (this.isAtEnd()) return false;
    const tok = this.peek();
    return (tok.type === TokenType.KEYWORD || tok.type === TokenType.IDENTIFIER) && tok.value === name;
  }

  peek() {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', raw: '', line: 1, col: 1 };
  }

  advance() {
    if (!this.isAtEnd()) {
      return this.tokens[this.pos++];
    }
    return this.peek();
  }

  isAtEnd() {
    return this.pos >= this.tokens.length || this.tokens[this.pos].type === TokenType.EOF;
  }

  error(msg, token = this.peek()) {
    const line = token.line || 1;
    const col = token.col || 1;
    const err = new Error(`Parser error in ${this.fileName} (${line}:${col}): ${msg}`);
    err.file = this.fileName;
    err.line = line;
    err.col = col;
    return err;
  }
}

/**
 * Parses IDL tokens into an AST.
 * @param {Array<Object>} tokens
 * @param {string} [fileName='<input>']
 * @returns {Object}
 */
export function parse(tokens, fileName = '<input>') {
  const parser = new Parser(tokens, fileName);
  return parser.parse();
}
