// src/parsers/class-parser.js
const BaseParser = require('./base-parser');

class ClassParser extends BaseParser {
  parse(filePath) {
    const { ast } = this.parseFile(filePath);
    const classes = [];
    
    const self = this; // Capture this reference
    
    this.traverse(ast, {
      ClassDeclaration(path) {
        const classInfo = {
          name: path.node.id?.name || 'AnonymousClass',
          line: path.node.loc?.start.line,
          superClass: path.node.superClass?.name,
          methods: [],
          properties: []
        };
        
        path.node.body.body.forEach(member => {
          if (member.type === 'ClassMethod') {
            classInfo.methods.push({
              name: member.key.name,
              kind: member.kind,
              static: member.static,
              private: member.key.name.startsWith('_')
            });
          } else if (member.type === 'ClassProperty') {
            classInfo.properties.push({
              name: member.key.name,
              static: member.static,
              private: member.key.name.startsWith('_')
            });
          }
        });
        
        classes.push(classInfo);
      },
      
      FunctionDeclaration(path) {
        // Check if it looks like a constructor function
        if (self._looksLikeConstructor(path.node)) {
          classes.push({
            name: path.node.id?.name,
            line: path.node.loc?.start.line,
            type: 'function-constructor'
          });
        }
      }
    });
    
    return { classes };
  }
  
  _looksLikeConstructor(node) {
    // Add safety checks
    if (!node || !node.id || !node.id.name) {
      return false;
    }
    
    // Check if starts with capital letter
    if (!/^[A-Z]/.test(node.id.name)) {
      return false;
    }
    
    // Check if has 'this.' assignments in body
    if (!node.body || !node.body.body || !Array.isArray(node.body.body)) {
      return false;
    }
    
    return node.body.body.some(stmt => 
      stmt && 
      stmt.type === 'ExpressionStatement' &&
      stmt.expression &&
      stmt.expression.type === 'AssignmentExpression' &&
      stmt.expression.left &&
      stmt.expression.left.type === 'MemberExpression' &&
      stmt.expression.left.object &&
      stmt.expression.left.object.type === 'ThisExpression'
    );
  }
}

module.exports = ClassParser;