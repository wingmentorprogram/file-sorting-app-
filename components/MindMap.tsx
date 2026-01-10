import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Circle, FileText, Folder, Image, Video, Flower2, Music, Table, Trash2, Eye, EyeOff, ArrowUp, Sun, Moon, Play, Pause, CloudSun, Sunset } from 'lucide-react';
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

interface Cloud {
  id: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  speed: number;
  puffs: { cx: number, cy: number, r: number }[];
}

interface BackgroundTree {
  id: string;
  x: number;
  scale: number;
  seed: number;
}

// Icon Paths (ViewBox 0 0 24 24)
const ICONS: Record<string, string> = {
  folder: "M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z",
  video: "M21 6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 7l-5 3.5v-7l5 3.5z",
  image: "M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z",
  file: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z",
  music: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  spreadsheet: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h3v3H7zm0 4h3v3H7zm0 4h3v3H7zM14 7h3v3h-3zm0 4h3v3h-3zm0 4h3v3h-3z",
  seed: "M12 22c4.97 0 9-4.03 9-9 0-4.97-9-13-9-13S3 8.03 3 13c0 4.97 4.03 9 9 9z", 
  tree: "M12 2L2 22h20L12 2zm0 3l7 14H5l7-14z M19 12h-2v-2c0-3.86-3.14-7-7-7S3 6.14 3 10v2H1c0 5 4.9 9 11 9s11-4 11-9zM7 10c0-2.76 2.24-5 5-5s5 2.24 5 5v2H7v-2zm5 9c-3.14 0-6-2.33-6-5.5S8.86 8 12 8s6 2.33 6 5.5S15.14 19 12 19zm-1-5h2v3h-2v-3z",
  leaf: "M17 8C8 10 5.9 16.17 3.82 21.34 5.71 18.27 7.5 16.5 8 16c.41.69 1.5 2.5 1.5 2.5s3.25-1 6-3.5 4-7.5 4-7.5-1.5 0-2.5.5z",
  default: "M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
};

// --- HELPERS ---

const getHash = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return Math.abs(h);
};

const makeRng = (seed: number) => {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};

const generateNaturalPath = (x1: number, y1: number, x2: number, y2: number, level: number, seed: number) => {
    const rng = makeRng(seed);
    if (level === 1) {
        const cp1x = x1 + (x2 - x1) * 0.35; 
        const cp1y = y1 + (rng() * 30 - 15);
        const cp2x = x2 - (x2 - x1) * 0.2;
        const bowFactor = 20 + (rng() * 20); 
        const cp2y = y2 + bowFactor;
        return {
            d: `M${x1},${y1} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`,
            cp1: {x: cp1x, y: cp1y},
            cp2: {x: cp2x, y: cp2y}
        };
    } else {
        const cpX = (x1 + x2) / 2 + (rng() * 30 - 15);
        const cpY = (y1 + y2) / 2 + (rng() * 30 - 15);
        return {
             d: `M${x1},${y1} Q${cpX},${cpY} ${x2},${y2}`,
             cp1: {x: cpX, y: cpY},
             cp2: {x: cpX, y: cpY} 
        };
    }
};

const getPointOnBezier = (t: number, p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}, p3: {x:number, y:number}) => {
    const oneMinusT = 1 - t;
    const x = Math.pow(oneMinusT, 3) * p0.x + 3 * Math.pow(oneMinusT, 2) * t * p1.x + 3 * oneMinusT * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
    const y = Math.pow(oneMinusT, 3) * p0.y + 3 * Math.pow(oneMinusT, 2) * t * p1.y + 3 * oneMinusT * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;
    return { x, y };
}

const getPointOnQuadratic = (t: number, p0: {x:number, y:number}, p1: {x:number, y:number}, p2: {x:number, y:number}) => {
    const oneMinusT = 1 - t;
    const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
    const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
    return { x, y };
}

const assignSides = (nodes: Node[], links: Link[]) => {
    const adjacency: Record<string, string[]> = {};
    links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as Node).id : l.source as string;
        const t = typeof l.target === 'object' ? (l.target as Node).id : l.target as string;
        if (!adjacency[s]) adjacency[s] = [];
        adjacency[s].push(t);
    });
    const sideMap = new Map<string, number>();
    const level1 = adjacency['root'] || [];
    level1.sort((a, b) => a.localeCompare(b));
    level1.forEach((id, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        sideMap.set(id, side);
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

// Interpolates between two hex colors
const interpolateColor = (color1: string, color2: string, factor: number) => {
    if (factor < 0) factor = 0;
    if (factor > 1) factor = 1;
    const result = color1.slice(1).match(/.{2}/g)!.map((hex, i) => {
        return Math.round(parseInt(hex, 16) + factor * (parseInt(color2.slice(1).match(/.{2}/g)![i], 16) - parseInt(hex, 16)));
    });
    return `#${result.map(val => val.toString(16).padStart(2, '0')).join('')}`;
};

// Realistic Sky Colors (Photorealistic tones)
const SKY_COLORS = {
    dawn: { top: "#0f172a", middle: "#581c87", bottom: "#fb923c" },  // Dark Slate -> Purple -> Orange
    day: { top: "#0284c7", middle: "#7dd3fc", bottom: "#e0f2fe" },   // Rich Blue -> Sky Blue -> Mist
    dusk: { top: "#1e1b4b", middle: "#4c0519", bottom: "#f59e0b" },  // Midnight -> Maroon -> Amber
    night: { top: "#020617", middle: "#0f172a", bottom: "#1e293b" }  // Deep Black -> Slate -> Dark Grey
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
  
  // Day/Night Cycle State (0 to 1)
  const [timeOfDay, setTimeOfDay] = useState(0.4); // Start at Day
  const [isPaused, setIsPaused] = useState(false);
  const timeRef = useRef(0.4);
  const animationFrameRef = useRef<number>(0);
  
  // Clouds & Background Trees
  const cloudsRef = useRef<Cloud[]>([]);
  const bgTreesRef = useRef<BackgroundTree[]>([]);

  const nodesMapRef = useRef<Map<string, Node>>(new Map());
  const simulationRef = useRef<d3.Simulation<Node, Link> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Initialize clouds & trees
  useEffect(() => {
    const rng = makeRng(888);
    
    // Clouds
    const cloudCount = 15;
    const clouds: Cloud[] = [];
    for(let i=0; i<cloudCount; i++) {
        const puffs = [];
        const puffCount = 6 + Math.floor(rng() * 8);
        for(let j=0; j<puffCount; j++) {
            puffs.push({
                cx: (rng() - 0.5) * 160,
                cy: (rng() - 0.5) * 60,
                r: 35 + rng() * 45
            });
        }
        
        clouds.push({
            id: `cloud-${i}`,
            x: (rng() * 5000) - 2500,
            y: (rng() * 700) - 250, // Upper sky primarily
            scale: 0.8 + (rng() * 1.5),
            opacity: 0.3 + (rng() * 0.5),
            speed: 0.1 + (rng() * 0.3),
            puffs
        });
    }
    cloudsRef.current = clouds;

    // Background Trees
    if (bgTreesRef.current.length === 0) {
        const treeRng = makeRng(1234);
        const bgTrees: BackgroundTree[] = [];
        // Left side forest
        for(let i=0; i<6; i++) {
             const x = -500 - (treeRng() * 1800);
             bgTrees.push({ id: `bg-tree-l-${i}`, x, scale: 0.5 + treeRng()*0.6, seed: treeRng()*100 });
        }
        // Right side forest
        for(let i=0; i<6; i++) {
             const x = 500 + (treeRng() * 1800);
             bgTrees.push({ id: `bg-tree-r-${i}`, x, scale: 0.5 + treeRng()*0.6, seed: treeRng()*100 });
        }
        bgTreesRef.current = bgTrees;
    }
  }, []);
  
  // Animation loop for Day/Night and Wind
  useEffect(() => {
    if (layoutMode !== LayoutMode.SEED) return;
    
    let lastTime = Date.now();
    const cycleDuration = 60000; // 60 seconds full cycle

    const animate = () => {
        const now = Date.now();
        const delta = now - lastTime;
        lastTime = now;
        
        // Advance time only if not paused
        if (!isPaused) {
            timeRef.current = (timeRef.current + (delta / cycleDuration)) % 1;
            setTimeOfDay(timeRef.current);
        }
        
        // Update clouds independent of pause (wind still blows)
        if (cloudsRef.current) {
            cloudsRef.current.forEach(c => {
                c.x += c.speed;
                if (c.x > 3000) c.x = -3000; 
            });
        }
        
        animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [layoutMode, isPaused]);

  const handleTimeChange = (val: number) => {
      setIsPaused(true);
      setTimeOfDay(val);
      timeRef.current = val;
  };

  // Derived Light Source Calculation
  const sunData = useMemo(() => {
      // 0 = Dawn, 0.25 = Noon, 0.5 = Dusk, 0.75 = Midnight
      const t = timeOfDay;
      let cx = 0; 
      let cy = 0;
      let isSun = true;
      let lightColor = "#ffffff";
      let skyTop = "";
      let skyMiddle = "";
      let skyBottom = "";

      const { width, height } = dimensions;
      
      if (t < 0.5) {
          // DAY CYCLE (0 to 0.5)
          const sunProgress = t / 0.5; // 0 to 1
          cx = width * 0.1 + (width * 0.8 * sunProgress);
          cy = height * 0.8 - (Math.sin(sunProgress * Math.PI) * (height * 0.6));
          isSun = true;
          lightColor = "#ffedd5";
          
          if (sunProgress < 0.2) { // Dawn
             const factor = sunProgress / 0.2;
             skyTop = interpolateColor(SKY_COLORS.dawn.top, SKY_COLORS.day.top, factor);
             skyMiddle = interpolateColor(SKY_COLORS.dawn.middle, SKY_COLORS.day.middle, factor);
             skyBottom = interpolateColor(SKY_COLORS.dawn.bottom, SKY_COLORS.day.bottom, factor);
          } else if (sunProgress > 0.8) { // Dusk
             const factor = (sunProgress - 0.8) / 0.2;
             skyTop = interpolateColor(SKY_COLORS.day.top, SKY_COLORS.dusk.top, factor);
             skyMiddle = interpolateColor(SKY_COLORS.day.middle, SKY_COLORS.dusk.middle, factor);
             skyBottom = interpolateColor(SKY_COLORS.day.bottom, SKY_COLORS.dusk.bottom, factor);
          } else { // Day
             skyTop = SKY_COLORS.day.top;
             skyMiddle = SKY_COLORS.day.middle;
             skyBottom = SKY_COLORS.day.bottom;
          }
      } else {
          // NIGHT CYCLE (0.5 to 1.0)
          const moonProgress = (t - 0.5) / 0.5;
          cx = width * 0.1 + (width * 0.8 * moonProgress);
          cy = height * 0.8 - (Math.sin(moonProgress * Math.PI) * (height * 0.6));
          isSun = false;
          lightColor = "#94a3b8"; 
          
           if (moonProgress < 0.2) { // Sunset -> Night
             const factor = moonProgress / 0.2;
             skyTop = interpolateColor(SKY_COLORS.dusk.top, SKY_COLORS.night.top, factor);
             skyMiddle = interpolateColor(SKY_COLORS.dusk.middle, SKY_COLORS.night.middle, factor);
             skyBottom = interpolateColor(SKY_COLORS.dusk.bottom, SKY_COLORS.night.bottom, factor);
          } else if (moonProgress > 0.8) { // Night -> Dawn
             const factor = (moonProgress - 0.8) / 0.2;
             skyTop = interpolateColor(SKY_COLORS.night.top, SKY_COLORS.dawn.top, factor);
             skyMiddle = interpolateColor(SKY_COLORS.night.middle, SKY_COLORS.dawn.middle, factor);
             skyBottom = interpolateColor(SKY_COLORS.night.bottom, SKY_COLORS.dawn.bottom, factor);
          } else { // Night
             skyTop = SKY_COLORS.night.top;
             skyMiddle = SKY_COLORS.night.middle;
             skyBottom = SKY_COLORS.night.bottom;
          }
      }
      
      return { cx, cy, isSun, lightColor, skyTop, skyMiddle, skyBottom, progress: t };
  }, [timeOfDay, dimensions]);

  const themeColors = THEMES[theme];

  // Zoom Logic
  useEffect(() => {
    if (!focusedNodeId || !svgRef.current || !zoomBehaviorRef.current) return;
    const node = nodesMapRef.current.get(focusedNodeId);
    if (node && typeof node.x === 'number' && typeof node.y === 'number') {
         const { width, height } = dimensions;
         const svg = d3.select(svgRef.current);
         const transform = d3.zoomIdentity.translate(width / 2, height / 2).scale(1.5).translate(-node.x, -node.y);
         svg.transition().duration(750).ease(d3.easeCubicOut).call(zoomBehaviorRef.current.transform, transform);
    }
  }, [focusedNodeId, dimensions]);

  // Context Menu Close
  useEffect(() => {
    const handleClick = () => setContextMenu({ x: 0, y: 0, nodeId: null });
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Resize Handler
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Node Weights
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

  const shouldShowTree = layoutMode === LayoutMode.SEED && data.nodes.length > 1;

  const getNodeColor = (d: Node) => {
      const visualIconType = (d.id === 'root' && shouldShowTree) ? 'tree' : d.iconType;
      if (visualIconType === 'seed') return '#8d6e63';
      if (layoutMode === LayoutMode.SEED) {
           if (d.id === 'root') return '#22c55e'; 
           if (d.trunkTier !== undefined || d.level === 1) return '#2563eb'; 
           if (d.type === NodeType.PROJECT || d.type === NodeType.CATEGORY) return '#3b82f6';
           return '#60a5fa'; 
      }
      if (d.type === NodeType.PROJECT) return '#0ea5e9'; 
      return d.color || themeColors.node;
  };

  // --- D3 RENDERING EFFECT ---
  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;
    
    const hasChildrenSet = new Set<string>();
    data.links.forEach(l => {
        const s = typeof l.source === 'object' ? (l.source as Node).id : l.source as string;
        hasChildrenSet.add(s);
    });

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    
    // Position of ground/horizon
    const groundY = height - 60; 
    const horizonY = height - 160; 

    // --- 0. DEFS & SHADERS ---
    let defs = svg.select<SVGDefsElement>("defs");
    if (defs.empty()) {
        defs = svg.append("defs");
        
        // --- 3D & Texture Filters ---

        // 1. Realistic Bark Texture (Turbulence + Lighting)
        const barkFilter = defs.append("filter").attr("id", "barkTexture")
            .attr("x", "0%").attr("y", "0%").attr("width", "100%").attr("height", "100%");
        barkFilter.append("feTurbulence")
            .attr("type", "fractalNoise").attr("baseFrequency", "0.05 0.5").attr("numOctaves", "3").attr("result", "noise");
        barkFilter.append("feDiffuseLighting")
            .attr("in", "noise").attr("lighting-color", "#8d6e63").attr("surfaceScale", "2")
            .append("feDistantLight").attr("azimuth", "45").attr("elevation", "60");
        barkFilter.append("feComposite").attr("operator", "in").attr("in2", "SourceGraphic");
        
        // 2. 3D Cylindrical Lighting (Specular highlight)
        const cylinderFilter = defs.append("filter").attr("id", "cylinderLight");
        const spec = cylinderFilter.append("feSpecularLighting")
            .attr("result", "specOut").attr("specularConstant", "0.8").attr("specularExponent", "20").attr("lighting-color", "#ffffff");
        spec.append("fePointLight").attr("x", "-5000").attr("y", "-5000").attr("z", "1000");
        cylinderFilter.append("feComposite").attr("in", "SourceGraphic").attr("in2", "specOut").attr("operator", "arithmetic").attr("k1", "0").attr("k2", "1").attr("k3", "1").attr("k4", "0");

        // 3. Volumetric Glow (God Rays base)
        const glow = defs.append("filter").attr("id", "nodeGlow");
        glow.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
        const feMerge = glow.append("feMerge");
        feMerge.append("feMergeNode").attr("in", "coloredBlur");
        feMerge.append("feMergeNode").attr("in", "SourceGraphic");
        
        // 4. Cloud Noise for Atmosphere (Realistic Sky)
        const cloudNoise = defs.append("filter").attr("id", "cloudNoise").attr("x", "0%").attr("y", "0%").attr("width", "100%").attr("height", "100%");
        cloudNoise.append("feTurbulence").attr("type", "fractalNoise").attr("baseFrequency", "0.01").attr("numOctaves", "5").attr("seed", "123").attr("result", "noise");
        cloudNoise.append("feColorMatrix").attr("type", "matrix").attr("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.3 0").attr("in", "noise").attr("result", "softNoise");

        // 5. Fluffy Cloud Filter (Soft edges)
        const fluffyFilter = defs.append("filter").attr("id", "fluffyCloud");
        fluffyFilter.append("feGaussianBlur").attr("stdDeviation", "8").attr("in", "SourceGraphic");

        // Gradients
        if (defs.select("#skyGradient").empty()) {
            defs.append("linearGradient").attr("id", "skyGradient").attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        }
        
        // Sun Glow Gradient (Dynamic)
        if (defs.select("#sunGlow").empty()) {
            const sg = defs.append("radialGradient").attr("id", "sunGlow").attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
            sg.append("stop").attr("offset", "0%").attr("stop-color", "white").attr("stop-opacity", 0.6);
            sg.append("stop").attr("offset", "100%").attr("stop-color", "white").attr("stop-opacity", 0);
        }

        if (defs.select("#trunk3D").empty()) {
            const tGrad = defs.append("linearGradient").attr("id", "trunk3D").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
            tGrad.append("stop").attr("offset", "0%").attr("stop-color", "#3E2723"); // Dark edge
            tGrad.append("stop").attr("offset", "40%").attr("stop-color", "#5D4037"); // Light center
            tGrad.append("stop").attr("offset", "100%").attr("stop-color", "#281815"); // Dark edge
        }
        if (defs.select("#godRays").empty()) {
             const gr = defs.append("radialGradient").attr("id", "godRays").attr("cx", "50%").attr("cy", "50%").attr("r", "70%");
             gr.append("stop").attr("offset", "0%").attr("stop-color", "white").attr("stop-opacity", 0.3);
             gr.append("stop").attr("offset", "100%").attr("stop-color", "transparent").attr("stop-opacity", 0);
        }
    }
    
    // Update Dynamic Sky Gradient (3 Stops for Horizon Shader)
    const skyGrad = defs.select("#skyGradient");
    skyGrad.selectAll("*").remove();
    skyGrad.append("stop").attr("offset", "0%").attr("stop-color", sunData.skyTop);
    skyGrad.append("stop").attr("offset", "50%").attr("stop-color", sunData.skyMiddle);
    skyGrad.append("stop").attr("offset", "100%").attr("stop-color", sunData.skyBottom);

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

    // --- BACKGROUND LAYER (Dynamic Sky) ---
    let bgLayer = g.select<SVGGElement>(".bg-layer");
    if (bgLayer.empty()) {
        bgLayer = g.insert("g", ":first-child").attr("class", "bg-layer");
        // Base gradient
        bgLayer.append("rect").attr("class", "sky-rect").attr("width", 200000).attr("x", -100000).attr("y", -100000).attr("height", 200000).attr("fill", "url(#skyGradient)");
        // Atmospheric noise overlay for realism
        bgLayer.append("rect").attr("class", "sky-noise").attr("width", 200000).attr("x", -100000).attr("y", -100000).attr("height", 200000).attr("filter", "url(#cloudNoise)").attr("opacity", 0.15);
        
        // Celestial Body (Sun/Moon)
        bgLayer.append("circle").attr("class", "celestial-body").attr("r", 40);

        // Clouds Layer (Between Sun and Glow)
        bgLayer.append("g").attr("class", "clouds-layer");

        // Sun Glow (Dynamic position)
        bgLayer.append("circle").attr("class", "sun-glow").attr("r", 300).attr("fill", "url(#sunGlow)");
        
        // God Rays Overlay
        bgLayer.append("circle").attr("class", "god-rays").attr("r", 800).attr("fill", "url(#godRays)").style("mix-blend-mode", "overlay");

        bgLayer.append("g").attr("class", "landscape-layer");
        bgLayer.append("rect").attr("class", "ground-rect").attr("width", 200000).attr("x", -100000).attr("fill", "#1a2e05"); 
    }
    
    // Background Trees Layer (After landscape, before main tree)
    let bgTreesLayer = bgLayer.select<SVGGElement>(".bg-trees-layer");
    if (bgTreesLayer.empty()) {
        bgTreesLayer = bgLayer.append("g").attr("class", "bg-trees-layer");
    }

    if (layoutMode === LayoutMode.SEED) {
        bgLayer.attr("opacity", 1);
        
        // Update Sun/Moon Position
        bgLayer.select(".celestial-body")
            .attr("cx", sunData.cx)
            .attr("cy", sunData.cy)
            .attr("fill", sunData.lightColor)
            .attr("filter", "url(#nodeGlow)") 
            .attr("opacity", 0.9);

        // Update Sun Glow
        bgLayer.select(".sun-glow")
            .attr("cx", sunData.cx)
            .attr("cy", sunData.cy)
            .attr("opacity", sunData.isSun ? 0.8 : 0.3);

        // Update God Rays
        bgLayer.select(".god-rays")
            .attr("cx", sunData.cx)
            .attr("cy", sunData.cy)
            .attr("opacity", sunData.isSun ? 0.6 : 0.1);
            
        // --- RENDER CLOUDS ---
        const cloudsLayer = bgLayer.select(".clouds-layer");
        
        // Cloud Color Logic
        let cloudColor = "#ffffff";
        if (timeOfDay < 0.2 || timeOfDay > 0.8) {
             // Night/Dawn transition
             cloudColor = interpolateColor("#1e293b", "#64748b", 0.5); 
        } else if (timeOfDay >= 0.2 && timeOfDay < 0.3) {
             // Dawn
             cloudColor = "#fed7aa";
        } else if (timeOfDay > 0.7 && timeOfDay <= 0.8) {
             // Dusk
             cloudColor = "#fecaca";
        } else {
             // Day
             cloudColor = "#ffffff";
        }
        if (!sunData.isSun) cloudColor = "#475569";

        const cloudSelection = cloudsLayer.selectAll<SVGGElement, Cloud>(".cloud-group")
           .data(cloudsRef.current, d => d.id);
           
        const cloudEnter = cloudSelection.enter().append("g")
           .attr("class", "cloud-group")
           .attr("filter", "url(#fluffyCloud)"); 
           
        // Draw puffs per cloud
        cloudEnter.each(function(d) {
             const g = d3.select(this);
             d.puffs.forEach(p => {
                 g.append("circle")
                  .attr("cx", p.cx).attr("cy", p.cy).attr("r", p.r);
             });
        });

        const cloudUpdate = cloudEnter.merge(cloudSelection);
        
        cloudUpdate
           .attr("transform", d => `translate(${d.x}, ${d.y}) scale(${d.scale})`)
           .attr("opacity", d => d.opacity * (sunData.isSun ? 0.9 : 0.4))
           .attr("fill", cloudColor);

        
        // Base ground rect position (below horizon)
        bgLayer.select(".ground-rect").attr("y", horizonY + 50).attr("height", 100000);
        
        const hillsLayer = bgLayer.select(".landscape-layer");
        
        const updateHillGradient = (id: string, topColor: string, bottomColor: string) => {
            let grad = defs.select(`#${id}`);
            if (grad.empty()) grad = defs.append("linearGradient").attr("id", id).attr("x1", "0").attr("x2", "0").attr("y1", "0").attr("y2", "1");
            grad.selectAll("*").remove();
            grad.append("stop").attr("offset", "0%").attr("stop-color", topColor);
            grad.append("stop").attr("offset", "100%").attr("stop-color", bottomColor);
            return `url(#${id})`;
        };

        const hillLayers = [
           { 
               top: interpolateColor("#334155", "#0f172a", timeOfDay > 0.5 ? 0.9 : 0.2), 
               bottom: interpolateColor("#1e293b", "#000000", timeOfDay > 0.5 ? 0.9 : 0.2), 
               opacity: 0.7, yOff: -80, amp: 40, freq: 0.001, seed: 123 
           }, // Far
           { 
               top: interpolateColor("#1e293b", "#1e293b", timeOfDay > 0.5 ? 0.9 : 0.2), 
               bottom: interpolateColor("#0f172a", "#020617", timeOfDay > 0.5 ? 0.9 : 0.2), 
               opacity: 0.85, yOff: -40, amp: 60, freq: 0.002, seed: 456 
           }, // Mid
           { 
               top: interpolateColor("#0f172a", "#020617", timeOfDay > 0.5 ? 0.9 : 0.3), 
               bottom: interpolateColor("#020617", "#000000", timeOfDay > 0.5 ? 0.9 : 0.3), 
               opacity: 1.0, yOff: 0,   amp: 80, freq: 0.003, seed: 789 
           }  // Near
        ];

        hillsLayer.selectAll("*").remove(); 
        hillLayers.forEach((l, idx) => {
             const fill = updateHillGradient(`hillGrad${idx}`, l.top, l.bottom);
             let d = `M-5000,${horizonY}`;
             for(let x=-5000; x<=5000; x+=200) { 
                 const y = horizonY + l.yOff - Math.sin(x * l.freq) * l.amp;
                 d += ` L${x},${y}`;
             }
             d += ` L5000,${horizonY + 2000} L-5000,${horizonY + 2000} Z`; 
             hillsLayer.append("path").attr("d", d).attr("fill", fill).attr("opacity", l.opacity);
        });

        // --- BACKGROUND TREES RENDER ---
        bgTreesLayer.attr("opacity", 1);
        const bgTreeBind = bgTreesLayer.selectAll<SVGGElement, BackgroundTree>(".bg-tree-group")
            .data(bgTreesRef.current);
            
        const bgTreeEnter = bgTreeBind.enter().append("g").attr("class", "bg-tree-group");
        
        bgTreeEnter.each(function(d) {
             const g = d3.select(this);
             const rng = makeRng(d.seed);
             const h = 400 * d.scale;
             const w = 50 * d.scale;
             
             // Trunk
             const steps = 8;
             const left = [], right = [];
             for(let i=0; i<=steps; i++) {
                 const t = i/steps;
                 const cw = (w*0.3) + Math.pow(t,2)*(w - w*0.3);
                 const cy = -h + (t*h);
                 const n = (rng()-0.5)*(w*0.2);
                 left.push([-cw/2+n, cy]);
                 right.push([cw/2+n, cy]);
             }
             let path = `M${left[0][0]},${left[0][1]} `;
             for(let i=1; i<left.length; i++) path += `L${left[i][0]},${left[i][1]} `;
             path += `L${right[right.length-1][0]},${right[right.length-1][1]} `;
             for(let i=right.length-2; i>=0; i--) path += `L${right[i][0]},${right[i][1]} `;
             path += "Z";
             
             // Shadow
             g.append("path").attr("class", "bg-tree-shadow")
              .attr("d", path)
              .attr("fill", "black").attr("opacity", 0.3).attr("filter", "url(#nodeGlow)");

             // Trunk Body
             g.append("path").attr("d", path).attr("fill", "url(#trunk3D)").attr("filter", "url(#barkTexture)").attr("opacity", 0.9);
             
             // Crown Branches
             const bCount = 5;
             for(let k=0; k<bCount; k++) {
                 const angle = -Math.PI/2 + (rng()-0.5)*1.5;
                 const len = h * (0.2 + rng()*0.3);
                 const ex = Math.cos(angle)*len;
                 const ey = -h + Math.sin(angle)*len;
                 const sx = 0;
                 const sy = -h + 20;
                 
                 const cpx = (sx+ex)/2 + (rng()-0.5)*30;
                 const cpy = (sy+ey)/2 - (rng()*20);

                 g.append("path").attr("d", `M${sx},${sy} Q${cpx},${cpy} ${ex},${ey}`)
                  .attr("stroke", "#4E342E").attr("stroke-width", w*0.15).attr("fill", "none");
                 
                 // Leaves
                 g.append("circle").attr("cx", ex).attr("cy", ey).attr("r", 25*d.scale)
                  .attr("fill", "#4d7c0f").attr("opacity", 0.8).attr("filter", "url(#fluffyCloud)");
             }
        });
        
        const bgTreeMerge = bgTreeEnter.merge(bgTreeBind);
        
        // Dynamic Lighting via CSS filter
        // Trees silhouette at night
        const brightness = timeOfDay > 0.25 && timeOfDay < 0.75 ? 1 : 0.4;
        
        // Shadow Logic
        const skewAngle = Math.atan2(width / 2 - sunData.cx, height * 0.8) * (180 / Math.PI) * 2;

        bgTreeMerge.attr("transform", d => `translate(${d.x}, ${horizonY + 60})`)
                   .style("filter", `brightness(${brightness})`);
        
        bgTreeMerge.select(".bg-tree-shadow")
           .attr("transform", `scale(1, 0.3) skewX(${-skewAngle})`)
           .attr("transform-origin", "0px 0px"); // Trunk base is at 0,0 relative to group

    } else {
        bgLayer.attr("opacity", 0);
    }

    let shadowLayer = g.select<SVGGElement>(".shadow-layer");
    if (shadowLayer.empty()) shadowLayer = g.insert("g", ".links-layer").attr("class", "shadow-layer");

    let linkLayer = g.select<SVGGElement>(".links-layer");
    if (linkLayer.empty()) linkLayer = g.append("g").attr("class", "links-layer");
    
    let stemLayer = g.select<SVGGElement>(".stem-layer");
    if (stemLayer.empty()) stemLayer = g.insert("g", ".nodes-layer").attr("class", "stem-layer");

    let nodeLayer = g.select<SVGGElement>(".nodes-layer");
    if (nodeLayer.empty()) nodeLayer = g.append("g").attr("class", "nodes-layer");

    // --- 2. PREPARE DATA ---
    let processedNodes = [...data.nodes];
    const sideMap = assignSides(processedNodes, data.links);

    if (layoutMode === LayoutMode.SEED) {
        const level1 = processedNodes.filter(n => n.id !== 'root' && data.links.some(l => 
            ((typeof l.source === 'object' ? (l.source as Node).id : l.source) === 'root' && (typeof l.target === 'object' ? (l.target as Node).id : l.target) === n.id) ||
            ((typeof l.target === 'object' ? (l.target as Node).id : l.target) === 'root' && (typeof l.source === 'object' ? (l.source as Node).id : l.source) === n.id)
        ));
        level1.sort((a,b) => a.id.localeCompare(b.id));
        level1.forEach((n, i) => {
            const count = level1.length;
            const ratio = count > 1 ? i / (count - 1) : 0.5;
            n.trunkTier = 0.2 + (ratio * 0.55); 
        });
    }

    const nodes: Node[] = processedNodes.map(d => {
      const existing = nodesMapRef.current.get(d.id);
      const side = sideMap.get(d.id) || 1;
      
      if (layoutMode === LayoutMode.SEED && d.id === 'root') {
          const isSapling = data.nodes.length <= 1;
          const baseTrunkHeight = isSapling ? 150 : Math.min(850, 450 + (data.nodes.length * 15)); 
          const targetRootY = groundY - baseTrunkHeight; 
          if (existing) return { ...d, x: existing.x, y: existing.y, fx: width / 2, fy: targetRootY, vx: existing.vx, vy: existing.vy, val: d.val, side }
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
        const rootNode = nodes.find(n => n.id === 'root');
        const rootY = rootNode?.fy || (groundY - 400);
        const trunkHeight = groundY - rootY;

        simulation
            .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance((l, i) => {
                const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                const target = typeof l.target === 'object' ? l.target as Node : nodes.find(n => n.id === l.target);
                if (sourceId === 'root' && target && target.trunkTier !== undefined) {
                    const tier = target.trunkTier;
                    const minLength = 30;
                    const maxLength = 90;
                    return minLength + (tier * (maxLength - minLength)); 
                }
                return 100; 
            }).strength(0.8))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("collide", d3.forceCollide().radius(d => d.val * 2 + 25).strength(0.9))
            .force("y", d3.forceY<Node>(d => {
                if (d.id === 'root') return rootY;
                if (d.trunkTier !== undefined) return rootY + (trunkHeight * d.trunkTier);
                return rootY - 150; 
            }).strength(d => (d.id === 'root' ? 1 : d.trunkTier !== undefined ? 0.8 : 0.02)))
            .force("x", d3.forceX<Node>(d => {
                if (d.id === 'root') return width / 2;
                const side = (d as any).side || 1;
                const level = (d as any).level || 1;
                const spreadBase = 250;
                const spreadPerLevel = 150;
                return (width / 2) + (side * (spreadBase + (level * spreadPerLevel)));
            }).strength(d => (d.trunkTier !== undefined ? 0.3 : 0.15)));
    } else {
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
      .join(enter => enter.append("g").attr("class", "stem-group"), update => update, exit => exit.remove());
    
    // Ensure shadow parts exist in stem group
    stemGroup.each(function() {
        const g = d3.select(this);
        if(g.select(".tree-shadow").empty()) g.insert("path", ":first-child").attr("class", "tree-shadow").attr("fill", "black").attr("opacity", 0.4).attr("filter", "url(#nodeGlow)");
        if(g.select(".bark-core").empty()) g.append("path").attr("class", "bark-core").attr("fill", "url(#trunk3D)").attr("filter", "url(#cylinderLight)");
        if(g.select(".bark-texture").empty()) g.append("path").attr("class", "bark-texture").attr("fill", "url(#trunk3D)").attr("opacity", 0.6).attr("filter", "url(#barkTexture)");
    });

    const linkGroup = linkLayer.selectAll<SVGGElement, Link>(".link-group")
      .data(links, (d: any) => `${(d.source as Node).id || d.source}-${(d.target as Node).id || d.target}`)
      .join(enter => {
            const grp = enter.append("g").attr("class", "link-group");
            // Remove floating shadow path, only keep main branch
            grp.append("path").attr("class", "branch-main").attr("fill", "none").attr("stroke-linecap", "round").attr("filter", "url(#cylinderLight)");
            return grp;
        }, update => update, exit => exit.remove());

    const nodeGroup = nodeLayer.selectAll<SVGGElement, Node>(".node-group")
      .data(nodes, d => d.id)
      .join(
        enter => {
          const g = enter.append("g").attr("class", "node-group").attr("opacity", 0); 
          const expandBtn = g.append("g").attr("class", "expand-btn").attr("opacity", 0) 
            .attr("transform", d => `translate(${d.val + 12}, 0) scale(0)`).attr("cursor", "pointer")
            .on("click", (event, d) => { event.stopPropagation(); onNodeExpand(d); });
          
          const isPlus = (d: Node) => d.collapsed || !hasChildrenSet.has(d.id);
          expandBtn.append("circle").attr("r", 10).attr("class", "expand-circle").attr("fill", d => isPlus(d) ? "#22c55e" : "#ef4444").attr("stroke", "#ffffff").attr("stroke-width", 2);
          expandBtn.append("path").attr("d", d => isPlus(d) ? "M-4 0h8M0 -4v8" : "M-4 0h8").attr("class", "expand-icon").attr("stroke", "white").attr("stroke-width", 2);

          g.on("mouseenter", function(event, d) {
              d3.select(this).select(".expand-btn").transition().duration(200).attr("opacity", 1).attr("transform", `translate(${d.val + 12}, 0) scale(1)`);
          }).on("mouseleave", function(event, d) {
              d3.select(this).select(".expand-btn").transition().duration(200).attr("opacity", 0).attr("transform", `translate(${d.val + 12}, 0) scale(0)`);
          });

          g.append("text").text(d => d.name).attr("text-anchor", "middle").attr("fill", theme === AppTheme.CYBER ? "#e2e8f0" : "#334155").attr("stroke", theme === AppTheme.CYBER ? "#0f172a" : "#ffffff").attr("stroke-width", 3).attr("paint-order", "stroke").attr("stroke-linejoin", "round").style("font-size", "10px").style("pointer-events", "all").style("cursor", "pointer").style("font-weight", "600").on("click", (event, d) => { event.stopPropagation(); onNodeSelect(d); });

          g.transition().duration(500).attr("opacity", 1);
          return g;
        },
        update => {
           update.select("text").text(d => d.name).attr("fill", theme === AppTheme.CYBER ? "#e2e8f0" : "#334155").attr("stroke", theme === AppTheme.CYBER ? "#0f172a" : "#ffffff");
           const isPlus = (d: Node) => d.collapsed || !hasChildrenSet.has(d.id);
           update.select(".expand-circle").attr("fill", d => isPlus(d) ? "#22c55e" : "#ef4444");
           update.select(".expand-icon").attr("d", d => isPlus(d) ? "M-4 0h8M0 -4v8" : "M-4 0h8");
           
           update.each(function(d) {
             const group = d3.select(this);
             group.selectAll(".node-bg, .node-icon, .node-image").remove();
             const color = getNodeColor(d);
             const visualIconType = (d.id === 'root' && shouldShowTree) ? 'tree' : d.iconType;

             if (visualIconType === 'tree') {
                  group.insert("circle", "text").attr("class", "node-bg").attr("r", d.val * 1.5).attr("fill", "#ffffff").attr("stroke", "#22c55e").attr("stroke-width", 3).attr("filter", "url(#nodeGlow)").on("click", (event, d) => { event.stopPropagation(); onNodeSelect(d); });
                  const imgSize = d.val * 2.0;
                  group.insert("image", "text").attr("class", "node-image").attr("href", "https://lh3.googleusercontent.com/d/1LBUmOl-u3czx1hLf1NTgPrTnc9Gf1d1z").attr("width", imgSize).attr("height", imgSize).attr("x", -imgSize / 2).attr("y", -imgSize / 2).style("pointer-events", "none");
             } else if (visualIconType === 'leaf') {
                  group.insert("circle", "text").attr("class", "node-bg").attr("r", d.val).attr("fill", "#84cc16").attr("stroke", "#ffffff").attr("stroke-width", 2).attr("filter", "url(#nodeGlow)").attr("cursor", "pointer").on("click", (event, d) => { event.stopPropagation(); onNodeSelect(d); });
                  group.insert("path", "text").attr("class", "node-icon").attr("d", ICONS.leaf).attr("fill", "#ffffff").attr("transform", `translate(-${d.val * 0.6}, -${d.val * 0.6}) scale(${d.val / 20})`).style("pointer-events", "none");
             } else if (visualIconType === 'folder' || d.type === NodeType.PROJECT) {
                  const size = d.val * 2.5;
                  group.insert("rect", "text").attr("class", "node-bg").attr("width", size).attr("height", size).attr("x", -size / 2).attr("y", -size / 2).attr("rx", 6).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2).attr("filter", theme === AppTheme.CYBER ? "url(#nodeGlow)" : null).on("click", (event, d) => { event.stopPropagation(); onNodeSelect(d); });
                  const iconPath = ICONS.folder;
                  if (iconPath) group.insert("path", "text").attr("class", "node-icon").attr("d", iconPath).attr("fill", "#ffffff").attr("transform", `translate(-${d.val * 0.6}, -${d.val * 0.6}) scale(${d.val / 20})`).style("pointer-events", "none");
             } else if (visualIconType === 'seed') {
                 group.insert("path", "text").attr("class", "node-bg").attr("d", ICONS.seed).attr("transform", "translate(-12, -12) scale(1.2)").attr("fill", getNodeColor(d)).on("click", (event, d) => { event.stopPropagation(); onNodeSelect(d); });
             } else {
                  group.insert("circle", "text").attr("class", "node-bg").attr("r", d.val).attr("fill", color).attr("stroke", "#fff").attr("stroke-width", 2).attr("filter", theme === AppTheme.CYBER ? "url(#nodeGlow)" : null).on("click", (event, d) => { event.stopPropagation(); onNodeSelect(d); });
                  let type = d.iconType || 'default';
                  if (d.type === NodeType.DOCUMENT && type === 'default') type = 'file';
                  const iconPath = ICONS[type] || ICONS.default;
                  if (iconPath) group.insert("path", "text").attr("class", "node-icon").attr("d", iconPath).attr("fill", "#ffffff").attr("transform", `translate(-${d.val * 0.5}, -${d.val * 0.5}) scale(${d.val / 24})`).style("pointer-events", "none");
             }
             group.select(".node-bg, .node-image").on("contextmenu", (event, d) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ x: event.clientX, y: event.clientY, nodeId: (d as Node).id }); });
           });
           return update;
        },
        exit => exit.transition().duration(300).attr("opacity", 0).remove()
      );

    // --- 5. TICK & ANIMATION ---
    simulation.on("tick", () => {
       const time = Date.now() / 1000;
       
       // Correct Shadow Projection Logic
       const sunX = sunData.cx;
       // Vector from Sun X to Root X
       const lightDirX = width / 2 - sunX;
       
       // Calculate skew angle based on sun position relative to center
       // When sun is far left, shadow skewed right (positive angle)
       // Range: approx -60deg to 60deg
       const skewAngle = Math.atan2(lightDirX, height * 0.8) * (180 / Math.PI) * 2;
       
       // Calculate shadow length (scaleY)
       // Lower sun = longer shadow. 
       const shadowLength = Math.min(0.6, Math.max(0.1, Math.abs(lightDirX) / width));

       if (layoutMode === LayoutMode.SEED) {
          const rootNode = nodes.find(n => n.id === 'root');
          
          if (!rootNode || typeof rootNode.x !== 'number' || typeof rootNode.y !== 'number') return;

          const rootX = rootNode.x;
          const rootY = rootNode.y;
          const totalNodesCount = nodes.length;
          
          const trunkBaseWidth = Math.min(280, 80 + (totalNodesCount * 6));
          const trunkTopWidth = Math.max(20, trunkBaseWidth * 0.25);
          
          // --- TRUNK RENDERING ---
          stemGroup.each(function(d: any) {
             const grp = d3.select(this);
             const visualIconType = (d.id === 'root' && shouldShowTree) ? 'tree' : d.iconType;

             if (visualIconType === 'seed') {
                 grp.attr("opacity", 0);
                 return;
             }
             grp.attr("opacity", 1);
             
             // "Breathing" tree effect
             const breathe = Math.sin(time) * 2;

             const steps = 20; 
             const leftPath: [number, number][] = [];
             const rightPath: [number, number][] = [];
             
             for(let i=0; i<=steps; i++) {
                 const t = i/steps; 
                 const widthT = t * t * t; 
                 const currentWidth = (trunkTopWidth + widthT * (trunkBaseWidth - trunkTopWidth)) + (breathe * (1-t));
                 const currentY = rootY + (t * (groundY - rootY));
                 const noise = Math.sin(i * 1.5) * (trunkBaseWidth * 0.03); 
                 
                 if (isNaN(currentY) || isNaN(rootX)) continue;
                 leftPath.push([rootX - (currentWidth/2) + noise, currentY]);
                 rightPath.push([rootX + (currentWidth/2) + noise, currentY]);
             }
             
             if (leftPath.length < 2) return;

             let dString = `M${leftPath[0][0]},${leftPath[0][1]} `; 
             for(let i=1; i<leftPath.length; i++) dString += `L${leftPath[i][0]},${leftPath[i][1]} `;
             dString += `L${rightPath[rightPath.length-1][0]},${rightPath[rightPath.length-1][1]} `;
             for(let i=rightPath.length-2; i>=0; i--) dString += `L${rightPath[i][0]},${rightPath[i][1]} `;
             dString += "Z";

             grp.select(".bark-core").attr("d", dString);
             grp.select(".bark-texture").attr("d", dString);
             
             // Correct Projected Shadow
             // Instead of manually skewing points, we apply a transform to the shadow path to project it on ground.
             // Anchor point is the bottom center of the trunk.
             const anchorX = rootX;
             const anchorY = groundY;
             
             grp.select(".tree-shadow")
                .attr("d", dString)
                .attr("transform-origin", `${anchorX}px ${anchorY}px`)
                .attr("transform", `scale(1, 0.3) skewX(${-skewAngle})`);

             // --- Top Crown / False Tip Branches ---
             const growthProgress = Math.min(1, Math.max(0, (nodes.length - 1) / 10));

             const topBranchesData: any[] = [];
             const topSubBranchesData: any[] = [];
             const topLeavesData: any[] = [];
             
             const topSeed = getHash(d.id + 'crown_v2');
             const topRng = makeRng(topSeed);
             
             const baseBranchCount = 3; 
             const extraBranches = Math.floor(growthProgress * 2);
             const totalTopBranches = baseBranchCount + extraBranches;
             
             const maxBranchLen = 80 + (growthProgress * 70); 
             const fanSpread = Math.PI * 0.8; 
             const startAngle = (-Math.PI / 2) - (fanSpread / 2);
             
             for(let i=0; i<totalTopBranches; i++) {
                 const progress = totalTopBranches > 1 ? i / (totalTopBranches - 1) : 0.5;
                 const angleNoise = (topRng() - 0.5) * 0.1; 
                 const angle = startAngle + (progress * fanSpread) + angleNoise;
                 const isLeft = angle < -Math.PI/2;
                 
                 const xOriginOffset = (progress - 0.5) * trunkTopWidth * 0.8;
                 const startX = rootX + xOriginOffset;
                 const startY = rootY + (Math.abs(progress - 0.5) * 5); 
                 
                 const len = maxBranchLen * (0.8 + (topRng() * 0.4));
                 const endX = startX + Math.cos(angle) * len;
                 const endY = startY + Math.sin(angle) * len;
                 
                 const cpDist = len * 0.5;
                 const bendAngle = angle + (isLeft ? -0.15 : 0.15); 
                 const cpX = startX + Math.cos(bendAngle) * cpDist;
                 const cpY = startY + Math.sin(bendAngle) * cpDist;
                 
                 const width = Math.max(3, (9 + (growthProgress * 4)));
                 
                 topBranchesData.push({
                    d: `M${startX},${startY} Q${cpX},${cpY} ${endX},${endY}`,
                    width,
                    color: "#5D4037"
                 });
                 
                 // Sub-branches
                 const subCount = 1 + (topRng() > 0.5 ? 1 : 0);
                 for(let j=0; j<subCount; j++) {
                     const tVal = 0.5 + (j * 0.25); 
                     const p = getPointOnQuadratic(tVal, {x:startX, y:startY}, {x:cpX, y:cpY}, {x:endX, y:endY});
                     const pNext = getPointOnQuadratic(tVal+0.05, {x:startX, y:startY}, {x:cpX, y:cpY}, {x:endX, y:endY});
                     const dx = pNext.x - p.x;
                     const dy = pNext.y - p.y;
                     const tanAngle = Math.atan2(dy, dx);
                     
                     const side = (j % 2 === 0) ? 1 : -1;
                     const finalSide = isLeft ? (side * -1) : side;
                     const subAngle = tanAngle + (finalSide * Math.PI / 4); 
                     const subLen = len * 0.3;
                     const subEndX = p.x + Math.cos(subAngle) * subLen;
                     const subEndY = p.y + Math.sin(subAngle) * subLen;
                     const subCpX = (p.x + subEndX) / 2;
                     const subCpY = (p.y + subEndY) / 2;

                     topSubBranchesData.push({
                         d: `M${p.x},${p.y} Q${subCpX},${subCpY} ${subEndX},${subEndY}`,
                         width: width * 0.5
                     });
                     
                     topLeavesData.push({
                         x: subEndX,
                         y: subEndY,
                         rotation: (subAngle * 180 / Math.PI) + 90,
                         scale: 0.7 + (growthProgress * 0.3)
                     });
                 }
                 
                 topLeavesData.push({
                     x: endX,
                     y: endY,
                     rotation: (angle * 180 / Math.PI) + 90,
                     scale: 1.0 + (growthProgress * 0.4)
                 });
             }

             // Rendering Top Crown
             grp.selectAll(".top-crown-branch")
                .data(topBranchesData)
                .join(
                    enter => enter.append("path").attr("class", "top-crown-branch").attr("fill", "none").attr("stroke", "#5D4037").attr("stroke-linecap", "round").attr("filter", "url(#cylinderLight)"),
                    update => update,
                    exit => exit.remove()
                )
                .attr("d", (b: any) => b.d)
                .attr("stroke-width", (b: any) => b.width);

             grp.selectAll(".top-crown-sub")
                .data(topSubBranchesData)
                .join(
                    enter => enter.append("path").attr("class", "top-crown-sub").attr("fill", "none").attr("stroke", "#5D4037").attr("stroke-linecap", "round").attr("filter", "url(#cylinderLight)"),
                    update => update,
                    exit => exit.remove()
                )
                .attr("d", (b: any) => b.d)
                .attr("stroke-width", (b: any) => b.width);

             grp.selectAll(".top-crown-leaf")
                .data(topLeavesData)
                .join(
                    enter => enter.append("path").attr("class", "top-crown-leaf").attr("d", ICONS.leaf).attr("fill", "#65a30d").attr("stroke", "#365314").attr("stroke-width", 0.5),
                    update => update,
                    exit => exit.remove()
                )
                .attr("transform", (l: any) => `translate(${l.x},${l.y}) rotate(${l.rotation}) scale(${l.scale})`);

             // --- Trunk Twigs (False branches on trunk body) ---
             const trunkHeight = groundY - rootY;
             const rng = makeRng(getHash(d.id));
             
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
                    enter => enter.append("path").attr("class", "false-branch-trunk").attr("fill", "none").attr("stroke", "#5D4037").attr("stroke-linecap", "round").attr("filter", "url(#cylinderLight)"),
                    update => update,
                    exit => exit.remove()
                )
                .attr("d", b => b.d)
                .attr("stroke-width", b => b.width);
          });

          // --- BRANCH RENDERING ---
          linkGroup.each(function(d: any) {
             const group = d3.select(this);
             const s = d.source as Node;
             const t = d.target as Node;
             if (!s.x || !s.y || !t.x || !t.y) return;

             let sourceX = s.x;
             let sourceY = s.y;
             const isSustaining = s.id === 'root';
             let currentTrunkWidth = 20;

             if (isSustaining) {
                 sourceY = Math.max(rootY, Math.min(groundY, t.y));
                 const tProgress = (sourceY - rootY) / (groundY - rootY);
                 const widthT = tProgress * tProgress * tProgress;
                 currentTrunkWidth = trunkTopWidth + widthT * (trunkBaseWidth - trunkTopWidth);
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
                  const weightThickness = Math.min(20, (childWeight - 1) * 2);
                  const baseThickness = Math.max(2, 6 - (level * 0.5));
                  strokeWidth = baseThickness + weightThickness;
             }

             group.select(".branch-main")
                .attr("d", pathData.d)
                .attr("stroke", "#5D4037") 
                .attr("stroke-width", strokeWidth)
                .attr("opacity", 1);
             
             // Removed floating branch shadow for cleaner look
             // as branch shadows on ground are hard to calculate correctly in 2D without looking detached
             // group.select(".branch-shadow")...

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
                 group.append("path").attr("class", "procedural-twig").attr("d", twig.d).attr("stroke", "#4E342E").attr("stroke-width", twig.width).attr("fill", "none").attr("stroke-linecap", "round");
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
                 
                 // --- WIND ANIMATION ---
                 // Use time and x/y position to create wave-like wind effect
                 const windSway = Math.sin(time * 2 + (lx * 0.01)) * 15;
                 const randWiggle = (rng() * 40 - 20);
                 const rotationAngle = (Math.atan2(ny * sideMult, nx * sideMult) * 180 / Math.PI) + randWiggle + windSway;
                 
                 const positionScale = 1.6 - (tVal * 0.7); 
                 const levelScale = Math.max(0.4, 1.0 - ((level-1) * 0.15)); 
                 const scale = positionScale * levelScale * (0.8 + rng() * 0.4);
                 leafData.push({ x: lx, y: ly, rotation: rotationAngle, scale });
             }

             leafData.forEach(l => {
                group.append("path").attr("class", "procedural-leaf").attr("d", ICONS.leaf).attr("fill", "#65a30d").attr("stroke", "#365314").attr("stroke-width", 0.5).attr("transform", `translate(${l.x},${l.y}) rotate(${l.rotation}) scale(${l.scale})`).style("pointer-events", "none");
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
              group.select(".branch-main").attr("d", dPath).attr("stroke", theme === AppTheme.CYBER ? "#475569" : "#94a3b8").attr("stroke-width", Math.min(4, Math.max(1, 5 - (t.level || 0)))).attr("opacity", 0.6);
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

  }, [data, dimensions, theme, linkStyle, onNodeExpand, onNodeSelect, themeColors, nodeWeights, layoutMode, shouldShowTree, sunData]); // Added sunData as dependency for background updates

  const handleFoldBranch = () => {
    if (contextMenu.nodeId) {
        const node = data.nodes.find(n => n.id === contextMenu.nodeId);
        if (node) {
            onUpdateNode(node.id, { collapsed: !node.collapsed });
        }
    }
    setContextMenu({ x: 0, y: 0, nodeId: null });
  };

  const handleFoldParent = () => {
    if (contextMenu.nodeId && contextMenu.nodeId !== 'root') {
        const parentLink = data.links.find(l => {
            const t = typeof l.target === 'object' ? (l.target as Node).id : l.target as string;
            return t === contextMenu.nodeId;
        });

        if (parentLink) {
            const s = typeof parentLink.source === 'object' ? (parentLink.source as Node).id : parentLink.source as string;
            onUpdateNode(s, { collapsed: true });
        }
    }
    setContextMenu({ x: 0, y: 0, nodeId: null });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-transparent">
      <svg ref={svgRef} width="100%" height="100%" className="block outline-none" style={{ cursor: 'grab' }}>
      </svg>
      
      {/* Time Control UI */}
      {layoutMode === LayoutMode.SEED && (
          <div className="absolute top-4 right-20 flex flex-col items-end gap-2">
            <div className="bg-black/40 backdrop-blur-md p-2 rounded-xl text-white flex items-center gap-2 shadow-xl border border-white/10">
                <button onClick={() => handleTimeChange(0.1)} title="Sunrise" className={`p-1.5 hover:bg-white/20 rounded-lg transition-colors ${timeOfDay >= 0 && timeOfDay < 0.25 ? 'bg-white/20 ring-1 ring-orange-400' : ''}`}>
                    <CloudSun size={18} className="text-orange-400" />
                </button>
                <button onClick={() => handleTimeChange(0.35)} title="Day" className={`p-1.5 hover:bg-white/20 rounded-lg transition-colors ${timeOfDay >= 0.25 && timeOfDay < 0.6 ? 'bg-white/20 ring-1 ring-yellow-400' : ''}`}>
                    <Sun size={18} className="text-yellow-400" />
                </button>
                <button onClick={() => handleTimeChange(0.65)} title="Sunset" className={`p-1.5 hover:bg-white/20 rounded-lg transition-colors ${timeOfDay >= 0.6 && timeOfDay < 0.8 ? 'bg-white/20 ring-1 ring-pink-500' : ''}`}>
                    <Sunset size={18} className="text-pink-500" />
                </button>
                <button onClick={() => handleTimeChange(0.9)} title="Night" className={`p-1.5 hover:bg-white/20 rounded-lg transition-colors ${timeOfDay >= 0.8 || timeOfDay < 0.1 ? 'bg-white/20 ring-1 ring-indigo-400' : ''}`}>
                    <Moon size={18} className="text-indigo-300" />
                </button>
                
                <div className="w-px h-6 bg-white/20 mx-1"></div>
                
                <button onClick={() => setIsPaused(!isPaused)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors w-20 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                    {isPaused ? <><Play size={12} fill="currentColor" /> Play</> : <><Pause size={12} fill="currentColor" /> Pause</>}
                </button>
            </div>
            
            {/* Time Progress Bar */}
            <div className="w-full h-1.5 bg-black/40 backdrop-blur-sm rounded-full overflow-hidden border border-white/5">
                 <div 
                    className="h-full bg-gradient-to-r from-orange-400 via-yellow-400 to-indigo-500 transition-all duration-300 ease-linear" 
                    style={{ width: `${timeOfDay * 100}%` }}
                 ></div>
            </div>
          </div>
      )}

      {/* Legend */}
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
          <span className="text-xs">Expand / Add Branch</span>
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
              
              <button onClick={handleFoldBranch} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 flex items-center gap-3">
                  {data.nodes.find(n => n.id === contextMenu.nodeId)?.collapsed ? 
                      <><Eye size={16} className="text-green-500" /> Expand Branch</> : 
                      <><EyeOff size={16} className="text-red-500" /> Fold Branch</>
                  }
              </button>
              
              {contextMenu.nodeId !== 'root' && (
                  <button onClick={handleFoldParent} className="w-full text-left px-4 py-3 text-sm font-medium hover:bg-black/5 flex items-center gap-3">
                      <ArrowUp size={16} className="text-slate-500" /> Fold Parent
                  </button>
              )}
          </div>
      )}
    </div>
  );
};

export default MindMap;