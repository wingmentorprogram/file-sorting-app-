// ... (imports remain same)
import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Circle, FileText, Folder, Image, Video, Flower2, Music, Table, Trash2 } from 'lucide-react';
import { GraphData, Node, Link, NodeType, AppTheme, LinkStyle, NodeIconType, LayoutMode } from '../types';
import { THEMES } from '../constants';

interface MindMapProps {
  data: GraphData;
  onNodeExpand: (node: Node) => void;
  onNodeSelect: (node: Node) => void;
  onUpdateNode: (nodeId: string, updates: Partial<Node>) => void;
  onDeleteNode: (nodeId: string) => void;
  theme: AppTheme;
  linkStyle: LinkStyle;
  layoutMode: LayoutMode;
  focusedNodeId?: string | null;
}

// Icon Paths (ViewBox 0 0 24 24)
const ICONS: Record<string, string> = {
  folder: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
  video: "M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 7l-5 3.5v-7l5 3.5z",
  image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
  file: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  music: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  spreadsheet: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h3v3H7zm0 4h3v3H7zm0 4h3v3H7zM14 7h3v3h-3zm0 4h3v3h-3zm0 4h3v3h-3z",
  seed: "M12 22c4.97 0 9-4.03 9-9 0-4.97-9-13-9-13S3 8.03 3 13c0 4.97 4.03 9 9 9z", 
  tree: "M12 2L2 22h20L12 2zm0 3l7 14H5l7-14z M19 12h-2v-2c0-3.86-3.14-7-7-7S3 6.14 3 10v2H1c0 5 4.9 9 11 9s11-4 11-9zM7 10c0-2.76 2.24-5 5-5s5 2.24 5 5v2H7v-2zm5 9c-3.14 0-6-2.33-6-5.5S8.86 8 12 8s6 2.33 6 5.5S15.14 19 12 19zm-1-5h2v3h-2v-3z",
  leaf: "M17 8C8 10 5.9 16.17 3.82 21.34 5.71 18.27 7.5 16.5 8 16c.41.69 1.5 2.5 1.5 2.5s3.25-1 6-3.5 4-7.5 4-7.5-1.5 0-2.5.5z"
};

// Helper for deterministic pseudo-randomness based on IDs
const getHash = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h);
};

// Simple Linear Congruential Generator for seeded random sequence
const makeRng = (seed: number) => {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};

// Helper to generate organic, smooth curves (Natural Branch Effect)
const generateNaturalPath = (x1: number, y1: number, x2: number, y2: number, level: number, seed: number) => {
    const rng = makeRng(seed);
    const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    const isRight = x2 > x1;

    if (level === 1) {
        // Less straight, more organic curve for Level 1
        // Relax the control point to 35-40% distance instead of 55%
        const cp1x = x1 + (x2 - x1) * 0.35; 
        const cp1y = y1 + (rng() * 30 - 15); // Add noticeable vertical waviness

        const cp2x = x2 - (x2 - x1) * 0.2;
        // Gravity effect: Bow down slightly
        const bowFactor = 20 + (rng() * 20); 
        const cp2y = y2 + bowFactor;

        return {
            d: `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`,
            cp1: {x: cp1x, y: cp1y},
            cp2: {x: cp2x, y: cp2y}
        };
    } else {
        // Sub-branches (Level 2+) - Quadratic but with offset for organic feel
        const cpX = (x1 + x2) / 2 + (rng() * 30 - 15);
        const cpY = (y1 + y2) / 2 + (rng() * 30 - 15);
        
        return {
             d: `M${x1},${y1} Q${cpX},${cpY} ${x2},${y2}`,
             cp1: {x: cpX, y: cpY},
             cp2: {x: cpX, y: cpY} 
        };
    }
};

// Cubic Bezier interpolation to find points on the curved branch for leaves
const getPointOnBezier = (t: number, p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}) => {
    const oneMinusT = 1 - t;
    const x = Math.pow(oneMinusT, 3) * p0.x + 3 * Math.pow(oneMinusT, 2) * t * p1.x + 3 * oneMinusT * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
    const y = Math.pow(oneMinusT, 3) * p0.y + 3 * Math.pow(oneMinusT, 2) * t * p1.y + 3 * oneMinusT * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;
    return { x, y };
}

// Quadratic Bezier interpolation for top crown branches
const getPointOnQuadratic = (t: number, p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    const oneMinusT = 1 - t;
    const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
    const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
    return { x, y };
}

// Recursive helper to assign branch side direction
const assignSides = (nodes: Node[], links: Link[]) => {
    const adjacency: Record<string, string[]> = {};
    links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as Node).id : l.source as string;
        const t = typeof l.target === 'object' ? (l.target as Node).id : l.target as string;
        if (!adjacency[s]) adjacency[s] = [];
        adjacency[s].push(t);
    });

    const sideMap = new Map<string, number>(); // 1 for right, -1 for left
    
    // Find Level 1 nodes (connected to root)
    const level1 = adjacency['root'] || [];
    
    // CRITICAL: Sort by ID to ensure that the order of side assignment matches 
    // the order of vertical placement (which also sorts by ID).
    level1.sort((a, b) => a.localeCompare(b));

    level1.forEach((id, index) => {
        // Strict Alternating: Even -> Left (-1), Odd -> Right (1)
        const side = index % 2 === 0 ? -1 : 1;
        sideMap.set(id, side);
        
        // Propagate side to children
        const propagate = (parentId: string, parentSide: number) => {
            const children = adjacency[parentId] || [];
            children.forEach(childId => {
                sideMap.set(childId, parentSide);
                propagate(childId, parentSide);
            });
        };
        propagate(id, side);
    });
    return sideMap;
};


const MindMap: React.FC<MindMapProps> = ({ 
    data, 
    onNodeExpand, 
    onNodeSelect, 
    onUpdateNode,
    onDeleteNode,
    theme, 
    linkStyle, 
    layoutMode,
    focusedNodeId 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, nodeId: string | null }>({ x: 0, y: 0, nodeId: null });
  
  const nodesMapRef = useRef<Map<string, Node>>(new Map());
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const themeColors = THEMES[theme];

  // Zoom to focused node
  useEffect(() => {
    if (!focusedNodeId || !svgRef.current || !zoomBehaviorRef.current) return;

    // Retrieve the node from the ref map to ensure we get current coordinates
    const node = nodesMapRef.current.get(focusedNodeId);
    
    if (node && typeof node.x === 'number' && typeof node.y === 'number') {
         const { width, height } = dimensions;
         const svg = d3.select(svgRef.current);
         const scale = 1.5; // Focus zoom level
         
         const transform = d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(scale)
            .translate(-node.x, -node.y);
         
         svg.transition()
            .duration(750)
            .ease(d3.easeCubicOut)
            .call(zoomBehaviorRef.current.transform, transform);
    }
  }, [focusedNodeId, dimensions]);

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

    data.links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as Node).id : l.source as string;
        const t = typeof l.target === 'object' ? (l.target as Node).id : l.target as string;
        if (!childrenMap.has(s)) childrenMap.set(s, []);
        childrenMap.get(s)!.push(t);
    });

    const getWeight = (nodeId: string): number => {
        if (map.has(nodeId)) return map.get(nodeId)!;
        let w = 1; 
        const children = childrenMap.get(nodeId) || [];
        children.forEach(childId => w += getWeight(childId));
        map.set(nodeId, w);
        return w;
    };

    const calculateDepth = (nodeId: string, depth: number) => {
        depthMap.set(nodeId, depth);
        const children = childrenMap.get(nodeId) || [];
        children.forEach(c => calculateDepth(c, depth + 1));
    }
    
    calculateDepth('root', 0);
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
    const horizonY = height - 60; 

    // --- 0. DEFS ---
    let defs = svg.select<SVGDefsElement>("defs");
    if (defs.empty()) {
        defs = svg.append("defs");
        
        const leafGrad = defs.append("linearGradient")
            .attr("id", "leafGradient")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
        leafGrad.append("stop").attr("offset", "0%").attr("stop-color", "#84cc16");
        leafGrad.append("stop").attr("offset", "100%").attr("stop-color", "#3f6212");

        const skyGrad = defs.append("linearGradient")
            .attr("id", "skyGradient")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        skyGrad.append("stop").attr("offset", "0%").attr("stop-color", "#0ea5e9");
        skyGrad.append("stop").attr("offset", "100%").attr("stop-color", "#e0f2fe");
        
        // Add Trunk Gradient for realism
        const trunkGrad = defs.append("linearGradient")
            .attr("id", "trunkGradient")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%"); // Horizontal gradient across trunk width
        trunkGrad.append("stop").attr("offset", "0%").attr("stop-color", "#3E2723"); // Dark edge
        trunkGrad.append("stop").attr("offset", "20%").attr("stop-color", "#4E342E"); 
        trunkGrad.append("stop").attr("offset", "50%").attr("stop-color", "#6D4C41"); // Highlight center
        trunkGrad.append("stop").attr("offset", "80%").attr("stop-color", "#4E342E");
        trunkGrad.append("stop").attr("offset", "100%").attr("stop-color", "#3E2723"); // Dark edge
    }

    // --- 1. SETUP LAYERS ---
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
      svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(0.8));
    }

    let bgLayer = g.select<SVGGElement>(".bg-layer");
    if (bgLayer.empty()) {
        bgLayer = g.insert("g", ":first-child").attr("class", "bg-layer");
        bgLayer.append("rect").attr("class", "sky-rect").attr("width", 200000).attr("x", -100000).attr("fill", "url(#skyGradient)");
        bgLayer.append("rect").attr("class", "ground-rect").attr("width", 200000).attr("x", -100000).attr("fill", "#3f2c20");
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
    let processedNodes = [...data.nodes];
    
    // Assign Sides for tree growth direction
    const sideMap = assignSides(processedNodes, data.links);

    if (layoutMode === LayoutMode.SEED) {
        // Distribute Level 1 nodes (Branches) along trunk
        const level1 = processedNodes.filter(n => {
            if (n.id === 'root') return false;
            // Is directly connected to root
            return data.links.some(l => 
                ((typeof l.source === 'object' ? (l.source as Node).id : l.source) === 'root' && (typeof l.target === 'object' ? (l.target as Node).id : l.target) === n.id) ||
                ((typeof l.target === 'object' ? (l.target as Node).id : l.target) === 'root' && (typeof l.source === 'object' ? (l.source as Node).id : l.source) === n.id)
            );
        });
        
        // Sorting ensures stability of the layout and matches the ID sort in assignSides
        level1.sort((a,b) => a.id.localeCompare(b.id));
        
        // Vertical Distribution along trunk
        level1.forEach((n, i) => {
            const count = level1.length;
            // Distribute from top to bottom
            const ratio = count > 1 ? i / (count - 1) : 0.5;
            // Trunk tier: 0 is top, 1 is bottom.
            n.trunkTier = 0.2 + (ratio * 0.55); 
        });
    }

    const nodes: Node[] = processedNodes.map(d => {
      const existing = nodesMapRef.current.get(d.id);
      
      const side = sideMap.get(d.id) || 1;
      
      if (layoutMode === LayoutMode.SEED && d.id === 'root') {
          const groundY = height - 60;
          const isSapling = data.nodes.length <= 1;
          const baseTrunkHeight = isSapling ? 100 : Math.min(550, 250 + (data.nodes.length * 10)); 
          const targetRootY = groundY - baseTrunkHeight; 

          if (existing) {
             return { ...d, x: existing.x, y: existing.y, fx: width / 2, fy: targetRootY, vx: existing.vx, vy: existing.vy, val: d.val, side }
          }
          return { ...d, fx: width / 2, fy: targetRootY, x: width / 2, y: targetRootY, vx: 0, vy: 0, val: d.val, side }
      }

      if (existing) {
        let fx = existing.fx;
        let fy = existing.fy;
        if (layoutMode === LayoutMode.SPIDER && d.id === 'root') { fx = null; fy = null; }
        return { ...d, x: existing.x, y: existing.y, vx: existing.vx, vy: existing.vy, fx, fy, trunkTier: d.trunkTier, side, level: d.level, val: d.val };
      }
      return { ...d, x: width / 2, y: height / 2, vx: 0, trunkTier: d.trunkTier, side, level: d.level, val: d.val };
    });

    const links: Link[] = data.links.map(d => ({ ...d }));

    const currentIds = new Set(nodes.map(n => n.id));
    for (const id of nodesMapRef.current.keys()) {
        if (!currentIds.has(id)) nodesMapRef.current.delete(id);
    }
    nodes.forEach(n => nodesMapRef.current.set(n.id, n));
    
    // --- 3. SIMULATION ---
    let simulation = d3.forceSimulation<Node, Link>(nodes)
      .alpha(0.8)
      .alphaDecay(0.02)
      .velocityDecay(0.85);
    
    simulationRef.current = simulation;

    if (layoutMode === LayoutMode.SEED) {
        const groundY = height - 60;
        const rootNode = nodes.find(n => n.id === 'root');
        const rootY = rootNode?.fy || (groundY - 400);
        const trunkHeight = groundY - rootY;

        simulation
            .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance((l, i) => {
                const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                const target = typeof l.target === 'object' ? l.target as Node : nodes.find(n => n.id === l.target);
                
                // MAIN BRANCHES
                if (sourceId === 'root' && target && target.trunkTier !== undefined) {
                    const tier = target.trunkTier;
                    const minLength = 60;
                    const maxLength = 140;
                    return minLength + (tier * (maxLength - minLength)); 
                }
                
                return 100; 
            }).strength(0.8))
            
            .force("charge", d3.forceManyBody().strength(-400))
            .force("collide", d3.forceCollide().radius(d => d.val * 2 + 25).strength(0.9))
            
            .force("y", d3.forceY<Node>(d => {
                if (d.id === 'root') return rootY;
                if (d.trunkTier !== undefined) {
                    return rootY + (trunkHeight * d.trunkTier);
                }
                return rootY - 150; 
            }).strength(d => {
                if (d.id === 'root') return 1;
                if (d.trunkTier !== undefined) return 0.8; 
                return 0.02;
            }))
            
            .force("x", d3.forceX<Node>(d => {
                if (d.id === 'root') return width / 2;
                
                const side = (d as any).side || 1;
                const level = (d as any).level || 1;
                
                const spreadBase = 250;
                const spreadPerLevel = 150;
                const targetX = (width / 2) + (side * (spreadBase + (level * spreadPerLevel)));
                return targetX;
            }).strength(d => {
                if (d.trunkTier !== undefined) return 0.3; 
                return 0.15; 
            }));

    } else {
        // --- SPIDER MODE FIXES ---
        simulation
            .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-1000))
            .force("collide", d3.forceCollide().radius(d => d.val * 4 + 25))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("biasX", d3.forceX<Node>(d => width/2 + (d.biasX || 0)).strength(0.2))
            .force("biasY", d3.forceY<Node>(d => height/2 + (d.biasY || 0)).strength(0.2));
    }

    // --- 4. RENDER ---

    const stemGroup = stemLayer.selectAll<SVGGElement, Node>(".stem-group")
      .data(nodes.filter(n => n.id === 'root' && layoutMode === LayoutMode.SEED), d => d.id)
      .join(
        enter => {
            const g = enter.append("g").attr("class", "stem-group");
            g.append("path").attr("class", "bark-core").attr("fill", "url(#trunkGradient)").attr("stroke", "none");
            g.append("path").attr("class", "bark-details").attr("fill", "none").attr("stroke", "#2D1B17").attr("stroke-width", 1.5).attr("opacity", 0.3);
            return g;
        },
        update => update,
        exit => exit.remove()
      );

    const linkGroup = linkLayer.selectAll<SVGGElement, Link>(".link-group")
      .data(links, (d: any) => `${(d.source as Node).id || d.source}-${(d.target as Node).id || d.target}`)
      .join(
        enter => {
            const grp = enter.append("g").attr("class", "link-group");
            grp.append("path").attr("class", "branch-main").attr("fill", "none").attr("stroke-linecap", "round");
            return grp;
        },
        update => update,
        exit => exit.remove()
      );

    const getNodeColor = (d: Node) => {
        if (d.iconType === 'seed') return '#8d6e63';
        if (d.type === NodeType.PROJECT) {
            if (d.level === 1) return '#22c55e'; 
            if ((d.level || 0) > 1) return '#3b82f6';
        }
        return d.color || (d.type === NodeType.PROJECT ? '#22c55e' : themeColors.node);
    };

    const nodeGroup = nodeLayer.selectAll<SVGGElement, Node>(".node-group")
      .data(nodes, d => d.id)
      .join(
        enter => {
          const g = enter.append("g").attr("class", "node-group").attr("opacity", 0); 
          const nodeColor = getNodeColor;

          const circle = g.append("circle")
            .attr("class", "node-circle")
            .attr("r", 0)
            .attr("fill", nodeColor)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
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

          expandBtn.append("path")
            .attr("d", d => d.collapsed ? "M-4 0h8M0 -4v8" : "M-4 0h8") 
            .attr("class", "expand-icon") 
            .attr("stroke", "white")
            .attr("stroke-width", 2);

          g.on("mouseenter", function() {
              d3.select(this).select(".expand-btn").transition().duration(200).attr("opacity", 1).attr("transform", "translate(14, -14) scale(1)");
          }).on("mouseleave", function() {
              d3.select(this).select(".expand-btn").transition().duration(200).attr("opacity", 0).attr("transform", "translate(14, -14) scale(0)");
          });

          g.each(function(d) {
             const group = d3.select(this);
             let type = d.iconType || 'default';
             if (d.type === NodeType.PROJECT) type = 'folder';
             if (d.type === NodeType.DOCUMENT && type === 'default') type = 'file';
             const iconPath = ICONS[type];
             if (iconPath) {
                 group.append("path").attr("d", iconPath).attr("fill", "#ffffff").attr("transform", `translate(-10, -10) scale(0.8)`).attr("class", "node-icon").style("pointer-events", "none");
             }
          });

          g.append("text")
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
            .style("font-weight", "600")
            .on("click", (event, d) => { event.stopPropagation(); onNodeSelect(d); });

          g.transition().duration(500).attr("opacity", 1);
          circle.transition().duration(800).ease(d3.easeBackOut).attr("r", d => d.val);

          return g;
        },
        update => {
           update.select("text").text(d => d.name).attr("fill", theme === AppTheme.CYBER ? "#e2e8f0" : "#334155").attr("stroke", theme === AppTheme.CYBER ? "#0f172a" : "#ffffff");
           update.select(".node-circle").transition().duration(500).attr("fill", getNodeColor).attr("r", (d: Node) => d.val); 
           update.select(".expand-circle").attr("fill", d => d.collapsed ? "#22c55e" : "#ef4444");
           update.select(".expand-icon").attr("d", d => d.collapsed ? "M-4 0h8M0 -4v8" : "M-4 0h8");
           update.each(function(d) {
             const group = d3.select(this);
             let type = d.iconType || 'default';
             if (d.type === NodeType.PROJECT) type = 'folder';
             if (d.type === NodeType.DOCUMENT && type === 'default') type = 'file';
             const iconPath = ICONS[type];
             group.select(".node-icon").remove();
             if (iconPath) {
                 group.append("path").attr("d", iconPath).attr("fill", "#ffffff").attr("transform", `translate(-10, -10) scale(0.8)`).attr("class", "node-icon").style("pointer-events", "none");
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
          const groundY = height - 60;
          const rootNode = nodes.find(n => n.id === 'root');
          
          if (!rootNode || !rootNode.x || !rootNode.y) return;

          const rootX = rootNode.x;
          const rootY = rootNode.y;
          const totalNodesCount = nodes.length;
          
          // --- Improved Trunk Calculation ---
          const trunkBaseWidth = Math.min(280, 80 + (totalNodesCount * 6));
          const trunkTopWidth = Math.max(20, trunkBaseWidth * 0.25);
          
          stemGroup.each(function(d: any) {
             const grp = d3.select(this);
             
             if (d.iconType === 'seed') {
                 grp.attr("opacity", 0);
                 return;
             }
             grp.attr("opacity", 1);
             
             const steps = 20; 
             const leftPath: [number, number][] = [];
             const rightPath: [number, number][] = [];
             
             for(let i=0; i<=steps; i++) {
                 const t = i/steps; 
                 const widthT = t * t * t; // More flare at bottom
                 const currentWidth = trunkTopWidth + widthT * (trunkBaseWidth - trunkTopWidth);
                 const currentY = rootY + (t * (groundY - rootY));
                 const noise = Math.sin(i * 1.5) * (trunkBaseWidth * 0.03); 
                 
                 leftPath.push([rootX - (currentWidth/2) + noise, currentY]);
                 rightPath.push([rootX + (currentWidth/2) + noise, currentY]);
             }
             
             let dString = `M${leftPath[0][0]},${leftPath[0][1]} `; 
             for(let i=1; i<leftPath.length; i++) dString += `L${leftPath[i][0]},${leftPath[i][1]} `;
             dString += `L${rightPath[rightPath.length-1][0]},${rightPath[rightPath.length-1][1]} `;
             for(let i=rightPath.length-2; i>=0; i--) dString += `L${rightPath[i][0]},${rightPath[i][1]} `;
             dString += "Z";

             grp.select(".bark-core").attr("d", dString);
             
             let detailsD = "";
             for(let k=1; k<5; k++) {
                 const xOffset = (k/5 - 0.5) * trunkTopWidth;
                 const bottomOffset = (k/5 - 0.5) * trunkBaseWidth;
                 detailsD += `M${rootX + xOffset},${rootY + 10} C${rootX + xOffset * 1.2},${(rootY+groundY)/2} ${rootX + bottomOffset * 0.9},${groundY - 10} ${rootX + bottomOffset},${groundY} `;
             }
             grp.select(".bark-details").attr("d", detailsD);

             // --- Top Crown / False Tip Branches ---
             // Faster growth: Cap at 10 nodes for full crown instead of 20
             const growthProgress = Math.min(1, Math.max(0, (nodes.length - 1) / 10));

             const topBranchesData: any[] = [];
             const topTwigsData: any[] = [];
             const topLeavesData: any[] = [];
             
             const topSeed = getHash(d.id + 'crown_v3');
             const topRng = makeRng(topSeed);
             
             const baseBranchCount = 3;
             const growthBranchCount = Math.floor(growthProgress * 8); 
             const totalTopBranches = baseBranchCount + growthBranchCount;
             
             const maxBranchLen = 40 + (growthProgress * 80); 
             
             for(let i=0; i<totalTopBranches; i++) {
                 const xOffset = (topRng() - 0.5) * trunkTopWidth * 0.9;
                 const startX = rootX + xOffset;
                 const startY = rootY + (topRng() * 10); 
                 
                 const fanAngle = Math.PI / 3 + (growthProgress * Math.PI / 2); 
                 const baseAngle = -Math.PI / 2; 
                 const angle = baseAngle + (topRng() - 0.5) * fanAngle;
                 
                 const len = (maxBranchLen * 0.5) + (topRng() * maxBranchLen * 0.5);
                 
                 const endX = startX + Math.cos(angle) * len;
                 const endY = startY + Math.sin(angle) * len;
                 
                 const cpDist = len * 0.6;
                 const bendFactor = (angle < baseAngle ? -1 : 1) * 0.2;
                 const cpAngle = angle + bendFactor;
                 const cpX = startX + Math.cos(cpAngle) * cpDist;
                 const cpY = startY + Math.sin(cpAngle) * cpDist;
                 
                 const width = Math.max(2, (8 + (growthProgress * 8)) * (1 - i/totalTopBranches)); 
                 
                 topBranchesData.push({
                    d: `M${startX},${startY} Q${cpX},${cpY} ${endX},${endY}`,
                    width,
                    color: "#5D4037"
                 });
                 
                 const twigCount = Math.floor(topRng() * 3) + Math.floor(growthProgress * 4);
                 
                 for(let k=0; k<twigCount; k++) {
                     const t = 0.3 + (k/twigCount) * 0.7; 
                     const p = getPointOnQuadratic(t, {x:startX, y:startY}, {x:cpX, y:cpY}, {x:endX, y:endY});
                     
                     const pNext = getPointOnQuadratic(t+0.05, {x:startX, y:startY}, {x:cpX, y:cpY}, {x:endX, y:endY});
                     const dx = pNext.x - p.x;
                     const dy = pNext.y - p.y;
                     const branchAng = Math.atan2(dy, dx);
                     const side = topRng() > 0.5 ? 1 : -1;
                     const twigAng = branchAng + (side * (Math.PI/3 + topRng()*0.5));
                     
                     const twigLen = 10 + (topRng() * 20 * growthProgress);
                     const tEndX = p.x + Math.cos(twigAng) * twigLen;
                     const tEndY = p.y + Math.sin(twigAng) * twigLen;
                     
                     const tCpX = (p.x + tEndX)/2;
                     const tCpY = (p.y + tEndY)/2 - (topRng()*5);
                     
                     topTwigsData.push({
                         d: `M${p.x},${p.y} Q${tCpX},${tCpY} ${tEndX},${tEndY}`,
                         width: Math.max(1, width * 0.4)
                     });
                     
                     if(topRng() > 0.3) {
                        topLeavesData.push({
                            x: tEndX,
                            y: tEndY,
                            rotation: (twigAng * 180 / Math.PI) + 90,
                            scale: 0.8 + (growthProgress * 0.5)
                        });
                     }
                 }
                 
                 topLeavesData.push({
                     x: endX,
                     y: endY,
                     rotation: (angle * 180 / Math.PI) + 90,
                     scale: 1.0 + (growthProgress * 0.8)
                 });
             }
             
             grp.selectAll(".top-crown-branch")
                .data(topBranchesData)
                .join(
                    enter => enter.append("path").attr("class", "top-crown-branch").attr("fill", "none").attr("stroke", "#6D4C41").attr("stroke-linecap", "round"),
                    update => update,
                    exit => exit.remove()
                )
                .attr("d", (b: any) => b.d)
                .attr("stroke-width", (b: any) => b.width)
                .attr("opacity", 0.9);

             grp.selectAll(".top-crown-twig")
                .data(topTwigsData)
                .join(
                    enter => enter.append("path").attr("class", "top-crown-twig").attr("fill", "none").attr("stroke", "#795548").attr("stroke-linecap", "round"),
                    update => update,
                    exit => exit.remove()
                )
                .attr("d", (b: any) => b.d)
                .attr("stroke-width", (b: any) => b.width);
             
             grp.selectAll(".top-crown-leaf")
                .data(topLeavesData)
                .join(
                    enter => enter.append("path").attr("class", "top-crown-leaf").attr("d", ICONS.leaf).attr("fill", "#84cc16").attr("stroke", "#3f6212").attr("stroke-width", 0.5),
                    update => update,
                    exit => exit.remove()
                )
                .attr("transform", (l: any) => `translate(${l.x},${l.y}) rotate(${l.rotation}) scale(${l.scale})`);

             const trunkHeight = groundY - rootY;
             const seed = getHash(d.id);
             const rng = makeRng(seed);
             
             const count = Math.max(2, Math.floor(trunkHeight / 60)); 
             const falseBranchesData = [];
             
             for(let i=0; i<count; i++) {
                 const r1 = rng();
                 const r2 = rng();
                 const r3 = rng();
                 
                 const t = 0.15 + (r1 * 0.7); 
                 const yPos = rootY + (t * trunkHeight);
                 
                 const widthT = t * t * t;
                 const currentW = trunkTopWidth + widthT * (trunkBaseWidth - trunkTopWidth);
                 
                 const side = r2 > 0.5 ? 1 : -1;
                 const startX = rootX + (side * currentW * 0.35); 
                 
                 const len = 40 + (r3 * 40);
                 const angle = -0.2 - (r3 * 0.3); 
                 
                 const endX = startX + (side * Math.cos(angle) * len);
                 const endY = yPos + (Math.sin(angle) * len); 
                 
                 const cp1x = startX + (side * len * 0.5);
                 const cp1y = yPos;
                 
                 falseBranchesData.push({
                     d: `M${startX},${yPos} Q${cp1x},${cp1y} ${endX},${endY}`,
                     width: Math.max(2, 8 * t)
                 });
             }
             
             grp.selectAll(".false-branch-trunk")
                .data(falseBranchesData)
                .join(
                    enter => enter.append("path").attr("class", "false-branch-trunk").attr("fill", "none").attr("stroke", "#6D4C41").attr("stroke-linecap", "round"),
                    update => update,
                    exit => exit.remove()
                )
                .attr("d", b => b.d)
                .attr("stroke-width", b => b.width)
                .attr("opacity", 1); 
          });

          linkGroup.each(function(d: any) {
             const group = d3.select(this);
             const s = d.source as Node;
             const t = d.target as Node;
             if (!s.x || !s.y || !t.x || !t.y) return;

             let sourceX = s.x;
             let sourceY = s.y;
             const isSustaining = s.id === 'root';

             if (isSustaining) {
                 sourceY = Math.max(rootY, Math.min(groundY, t.y));
                 const tProgress = (sourceY - rootY) / (groundY - rootY);
                 const widthT = tProgress * tProgress * tProgress;
                 const currentTrunkWidth = trunkTopWidth + widthT * (trunkBaseWidth - trunkTopWidth);
                 
                 const dirX = t.x - s.x;
                 const side = dirX >= 0 ? 1 : -1;
                 
                 sourceX = s.x + (side * currentTrunkWidth * 0.45);
             }

             const level = t.level || 1;
             const seed = getHash(s.id + t.id);
             const pathData = generateNaturalPath(sourceX, sourceY, t.x, t.y, level, seed);

             const childWeight = nodeWeights.get(t.id) || 1;

             let strokeWidth = 1;
             if (isSustaining) {
                  const tier = t.trunkTier || 0;
                  const weightThickness = Math.min(30, (childWeight - 1) * 1.5); 
                  strokeWidth = Math.max(12, 10 + (tier * 10) + weightThickness); 
             } else {
                  // Sub-branches
                  const weightThickness = Math.min(20, (childWeight - 1) * 2);
                  const baseThickness = Math.max(2, 6 - (level * 0.5));
                  strokeWidth = baseThickness + weightThickness;
             }

             group.select(".branch-main")
                .attr("d", pathData.d)
                .attr("stroke", "#6D4C41") 
                .attr("stroke-width", strokeWidth)
                .attr("opacity", 1);

             const rng = makeRng(seed);

             group.selectAll(".procedural-twig").remove();
             
             const twigCount = isSustaining ? Math.floor(rng() * 10) + 8 : Math.floor(rng() * 3); 
             const twigData = [];

             for(let i = 0; i < twigCount; i++) {
                 const tVal = 0.1 + (rng() * 0.8); 
                 
                 const p = getPointOnBezier(tVal, {x: sourceX, y: sourceY}, pathData.cp1, pathData.cp2, {x: t.x, y: t.y});
                 
                 const pNext = getPointOnBezier(tVal + 0.01, {x: sourceX, y: sourceY}, pathData.cp1, pathData.cp2, {x: t.x, y: t.y});
                 const tx = pNext.x - p.x;
                 const ty = pNext.y - p.y;
                 const mag = Math.sqrt(tx*tx + ty*ty) || 1;
                 const nx = -ty / mag; 
                 const ny = tx / mag; 
                 
                 const side = rng() > 0.5 ? 1 : -1;
                 
                 const startX = p.x + (nx * (strokeWidth * 0.45) * side);
                 const startY = p.y + (ny * (strokeWidth * 0.45) * side);
                 
                 const twigLen = 15 + (rng() * 40); 
                 const branchAngle = Math.atan2(ty, tx);
                 const twigAngle = branchAngle + (side * (0.3 + (rng() * 0.8))); 
                 
                 const endX = startX + Math.cos(twigAngle) * twigLen;
                 const endY = startY + Math.sin(twigAngle) * twigLen;
                 
                 const cpDist = twigLen * 0.5;
                 const curveBias = (rng() - 0.5) * 0.5; 
                 const cpX = startX + Math.cos(twigAngle + curveBias) * cpDist;
                 const cpY = startY + Math.sin(twigAngle + curveBias) * cpDist;

                 twigData.push({ 
                     d: `M${startX},${startY} Q${cpX},${cpY} ${endX},${endY}`,
                     width: Math.max(0.5, strokeWidth * 0.15 * (rng() + 0.5)) 
                 });
             }

             twigData.forEach(twig => {
                 group.append("path")
                    .attr("class", "procedural-twig")
                    .attr("d", twig.d)
                    .attr("stroke", "#795548")
                    .attr("stroke-width", twig.width)
                    .attr("fill", "none")
                    .attr("stroke-linecap", "round");
             });

             group.selectAll(".procedural-leaf").remove();
             
             const leafCount = isSustaining ? 3 : 5;
             
             const leafData = [];
             for(let i=0; i<leafCount; i++) {
                 const tVal = 0.2 + (i / leafCount) * 0.75; 
                 
                 const p = getPointOnBezier(tVal, {x: sourceX, y: sourceY}, pathData.cp1, pathData.cp2, {x: t.x, y: t.y});
                 const pNext = getPointOnBezier(tVal + 0.01, {x: sourceX, y: sourceY}, pathData.cp1, pathData.cp2, {x: t.x, y: t.y});
                 
                 const tx = pNext.x - p.x;
                 const ty = pNext.y - p.y;
                 const len = Math.sqrt(tx*tx + ty*ty) || 1;
                 const nx = -ty / len; 
                 const ny = tx / len; 

                 const sideMult = (i % 2 === 0) ? 1 : -1;
                 
                 const offsetDist = (strokeWidth / 2) + 1; 
                 const lx = p.x + (nx * offsetDist * sideMult);
                 const ly = p.y + (ny * offsetDist * sideMult);
                 
                 const randWiggle = (rng() * 40 - 20);
                 const rotationAngle = (Math.atan2(ny * sideMult, nx * sideMult) * 180 / Math.PI) + randWiggle;
                 
                 // NEW LEAF SIZE LOGIC: Larger closer to trunk
                 const positionScale = 1.6 - (tVal * 0.7); 
                 const levelScale = Math.max(0.4, 1.0 - ((level-1) * 0.15)); 
                 const scale = positionScale * levelScale * (0.8 + rng() * 0.4);

                 leafData.push({ x: lx, y: ly, rotation: rotationAngle, scale });
             }

             leafData.forEach(l => {
                group.append("path")
                    .attr("class", "procedural-leaf")
                    .attr("d", ICONS.leaf)
                    .attr("fill", "#65a30d") 
                    .attr("stroke", "#365314")
                    .attr("stroke-width", 0.5)
                    .attr("transform", `translate(${l.x},${l.y}) rotate(${l.rotation}) scale(${l.scale})`)
                    .style("pointer-events", "none");
             });
          });

      } else {
          // --- SPIDER MODE RENDER ---
          linkGroup.each(function(d: any) {
              const group = d3.select(this);
              const s = d.source as Node;
              const t = d.target as Node;
              if (!s.x || !s.y || !t.x || !t.y) return;
              
              const dPath = `M${s.x},${s.y} L${t.x},${t.y}`;
              group.select(".branch-main")
                .attr("d", dPath)
                .attr("stroke", theme === AppTheme.CYBER ? "#475569" : "#94a3b8")
                .attr("stroke-width", Math.min(4, Math.max(1, 5 - (t.level || 0))))
                .attr("opacity", 0.6);
              
              group.selectAll(".procedural-leaf").remove();
              group.selectAll(".procedural-twig").remove();
          });
      }
      
      nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
      nodeGroup.each(function(d) {
         d3.select(this).select("text").attr("x", 0).attr("y", d.val + 15).attr("dy", "0.35em");
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
       const rootData = data.nodes.find(n => n.id === 'root');

       if (root && rootData?.iconType === 'seed') {
          const horizonY = dimensions.height - 60;
          const startY = horizonY + 20; 
          const targetY = dimensions.height - 300;
          
          root.fx = dimensions.width / 2; root.fy = startY; root.val = 10;

          const svg = d3.select(svgRef.current);
          const duration = 2500;
          
          const t = svg.transition("sprout-anim").duration(duration).ease(d3.easeCubicOut);
          
          t.tween("sprout", () => {
              const iY = d3.interpolateNumber(startY, targetY); 
              const iSize = d3.interpolateNumber(10, 32);
              return (t) => {
                  if (!root) return; 
                  root.fy = iY(t); 
                  root.val = iSize(t);
                  simulationRef.current?.alpha(0.3).restart(); 
              };
          })
          .on("end", () => {
             onUpdateNode('root', { iconType: 'tree', color: '#22c55e', val: 32 });
          });
       }
    }
  }, [layoutMode, dimensions, data.nodes.length]);

  const handleContextItemClick = (type: NodeIconType) => {
      if (contextMenu.nodeId) {
          onUpdateNode(contextMenu.nodeId, { iconType: type });
          setContextMenu({ x: 0, y: 0, nodeId: null });
      }
  };

  const handleDeleteClick = () => {
      if (contextMenu.nodeId) {
          onDeleteNode(contextMenu.nodeId);
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
            style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
            className={`z-50 rounded-xl shadow-2xl border min-w-[160px] overflow-hidden ${theme === AppTheme.CYBER ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
          >
              <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider opacity-50 border-b border-gray-500/10">Actions</div>
              <button onClick={() => handleContextItemClick('folder')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 flex items-center gap-3"><Folder size={16} className="text-amber-500" /> Folder</button>
              <button onClick={() => handleContextItemClick('video')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 flex items-center gap-3"><Video size={16} className="text-violet-500" /> Video</button>
              <button onClick={() => handleContextItemClick('image')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 flex items-center gap-3"><Image size={16} className="text-sky-500" /> Image</button>
              <button onClick={() => handleContextItemClick('file')} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 flex items-center gap-3"><FileText size={16} className="text-emerald-500" /> File</button>
              
              {contextMenu.nodeId !== 'root' && (
                <>
                  <div className="border-t border-gray-500/10 my-1"></div>
                  <button onClick={handleDeleteClick} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-red-500/10 hover:text-red-500 flex items-center gap-3 text-red-400">
                    <Trash2 size={16} /> Delete Branch
                  </button>
                </>
              )}
          </div>
      )}
    </div>
  );
};

export default MindMap;