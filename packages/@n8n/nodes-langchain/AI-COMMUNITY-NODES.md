# Community Nodes for n8n

## Design Principles

### 1. Stable Interfaces, Hidden Implementation

Community nodes code against n8n-defined interfaces. Implementation details (LangChain, future alternatives) are encapsulated.

```typescript
// ✅ Community node imports
import { createChatModel, ChatModelOptions } from '@n8n/ai-node-sdk';

// ❌ Community node NEVER imports
import { ChatOpenAI } from '@langchain/openai';  // Forbidden
```

### 2. Peer Dependency with Runtime Injection

The new `@n8n/ai-node-sdk` package is declared as a **peer dependency** in community nodes. This follows the same proven pattern n8n already uses for `n8n-workflow`.

```json
{
  "peerDependencies": {
    "n8n-workflow": "*",
    "@n8n/ai-node-sdk": "*"
  }
}
```

#### How n8n's Peer Dependency Mechanism Works

This is a critical architectural detail. When n8n installs a community package, it **strips peer dependencies** before running `npm install`:

```typescript
// From packages/cli/src/modules/community-packages/community-packages.service.ts

// Strip dev, optional, and peer dependencies before running `npm install`
const {
  devDependencies,
  peerDependencies,      // ← REMOVED from package.json
  optionalDependencies,
  ...packageJson
} = JSON.parse(packageJsonContent);

await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
await executeNpmCommand(['install', ...this.getNpmInstallArgs()], { cwd: packageDirectory });
```

#### Why This Pattern Works

| Concern | Solution |
|---------|----------|
| **Type safety during development** | npm installs SDK for types/autocomplete |
| **No duplicate packages at runtime** | n8n strips peer deps before install |
| **Version alignment guaranteed** | Runtime always uses n8n's bundled SDK |
| **LangChain hidden from community** | SDK's LangChain adapters use n8n's LC version |

#### Package Must Be Published to npm

`@n8n/ai-node-sdk` **must be published to npm** so that:

1. Community developers can `npm install` it during development
2. TypeScript can resolve types for `import { ... } from '@n8n/ai-node-sdk'`
3. IDE features (autocomplete, go-to-definition) work properly

However, the **published version is only used for development**. At runtime, n8n's bundled version is always used, ensuring perfect version alignment.

**Community node publishing:**

Community nodes are published to npm as normal n8n community packages. AI nodes follow the same submission process as regular community nodes with additional validation:
- Must declare `@n8n/ai-node-sdk` as peer dependency
- Must output correct connection types (e.g., `NodeConnectionTypes.AiMemory`)
- Must not import LangChain packages directly
- Security review includes checking for credential leaks and malicious network calls

### 3. Minimal Surface Area

Inspired by Vercel AI SDK's approach: expose few, powerful primitives rather than many specific options.

| Component | Factory Function | Phase |
|-----------|------------------|-------|
| Chat Models | `createChatModel()` | Initial |
| Memory | `createMemory()` | Initial |
| Embeddings | `createEmbeddings()` | Future |
| Vector Stores | `createVectorStore()` | Future |
| Tools | `createTool()` | Future |

### 4. Composition Over Configuration

Use composable building blocks instead of monolithic configuration objects:

```typescript
// ✅ Composable
const memory = createMemory(this, {
  type: 'bufferWindow',
  chatHistory: new MyChatHistory(connectionString),
  k: 10,
});

// ❌ Monolithic
const memory = createMemory(this, {
  type: 'postgres',
  host: '...',
  port: 5432,
  database: '...',
  // 20 more connection options
});
```

### 5. Progressive Disclosure

Simple cases are simple. Complex cases are possible.

```typescript
// Simple: OpenAI-compatible model
const model = createChatModel(this, {
  type: 'openaiCompatible',
  apiKey: credentials.apiKey,
  baseUrl: 'https://api.example.com/v1',
  model: 'my-model',
});

// Complex: Fully custom model
const model = createChatModel(this, {
  type: 'custom',
  name: 'my-custom-model',
  invoke: async (messages, options) => { /* ... */ },
});
```

---

## Proposed Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               COMMUNITY NODE                                        │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │  import { createMemory, ChatHistory } from '@n8n/ai-node-sdk';              │    │
│  │                                                                             │    │
│  │  class MyChatHistory implements ChatHistory { /* storage logic */ }         │    │
│  │                                                                             │    │
│  │  supplyData() {                                                             │    │
│  │    const memory = createMemory(this, { chatHistory: new MyChatHistory() }); │    │
│  │    return { response: memory };                                             │    │
│  │  }                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        │
                                        │ Uses as peer dependency
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            @n8n/ai-node-sdk (NEW)                                   │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │ EXPORTS (Public API - Stable Contract)                                       │   │
│  │                                                                              │   │
│  │ // Factory Functions                                                         │   │
│  │ export { createChatModel } from './factories/chatModel';                     │   │
│  │ export { createMemory } from './factories/memory';                           │   │
│  │                                                                              │   │
│  │ // Interfaces for Extension                                                  │   │
│  │ export { ChatHistory } from './types/chatHistory';                           │   │
│  │                                                                              │   │
│  │ // Types                                                                     │   │
│  │ export type { Message, ChatModelOptions, ... } from './types';               │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│                                        │                                            │
│                                        │ Internal Implementation                    │
│                                        ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │ ADAPTERS (Internal - Hidden from Community)                                  │   │
│  │                                                                              │   │
│  │ // Bridges n8n types ↔ LangChain types                                       │   │
│  │ class ChatHistoryAdapter extends BaseChatMessageHistory { }                  │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────┬─────────────────────────────────────────────┘
                                        │
                                        │ Returns LangChain objects
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               AI AGENT (Existing)                                   │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │  const memory = await getInputConnectionData(AiMemory);  // Gets LC object   │   │
│  │  const model = await getInputConnectionData(AiLanguageModel);                │   │
│  │                                                                              │   │
│  │  // Works exactly as before - no changes needed                              │   │
│  │  const agent = createToolsAgent({ model, memory, tools });                   │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/
├── @n8n/ai-node-sdk/              # NEW: Published to npm
│   ├── src/
│   │   ├── index.ts               # Public exports only
│   │   ├── types/
│   │   │   ├── messages.ts        # Message, ContentBlock, MessageRole
│   │   │   ├── tools.ts           # Tool, ToolCall, ToolChoice
│   │   │   ├── results.ts         # GenerateResult, StreamChunk
│   │   │   ├── chatModel.ts       # ChatModel, ChatModelConfig, ChatModelOptions
│   │   │   ├── memory.ts          # MemoryOptions
│   │   │   └── chatHistory.ts     # ChatHistory interface
│   │   ├── factories/             # Factory functions
│   │   │   ├── chatModel.ts       # createChatModel()
│   │   │   └── memory.ts          # createMemory()
│   │   ├── utils/                 # Utility functions
│   │   │   ├── toolConversion.ts  # toOpenAITool, toAnthropicTool, etc.
│   │   │   └── schema.ts          # zodToJsonSchema, parseToolArguments
│   │   └── adapters/              # Internal LangChain adapters (not exported)
│   │       ├── chatModelAdapter.ts
│   │       └── chatHistoryAdapter.ts
│   ├── package.json
│   └── tsconfig.json
│
└── @n8n/nodes-langchain/          # EXISTING: Internal use
    └── ...                        # Unchanged
```

### Data Flow

```
                     ┌──────────────────┐
                     │  Community Node  │
                     │  supplyData()    │
                     └────────┬─────────┘
                              │ createChatModel(this, options)
                              ▼
                     ┌──────────────────┐
                     │  @n8n/ai-node-sdk│
                     │  Factory         │
                     └────────┬─────────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
  │ OpenAI-         │ │ Custom          │ │ Future:         │
  │ Compatible      │ │ (generate/      │ │ Anthropic,      │
  │ Handler         │ │  stream funcs)  │ │ Google, etc.    │
  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
           │                   │                   │
           └───────────────────┼───────────────────┘
                               │
                               ▼
                     ┌──────────────────┐
                     │ ChatModelAdapter │  ← Internal, wraps as LangChain BaseChatModel
                     │ (LangChain)      │
                     └────────┬─────────┘
                              │ returns LangChain-compatible object
                              ▼
                     ┌──────────────────┐
                     │   AI Agent       │  ← Existing n8n node, unchanged
                     │   (existing)     │
                     └──────────────────┘
```

**Message Conversion Flow:**

```
Community Node                    SDK Internal                      LangChain
─────────────────────────────────────────────────────────────────────────────────
Message[]           ──────►    Adapter converts to    ──────►    BaseMessage[]
(ContentBlock-based)           LangChain format

                    ◄──────    Adapter converts from  ◄──────    AIMessage/ChatResult
GenerateResult                 LangChain format
(text, usage, toolCalls)
```

---

## API Design

### Core Types

#### Messages with Structured Content Blocks

Modern LLMs return structured content: text, reasoning traces, images, tool calls. The SDK uses content blocks to handle all cases cleanly.

```typescript
// types/messages.ts

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Content block types - each message contains one content block.
 * Multi-block messages (e.g., text + tool call) become multiple Message objects.
 */
export type ContentBlock =
  | TextContent
  | ReasoningContent
  | FileContent
  | ToolCallContent
  | ToolResultContent;

export interface TextContent {
  type: 'text';
  text: string;
  metadata?: Record<string, unknown>;
}

export interface ReasoningContent {
  type: 'reasoning';
  text: string;
  metadata?: Record<string, unknown>;
}

export interface FileContent {
  type: 'file';
  /** IANA media type, e.g. 'image/png', 'audio/mp3' */
  mediaType: string;
  /** Base64 string or binary data */
  data: string | Uint8Array;
  metadata?: Record<string, unknown>;
}

export interface ToolCallContent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  /** Stringified JSON arguments */
  input: string;
  metadata?: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool-result';
  toolCallId: string;
  result: unknown;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: MessageRole;
  content: ContentBlock;
  name?: string;
}
```

#### Tools

```typescript
// types/tools.ts

import type { ZodTypeAny } from 'zod';

/** JSON Schema for tool parameters */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

export interface Tool {
  name: string;
  description?: string;
  /** JSON Schema or Zod schema for parameters */
  parameters: JSONSchema | ZodTypeAny;
  /** If true, model must follow schema strictly */
  strict?: boolean;
  /** Optional execution function for automatic tool handling */
  execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  argumentsRaw?: string;
}

export type ToolChoice =
  | 'auto'      // Model decides
  | 'required'  // Must call at least one tool
  | 'none'      // Must not call tools
  | { type: 'tool'; toolName: string };  // Force specific tool
```

#### Generation Results

```typescript
// types/results.ts

export interface GenerateResult {
  /** Provider-specific response ID */
  id?: string;
  /** Generated text content */
  text: string;
  /** Why generation stopped */
  finishReason?: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';
  /** Token usage for monitoring/billing */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Tool calls made by the model */
  toolCalls?: ToolCall[];
  /** Raw provider response for debugging */
  rawResponse?: unknown;
}

export interface StreamChunk {
  type: 'text-delta' | 'tool-call-delta' | 'finish' | 'error';
  /** Text fragment for streaming display */
  textDelta?: string;
  /** Partial tool call for progressive assembly */
  toolCallDelta?: {
    id?: string;
    name?: string;
    argumentsDelta?: string;
  };
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: unknown;
}
```

#### ChatModel Interface

This is the core contract that all chat models implement internally. Community developers using `custom` type provide functions matching this interface.

```typescript
// types/chatModel.ts

export interface ChatModel {
  /** Provider identifier (e.g., 'openai', 'anthropic', 'custom') */
  provider: string;
  /** Model identifier (e.g., 'gpt-4', 'claude-3-sonnet') */
  modelId: string;

  /** Generate a completion (non-streaming) */
  generate(messages: Message[], config?: ChatModelConfig): Promise<GenerateResult>;

  /** Generate a completion (streaming) */
  stream(messages: Message[], config?: ChatModelConfig): AsyncIterable<StreamChunk>;

  /** Return a new model instance with tools bound */
  withTools(tools: Tool[]): ChatModel;
}

export interface ChatModelConfig {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  timeout?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
  tools?: Tool[];
  toolChoice?: ToolChoice;
  /** Provider-specific options */
  providerOptions?: Record<string, unknown>;
}
```

#### Chat Model Options (Factory Input)

```typescript
// types/chatModelOptions.ts

export type ChatModelOptions =
  | OpenAICompatibleModelOptions
  | CustomChatModelOptions;

/**
 * For models implementing the OpenAI API spec.
 * Covers: OpenAI, Azure OpenAI, Ollama, LM Studio, vLLM, Together AI, etc.
 */
export interface OpenAICompatibleModelOptions {
  type: 'openaiCompatible';
  
  // Required
  apiKey: string;
  model: string;
  
  // Optional - defaults to OpenAI
  baseUrl?: string;
  
  // Common parameters
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  
  // Advanced
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

/**
 * For models with non-OpenAI APIs.
 * Implement generate() and optionally stream() for full control.
 */
export interface CustomChatModelOptions {
  type: 'custom';
  
  /** Model identifier for logging/display */
  name: string;
  
  /** Required: generate a response from messages */
  generate: (
    messages: Message[],
    config?: ChatModelConfig
  ) => Promise<GenerateResult>;
  
  /** Optional: streaming support for real-time token display */
  stream?: (
    messages: Message[],
    config?: ChatModelConfig
  ) => AsyncIterable<StreamChunk>;
  
  /** Optional: bind tools for function calling */
  withTools?: (tools: Tool[]) => CustomChatModelOptions;
}
```

#### Memory Options

```typescript
// types/memory.ts

export type MemoryOptions =
  | BufferMemoryOptions
  | BufferWindowMemoryOptions
  | TokenBufferMemoryOptions;

interface BaseMemoryOptions {
  chatHistory: ChatHistory;
  memoryKey?: string;       // Default: 'chat_history'
  inputKey?: string;        // Default: 'input'
  outputKey?: string;       // Default: 'output'
  returnMessages?: boolean; // Default: true
  humanPrefix?: string;     // Default: 'Human'
  aiPrefix?: string;        // Default: 'AI'
}

export interface BufferMemoryOptions extends BaseMemoryOptions {
  type: 'buffer';
}

export interface BufferWindowMemoryOptions extends BaseMemoryOptions {
  type: 'bufferWindow';
  k: number; // Number of recent messages to keep
}

export interface TokenBufferMemoryOptions extends BaseMemoryOptions {
  type: 'tokenBuffer';
  maxTokenLimit: number;
}
```

#### Execution Context and Logging

All factory functions require the node execution context (`this` from `supplyData`) as the first parameter. The factory automatically wraps the returned object with n8n's `logWrapper`, enabling execution logging in the workflow UI.

```typescript
// Opaque return types - avoid exposing LangChain in the public API
// Internally these are LangChain objects, but the type hides this detail
// Community developers should treat these as opaque and only pass them via supplyData
type ChatModelInstance = unknown;
type MemoryInstance = unknown;

// Factory signatures - context first, then options
function createChatModel(
  context: ISupplyDataFunctions,
  options: ChatModelOptions
): ChatModelInstance;

function createMemory(
  context: ISupplyDataFunctions,
  options: MemoryOptions
): MemoryInstance;

// Usage in supplyData - same pattern for all factories
const memory = createMemory(this, {
  type: 'bufferWindow',
  chatHistory,
  k: 10,
});

const model = createChatModel(this, {
  type: 'openaiCompatible',
  apiKey,
  model: 'gpt-4',
});

return { response: memory };  // Already wrapped - no manual logWrapper needed
```

**Why require context?**

| Concern | Decision |
|---------|----------|
| Execution logging needed | Context enables automatic `logWrapper` for both models and memory |
| Consistent error handling and tracing | Context provides hooks |
| `this` is always available in `supplyData` | No reason to make it optional |
| Community devs shouldn't need internal details | Factory handles wrapping |

#### Interfaces for Extension

```typescript
// types/chatHistory.ts

/**
 * Interface for custom chat message storage.
 * Community nodes implement this for their storage backends.
 */
export interface ChatHistory {
  /** Retrieve all messages from storage. */
  getMessages(): Promise<Message[]>;

  /** Add a single message to storage. */
  addMessage(message: Message): Promise<void>;

  /** 
   * Add multiple messages to storage.
   * Optional - SDK provides default implementation if omitted.
   */
  addMessages?(messages: Message[]): Promise<void>;

  /** Clear all messages from storage. */
  clear(): Promise<void>;
}
```

The SDK handles missing `addMessages` internally:

```typescript
// Inside createMemory() factory
const addMessages = chatHistory.addMessages?.bind(chatHistory)
  ?? async (msgs: Message[]) => {
    for (const m of msgs) await chatHistory.addMessage(m);
  };
```

#### Tool Conversion Utilities

The SDK provides utilities to convert between different tool formats. These are useful when implementing custom models that call provider APIs directly.

```typescript
// utils/toolConversion.ts (exported)

/**
 * Convert SDK Tool to OpenAI function format.
 * Use when calling OpenAI-compatible APIs in custom model implementations.
 */
export function toOpenAITool(tool: Tool): {
  type: 'function';
  function: { name: string; description?: string; parameters: JSONSchema };
};

/**
 * Convert SDK Tool to Anthropic format.
 * Use when calling Anthropic API in custom model implementations.
 */
export function toAnthropicTool(tool: Tool): {
  name: string;
  description?: string;
  input_schema: JSONSchema;
};

/**
 * Convert SDK ToolChoice to provider-specific format.
 */
export function toProviderToolChoice(
  choice: ToolChoice,
  provider: 'openai' | 'anthropic' | 'google'
): unknown;

/**
 * Convert Zod schema to JSON Schema (for tool parameters).
 */
export function zodToJsonSchema(schema: ZodTypeAny): JSONSchema;

/**
 * Safely parse tool arguments from JSON string.
 */
export function parseToolArguments(argumentsString: string): Record<string, unknown>;
```

> **Note:** Conversion to LangChain format (`toLangChainTool`) is handled internally by the SDK's adapter layer and is **not exported**. Community developers never need to interact with LangChain types directly.

---

## Code Examples

### Example 1: Memory Node with SDK (Internal)

This example shows how an **internal n8n node** would use the SDK. Internal nodes can use third-party packages like `ioredis`. Community nodes would need to use HTTP-based APIs (e.g., Upstash REST API) instead.

```typescript
// nodes/MemoryRedis/MemoryRedis.node.ts

import {
  NodeConnectionTypes,
  type INodeType,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  type SupplyData,
} from 'n8n-workflow';
import {
  createMemory,
  ChatHistory,
  type Message,
} from '@n8n/ai-node-sdk';
import Redis from 'ioredis';

// Step 1: Implement ChatHistory for Redis
class RedisChatHistory implements ChatHistory {
  private client: Redis;
  private sessionId: string;
  private ttl: number;

  constructor(options: { client: Redis; sessionId: string; ttl?: number }) {
    this.client = options.client;
    this.sessionId = options.sessionId;
    this.ttl = options.ttl ?? 3600; // 1 hour default
  }

  private get key(): string {
    return `n8n:chat:${this.sessionId}`;
  }

  async getMessages(): Promise<Message[]> {
    const data = await this.client.lrange(this.key, 0, -1);
    return data.map((item) => JSON.parse(item));
  }

  async addMessage(message: Message): Promise<void> {
    await this.client.rpush(this.key, JSON.stringify(message));
    await this.client.expire(this.key, this.ttl);
  }

  async clear(): Promise<void> {
    await this.client.del(this.key);
  }
}

// Step 2: Implement the n8n node
export class MemoryRedis implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Redis Memory',
    name: 'memoryRedis',
    group: ['transform'],
    version: 1,
    description: 'Store chat history in Redis',
    defaults: { name: 'Redis Memory' },
    codex: {
      categories: ['AI'],
      subcategories: { AI: ['Memory'] },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiMemory],
    outputNames: ['Memory'],
    credentials: [{ name: 'redis', required: true }],
    properties: [
      {
        displayName: 'Session ID',
        name: 'sessionId',
        type: 'string',
        default: '={{ $json.sessionId }}',
        required: true,
      },
      {
        displayName: 'Context Window',
        name: 'contextWindow',
        type: 'number',
        default: 10,
        description: 'Number of messages to keep in context',
      },
      {
        displayName: 'TTL (seconds)',
        name: 'ttl',
        type: 'number',
        default: 3600,
        description: 'Time-to-live for chat history',
      },
    ],
  };

  async supplyData(
    this: ISupplyDataFunctions,
    itemIndex: number
  ): Promise<SupplyData> {
    const credentials = await this.getCredentials('redis');
    const sessionId = this.getNodeParameter('sessionId', itemIndex) as string;
    const contextWindow = this.getNodeParameter('contextWindow', itemIndex) as number;
    const ttl = this.getNodeParameter('ttl', itemIndex) as number;

    // Create Redis client
    const client = new Redis({
      host: credentials.host as string,
      port: credentials.port as number,
      password: credentials.password as string,
    });

    // Create n8n chat history
    const chatHistory = new RedisChatHistory({ client, sessionId, ttl });

    // Use factory to create LangChain-compatible memory
    const memory = createMemory(this, {
      type: 'bufferWindow',
      chatHistory,
      k: contextWindow,
      returnMessages: true,
    });

    return {
      response: memory,  // Already wrapped with logWrapper
      closeFunction: async () => {
        await client.quit();
      },
    };
  }
}
```

### Example 2: Custom Chat Model (Community-Compatible)

This example shows creating a chat model for a custom API endpoint. Uses `this.helpers.httpRequest()` so it works for both internal and community nodes.

```typescript
// nodes/LmChatCustomProvider/LmChatCustomProvider.node.ts

import {
  NodeConnectionTypes,
  type INodeType,
  type INodeTypeDescription,
  type ISupplyDataFunctions,
  type SupplyData,
} from 'n8n-workflow';
import {
  createChatModel,
  type Message,
  type GenerateResult,
  type StreamChunk,
  type ChatModelConfig,
} from '@n8n/ai-node-sdk';

export class LmChatCustomProvider implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Custom Provider Chat Model',
    name: 'lmChatCustomProvider',
    group: ['transform'],
    version: 1,
    description: 'Use custom AI provider',
    defaults: { name: 'Custom Provider' },
    codex: {
      categories: ['AI'],
      subcategories: { AI: ['Language Models'] },
    },
    inputs: [],
    outputs: [NodeConnectionTypes.AiLanguageModel],
    outputNames: ['Model'],
    credentials: [{ name: 'customProviderApi', required: true }],
    properties: [
      {
        displayName: 'Model',
        name: 'model',
        type: 'string',
        default: 'custom-model-v1',
        required: true,
      },
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        default: 0.7,
        typeOptions: { minValue: 0, maxValue: 2 },
      },
    ],
  };

  async supplyData(
    this: ISupplyDataFunctions,
    itemIndex: number
  ): Promise<SupplyData> {
    const credentials = await this.getCredentials('customProviderApi');
    const modelName = this.getNodeParameter('model', itemIndex) as string;
    const temperature = this.getNodeParameter('temperature', itemIndex) as number;

    const baseUrl = credentials.baseUrl as string;
    const apiKey = credentials.apiKey as string;

    // Option A: If OpenAI-compatible, use simple config
    if (credentials.isOpenAICompatible) {
      const model = createChatModel(this, {
        type: 'openaiCompatible',
        apiKey,
        baseUrl,
        model: modelName,
        temperature,
      });
      return { response: model };
    }

    // Option B: Custom API - implement generate/stream
    const model = createChatModel(this, {
      type: 'custom',
      name: modelName,

      generate: async (messages: Message[], config?: ChatModelConfig): Promise<GenerateResult> => {
        // Convert structured messages to API format
        const apiMessages = messages.map((m) => ({
          role: m.role,
          content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content),
        }));

        const data = await this.helpers.httpRequest({
          method: 'POST',
          url: `${baseUrl}/v1/chat`,
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: {
            model: modelName,
            messages: apiMessages,
            temperature: config?.temperature ?? temperature,
            max_tokens: config?.maxTokens,
          },
        });

        const choice = data.choices[0];
        return {
          text: choice.message.content ?? '',
          finishReason: choice.finish_reason === 'stop' ? 'stop' : 'other',
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          } : undefined,
          toolCalls: choice.message.tool_calls?.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          })),
          rawResponse: data,
        };
      },

      // Optional: streaming support for real-time token display
      stream: async function* (messages: Message[], config?: ChatModelConfig): AsyncIterable<StreamChunk> {
        // Convert messages to API format
        const apiMessages = messages.map((m) => ({
          role: m.role,
          content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content),
        }));

        const response = await fetch(`${baseUrl}/v1/chat`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            messages: apiMessages,
            temperature: config?.temperature ?? temperature,
            stream: true,
          }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) return;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          // Parse SSE format: "data: {...}\n\n"
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
            
            const data = JSON.parse(line.slice(6));
            const delta = data.choices[0]?.delta;
            
            if (delta?.content) {
              yield { type: 'text-delta', textDelta: delta.content };
            }
          }
        }

        yield { type: 'finish', finishReason: 'stop' };
      },
    });

    return { response: model };
  }
}
```

---

## Migration Strategy

### Phase 1: Foundation

1. **Create `@n8n/ai-node-sdk` package**
   - Define all public types and interfaces
   - Implement `ChatHistory` base class (for memory nodes)
   - Create factory functions with LangChain adapters

2. **Migrate internal nodes as proof-of-concept**
   - `MemoryPostgres` → Use new SDK
   - `LmChatOpenAi` → Verify OpenAI-compatible path works
   - Validate no regressions

### Phase 2: Core Adapters

1. **Implement factory functions**
   - `createChatModel()` with OpenAI-compatible and custom paths
   - `createMemory()` with buffer, bufferWindow, tokenBuffer types

2. **Add comprehensive test coverage**
   - Unit tests for adapters
   - Integration tests with real LangChain objects
   - E2E tests with sample community nodes

### Phase 3: Documentation & Launch

1. **Developer documentation**
   - Getting started guide
   - API reference
   - Example nodes for each type

2. **Community guidelines**
   - Publishing requirements
   - Security review process
   - Versioning policy

### Phase 4: Gradual Internal Migration (Ongoing)

Optionally migrate existing n8n AI nodes to use the SDK internally, ensuring the same code path for both internal and community nodes.

---

## Backwards Compatibility

### For Existing Workflows

**Zero breaking changes.** The new SDK is additive:

- Existing nodes continue using direct LangChain imports
- AI Agent and chains receive the same LangChain objects
- `logWrapper()` is handled internally by factory functions (community devs don't need to know about it)
