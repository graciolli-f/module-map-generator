// src/generators/rubric-generator.js
const fs = require('fs');
const path = require('path');

class RubricGenerator {
  generate(analysisPath, outputPath = 'codebase-patterns.rux') {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    
    // Extract patterns from the analysis
    const patterns = this.extractPatterns(analysis);
    
    // Generate the rubric content
    const rubric = this.generateRubric(patterns);
    
    fs.writeFileSync(outputPath, rubric);
    console.log(`\n✅ Generated codebase rubric: ${outputPath}`);
    
    return rubric;
  }
  
  extractPatterns(analysis) {
    const patterns = {
      importPatterns: this.analyzeImportPatterns(analysis.dependencyGraph),
      exportPatterns: this.analyzeExportPatterns(analysis.dependencyGraph),
      moduleStructure: this.analyzeModuleStructure(analysis.dependencyGraph),
      circularDependencies: this.extractCircularPatterns(analysis.circularDependencies),
      couplingLimits: this.extractCouplingPatterns(analysis.dependencyGraph, analysis.highCouplingModules),
      namingConventions: this.extractNamingPatterns(analysis.dependencyGraph),
      coreModules: this.identifyCoreModules(analysis.dependencyGraph),
      entryPoints: this.identifyEntryPoints(analysis.dependencyGraph),
      boundaries: this.extractBoundaries(analysis.dependencyGraph)
    };
    
    return patterns;
  }
  
  analyzeImportPatterns(depGraph) {
    const patterns = {
      commonImportTypes: new Set(),
      importStyles: new Set(),
      relativeVsAbsolute: { relative: 0, absolute: 0 },
      averageImportsPerModule: 0,
      maxImportsFound: 0
    };
    
    let totalImports = 0;
    let moduleCount = 0;
    
    for (const [modulePath, info] of Object.entries(depGraph)) {
      if (info.imports) {
        moduleCount++;
        totalImports += info.imports.length;
        patterns.maxImportsFound = Math.max(patterns.maxImportsFound, info.imports.length);
        
        info.imports.forEach(imp => {
          patterns.commonImportTypes.add(imp.type);
          
          if (imp.source.startsWith('./') || imp.source.startsWith('../')) {
            patterns.relativeVsAbsolute.relative++;
          } else {
            patterns.relativeVsAbsolute.absolute++;
          }
          
          // Detect import styles
          if (imp.specifiers) {
            imp.specifiers.forEach(spec => {
              if (spec.type === 'namespace') patterns.importStyles.add('namespace');
              if (spec.type === 'named') patterns.importStyles.add('named');
              if (spec.type === 'default') patterns.importStyles.add('default');
            });
          }
        });
      }
    }
    
    patterns.averageImportsPerModule = moduleCount > 0 ? Math.round(totalImports / moduleCount) : 0;
    
    return patterns;
  }
  
  analyzeExportPatterns(depGraph) {
    const patterns = {
      exportTypes: new Set(),
      averageExportsPerModule: 0,
      namedVsDefault: { named: 0, default: 0 },
      unusedExportPatterns: []
    };
    
    let totalExports = 0;
    let moduleCount = 0;
    
    for (const [modulePath, info] of Object.entries(depGraph)) {
      if (info.exports && info.exports.length > 0) {
        moduleCount++;
        totalExports += info.exports.length;
        
        info.exports.forEach(exp => {
          patterns.exportTypes.add(exp.type);
          if (exp.kind === 'named') patterns.namedVsDefault.named++;
          if (exp.kind === 'default') patterns.namedVsDefault.default++;
        });
      }
    }
    
    patterns.averageExportsPerModule = moduleCount > 0 ? Math.round(totalExports / moduleCount) : 0;
    
    return patterns;
  }
  
  analyzeModuleStructure(depGraph) {
    const structure = {
      fileTypes: new Set(),
      directories: new Set(),
      depth: { min: Infinity, max: 0, average: 0 }
    };
    
    let totalDepth = 0;
    let count = 0;
    
    Object.keys(depGraph).forEach(modulePath => {
      const ext = path.extname(modulePath);
      structure.fileTypes.add(ext);
      
      const dir = path.dirname(modulePath);
      structure.directories.add(dir);
      
      const depth = modulePath.split(path.sep).length;
      structure.depth.min = Math.min(structure.depth.min, depth);
      structure.depth.max = Math.max(structure.depth.max, depth);
      totalDepth += depth;
      count++;
    });
    
    structure.depth.average = count > 0 ? Math.round(totalDepth / count) : 0;
    
    return structure;
  }
  
  extractCircularPatterns(circularDeps) {
    return {
      exists: circularDeps && circularDeps.length > 0,
      count: circularDeps ? circularDeps.length : 0,
      modules: circularDeps ? circularDeps.flat().filter((v, i, a) => a.indexOf(v) === i) : []
    };
  }
  
  extractCouplingPatterns(depGraph, highCouplingModules) {
    const importCounts = [];
    
    Object.values(depGraph).forEach(info => {
      if (info.imports) {
        importCounts.push(info.imports.length);
      }
    });
    
    importCounts.sort((a, b) => a - b);
    
    return {
      median: importCounts[Math.floor(importCounts.length / 2)] || 0,
      p90: importCounts[Math.floor(importCounts.length * 0.9)] || 0,
      max: Math.max(...importCounts, 0),
      highCouplingThreshold: highCouplingModules && highCouplingModules[0] 
        ? highCouplingModules[0].threshold 
        : 10
    };
  }
  
  extractNamingPatterns(depGraph) {
    const patterns = {
      casing: { camelCase: 0, kebabCase: 0, snakeCase: 0, pascalCase: 0 },
      prefixes: new Set(),
      suffixes: new Set()
    };
    
    Object.keys(depGraph).forEach(modulePath => {
      const fileName = path.basename(modulePath, path.extname(modulePath));
      
      // Detect casing
      if (/^[a-z]+(?:[A-Z][a-z]+)*$/.test(fileName)) patterns.casing.camelCase++;
      else if (/^[a-z]+(?:-[a-z]+)*$/.test(fileName)) patterns.casing.kebabCase++;
      else if (/^[a-z]+(?:_[a-z]+)*$/.test(fileName)) patterns.casing.snakeCase++;
      else if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)*$/.test(fileName)) patterns.casing.pascalCase++;
      
      // Common suffixes
      const suffixPatterns = ['Controller', 'Service', 'Model', 'View', 'Component', 'Manager', 'Handler', 'Utils'];
      suffixPatterns.forEach(suffix => {
        if (fileName.endsWith(suffix)) patterns.suffixes.add(suffix);
      });
    });
    
    // Determine dominant casing
    const dominantCasing = Object.entries(patterns.casing)
      .sort(([,a], [,b]) => b - a)[0][0];
    
    patterns.dominant = dominantCasing;
    
    return patterns;
  }
  
  identifyCoreModules(depGraph) {
    const importCounts = {};
    
    Object.entries(depGraph).forEach(([modulePath, info]) => {
      if (info.importedBy && info.importedBy.length > 0) {
        importCounts[modulePath] = info.importedBy.length;
      }
    });
    
    const sorted = Object.entries(importCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    return sorted.map(([modulePath, count]) => ({
      path: modulePath,
      name: path.basename(modulePath),
      importedByCount: count
    }));
  }
  
  identifyEntryPoints(depGraph) {
    const entryPoints = [];
    
    Object.entries(depGraph).forEach(([modulePath, info]) => {
      // Entry points are modules that aren't imported by anything but import others
      if ((!info.importedBy || info.importedBy.length === 0) && 
          (info.imports && info.imports.length > 0)) {
        entryPoints.push({
          path: modulePath,
          name: path.basename(modulePath)
        });
      }
    });
    
    return entryPoints;
  }
  
  extractBoundaries(depGraph) {
    // Analyze which directories import from which other directories
    const directoryImports = {};
    
    Object.entries(depGraph).forEach(([modulePath, info]) => {
      const fromDir = path.dirname(modulePath);
      
      if (info.imports) {
        info.imports.forEach(imp => {
          if (imp.resolved) {
            const toDir = path.dirname(imp.resolved);
            
            if (fromDir !== toDir) {
              if (!directoryImports[fromDir]) {
                directoryImports[fromDir] = new Set();
              }
              directoryImports[fromDir].add(toDir);
            }
          }
        });
      }
    });
    
    return directoryImports;
  }
  
  generateRubric(patterns) {
    const { 
      importPatterns, 
      exportPatterns, 
      moduleStructure,
      circularDependencies,
      couplingLimits,
      namingConventions,
      coreModules,
      entryPoints,
      boundaries
    } = patterns;
    
    // Build the rubric content
    let rubric = `// codebase-patterns.rux
// Auto-generated rubric based on analyzed codebase patterns
// Generated: ${new Date().toISOString()}
// This file captures the actual patterns and boundaries in your codebase

!CodebasePatterns:
  Version: "1.0.0"
  Purpose: "Enforce existing codebase conventions and boundaries"
  
  !ImportPatterns:
    !Style: "${importPatterns.relativeVsAbsolute.relative > importPatterns.relativeVsAbsolute.absolute ? 'relative' : 'absolute'}"
    !PreferredTypes: [${Array.from(importPatterns.commonImportTypes).map(t => `"${t}"`).join(', ')}]
    !PreferredImportStyle: [${Array.from(importPatterns.importStyles).map(s => `"${s}"`).join(', ')}]
    
    !Limits:
      !AverageImportsPerModule: ${importPatterns.averageImportsPerModule}
      !MaxRecommended: ${Math.min(importPatterns.maxImportsFound, couplingLimits.highCouplingThreshold)}
      ?WarningThreshold: ${couplingLimits.p90}
      
    !Rules:
      !Use relative imports for internal modules
      ?Avoid importing more than ${couplingLimits.highCouplingThreshold} modules
      ${circularDependencies.exists ? '!NEVER create circular dependencies - existing ones need fixing' : '!Maintain zero circular dependencies'}
      
  !ExportPatterns:
    !PreferredStyle: "${exportPatterns.namedVsDefault.named > exportPatterns.namedVsDefault.default ? 'named' : 'default'}"
    !AverageExportsPerModule: ${exportPatterns.averageExportsPerModule}
    
    !Rules:
      ${exportPatterns.namedVsDefault.named > exportPatterns.namedVsDefault.default 
        ? '!Prefer named exports over default exports' 
        : '!Prefer default exports for main module interface'}
      !Export only what other modules actually need
      ?Keep export surface small and focused
      
  !ModuleStructure:
    !FileTypes: [${Array.from(moduleStructure.fileTypes).map(t => `"${t}"`).join(', ')}]
    !NamingConvention: "${namingConventions.dominant}"
    ${namingConventions.suffixes.size > 0 ? `!CommonSuffixes: [${Array.from(namingConventions.suffixes).map(s => `"${s}"`).join(', ')}]` : ''}
    
    !DirectoryDepth:
      Average: ${moduleStructure.depth.average}
      Range: "${moduleStructure.depth.min}-${moduleStructure.depth.max}"
      
  !CoreModules:
    # These modules are imported by many others - changes here affect the whole system
    !HighImpact:
${coreModules.map(m => `      - "${m.name}" # imported by ${m.importedByCount} modules`).join('\n')}
    
    !Rules:
      !Changes to core modules require careful consideration
      !Do not add unnecessary dependencies to core modules
      !Keep core module interfaces stable
      
  !EntryPoints:
    # Modules that start execution chains - not imported by others
    !List:
${entryPoints.map(e => `      - "${e.name}"`).join('\n')}
    
    !Rules:
      !Entry points can import anything they need
      !Entry points should not be imported by other modules
      ?Entry points orchestrate, they don't implement
      
  !ModuleBoundaries:
    # Existing import relationships between directories
    !CurrentPatterns:
${Object.entries(boundaries).map(([from, tos]) => 
  `      "${from}": [${Array.from(tos).map(to => `"${to}"`).join(', ')}]`
).join('\n')}
    
    !Rules:
      !Respect existing directory boundaries
      ?Don't create new cross-directory dependencies without consideration
      ~Keep related functionality within same directory
      
${circularDependencies.exists ? `
  !CircularDependencies:
    # WARNING: These circular dependencies exist and should be fixed
    !ExistingProblems:
      Count: ${circularDependencies.count}
      InvolvedModules: [${circularDependencies.modules.map(m => `"${m}"`).join(', ')}]
    
    !Rules:
      !DO NOT create new circular dependencies
      !DO NOT add to existing circular dependency chains
      !Consider refactoring to break these cycles
` : ''}

  !CouplingGuidelines:
    !Metrics:
      MedianImports: ${couplingLimits.median}
      90thPercentile: ${couplingLimits.p90}
      CurrentMaximum: ${couplingLimits.max}
      
    !Rules:
      !Normal modules: ${couplingLimits.median} imports or fewer
      ?Complex modules: up to ${couplingLimits.p90} imports with justification
      !Red flag: more than ${couplingLimits.highCouplingThreshold} imports
      
  !AIGuidance:
    When creating new modules:
      !Follow the ${namingConventions.dominant} naming convention
      !Place in appropriate directory based on functionality
      !Import only from allowed directories per boundaries above
      !Export using ${exportPatterns.namedVsDefault.named > exportPatterns.namedVsDefault.default ? 'named' : 'default'} style
      !Keep imports under ${couplingLimits.median} for normal modules
      
    When modifying existing modules:
      !Don't create circular dependencies
      !Don't exceed ${couplingLimits.highCouplingThreshold} imports
      !Maintain existing export style
      !Respect module boundaries
      
    Red flags to avoid:
      !Importing from unrelated directories
      !Creating "god modules" with too many dependencies
      !Breaking established patterns without justification`;

    return rubric;
  }
}

module.exports = RubricGenerator;