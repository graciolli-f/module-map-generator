// src/analyze.js
const fs = require('fs');
const path = require('path');
const DependencyAnalyzer = require('./analyzers/dependency-analyzer');
const ExportUsageAnalyzer = require('./analyzers/export-usage-analyzer');


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
    console.log(`Loading module map from: ${inputPath}`);
    const { modules, metadata } = loadModuleMap(inputPath);
    
    console.log(`Analyzing ${modules.size} modules...`);
    const analyzer = new DependencyAnalyzer(modules);
    const dependencyGraph = analyzer.analyze();
    
    // Get circular dependencies
    const circularDependencies = analyzer.getCircularDependencies();
    
    // Calculate summary statistics
    const summary = {
      totalModules: modules.size,
      totalInternalDependencies: 0,
      totalExternalDependencies: 0,
      totalUnresolvedInternals: 0,
      modulesWithErrors: [],
      circularDependencyCount: circularDependencies.length,
      hasCircularDependencies: circularDependencies.length > 0
    };
    
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
      summary: summary,
      circularDependencies: circularDependencies,
      dependencyGraph: Object.fromEntries(dependencyGraph)
    };
    
    // Write analysis results
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nWrote dependency analysis to: ${outputPath}`);
    
    // Report findings
    if (circularDependencies.length > 0) {
      console.log(`\n⚠️  Found ${circularDependencies.length} circular dependencies!`);
      circularDependencies.forEach((cycle, index) => {
        console.log(`\nCycle ${index + 1}:`);
        console.log(cycle.map(p => `  ${p}`).join(' ->\n'));
      });
    } else {
      console.log('\n✅ No circular dependencies found!');
    }
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

function analyze(inputPath, outputPath) {
    console.log(`Loading module map from: ${inputPath}`);
    const { modules, metadata } = loadModuleMap(inputPath);
    
    console.log(`Analyzing ${modules.size} modules...`);
    
    // Run dependency analysis
    const analyzer = new DependencyAnalyzer(modules);
    const dependencyGraph = analyzer.analyze();
    const circularDependencies = analyzer.getCircularDependencies();
    
    // Run export usage analysis
    const exportAnalyzer = new ExportUsageAnalyzer(dependencyGraph);
    const { unusedExports, missingExports } = exportAnalyzer.analyze();
    
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
      summary: summary,
      circularDependencies: circularDependencies,
      unusedExports: unusedExports,
      missingExports: missingExports,
      dependencyGraph: Object.fromEntries(dependencyGraph)
    };
    
    // Write analysis results
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nWrote dependency analysis to: ${outputPath}`);
    
    // Report findings
    if (circularDependencies.length > 0) {
      console.log(`\n⚠️  Found ${circularDependencies.length} circular dependencies!`);
    }
    
    if (unusedExports.length > 0) {
      console.log(`\n⚠️  Found ${unusedExports.length} unused exports!`);
      unusedExports.slice(0, 5).forEach(exp => {
        const relativePath = path.relative(process.cwd(), exp.module);
        console.log(`  - ${relativePath}: '${exp.exportName}' (line ${exp.line})`);
      });
      if (unusedExports.length > 5) {
        console.log(`  ... and ${unusedExports.length - 5} more`);
      }
    }
    
    if (missingExports.length > 0) {
      console.log(`\n❌ Found ${missingExports.length} missing exports!`);
      missingExports.forEach(miss => {
        const sourcePath = path.relative(process.cwd(), miss.source);
        const targetPath = path.relative(process.cwd(), miss.targetModule);
        console.log(`  - ${sourcePath} imports '${miss.missingExport}' from ${targetPath} (line ${miss.line})`);
      });
    }
}

module.exports = { analyze, loadModuleMap };