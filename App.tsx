import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Upload, Share2, Grid, Folder, FileText, Settings, X, Plus, BarChart2, Moon, Sun, Network, Sprout, Minus, Flower2, ArrowRight, Edit3, MapPin, FolderOpen, Video, Image as ImageIcon, ChevronRight, ChevronDown, Eye, EyeOff, Music, Table, FolderPlus, FilePlus } from 'lucide-react';
import MindMap from './components/MindMap';
import Stats from './components/Stats';
import { searchAndGenerateGraph, getDocumentSummary } from './services/geminiService';
import { MOCK_DOCUMENTS, INITIAL_GRAPH_DATA, THEMES } from './constants';
import { GraphData, Node, Document, AppTheme, NodeType, LinkStyle, NodeIconType, LayoutMode } from './types';

// Palette for dynamic node coloring
const NODE_COLORS = [
  '#f43f5e', // Rose
  '#d946ef', // Fuchsia
  '#8b5cf6', // Violet
  '#6366f1', // Indigo
  '#0ea5e9', // Sky
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#f97316', // Orange
];

type TabType = 'all' | 'video' | 'photo' | 'doc' | 'audio' | 'data';

function App() {
  const [query, setQuery] = useState('');
  
  // Master Graph Data (contains everything, even hidden nodes)
  const [masterGraphData, setMasterGraphData] = useState<GraphData>(INITIAL_GRAPH_DATA);
  
  const [documents, setDocuments] = useState<Document[]>(MOCK_DOCUMENTS);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedDocSummary, setSelectedDocSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentView, setCurrentView] = useState<'map' | 'stats' | 'projects'>('map');
  const [theme, setTheme] = useState<AppTheme>(AppTheme.DEFAULT);
  const [linkStyle, setLinkStyle] = useState<LinkStyle>(LinkStyle.ROOT);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(LayoutMode.SPIDER);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<TabType>('all');
  
  // New State for Landing Page
  const [isLanding, setIsLanding] = useState(true);

  const themeConfig = THEMES[theme];
  const isDarkMode = theme === AppTheme.CYBER || theme === AppTheme.MINIMAL;

  // Refs for uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Compute Visible Graph based on 'collapsed' state (The Blossom Feature)
  const visibleGraphData = useMemo(() => {
      const visibleNodeIds = new Set<string>();
      const queue = ['root'];
      
      // BFS Traversal to find all visible nodes
      while(queue.length > 0) {
          const currentId = queue.shift()!;
          visibleNodeIds.add(currentId);

          const currentNode = masterGraphData.nodes.find(n => n.id === currentId);
          // If node exists and is NOT collapsed (Blossomed), add children to queue
          if (currentNode && !currentNode.collapsed) {
              const childrenLinks = masterGraphData.links.filter(l => {
                  const s = typeof l.source === 'object' ? l.source.id : l.source;
                  return s === currentId;
              });
              
              childrenLinks.forEach(l => {
                  const t = typeof l.target === 'object' ? l.target.id : l.target;
                  if (!visibleNodeIds.has(t as string)) {
                      queue.push(t as string);
                  }
              });
          }
      }

      const nodes = masterGraphData.nodes.filter(n => visibleNodeIds.has(n.id));
      const links = masterGraphData.links.filter(l => {
          const s = typeof l.source === 'object' ? l.source.id : l.source;
          const t = typeof l.target === 'object' ? l.target.id : l.target;
          return visibleNodeIds.has(s as string) && visibleNodeIds.has(t as string);
      });

      return { nodes, links };

  }, [masterGraphData]);

  // Reset root node appearance when switching modes or starting fresh
  useEffect(() => {
    setMasterGraphData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => {
        if (n.id === 'root') {
          const isSeed = layoutMode === LayoutMode.SEED;
          return {
            ...n,
            iconType: isSeed ? 'tree' : 'default',
            color: isSeed ? '#22c55e' : undefined,
            val: isSeed ? 30 : 25,
            fx: null, 
            fy: null,
            collapsed: false // Always expanded initially
          };
        }
        return n;
      })
    }));
  }, [layoutMode]);

  const handleStartProject = (mode: LayoutMode) => {
      setLayoutMode(mode);
      setIsLanding(false);
      
      const startNodeName = mode === LayoutMode.SEED ? "Grow your idea starting here" : "MindSearch AI";
      const startIcon: NodeIconType = mode === LayoutMode.SEED ? 'tree' : 'default';
      const startColor = mode === LayoutMode.SEED ? '#22c55e' : undefined;
      
      setMasterGraphData({
        nodes: [
            { id: 'root', name: startNodeName, type: NodeType.ROOT, val: mode === LayoutMode.SEED ? 5 : 20, iconType: startIcon, color: startColor, description: 'Start searching to expand.', collapsed: false }
        ],
        links: []
      });
      setQuery('');
  };

  const handleGoHome = () => {
      setIsLanding(true);
      setCurrentView('map');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    
    try {
      const result = await searchAndGenerateGraph(query, documents);
      
      const rootName = (masterGraphData.nodes.length === 1 && layoutMode === LayoutMode.SEED && masterGraphData.nodes[0].name.includes("Grow")) 
        ? query 
        : (masterGraphData.nodes.find(n => n.id === 'root')?.name || query);

      const rootNode: Node = {
        id: 'root',
        name: rootName,
        type: NodeType.ROOT,
        val: layoutMode === LayoutMode.SEED ? 30 : 25,
        description: 'Search Query',
        color: layoutMode === LayoutMode.SEED ? '#22c55e' : '#ef4444',
        iconType: layoutMode === LayoutMode.SEED ? 'tree' : 'default',
        level: 0,
        collapsed: false
      };

      const newData: GraphData = {
        nodes: [rootNode, ...result.nodes.filter(n => n.id !== 'root').map((n, i) => ({
            ...n,
            color: n.type === NodeType.PROJECT ? '#f59e0b' : NODE_COLORS[i % NODE_COLORS.length],
            iconType: (n.type === NodeType.PROJECT ? 'folder' : 'file') as NodeIconType,
            level: 1,
            project: n.type === NodeType.PROJECT ? n.name : 'General',
            collapsed: true // New search results start collapsed ("buds")
        }))],
        links: result.links.map(l => ({
           source: typeof l.source === 'string' && l.source !== 'root' ? l.source : 'root',
           target: l.target,
           value: l.value
        }))
      };
      
      const nodeIds = new Set(newData.nodes.map(n => n.id));
      newData.links = newData.links.filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string));

      setMasterGraphData(newData);
      setCurrentView('map');
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNodeUpdate = (nodeId: string, updates: Partial<Node>) => {
    setMasterGraphData(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n)
    }));
    if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode(prev => prev ? ({...prev, ...updates}) : null);
    }
  };

  // Toggle visibility of children (The Blossom Feature)
  const toggleNodeBlossom = (node: Node) => {
      handleNodeUpdate(node.id, { collapsed: !node.collapsed });
  };

  const expandNode = (parentNode: Node) => {
    if (parentNode.collapsed) {
        handleNodeUpdate(parentNode.id, { collapsed: false });
        return;
    }

    const existingChildrenCount = masterGraphData.links.filter(l => 
        (typeof l.source === 'string' ? l.source : l.source.id) === parentNode.id
    ).length;

    let newBiasX = 0;
    let newBiasY = 0;
    const currentLevel = parentNode.level || 0;

    let newNodeIcon: NodeIconType = 'default';
    let newNodeColor = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)];

    if (layoutMode === LayoutMode.SEED) {
        const verticalStep = -120; 
        const spreadFactor = (existingChildrenCount % 2 === 0 ? 1 : -1) * Math.ceil(existingChildrenCount / 2);
        newBiasX = (parentNode.biasX || 0) + (spreadFactor * 60) + (Math.random() * 40 - 20);
        newBiasY = (parentNode.biasY || 0) + verticalStep + (Math.random() * 40 - 20);
        newNodeIcon = 'leaf';
        newNodeColor = '#84cc16'; 
    } else {
        const types: {title: string, icon: NodeIconType}[] = [
            { title: "Sub-Project", icon: 'folder' },
            { title: "Document", icon: 'file' }
        ];
        const randomType = types[Math.floor(Math.random() * types.length)];
        newNodeIcon = randomType.icon;

        if (parentNode.id === 'root') {
            const baseDistance = 280;
            const angle = existingChildrenCount * (Math.PI / 2);
            const lap = Math.floor(existingChildrenCount / 4);
            const distance = baseDistance + (lap * 120);
            newBiasX = Math.cos(angle) * distance;
            newBiasY = Math.sin(angle) * distance;
        } else {
            const expansionDistance = 180;
            const baseAngle = (parentNode.biasX && parentNode.biasY) ? Math.atan2(parentNode.biasY, parentNode.biasX) : Math.random() * 2 * Math.PI;
            const spreadStep = 0.5; 
            const spread = Math.ceil(existingChildrenCount / 2) * spreadStep * (existingChildrenCount % 2 === 0 ? 1 : -1);
            const finalAngle = baseAngle + spread;
            newBiasX = (parentNode.biasX || 0) + Math.cos(finalAngle) * expansionDistance;
            newBiasY = (parentNode.biasY || 0) + Math.sin(finalAngle) * expansionDistance;
        }
    }

    const newNodeId = `node-${Date.now()}-${Math.floor(Math.random()*1000)}`;

    const newNode: Node = {
        id: newNodeId,
        name: layoutMode === LayoutMode.SEED ? `Branch ${masterGraphData.nodes.length}` : `New Item ${masterGraphData.nodes.length}`,
        type: NodeType.CATEGORY,
        val: 14,
        description: `Expanded node from ${parentNode.name}`,
        biasX: newBiasX,
        biasY: newBiasY,
        color: newNodeColor,
        iconType: newNodeIcon,
        level: currentLevel + 1,
        project: parentNode.project || 'Unassigned',
        collapsed: false
    };

    const newLink = {
        source: parentNode.id,
        target: newNodeId,
        value: 2
    };

    setMasterGraphData(prev => ({
        nodes: [...prev.nodes, newNode],
        links: [...prev.links, newLink]
    }));
  };

  const handleNodeExpandInteraction = (node: Node) => {
     const hasChildren = masterGraphData.links.some(l => (typeof l.source === 'string' ? l.source : l.source.id) === node.id);
     
     if (hasChildren) {
         toggleNodeBlossom(node);
     } else {
         expandNode(node);
     }
  };

  const handleNodeSelect = async (node: Node) => {
    setSelectedNode(node);
    
    if (node.type === NodeType.DOCUMENT) {
      const doc = documents.find(d => d.id === node.id);
      if (doc) {
        setSelectedDocSummary("Loading summary...");
        const summary = await getDocumentSummary(doc);
        setSelectedDocSummary(summary);
      } else {
        setSelectedDocSummary("This is a generated node for demonstration.");
      }
    } else {
        setSelectedDocSummary(node.description || "No description available.");
    }
  };

  // --- RECURSIVE FOLDER UPLOAD LOGIC (REFINED - SMART GROUPING) ---
  const processFileList = (fileList: FileList, parentNode: Node) => {
      const filesArray = Array.from(fileList);
      
      const newNodes: Node[] = [];
      const newLinks: any[] = [];
      const newDocs: Document[] = [];
      
      // Categorization Buckets
      const buckets: Record<string, { name: string, icon: NodeIconType, color: string, files: File[] }> = {
          'video': { name: 'Videos', icon: 'video', color: '#8b5cf6', files: [] },
          'image': { name: 'Images', icon: 'image', color: '#0ea5e9', files: [] },
          'audio': { name: 'Music', icon: 'music', color: '#ec4899', files: [] },
          'data':  { name: 'Data', icon: 'spreadsheet', color: '#10b981', files: [] },
          'doc':   { name: 'Documents', icon: 'file', color: '#f59e0b', files: [] }
      };

      filesArray.forEach(file => {
          // Filter system files / hidden files / settings
          // This ensures we don't go "deep into settings" or link unwanted OS files
          if (file.name.startsWith('.') || file.name.startsWith('__') || file.name === 'Thumbs.db' || file.name === 'desktop.ini') return;
          
          const type = file.type;
          const name = file.name.toLowerCase();
          
          if (type.startsWith('video') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi')) {
              buckets['video'].files.push(file);
          } else if (type.startsWith('image') || name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.webp')) {
              buckets['image'].files.push(file);
          } else if (type.startsWith('audio') || name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg')) {
              buckets['audio'].files.push(file);
          } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || name.endsWith('.json')) {
              buckets['data'].files.push(file);
          } else {
              // Default to Doc
              buckets['doc'].files.push(file);
          }
      });

      // Find existing Category children of parent to avoid duplicates
      // We look at masterGraphData.links to find children, then match names/types
      const existingChildrenLinks = masterGraphData.links.filter(l => (typeof l.source === 'string' ? l.source : l.source.id) === parentNode.id);
      const existingChildrenIds = new Set(existingChildrenLinks.map(l => (typeof l.target === 'string' ? l.target : l.target.id)));
      const existingChildren = masterGraphData.nodes.filter(n => existingChildrenIds.has(n.id));

      Object.keys(buckets).forEach(key => {
          const bucket = buckets[key];
          if (bucket.files.length === 0) return;

          // Check if category node exists
          let categoryNode = existingChildren.find(n => n.name === bucket.name && n.type === NodeType.CATEGORY);
          
          if (!categoryNode) {
              // Create Category Node
              const catId = `cat-${key}-${Date.now()}-${Math.random()}`;
              categoryNode = {
                  id: catId,
                  name: bucket.name,
                  type: NodeType.CATEGORY,
                  val: 16,
                  description: `Collection of ${bucket.name}`,
                  iconType: bucket.icon, // Use the specific icon for the category folder
                  color: bucket.color,
                  level: (parentNode.level || 0) + 1,
                  project: parentNode.project,
                  collapsed: false, // Blossom open
                  x: parentNode.x ? parentNode.x + (Math.random() * 100 - 50) : undefined,
                  y: parentNode.y ? parentNode.y + (Math.random() * 100 - 50) : undefined
              };
              newNodes.push(categoryNode);
              newLinks.push({ source: parentNode.id, target: catId, value: 3 });
          }

          // Add Files to Category Node
          bucket.files.forEach(file => {
             const fileId = `file-${Date.now()}-${Math.random()}`;
             
             // Determine specific doc type for metadata
             let docType = 'txt';
             const n = file.name.toLowerCase();
             if (n.endsWith('pdf')) docType = 'pdf';
             else if (n.endsWith('docx')) docType = 'docx';
             else if (n.endsWith('xlsx')) docType = 'xlsx';
             else if (n.endsWith('mp3')) docType = 'mp3';
             else if (n.endsWith('mp4')) docType = 'mp4';
             
             const newDoc: Document = {
                  id: fileId,
                  title: file.name,
                  content: "Uploaded content pending analysis...",
                  project: parentNode.project || 'Repository',
                  date: new Date().toISOString().split('T')[0],
                  type: docType as any,
                  tags: ['upload', key]
             };
             newDocs.push(newDoc);

             const fileNode: Node = {
                  id: fileId,
                  name: file.name,
                  type: NodeType.DOCUMENT,
                  val: 10,
                  description: `${bucket.name} file`,
                  iconType: bucket.icon, // Inherit icon from bucket type
                  level: (categoryNode!.level || 0) + 1,
                  project: parentNode.project,
                  collapsed: false
             };
             newNodes.push(fileNode);
             newLinks.push({ source: categoryNode!.id, target: fileId, value: 1 }); // Weaker link for leaves
          });
      });

      setDocuments(prev => [...prev, ...newDocs]);
      
      setMasterGraphData(prev => ({
          nodes: prev.nodes.map(n => n.id === parentNode.id ? { ...n, collapsed: false } : n).concat(newNodes),
          links: [...prev.links, ...newLinks]
      }));
  };

  const handleFileUploadToNode = (e: React.ChangeEvent<HTMLInputElement>, parentNode: Node) => {
    if (e.target.files && e.target.files.length > 0) {
        if (e.target.webkitdirectory) {
            // Folder Upload
            processFileList(e.target.files, parentNode);
        } else {
            // Single File Upload (Reuse logic but simplified)
            processFileList(e.target.files, parentNode);
        }
    }
  };

  // Helper to get children for sidebar list
  const getSelectedNodeChildren = () => {
      if (!selectedNode) return [];
      const childLinks = masterGraphData.links.filter(l => (typeof l.source === 'string' ? l.source : l.source.id) === selectedNode.id);
      const childIds = new Set(childLinks.map(l => (typeof l.target === 'string' ? l.target : l.target.id)));
      return masterGraphData.nodes.filter(n => childIds.has(n.id));
  };

  const filteredChildren = getSelectedNodeChildren().filter(child => {
      if (sidebarTab === 'all') return true;
      if (sidebarTab === 'video') return child.iconType === 'video';
      if (sidebarTab === 'photo') return child.iconType === 'image';
      if (sidebarTab === 'doc') return child.iconType === 'file' || child.iconType === 'default';
      if (sidebarTab === 'audio') return child.iconType === 'music';
      if (sidebarTab === 'data') return child.iconType === 'spreadsheet';
      return true;
  });

  // --- RENDER LANDING PAGE ---
  if (isLanding) {
    return (
        <div className={`min-h-screen flex flex-col items-center justify-center p-8 transition-colors duration-500 ${themeConfig.bg} ${themeConfig.text}`}>
            <div className="max-w-4xl w-full text-center space-y-12">
                <div className="space-y-4">
                     <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-white shadow-2xl ${themeConfig.accent}`}>
                        <Network size={48} />
                    </div>
                    <h1 className="text-5xl font-extrabold tracking-tight">MindSearch AI</h1>
                    <p className="text-xl opacity-60 max-w-2xl mx-auto">
                        Your intelligent documentation assistant. Choose your preferred visualization architecture to begin your search journey.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                    {/* SPIDER OPTION */}
                    <button 
                        onClick={() => handleStartProject(LayoutMode.SPIDER)}
                        className={`group relative overflow-hidden p-8 rounded-3xl border-2 text-left transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-cyan-500' : 'bg-white border-slate-200 hover:border-blue-500'}`}
                    >
                        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
                            <Network size={120} />
                        </div>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-slate-700 group-hover:bg-cyan-900 text-cyan-400' : 'bg-blue-50 group-hover:bg-blue-100 text-blue-600'}`}>
                             <Grid size={32} />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Spatial Spider</h3>
                        <p className="opacity-60 mb-6 min-h-[3rem]">
                            A classic, radial mind map interface. Nodes expand outward in all directions, perfect for exploring interconnected concepts in a web-like structure.
                        </p>
                        <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider">
                            Select Mode <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    {/* SEED OPTION */}
                    <button 
                        onClick={() => handleStartProject(LayoutMode.SEED)}
                        className={`group relative overflow-hidden p-8 rounded-3xl border-2 text-left transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${isDarkMode ? 'bg-slate-800 border-slate-700 hover:border-emerald-500' : 'bg-white border-slate-200 hover:border-green-500'}`}
                    >
                        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
                            <Sprout size={120} />
                        </div>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-colors ${isDarkMode ? 'bg-slate-700 group-hover:bg-emerald-900 text-emerald-400' : 'bg-green-50 group-hover:bg-green-100 text-green-600'}`}>
                             <Flower2 size={32} />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Planting Seed</h3>
                        <p className="opacity-60 mb-6 min-h-[3rem]">
                            An organic, growth-based interface. Ideas start as a seed in the ground and grow upwards like a tree against a sky backdrop.
                        </p>
                        <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wider">
                            Select Mode <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>
                </div>
                
                {/* Theme Toggle on Landing */}
                 <div className="absolute top-6 right-6">
                    <button className={`p-3 rounded-full shadow-lg backdrop-blur-sm border transition-transform hover:scale-110 ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-200'}`} onClick={() => setTheme(prev => prev === AppTheme.CYBER ? AppTheme.DEFAULT : AppTheme.CYBER)}>
                        {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
                    </button>
                 </div>
            </div>
        </div>
    );
  }

  // --- RENDER MAIN APP ---
  return (
    <div className={`flex h-screen w-full transition-colors duration-300 ${themeConfig.bg} ${themeConfig.text}`}>
      
      {/* Sidebar */}
      <aside className={`w-20 md:w-64 flex-shrink-0 flex flex-col border-r transition-colors duration-300 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/50'}`}>
        <div 
            onClick={handleGoHome}
            className="p-4 flex items-center justify-center md:justify-start gap-3 border-b border-transparent cursor-pointer hover:opacity-80 transition-opacity"
            title="Return to Home"
        >
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${themeConfig.accent}`}>
             {layoutMode === LayoutMode.SEED ? <Flower2 size={20} /> : <Network size={20} />}
           </div>
           <span className="hidden md:block font-bold text-lg tracking-tight">MindSearch</span>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-2 px-3">
          <button 
            onClick={() => setCurrentView('map')}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${currentView === 'map' ? `${themeConfig.accent} text-white shadow-lg shadow-${themeConfig.accent}/20` : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
          >
            <Grid size={20} />
            <span className="hidden md:block font-medium">Mind Map</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('projects')}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${currentView === 'projects' ? `${themeConfig.accent} text-white` : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
          >
            <Folder size={20} />
            <span className="hidden md:block font-medium">Projects</span>
          </button>

           <button 
            onClick={() => setCurrentView('stats')}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${currentView === 'stats' ? `${themeConfig.accent} text-white` : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
          >
            <BarChart2 size={20} />
            <span className="hidden md:block font-medium">Analytics</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
           {/* Global Upload Button */}
           <label className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border border-dashed ${isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-slate-100'}`}>
             <input type="file" className="hidden" onChange={(e) => {
                 // Fallback for global upload: attach to root or just add to docs
                 alert("Select a node to attach files directly to specific branches.");
             }} />
             <Upload size={20} className={theme === AppTheme.DEFAULT ? 'text-blue-600' : 'text-slate-400'} />
             <span className="hidden md:block font-medium text-sm">Upload Doc</span>
           </label>
           
           <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-3 p-3 mt-2 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800/50 w-full">
             <Settings size={20} />
             <span className="hidden md:block font-medium">Settings</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden">
        
        {/* Top Header / Search */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 md:p-6 flex justify-between items-start pointer-events-none">
           <div className="w-full max-w-2xl pointer-events-auto">
             <form onSubmit={handleSearch} className="relative group">
                <div className={`absolute inset-0 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300 ${themeConfig.accent}`}></div>
                <div className={`relative flex items-center rounded-2xl shadow-xl overflow-hidden ${isDarkMode ? 'bg-slate-800/90 text-white' : 'bg-white/90 text-slate-900'} backdrop-blur-sm border ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                  <Search className="ml-4 opacity-50" size={20} />
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={layoutMode === LayoutMode.SEED ? "Plant your idea seed..." : "Search documents with AI..."}
                    className="w-full bg-transparent border-none outline-none p-4 placeholder-opacity-50"
                  />
                  {isLoading ? (
                    <div className="mr-4 w-5 h-5 border-2 border-t-transparent border-current rounded-full animate-spin"></div>
                  ) : (
                    <button type="submit" className={`mr-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-transform active:scale-95 ${themeConfig.accent}`}>
                      {layoutMode === LayoutMode.SEED ? "Grow" : "Search"}
                    </button>
                  )}
                </div>
             </form>
             {query && !isLoading && visibleGraphData.nodes.length > 1 && (
                <div className="mt-2 text-xs opacity-60 ml-2">
                   Active {visibleGraphData.nodes.length} nodes
                </div>
             )}
           </div>

           {/* User Profile Mock */}
           <div className="pointer-events-auto flex items-center gap-4">
              <button className={`p-2 rounded-full shadow-lg backdrop-blur-sm border ${isDarkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-200'}`} onClick={() => setTheme(prev => prev === AppTheme.CYBER ? AppTheme.DEFAULT : AppTheme.CYBER)}>
                 {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-lg">
                <img src="https://picsum.photos/100/100" alt="User" className="w-full h-full object-cover" />
              </div>
           </div>
        </div>

        {/* Content Area */}
        <div className="w-full h-full pt-0">
          {currentView === 'map' && (
            <MindMap 
              data={visibleGraphData} 
              onNodeExpand={handleNodeExpandInteraction}
              onNodeSelect={handleNodeSelect}
              onUpdateNode={handleNodeUpdate}
              theme={theme} 
              linkStyle={linkStyle} 
              layoutMode={layoutMode}
            />
          )}

          {currentView === 'stats' && (
            <div className="w-full h-full pt-24 px-4 md:px-8 pb-8 overflow-auto">
               <Stats documents={documents} darkMode={isDarkMode} />
            </div>
          )}

          {currentView === 'projects' && (
            <div className="w-full h-full pt-24 px-4 md:px-8 pb-8 overflow-auto">
               <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>All Projects</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {/* Group Mock Docs by Project */}
                 {Array.from(new Set(documents.map(d => d.project))).map(project => (
                   <div key={project} className={`p-6 rounded-2xl border transition-all hover:shadow-lg group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      <div className="flex justify-between items-start mb-4">
                         <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-blue-50 text-blue-600'}`}>
                           <Folder size={24} />
                         </div>
                         <button className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-slate-100 dark:hover:bg-slate-600 rounded-full">
                           <Share2 size={16} />
                         </button>
                      </div>
                      <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{project}</h3>
                      <p className={`text-sm mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                         {documents.filter(d => d.project === project).length} Files
                      </p>
                      <div className="flex -space-x-2">
                         {[1,2,3].map(i => (
                           <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-200 overflow-hidden">
                              <img src={`https://picsum.photos/50/50?random=${i}${project}`} className="w-full h-full object-cover" />
                           </div>
                         ))}
                      </div>
                   </div>
                 ))}
                 
                 {/* New Project Button */}
                 <button className={`p-6 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-3 transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-300 hover:bg-slate-50 text-slate-500'}`}>
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                       <Plus size={24} />
                    </div>
                    <span className="font-medium">Create Project</span>
                 </button>
               </div>
            </div>
          )}
        </div>

        {/* Settings Overlay */}
        {showSettings && (
          <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowSettings(false)}>
             <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`} onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold">Settings</h3>
                 <button onClick={() => setShowSettings(false)}><X size={24} /></button>
               </div>
               
               <div className="space-y-6">
                  {/* Theme Section */}
                  <div className="space-y-3">
                    <p className="font-bold opacity-70 flex items-center gap-2"><Settings size={16}/> Theme</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.values(AppTheme).map((t) => (
                        <button 
                          key={t}
                          onClick={() => setTheme(t)}
                          className={`p-4 rounded-xl border text-left transition-all ${theme === t ? `ring-2 ring-offset-2 ${themeConfig.accent.replace('bg-', 'ring-')} border-transparent` : 'border-slate-200 dark:border-slate-700'}`}
                        >
                          <div className="font-medium text-sm">{t}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Link Style Section */}
                  <div className="space-y-3">
                    <p className="font-bold opacity-70 flex items-center gap-2"><Network size={16}/> Link Design</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setLinkStyle(LinkStyle.STRAIGHT)}
                        className={`p-4 rounded-xl border flex items-center gap-2 transition-all ${linkStyle === LinkStyle.STRAIGHT ? `ring-2 ring-offset-2 ${themeConfig.accent.replace('bg-', 'ring-')} border-transparent bg-slate-100 dark:bg-slate-800` : 'border-slate-200 dark:border-slate-700'}`}
                      >
                         <Minus size={18} className="rotate-45" />
                         <span className="font-medium text-sm">Straight</span>
                      </button>
                      
                      <button 
                        onClick={() => setLinkStyle(LinkStyle.ROOT)}
                        className={`p-4 rounded-xl border flex items-center gap-2 transition-all ${linkStyle === LinkStyle.ROOT ? `ring-2 ring-offset-2 ${themeConfig.accent.replace('bg-', 'ring-')} border-transparent bg-slate-100 dark:bg-slate-800` : 'border-slate-200 dark:border-slate-700'}`}
                      >
                         <Sprout size={18} className="text-green-500" />
                         <span className="font-medium text-sm">Root + Leaf</span>
                      </button>
                    </div>
                  </div>
               </div>
             </div>
          </div>
        )}

      </main>

      {/* Right Details Panel (Slide over) */}
      <div className={`absolute top-0 right-0 h-full w-full md:w-96 shadow-2xl transform transition-transform duration-300 z-30 flex flex-col ${selectedNode ? 'translate-x-0' : 'translate-x-full'} ${isDarkMode ? 'bg-slate-900 border-l border-slate-800' : 'bg-white border-l border-slate-200'}`}>
         {selectedNode && (
           <>
             <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
               <div className="w-full pr-4">
                 <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${
                            selectedNode.type === NodeType.PROJECT ? 'bg-amber-100 text-amber-700' : 
                            selectedNode.type === NodeType.CATEGORY ? 'bg-violet-100 text-violet-700' : 
                            'bg-blue-100 text-blue-700'
                        }`}>
                            {selectedNode.type}
                        </span>
                        {/* Blossom Toggle */}
                         <button 
                            onClick={() => toggleNodeBlossom(selectedNode)}
                            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${selectedNode.collapsed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}
                         >
                             {selectedNode.collapsed ? <><EyeOff size={10} /> Bud</> : <><Eye size={10} /> Blossom</>}
                         </button>
                     </div>
                 </div>
                 <input 
                    type="text" 
                    value={selectedNode.name} 
                    onChange={(e) => handleNodeUpdate(selectedNode.id, { name: e.target.value })}
                    className={`text-xl font-bold leading-tight bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full pb-1 transition-colors ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                    placeholder="Node Name"
                 />
                 
                 <div className="mt-4 flex items-center gap-2 group w-full">
                    <MapPin size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                    <input 
                        type="text" 
                        value={selectedNode.project || 'Unassigned'} 
                        onChange={(e) => handleNodeUpdate(selectedNode.id, { project: e.target.value })}
                        className={`text-sm font-medium bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none w-full pb-0.5 transition-colors ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}
                        placeholder="File Directory / Location"
                    />
                     <button 
                        onClick={() => alert(`Simulating opening local folder: ${selectedNode.project || 'Default'}`)}
                        className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-colors ml-1"
                        title="Open Local Folder"
                    >
                        <FolderOpen size={14} />
                    </button>
                 </div>
               </div>
               <button onClick={() => setSelectedNode(null)} className="p-2 flex-shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                 <X size={20} />
               </button>
             </div>
             
             {/* Tabs for File filtering */}
             <div className="px-6 mt-4">
                 <div className={`flex items-center gap-1 p-1 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'} overflow-x-auto`}>
                     {(['all', 'video', 'photo', 'audio', 'doc', 'data'] as const).map(tab => (
                         <button
                            key={tab}
                            onClick={() => setSidebarTab(tab)}
                            className={`flex-1 min-w-[50px] py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${sidebarTab === tab ? (isDarkMode ? 'bg-slate-700 text-white shadow' : 'bg-white text-blue-600 shadow') : 'text-slate-400 hover:text-slate-600'}`}
                         >
                             {tab === 'all' && 'All'}
                             {tab === 'video' && 'Vid'}
                             {tab === 'photo' && 'Pic'}
                             {tab === 'audio' && 'Aud'}
                             {tab === 'doc' && 'Doc'}
                             {tab === 'data' && 'Data'}
                         </button>
                     ))}
                 </div>
             </div>

             <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* File Repository Manager */}
                <div className={`p-4 rounded-xl border border-dashed transition-all ${isDarkMode ? 'border-slate-700 bg-slate-800/20' : 'border-slate-300 bg-slate-50'}`}>
                    <h5 className="text-xs font-bold uppercase text-slate-400 mb-3 text-center">Repository Manager</h5>
                    
                    <div className="flex gap-2">
                        {/* Single File Upload */}
                        <div className="flex-1">
                             <input 
                                type="file" 
                                ref={fileInputRef}
                                className="hidden" 
                                onChange={(e) => handleFileUploadToNode(e, selectedNode)} 
                             />
                             <button 
                                onClick={() => fileInputRef.current?.click()}
                                className={`w-full h-20 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-white hover:bg-slate-100 border-slate-200'} border`}
                             >
                                 <FilePlus size={20} className="text-blue-500" />
                                 <span className="text-[10px] font-bold uppercase opacity-70">Add File</span>
                             </button>
                        </div>

                         {/* Folder Upload */}
                         <div className="flex-1">
                             <input 
                                type="file" 
                                ref={folderInputRef}
                                className="hidden"
                                // @ts-ignore - webkitdirectory is non-standard but supported in most browsers
                                webkitdirectory=""
                                directory=""
                                onChange={(e) => handleFileUploadToNode(e, selectedNode)} 
                             />
                             <button 
                                onClick={() => folderInputRef.current?.click()}
                                className={`w-full h-20 rounded-lg flex flex-col items-center justify-center gap-1 transition-colors ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700' : 'bg-white hover:bg-slate-100 border-slate-200'} border`}
                             >
                                 <FolderPlus size={20} className="text-amber-500" />
                                 <span className="text-[10px] font-bold uppercase opacity-70">Add Folder</span>
                             </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-center opacity-40 mt-2">Uploading folders groups files by type.</p>
                </div>

                {/* List of Children (Branches) */}
                <div>
                   <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 flex items-center justify-between">
                       <span>File Repository ({filteredChildren.length})</span>
                   </h4>
                   <div className="space-y-2">
                       {filteredChildren.length === 0 ? (
                           <p className="text-sm opacity-40 italic">No files in this branch repository.</p>
                       ) : (
                           filteredChildren.map(child => (
                               <div key={child.id} onClick={() => handleNodeSelect(child)} className={`p-3 rounded-lg flex items-center gap-3 cursor-pointer transition-all ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'}`}>
                                   <div className={`w-8 h-8 rounded-md flex items-center justify-center text-white ${
                                       child.iconType === 'video' ? 'bg-violet-500' : 
                                       child.iconType === 'image' ? 'bg-sky-500' : 
                                       child.iconType === 'folder' ? 'bg-amber-500' :
                                       child.iconType === 'music' ? 'bg-pink-500' :
                                       child.iconType === 'spreadsheet' ? 'bg-green-600' :
                                       'bg-emerald-500'
                                   }`}>
                                       {child.iconType === 'video' ? <Video size={14} /> :
                                        child.iconType === 'image' ? <ImageIcon size={14} /> :
                                        child.iconType === 'folder' ? <Folder size={14} /> :
                                        child.iconType === 'music' ? <Music size={14} /> :
                                        child.iconType === 'spreadsheet' ? <Table size={14} /> :
                                        <FileText size={14} />}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                       <div className="text-sm font-medium truncate">{child.name}</div>
                                       <div className="text-xs opacity-50">{child.type}</div>
                                   </div>
                                   <ChevronRight size={14} className="opacity-30" />
                               </div>
                           ))
                       )}
                   </div>
                </div>

                {selectedNode.type === NodeType.DOCUMENT && (
                  <>
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Metadata</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                           <span className="block text-xs opacity-50 mb-1">Type</span>
                           <span className="font-medium text-sm flex items-center gap-2">
                             <FileText size={14} /> {documents.find(d => d.id === selectedNode.id)?.type || 'Unknown'}
                           </span>
                        </div>
                         <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'}`}>
                           <span className="block text-xs opacity-50 mb-1">Date</span>
                           <span className="font-medium text-sm">
                             {documents.find(d => d.id === selectedNode.id)?.date || 'N/A'}
                           </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase text-slate-400 mb-2">Summary</h4>
                      <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                         {selectedDocSummary || "Analysis pending..."}
                      </p>
                    </div>

                    <div className="pt-2">
                      <button className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors ${themeConfig.accent} text-white hover:opacity-90 shadow-lg`}>
                        Open Document
                      </button>
                      <button className={`w-full mt-3 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-medium transition-colors border ${isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <Share2 size={18} /> Share
                      </button>
                    </div>
                  </>
                )}
             </div>
           </>
         )}
      </div>

    </div>
  );
}

export default App;