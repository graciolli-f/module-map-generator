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
          // Skip tracking exports for data files
          if (deps.fileType === 'data') {
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
        // Double-check - skip data files
        const moduleInfo = this.graph.get(filePath);
        if (moduleInfo && moduleInfo.fileType === 'data') {
          continue;
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


    console.log('\n=== DEBUG: Export Usage Analysis ===');
    console.log('Total modules with exports:', exportUsage.size);

    // Check utils.js specifically
    for (const [filePath, usage] of exportUsage) {
      if (filePath.includes('utils.js')) {
        console.log('\nutils.js export usage:');
        for (const [exportName, info] of Object.entries(usage)) {
          console.log(`  - ${exportName}: imported by ${info.importedBy.length} modules`);
          if (info.importedBy.length > 0) {
            info.importedBy.forEach(imp => {
              console.log(`    <- ${path.basename(imp.source)}`);
            });
          }
        }
      }
    }

  console.log('\nTotal unused exports found:', unusedExports.length);
  console.log('Unused exports:', unusedExports.map(e => 
    `${path.basename(e.module)}:${e.exportName}`
  ).join(', '));
  console.log('=== END DEBUG ===\n');
  
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
          classification: 'likely-problematic',
          confidence: 1.0, // High confidence - we know the export doesn't exist
          score: -10,
          reasons: ['export-does-not-exist'],
          suggestions: [`Export '${miss.missingExport}' not found in ${path.basename(miss.targetModule)}`],
          suggestion: `Add 'exports.${miss.missingExport}' to ${path.basename(miss.targetModule)} or fix the import`
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