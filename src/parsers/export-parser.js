// src/parsers/export-parser.js
const BaseParser = require('./base-parser');

class ExportParser extends BaseParser {
  parse(filePath) {
    const { ast, relativePath } = this.parseFile(filePath);
    const exports = [];
    const exportWarnings = [];
    
    this.traverse(ast, {
      // module.exports = something
      AssignmentExpression: (path) => {  // Arrow function to preserve 'this'
        const left = path.node.left;
        
        // Handle module.exports = 
        if (left.type === 'MemberExpression' &&
            left.object.name === 'module' &&
            left.property.name === 'exports') {
          
          this._handleModuleExports(path.node, exports, path);
        }
        
        // Handle exports.Something = 
        if (left.type === 'MemberExpression' &&
            left.object.name === 'exports' &&
            left.property.type === 'Identifier') {
          
          exports.push({
            name: left.property.name,
            type: 'commonjs',
            line: path.node.loc?.start.line,
            kind: 'named'
          });
        }
      },
      
      // ES6 named exports
      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          this._handleExportDeclaration(path.node.declaration, exports, path);
        } else if (path.node.specifiers) {
          path.node.specifiers.forEach(spec => {
            exports.push({
              name: spec.exported.name,
              type: 'es6',
              line: path.node.loc?.start.line,
              kind: 'named',
              local: spec.local?.name
            });
          });
        }
      },
      
      // ES6 default export
      ExportDefaultDeclaration(path) {
        exports.push({
          name: 'default',
          type: 'es6',
          line: path.node.loc?.start.line,
          kind: 'default'
        });
      },
      
      // ES6 export all: export * from './other'
      ExportAllDeclaration(path) {
        exports.push({
          name: '*',
          type: 'es6',
          line: path.node.loc?.start.line,
          kind: 're-export',
          source: path.node.source.value
        });
      }
    });
    
    // Check for duplicates and other issues
    this._analyzeExports(exports, exportWarnings);
    
    return { exports, exportWarnings };
  }
  
  _handleModuleExports(node, exports, path) {
    const right = node.right;
    
    if (right.type === 'Identifier') {
      exports.push({
        name: 'default',
        type: 'commonjs',
        line: node.loc?.start.line,
        kind: 'default',
        value: right.name
      });
    } else if (right.type === 'ObjectExpression') {
      right.properties.forEach(prop => {
        if (prop.key?.name) {
          exports.push({
            name: prop.key.name,
            type: 'commonjs',
            line: prop.loc?.start.line,
            kind: 'named'
          });
        }
      });
    }
  }
  
  _handleModuleExports(node, exports, path) {
    const right = node.right;
    
    if (right.type === 'Identifier') {
      exports.push({
        name: 'default',
        type: 'commonjs',
        line: node.loc?.start.line,
        kind: 'default',
        value: right.name
      });
    } else if (right.type === 'ObjectExpression') {
      right.properties.forEach(prop => {
        if (prop.key?.name) {
          exports.push({
            name: prop.key.name,
            type: 'commonjs',
            line: prop.loc?.start.line,
            kind: 'named'
          });
        }
      });
    }
  }
  
  // Make sure _analyzeExports exists too
  _analyzeExports(exports, warnings) {
    const seen = new Map();
    
    exports.forEach(exp => {
      const key = exp.name;
      if (seen.has(key)) {
        warnings.push({
          type: 'duplicate-export',
          name: key,
          lines: [seen.get(key).line, exp.line],
          message: `Export '${key}' defined multiple times`
        });
      }
      seen.set(key, exp);
    });
  }
}

module.exports = ExportParser;