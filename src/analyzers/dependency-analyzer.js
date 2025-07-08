// src/analyzers/dependency-analyzer.js
const path = require('path');

class DependencyAnalyzer {
  constructor(modules) {
    this.modules = modules; // Map from walker
    this.graph = new Map(); // Will store our dependency relationships
  }
  
  analyze() {
    // Step 1: Build a lookup map for faster access
  this.moduleLookup = this._buildModuleLookup();
  
    // Step 2: For each module, resolve its imports
  for (const [filePath, moduleInfo] of this.modules) {
    this._processModule(filePath, moduleInfo);
  }
  
    // Step 3: Build reverse dependencies (importedBy)
  this._buildReverseDependencies();
    
    return this.graph;
  }
  
  _buildModuleLookup() {
    const lookup = new Map();
    
    // Create a map of possible import paths to actual file paths
    for (const [filePath] of this.modules) {
      // Store by absolute path
      lookup.set(filePath, filePath);
      
      // Store by relative path
      const relativePath = path.relative(process.cwd(), filePath);
      lookup.set(relativePath, filePath);
      
      // Store without extension (for require statements that omit .js)
      const withoutExt = filePath.replace(/\.(js|jsx|ts|tsx)$/, '');
      lookup.set(withoutExt, filePath);
      
      // Store just the filename for potential matches
      const basename = path.basename(filePath);
      lookup.set(basename, filePath);
    }
    
    return lookup;
  }
  
  _processModule(filePath, moduleInfo) {
    const dependencies = {
      imports: [], // What this module imports
      importedBy: [], // What modules import this one
      exports: moduleInfo.exports || [],
      errors: []
    };
    
    // Process each import
    if (moduleInfo.imports) {
      for (const imp of moduleInfo.imports) {
        const resolved = this._resolveImport(imp.source, filePath);
        if (resolved) {
          dependencies.imports.push({
            source: imp.source,
            resolved: resolved,
            type: imp.type,
            line: imp.line
          });
        } else {
          dependencies.errors.push({
            type: 'unresolved-import',
            source: imp.source,
            message: `Could not resolve import: ${imp.source}`
          });
        }
      }
    }
    
    this.graph.set(filePath, dependencies);
  }
  
  _resolveImport(importPath, fromFile) {
    // Handle relative imports
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const fromDir = path.dirname(fromFile);
      const resolved = path.resolve(fromDir, importPath);
      
      // Try with and without extension
      if (this.moduleLookup.has(resolved)) {
        return this.moduleLookup.get(resolved);
      }
      
      // Try common extensions
      for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
        const withExt = resolved + ext;
        if (this.moduleLookup.has(withExt)) {
          return this.moduleLookup.get(withExt);
        }
      }
      
      // Try index file
      const indexPath = path.join(resolved, 'index.js');
      if (this.moduleLookup.has(indexPath)) {
        return this.moduleLookup.get(indexPath);
      }
    }
    
    // Handle node_modules imports (return null for now)
    // These are external dependencies
    return null;
  }

  _buildReverseDependencies() {
    // For each module in the graph
    for (const [filePath, dependencies] of this.graph) {
      // Look at what it imports
      for (const imp of dependencies.imports) {
        if (imp.resolved) {
          // Find the imported module in our graph
          const importedModule = this.graph.get(imp.resolved);
          if (importedModule) {
            // Add this file to the importedBy array
            importedModule.importedBy.push({
              source: filePath,
              line: imp.line,
              type: imp.type
            });
          }
        }
      }
    }
  }
}

module.exports = DependencyAnalyzer;