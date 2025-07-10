- [x] figure out why config is being loaded so many times: 
```
mercury@Fernandas-MacBook-Pro Module-Map-Generator % node src/analyze.js charm-gpt.json charm-gpt-analysis.json
Loaded configuration from modulerc.json
Loading module map from: charm-gpt.json
Analyzing 52 modules...
Loaded configuration from modulerc.json
Loaded configuration from modulerc.json
```

- [x] fix imports unresolved imports - at first glance this does not seem like an unresolved import
```
test-repos/charmgpt/custom-mcp-servers/medik-mcp/MediKanrenGraphViewer.jsx
Cannot resolve '../../src/components/artifacts/KnowledgeGraphViewer' (line 2)
Could not resolve internal import: ../../src/components/artifacts/KnowledgeGraphViewer
```

- [ ] Fix - Update the confidence calculation for forced classifications:
```
javascript// In classify method:
const classification = reasons.includes('suspicious-filename') 
  ? 'likely-problematic' 
  : (totalScore > 0 ? 'likely-valid' : 'likely-problematic');

// Adjust confidence for forced classifications
const confidence = reasons.includes('suspicious-filename')
  ? 0.9  // High confidence for suspicious filenames
  : Math.min(Math.abs(totalScore) / 10, 1);
```
- [ ] improvement: html styling to make easier to parse 

- [ ] nail down how this will translate to Rubric. How will this detection then generate rules/boundaries/representation for the LLM to stay within boundaries? 

- [ ] a way to annotate exports in code comments (like // @public-api) that your tool could detect 


