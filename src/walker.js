// src/walker.js
const fs = require('fs');
const path = require('path');
const ModuleParser = require('./parsers/module-parser');
const ConfigLoader = require('./config/config-loader');
const GitignoreParser = require('./parsers/gitignore-parser');

class CodebaseWalker {
  constructor() {
    this.parser = new ModuleParser();
    this.modules = new Map();
    this.config = new ConfigLoader().load();
    this.ignoredFiles = 0;
    this.ignoredDirectories = 0;
    this.ignoredDirectoryNames = [];
    this.gitignoreParser = null;
  }

  walk(dir, options = {}) {
    const { 
      extensions = this.config.scan.extensions,
      ignore = this.config.scan.ignore || this.config.scan.exclude || [], // Support both old and new config
      respectGitignore = this.config.scan.respectGitignore
    } = options;
  
    // Initialize gitignore parser if needed
    if (respectGitignore) {
      this.gitignoreParser = new GitignoreParser(dir);
    }
  
    this._walkDirectory(dir, extensions, ignore);
    return this.modules;
  }

  _shouldIgnore(name, ignorePatterns, fullPath = null) {
    for (const pattern of ignorePatterns) {
      // Direct match
      if (pattern === name) return true;
      
      // Handle ** patterns (match anywhere in path)
      if (pattern.includes('**/')) {
        const filePattern = pattern.replace('**/', '');
        // Check if the full path ends with the pattern
        if (fullPath && fullPath.endsWith(filePattern)) return true;
        // Also check just the filename
        if (name === filePattern) return true;
      }
      
      // Handle simple glob patterns
      if (pattern.includes('*') && !pattern.includes('**/')) {
        // *.extension
        if (pattern.startsWith('*.')) {
          const ext = pattern.slice(1);
          if (name.endsWith(ext)) return true;
        }
        // */filename
        if (pattern.startsWith('*/')) {
          const filename = pattern.slice(2);
          if (name === filename) return true;
        }
        // dir/*
        if (pattern.endsWith('/*')) {
          const dir = pattern.slice(0, -2);
          if (name === dir) return true;
        }
      }
    }
    return false;
  }
  
  // Update _walkDirectory to pass fullPath
  _walkDirectory(dir, extensions, ignore) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      // Check gitignore first
      if (this.gitignoreParser && this.gitignoreParser.shouldIgnore(fullPath)) {
        if (stat.isDirectory()) {
          this.ignoredDirectories++;
          this.ignoredDirectoryNames.push(file + ' (gitignored)');
        } else {
          this.ignoredFiles++;
        }
        continue;
      }
      
      // Check ignore patterns with full path for ** patterns
      const relativePath = path.relative(process.cwd(), fullPath);
      if (this._shouldIgnore(file, ignore, relativePath)) {
        if (stat.isDirectory()) {
          this.ignoredDirectories++;
          this.ignoredDirectoryNames.push(file);
        } else {
          this.ignoredFiles++;
        }
        continue;
      }
      
      if (stat.isDirectory()) {
        this._walkDirectory(fullPath, extensions, ignore);
      } else if (extensions.includes(path.extname(file))) {
        const moduleInfo = this.parser.parseFile(fullPath);
        this.modules.set(fullPath, moduleInfo);
      } else {
        this.ignoredFiles++;
      }
    }
  }
}

// Test it
if (require.main === module) {
  const configLoader = new ConfigLoader();
  const config = configLoader.load();

  const walker = new CodebaseWalker();
  const targetPath = process.argv[2];
  const outputPath = process.argv[3];
  
  const absolutePath = path.resolve(process.cwd(), targetPath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`Directory not found: ${absolutePath}`);
    process.exit(1);
  }
  
  console.log(`Analyzing: ${absolutePath}`);
  const modules = walker.walk(absolutePath);
  
  const moduleData = {};
  for (const [filePath, info] of modules) {
    const relativePath = path.relative(process.cwd(), filePath);
    moduleData[relativePath] = info;
  }
  
  const output = {
    analyzed: new Date().toISOString(),
    root: absolutePath,
    moduleCount: modules.size,
    modules: moduleData
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote module map to: ${outputPath}`);
  console.log(`Found ${modules.size} modules`);
  
  if (walker.ignoredDirectories > 0) {
    console.log(`Ignored ${walker.ignoredDirectories} directories:`);
    walker.ignoredDirectoryNames.forEach(dir => {
      console.log(`  - ${dir}`);
    });
  }
  if (walker.ignoredFiles > 0) {
    console.log(`Ignored ${walker.ignoredFiles} files`);
  }
}

module.exports = CodebaseWalker;