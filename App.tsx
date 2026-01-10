import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Upload, Share2, Grid, Folder, FileText, Settings, X, Plus, BarChart2, Moon, Sun, Network, Sprout, Minus, Flower2, ArrowRight, Edit3, MapPin, FolderOpen, Video, Image as ImageIcon, ChevronRight, ChevronDown, Eye, EyeOff, Music, Table, FolderPlus, FilePlus, ArrowUp, Trash2 } from 'lucide-react';
import MindMap from './components/MindMap';
import Stats from './components/Stats';
import ProjectsView from './components/ProjectsView';
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
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  
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
          const isSeedMode = layoutMode === LayoutMode.SEED;
          const isSingle = prev.nodes.length === 1;
          
          let targetIcon = n.iconType;
          let targetColor = n.color;
          let targetVal = n.val;

          if (isSeedMode) {
              // If we are in seed mode with just a root, ensure it starts as a seed for animation
              if (isSingle) {
                  targetIcon = 'seed';
                  targetColor = '#8d6e63'; // Brown for seed
                  targetVal = 10;
              } else {
                  targetIcon = 'tree';
                  targetColor = '#22c55e';
                  targetVal = 30;
              }
          } else {
              // Spider Mode
              targetIcon = 'default';
              targetColor = '#ef4444'; // Red for spider root
              targetVal = 25;
          }

          return {
            ...n,
            iconType: targetIcon as NodeIconType,
            color: targetColor,
            val: targetVal,
            fx: null, 
            fy: null,
            collapsed: false 
          };
        }
        return n;
      })
    }));
  }, [layoutMode]);

  const handleStartProject = (mode: LayoutMode) => {
      setLayoutMode(mode);
      setIsLanding(false);
      
      const startNodeName = mode === LayoutMode.SEED ? "Grow your idea tree" : "MindSearch AI";
      // Explicitly start as SEED icon for Seed Mode
      const startIcon: NodeIconType = mode === LayoutMode.SEED ? 'seed' : 'default';
      const startColor = mode === LayoutMode.SEED ? '#8d6e63' : '#ef4444';
      
      const rootNode: Node = { 
          id: 'root', 
          name: startNodeName, 
          type: NodeType.ROOT, 
          val: mode === LayoutMode.SEED ? 10 : 20, 
          iconType: startIcon, 
          color: startColor, 
          description: 'Start searching to expand.', 
          collapsed: false 
      };
      
      const nodes = [rootNode];
      const links: any[] = [];

      setMasterGraphData({
        nodes,
        links
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
      
      const currentRoot = masterGraphData.nodes.find(n => n.id === 'root');
      const isDefaultName = currentRoot?.name === "Grow your idea tree" || currentRoot?.name === "MindSearch AI" || currentRoot?.name === "Grow your idea starting here";
      
      const rootName = isDefaultName ? query : (currentRoot?.name || query);

      const rootNode: Node = {
        id: 'root',
        name: rootName,
        type: NodeType.ROOT,
        val: layoutMode === LayoutMode.SEED ? 30 : 25,
        description: 'Search Query',
        color: layoutMode === LayoutMode.SEED ? '#22c55e' : '#ef4444',
        iconType: layoutMode === LayoutMode.SEED ? 'tree' : 'default', // Transforms to Tree on search
        level: 0,
        collapsed: false
      };

      const newData: GraphData = {
        nodes: [rootNode, ...result.nodes.filter(n => n.id !== 'root').map((n, i) => ({
            ...n,
            // Force Green for main projects/folders
            color: n.type === NodeType.PROJECT ? '#22c55e' : NODE_COLORS[i % NODE_COLORS.length],
            iconType: (n.type === NodeType.PROJECT ? 'folder' : 'file') as NodeIconType,
            level: 1,
            project: n.type === NodeType.PROJECT ? n.name : 'General',
            collapsed: false 
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

  const handleDeleteNode = (nodeId: string) => {
      if (nodeId === 'root') return; // Protect root

      // Recursive delete logic to remove subtree
      const nodesToDelete = new Set<string>();
      const queue = [nodeId];

      while(queue.length > 0) {
          const currentId = queue.pop()!;
          nodesToDelete.add(currentId);
          
          // Find children
          const childrenLinks = masterGraphData.links.filter(l => {
              const s = typeof l.source === 'object' ? l.source.id : l.source;
              return s === currentId;
          });
          
          childrenLinks.forEach(l => {
              const t = typeof l.target === 'object' ? l.target.id : l.target;
              if (!nodesToDelete.has(t as string)) {
                  queue.push(t as string);
              }
          });
      }

      setMasterGraphData(prev => ({
          nodes: prev.nodes.filter(n => !nodesToDelete.has(n.id)),
          links: prev.links.filter(l => {
              const s = typeof l.source === 'object' ? l.source.id : l.source;
              const t = typeof l.target === 'object' ? l.target.id : l.target;
              return !nodesToDelete.has(s as string) && !nodesToDelete.has(t as string);
          })
      }));

      if (selectedNode && nodesToDelete.has(selectedNode.id)) {
          setSelectedNode(null);
      }
  };

  const handleFoldParent = () => {
    if (!selectedNode || selectedNode.id === 'root') return;
    
    const parentLink = masterGraphData.links.find(l => {
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return t === selectedNode.id;
    });

    if (parentLink) {
        const parentId = typeof parentLink.source === 'object' ? parentLink.source.id : parentLink.source;
        handleNodeUpdate(parentId as string, { collapsed: true });
        
        // Select parent since current node is hidden
        const parentNode = masterGraphData.nodes.find(n => n.id === parentId);
        if (parentNode) setSelectedNode(parentNode);
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
        // Grow Sub-branches upwards (negative Y)
        const verticalStep = -80; 
        const spreadFactor = (existingChildrenCount % 2 === 0 ? 1 : -1) * Math.ceil(existingChildrenCount / 2);
        
        // Slight X spread, Main movement is UP
        newBiasX = (parentNode.biasX || 0) + (spreadFactor * 40);
        newBiasY = (parentNode.biasY || 0) + verticalStep;
        
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

  const handleAddDocToGraph = (doc: Document) => {
    // Check if already in graph
    if (masterGraphData.nodes.some(n => n.id === doc.id)) return;

    // Find parent to link to
    const parentId = doc.parentId;
    if (!parentId) return;

    // Force expand parent so new node is visible
    handleNodeUpdate(parentId, { collapsed: false });

    const parentNode = masterGraphData.nodes.find(n => n.id === parentId);
    const parentLevel = parentNode?.level || 0;

    const newNode: Node = {
      id: doc.id,
      name: doc.title,
      type: NodeType.DOCUMENT,
      val: 10,
      description: 'Manually added file',
      iconType: doc.type === 'mp4' ? 'video' :
                (doc.type === 'jpg' || doc.type === 'png') ? 'image' :
                doc.type === 'mp3' ? 'music' :
                (doc.type === 'xlsx' || doc.type === 'csv') ? 'spreadsheet' : 'file',
      level: parentLevel + 1,
      project: doc.project,
      collapsed: false
    };

    const newLink = {
      source: parentId,
      target: doc.id,
      value: 1
    };

    setMasterGraphData(prev => ({
      nodes: [...prev.nodes, newNode],
      links: [...prev.links, newLink]
    }));
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
      
      // 1. Identify Root Folder(s) if expanding from directory upload
      const rootFoldersMap = new Map<string, Node>(); // Key -> Node

      filesArray.forEach(file => {
          // Robust filter: System files, hidden files, or deep configs
          if (file.name.startsWith('.') || file.name.startsWith('__') || file.name === 'Thumbs.db' || file.name === 'desktop.ini') return;
          const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [file.name];
          
          // Deep filter: If any part of path starts with '.', skip it (e.g. .git/objects/...)
          if (pathParts.some(part => part.startsWith('.'))) return;

          let targetParentId = parentNode.id;
          let currentLevel = (parentNode.level || 0);

          // If it's a folder upload, structure it: Parent -> RootFolder -> SubFolder -> Category -> (Linked File)
          // "Files within files" approach: Maintain folder structure
          if (pathParts.length > 1) {
              const dirParts = pathParts.slice(0, -1); // Parts excluding filename
              
              let currentPath = "";
              let parentId = parentNode.id;

              dirParts.forEach((part, index) => {
                  const key = currentPath ? `${currentPath}/${part}` : part;
                  const localKey = `${parentId}/${part}`; // Unique key combining parent and name
                  currentPath = key;

                  if (!rootFoldersMap.has(localKey)) {
                       // Check if folder already exists in the graph to merge
                       const existingLink = masterGraphData.links.find(l => {
                           const s = typeof l.source === 'object' ? l.source.id : l.source;
                           return s === parentId;
                       });
                       
                       const siblingNodes = masterGraphData.links
                          .filter(l => (typeof l.source === 'object' ? l.source.id : l.source) === parentId)
                          .map(l => {
                              const tId = typeof l.target === 'object' ? l.target.id : l.target;
                              return masterGraphData.nodes.find(n => n.id === tId);
                          })
                          .filter(n => n && n.name === part && n.type === NodeType.PROJECT);

                       let folderNode = siblingNodes[0];

                       if (!folderNode) {
                           // Check if we created it in this batch (e.g. earlier iteration)
                           folderNode = newNodes.find(n => n.name === part && n.type === NodeType.PROJECT && newLinks.some(l => l.source === parentId && l.target === n.id));
                       }

                       if (!folderNode) {
                           // Create Directory Node
                           const folderId = `folder-${key.replace(/\W/g, '')}-${Date.now()}-${Math.random()}`;
                           folderNode = {
                              id: folderId,
                              name: part,
                              type: NodeType.PROJECT,
                              val: 18,
                              description: `Folder: ${part}`,
                              iconType: 'folder',
                              level: (parentNode.level || 0) + index + 1,
                              project: parentNode.project,
                              // If parent is root, this is Level 1 -> Green. Else -> Blue.
                              color: parentId === 'root' ? '#22c55e' : '#3b82f6',
                              collapsed: true // Start FOLDED (Collapsed)
                           };
                           newNodes.push(folderNode);
                           newLinks.push({ source: parentId, target: folderId, value: 3 });
                       }
                       
                       rootFoldersMap.set(localKey, folderNode!);
                  }
                  
                  const node = rootFoldersMap.get(localKey)!;
                  parentId = node.id;
                  
                  // Update target for file insertion
                  targetParentId = node.id;
                  currentLevel = node.level!;
              });
          }

          // 2. Bucket into Type Categories (Images, Videos, etc.) UNDER the target parent
          const type = file.type;
          const name = file.name.toLowerCase();
          
          let bucketKey = 'doc';
          let bucketName = 'Documents';
          let bucketIcon: NodeIconType = 'file';
          let bucketColor = '#f59e0b';

          if (type.startsWith('video') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.avi')) {
              bucketKey = 'video'; bucketName = 'Videos'; bucketIcon = 'video'; bucketColor = '#8b5cf6';
          } else if (type.startsWith('image') || name.endsWith('.jpg') || name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.webp')) {
              bucketKey = 'image'; bucketName = 'Images'; bucketIcon = 'image'; bucketColor = '#0ea5e9';
          } else if (type.startsWith('audio') || name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg')) {
              bucketKey = 'audio'; bucketName = 'Music'; bucketIcon = 'music'; bucketColor = '#ec4899';
          } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || name.endsWith('.json')) {
              bucketKey = 'data'; bucketName = 'Data'; bucketIcon = 'spreadsheet'; bucketColor = '#10b981';
          }

          // Find or Create Category Node attached to targetParentId
          const catNodeName = bucketName;
          
          // Check in current batch first
          let catNode = newNodes.find(n => n.name === catNodeName && 
              newLinks.some(l => l.source === targetParentId && l.target === n.id)
          );

          if (!catNode) {
              // Check existing graph
              const existingLinks = masterGraphData.links.filter(l => (typeof l.source === 'string' ? l.source : l.source.id) === targetParentId);
              const existingNodeIds = new Set(existingLinks.map(l => (typeof l.target === 'string' ? l.target : l.target.id)));
              const existingCatNode = masterGraphData.nodes.find(n => existingNodeIds.has(n.id) && n.name === catNodeName);
              
              if (existingCatNode) {
                  catNode = existingCatNode;
              } else {
                  // Create New Category Node
                  const catId = `cat-${bucketKey}-${targetParentId}-${Date.now()}-${Math.random()}`;
                  catNode = {
                      id: catId,
                      name: bucketName,
                      type: NodeType.CATEGORY,
                      val: 15,
                      description: `Collection of ${bucketName}`,
                      iconType: bucketIcon,
                      color: bucketColor,
                      level: currentLevel + 1,
                      project: parentNode.project,
                      collapsed: false // Category nodes are leaves in graph, can't be folded further in graph sense
                  };
                  newNodes.push(catNode);
                  newLinks.push({ source: targetParentId, target: catId, value: 2 });
              }
          }

          // 3. Create Document Object (BUT NO GRAPH NODE)
          const fileId = `file-${Date.now()}-${Math.random()}`;
          let docType = 'txt';
          if (name.endsWith('pdf')) docType = 'pdf';
          else if (name.endsWith('docx')) docType = 'docx';
          else if (name.endsWith('xlsx')) docType = 'xlsx';
          else if (name.endsWith('mp3')) docType = 'mp3';
          else if (name.endsWith('mp4')) docType = 'mp4';
             
          const newDoc: Document = {
              id: fileId,
              title: file.name,
              content: "Uploaded content pending analysis...",
              project: parentNode.project || 'Repository',
              date: new Date().toISOString().split('T')[0],
              type: docType as any,
              tags: ['upload', bucketKey],
              parentId: catNode.id // Link to the Category Node
          };
          newDocs.push(newDoc);
      });

      setDocuments(prev => [...prev, ...newDocs]);
      
      // Update Graph
      setMasterGraphData(prev => ({
          nodes: prev.nodes.map(n => n.id === parentNode.id ? { ...n, collapsed: false } : n).concat(newNodes),
          links: [...prev.links, ...newLinks]
      }));
  };

  const handleFileUploadToNode = (e: React.ChangeEvent<HTMLInputElement>, parentNode: Node) => {
    if (e.target.files && e.target.files.length > 0) {
        processFileList(e.target.files, parentNode);
    }
  };

  const handleConnectDrive = () => {
      // Mock Connection
      setIsDriveConnected(true);
      
      const driveId = 'drive-root';
      const driveNode: Node = {
          id: driveId,
          name: 'Google Drive',
          type: NodeType.PROJECT,
          val: 20,
          description: 'Connected Cloud Storage',
          iconType: 'folder',
          color: '#10b981', // Green like Drive
          level: 1,
          project: 'Cloud',
          collapsed: false
      };
      
      // Mock Subfolders
      const sub1: Node = {
          id: 'drive-sub-1',
          name: 'Shared with me',
          type: NodeType.PROJECT,
          val: 15,
          description: 'Shared items',
          iconType: 'folder',
          color: '#34d399',
          level: 2,
          project: 'Cloud',
          collapsed: true
      };
      
      const sub2: Node = {
          id: 'drive-sub-2',
          name: 'My Projects',
          type: NodeType.PROJECT,
          val: 15,
          description: 'Personal projects',
          iconType: 'folder',
          color: '#34d399',
          level: 2,
          project: 'Cloud',
          collapsed: true
      };

      setMasterGraphData(prev => ({
          nodes: [...prev.nodes, driveNode, sub1, sub2],
          links: [
              ...prev.links,
              { source: 'root', target: driveId, value: 3 },
              { source: driveId, target: sub1.id, value: 2 },
              { source: driveId, target: sub2.id, value: 2 }
          ]
      }));
      
      alert("Google Drive Connected! Folders added to your graph.");
  };

  // Helper to get children for sidebar list (Graph Nodes)
  const getSelectedNodeChildren = () => {
      if (!selectedNode) return [];
      const childLinks = masterGraphData.links.filter(l => (typeof l.source === 'string' ? l.source : l.source.id) === selectedNode.id);
      const childIds = new Set(childLinks.map(l => (typeof l.target === 'string' ? l.target : l.target.id)));
      return masterGraphData.nodes.filter(n => childIds.has(n.id));
  };

  // Helper to get attached documents (Leaf Files)
  const getAttachedDocuments = () => {
      if (!selectedNode) return [];
      return documents.filter(d => d.parentId === selectedNode.id);
  }

  const filteredChildren = getSelectedNodeChildren().filter(child => {
      if (sidebarTab === 'all') return true;
      if (sidebarTab === 'video') return child.iconType === 'video';
      if (sidebarTab === 'photo') return child.iconType === 'image';
      if (sidebarTab === 'doc') return child.iconType === 'file' || child.iconType === 'default';
      if (sidebarTab === 'audio') return child.iconType === 'music';
      if (sidebarTab === 'data') return child.iconType === 'spreadsheet';
      return true;
  });

  const attachedDocs = getAttachedDocuments().filter(doc => {
     // Basic type filtering for attached docs
     if (sidebarTab === 'all') return true;
     if (sidebarTab === 'video') return doc.type === 'mp4';
     if (sidebarTab === 'photo') return doc.type === 'jpg' || doc.type === 'png';
     if (sidebarTab === 'doc') return doc.type === 'pdf' || doc.type === 'docx' || doc.type === 'txt';
     if (sidebarTab === 'audio') return doc.type === 'mp3';
     if (sidebarTab === 'data') return doc.type === 'xlsx' || doc.type === 'csv';
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
                        <h3 className="text-2xl font-bold mb-2">Tree Map</h3>
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
        <header className={`h-16 flex-shrink-0 border-b flex items-center justify-between px-6 ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/50'}`}>
           <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative">
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} size={20} />
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={layoutMode === LayoutMode.SEED ? "What do you want to grow?" : "Search documentation, projects, or concepts..."}
                className={`w-full pl-12 pr-4 py-2.5 rounded-xl outline-none transition-all border ${isDarkMode ? 'bg-slate-800 border-slate-700 focus:border-cyan-500 text-white placeholder-slate-500' : 'bg-slate-100 border-slate-200 focus:border-blue-500 text-slate-900 placeholder-slate-500'}`}
              />
           </form>
           
           <div className="flex items-center gap-4 ml-6">
              <button onClick={() => setTheme(prev => prev === AppTheme.CYBER ? AppTheme.DEFAULT : AppTheme.CYBER)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
           </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-hidden relative">
            {currentView === 'map' && (
                <MindMap 
                    data={visibleGraphData}
                    onNodeExpand={handleNodeExpandInteraction}
                    onNodeSelect={handleNodeSelect}
                    onUpdateNode={handleNodeUpdate}
                    onDeleteNode={handleDeleteNode}
                    theme={theme}
                    linkStyle={linkStyle}
                    layoutMode={layoutMode}
                    focusedNodeId={selectedNode?.id}
                />
            )}
            
            {currentView === 'stats' && (
                <Stats documents={documents} darkMode={isDarkMode} />
            )}

            {currentView === 'projects' && (
                 <ProjectsView 
                    nodes={masterGraphData.nodes}
                    onSelectNode={(node) => {
                        setSelectedNode(node);
                        setCurrentView('map');
                    }}
                    onConnectDrive={handleConnectDrive}
                    isDriveConnected={isDriveConnected}
                    theme={themeConfig}
                    darkMode={isDarkMode}
                 />
            )}
            
            {/* Context Panel (Right Sidebar for selected node) */}
            {selectedNode && (
                <div className={`absolute top-4 right-4 w-80 max-h-[calc(100%-2rem)] rounded-2xl shadow-2xl border flex flex-col overflow-hidden backdrop-blur-md transition-all ${isDarkMode ? 'bg-slate-900/90 border-slate-700 text-slate-200' : 'bg-white/90 border-slate-200 text-slate-800'}`}>
                    <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-2 font-bold">
                           {selectedNode.type === NodeType.PROJECT ? <Folder size={18} className="text-blue-500" /> : 
                            selectedNode.type === NodeType.ROOT ? <Network size={18} className="text-purple-500" /> :
                            <FileText size={18} className="text-emerald-500" />}
                           <span className="truncate max-w-[180px]">{selectedNode.name}</span>
                        </div>
                        <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-black/10 rounded-full">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-1 block">Description</label>
                            <p className="text-sm leading-relaxed opacity-90">{selectedDocSummary || selectedNode.description}</p>
                        </div>
                        
                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-2">
                             <button onClick={() => handleNodeExpandInteraction(selectedNode)} className={`p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border ${isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                                 {selectedNode.collapsed ? <><Eye size={14} /> Expand</> : <><Plus size={14} /> Add Child</>}
                             </button>
                             <button onClick={() => handleDeleteNode(selectedNode.id)} className={`p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 border border-red-500/20 text-red-500 hover:bg-red-500/10`}>
                                 <Trash2 size={14} /> Delete
                             </button>
                        </div>

                         {/* Attachments Section */}
                        {selectedNode.type === NodeType.CATEGORY || selectedNode.type === NodeType.PROJECT || selectedNode.type === NodeType.ROOT ? (
                             <div>
                                <label className="text-xs font-bold uppercase tracking-wider opacity-50 mb-2 block flex items-center justify-between">
                                    Files
                                    <span className="text-[10px] bg-slate-500/20 px-1.5 py-0.5 rounded">{attachedDocs.length}</span>
                                </label>
                                <div className="space-y-2">
                                    {attachedDocs.length > 0 ? attachedDocs.map(doc => (
                                        <div key={doc.id} className={`flex items-center gap-2 p-2 rounded-lg text-sm border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                            {doc.type === 'mp4' ? <Video size={14} className="text-purple-500" /> : 
                                             doc.type === 'jpg' ? <ImageIcon size={14} className="text-sky-500" /> :
                                             <FileText size={14} className="text-slate-500" />}
                                            <span className="truncate flex-1">{doc.title}</span>
                                        </div>
                                    )) : (
                                        <div className="text-xs opacity-50 text-center py-4 border border-dashed rounded-lg">No files attached</div>
                                    )}
                                    
                                    {/* Upload Triggers */}
                                    <div className="flex gap-2">
                                        <label className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-dashed cursor-pointer text-[10px] font-bold transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-300 hover:bg-slate-50 text-slate-500'}`}>
                                             <input type="file" multiple className="hidden" onChange={(e) => handleFileUploadToNode(e, selectedNode)} />
                                             <FilePlus size={16} /> Add Files
                                        </label>
                                        <label className={`flex-1 flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-dashed cursor-pointer text-[10px] font-bold transition-colors ${isDarkMode ? 'border-slate-700 hover:bg-slate-800 text-slate-400' : 'border-slate-300 hover:bg-slate-50 text-slate-500'}`}>
                                             {/* webkitdirectory attribute handled via spread to avoid TS strict check issues in some envs */}
                                             <input type="file" multiple {...({ webkitdirectory: "" } as any)} className="hidden" onChange={(e) => handleFileUploadToNode(e, selectedNode)} />
                                             <FolderPlus size={16} /> Add Folder
                                        </label>
                                    </div>
                                </div>
                             </div>
                        ) : null}
                    </div>
                </div>
            )}
            
            {/* Settings Modal Overlay */}
            {showSettings && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <div className="p-4 border-b flex items-center justify-between">
                            <h3 className="font-bold text-lg">Settings</h3>
                            <button onClick={() => setShowSettings(false)}><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium mb-3 opacity-80">Layout Mode</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => setLayoutMode(LayoutMode.SPIDER)}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${layoutMode === LayoutMode.SPIDER ? 'border-blue-500 bg-blue-500/10' : 'border-transparent bg-slate-100 dark:bg-slate-800'}`}
                                    >
                                        <Network />
                                        <span className="text-sm font-bold">Spider</span>
                                    </button>
                                    <button 
                                        onClick={() => setLayoutMode(LayoutMode.SEED)}
                                        className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${layoutMode === LayoutMode.SEED ? 'border-green-500 bg-green-500/10' : 'border-transparent bg-slate-100 dark:bg-slate-800'}`}
                                    >
                                        <Sprout />
                                        <span className="text-sm font-bold">Seed/Tree</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium mb-3 opacity-80">Link Style</label>
                                <div className="flex gap-2">
                                     <button onClick={() => setLinkStyle(LinkStyle.ROOT)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${linkStyle === LinkStyle.ROOT ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Organic</button>
                                     <button onClick={() => setLinkStyle(LinkStyle.STRAIGHT)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${linkStyle === LinkStyle.STRAIGHT ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Straight</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}

export default App;