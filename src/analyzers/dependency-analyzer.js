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

    // Step 4: Detect circular dependencies
    this.circularDependencies = this._detectCircularDependencies();
    
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
  
  // In _processModule method, replace the import processing logic:
_processModule(filePath, moduleInfo) {
    const dependencies = {
      imports: [], // All imports with their types
      importedBy: [], 
      exports: moduleInfo.exports || [],
      externalDependencies: [], // External packages
      unresolvedInternals: [] // Actual errors - internal imports that couldn't be resolved
    };
    
    // Process each import
    if (moduleInfo.imports) {
      for (const imp of moduleInfo.imports) {
        const isRelative = imp.source.startsWith('./') || imp.source.startsWith('../');
        const isNodeBuiltin = ['fs', 'path', 'child_process', 'util', 'events', 'os', 'crypto'].includes(imp.source) || 
                             imp.source.startsWith('node:');
        
        if (isRelative) {
          // Internal project import
          const resolved = this._resolveImport(imp.source, filePath);
          if (resolved) {
            dependencies.imports.push({
              source: imp.source,
              resolved: resolved,
              type: imp.type,
              line: imp.line,
              dependencyType: 'internal'
            });
          } else {
            // This is an actual error - couldn't resolve internal import
            dependencies.unresolvedInternals.push({
              source: imp.source,
              line: imp.line,
              message: `Could not resolve internal import: ${imp.source}`
            });
          }
        } else if (isNodeBuiltin) {
          // Node.js built-in module
          dependencies.externalDependencies.push({
            source: imp.source,
            type: 'node-builtin',
            line: imp.line
          });
        } else {
          // External npm package
          dependencies.externalDependencies.push({
            source: imp.source,
            type: 'npm-package',
            line: imp.line
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
  _detectCircularDependencies() {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();
    const currentPath = []; // Renamed from 'path' to 'currentPath'

    const dfs = (node) => {
      visited.add(node);
      recursionStack.add(node);
      currentPath.push(node); // Updated

      const dependencies = this.graph.get(node);
      if (dependencies && dependencies.imports) {
        for (const imp of dependencies.imports) {
          if (imp.resolved) {
            if (!visited.has(imp.resolved)) {
              dfs(imp.resolved);
            } else if (recursionStack.has(imp.resolved)) {
              // Found a cycle!
              const cycleStartIndex = currentPath.indexOf(imp.resolved); // Updated
              const cycle = currentPath.slice(cycleStartIndex); // Updated
              cycle.push(imp.resolved); // Complete the cycle
              
              // Store cycle with relative paths for readability
              const relativeCycle = cycle.map(p => path.relative(process.cwd(), p));
              cycles.push(relativeCycle);
            }
          }
        }
      }

      currentPath.pop(); // Updated
      recursionStack.delete(node);
    };

    // Run DFS from each unvisited node
    for (const [node] of this.graph) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    // Remove duplicate cycles (same cycle found from different starting points)
    const uniqueCycles = this._deduplicateCycles(cycles);
    
    return uniqueCycles;
  }

  _deduplicateCycles(cycles) {
    const seen = new Set();
    const unique = [];

    for (const cycle of cycles) {
      // Normalize cycle by rotating to start with the "smallest" path
      const normalized = this._normalizeCycle(cycle);
      const key = normalized.join(' -> ');
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(cycle);
      }
    }

    return unique;
  }

  _normalizeCycle(cycle) {
    // Remove the duplicate last element
    const withoutDuplicate = cycle.slice(0, -1);
    
    // Find the "smallest" element to start with (for consistent ordering)
    let minIndex = 0;
    for (let i = 1; i < withoutDuplicate.length; i++) {
      if (withoutDuplicate[i] < withoutDuplicate[minIndex]) {
        minIndex = i;
      }
    }

    // Rotate array to start with the smallest element
    return [
      ...withoutDuplicate.slice(minIndex),
      ...withoutDuplicate.slice(0, minIndex)
    ];
  }

  // Add a getter for the circular dependencies
  getCircularDependencies() {
    return this.circularDependencies || [];
  }
}           

module.exports = DependencyAnalyzer;