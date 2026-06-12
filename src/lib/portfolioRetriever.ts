import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document } from "@langchain/core/documents";
import { OllamaEmbeddings } from "@langchain/ollama";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

type PortfolioProject = {
  name: string;
  category: string;
  industries?: string[];
  services?: string[];
  summary: string;
  bestFor: string;
};

async function readPortfolioProjects(): Promise<PortfolioProject[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "portfolio.json");
    console.log("[RAG] Portfolio retrieval started");
    console.log("[RAG] process.cwd():", process.cwd());
    console.log("[RAG] data/portfolio.json path:", filePath);
    const raw = await readFile(filePath, "utf8");
    console.log("[RAG] Portfolio file read successfully");
    console.log("[RAG] Raw JSON length:", raw.length);
    const parsed = JSON.parse(raw) as unknown;
    const projects = Array.isArray(parsed) ? (parsed as PortfolioProject[]) : [];
    console.log("[RAG] Number of parsed portfolio projects:", projects.length);
    console.log("[RAG] Project names loaded:", projects.map((project) => project.name));
    return projects;
  } catch (error) {
    console.error("[RAG] Error reading portfolio file:", error);
    return [];
  }
}

function buildPortfolioDocument(project: PortfolioProject): Document {
  const industries = Array.isArray(project.industries) ? project.industries.join(", ") : "";
  const services = Array.isArray(project.services) ? project.services.join(", ") : "";

  return new Document({
    pageContent: [
      `Name: ${project.name}`,
      `Category: ${project.category}`,
      `Industries: ${industries}`,
      `Services: ${services}`,
      `Summary: ${project.summary}`,
      `Best For: ${project.bestFor}`,
    ]
      .filter(Boolean)
      .join("\n"),
    metadata: {
      name: project.name,
      category: project.category,
      industries: project.industries ?? [],
      services: project.services ?? [],
      bestFor: project.bestFor,
    },
  });
}

export async function getRelevantPortfolioContext(leadInput: string): Promise<string> {
  try {
    const projects = await readPortfolioProjects();

    if (projects.length === 0) {
      return "No portfolio projects were found in data/portfolio.json.";
    }

    const docs = projects.map(buildPortfolioDocument);
    console.log("[RAG] Number of LangChain Documents created:", docs.length);
    console.log("[RAG] Before initializing OllamaEmbeddings");
    const embeddings = new OllamaEmbeddings({
      model: "nomic-embed-text",
      baseUrl: "http://localhost:11434",
    });

    console.log("[RAG] Before creating MemoryVectorStore");
    const store = await MemoryVectorStore.fromDocuments(docs, embeddings);
    console.log("[RAG] After MemoryVectorStore is created");

    console.log("[RAG] Before running similarity search");
    const matches = await store.similaritySearch(leadInput, 3);
    console.log("[RAG] Number of search results returned:", matches.length);

    if (matches.length === 0) {
      return "No relevant portfolio matches were found.";
    }

    matches.forEach((doc, index) => {
      console.log("[RAG] Matched document", index + 1, {
        metadata: doc.metadata,
        preview: doc.pageContent.slice(0, 200),
      });
    });

    return matches
      .map((doc, index) => {
        const name = String(doc.metadata.name ?? "Unknown project");
        const category = String(doc.metadata.category ?? "Unknown category");
        const industries = Array.isArray(doc.metadata.industries) ? doc.metadata.industries.join(", ") : "";
        const services = Array.isArray(doc.metadata.services) ? doc.metadata.services.join(", ") : "";
        const bestFor = String(doc.metadata.bestFor ?? "");

        return [
          `${index + 1}. ${name}`,
          `Category: ${category}`,
          industries ? `Industries: ${industries}` : null,
          services ? `Services: ${services}` : null,
          `Best For: ${bestFor}`,
          `Details: ${doc.pageContent}`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
  } catch (error) {
    console.error("[RAG] Exact error:", error);
    throw error;
  }
}
