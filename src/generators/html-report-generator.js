// src/generators/html-report-generator.js
const fs = require('fs');
const path = require('path');

class HtmlReportGenerator {
  generate(analysisPath, outputPath = 'report.html') {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Module Analysis Report - ${path.basename(analysis.root)}</title>
    <style>
      ${this.getStyles()}
    </style>
</head>
<body>
    <div class="container">
        ${this.generateHeader(analysis)}
        ${this.generateSummary(analysis.summary)}
        ${this.generateCircularDependencies(analysis.circularDependencies)}
        ${this.generateUnusedExports(analysis.unusedExports)}
        ${this.generateMissingExports(analysis.missingExports)}
        ${this.generateUnresolvedImports(analysis.dependencyGraph)}
        ${this.generateModuleList(analysis.dependencyGraph)}
    </div>
    <script>
      ${this.getScript()}
    </script>
</body>
</html>`;

    fs.writeFileSync(outputPath, html);
    console.log(`\nGenerated HTML report: ${outputPath}`);
  }

  getStyles() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
        color: #333;
        background: #f5f5f5;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      
      .header {
        background: #fff;
        border-radius: 8px;
        padding: 30px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .header h1 {
        color: #2c3e50;
        margin-bottom: 10px;
      }
      
      .header .meta {
        color: #7f8c8d;
        font-size: 14px;
      }
      
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
      }
      
      .stat-card {
        background: #fff;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        text-align: center;
      }
      
      .stat-card.error {
        border-left: 4px solid #e74c3c;
      }
      
      .stat-card.warning {
        border-left: 4px solid #f39c12;
      }
      
      .stat-card.success {
        border-left: 4px solid #27ae60;
      }
      
      .stat-card .value {
        font-size: 36px;
        font-weight: bold;
        color: #2c3e50;
      }
      
      .stat-card .label {
        color: #7f8c8d;
        font-size: 14px;
        margin-top: 5px;
      }
      
      .section {
        background: #fff;
        border-radius: 8px;
        padding: 25px;
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .section h2 {
        color: #2c3e50;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .section h3 {
        font-size: 16px;
        margin-top: 20px;
        margin-bottom: 10px;
      }
      
      .badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: normal;
      }
      
      .badge.error {
        background: #fee;
        color: #e74c3c;
      }
      
      .badge.warning {
        background: #ffeaa7;
        color: #d68910;
      }
      
      .badge.success {
        background: #d1f2eb;
        color: #27ae60;
      }
      
      .cycle {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 15px;
        margin-bottom: 10px;
        font-family: monospace;
        font-size: 14px;
      }
      
      .cycle-arrow {
        color: #6c757d;
        margin: 0 10px;
      }
      
      .module-item {
        padding: 10px 0;
        border-bottom: 1px solid #eee;
      }
      
      .module-item:last-child {
        border-bottom: none;
      }
      
      .module-name {
        font-weight: 500;
        color: #2c3e50;
      }
      
      .module-detail {
        color: #7f8c8d;
        font-size: 14px;
        margin-left: 20px;
      }
      
      .error-text {
        color: #e74c3c;
      }
      
      .warning-text {
        color: #f39c12;
      }
      
      .module-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 20px;
      }
      
      .module-card {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 15px;
        font-size: 14px;
      }
      
      .module-card h3 {
        font-size: 16px;
        margin-bottom: 10px;
        word-break: break-all;
      }
      
      .metric {
        display: flex;
        justify-content: space-between;
        margin: 5px 0;
      }
      
      .expandable {
        cursor: pointer;
        user-select: none;
      }
      
      .expandable:hover {
        background: #f8f9fa;
      }
      
      .details {
        display: none;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #eee;
      }
      
      .details.show {
        display: block;
      }
    `;
  }

  generateHeader(analysis) {
    return `
      <div class="header">
        <h1>Module Analysis Report</h1>
        <div class="meta">
          <div>Project: ${path.basename(analysis.root)}</div>
          <div>Analyzed: ${new Date(analysis.analyzed).toLocaleString()}</div>
        </div>
      </div>
    `;
  }

  generateSummary(summary) {
    const cards = [
      {
        value: summary.totalModules,
        label: 'Total Modules',
        type: 'success'
      },
      {
        value: summary.circularDependencyCount,
        label: 'Circular Dependencies',
        type: summary.circularDependencyCount > 0 ? 'error' : 'success'
      },
      {
        value: summary.unusedExportCount,
        label: 'Unused Exports',
        type: summary.unusedExportCount > 0 ? 'warning' : 'success'
      },
      {
        value: summary.missingExportCount,
        label: 'Missing Exports',
        type: summary.missingExportCount > 0 ? 'error' : 'success'
      },
      {
        value: summary.totalUnresolvedInternals,
        label: 'Unresolved Imports',
        type: summary.totalUnresolvedInternals > 0 ? 'error' : 'success'
      },
      {
        value: summary.totalExternalDependencies,
        label: 'External Dependencies',
        type: 'success'
      }
    ];

    return `
      <div class="summary">
        ${cards.map(card => `
          <div class="stat-card ${card.type}">
            <div class="value">${card.value}</div>
            <div class="label">${card.label}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  generateCircularDependencies(cycles) {
    if (!cycles || cycles.length === 0) {
      return `
        <div class="section">
          <h2>
            Circular Dependencies
            <span class="badge success">None Found</span>
          </h2>
          <p style="color: #27ae60;">✓ No circular dependencies detected</p>
        </div>
      `;
    }

    return `
      <div class="section">
        <h2>
          Circular Dependencies
          <span class="badge error">${cycles.length} Found</span>
        </h2>
        ${cycles.map((cycle, index) => `
          <div class="cycle">
            <strong>Cycle ${index + 1}:</strong><br>
            ${cycle.map((module, i) => 
              `${module}${i < cycle.length - 1 ? ' <span class="cycle-arrow">→</span> ' : ''}`
            ).join('')}
          </div>
        `).join('')}
      </div>
    `;
  }

  generateUnusedExports(unusedExports) {
    if (!unusedExports || unusedExports.length === 0) return '';
  
    const validExports = unusedExports.filter(e => e.classification === 'likely-valid');
    const problematicExports = unusedExports.filter(e => e.classification === 'likely-problematic');
  
    return `
      <div class="section">
        <h2>
          Unused Exports
          <span class="badge warning">${unusedExports.length} Total</span>
          <span class="badge success">${validExports.length} Valid</span>
          <span class="badge error">${problematicExports.length} Problematic</span>
        </h2>
        
        ${problematicExports.length > 0 ? `
          <h3 style="color: #e74c3c;">🔴 Likely Problematic (Review Recommended)</h3>
          <div class="module-list">
            ${problematicExports.map(exp => `
              <div class="module-item">
                <div class="module-name">${path.relative(process.cwd(), exp.module)}</div>
                <div class="module-detail error-text">
                  Export '${exp.exportName}' (line ${exp.line})
                  <br><small>Confidence: ${(exp.confidence * 100).toFixed(0)}% | ${exp.suggestion}</small>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${validExports.length > 0 ? `
          <h3 style="color: #27ae60;">🟢 Likely Valid (No Action Needed)</h3>
          <div class="module-list">
            ${validExports.slice(0, 5).map(exp => `
              <div class="module-item">
                <div class="module-name">${path.relative(process.cwd(), exp.module)}</div>
                <div class="module-detail" style="color: #27ae60;">
                  Export '${exp.exportName}' (line ${exp.line})
                  <br><small>Reasons: ${exp.reasons.join(', ')}</small>
                </div>
              </div>
            `).join('')}
            ${validExports.length > 5 ? `
              <div class="module-item">
                <small style="color: #7f8c8d;">... and ${validExports.length - 5} more valid unused exports</small>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  generateMissingExports(missingExports) {
    if (!missingExports || missingExports.length === 0) return '';

    const validImports = missingExports.filter(e => e.classification === 'likely-valid');
    const problematicImports = missingExports.filter(e => e.classification === 'likely-problematic');

    return `
      <div class="section">
        <h2>
          Missing Exports
          <span class="badge error">${missingExports.length} Total</span>
          ${validImports.length > 0 ? `<span class="badge success">${validImports.length} Expected</span>` : ''}
          ${problematicImports.length > 0 ? `<span class="badge error">${problematicImports.length} Errors</span>` : ''}
        </h2>
        
        ${problematicImports.length > 0 ? `
          <h3 style="color: #e74c3c;">🔴 Likely Errors (Fix Required)</h3>
          <div class="module-list">
            ${problematicImports.map(miss => `
              <div class="module-item">
                <div class="module-name">${path.relative(process.cwd(), miss.source)}</div>
                <div class="module-detail error-text">
                  Imports '${miss.missingExport}' from ${path.relative(process.cwd(), miss.targetModule)} 
                  (line ${miss.line}) - but it doesn't exist!
                  <br><small>
                    Confidence: ${miss.confidence ? (miss.confidence * 100).toFixed(0) + '%' : 'N/A'} | 
                    ${miss.suggestion || 'Check import path'}
                    ${miss.suggestions && miss.suggestions.length > 0 ? 
                      `<br>Suggestions: ${miss.suggestions.join(', ')}` : ''}
                  </small>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${validImports.length > 0 ? `
          <h3 style="color: #f39c12;">🟡 Expected Missing (Build-time Resolution)</h3>
          <div class="module-list">
            ${validImports.map(miss => `
              <div class="module-item">
                <div class="module-name">${path.relative(process.cwd(), miss.source)}</div>
                <div class="module-detail" style="color: #f39c12;">
                  Imports '${miss.missingExport}' from ${path.relative(process.cwd(), miss.targetModule)}
                  (line ${miss.line})
                  <br><small>
                    ${miss.reasons ? `Reasons: ${miss.reasons.join(', ')} | ` : ''}
                    ${miss.suggestion || ''}
                  </small>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  generateUnresolvedImports(dependencyGraph) {
    const unresolvedImports = [];
    
    // Collect all unresolved imports from the dependency graph
    Object.entries(dependencyGraph).forEach(([filePath, deps]) => {
      if (deps.unresolvedInternals && deps.unresolvedInternals.length > 0) {
        deps.unresolvedInternals.forEach(unresolved => {
          unresolvedImports.push({
            source: filePath,
            import: unresolved.source,
            line: unresolved.line,
            message: unresolved.message
          });
        });
      }
    });

    if (unresolvedImports.length === 0) return '';

    return `
      <div class="section">
        <h2>
          Unresolved Imports
          <span class="badge error">${unresolvedImports.length} Found</span>
        </h2>
        <div class="module-list">
          ${unresolvedImports.map(imp => `
            <div class="module-item">
              <div class="module-name">${path.relative(process.cwd(), imp.source)}</div>
              <div class="module-detail error-text">
                Cannot resolve '${imp.import}' (line ${imp.line})
                <br><small>${imp.message}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  generateModuleList(dependencyGraph) {
    const modules = Object.entries(dependencyGraph)
      .map(([filePath, deps]) => ({
        path: filePath,
        relativePath: path.relative(process.cwd(), filePath),
        ...deps
      }))
      .sort((a, b) => b.imports.length - a.imports.length); // Sort by import count

    return `
      <div class="section">
        <h2>Module Details</h2>
        <div class="module-grid">
          ${modules.slice(0, 12).map(module => `
            <div class="module-card">
              <h3>${path.basename(module.relativePath)}</h3>
              <div class="metric">
                <span>Imports:</span>
                <strong>${module.imports.length}</strong>
              </div>
              <div class="metric">
                <span>Imported by:</span>
                <strong>${module.importedBy.length}</strong>
              </div>
              <div class="metric">
                <span>Exports:</span>
                <strong>${module.exports.length}</strong>
              </div>
              <div class="metric">
                <span>External deps:</span>
                <strong>${module.externalDependencies.length}</strong>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  getScript() {
    return `
      // Add interactivity here if needed
      document.querySelectorAll('.expandable').forEach(el => {
        el.addEventListener('click', () => {
          el.nextElementSibling?.classList.toggle('show');
        });
      });
    `;
  }
}

module.exports = HtmlReportGenerator;