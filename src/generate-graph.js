// src/generate-graph.js
const GraphVisualizerGenerator = require('./generators/graph-visualizer-generator');

const generator = new GraphVisualizerGenerator();
const analysisPath = process.argv[2] || 'dependency-analysis.json';
const outputPath = process.argv[3] || 'dependency-graph.html';

generator.generate(analysisPath, outputPath);

console.log('\n🎯 To view the graph:');
console.log(`   open ${outputPath}`);
console.log('\n💡 Tips:');
console.log('   - Drag nodes to rearrange');
console.log('   - Hover over nodes to see connections');
console.log('   - Use mouse wheel to zoom');
console.log('   - Red lines show circular dependencies\n'); 