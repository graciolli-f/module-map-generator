// src/analyze.js
const fs = require('fs');
const path = require('path');
const DependencyAnalyzer = require('./analyzers/dependency-analyzer');
const ExportUsageAnalyzer = require('./analyzers/export-usage-analyzer');
const ConfigLoader = require('./config/config-loader');

function loadModuleMap(filePath) {
   const data = fs.readFileSync(filePath, 'utf-8');
   const parsed = JSON.parse(data);
   
   // Convert the modules object back to a Map
   const modules = new Map();
   for (const [modulePath, moduleInfo] of Object.entries(parsed.modules)) {
     // The modulePath is relative to the project root, not the target root
     // So we need to resolve it from the current working directory
     const absolutePath = path.resolve(process.cwd(), modulePath);
     modules.set(absolutePath, moduleInfo);
   }
   
   return { modules, metadata: parsed };
}

function analyze(inputPath, outputPath) {
   // Load configuration
   const configLoader = new ConfigLoader();
   const config = configLoader.load();
   
   console.log(`Loading module map from: ${inputPath}`);
   const { modules, metadata } = loadModuleMap(inputPath);
   
   console.log(`Analyzing ${modules.size} modules...`);
   
   // Initialize results
   let circularDependencies = [];
   let unusedExports = [];
   let missingExports = [];
   let dependencyGraph = new Map();
   
   // Run dependency analysis (always needed as base)
   const analyzer = new DependencyAnalyzer(modules, config);
   dependencyGraph = analyzer.analyze();
   
   // Run circular dependency detection if enabled
   if (config.analysis.detectCircularDependencies) {
     circularDependencies = analyzer.getCircularDependencies();
   }
   
   // Run export usage analysis if enabled
   if (config.analysis.detectUnusedExports || config.analysis.detectMissingExports) {
     const exportAnalyzer = new ExportUsageAnalyzer(dependencyGraph);
     const exportAnalysis = exportAnalyzer.analyze();
     
     if (config.analysis.detectUnusedExports) {
       // Pass config to export classifier
       const ExportClassifier = require('./analyzers/export-classifier');
       const projectRoot = findProjectRoot();
       const exportClassifier = new ExportClassifier(projectRoot, config);
       
       // Re-classify with config awareness
       unusedExports = exportAnalysis.unusedExports.map(exp => 
         exportClassifier.classify(exp, dependencyGraph)
       );
     }
     
     if (config.analysis.detectMissingExports) {
       missingExports = exportAnalysis.missingExports;
     }
   }
   
   // Calculate summary statistics
   const summary = {
     totalModules: modules.size,
     totalInternalDependencies: 0,
     totalExternalDependencies: 0,
     totalUnresolvedInternals: 0,
     modulesWithErrors: [],
     circularDependencyCount: circularDependencies.length,
     hasCircularDependencies: circularDependencies.length > 0,
     unusedExportCount: unusedExports.length,
     missingExportCount: missingExports.length
   };
   
   // Check for high coupling if enabled
   const highCouplingModules = [];
   if (config.analysis.detectHighCoupling?.enabled) {
    const threshold = config.analysis.detectHighCoupling.threshold || 10;
    const excludePatterns = config.analysis.detectHighCoupling.excludePatterns || [];
    
    for (const [path, deps] of dependencyGraph) {
      // Check if this file should be excluded from high coupling detection
      const relativePath = require('path').relative(process.cwd(), path);
      
      const shouldExclude = excludePatterns.some(pattern => {
        // Convert glob-like pattern to regex
        const regex = new RegExp(
          '^' + pattern
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.')
            .replace(/\//g, '\\/')
          + '$'
        );
        return regex.test(relativePath);
      });
      
      if (!shouldExclude && deps.imports.length > threshold) {
        highCouplingModules.push({
          module: path,
          importCount: deps.imports.length,
          threshold: threshold
        });
      }
    }
  }
   
   for (const [path, deps] of dependencyGraph) {
     summary.totalInternalDependencies += deps.imports.length;
     summary.totalExternalDependencies += deps.externalDependencies.length;
     summary.totalUnresolvedInternals += deps.unresolvedInternals.length;
     
     if (deps.unresolvedInternals.length > 0) {
       summary.modulesWithErrors.push(path);
     }
   }
   
   const output = {
     analyzed: new Date().toISOString(),
     root: metadata.root,
     config: {
       configFile: config._loadedFrom || 'default',
       rules: config.rules
     },
     summary: summary,
     circularDependencies: circularDependencies,
     unusedExports: unusedExports,
     missingExports: missingExports,
     highCouplingModules: highCouplingModules,
     dependencyGraph: Object.fromEntries(dependencyGraph)
   };
   
   // Write output based on config
   if (config.output.json.enabled) {
     const jsonSpacing = config.output.json.prettyPrint ? 2 : 0;
     fs.writeFileSync(outputPath, JSON.stringify(output, null, jsonSpacing));
     console.log(`\nWrote dependency analysis to: ${outputPath}`);
   }
   
   // Console output based on config
   if (config.output.console.showWarnings) {
     const maxIssues = config.output.console.maxIssuesShown || 10;
     
     // Report findings
     if (circularDependencies.length > 0) {
       console.log(`\n⚠️  Found ${circularDependencies.length} circular dependencies!`);
       circularDependencies.slice(0, maxIssues).forEach((cycle, index) => {
         console.log(`\nCycle ${index + 1}:`);
         console.log(cycle.map(p => `  ${p}`).join(' ->\n'));
       });
       if (circularDependencies.length > maxIssues) {
         console.log(`\n... and ${circularDependencies.length - maxIssues} more`);
       }
     } else if (config.analysis.detectCircularDependencies) {
       console.log('\n✅ No circular dependencies found!');
     }
     
     if (unusedExports.length > 0) {
       const problematicExports = unusedExports.filter(e => e.classification === 'likely-problematic');
       if (problematicExports.length > 0) {
         console.log(`\n⚠️  Found ${problematicExports.length} problematic unused exports!`);
         problematicExports.slice(0, maxIssues).forEach(exp => {
           const relativePath = path.relative(process.cwd(), exp.module);
           console.log(`  - ${relativePath}: '${exp.exportName}' (line ${exp.line})`);
           console.log(`    ${exp.suggestion}`);
         });
         if (problematicExports.length > maxIssues) {
           console.log(`\n... and ${problematicExports.length - maxIssues} more`);
         }
       }
     }
     
     if (missingExports.length > 0) {
       console.log(`\n❌ Found ${missingExports.length} missing exports!`);
       missingExports.slice(0, maxIssues).forEach(miss => {
         const sourcePath = path.relative(process.cwd(), miss.source);
         const targetPath = path.relative(process.cwd(), miss.targetModule);
         console.log(`  - ${sourcePath} imports '${miss.missingExport}' from ${targetPath} (line ${miss.line})`);
       });
       if (missingExports.length > maxIssues) {
         console.log(`\n... and ${missingExports.length - maxIssues} more`);
       }
     }
     
     if (highCouplingModules.length > 0) {
       console.log(`\n⚠️  Found ${highCouplingModules.length} modules with high coupling!`);
       highCouplingModules.slice(0, maxIssues).forEach(module => {
         const relativePath = path.relative(process.cwd(), module.module);
         console.log(`  - ${relativePath}: ${module.importCount} imports (threshold: ${module.threshold})`);
       });
     }
   }
}

function findProjectRoot() {
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

// CLI interface
if (require.main === module) {
 const inputPath = process.argv[2] || 'module-map.json';
 const outputPath = process.argv[3] || 'dependency-analysis.json';
 
 if (!fs.existsSync(inputPath)) {
   console.error(`Input file not found: ${inputPath}`);
   process.exit(1);
 }
 
 analyze(inputPath, outputPath);
}

module.exports = { analyze, loadModuleMap };