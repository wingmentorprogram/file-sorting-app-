import React from 'react';
import { Folder, HardDrive, Cloud, Plus, MoreVertical, FileText, ExternalLink } from 'lucide-react';
import { Node, NodeType } from '../types';

interface ProjectsViewProps {
  nodes: Node[];
  onSelectNode: (node: Node) => void;
  onConnectDrive: () => void;
  isDriveConnected: boolean;
  theme: any; // Theme config object
  darkMode: boolean;
}

const ProjectsView: React.FC<ProjectsViewProps> = ({ 
  nodes, 
  onSelectNode, 
  onConnectDrive, 
  isDriveConnected,
  theme,
  darkMode
}) => {
  // Filter for top-level projects or uploaded folders
  // We exclude 'root' and category nodes mostly, focusing on PROJECT types
  const projects = nodes.filter(n => n.type === NodeType.PROJECT && n.id !== 'root');
  
  // Mock Quick Access (just the first 3 projects for now, or favorited ones if we had that state)
  const quickAccess = projects.slice(0, 3);

  const containerClass = darkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900';
  const cardClass = darkMode ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-blue-300';
  const textSub = darkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`h-full overflow-y-auto p-8 ${containerClass}`}>
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Library</h2>
            <p className={`mt-1 ${textSub}`}>Manage your local uploads and cloud connections.</p>
          </div>
          <button className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${darkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
            <Plus size={18} /> New Project
          </button>
        </div>

        {/* Cloud Storage Section */}
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4 flex items-center gap-2">
            <Cloud size={16} /> Cloud Storage
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Google Drive Card */}
            <div className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all ${isDriveConnected ? (darkMode ? 'border-green-500/30 bg-green-500/10' : 'border-green-200 bg-green-50') : (darkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-300 hover:bg-white')}`}>
               <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDriveConnected ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                 <HardDrive size={24} />
               </div>
               <div className="text-center">
                 <h4 className="font-bold">Google Drive</h4>
                 <p className={`text-xs ${textSub}`}>{isDriveConnected ? 'Connected & Synced' : 'Not linked'}</p>
               </div>
               <button 
                 onClick={onConnectDrive}
                 disabled={isDriveConnected}
                 className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${isDriveConnected ? 'bg-transparent text-green-600 cursor-default' : (darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300')}`}
               >
                 {isDriveConnected ? 'Synced' : 'Link Drive'}
               </button>
            </div>

            {/* Dropbox (Mock Disabled) */}
            <div className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 opacity-50 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
               <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                 <Cloud size={24} />
               </div>
               <div className="text-center">
                 <h4 className="font-bold">Dropbox</h4>
                 <p className="text-xs">Coming Soon</p>
               </div>
            </div>
          </div>
        </section>

        {/* Quick Access */}
        {quickAccess.length > 0 && (
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4 flex items-center gap-2">
              <ExternalLink size={16} /> Quick Access
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {quickAccess.map(node => (
                <div 
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md group ${cardClass}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Folder className={`text-blue-500 group-hover:scale-110 transition-transform`} size={24} fill="currentColor" fillOpacity={0.2} />
                    <MoreVertical size={16} className="opacity-0 group-hover:opacity-50" />
                  </div>
                  <h4 className="font-semibold text-sm truncate">{node.name}</h4>
                  <p className={`text-xs ${textSub} mt-1`}>{node.val} items</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All Projects / Folders */}
        <section>
          <h3 className="text-sm font-bold uppercase tracking-wider opacity-70 mb-4 flex items-center gap-2">
            <Folder size={16} /> All Projects
          </h3>
          <div className="bg-transparent rounded-xl overflow-hidden">
             {/* List View Header */}
             <div className={`grid grid-cols-12 gap-4 p-4 text-xs font-bold uppercase tracking-wider border-b ${darkMode ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                <div className="col-span-6">Name</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-3 text-right">Items</div>
             </div>
             
             {/* Rows */}
             <div className="space-y-1 mt-2">
               {projects.map(node => (
                 <div 
                    key={node.id} 
                    onClick={() => onSelectNode(node)}
                    className={`grid grid-cols-12 gap-4 p-4 rounded-lg cursor-pointer items-center transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-white hover:shadow-sm'}`}
                 >
                    <div className="col-span-6 flex items-center gap-3">
                       <div className={`p-2 rounded-lg ${darkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                         <Folder size={18} />
                       </div>
                       <div>
                         <h4 className="font-medium text-sm">{node.name}</h4>
                         <p className="text-[10px] opacity-50">{node.description || 'No description'}</p>
                       </div>
                    </div>
                    <div className="col-span-3">
                       <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${node.collapsed ? (darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500') : (darkMode ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-50 text-emerald-600')}`}>
                         {node.collapsed ? 'Archived' : 'Active'}
                       </span>
                    </div>
                    <div className="col-span-3 text-right text-sm font-mono opacity-60">
                       {Math.floor(node.val * 0.8)} KB
                    </div>
                 </div>
               ))}
               
               {projects.length === 0 && (
                 <div className="p-12 text-center opacity-50">
                    <Folder size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No projects found. Try uploading a folder.</p>
                 </div>
               )}
             </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default ProjectsView;