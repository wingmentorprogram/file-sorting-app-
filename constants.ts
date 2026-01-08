import { Document, GraphData, NodeType, AppTheme } from './types';

// Mock Documents to simulate an existing database
export const MOCK_DOCUMENTS: Document[] = [
  {
    id: '1',
    title: 'Project Alpha Requirements',
    content: 'The user authentication system must support OAuth2.0 and standard email/password login. Rate limiting should be applied to all API endpoints.',
    project: 'Project Alpha',
    date: '2023-10-15',
    type: 'pdf',
    tags: ['requirements', 'security', 'auth']
  },
  {
    id: '2',
    title: 'Alpha API Documentation',
    content: 'Endpoints for /users, /products, and /orders. All responses are in JSON format. Error handling follows RFC 7807.',
    project: 'Project Alpha',
    date: '2023-11-01',
    type: 'md',
    tags: ['api', 'dev', 'backend']
  },
  {
    id: '3',
    title: 'Beta Marketing Strategy',
    content: 'Target demographic includes tech-savvy professionals aged 25-40. Key channels: LinkedIn, Twitter, and TechCrunch.',
    project: 'Project Beta',
    date: '2024-01-20',
    type: 'docx',
    tags: ['marketing', 'strategy', 'social']
  },
  {
    id: '4',
    title: 'Q1 Financial Report',
    content: 'Revenue up by 15% QoQ. Operational costs increased due to server expansion. Projected Q2 growth is conservative.',
    project: 'Finance',
    date: '2024-04-10',
    type: 'pdf',
    tags: ['finance', 'report', 'q1']
  },
  {
    id: '5',
    title: 'Design System Guidelines',
    content: 'Primary color is #3B82F6. Typography uses Inter font family. Components should be atomic and reusable.',
    project: 'Design',
    date: '2023-09-05',
    type: 'txt',
    tags: ['design', 'ui', 'ux']
  },
  {
    id: '6',
    title: 'Cloud Infrastructure Setup',
    content: 'AWS EC2 instances for application servers. RDS for database. S3 for asset storage. Terraform used for IaC.',
    project: 'DevOps',
    date: '2023-12-12',
    type: 'md',
    tags: ['devops', 'aws', 'cloud']
  }
];

export const INITIAL_GRAPH_DATA: GraphData = {
  nodes: [
    { id: 'root', name: 'MindSearch AI', type: NodeType.ROOT, val: 20, description: 'Start searching to expand the mind map.' }
  ],
  links: []
};

export const THEMES: Record<AppTheme, { bg: string, text: string, accent: string, node: string }> = {
  [AppTheme.DEFAULT]: { bg: 'bg-slate-50', text: 'text-slate-900', accent: 'bg-blue-600', node: '#3b82f6' },
  [AppTheme.CYBER]: { bg: 'bg-slate-900', text: 'text-cyan-50', accent: 'bg-cyan-500', node: '#06b6d4' },
  [AppTheme.NATURE]: { bg: 'bg-stone-50', text: 'text-stone-800', accent: 'bg-emerald-600', node: '#10b981' },
  [AppTheme.MINIMAL]: { bg: 'bg-white', text: 'text-black', accent: 'bg-black', node: '#171717' },
};
