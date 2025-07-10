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
    console.log('Loaded gitignore patterns:', this.patterns);
  }

  shouldIgnore(filePath) {
    const relativePath = path.relative(this.projectRoot, filePath);
    
    // Normalize path separators for cross-platform compatibility
    const normalizedPath = relativePath.replace(/\\/g, '/');
    
    return this.patterns.some(pattern => {
      // Handle directory patterns (ending with /)
      if (pattern.endsWith('/')) {
        const dirPattern = pattern.slice(0, -1); // Remove trailing slash
        
        // Check if the path is the directory itself or a file/folder within it
        return normalizedPath === dirPattern || 
               normalizedPath.startsWith(dirPattern + '/');
      } 
      
      // Handle patterns with wildcards
      else if (pattern.includes('*')) {
        // Convert glob to regex, handling special cases
        let regexPattern = pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars except *
          .replace(/\*/g, '.*'); // Convert * to .*
        
        // If pattern starts with *, it can match anywhere
        if (pattern.startsWith('*')) {
          const regex = new RegExp(regexPattern + '$');
          return regex.test(normalizedPath) || regex.test(path.basename(filePath));
        } else {
          // Otherwise, must match from start of path or after a /
          const regex = new RegExp('^' + regexPattern + '$');
          return regex.test(normalizedPath) || 
                 regex.test(path.basename(filePath)) ||
                 normalizedPath.split('/').some(segment => regex.test(segment));
        }
      } 
      
      // Handle exact patterns
      else {
        const fileName = path.basename(filePath);
        
        // Check for exact path match
        if (normalizedPath === pattern) return true;
        
        // Check if it's a filename that should match anywhere
        if (!pattern.includes('/')) {
          return fileName === pattern;
        }
        
        // Check if it's a path pattern that should match as a suffix
        return normalizedPath.endsWith('/' + pattern);
      }
    });
  }
}

module.exports = GitignoreParser;