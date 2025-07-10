// src/config/config-loader.js
const fs = require('fs');
const path = require('path');

// Track if we've already logged the config loading
let hasLoggedConfig = false;

class ConfigLoader {
  constructor() {
    this.configPaths = [
      'modulerc.json', // Changed: removed the leading dot to match the actual file name
      '.modulerc.json',
      '.modulerc',
      'module.config.json'
    ];
    this.defaultConfig = {
      scan: {
        exclude: ['node_modules', 'dist', 'coverage', '.git', 'build', 'out'],
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        dataExtensions: ['.json', '.yaml', '.yml'],
        respectGitignore: true,
        ignoreTestFiles: false, // Default to false for backward compatibility
        testPatterns: [
          '*.test.js',
          '*.test.jsx',
          '*.test.ts',
          '*.test.tsx',
          '*.spec.js',
          '*.spec.jsx',
          '*.spec.ts',
          '*.spec.tsx',
          '**/test/**',
          '**/tests/**',
          '**/__tests__/**',
          '**/test-*.js',
          '**/test-*.jsx',
          '**/test-*.ts',
          '**/test-*.tsx',
          '**/*-test.js',
          '**/*-test.jsx',
          '**/*-test.ts',
          '**/*-test.tsx'
        ]
      },
      analysis: {
        detectCircularDependencies: true,
        detectUnusedExports: true,
        detectMissingExports: true,
        detectHighCoupling: {
          enabled: true,
          threshold: 10
        }
      },
      rules: {
        ignoredExports: {},
        ignoredImports: [],
        publicApiPaths: []
      },
      output: {
        json: {
          enabled: true,
          prettyPrint: true
        },
        html: {
          enabled: true,
          openAfterGeneration: false
        },
        console: {
          showWarnings: true,
          maxIssuesShown: 10
        }
      }
    };
  }

  load(projectRoot = process.cwd()) {
    // Try to find config file
    for (const configPath of this.configPaths) {
      const fullPath = path.join(projectRoot, configPath);
      if (fs.existsSync(fullPath)) {
        try {
          const userConfig = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          // Only log once per process
          if (!hasLoggedConfig) {
            console.log(`Loaded configuration from ${configPath}`);
            hasLoggedConfig = true;
          }
          return this.mergeConfigs(this.defaultConfig, userConfig);
        } catch (error) {
          console.error(`Error parsing ${configPath}:`, error.message);
          console.log('Using default configuration');
          return this.defaultConfig;
        }
      }
    }
    
    console.log('No configuration file found, using defaults');
    return this.defaultConfig;
  }

  mergeConfigs(defaultConfig, userConfig) {
    // Deep merge user config with defaults
    return {
      scan: { ...defaultConfig.scan, ...userConfig.scan },
      analysis: { ...defaultConfig.analysis, ...userConfig.analysis },
      rules: { ...defaultConfig.rules, ...userConfig.rules },
      output: { ...defaultConfig.output, ...userConfig.output }
    };
  }
}

module.exports = ConfigLoader;