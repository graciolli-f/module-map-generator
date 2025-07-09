// Create src/analyzers/export-usage-analyzer.js
const path = require('path');

class ExportUsageAnalyzer {
    constructor(dependencyGraph) {
      this.graph = dependencyGraph;
    }
    
    analyze() {
      const exportUsage = new Map();
      const missingExports = [];
      
      // Initialize export usage tracking
      for (const [filePath, deps] of this.graph) {
        if (deps.exports && deps.exports.length > 0) {
          const usage = {};
          deps.exports.forEach(exp => {
            usage[exp.name] = {
              export: exp,
              importedBy: []
            };
          });
          exportUsage.set(filePath, usage);
        }
      }
      
      // Check each import to see what's actually being used
      for (const [filePath, deps] of this.graph) {
        for (const imp of deps.imports) {
          if (imp.resolved && imp.specifiers) {
            // ADD DEBUGGING HERE
            const targetModule = exportUsage.get(imp.resolved);
            console.log(`\nChecking import from ${path.relative(process.cwd(), filePath)}`);
            console.log(`  to ${path.relative(process.cwd(), imp.resolved)}`);
            console.log(`  specifiers:`, imp.specifiers);
            console.log(`  targetModule exists:`, !!targetModule);
            
            if (targetModule) {
              console.log(`  Available exports:`, Object.keys(targetModule));
            }
            // END DEBUGGING
            
            for (const spec of imp.specifiers) {
              if (spec.type === 'named') {
                // Check if the named import exists in the target module
                if (targetModule && targetModule[spec.imported]) {
                  // Mark this export as used
                  targetModule[spec.imported].importedBy.push({
                    source: filePath,
                    line: imp.line
                  });
                } else if (targetModule) {
                  // Import specifies a name that doesn't exist!
                  missingExports.push({
                    source: filePath,
                    targetModule: imp.resolved,
                    missingExport: spec.imported,
                    line: imp.line
                  });
                }
              } else if (spec.type === 'namespace') {
                // namespace import uses all exports
                if (targetModule) {
                  Object.keys(targetModule).forEach(exportName => {
                    targetModule[exportName].importedBy.push({
                      source: filePath,
                      line: imp.line,
                      type: 'namespace'
                    });
                  });
                }
              } else if (spec.type === 'default') {
                // Check for default export
                if (targetModule && targetModule.default) {
                  targetModule.default.importedBy.push({
                    source: filePath,
                    line: imp.line
                  });
                }
              }
            }
          }
        }
      }
      
      // Identify unused exports
      const unusedExports = [];
      for (const [filePath, usage] of exportUsage) {
        for (const [exportName, info] of Object.entries(usage)) {
          if (info.importedBy.length === 0) {
            unusedExports.push({
              module: filePath,
              exportName: exportName,
              line: info.export.line
            });
          }
        }
      }
      
      return {
        exportUsage,
        unusedExports,
        missingExports
      };
    }
  }
  
  module.exports = ExportUsageAnalyzer;