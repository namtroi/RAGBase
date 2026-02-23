# RAG Implementation: LangSmith + HITL Evaluation

This doc outlines the implementation of **Human-in-the-Loop (HITL) Evaluation** using LangSmith.

**Goal:** Capture real user feedback (👍/👎), trace execution, and build a Golden Dataset for regression testing.

## 1. Configuration (Env Vars)

Add to `.env` (Backend & AI Worker):

```bash
# Enable LangSmith Tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY="<your-langsmith-api-key>"
LANGCHAIN_PROJECT="ragbase-prod"  # specific project name
```

## 2. Backend Implementation (`apps/backend`)

### A. Return `run_id` in Chat Response

Modify `src/routes/query/search-route.ts`:

1.  Capture the `run_id` from the LangChain chain execution.
2.  Return it to the frontend.

```typescript
// Pseudo-code implementation
const chain = RunnableSequence.from([...]);

// Need to pass callbacks to capture run ID
const result = await chain.invoke(query, {
  callbacks: [{
    handleChainStart(chain, inputs, runId) {
      // Capture runId for response
      currentRunId = runId; 
    }
  }]
});

return reply.send({
  answer: result.content,
  runId: currentRunId // <--- CRITICAL: Send this to Client
});
```

### B. Create Feedback Endpoint

Create `src/routes/feedback/submit-route.ts`:

```typescript
import { Client } from "langsmith";

const client = new Client();

fastify.post('/api/feedback', async (req, reply) => {
  const { runId, score, comment } = req.body; // score: 1 (like) or 0 (dislike)

  await client.createFeedback(runId, "user-score", {
    score: score,
    comment: comment,
  });

  return { success: true };
});
```

## 3. Frontend Implementation (`apps/frontend`)

### A. Capture `runId`

Update chat state to store `runId` alongside message content.

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  runId?: string; // New field
}
```

### B. Feedback UI

Add Thumbs Up/Down buttons to Assistant messages.

```tsx
// On Click Thumbs Down
const sendFeedback = async (messageId, runId) => {
  await fetch('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({
      runId: runId,      // The trace ID from backend
      score: 0,          // 0 = Thumbs Down
      comment: "Incorrect answer" // Optional user input
    })
  });
};
```

## 4. Review Workflow (The "Loop")

### Weekly Ritual
1.  **Open LangSmith UI** -> Go to **Annotation Queues** (or Filter runs by `feedback:user-score=0`).
2.  **Review Negative Runs:**
    *   Inspect retrieval steps.
    *   Check generated answer.
3.  **Correct & Add to Dataset:**
    *   Write the *correct* answer.
    *   Click "Add to Dataset" -> `ragbase-golden-dataset`.
4.  **Bot Improvement:**
    *   Use dataset to run regression tests on code changes.
