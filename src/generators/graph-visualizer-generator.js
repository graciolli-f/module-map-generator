// src/generators/graph-visualizer-generator.js
const fs = require('fs');
const path = require('path');

class GraphVisualizerGenerator {
  generate(analysisPath, outputPath = 'dependency-graph.html') {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
    
    // Build graph data structure
    const graphData = this.buildGraphData(analysis);
    
    // Read the template HTML
    const templatePath = path.join(__dirname, '..', '..', 'templates', 'graph-template.html');
    let template;
    
    // If template doesn't exist, use the inline template
    if (fs.existsSync(templatePath)) {
      template = fs.readFileSync(templatePath, 'utf-8');
    } else {
      template = this.getInlineTemplate();
    }
    
    // Replace placeholder with actual data
    const html = template.replace(
      'GRAPH_DATA_PLACEHOLDER',
      JSON.stringify(graphData, null, 2)
    );
    
    fs.writeFileSync(outputPath, html);
    console.log(`\n✅ Generated dependency graph visualization: ${outputPath}`);
    console.log('\n📊 Graph statistics:');
    console.log(`   - Nodes: ${graphData.nodes.length}`);
    console.log(`   - Links: ${graphData.links.length}`);
    console.log(`   - Circular dependencies: ${graphData.circularPairs.size}`);
    
    return outputPath;
  }
  
  buildGraphData(analysis) {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    
    // First, identify all circular dependency pairs
    const circularPairs = new Set();
    if (analysis.circularDependencies) {
      analysis.circularDependencies.forEach(cycle => {
        // Add each pair in the cycle
        for (let i = 0; i < cycle.length - 1; i++) {
          const pair = [cycle[i], cycle[i + 1]].sort().join('->');
          circularPairs.add(pair);
        }
      });
    }
    
    // Create nodes
    Object.entries(analysis.dependencyGraph).forEach(([modulePath, moduleInfo]) => {
      const name = path.basename(modulePath);
      const nodeId = modulePath;
      
      const node = {
        id: nodeId,
        name: name,
        fullPath: modulePath,
        importCount: moduleInfo.imports?.length || 0,
        importedByCount: moduleInfo.importedBy?.length || 0,
        exportCount: moduleInfo.exports?.length || 0,
        hasCircularDep: false, // Will be set later
        isEntryPoint: (!moduleInfo.importedBy || moduleInfo.importedBy.length === 0) && 
                      (moduleInfo.imports && moduleInfo.imports.length > 0),
        hasErrors: moduleInfo.unresolvedInternals?.length > 0
      };
      
      nodes.push(node);
      nodeMap.set(nodeId, node);
    });
    
    // Create links
    Object.entries(analysis.dependencyGraph).forEach(([modulePath, moduleInfo]) => {
      if (moduleInfo.imports) {
        moduleInfo.imports.forEach(imp => {
          if (imp.resolved && nodeMap.has(imp.resolved)) {
            const pairKey = [modulePath, imp.resolved].sort().join('->');
            const isCircular = circularPairs.has(pairKey);
            
            // Mark nodes involved in circular dependencies
            if (isCircular) {
              nodeMap.get(modulePath).hasCircularDep = true;
              nodeMap.get(imp.resolved).hasCircularDep = true;
            }
            
            links.push({
              source: modulePath,
              target: imp.resolved,
              circular: isCircular,
              type: imp.type
            });
          }
        });
      }
    });
    
    return {
      nodes,
      links,
      circularPairs,
      metadata: {
        totalModules: analysis.summary.totalModules,
        analyzedAt: analysis.analyzed,
        root: analysis.root
      }
    };
  }
  
  getInlineTemplate() {
    // Return the template HTML as a string (same as the artifact above)
    // This is a fallback if the template file doesn't exist
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Module Dependency Graph</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        
        #controls {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        #controls label {
            margin-right: 20px;
            font-size: 14px;
        }
        
        #controls input[type="checkbox"] {
            margin-right: 5px;
        }
        
        #graph-container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: hidden;
            position: relative;
            height: 600px;
        }
        
        .node {
            cursor: pointer;
        }
        
        .node circle {
            stroke-width: 2px;
            transition: all 0.3s ease;
        }
        
        .node:hover circle {
            stroke-width: 4px;
        }
        
        .node text {
            font-size: 12px;
            pointer-events: none;
            text-anchor: middle;
            dy: 0.35em;
        }
        
        .link {
            fill: none;
            stroke: #999;
            stroke-opacity: 0.6;
            stroke-width: 1px;
            marker-end: url(#arrowhead);
        }
        
        .link.circular {
            stroke: #e74c3c;
            stroke-width: 2px;
        }
        
        .link.highlighted {
            stroke: #3498db;
            stroke-width: 3px;
            stroke-opacity: 1;
        }
        
        .node.highlighted circle {
            stroke-width: 4px;
        }
        
        .node.dimmed {
            opacity: 0.2;
        }
        
        .link.dimmed {
            opacity: 0.1;
        }
        
        #tooltip {
            position: absolute;
            padding: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        }
        
        #legend {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.9);
            padding: 15px;
            border-radius: 4px;
            font-size: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        #legend h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
        }
        
        #legend .legend-item {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
        }
        
        #legend .legend-color {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin-right: 8px;
            border: 2px solid #333;
        }
        
        #stats {
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(255, 255, 255, 0.9);
            padding: 15px;
            border-radius: 4px;
            font-size: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div id="controls">
        <label>
            <input type="checkbox" id="showCircular" checked> Show Circular Dependencies
        </label>
        <label>
            <input type="checkbox" id="showLabels" checked> Show Labels
        </label>
        <label>
            <input type="checkbox" id="showEntryPoints" checked> Highlight Entry Points
        </label>
        <button onclick="resetZoom()">Reset View</button>
    </div>
    
    <div id="graph-container">
        <svg id="graph"></svg>
        <div id="tooltip"></div>
        <div id="legend">
            <h3>Legend</h3>
            <div class="legend-item">
                <div class="legend-color" style="background: #3498db"></div>
                <span>Regular Module</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #e74c3c"></div>
                <span>Has Circular Dependency</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #f39c12"></div>
                <span>High Coupling (>5 deps)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #27ae60"></div>
                <span>Entry Point</span>
            </div>
        </div>
        <div id="stats">
            <div id="moduleCount">Modules: 0</div>
            <div id="linkCount">Dependencies: 0</div>
            <div id="circularCount">Circular: 0</div>
        </div>
    </div>

    <script>
        // This will be replaced with actual data when generated
        const graphData = GRAPH_DATA_PLACEHOLDER;
        
        // Set up SVG
        const container = document.getElementById('graph-container');
        const width = container.offsetWidth || 1200;
        const height = 600;
        
        const svg = d3.select('#graph')
            .attr('width', width)
            .attr('height', height);
        
        // Add arrow marker for directed edges
        svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10,0 L 0,5')
            .attr('fill', '#999');
        
        // Create zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });
        
        svg.call(zoom);
        
        const g = svg.append('g');
        
        // Create force simulation
        const simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(30));
        
        // Create links
        const link = g.append('g')
            .selectAll('.link')
            .data(graphData.links)
            .enter().append('line')
            .attr('class', d => 'link' + (d.circular ? ' circular' : ''));
        
        // Create nodes
        const node = g.append('g')
            .selectAll('.node')
            .data(graphData.nodes)
            .enter().append('g')
            .attr('class', 'node')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        
        // Add circles to nodes
        node.append('circle')
            .attr('r', d => Math.min(20, 10 + d.importCount))
            .attr('fill', d => {
                if (d.isEntryPoint) return '#27ae60';
                if (d.hasCircularDep) return '#e74c3c';
                if (d.importCount > 5) return '#f39c12';
                return '#3498db';
            })
            .attr('stroke', '#fff');
        
        // Add labels
        const labels = node.append('text')
            .text(d => d.name)
            .style('font-size', '10px')
            .style('fill', '#333');
        
        // Add tooltip
        const tooltip = d3.select('#tooltip');
        
        node.on('mouseover', function(event, d) {
            // Highlight connected nodes
            const connectedNodes = new Set();
            connectedNodes.add(d.id);
            
            link.each(function(l) {
                if (l.source.id === d.id) connectedNodes.add(l.target.id);
                if (l.target.id === d.id) connectedNodes.add(l.source.id);
            });
            
            node.classed('highlighted', n => connectedNodes.has(n.id))
                .classed('dimmed', n => !connectedNodes.has(n.id));
            
            link.classed('highlighted', l => l.source.id === d.id || l.target.id === d.id)
                .classed('dimmed', l => l.source.id !== d.id && l.target.id !== d.id);
            
            // Show tooltip
            tooltip.style('opacity', 1)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .html(\`
                    <strong>\${d.name}</strong><br/>
                    Imports: \${d.importCount}<br/>
                    Imported by: \${d.importedByCount}<br/>
                    Exports: \${d.exportCount}<br/>
                    \${d.hasCircularDep ? '<span style="color: #e74c3c">⚠️ Has circular dependency</span>' : ''}
                \`);
        });
        
        node.on('mouseout', function() {
            node.classed('highlighted', false)
                .classed('dimmed', false);
            link.classed('highlighted', false)
                .classed('dimmed', false);
            tooltip.style('opacity', 0);
        });
        
        // Update positions on tick
        simulation
            .nodes(graphData.nodes)
            .on('tick', ticked);
        
        simulation.force('link')
            .links(graphData.links);
        
        function ticked() {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
            
            node
                .attr('transform', d => \`translate(\${d.x},\${d.y})\`);
        }
        
        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        
        // Control handlers
        document.getElementById('showLabels').addEventListener('change', (e) => {
            labels.style('display', e.target.checked ? 'block' : 'none');
        });
        
        document.getElementById('showCircular').addEventListener('change', (e) => {
            link.style('display', function(d) {
                if (!e.target.checked && d.circular) return 'none';
                return 'block';
            });
        });
        
        // Update stats
        document.getElementById('moduleCount').textContent = \`Modules: \${graphData.nodes.length}\`;
        document.getElementById('linkCount').textContent = \`Dependencies: \${graphData.links.length}\`;
        document.getElementById('circularCount').textContent = \`Circular: \${graphData.links.filter(l => l.circular).length}\`;
        
        function resetZoom() {
            svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
        }
    </script>
</body>
</html>`;
  }
}

module.exports = GraphVisualizerGenerator;