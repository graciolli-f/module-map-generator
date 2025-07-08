// src/parsers/base-parser.js
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');
const path = require('path');

class BaseParser {
  constructor() {
    this.parserOptions = {
      sourceType: 'unambiguous',
      plugins: ['jsx', 'typescript', 'decorators-legacy']
    };
  }

  parseFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);
    
    const ast = parser.parse(code, this.parserOptions);
    
    return {
      ast,
      code,
      filePath,
      relativePath
    };
  }

  traverse(ast, visitors) {
    traverse(ast, visitors);
  }
}

module.exports = BaseParser;