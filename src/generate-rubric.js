// src/generate-rubric.js
const fs = require('fs');
const RubricGenerator = require('./generators/rubric-generator');

function generateRubric(analysisPath, outputPath) {
  if (!fs.existsSync(analysisPath)) {
    console.error(`❌ Analysis file not found: ${analysisPath}`);
    console.log('\nPlease run analysis first:');
    console.log('  npm run scan <directory>');
    console.log('  npm run analyze');
    process.exit(1);
  }

  const generator = new RubricGenerator();
  const rubric = generator.generate(analysisPath, outputPath);
  
  // Show a preview
  const lines = rubric.split('\n');
  console.log('\n📋 Rubric Preview (first 50 lines):');
  console.log('─'.repeat(60));
  console.log(lines.slice(0, 50).join('\n'));
  if (lines.length > 50) {
    console.log(`\n... and ${lines.length - 50} more lines`);
  }
  console.log('─'.repeat(60));
  
  console.log('\n💡 How to use this rubric:');
  console.log('1. Place this .rux file in your project');
  console.log('2. When asking AI to create/modify code, reference it:');
  console.log('   "Follow the patterns in codebase-patterns.rux"');
  console.log('3. AI will respect your codebase conventions!');
  console.log('\n🎯 Key patterns extracted:');
  console.log('   - Import style and limits');
  console.log('   - Export conventions');  
  console.log('   - Module boundaries');
  console.log('   - Core modules to protect');
  console.log('   - Naming conventions\n');
}

// CLI interface
if (require.main === module) {
  const analysisPath = process.argv[2] || 'dependency-analysis.json';
  const outputPath = process.argv[3] || 'codebase-patterns.rux';
  
  generateRubric(analysisPath, outputPath);
}

module.exports = { generateRubric };