import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Document } from '../types';

interface StatsProps {
  documents: Document[];
  darkMode: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Stats: React.FC<StatsProps> = ({ documents, darkMode }) => {
  // Aggregate data for Project distribution
  const projectData = documents.reduce((acc, doc) => {
    const found = acc.find(item => item.name === doc.project);
    if (found) {
      found.count += 1;
    } else {
      acc.push({ name: doc.project, count: 1 });
    }
    return acc;
  }, [] as { name: string; count: number }[]);

  // Aggregate data for File Type distribution
  const typeData = documents.reduce((acc, doc) => {
    const found = acc.find(item => item.name === doc.type);
    if (found) {
      found.value += 1;
    } else {
      acc.push({ name: doc.type, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const textColor = darkMode ? '#e2e8f0' : '#334155';
  const gridColor = darkMode ? '#334155' : '#e2e8f0';

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
        Project Insights
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Document Count by Project */}
        <div className={`p-6 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            Documents per Project
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="name" tick={{fill: textColor}} stroke={gridColor} />
                <YAxis tick={{fill: textColor}} stroke={gridColor} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderColor: gridColor, color: textColor }}
                  itemStyle={{ color: textColor }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* File Type Distribution */}
        <div className={`p-6 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            File Type Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: darkMode ? '#1e293b' : '#fff', borderColor: gridColor, color: textColor }}
                />
                <Legend iconType="circle" wrapperStyle={{ color: textColor }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Search Stats Mock */}
      <div className={`p-6 rounded-xl shadow-sm border ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h3 className={`text-lg font-semibold mb-4 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
           Activity Trends
        </h3>
        <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Visualizing search frequency over the last 30 days. (Mock data)
        </p>
         <div className="h-48 mt-4 flex items-end justify-between gap-1">
            {Array.from({ length: 30 }).map((_, i) => {
              const h = Math.floor(Math.random() * 80) + 20;
              return (
                <div 
                  key={i} 
                  style={{ height: `${h}%` }} 
                  className={`w-full rounded-t-sm opacity-80 hover:opacity-100 transition-opacity ${i % 2 === 0 ? 'bg-blue-500' : 'bg-indigo-500'}`}
                ></div>
              )
            })}
         </div>
      </div>
    </div>
  );
};

export default Stats;
