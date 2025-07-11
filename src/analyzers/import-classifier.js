const path = require('path');
const fs = require('fs');

class ImportClassifier {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
  }

  classify(unresolvedImport, allModules) {
    const scores = [];
    const reasons = [];
    const suggestions = [];
  
    // Check if this is an integration test testing built output
    if (this.isLikelyIntegrationTest(unresolvedImport.fromModule, unresolvedImport.source)) {
      scores.push(10);
      reasons.push('integration-test-pattern');
      suggestions.push('Expected - integration test importing built package');
    }
  
    // Check build-time pattern
    if (this.isBuildTimeConstant(unresolvedImport.source)) {
      scores.push(10);
      reasons.push('build-time-constant');
    }
  
    // Check platform-specific
    if (this.isPlatformSpecific(unresolvedImport.source)) {
      scores.push(8);
      reasons.push('platform-specific');
    }
  
    // Check if optional (in try-catch)
    if (this.isOptionalPattern(unresolvedImport)) {
      scores.push(7);
      reasons.push('optional-dependency');
    }
  
    // Check for typos
    const typoSuggestion = this.checkForTypo(unresolvedImport.source, allModules);
    if (typoSuggestion) {
      scores.push(-10);
      reasons.push('possible-typo');
      suggestions.push(`Did you mean '${typoSuggestion}'?`);
    }
  
    // Check wrong extension
    const extensionFix = this.checkWrongExtension(unresolvedImport);
    if (extensionFix) {
      scores.push(-8);
      reasons.push('wrong-extension');
      suggestions.push(`Try '${extensionFix}'`);
    }
  
    const totalScore = scores.reduce((a, b) => a + b, 0);
  
    return {
      source: unresolvedImport.source,
      fromModule: unresolvedImport.fromModule,
      line: unresolvedImport.line,
      classification: totalScore > 0 ? 'likely-valid' : 'likely-problematic',
      confidence: Math.min(Math.abs(totalScore) / 10, 1),
      score: totalScore,
      reasons,
      suggestions,
      suggestion: this.getSuggestion(totalScore, reasons, suggestions)
    };
  }

  isBuildTimeConstant(importPath) {
    const patterns = [
      /^__[A-Z_]+__$/,  // __BUILD_CONFIG__
      /^process\.env/,   // process.env.NODE_ENV
      /^BUILD_/,         // BUILD_VERSION
      /^WEBPACK_/        // WEBPACK_PUBLIC_PATH
    ];
    return patterns.some(pattern => pattern.test(importPath));
  }

  isPlatformSpecific(importPath) {
    const platformExtensions = ['.ios', '.android', '.web', '.native', '.electron'];
    return platformExtensions.some(ext => importPath.includes(ext));
  }

  isOptionalPattern(unresolvedImport) {
    // This would need AST analysis to check if import is in try-catch
    // For now, check common optional dependency patterns
    const optionalPackages = ['redis', 'mongodb', 'pg', 'mysql', 'canvas'];
    return optionalPackages.some(pkg => unresolvedImport.source.includes(pkg));
  }

  isLikelyIntegrationTest(filePath, importPath) {
    const fileName = path.basename(filePath).toLowerCase();
    
    // Integration test indicators in filename
    const integrationTestPatterns = [
      'integration',
      'e2e',
      'end-to-end',
      'export-test',
      'build-test',
      'dist-test',
      'package-test',
      'publish-test'
    ];
    
    // Check if filename suggests integration testing
    const isIntegrationTestFile = integrationTestPatterns.some(pattern => 
      fileName.includes(pattern)
    );
    
    // Check if importing from build directories
    const buildDirs = ['dist', 'build', 'lib', 'es', 'cjs'];
    const isImportingFromBuild = buildDirs.some(dir => 
      importPath.includes(`/${dir}/`) || 
      importPath.startsWith(`./${dir}/`) || 
      importPath.startsWith(`../${dir}/`)
    );
    
    return isIntegrationTestFile && isImportingFromBuild;
  }
  
  // In the classify method, update:
  classify(unresolvedImport, allModules) {
    const scores = [];
    const reasons = [];
    const suggestions = [];
  
    // Check if this is an integration test testing built output
    if (this.isLikelyIntegrationTest(unresolvedImport.fromModule, unresolvedImport.source)) {
      scores.push(10);
      reasons.push('integration-test-pattern');
      suggestions.push('Expected - integration test importing built package');
    } else {
      // Check if importing from build directory (but not integration test)
      const buildCheck = this.checkForBuildDirectoryImport(unresolvedImport.source);
      if (buildCheck.isBuildImport) {
        scores.push(-8);
        reasons.push('improper-build-import');
        suggestions.push(`Import from source files instead of ${buildCheck.buildDir}/`);
      }
    }
  }

  checkForTypo(importPath, allModules) {
    // Simple typo detection - check for similar paths
    const candidates = [];
    
    for (const [modulePath] of allModules) {
      const moduleName = path.basename(modulePath);
      const importName = path.basename(importPath);
      
      if (this.levenshteinDistance(moduleName, importName) <= 2) {
        candidates.push(modulePath);
      }
    }

    if (candidates.length === 1) {
      return path.relative(path.dirname(importPath), candidates[0]);
    }
    
    return null;
  }

  checkWrongExtension(unresolvedImport) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
    const basePath = unresolvedImport.source.replace(/\.[^/.]+$/, '');
    
    // This is simplified - in reality, you'd check if these files exist
    if (!unresolvedImport.source.includes('.')) {
      return `${unresolvedImport.source}.js`;
    }
    
    return null;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  checkForBuildDirectoryImport(importPath) {
    const buildDirs = ['dist', 'build', 'lib', 'es', 'cjs', 'out', '.next'];
    
    for (const dir of buildDirs) {
      if (importPath.includes(`/${dir}/`) || 
          importPath.startsWith(`./${dir}/`) || 
          importPath.startsWith(`../${dir}/`)) {
        return {
          isBuildImport: true,
          buildDir: dir
        };
      }
    }
    
    return {
      isBuildImport: false,
      buildDir: null
    };
  }

  getSuggestion(score, reasons, suggestions) {
    if (score > 0) {
      if (reasons.includes('build-time-constant')) {
        return 'Expected - resolved at build time';
      }
      if (reasons.includes('platform-specific')) {
        return 'Expected - platform-specific import';
      }
      return 'Likely intentional';
    } else {
      if (suggestions.length > 0) {
        return suggestions[0];
      }
      return 'Check import path';
    }
  }
}

module.exports = ImportClassifier;