# Agent Architecture Design: RAGBase

## Core Agents Overview

1. **PII Redaction Agent (The Privacy Firewall)**
   - **Trigger:** Immediate upon query receipt.
   - **Action:** Scans and anonymizes PII (names, A-numbers, SSNs).
   - **Purpose:** Prevents sensitive data from hitting core reasoning LLMs. Total compliance (HIPAA, GDPR, attorney-client privilege).

2. **Clarification & Refinement Agent (The Search Architect)**
   - **Trigger:** Receives redacted query.
   - **Action:** Translates complex, multi-layered expert questions into highly optimized search parameters.
   - **Purpose:** Guides hybrid search pipeline to pinpoint exact precedents, clauses, or historical context.

3. **Synthesis & Citation Agent (The Domain Expert)**
   - **Trigger:** Receives retrieved documents and refined query.
   - **Action:** Analyzes documents, constructs logical research memos.
   - **Purpose:** Maps every claim to exact, line-by-line citations from real-time trusted sources. No black-box answers.

4. **Evaluation Agent (The Anti-Hallucination Reviewer)**
   - **Trigger:** Receives draft memo from Synthesis Agent.
   - **Action:** Cross-references synthesized output against original retrieved source texts.
   - **Purpose:** Detects logical leaps or fabrications. Forces rewrite if inconsistent. Guarantees 100% verifiable output.

## System Interaction Flow

```mermaid
graph TD
    Q[Raw Lawyer Query] --> Ag1[1. PII Redaction Agent]
    Ag1 -->|Redacted Query| Ag2[2. Clarification & Refinement Agent]
    Ag2 -->|Search Parameters| DB[(Vector/Hybrid Search)]
    DB -->|Retrieved Statutes/Precedents| Ag3[3. Synthesis & Citation Agent]
    Ag1 -.->|Original Intent| Ag3
    Ag3 -->|Draft Research Memo| Ag4[4. Evaluation Agent]
    Ag4 -->|Inconsistency Detected| Ag3
    Ag4 -->|100% Verified| Restore[De-Redaction]
    Restore --> Final[Professional Final Report]
    
    classDef agent fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    class Ag1,Ag2,Ag3,Ag4 agent;
```
