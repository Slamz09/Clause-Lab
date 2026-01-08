const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export async function generateWithOllama(prompt: string, model: string = 'llama3.2'): Promise<string> {
  const url = `${OLLAMA_BASE_URL}/api/generate`;
  console.log('Calling Ollama at:', url);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama error response:', errorText);
      throw new Error(`Ollama error: ${response.status} - ${errorText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.response;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running (ollama serve)');
    }
    throw error;
  }
}

// Split text into chunks that fit within context limits
function chunkText(text: string, maxChunkSize: number = 2000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      // If a single paragraph is too long, split by sentences
      if (paragraph.length > maxChunkSize) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxChunkSize) {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = sentence;
          } else {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Parse JSON response, handling markdown code blocks
function parseJsonResponse(response: string): any {
  let cleanedContent = response.trim();
  if (cleanedContent.startsWith('```json')) {
    cleanedContent = cleanedContent.slice(7);
  }
  if (cleanedContent.startsWith('```')) {
    cleanedContent = cleanedContent.slice(3);
  }
  if (cleanedContent.endsWith('```')) {
    cleanedContent = cleanedContent.slice(0, -3);
  }
  cleanedContent = cleanedContent.trim();
  return JSON.parse(cleanedContent);
}

export async function extractClausesWithOllama(documentText: string, contractType: string): Promise<any[]> {
  const chunks = chunkText(documentText, 2000);
  console.log(`Document split into ${chunks.length} chunk(s)`);

  const allClauses: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);

    const prompt = `You are a legal document analyst specializing in contract clause extraction.
Your task is to identify and extract distinct legal clauses from the provided document text.

For each clause you identify, provide:
1. clause_type: The type of clause (e.g., "Indemnification", "Limitation of Liability", "Confidentiality", "Termination", "Force Majeure", "Intellectual Property", "Warranty", "Payment Terms", "Non-Compete", "Dispute Resolution", "Governing Law", "Assignment", "Notices", "Severability", "Amendment", "Waiver", "Entire Agreement")
2. clause_text: The full text of the clause
3. preferred_position: A brief summary of the ideal position for this clause (1-2 sentences)
4. party_role: Who this clause primarily favors - "Customer", "Vendor", or "Neutral"
5. complexity: A score from 1-10 indicating how complex this clause is
6. balance: A score from -5 to 5 where -5 is heavily customer-favoring, 0 is balanced, and 5 is heavily vendor-favoring

Extract all legal clauses from this section of a ${contractType || 'contract'} document (part ${i + 1} of ${chunks.length}):

${chunk}

Return ONLY a valid JSON object with a "clauses" array containing the extracted clauses. If no clauses are found in this section, return {"clauses": []}.
Example format: {"clauses": [{"clause_type": "...", "clause_text": "...", "preferred_position": "...", "party_role": "...", "complexity": 5, "balance": 0}]}`;

    try {
      const response = await generateWithOllama(prompt);
      const parsed = parseJsonResponse(response);

      if (parsed.clauses && Array.isArray(parsed.clauses)) {
        allClauses.push(...parsed.clauses);
      }
    } catch (error) {
      console.error(`Error processing chunk ${i + 1}:`, error);
      // Continue with other chunks even if one fails
    }
  }

  // Remove duplicate clauses based on clause_text similarity
  const uniqueClauses = allClauses.filter((clause, index, self) =>
    index === self.findIndex(c =>
      c.clause_text && clause.clause_text &&
      c.clause_text.substring(0, 100) === clause.clause_text.substring(0, 100)
    )
  );

  return uniqueClauses;
}

export async function analyzeClauseWithOllama(clauseText: string, action: string): Promise<any> {
  const prompts: Record<string, string> = {
    analyze: `You are a legal expert analyzing contract clauses. Analyze the following clause for potential risks, ambiguities, and enforceability issues. Return a JSON object with a "risks" array containing 3-5 specific risk items.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"risks": ["risk 1", "risk 2", "risk 3"]}`,

    improve: `You are a legal expert improving contract clauses. Suggest improvements for clarity, protection, and legal soundness for the following clause. Return a JSON object with an "improvements" array containing 3-5 specific improvement suggestions.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"improvements": ["improvement 1", "improvement 2", "improvement 3"]}`,

    alternatives: `You are a legal expert generating alternative clause language. Generate 2-3 alternative versions of the following clause that achieve similar goals but with different wording or emphasis. Return a JSON object with an "alternatives" array.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"alternatives": ["alternative clause 1", "alternative clause 2"]}`,

    balance: `You are a legal expert assessing clause balance. Analyze the following clause to determine whether it favors the customer, vendor, or is neutral. Score from -5 (strongly customer favorable) to +5 (strongly vendor favorable). Return a JSON object with a "balance" object.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"balance": {"score": 0, "explanation": "explanation of why this score was given"}}`,
  };

  const prompt = prompts[action];
  if (!prompt) {
    throw new Error('Invalid action');
  }

  const response = await generateWithOllama(prompt);
  return parseJsonResponse(response);
}

export async function checkOllamaConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function listOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch {
    return [];
  }
}

export async function analyzeClauseWithPlaybook(clauseText: string, action: string, playbookContent: string): Promise<any> {
  const playbookContext = `
PLAYBOOK RULES (You MUST follow these rules when analyzing):
${playbookContent}

---
END OF PLAYBOOK RULES
---

`;

  const prompts: Record<string, string> = {
    analyze: `You are a legal expert analyzing contract clauses according to the company playbook rules provided.

${playbookContext}

Analyze the following clause for potential risks, ambiguities, and enforceability issues. Pay special attention to whether this clause complies with or violates the playbook rules. Return a JSON object with a "risks" array containing 3-5 specific risk items, highlighting any playbook violations.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"risks": ["risk 1", "risk 2", "risk 3"]}`,

    improve: `You are a legal expert improving contract clauses according to the company playbook rules provided.

${playbookContext}

Suggest improvements for clarity, protection, and legal soundness for the following clause. Ensure improvements align with the playbook rules. Return a JSON object with an "improvements" array containing 3-5 specific improvement suggestions.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"improvements": ["improvement 1", "improvement 2", "improvement 3"]}`,

    alternatives: `You are a legal expert generating alternative clause language according to the company playbook rules provided.

${playbookContext}

Generate 2-3 alternative versions of the following clause that achieve similar goals but comply better with the playbook rules. Return a JSON object with an "alternatives" array.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"alternatives": ["alternative clause 1", "alternative clause 2"]}`,

    balance: `You are a legal expert assessing clause balance according to the company playbook rules provided.

${playbookContext}

Analyze the following clause to determine whether it favors the customer, vendor, or is neutral. Also assess if the balance aligns with your playbook guidelines. Score from -5 (strongly customer favorable) to +5 (strongly vendor favorable). Return a JSON object with a "balance" object.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"balance": {"score": 0, "explanation": "explanation of why this score was given and how it relates to playbook rules"}}`,

    compliance: `You are a legal expert checking clause compliance against the company playbook rules provided.

${playbookContext}

Check if the following clause complies with the playbook rules. Return a JSON object with compliance status and specific findings.

Clause: "${clauseText}"

Respond ONLY with valid JSON in this exact format:
{"compliance": {"status": "compliant|non-compliant|needs-review", "findings": ["finding 1", "finding 2"], "recommendations": ["recommendation 1", "recommendation 2"]}}`,
  };

  const prompt = prompts[action];
  if (!prompt) {
    throw new Error('Invalid action');
  }

  const response = await generateWithOllama(prompt);
  return parseJsonResponse(response);
}
