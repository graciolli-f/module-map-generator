// src/analyze.js
const fs = require('fs');
const path = require('path');
const DependencyAnalyzer = require('./analyzers/dependency-analyzer');

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
    
    // Create focused analysis output - ONLY the dependency graph
    const output = {
      analyzed: new Date().toISOString(),
      root: metadata.root,
      moduleCount: modules.size,
      dependencyGraph: Object.fromEntries(dependencyGraph)
    };
    
    // Write analysis results
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\nWrote dependency analysis to: ${outputPath}`);
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