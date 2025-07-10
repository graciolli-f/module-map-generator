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
      ignore = this.config.scan.exclude,
      respectGitignore = this.config.scan.respectGitignore,
      additionalIgnore = this.config.scan.additionalIgnore || []
    } = options;

    // Initialize gitignore parser if needed
    if (respectGitignore) {
      this.gitignoreParser = new GitignoreParser(dir);
    }

    // Combine all ignore patterns
    const allIgnorePatterns = [...ignore, ...additionalIgnore];

    this._walkDirectory(dir, extensions, allIgnorePatterns);
    return this.modules;
  }

  _shouldIgnore(pathToCheck, ignorePatterns, isFile = false) {
    // Get the basename for file matching
    const basename = path.basename(pathToCheck);
    
    for (const pattern of ignorePatterns) {
      // Direct match
      if (pattern === pathToCheck || pattern === basename) {
        return true;
      }
      
      // File extension patterns (*.log, *.tmp)
      if (isFile && pattern.startsWith('*')) {
        const extension = pattern.slice(1);
        if (basename.endsWith(extension)) {
          return true;
        }
      }
      
      // Directory patterns
      if (!isFile) {
        if (pattern.startsWith('/') && pattern.endsWith('/*')) {
          const dirName = pattern.slice(1, -2);
          if (pathToCheck === dirName) {
            return true;
          }
        }
        
        if (pattern.endsWith('/*')) {
          const dirName = pattern.slice(0, -2);
          if (pathToCheck === dirName) {
            return true;
          }
        }
        
        if (pattern.endsWith('/')) {
          const dirName = pattern.slice(0, -1);
          if (pathToCheck === dirName || basename === dirName) {
            return true;
          }
        }
      }
    }
    return false;
  }

  _walkDirectory(dir, extensions, ignore) {
    const files = fs.readdirSync(dir);
    
    // Merge config excludes with additionalIgnore
    const allIgnorePatterns = [
      ...ignore,
      ...(this.config.scan.additionalIgnore || [])
    ];
  
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!this._shouldIgnore(file, allIgnorePatterns, false)) {
          this._walkDirectory(fullPath, extensions, allIgnorePatterns);
        } else {
          this.ignoredDirectories++;
          this.ignoredDirectoryNames.push(file);
        }
      } else {
        // Check if file should be ignored
        if (this._shouldIgnore(file, allIgnorePatterns, true)) {
          this.ignoredFiles++;
          continue;
        }
        
        if (extensions.includes(path.extname(file))) {
          const moduleInfo = this.parser.parseFile(fullPath);
          this.modules.set(fullPath, moduleInfo);
        } else {
          this.ignoredFiles++;
        }
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