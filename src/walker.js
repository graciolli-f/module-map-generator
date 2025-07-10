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
    // Debug mode
    this.debugMode = process.env.DEBUG_WALKER === 'true';
    this.ignoredByReason = {
      gitignore: 0,
      testFile: 0,
      configPattern: 0,
      extension: 0
    };
  }

  walk(dir, options = {}) {
    const { 
      extensions = this.config.scan.extensions,
      dataExtensions = this.config.scan.dataExtensions || [],
      ignore = this.config.scan.ignore || this.config.scan.exclude || [],
      respectGitignore = this.config.scan.respectGitignore
    } = options;
  
    // Initialize gitignore parser if needed
    if (respectGitignore) {
      this.gitignoreParser = new GitignoreParser(dir);
    }
  
    // Combine code and data extensions
    const allExtensions = [...extensions, ...dataExtensions];
  
    this._walkDirectory(dir, extensions, dataExtensions, ignore);
    return this.modules;
  }
  

  _shouldIgnore(name, ignorePatterns, fullPath = null) {
    for (const pattern of ignorePatterns) {
      // Direct match
      if (pattern === name) return true;
      
      // Handle ** patterns (match anywhere in path)
      if (pattern.includes('**/')) {
        const filePattern = pattern.replace('**/', '');
        
        // Check if the pattern has wildcards
        if (filePattern.includes('*')) {
          // Convert glob pattern to regex
          const regex = this._globToRegex(filePattern);
          if (regex.test(name)) return true;
        } else {
          // Exact filename match
          if (fullPath && fullPath.endsWith(filePattern)) return true;
          if (name === filePattern) return true;
        }
      }
      
      // Handle simple glob patterns (not starting with **/)
      if (pattern.includes('*') && !pattern.includes('**/')) {
        // Convert pattern to regex and test
        const regex = this._globToRegex(pattern);
        if (regex.test(name)) return true;
      }
    }
    return false;
  }
  
  // Helper method to convert glob patterns to regex
  _globToRegex(pattern) {
    // Escape special regex characters except * and ?
    let regexStr = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    
    // Replace * with .* (any characters)
    regexStr = regexStr.replace(/\*/g, '.*');
    
    // Replace ? with . (single character)
    regexStr = regexStr.replace(/\?/g, '.');
    
    // Anchor the pattern
    return new RegExp('^' + regexStr + '$');
  }
  
  // Update _walkDirectory to pass fullPath
  // Update to ignore test files
  _walkDirectory(dir, extensions, dataExtensions, ignore) {
    const files = fs.readdirSync(dir);
  
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      const fileExt = path.extname(file);
      
      // Check gitignore first
      if (this.gitignoreParser && this.gitignoreParser.shouldIgnore(fullPath)) {
        if (this.debugMode && stat.isFile()) {
          console.log(`[GITIGNORE] ${path.relative(process.cwd(), fullPath)}`);
        }
        this.ignoredByReason.gitignore++;
        if (stat.isDirectory()) {
          this.ignoredDirectories++;
          this.ignoredDirectoryNames.push(file + ' (gitignored)');
        } else {
          this.ignoredFiles++;
        }
        continue;
      }
      
      // Check if we should ignore test files
      if (stat.isFile() && this.config.scan.ignoreTestFiles) {
        if (this.debugMode) {
          console.log(`[TEST FILE] ${path.relative(process.cwd(), fullPath)}`);
        }
        this.ignoredByReason.testFile++;
        const relativePath = path.relative(process.cwd(), fullPath);
        const testPatterns = this.config.scan.testPatterns || [];
        
        const isTestFile = testPatterns.some(pattern => {
          if (pattern.includes('**/')) {
            const filePattern = pattern.replace('**/', '');
            const regex = this._globToRegex(filePattern);
            return regex.test(file) || regex.test(relativePath);
          } else {
            const regex = this._globToRegex(pattern);
            return regex.test(file);
          }
        });
        
        if (isTestFile) {
          this.ignoredFiles++;
          continue;
        }
      }
      
      // Check ignore patterns
      const relativePath = path.relative(process.cwd(), fullPath);
      if (this._shouldIgnore(file, ignore, relativePath)) {
        if (this.debugMode && stat.isFile()) {
          console.log(`[CONFIG PATTERN] ${relativePath}`);
        }
        this.ignoredByReason.configPattern++;
        if (stat.isDirectory()) {
          this.ignoredDirectories++;
          this.ignoredDirectoryNames.push(file);
        } else {
          this.ignoredFiles++;
        }
        continue;
      }
      
      if (stat.isDirectory()) {
        // Pass all 4 parameters when recursing
        this._walkDirectory(fullPath, extensions, dataExtensions, ignore);
      } else if (extensions.includes(fileExt) || dataExtensions.includes(fileExt)) {
        // Check if it's a data file
        const isDataFile = dataExtensions.includes(fileExt);
        
        if (isDataFile) {
          // For data files, just track their existence
          const relativePath = path.relative(process.cwd(), fullPath);
          this.modules.set(fullPath, {
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
            fileType: 'data',  // This is crucial!
            dataType: fileExt.slice(1) // 'json', 'yaml', 'yml'
          });
        } else {
          // Regular code file - parse normally
          const moduleInfo = this.parser.parseFile(fullPath);
          this.modules.set(fullPath, moduleInfo);
        }
      } else {
        if (this.debugMode) {
          console.log(`[WRONG EXTENSION] ${relativePath} (${fileExt})`);
        }
        this.ignoredByReason.extension++;
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
  console.log(`\nIgnored file breakdown:`);
  console.log(`  By gitignore: ${walker.ignoredByReason.gitignore}`);
  console.log(`  Test files: ${walker.ignoredByReason.testFile}`);
  console.log(`  Config patterns: ${walker.ignoredByReason.configPattern}`);
  console.log(`  Wrong extension: ${walker.ignoredByReason.extension}`);
}

module.exports = CodebaseWalker;