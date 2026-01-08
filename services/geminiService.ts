import { GoogleGenAI, Type } from "@google/genai";
import { Document, GraphData, NodeType, Node, Link } from '../types';

/**
 * Helper to calculate a relevance score for a document based on a query.
 * Considers: Title match (high), Tag match (medium), Content match (low), and Recency (bonus).
 */
const calculateRelevance = (doc: Document, query: string): number => {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2); // Ignore very short words
  if (terms.length === 0) return 0;

  let score = 0;
  const titleLower = doc.title.toLowerCase();
  const contentLower = doc.content.toLowerCase();
  const tagsLower = doc.tags?.map(t => t.toLowerCase()) || [];

  // 1. Keyword Matching
  terms.forEach(term => {
    // Title match: High weight
    if (titleLower.includes(term)) score += 10;
    
    // Tag match: Medium-High weight (Accumulates for multiple matching tags)
    // If multiple tags match the term, add points for each
    const matchingTags = tagsLower.filter(t => t.includes(term));
    score += (matchingTags.length * 8);

    // Content match: Low weight
    // Simple check if present (could be enhanced to frequency count, but simple inclusion is fast)
    if (contentLower.includes(term)) score += 1;
  });

  if (score === 0) return 0; // If no text matches, recency shouldn't matter

  // 2. Recency Scoring
  // Calculate days since document date
  try {
    const docDate = new Date(doc.date);
    const now = new Date();
    // Time difference in days
    const diffTime = Math.abs(now.getTime() - docDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Linear Decay: 
    // New docs get max 10 points. 
    // Docs older than 365 days get 0 recency points.
    const recencyMax = 10;
    const decayPeriod = 365; 
    const recencyScore = Math.max(0, recencyMax * (1 - (diffDays / decayPeriod)));
    
    score += recencyScore;
  } catch (e) {
    // If date parsing fails, ignore recency bonus
  }

  return score;
};

/**
 * Uses Gemini to analyze documents based on a query and return a graph structure.
 */
export const searchAndGenerateGraph = async (
  query: string,
  documents: Document[]
): Promise<GraphData> => {
  if (!query) return { nodes: [], links: [] };

  // 1. Pre-process and Rank Documents
  // We rank them before sending to AI to ensure the prompt context contains the most relevant info first.
  // This is crucial if we had token limits, but also helps the AI focus.
  const scoredDocs = documents
    .map(doc => ({ doc, score: calculateRelevance(doc, query) }))
    .filter(item => item.score > 0) // Remove completely irrelevant docs
    .sort((a, b) => b.score - a.score); // Descending order

  // Initialize client lazily
  const apiKey = process.env.API_KEY || '';
  const ai = new GoogleGenAI({ apiKey });

  // Prepare context from Top N relevant documents
  // We send the top 15 matches to the AI to keep context focused
  const contextDocs = scoredDocs.slice(0, 15);

  const docsContext = contextDocs.map(item => 
    `ID: ${item.doc.id}
Title: ${item.doc.title}
Relevance Score: ${item.score.toFixed(1)}
Project: ${item.doc.project}
Date: ${item.doc.date}
Tags: ${item.doc.tags ? item.doc.tags.join(', ') : ''}
Content Snippet: ${item.doc.content.substring(0, 500)}...`
  ).join('\n---\n');

  const systemInstruction = `
    You are a knowledge graph generator for a documentation search engine.
    Your goal is to accept a User Query and a list of Documents (ordered by algorithmic relevance).
    You must return a JSON object representing a node-link diagram (Mind Map).
    
    The structure must be:
    {
      "nodes": [{ "id": "string", "name": "string", "type": "PROJECT" | "DOCUMENT" | "CATEGORY", "description": "string" }],
      "links": [{ "source": "string", "target": "string" }]
    }

    Rules:
    1. Create a central node representing the Query concept if it helps grouping, otherwise link directly to the "ROOT" node provided by the client (do not output root in json, client handles it).
    2. Review the provided documents. They are already ranked by relevance. Include high-scoring documents.
    3. Group documents by Project or logical Categories derived from the query.
    4. Provide a brief 1-sentence description for why the document matched.
    5. 'source' and 'target' in links must match node 'id's.
  `;

  const prompt = `
    User Query: "${query}"
    
    Available Documents (Ranked by Relevance):
    ${docsContext}
    
    Generate the JSON graph structure. Connect relevant documents to the query concept or grouped projects.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['PROJECT', 'DOCUMENT', 'CATEGORY'] },
                  description: { type: Type.STRING },
                },
                required: ['id', 'name', 'type']
              }
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                }
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");
    
    const parsed = JSON.parse(jsonText);
    
    // Post-process to add required properties for visualization
    const nodes: Node[] = parsed.nodes.map((n: any) => ({
      ...n,
      val: n.type === NodeType.PROJECT ? 15 : (n.type === NodeType.DOCUMENT ? 10 : 12),
      // Ensure type is valid enum
      type: n.type as NodeType
    }));

    // Add implicit root connection if detached
    const links: Link[] = parsed.links.map((l: any) => ({
      source: l.source,
      target: l.target,
      value: 1
    }));

    return { nodes, links };
  } catch (error) {
    console.error("Gemini Graph Generation Error:", error);
    
    // Fallback: Use the sophisticated scoring we calculated earlier
    // Take Top 6 highest scoring documents
    const topMatches = scoredDocs.slice(0, 6).map(item => item.doc);

    const nodes: Node[] = topMatches.map(d => ({
      id: d.id,
      name: d.title,
      type: NodeType.DOCUMENT,
      val: 10,
      description: d.content.substring(0, 50) + "..."
    }));

    const links: Link[] = topMatches.map(d => ({
      source: 'root', // Client-side root ID
      target: d.id,
      value: 1
    }));

    return { nodes, links };
  }
};

export const getDocumentSummary = async (doc: Document): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Summarize this document in 2 sentences. Context: Project ${doc.project}, Tags: ${doc.tags?.join(', ')}. Content: ${doc.content}`,
    });
    return response.text || "No summary available.";
  } catch (e) {
    return "Could not generate summary.";
  }
};
