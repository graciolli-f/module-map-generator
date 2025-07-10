// src/parsers/module-parser.js
const ImportParser = require('./import-parser');
const ExportParser = require('./export-parser');
const ClassParser = require('./class-parser');
const path = require('path');

class ModuleParser {
  constructor() {
    this.importParser = new ImportParser();
    this.exportParser = new ExportParser();
    this.classParser = new ClassParser();
  }
  
  parseFile(filePath) {
    const relativePath = require('path').relative(process.cwd(), filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Handle non-JavaScript files (though walker should handle these now)
    if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
      return {
        path: relativePath,
        imports: [],
        exports: [{
          name: 'default',
          type: 'data',
          line: 1,
          kind: 'default'
        }],
        exportWarnings: [],
        classes: [],
        className: null,
        fileType: 'data',
        dataType: ext.slice(1)
      };
    }
    
    if (ext === '.css') {
      return {
        path: relativePath,
        imports: [], // Could parse @import statements if needed
        exports: [], // CSS modules would have exports
        exportWarnings: [],
        classes: [],
        className: null,
        fileType: 'css'
      };
    }
    
    try {
      // Run all parsers for JS/JSX/TS/TSX files
      const { imports } = this.importParser.parse(filePath);
      const { exports, exportWarnings } = this.exportParser.parse(filePath);
      const { classes } = this.classParser.parse(filePath);
      
      return {
        path: relativePath,
        imports,
        exports,
        exportWarnings,
        classes,
        // Backward compatibility
        className: classes[0]?.name || null
      };
    } catch (error) {
      return {
        path: relativePath,
        error: error.message,
        imports: [],
        exports: [],
        classes: []
      };
    }
  }
}

module.exports = ModuleParser;