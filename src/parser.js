// parser.js
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');
const path = require('path');

class ModuleParser {
  parseFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Parse into AST
    const ast = parser.parse(code, {
      sourceType: 'unambiguous', // Handles both CommonJS and ES modules
      plugins: ['jsx', 'typescript'] // Support JSX and TS if needed
    });
    
    const moduleInfo = {
      path: relativePath,
      imports: [],
      exports: [],
      className: null
    };
    
    // Traverse AST to extract information
    traverse(ast, {
      // CommonJS require()
      CallExpression(path) {
        if (path.node.callee.name === 'require' && 
            path.node.arguments[0]?.type === 'StringLiteral') {
          moduleInfo.imports.push({
            source: path.node.arguments[0].value,
            type: 'commonjs'
          });
        }
      },
      
      // ES6 imports
      ImportDeclaration(path) {
        moduleInfo.imports.push({
          source: path.node.source.value,
          type: 'es6'
        });
      },
      
      // module.exports
      AssignmentExpression(path) {
        if (path.node.left.type === 'MemberExpression' &&
            path.node.left.object.name === 'module' &&
            path.node.left.property.name === 'exports') {
          
          // Extract what's being exported
          const right = path.node.right;
          if (right.type === 'Identifier') {
            moduleInfo.exports.push(right.name);
          } else if (right.type === 'ObjectExpression') {
            // Handle module.exports = { foo, bar }
            right.properties.forEach(prop => {
              if (prop.key?.name) {
                moduleInfo.exports.push(prop.key.name);
              }
            });
          }
        }
      },
      
      // ES6 exports
      ExportNamedDeclaration(path) {
        if (path.node.declaration?.id?.name) {
          moduleInfo.exports.push(path.node.declaration.id.name);
        }
      },
      
      // Detect class names
      ClassDeclaration(path) {
        if (path.node.id?.name) {
          moduleInfo.className = path.node.id.name;
        }
      }
    });
    
    return moduleInfo;
  }
}

// Quick test
if (require.main === module) {
  const parser = new ModuleParser();
  const result = parser.parseFile(process.argv[2]);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = ModuleParser;