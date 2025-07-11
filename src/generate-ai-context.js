// src/generate-ai-context.js
const fs = require('fs');
const path = require('path');
const AIContextGenerator = require('./generators/ai-context-generator');

function generateAIContext(analysisPath, outputPath) {
  if (!fs.existsSync(analysisPath)) {
    console.error(`❌ Analysis file not found: ${analysisPath}`);
    console.log('\nPlease run analysis first:');
    console.log('  npm run scan <directory>');
    console.log('  npm run analyze');
    process.exit(1);
  }

  const generator = new AIContextGenerator();
  generator.generate(analysisPath, outputPath);
  
  // Also show a preview
  const content = fs.readFileSync(outputPath, 'utf-8');
  const lines = content.split('\n');
  
  console.log('\n📄 Preview (first 30 lines):');
  console.log('─'.repeat(60));
  console.log(lines.slice(0, 30).join('\n'));
  if (lines.length > 30) {
    console.log(`\n... and ${lines.length - 30} more lines`);
  }
  console.log('─'.repeat(60));
  
  console.log('\n💡 Next steps:');
  console.log('1. Copy this file to your clipboard');
  console.log('2. Paste it at the start of your ChatGPT/Claude conversation');
  console.log('3. Ask the AI to help you with your codebase!\n');
}

// CLI interface
if (require.main === module) {
  const analysisPath = process.argv[2] || 'dependency-analysis.json';
  const outputPath = process.argv[3] || 'ai-context.md';
  
  generateAIContext(analysisPath, outputPath);
}

module.exports = { generateAIContext };