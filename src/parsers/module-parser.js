// src/parsers/module-parser.js
const ImportParser = require('./import-parser');
const ExportParser = require('./export-parser');
const ClassParser = require('./class-parser');

class ModuleParser {
  constructor() {
    this.importParser = new ImportParser();
    this.exportParser = new ExportParser();
    this.classParser = new ClassParser();
  }
  
  parseFile(filePath) {
    const relativePath = require('path').relative(process.cwd(), filePath);
    
    try {
      // Run all parsers
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