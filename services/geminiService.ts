import { GoogleGenAI, Type } from "@google/genai";
import { Document, GraphData, NodeType, Node, Link } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini to analyze documents based on a query and return a graph structure.
 */
export const searchAndGenerateGraph = async (
  query: string,
  documents: Document[]
): Promise<GraphData> => {
  if (!query) return { nodes: [], links: [] };

  // Prepare context from mock documents
  // In a real app, this would be a RAG system (Retrieval Augmented Generation)
  // Here we send metadata of all docs since the list is small.
  const docsContext = documents.map(d => 
    `ID: ${d.id}, Title: ${d.title}, Project: ${d.project}, Content Snippet: ${d.content.substring(0, 100)}...`
  ).join('\n');

  const systemInstruction = `
    You are a knowledge graph generator for a documentation search engine.
    Your goal is to accept a User Query and a list of Documents.
    You must return a JSON object representing a node-link diagram (Mind Map).
    
    The structure must be:
    {
      "nodes": [{ "id": "string", "name": "string", "type": "PROJECT" | "DOCUMENT" | "CATEGORY", "description": "string" }],
      "links": [{ "source": "string", "target": "string" }]
    }

    Rules:
    1. Create a central node representing the Query concept if it helps grouping, otherwise link directly to the "ROOT" node provided by the client (do not output root in json, client handles it).
    2. Identify relevant documents based on the query.
    3. Group documents by Project or logical Categories derived from the query.
    4. Provide a brief 1-sentence description for why the document matched.
    5. 'source' and 'target' in links must match node 'id's.
  `;

  const prompt = `
    User Query: "${query}"
    
    Available Documents:
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
    // Fallback: simple text match if AI fails
    const lowerQuery = query.toLowerCase();
    const matchedDocs = documents.filter(d => 
      d.title.toLowerCase().includes(lowerQuery) || 
      d.content.toLowerCase().includes(lowerQuery) ||
      d.project.toLowerCase().includes(lowerQuery)
    );

    const nodes: Node[] = matchedDocs.map(d => ({
      id: d.id,
      name: d.title,
      type: NodeType.DOCUMENT,
      val: 10,
      description: d.content.substring(0, 50) + "..."
    }));

    const links: Link[] = matchedDocs.map(d => ({
      source: 'root', // Client-side root ID
      target: d.id,
      value: 1
    }));

    return { nodes, links };
  }
};

export const getDocumentSummary = async (doc: Document): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Summarize this document in 2 sentences: ${doc.content}`,
    });
    return response.text || "No summary available.";
  } catch (e) {
    return "Could not generate summary.";
  }
};