// src/analyzers/export-classifier.js
const path = require('path');
const fs = require('fs');
const ConfigLoader = require('../config/config-loader');

class ExportClassifier {
 constructor(projectRoot) {
   this.projectRoot = projectRoot;
   this.packageJson = this.loadPackageJson();
   this.config = new ConfigLoader().load(); // Fixed: removed undefined 'config' variable reference
 }

 loadPackageJson() {
   try {
     const packagePath = path.join(this.projectRoot, 'package.json');
     return JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
   } catch {
     return {};
   }
 }

 classify(unusedExport, allModules) {
   const scores = [];
   const reasons = [];

   if (this.isIgnoredByConfig(unusedExport)) {
    scores.push(20);
    reasons.push('ignored-by-config');
  }

  // Check if public API path from config
  if (this.isPublicApiPath(unusedExport.module)) {
    scores.push(15);
    reasons.push('public-api-path');
  }

   // Check if entry point
   if (this.isEntryPoint(unusedExport.module)) {
     scores.push(10);
     reasons.push('entry-point-file');
   }

   // Check if index/barrel file
   if (this.isIndexFile(unusedExport.module)) {
     scores.push(8);
     reasons.push('index-file');
   }

   // Check if framework file
   const frameworkType = this.getFrameworkType(unusedExport.module);
   if (frameworkType) {
     scores.push(7);
     reasons.push(`framework-pattern-${frameworkType}`);
   }

   // Check if lifecycle method
   if (this.isLifecycleMethod(unusedExport.exportName)) {
     scores.push(5);
     reasons.push('lifecycle-method');
   }

   // Check if test utility
   if (this.isTestUtility(unusedExport)) {
     scores.push(6);
     reasons.push('test-utility');
   }

   // Check if demo/example file
   if (this.isDemoOrExample(unusedExport.module)) {
     scores.push(-8);
     reasons.push('demo-or-example-file');
   }

   // Check if deprecated
   if (this.isDeprecated(unusedExport.exportName)) {
     scores.push(-10);
     reasons.push('deprecated-pattern');
   }

   // Check if private naming
   if (this.isPrivateNaming(unusedExport.exportName)) {
     scores.push(-8);
     reasons.push('private-naming');
   }

   const totalScore = scores.reduce((a, b) => a + b, 0);
   
   return {
     module: unusedExport.module,
     exportName: unusedExport.exportName,
     line: unusedExport.line,
     classification: totalScore > 0 ? 'likely-valid' : 'likely-problematic',
     confidence: Math.min(Math.abs(totalScore) / 10, 1),
     score: totalScore,
     reasons,
     suggestion: this.getSuggestion(totalScore, reasons)
   };
 }

 isEntryPoint(modulePath) {
   const relativePath = path.relative(this.projectRoot, modulePath);
   return (
     this.packageJson.main === relativePath ||
     this.packageJson.main === './' + relativePath ||
     (this.packageJson.exports && 
      Object.values(this.packageJson.exports).flat().includes('./' + relativePath))
   );
 }

 isIndexFile(modulePath) {
   return path.basename(modulePath) === 'index.js' || 
          path.basename(modulePath) === 'index.ts' ||
          path.basename(modulePath) === 'index.jsx' ||
          path.basename(modulePath) === 'index.tsx';
 }

 isConfigFile(modulePath) {
    const configPatterns = [
      // Tool configs
      'eslint.config.', '.eslintrc.', 
      'jest.config.', 'jest.setup.',
      'webpack.config.', 
      'rollup.config.', 
      'vite.config.', 
      'tsconfig.', 
      'babel.config.', '.babelrc.',
      'prettier.config.', '.prettierrc.',
      'postcss.config.',
      'tailwind.config.',
      'next.config.',
      'nuxt.config.',
      'vue.config.',
      'svelte.config.',
      'playwright.config.',
      'vitest.config.',
      'cypress.config.',
      // Generic config patterns
      '.config.js', '.config.ts', '.config.mjs',
      'config.js', 'config.ts', 'config.json'
    ];
    
    const fileName = path.basename(modulePath).toLowerCase();
    return configPatterns.some(pattern => fileName.includes(pattern));
  }

 getFrameworkType(modulePath) {
   const frameworkPatterns = {
     'next': ['pages/api/', 'pages/', 'app/'],
     'storybook': ['.stories.'],
     'jest': ['.test.', '.spec.', '__tests__/'],
     'vue': ['.vue'],
     'react': ['components/', '.jsx', '.tsx']
   };

   for (const [framework, patterns] of Object.entries(frameworkPatterns)) {
     if (patterns.some(pattern => modulePath.includes(pattern))) {
       return framework;
     }
   }
   return null;
 }

 isIgnoredByConfig(unusedExport) {
    if (!this.config.rules?.ignoredExports) return false;
    
    for (const [pattern, exportPatterns] of Object.entries(this.config.rules.ignoredExports)) {
      if (this.matchesPattern(unusedExport.module, pattern)) {
        if (exportPatterns.includes('*')) return true;
        if (exportPatterns.some(p => this.matchesPattern(unusedExport.exportName, p))) {
          return true;
        }
      }
    }
    return false;
  }

  isPublicApiPath(modulePath) {
    if (!this.config.rules?.publicApiPaths) return false;
    
    const relativePath = path.relative(this.projectRoot, modulePath);
    return this.config.rules.publicApiPaths.some(pattern => 
      this.matchesPattern(relativePath, pattern)
    );
  }

  matchesPattern(str, pattern) {
    // Convert glob-like pattern to regex
    const regex = new RegExp(
      '^' + pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\//g, '\\/')
      + '$'
    );
    return regex.test(str);
  }

 isLifecycleMethod(name) {
   const lifecycles = [
     'onMount', 'onUnmount', 'onDestroy', 'beforeCreate', 'afterCreate',
     'willUpdate', 'didUpdate', 'shouldUpdate', 'componentDidMount',
     'componentWillUnmount', 'render', 'constructor', 'getDerivedStateFromProps',
     'getSnapshotBeforeUpdate', 'componentDidCatch', 'setup', 'cleanup',
     'useEffect', 'useLayoutEffect', 'useMemo', 'useCallback'
   ];
   return lifecycles.includes(name);
 }

 isDeprecated(name) {
   const deprecatedPatterns = ['deprecated', 'old', 'legacy', 'DEPRECATED', 'OLD'];
   return deprecatedPatterns.some(pattern => name.toLowerCase().includes(pattern));
 }

 isPrivateNaming(name) {
   return name.startsWith('_') || 
          name.includes('Private') || 
          name.includes('Internal') ||
          name.endsWith('Impl');
 }

 isTestUtility(unusedExport) {
   const testPatterns = ['mock', 'Mock', 'stub', 'Stub', 'fake', 'Fake', 'test', 'Test', 'spec', 'Spec'];
   const isTestFile = unusedExport.module.includes('.test.') || 
                     unusedExport.module.includes('.spec.') ||
                     unusedExport.module.includes('__tests__') ||
                     unusedExport.module.includes('__mocks__');
   
   return isTestFile && testPatterns.some(pattern => 
     unusedExport.exportName.includes(pattern)
   );
 }

 isDemoOrExample(modulePath) {
   const demoPatterns = [
     'demo/', 'demos/', 'example/', 'examples/',
     'sample/', 'samples/',
     '.demo.', '.example.', '.sample.',
     'custom-mcp-servers/', 'playground/',
     'snippets/', 'scratch/', 'tmp/', 'temp/'
   ];
   
   return demoPatterns.some(pattern => 
     modulePath.toLowerCase().includes(pattern)
   );
 }

 getSuggestion(score, reasons) {
   if (reasons.includes('config-file')) return 'configuration file for build tools';
   if (reasons.includes('entry-point-file')) return 'part of public API';
   if (score > 5) {
     return 'Keep - ' + this.getPositiveReason(reasons);
   } else if (score < -5) {
     return 'Consider removing - ' + this.getNegativeReason(reasons);
   } else {
     return 'Review needed - unclear if this export is necessary';
   }
 }

 getPositiveReason(reasons) {
   if (reasons.includes('entry-point-file')) return 'part of public API';
   if (reasons.includes('framework-pattern-next')) return 'Next.js convention';
   if (reasons.includes('framework-pattern-react')) return 'React component';
   if (reasons.includes('lifecycle-method')) return 'lifecycle hook';
   if (reasons.includes('test-utility')) return 'test helper function';
   if (reasons.includes('index-file')) return 'barrel export file';
   return 'likely intentional';
 }

 getNegativeReason(reasons) {
   if (reasons.includes('deprecated-pattern')) return 'appears to be deprecated';
   if (reasons.includes('private-naming')) return 'uses private naming convention';
   if (reasons.includes('demo-or-example-file')) return 'appears to be a demo/example file';
   return 'possibly dead code';
 }
}

module.exports = ExportClassifier;