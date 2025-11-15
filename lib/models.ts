// Available models configuration for Vercel AI SDK
// Each model entry includes provider, model ID, and display name

export interface ModelConfig {
  id: string
  name: string
  provider: 'openai' | 'anthropic' | 'google' | 'mistral' | 'ollama'
  modelId: string
  baseURL?: string  // For custom endpoints like Ollama
  isLocal?: boolean  // Indicates if this is a local model
}

export const AVAILABLE_MODELS: ModelConfig[] = [
  // OpenAI Models
  { id: 'openai-gpt-4o', name: 'OpenAI GPT-4o', provider: 'openai', modelId: 'gpt-4o' },
  { id: 'openai-gpt-4o-mini', name: 'OpenAI GPT-4o Mini', provider: 'openai', modelId: 'gpt-4o-mini' },
  { id: 'openai-gpt-4-turbo', name: 'OpenAI GPT-4 Turbo', provider: 'openai', modelId: 'gpt-4-turbo' },
  { id: 'openai-gpt-4', name: 'OpenAI GPT-4', provider: 'openai', modelId: 'gpt-4' },
  { id: 'openai-gpt-3.5-turbo', name: 'OpenAI GPT-3.5 Turbo', provider: 'openai', modelId: 'gpt-3.5-turbo' },
  { id: 'openai-o1-preview', name: 'OpenAI O1 Preview', provider: 'openai', modelId: 'o1-preview' },
  { id: 'openai-o1-mini', name: 'OpenAI O1 Mini', provider: 'openai', modelId: 'o1-mini' },
  { id: 'openai-o3-mini', name: 'OpenAI O3 Mini', provider: 'openai', modelId: 'o3-mini' },
  
  // Anthropic Models
  { id: 'anthropic-claude-3-5-sonnet-20241022', name: 'Anthropic Claude 3.5 Sonnet', provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022' },
  { id: 'anthropic-claude-3-5-haiku-20241022', name: 'Anthropic Claude 3.5 Haiku', provider: 'anthropic', modelId: 'claude-3-5-haiku-20241022' },
  { id: 'anthropic-claude-3-opus-20240229', name: 'Anthropic Claude 3 Opus', provider: 'anthropic', modelId: 'claude-3-opus-20240229' },
  { id: 'anthropic-claude-3-sonnet-20240229', name: 'Anthropic Claude 3 Sonnet', provider: 'anthropic', modelId: 'claude-3-sonnet-20240229' },
  { id: 'anthropic-claude-3-haiku-20240307', name: 'Anthropic Claude 3 Haiku', provider: 'anthropic', modelId: 'claude-3-haiku-20240307' },
  
  // Google Models
  { id: 'google-gemini-2.0-flash-exp', name: 'Google Gemini 2.0 Flash (Experimental)', provider: 'google', modelId: 'gemini-2.0-flash-exp' },
  { id: 'google-gemini-1.5-pro', name: 'Google Gemini 1.5 Pro', provider: 'google', modelId: 'gemini-1.5-pro' },
  { id: 'google-gemini-1.5-flash', name: 'Google Gemini 1.5 Flash', provider: 'google', modelId: 'gemini-1.5-flash' },
  { id: 'google-gemini-pro', name: 'Google Gemini Pro', provider: 'google', modelId: 'gemini-pro' },
  
  // Mistral Models
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', modelId: 'mistral-large-latest' },
  { id: 'mistral-medium-latest', name: 'Mistral Medium', provider: 'mistral', modelId: 'mistral-medium-latest' },
  { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', modelId: 'mistral-small-latest' },
  
  // Ollama Models (Local)
  // Note: These require Ollama to be installed and running locally (ollama.ai)
  // The baseURL points to Ollama's OpenAI-compatible API endpoint
  { 
    id: 'ollama-llama3.2', 
    name: 'Llama 3.2 (Local)', 
    provider: 'ollama', 
    modelId: 'llama3.2',
    baseURL: 'http://localhost:11434/v1',
    isLocal: true
  },
  { 
    id: 'ollama-llama3.1', 
    name: 'Llama 3.1 (Local)', 
    provider: 'ollama', 
    modelId: 'llama3.1',
    baseURL: 'http://localhost:11434/v1',
    isLocal: true
  },
  { 
    id: 'ollama-mistral', 
    name: 'Mistral 7B (Local)', 
    provider: 'ollama', 
    modelId: 'mistral',
    baseURL: 'http://localhost:11434/v1',
    isLocal: true
  },
  { 
    id: 'ollama-codellama', 
    name: 'Code Llama (Local)', 
    provider: 'ollama', 
    modelId: 'codellama',
    baseURL: 'http://localhost:11434/v1',
    isLocal: true
  },
  { 
    id: 'ollama-phi3', 
    name: 'Phi-3 (Local)', 
    provider: 'ollama', 
    modelId: 'phi3',
    baseURL: 'http://localhost:11434/v1',
    isLocal: true
  },
  { 
    id: 'ollama-gemma2', 
    name: 'Gemma 2 (Local)', 
    provider: 'ollama', 
    modelId: 'gemma2',
    baseURL: 'http://localhost:11434/v1',
    isLocal: true
  },
]

export const DEFAULT_MODEL = 'openai-gpt-4o-mini'

export function getModelById(id: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find(model => model.id === id)
}


