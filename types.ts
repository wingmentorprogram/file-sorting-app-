export enum NodeType {
  ROOT = 'ROOT',
  PROJECT = 'PROJECT',
  DOCUMENT = 'DOCUMENT',
  CATEGORY = 'CATEGORY'
}

export enum LinkStyle {
  STRAIGHT = 'Straight',
  ROOT = 'Root'
}

export enum LayoutMode {
  SPIDER = 'Spider',
  SEED = 'Seed'
}

export type NodeIconType = 'default' | 'folder' | 'video' | 'image' | 'file' | 'seed' | 'tree' | 'leaf' | 'music' | 'spreadsheet';

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  val: number; // For visualization sizing
  description?: string;
  fileType?: string; // pdf, docx, txt
  date?: string;
  project?: string; // Directory/Location
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  biasX?: number; // Preferred X offset from center
  biasY?: number; // Preferred Y offset from center
  color?: string; // Specific node color
  iconType?: NodeIconType; // Visual representation
  level?: number; // For tree hierarchy depth
  collapsed?: boolean; // Blossom feature: true if children are hidden
}

export interface Link {
  source: string | Node;
  target: string | Node;
  value: number; // Strength of relationship
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

export interface Document {
  id: string;
  title: string;
  content: string;
  project: string;
  date: string;
  type: 'pdf' | 'docx' | 'txt' | 'md' | 'mp4' | 'png' | 'jpg' | 'mp3' | 'wav' | 'xlsx' | 'csv';
  tags: string[];
}

export enum AppTheme {
  DEFAULT = 'Default',
  CYBER = 'Cyberpunk',
  NATURE = 'Nature',
  MINIMAL = 'Minimal'
}