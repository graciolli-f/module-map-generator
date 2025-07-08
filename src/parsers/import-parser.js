// src/parsers/import-parser.js
const BaseParser = require('./base-parser');

class ImportParser extends BaseParser {
  parse(filePath) {
    const { ast, relativePath } = this.parseFile(filePath);
    const imports = [];
    
    this.traverse(ast, {
      // CommonJS require()
      CallExpression(path) {
        if (path.node.callee.name === 'require' && 
            path.node.arguments[0]?.type === 'StringLiteral') {
          imports.push({
            source: path.node.arguments[0].value,
            type: 'commonjs',
            line: path.node.loc?.start.line,
            specifiers: ['*'] // CommonJS imports everything
          });
        }
      },
      
      // ES6 imports
      ImportDeclaration(path) {
        const importInfo = {
          source: path.node.source.value,
          type: 'es6',
          line: path.node.loc?.start.line,
          specifiers: []
        };
        
        path.node.specifiers.forEach(spec => {
          if (spec.type === 'ImportDefaultSpecifier') {
            importInfo.specifiers.push({
              type: 'default',
              local: spec.local.name
            });
          } else if (spec.type === 'ImportSpecifier') {
            importInfo.specifiers.push({
              type: 'named',
              imported: spec.imported.name,
              local: spec.local.name
            });
          } else if (spec.type === 'ImportNamespaceSpecifier') {
            importInfo.specifiers.push({
              type: 'namespace',
              local: spec.local.name
            });
          }
        });
        
        imports.push(importInfo);
      }
    });
    
    return { imports };
  }
}

module.exports = ImportParser;