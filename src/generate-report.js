// src/generate-report.js
const HtmlReportGenerator = require('./generators/html-report-generator');

const generator = new HtmlReportGenerator();
const analysisPath = process.argv[2] || 'dependency-analysis.json';
const outputPath = process.argv[3] || 'report.html';

generator.generate(analysisPath, outputPath);