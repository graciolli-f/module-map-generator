const fs = require('fs');
const path = require('path');

class GitignoreParser {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.patterns = [];
    this.loadGitignore();
  }

  loadGitignore() {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      this.patterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments
    }
  }

  shouldIgnore(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    
    // Normalize path separators for cross-platform compatibility
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    return this.patterns.some(pattern => {
      // Simple pattern matching (can be enhanced with minimatch library)
      if (pattern.endsWith('/')) {
        // Directory pattern
        return normalizedPath.startsWith(pattern) || normalizedPath.includes('/' + pattern);
      } else if (pattern.includes('*')) {
        // Glob pattern - simple implementation
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(normalizedPath) || regex.test(path.basename(filePath));
      } else {
        // Exact match or file anywhere
        return normalizedPath === pattern || 
               normalizedPath.endsWith('/' + pattern) ||
               path.basename(filePath) === pattern;
      }
    });
  }
}

module.exports = GitignoreParser;