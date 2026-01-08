import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Circle, FileText, Folder, Image, Video, Flower2, Music, Table } from 'lucide-react';
import { GraphData, Node, Link, NodeType, AppTheme, LinkStyle, NodeIconType, LayoutMode } from '../types';
import { THEMES } from '../constants';

interface MindMapProps {
  data: GraphData;
  onNodeExpand: (node: Node) => void;
  onNodeSelect: (node: Node) => void;
  onUpdateNode: (nodeId: string, updates: Partial<Node>) => void;
  theme: AppTheme;
  linkStyle: LinkStyle;
  layoutMode: LayoutMode;
}

// Icon Paths (ViewBox 0 0 24 24)
const ICONS: Record<string, string> = {
  // Simple Circle default handled differently
  folder: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
  video: "M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 7l-5 3.5v-7l5 3.5z",
  image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
  file: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  music: "M9 18V5l12-2v13", // Simplified note stem
  music_full: "M9 18V5l12-2v13M9 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm12-2c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z", // Full music note
  spreadsheet: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z", // Basic Sheet
  seed: "M12 22c4.97 0 9-4.03 9-9 0-4.97-9-13-9-13S3 8.03 3 13c0 4.97 4.03 9 9 9z", // Droplet/Seed shape
  tree: "M12 2L2 22h20L12 2zm0 3l7 14H5l7-14z M19 12h-2v-2c0-3.86-3.14-7-7-7S3 6.14 3 10v2H1c0 5 4.9 9 11 9s11-4 11-9zM7 10c0-2.76 2.24-5 5-5s5 2.24 5 5v2H7v-2zm5 9c-3.14 0-6-2.33-6-5.5S8.86 8 12 8s6 2.33 6 5.5S15.14 19 12 19zm-1-5h2v3h-2v-3z", // Tree
  leaf: "M17 8C8 10 5.9 16.17 3.82 21.34 5.71 18.27 7.5 16.5 8 16c.41.69 1.5 2.5 1.5 2.5s3.25-1 6-3.5 4-7.5 4-7.5-1.5 0-2.5.5z" // Leaf
};

// Override complex paths
ICONS['music'] = "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z";
ICONS['spreadsheet'] = "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h3v3H7zm0 4h3v3H7zm0 4h3v3H7zM14 7h3v3h-3zm0 4h3v3h-3zm0 4h3v3h-3z";

// Helper for deterministic pseudo-randomness based on IDs
const getHash = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h);
};

const MindMap: React.FC<MindMapProps> = ({ data, onNodeExpand, onNodeSelect, onUpdateNode, theme, linkStyle, layoutMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string | null }>({ x: 0, y: 0, nodeId: null });
  
  // Persist simulation state
  const nodesMapRef = useRef<Map<string, Node>>(new Map());
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  // Store zoom behavior to call it programmatically
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const themeColors = THEMES[theme];

  // Global click to close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu({ x: 0, y: 0, nodeId: null });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Calculate weights for tree branches (count descendants)
  const nodeWeights = useMemo(() => {
    const map = new Map<string, number>();
    const childrenMap = new Map<string, string[]>();
    const depthMap = new Map<string, number>();

    // Build hierarchy (Assume Source -> Target is Parent -> Child)
    data.links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as Node).id : l.source as string;
        const t = typeof l.target === 'object' ? (l.target as Node).id : l.target as string;
        if (!childrenMap.has(s)) childrenMap.set(s, []);
        childrenMap.get(s)!.push(t);
    });

    const getWeight = (nodeId: string): number => {
        if (map.has(nodeId)) return map.get(nodeId)!;
        
        let w = 1; // Base weight (self)
        const children = childrenMap.get(nodeId) || [];
        
        children.forEach(childId => {
            w += getWeight(childId); // Add children's weight
        });
        
        map.set(nodeId, w);
        return w;
    };

    const calculateDepth = (nodeId: string, depth: number) => {
        depthMap.set(nodeId, depth);
        const children = childrenMap.get(nodeId) || [];
        children.forEach(c => calculateDepth(c, depth + 1));
    }
    
    calculateDepth('root', 0);
    // Initialize weights starting from root or all nodes
    data.nodes.forEach(n => {
        if (!map.has(n.id)) getWeight(n.id);
        n.level = depthMap.get(n.id) || 0;
    });

    return map;
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    const horizonY = height - 60; // Consistent horizon line

    // --- 0. DEFS (Gradients) ---
    let defs = svg.select<SVGDefsElement>("defs");
    if (defs.empty()) {
        defs = svg.append("defs");
        
        // Realistic Leaf Gradient
        const leafGrad = defs.append("linearGradient")
            .attr("id", "leafGradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "100%");
        
        leafGrad.append("stop").attr("offset", "0%").attr("stop-color", "#84cc16");
        leafGrad.append("stop").attr("offset", "100%").attr("stop-color", "#3f6212");

        // Sky Gradient
        const skyGrad = defs.append("linearGradient")
            .attr("id", "skyGradient")
            .attr("x1", "0%").attr("y1", "0%")
            .attr("x2", "0%").attr("y2", "100%");
        skyGrad.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6"); // Blue top
        skyGrad.append("stop").attr("offset", "100%").attr("stop-color", "#e0f2fe"); // White bottom
    }

    // --- 1. SETUP MAIN GROUP ---
    let g = svg.select<SVGGElement>(".mindmap-group");
    if (g.empty()) {
      g = svg.append("g").attr("class", "mindmap-group");
      
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
            setContextMenu({ x: 0, y: 0, nodeId: null });
        });
      
      zoomBehaviorRef.current = zoom;
      svg.call(zoom);
      
      // Center view initially
      svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(0.8));
    }

    // --- BACKGROUND LAYERS ---
    let bgLayer = g.select<SVGGElement>(".bg-layer");
    if (bgLayer.empty()) {
        bgLayer = g.insert("g", ":first-child").attr("class", "bg-layer");
        bgLayer.append("rect").attr("class", "sky-rect").attr("width", 200000).attr("x", -100000).attr("fill", "url(#skyGradient)");
        bgLayer.append("rect").attr("class", "ground-rect").attr("width", 200000).attr("x", -100000).attr("fill", "#573f2a");
    }
    
    if (layoutMode === LayoutMode.SEED) {
        bgLayer.attr("opacity", 1);
        bgLayer.select(".sky-rect").attr("y", -100000).attr("height", 100000 + horizonY);
        bgLayer.select(".ground-rect").attr("y", horizonY).attr("height", 100000);
    } else {
        bgLayer.attr("opacity", 0);
    }

    let linkLayer = g.select<SVGGElement>(".links-layer");
    if (linkLayer.empty()) linkLayer = g.append("g").attr("class", "links-layer");
    
    let stemLayer = g.select<SVGGElement>(".stem-layer");
    if (stemLayer.empty()) stemLayer = g.insert("g", ".nodes-layer").attr("class", "stem-layer");

    let nodeLayer = g.select<SVGGElement>(".nodes-layer");
    if (nodeLayer.empty()) nodeLayer = g.append("g").attr("class", "nodes-layer");

    // --- 2. PREPARE DATA ---
    const nodes: Node[] = data.nodes.map(d => {
      const existing = nodesMapRef.current.get(d.id);
      
      if (layoutMode === LayoutMode.SEED && d.id === 'root') {
          const dynamicVal = 32;
          const groundY = height - 60;
          const isSapling = data.nodes.length <= 1;
          const baseTrunkHeight = isSapling ? 80 : 300; 
          const growthPerNode = 50; 
          const targetRootY = groundY - baseTrunkHeight - (data.nodes.length * growthPerNode);

          if (existing) {
             return { ...d, x: existing.x, y: existing.y, fx: width / 2, fy: targetRootY, vx: existing.vx, vy: existing.vy, val: dynamicVal }
          }
          return { ...d, fx: width / 2, fy: isSapling ? groundY - 50 : targetRootY, x: width / 2, y: isSapling ? groundY - 50 : targetRootY, vx: 0, vy: 0, val: dynamicVal }
      }

      if (existing) {
        let fx = existing.fx;
        let fy = existing.fy;
        if (layoutMode === LayoutMode.SPIDER && d.id === 'root') { fx = null; fy = null; }
        return { ...d, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy, fx, fy };
      }

      let startX = width / 2;
      let startY = height / 2;
      const parentLink = data.links.find(l => {
          const sourceId = typeof l.source === 'object' ? (l.source as Node).id : l.source;
          const targetId = typeof l.target === 'object' ? (l.target as Node).id : l.target;
          return (targetId === d.id && nodesMapRef.current.has(sourceId as string)) ||
                 (sourceId === d.id && nodesMapRef.current.has(targetId as string));
      });

      if (parentLink) {
          const sourceId = typeof parentLink.source === 'object' ? (parentLink.source as Node).id : parentLink.source;
          const targetId = typeof parentLink.target === 'object' ? (parentLink.target as Node).id : parentLink.target;
          const parentId = sourceId === d.id ? targetId : sourceId;
          const parent = nodesMapRef.current.get(parentId as string);
          if (parent && parent.x !== undefined && parent.y !== undefined) {
             startX = parent.x;
             startY = parent.y;
          }
      }
      return { ...d, x: startX, y: startY, vx: 0, vy: 0 };
    });

    const links: Link[] = data.links.map(d => ({ ...d }));

    const currentIds = new Set(nodes.map(n => n.id));
    for (const id of nodesMapRef.current.keys()) {
        if (!currentIds.has(id)) {
            nodesMapRef.current.delete(id);
        }
    }
    
    nodes.forEach(n => nodesMapRef.current.set(n.id, n));
    
    // Neighbors map
    const neighborMap = new Map<string, string[]>();
    links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as Node).id : l.source as string;
        const t = typeof l.target === 'object' ? (l.target as Node).id : l.target as string;
        if (!neighborMap.has(s)) neighborMap.set(s, []);
        if (!neighborMap.has(t)) neighborMap.set(t, []);
        neighborMap.get(s)!.push(t);
        neighborMap.get(t)!.push(s);
    });

    // --- 3. SIMULATION (UPDATED FOR TIGHTER LAYOUT) ---
    let simulation = d3.forceSimulation<Node, Link>(nodes)
      .alpha(0.8)
      .alphaDecay(0.04)
      .velocityDecay(0.85);
    
    simulationRef.current = simulation;

    if (layoutMode === LayoutMode.SEED) {
        const groundY = height - 60;
        const isSapling = nodes.length <= 1;
        const baseTrunkHeight = isSapling ? 80 : 300; 
        const growthPerNode = 50; 
        const targetRootY = groundY - baseTrunkHeight - (nodes.length * growthPerNode);
        const verticalLevelSpacing = 180 + (nodes.length * 10);
        const linkDist = isSapling ? 80 : verticalLevelSpacing * 1.1;

        simulation
            .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(linkDist).strength(0.8))
            .force("charge", d3.forceManyBody().strength(-1200))
            .force("collide", d3.forceCollide().radius(d => d.val * 2 + 20).strength(1))
            .force("y", d3.forceY<Node>(d => {
                if (d.id === 'root') return targetRootY; 
                return targetRootY - (d.level || 0) * verticalLevelSpacing; 
            }).strength(0.5)) 
            .force("x", d3.forceX<Node>(d => width/2 + (d.biasX || 0)).strength(0.2));
    } else {
        // SPIDER MODE UPDATES: Much tighter forces
        simulation
            .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(90)) // Reduced from 180 to 90
            .force("charge", d3.forceManyBody().strength(-400).distanceMax(600)) // Reduced from -1000 to -400
            .force("collide", d3.forceCollide().radius(d => d.val * 3 + 10).strength(0.9)) // Adjusted collision
            .force("center", d3.forceCenter(width / 2, height / 2).strength(0.05))
            .force("biasX", d3.forceX<Node>(d => width/2 + (d.biasX || 0)).strength(d => d.biasX !== undefined ? 0.35 : 0))
            .force("biasY", d3.forceY<Node>(d => height/2 + (d.biasY || 0)).strength(d => d.biasY !== undefined ? 0.35 : 0));
    }

    // --- 4. RENDER ---

    const stemGroup = stemLayer.selectAll<SVGGElement, Node>(".stem-group")
      .data(nodes.filter(n => n.id === 'root' && layoutMode === LayoutMode.SEED), d => d.id)
      .join(
        enter => {
            const g = enter.append("g").attr("class", "stem-group");
            g.append("path").attr("class", "main-stem").attr("fill", "none").attr("stroke-linecap", "round");
            g.append("path").attr("class", "sub-stem-1").attr("fill", "none").attr("stroke-linecap", "round");
            g.append("path").attr("class", "sub-stem-2").attr("fill", "none").attr("stroke-linecap", "round");
            return g;
        },
        update => update,
        exit => exit.remove()
      );

    const linkGroup = linkLayer.selectAll<SVGGElement, Link>(".link-group")
      .data(links, (d: any) => {
         const sid = typeof d.source === 'object' ? d.source.id : d.source;
         const tid = typeof d.target === 'object' ? d.target.id : d.target;
         return `${sid}-${tid}`;
      })
      .join(
        enter => {
            const grp = enter.append("g").attr("class", "link-group");
            grp.append("path").attr("class", "vine-core").attr("fill", "none").attr("stroke-linecap", "round");
            grp.append("path").attr("class", "vine-strand-1").attr("fill", "none").attr("stroke-linecap", "round");
            grp.append("path").attr("class", "vine-strand-2").attr("fill", "none").attr("stroke-linecap", "round");
            
            const leafPos = grp.append("g").attr("class", "leaf-positioner");
            const leafScaler = leafPos.append("g").attr("class", "leaf-scaler").attr("opacity", 0).attr("transform", "scale(0)"); 
            leafScaler.append("path").attr("d", "M0,0 C 8,-12 30,-15 45,0 C 30,15 8,12 0,0 Z").attr("fill", "url(#leafGradient)").attr("stroke", "#1a2e05").attr("stroke-width", 0.5);
            leafScaler.append("path").attr("d", "M0,0 Q 22,0 45,0").attr("fill", "none").attr("stroke", "#1a2e05").attr("stroke-width", 0.5).attr("stroke-opacity", 0.5);
            
            if (layoutMode === LayoutMode.SEED || linkStyle === LinkStyle.ROOT) {
                 leafScaler.transition().delay(300).duration(800).ease(d3.easeElasticOut).attr("opacity", 1).attr("transform", "scale(1)");
            }
            return grp;
        },
        update => {
            const scaler = update.select(".leaf-scaler");
            if (layoutMode === LayoutMode.SEED || linkStyle === LinkStyle.ROOT) {
                 scaler.transition().duration(500).attr("opacity", 1).attr("transform", "scale(1)");
            } else {
                 scaler.transition().duration(500).attr("opacity", 0).attr("transform", "scale(0)");
            }
            return update;
        },
        exit => exit.remove()
      );

    const nodeGroup = nodeLayer.selectAll<SVGGElement, Node>(".node-group")
      .data(nodes, d => d.id)
      .join(
        enter => {
          const g = enter.append("g").attr("class", "node-group").attr("opacity", 1); 
          const nodeColor = (d: Node) => d.color || (d.type === NodeType.PROJECT ? '#f59e0b' : themeColors.node);

          const circle = g.append("circle")
            .attr("class", "node-circle")
            .attr("r", 0)
            .attr("fill", nodeColor)
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .attr("cursor", "pointer")
            .on("click", (event, d) => { 
                event.stopPropagation(); 
                onNodeSelect(d);
            })
            .on("contextmenu", (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                if (containerRef.current) {
                    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: d.id });
                }
            });

          const expandBtn = g.append("g")
            .attr("class", "expand-btn")
            .attr("opacity", 0) 
            .attr("transform", "translate(14, -14) scale(0)")
            .attr("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                onNodeExpand(d);
            });

          expandBtn.append("circle")
            .attr("r", 10)
            .attr("class", "expand-circle") 
            .attr("fill", d => d.collapsed ? "#22c55e" : "#ef4444") 
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 2);

          const plusPath = "M-4 0h8M0 -4v8";
          const minusPath = "M-4 0h8";

          expandBtn.append("path")
            .attr("d", d => d.collapsed ? plusPath : minusPath) 
            .attr("class", "expand-icon") 
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .attr("stroke-linecap", "round");

          g.on("mouseenter", function() {
              d3.select(this).select(".expand-btn")
                  .transition().duration(200)
                  .attr("opacity", 1)
                  .attr("transform", "translate(14, -14) scale(1)");
          })
          .on("mouseleave", function() {
              d3.select(this).select(".expand-btn")
                  .transition().duration(200)
                  .attr("opacity", 0)
                  .attr("transform", "translate(14, -14) scale(0)");
          });

          g.each(function(d) {
             const group = d3.select(this);
             
             let type = d.iconType || 'default';
             // Enforce specific icons
             if (d.type === NodeType.PROJECT) type = 'folder';
             if (d.type === NodeType.DOCUMENT && type === 'default') type = 'file';

             const iconPath = ICONS[type];
             if (iconPath) {
                 group.append("path").attr("d", iconPath).attr("fill", "#ffffff").attr("transform", `translate(-10, -10) scale(0.8)`).attr("opacity", 0).attr("class", "node-icon").style("pointer-events", "none");
             }
          });

           circle.transition().duration(800).ease(d3.easeBackOut).attr("r", d => d.val);
           g.select(".node-icon").transition().delay(800).duration(500).attr("opacity", 1);

          const text = g.append("text")
            .text(d => d.name)
            .attr("text-anchor", "middle")
            .attr("fill", theme === AppTheme.CYBER ? "#e2e8f0" : "#334155")
            .attr("stroke", theme === AppTheme.CYBER ? "#0f172a" : "#ffffff") 
            .attr("stroke-width", 3)
            .attr("paint-order", "stroke") 
            .attr("stroke-linejoin", "round") 
            .style("font-size", "10px")
            .style("pointer-events", "all") 
            .style("cursor", "pointer")  
            .style("font-weight", "500")
            .attr("opacity", 0)
            .on("click", (event, d) => { event.stopPropagation(); onNodeSelect(d); });

           text.transition().delay(1100).duration(500).attr("opacity", 1);
          return g;
        },
        update => {
           update.select("text")
             .text(d => d.name)
             .attr("fill", theme === AppTheme.CYBER ? "#e2e8f0" : "#334155")
             .attr("stroke", theme === AppTheme.CYBER ? "#0f172a" : "#ffffff");
             
           update.select(".node-circle")
             .transition().duration(500)
             .attr("fill", (d: Node) => d.color || (d.type === NodeType.PROJECT ? '#f59e0b' : themeColors.node))
             .attr("r", (d: Node) => d.val); 

           update.select(".expand-circle")
             .attr("fill", d => d.collapsed ? "#22c55e" : "#ef4444");
           
           update.select(".expand-icon")
             .attr("d", d => d.collapsed ? "M-4 0h8M0 -4v8" : "M-4 0h8");

           update.each(function(d) {
             const group = d3.select(this);
             
             let type = d.iconType || 'default';
             if (d.type === NodeType.PROJECT) type = 'folder';
             if (d.type === NodeType.DOCUMENT && type === 'default') type = 'file';

             const iconPath = ICONS[type];
             group.select(".node-icon").remove();
             if (iconPath) {
                 group.append("path").attr("d", iconPath).attr("fill", "#ffffff").attr("transform", `translate(-10, -10) scale(0.8)`).attr("opacity", 1).attr("class", "node-icon").style("pointer-events", "none");
             }
           });
           
           update.select(".node-circle").on("contextmenu", (event, d) => {
                event.preventDefault();
                event.stopPropagation();
                setContextMenu({ x: event.clientX, y: event.clientY, nodeId: d.id });
            });
           return update;
        },
        exit => exit.transition().duration(300).attr("opacity", 0).remove()
      );

    // --- 5. TICK ---
    simulation.on("tick", () => {
       if (layoutMode === LayoutMode.SEED) {
          const totalNodesCount = nodes.length;
          const trunkThickness = Math.min(180, 15 + (totalNodesCount * 3));
          const trunkSubThickness = trunkThickness * 0.4;
          const baseSpread = Math.min(250, totalNodesCount * 6); 

          stemGroup.each(function(d: any) {
             const grp = d3.select(this);
             if(!d.x || !d.y) return;
             
             const groundY = height - 60;
             const rootX = d.x;
             const rootY = d.y;
             const targetY = groundY;
             const midY = (rootY + targetY) / 2;
             
             const dMain = `M${rootX},${rootY} C${rootX-trunkThickness*0.2},${midY} ${rootX+trunkThickness*0.2},${midY} ${rootX},${targetY}`;
             grp.select(".main-stem").attr("d", dMain).attr("stroke", "#5D4037").attr("stroke-width", trunkThickness);

             const dSub1 = `M${rootX},${rootY} C${rootX-trunkThickness*0.5},${midY} ${rootX-baseSpread},${targetY - 10} ${rootX - (baseSpread * 0.5)},${targetY}`;
             grp.select(".sub-stem-1").attr("d", dSub1).attr("stroke", "#8D6E63").attr("stroke-width", trunkSubThickness);

             const dSub2 = `M${rootX},${rootY} C${rootX+trunkThickness*0.5},${midY} ${rootX+baseSpread},${targetY - 10} ${rootX + (baseSpread * 0.5)},${targetY}`;
             grp.select(".sub-stem-2").attr("d", dSub2).attr("stroke", "#A1887F").attr("stroke-width", trunkSubThickness);
          });
      }

      linkGroup.each(function(d: any) {
          const group = d3.select(this);
          const s = d.source as Node;
          const t = d.target as Node;
          if (!s.x || !s.y || !t.x || !t.y) return;
          const tId = t.id;
          const weight = nodeWeights.get(tId) || 1;
          
          if (layoutMode === LayoutMode.SEED || linkStyle === LinkStyle.ROOT) {
              const treeHeight = d3.max(nodes, n => n.level) || 1;
              const scaleFactor = layoutMode === LayoutMode.SEED ? (2.5 + (treeHeight * 0.15)) : 3;
              const thickness = Math.min(40, scaleFactor * Math.sqrt(weight));
              const spread = thickness * 1.5; 
              
              const hash = getHash(s.id + t.id);
              const dx = t.x - s.x;
              const dy = t.y - s.y;
              const dist = Math.sqrt(dx*dx + dy*dy) || 1;
              const nx = -dy / dist; const ny = dx / dist;
              const bendDir = (hash % 2 === 0 ? 1 : -1);
              const bendOffset = 15 * bendDir; 
              const mx = (s.x + t.x) / 2 + nx * bendOffset;
              const my = (s.y + t.y) / 2 + ny * bendOffset;
              
              group.select(".vine-core").attr("stroke", "#5D4037").attr("stroke-width", thickness).attr("stroke-opacity", 1).attr("d", `M${s.x},${s.y} Q${mx},${my} ${t.x},${t.y}`);
              const amp = spread; 
              const s1_cp1x = s.x + dx*0.33 + nx * amp; const s1_cp1y = s.y + dy*0.33 + ny * amp;
              const s1_cp2x = s.x + dx*0.66 - nx * amp; const s1_cp2y = s.y + dy*0.66 - ny * amp;
              group.select(".vine-strand-1").attr("stroke", "#8D6E63").attr("stroke-width", Math.max(1, thickness * 0.35)).attr("d", `M${s.x},${s.y} C${s1_cp1x},${s1_cp1y} ${s1_cp2x},${s1_cp2y} ${t.x},${t.y}`);
              const s2_cp1x = s.x + dx*0.33 - nx * amp; const s2_cp1y = s.y + dy*0.33 - ny * amp;
              const s2_cp2x = s.x + dx*0.66 + nx * amp; const s2_cp2y = s.y + dy*0.66 + ny * amp;
              group.select(".vine-strand-2").attr("stroke", "#A1887F").attr("stroke-width", Math.max(1, thickness * 0.35)).attr("d", `M${s.x},${s.y} C${s2_cp1x},${s2_cp1y} ${s2_cp2x},${s2_cp2y} ${t.x},${t.y}`);

              const leafT = 0.6; const invT = 1 - leafT;
              const qx = (invT*invT)*s.x + 2*invT*leafT*mx + (leafT*leafT)*t.x;
              const qy = (invT*invT)*s.y + 2*invT*leafT*my + (leafT*leafT)*t.y;
              const angle = Math.atan2(dy, dx) * 180 / Math.PI;
              const leafSide = ((hash >> 1) % 2 === 0) ? 45 : -45;
              group.select(".leaf-positioner").attr("transform", `translate(${qx},${qy}) rotate(${angle + leafSide}) scale(0.8)`);
          } else {
              const weight = nodeWeights.get(tId) || 1;
              const dPath = `M${s.x},${s.y} L${t.x},${t.y}`;
              const straightColor = theme === AppTheme.CYBER ? "#475569" : "#94a3b8";
              group.select(".vine-core").attr("stroke", straightColor).attr("stroke-width", 1.5 + Math.min(4, Math.log(weight))).attr("stroke-opacity", 0.6).attr("d", dPath);
              group.select(".vine-strand-1").attr("d", null);
              group.select(".vine-strand-2").attr("d", null);
          }
      });
      nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
      nodeGroup.each(function(d) {
         const text = d3.select(this).select("text");
         text.attr("x", 0).attr("y", d.val + 15).attr("text-anchor", "middle").attr("dy", "0.35em");
      });
    });

    const drag = d3.drag<SVGGElement, Node>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        if (!(layoutMode === LayoutMode.SEED && d.id === 'root')) {
            d.fx = null;
            d.fy = null;
        }
      });
      
    nodeGroup.call(drag);

  }, [data, dimensions, theme, linkStyle, onNodeExpand, onNodeSelect, themeColors, nodeWeights, layoutMode]);

  useEffect(() => {
    if (layoutMode === LayoutMode.SEED && data.nodes.length === 1 && simulationRef.current && dimensions.height > 0 && zoomBehaviorRef.current && svgRef.current) {
       const root = nodesMapRef.current.get('root');
       if (root) {
          const horizonY = dimensions.height - 60;
          const startY = horizonY + 50; 
          const targetY = dimensions.height - 120;
          const startScale = 1.3;
          const startTx = (dimensions.width / 2) - (dimensions.width / 2) * startScale;
          const startTy = (dimensions.height / 2) - (startY - 40) * startScale;
          const endScale = 0.9;
          const endTx = (dimensions.width / 2) - (dimensions.width / 2) * endScale;
          const endTy = (dimensions.height / 2) - targetY * endScale;

          root.fx = dimensions.width / 2; root.fy = startY; root.val = 5;

          const svg = d3.select(svgRef.current);
          svg.call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(startTx, startTy).scale(startScale));
          const duration = 4000; const ease = d3.easeCubicInOut;
          svg.transition().duration(duration).ease(ease).call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(endTx, endTy).scale(endScale));
          d3.select({ t: 0 }).transition().duration(duration).ease(ease).tween("sprout", () => {
              const iY = d3.interpolateNumber(startY, targetY); const iSize = d3.interpolateNumber(5, 30);
              return (t) => {
                  if (!root) return; root.fy = iY(t); root.val = iSize(t);
                  simulationRef.current?.alpha(0.5).restart(); 
              };
          }).on("end", () => { root.val = 30; simulationRef.current?.alpha(0.1).restart(); });
       }
    }
  }, [layoutMode, dimensions]);

  const handleContextItemClick = (type: NodeIconType) => {
      if (contextMenu.nodeId) {
          onUpdateNode(contextMenu.nodeId, { iconType: type });
          setContextMenu({ x: 0, y: 0, nodeId: null });
      }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <svg ref={svgRef} className="w-full h-full block" />
      <div className={`absolute bottom-4 right-4 p-3 rounded-lg shadow-lg backdrop-blur-md border ${
        theme === AppTheme.CYBER ? 'bg-slate-800/80 border-slate-700 text-slate-200' : 'bg-white/80 border-slate-200 text-slate-700'
      }`}>
        <h4 className="text-xs font-bold mb-2 uppercase tracking-wider">Legend</h4>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          <span className="text-xs">Click Node to Select/View</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-green-500 flex items-center justify-center text-[8px] text-white font-bold">+</div>
          <span className="text-xs">Expand Hidden Branch (Bud)</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-red-500 flex items-center justify-center text-[8px] text-white font-bold">-</div>
          <span className="text-xs">Collapse Branch</span>
        </div>
      </div>

      {contextMenu.nodeId && (
          <div 
            style={{ 
                position: 'fixed', 
                left: contextMenu.x, 
                top: contextMenu.y 
            }}
            className={`z-50 rounded-xl shadow-2xl border min-w-[160px] overflow-hidden ${
                theme === AppTheme.CYBER ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider opacity-50 border-b border-gray-500/10">Change Icon</div>
              <button onClick={() => handleContextItemClick('folder')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-3 transition-colors"><Folder size={16} className="text-amber-500" /> Folder</button>
              <button onClick={() => handleContextItemClick('video')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-3 transition-colors"><Video size={16} className="text-violet-500" /> Video</button>
              <button onClick={() => handleContextItemClick('image')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-3 transition-colors"><Image size={16} className="text-sky-500" /> Image</button>
              <button onClick={() => handleContextItemClick('file')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-3 transition-colors"><FileText size={16} className="text-emerald-500" /> File</button>
               <button onClick={() => handleContextItemClick('music')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-3 transition-colors"><Music size={16} className="text-pink-500" /> Music</button>
                <button onClick={() => handleContextItemClick('spreadsheet')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-3 transition-colors"><Table size={16} className="text-green-600" /> Sheet</button>
              <button onClick={() => handleContextItemClick('default')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-3 transition-colors"><Circle size={16} className="text-slate-400" /> Basic Node</button>
          </div>
      )}
    </div>
  );
};

export default MindMap;