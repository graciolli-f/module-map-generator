// src/generators/ai-context-generator.js
const fs = require('fs');
const path = require('path');

class AIContextGenerator {
  generate(analysisPath, outputPath = 'ai-context.md') {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    
    const markdown = `# Codebase Structure and Rules

Generated on: ${new Date().toISOString()}
Project: ${path.basename(analysis.root)}

## Overview
- **Total Modules**: ${analysis.summary.totalModules}
- **Has Circular Dependencies**: ${analysis.summary.hasCircularDependencies ? 'Yes ⚠️' : 'No ✅'}
- **Unused Exports**: ${analysis.summary.unusedExportCount}
- **Missing Exports**: ${analysis.summary.missingExportCount}

## Important Patterns and Rules

${this.generateModularityRules(analysis)}

${this.generateCircularDependencySection(analysis.circularDependencies)}

${this.generateHighCouplingSection(analysis.highCouplingModules, analysis.dependencyGraph)}

${this.generateUnusedExportsSection(analysis.unusedExports)}

${this.generateApiSurfaceSection(analysis.dependencyGraph)}

## Module Relationships

${this.generateModuleRelationships(analysis.dependencyGraph)}

## Guidelines for AI/LLM Code Generation

When modifying this codebase:
${this.generateAIGuidelines(analysis)}

## Quick Reference

### Most Connected Modules
${this.generateMostConnectedModules(analysis.dependencyGraph)}

### Entry Points
${this.generateEntryPoints(analysis.dependencyGraph)}
`;

    fs.writeFileSync(outputPath, markdown);
    console.log(`\n✅ Generated AI context: ${outputPath}`);
    return markdown;
  }

  generateModularityRules(analysis) {
    const rules = [];
    
    if (analysis.summary.hasCircularDependencies) {
      rules.push('- ⚠️ **Circular dependencies exist** - Be careful when modifying involved modules to not introduce additional cycles');
    }
    
    if (analysis.summary.unusedExportCount > 5) {
      rules.push('- 📦 **Many unused exports** - Consider checking if exports are necessary before adding new ones');
    }
    
    if (analysis.summary.missingExportCount > 0) {
      rules.push('- ❌ **Missing exports detected** - Some modules import non-existent exports. Fix these before adding dependencies');
    }
    
    // Add specific rules based on patterns
    if (analysis.config?.rules?.publicApiPaths?.length > 0) {
      rules.push(`- 🔒 **Public API paths**: Only these should be imported by external code: ${analysis.config.rules.publicApiPaths.join(', ')}`);
    }
    
    return rules.length > 0 ? rules.join('\n') : '- ✅ No critical modularity issues detected';
  }

  generateCircularDependencySection(circularDeps) {
    if (!circularDeps || circularDeps.length === 0) {
      return '## Circular Dependencies\n\n✅ No circular dependencies found.\n';
    }
    
    let section = '## Circular Dependencies\n\n⚠️ **Warning**: The following circular dependencies exist. Avoid adding to these cycles:\n\n';
    
    circularDeps.forEach((cycle, index) => {
      const simplified = cycle.slice(0, -1); // Remove duplicate last element
      section += `${index + 1}. ${simplified.map(p => `\`${path.basename(p)}\``).join(' → ')} → \`${path.basename(simplified[0])}\`\n`;
    });
    
    section += '\n**Impact**: Circular dependencies make code harder to understand, test, and refactor. When modifying these files, ensure you don\'t create additional cycles.\n';
    
    return section;
  }

  generateHighCouplingSection(highCouplingModules, depGraph) {
    if (!highCouplingModules || highCouplingModules.length === 0) {
      return '## High Coupling Modules\n\n✅ No high coupling issues detected.\n';
    }
    
    let section = '## High Coupling Modules\n\n⚠️ These modules depend on many others and might be doing too much:\n\n';
    
    highCouplingModules.forEach(module => {
      const moduleName = path.basename(module.module);
      section += `- **${moduleName}**: Imports ${module.importCount} modules (threshold: ${module.threshold})\n`;
      
      // List what it imports
      const deps = depGraph[module.module];
      if (deps && deps.imports) {
        const importedModules = deps.imports.map(imp => path.basename(imp.resolved || imp.source));
        section += `  - Depends on: ${importedModules.join(', ')}\n`;
      }
    });
    
    section += '\n**Recommendation**: High coupling indicates a module might have too many responsibilities. Consider breaking it down.\n';
    
    return section;
  }

  generateUnusedExportsSection(unusedExports) {
    if (!unusedExports || unusedExports.length === 0) {
      return '## Unused Exports\n\n✅ All exports are being used.\n';
    }
    
    // Group by classification
    const problematic = unusedExports.filter(e => e.classification === 'likely-problematic');
    const valid = unusedExports.filter(e => e.classification === 'likely-valid');
    
    let section = '## Unused Exports\n\n';
    
    if (problematic.length > 0) {
      section += '### 🔴 Likely Dead Code\n\nThese exports appear to be unused and can probably be removed:\n\n';
      problematic.slice(0, 5).forEach(exp => {
        section += `- \`${path.basename(exp.module)}\`: **${exp.exportName}** - ${exp.suggestion}\n`;
      });
      if (problematic.length > 5) {
        section += `- ... and ${problematic.length - 5} more\n`;
      }
    }
    
    if (valid.length > 0) {
      section += '\n### 🟡 Framework/Tool Exports\n\nThese are unused but likely needed for framework/tool compatibility:\n\n';
      section += `- ${valid.length} exports (React components, config files, etc.)\n`;
    }
    
    return section;
  }

  generateApiSurfaceSection(depGraph) {
    let section = '## Module API Surface\n\n';
    
    // Find modules with the most exports
    const moduleExports = [];
    for (const [modulePath, info] of Object.entries(depGraph)) {
      if (info.exports && info.exports.length > 0) {
        moduleExports.push({
          path: modulePath,
          name: path.basename(modulePath),
          exportCount: info.exports.length,
          exports: info.exports.map(e => e.name)
        });
      }
    }
    
    moduleExports.sort((a, b) => b.exportCount - a.exportCount);
    
    section += 'Modules with significant API surface:\n\n';
    moduleExports.slice(0, 5).forEach(module => {
      section += `- **${module.name}** (${module.exportCount} exports): ${module.exports.slice(0, 5).join(', ')}${module.exports.length > 5 ? '...' : ''}\n`;
    });
    
    return section;
  }

  generateModuleRelationships(depGraph) {
    let section = 'Key module relationships:\n\n';
    
    // Find modules that are imported by many others (core modules)
    const importCounts = {};
    for (const [modulePath, info] of Object.entries(depGraph)) {
      if (info.importedBy && info.importedBy.length > 0) {
        importCounts[modulePath] = info.importedBy.length;
      }
    }
    
    const coreModules = Object.entries(importCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    if (coreModules.length > 0) {
      section += '### Core Dependencies (imported by many)\n';
      coreModules.forEach(([modulePath, count]) => {
        section += `- \`${path.basename(modulePath)}\` - imported by ${count} modules\n`;
      });
    }
    
    return section;
  }

  generateAIGuidelines(analysis) {
    const guidelines = [];
    
    // Base guidelines
    guidelines.push('1. **Check imports**: Ensure any new imports align with existing patterns');
    guidelines.push('2. **Respect module boundaries**: Don\'t create new dependencies that would increase coupling');
    
    if (analysis.summary.hasCircularDependencies) {
      guidelines.push('3. **Avoid circular dependencies**: Check that new imports won\'t create cycles');
    }
    
    if (analysis.highCouplingModules?.length > 0) {
      guidelines.push('4. **Reduce coupling**: Avoid adding more dependencies to high-coupling modules');
    }
    
    guidelines.push('5. **Export only what\'s needed**: Don\'t add exports unless they\'ll be used by other modules');
    
    return guidelines.join('\n');
  }

  generateMostConnectedModules(depGraph) {
    const connections = {};
    
    for (const [modulePath, info] of Object.entries(depGraph)) {
      const importCount = info.imports?.length || 0;
      const importedByCount = info.importedBy?.length || 0;
      connections[modulePath] = {
        name: path.basename(modulePath),
        total: importCount + importedByCount,
        imports: importCount,
        importedBy: importedByCount
      };
    }
    
    const sorted = Object.entries(connections)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 5);
    
    return sorted.map(([path, info]) => 
      `- \`${info.name}\`: ${info.total} connections (imports ${info.imports}, imported by ${info.importedBy})`
    ).join('\n');
  }

  generateEntryPoints(depGraph) {
    const entryPoints = [];
    
    for (const [modulePath, info] of Object.entries(depGraph)) {
      // Entry points are modules that aren't imported by anything
      if (!info.importedBy || info.importedBy.length === 0) {
        // But they should import something (not isolated)
        if (info.imports && info.imports.length > 0) {
          entryPoints.push(path.basename(modulePath));
        }
      }
    }
    
    if (entryPoints.length === 0) {
      return 'No clear entry points found (all modules are imported by others)';
    }
    
    return entryPoints.map(ep => `- \`${ep}\``).join('\n');
  }
}

module.exports = AIContextGenerator;