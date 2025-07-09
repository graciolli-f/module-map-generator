// src/parsers/import-parser.js
const BaseParser = require('./base-parser');

class ImportParser extends BaseParser {
  parse(filePath) {
    const { ast } = this.parseFile(filePath);
    const imports = [];
    
    this.traverse(ast, {
      // CommonJS require()
      CallExpression(path) {
        if (path.node.callee.name === 'require' && 
            path.node.arguments[0]?.type === 'StringLiteral') {
          
          const importInfo = {
            source: path.node.arguments[0].value,
            type: 'commonjs',
            line: path.node.loc?.start.line,
            specifiers: []
          };
          
          // Check what's being destructured or assigned
          const parent = path.parent;
          
          if (parent.type === 'VariableDeclarator') {
            if (parent.id.type === 'ObjectPattern') {
              // const { a, b } = require('./module')
              parent.id.properties.forEach(prop => {
                if (prop.type === 'ObjectProperty') {
                  importInfo.specifiers.push({
                    type: 'named',
                    imported: prop.key.name,
                    local: prop.value.name
                  });
                }
              });
            } else if (parent.id.type === 'Identifier') {
              // const module = require('./module')
              importInfo.specifiers.push({
                type: 'namespace',
                local: parent.id.name
              });
            }
          } else if (parent.type === 'MemberExpression' && 
                     parent.property.type === 'Identifier') {
            // require('./module').specificExport
            importInfo.specifiers.push({
              type: 'named',
              imported: parent.property.name,
              local: parent.property.name
            });
          } else {
            // Direct require() call without assignment
            importInfo.specifiers.push({
              type: 'namespace',
              local: '*'
            });
          }
          
          imports.push(importInfo);
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