// src/walker.js
const fs = require('fs');
const path = require('path');
const ModuleParser = require('./parsers/module-parser');

class CodebaseWalker {
  constructor() {
    this.parser = new ModuleParser();
    this.modules = new Map();
  }

  walk(dir, options = {}) {
    const { 
      extensions = ['.js', '.jsx', '.ts', '.tsx'],
      ignore = ['node_modules', '.git', 'test', '__tests__', 'dist', 'build']
    } = options;

    this._walkDirectory(dir, extensions, ignore);
    return this.modules;
  }

  _walkDirectory(dir, extensions, ignore) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!ignore.includes(file)) {
          this._walkDirectory(fullPath, extensions, ignore);
        }
      } else if (extensions.includes(path.extname(file))) {
        const moduleInfo = this.parser.parseFile(fullPath);
        this.modules.set(fullPath, moduleInfo);
      }
    }
  }
}

  // Test it
if (require.main === module) {
  const walker = new CodebaseWalker();
  const targetPath = process.argv[2] || 'test-repos/commander.js';
  const outputPath = process.argv[3] || 'module-map.json';
  
  // Make path absolute
  const absolutePath = path.resolve(process.cwd(), targetPath);
  
  // Check if directory exists
  if (!fs.existsSync(absolutePath)) {
    console.error(`Directory not found: ${absolutePath}`);
    process.exit(1);
  }
  
  console.log(`Analyzing: ${absolutePath}`);
  const modules = walker.walk(absolutePath);
  
  // Convert Map to object for JSON serialization
  const moduleData = {};
  for (const [filePath, info] of modules) {
    // Use relative paths in the output
    const relativePath = path.relative(process.cwd(), filePath);
    moduleData[relativePath] = info;
  }
  
  // Create the output structure
  const output = {
    analyzed: new Date().toISOString(),
    root: absolutePath,
    moduleCount: modules.size,
    modules: moduleData
  };
  
  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote module map to: ${outputPath}`);
  console.log(`Found ${modules.size} modules`);
}

module.exports = CodebaseWalker;
