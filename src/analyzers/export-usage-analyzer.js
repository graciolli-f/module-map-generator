// src/analyzers/export-usage-analyzer.js
const path = require('path');
const fs = require('fs');
const ExportClassifier = require('./export-classifier');
const ImportClassifier = require('./import-classifier');

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
          const moduleInfo = this.graph.get(filePath);
          if (moduleInfo.fileType === 'data') {
          continue;
          }
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
            const targetModule = exportUsage.get(imp.resolved);
            
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
        const moduleInfo = this.graph.get(filePath);
        if (moduleInfo.fileType === 'data') {
          continue; // Data files can have "unused" exports
        }
        
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
  
      // Get project root
      const projectRoot = this.findProjectRoot();
      
      // Classify unused exports
      const exportClassifier = new ExportClassifier(projectRoot);
      const classifiedUnusedExports = unusedExports.map(exp => 
        exportClassifier.classify(exp, this.graph)
      );
      
      // Classify missing exports (these are unresolved imports)
      const importClassifier = new ImportClassifier(projectRoot);
      const classifiedMissingExports = missingExports.map(miss => {
        // Transform to match ImportClassifier expected format
        const unresolvedImport = {
          source: miss.missingExport,
          fromModule: miss.source,
          line: miss.line
        };
        
        const classification = importClassifier.classify(unresolvedImport, this.graph);
        
        // Merge the original data with classification
        return {
          ...miss,
          ...classification,
          source: miss.source, // Keep original source (the importing module)
          missingExport: miss.missingExport // Keep the missing export name
        };
      });
      
      return {
        exportUsage,
        unusedExports: classifiedUnusedExports,
        missingExports: classifiedMissingExports
      };
    }
    
    findProjectRoot() {
      // Find the root by looking for package.json
      let dir = process.cwd();
      while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'package.json'))) {
          return dir;
        }
        dir = path.dirname(dir);
      }
      return process.cwd();
    }
  }
  
  module.exports = ExportUsageAnalyzer;