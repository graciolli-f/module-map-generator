// src/walker.js
const fs = require('fs');
const path = require('path');
const ModuleParser = require('./parsers/module-parser');
const ConfigLoader = require('./config/config-loader');

class CodebaseWalker {
  constructor() {
    this.parser = new ModuleParser();
    this.modules = new Map();
    this.config = new ConfigLoader().load(); // Fixed: removed undefined 'config' variable reference
    this.ignoredFiles = 0; // Track ignored files count
    this.ignoredDirectories = 0; // Track ignored directories count
    this.ignoredDirectoryNames = []; // Track names of ignored directories
  }

  walk(dir, options = {}) {
    const { 
      extensions = this.config.scan.extensions,
      ignore = this.config.scan.exclude
    } = options;

    this._walkDirectory(dir, extensions, ignore);
    return this.modules;
  }

  // Helper method to check if a path should be ignored based on glob patterns
  _shouldIgnore(pathToCheck, ignorePatterns) {
    for (const pattern of ignorePatterns) {
      // Handle simple string matches
      if (pattern === pathToCheck) {
        return true;
      }
      
      // Handle glob patterns starting with /
      if (pattern.startsWith('/') && pattern.endsWith('/*')) {
        const dirName = pattern.slice(1, -2); // Remove / and /*
        if (pathToCheck === dirName) {
          return true;
        }
      }
      
      // Handle glob patterns without leading /
      if (pattern.endsWith('/*')) {
        const dirName = pattern.slice(0, -2); // Remove /*
        if (pathToCheck === dirName) {
          return true;
        }
      }
    }
    return false;
  }

  _walkDirectory(dir, extensions, ignore) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!this._shouldIgnore(file, ignore)) {
          this._walkDirectory(fullPath, extensions, ignore);
        } else {
          this.ignoredDirectories++; // Track ignored directories
          this.ignoredDirectoryNames.push(file); // Track the directory name
        }
      } else if (extensions.includes(path.extname(file))) {
        const moduleInfo = this.parser.parseFile(fullPath);
        this.modules.set(fullPath, moduleInfo);
      } else {
        this.ignoredFiles++; // Track ignored files (wrong extension)
      }
    }
  }
}

  // Test it
if (require.main === module) {
  const configLoader = new ConfigLoader();
  const config = configLoader.load();

  const walker = new CodebaseWalker();
  const targetPath = process.argv[2]
  const outputPath = process.argv[3]
  
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
  
  // Report ignored files and directories based on config settings
  if (walker.ignoredDirectories > 0) {
    console.log(`Ignored ${walker.ignoredDirectories} directories (based on exclude patterns):`);
    walker.ignoredDirectoryNames.forEach(dir => {
      console.log(`  - ${dir}`);
    });
  }
  if (walker.ignoredFiles > 0) {
    console.log(`Ignored ${walker.ignoredFiles} files (wrong file extensions)`);
  }
}

module.exports = CodebaseWalker;
