<script lang="ts" setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import { useUserStore } from '@vben/stores';
import { message as antdMessage, Modal } from 'ant-design-vue';
import {
  Button,
  Input,
  Textarea,
  ScrollArea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@vben-core/shadcn-ui';
import { ragChat, ragSessions } from '#/api/rag';
import { getAvailableModels, type AIModel } from '#/api/models';
import { $t } from '#/locales';
import { preferences } from '@vben/preferences';

const userStore = useUserStore();
const currentUserId = computed(() => userStore.userInfo?.id || userStore.userInfo?.username || 'guest');

// Default values (simplified)
const collection = ref<string>('default');
const topK = ref<number>(5);
const systemPrompt = ref<string>('');

// Model selection
const selectedModel = ref<string>('');
const availableModels = ref<Array<{ value: string; label: string }>>([]);
const loadingModels = ref<boolean>(false);

// Load available models from database
async function loadModels() {
  loadingModels.value = true;
  try {
    const res: any = await getAvailableModels();
    let models: AIModel[] = [];
    if (res?.models && Array.isArray(res.models)) {
      models = res.models;
    } else if (res?.data?.models && Array.isArray(res.data.models)) {
      models = res.data.models;
    } else if (Array.isArray(res)) {
      models = res;
    } else {
    }
    
    const enabledModels = models.map((m: any) => ({
      value: m.payloadModel || m.modelKey || m.modelId,
      label: m.name,
    }));
    
    availableModels.value = enabledModels;
    
    // Set default model if available and not already set
    if (enabledModels.length > 0 && !selectedModel.value) {
      const firstModel = enabledModels[0];
      if (firstModel) {
        selectedModel.value = firstModel.value;
      }
    }
    
    
    if (enabledModels.length === 0) {
      antdMessage.warning($t('dashboard.workspace.noEnabledModels'));
    }
  } catch (err: any) {
    console.error('[UI] Load models error:', err);
    console.error('[UI] Error details:', {
      message: err?.message,
      response: err?.response?.data,
      status: err?.response?.status,
    });
    // Fallback to default models if API fails
    availableModels.value = [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ];
    if (!selectedModel.value) {
      selectedModel.value = 'gemini-2.5-flash';
    }
    antdMessage.warning($t('dashboard.workspace.failedToLoadModels'));
  } finally {
    loadingModels.value = false;
  }
}

const sessionId = ref<string>('');
const sessions = ref<any[]>([]);
const messages = ref<any[]>([]);
const input = ref<string>('');
const loading = ref<boolean>(false);
const sending = ref<boolean>(false);
const messagesScrollRef = ref<HTMLElement | null>(null);

// Computed: sort sessions by updatedAt desc
const sortedSessions = computed(() => {
  return [...sessions.value].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
});

// Current session title
const currentSessionTitle = computed(() => {
  if (!sessionId.value) return $t('dashboard.workspace.newChat');
  const s = sessions.value.find(s => s.sessionId === sessionId.value);
  return s?.title || $t('dashboard.workspace.chat');
});

// Current model label
const currentModelLabel = computed(() => {
  return availableModels.value.find(m => m.value === selectedModel.value)?.label || $t('dashboard.workspace.selectModel');
});

const DEFAULT_SUGGESTIONS_VI = [
  'Giải thích về machine learning là gì?',
  'Làm thế nào để tối ưu hóa hiệu suất của một ứng dụng web?',
  'Viết một đoạn code Python để đọc file CSV',
  'Viết mail xin nghỉ việc cho tôi 1 cách trịnh trọng?',
  'Các best practices cho việc quản lý database là gì?',
];

const DEFAULT_SUGGESTIONS_EN = [
  'What is machine learning?',
  'How to optimize web application performance?',
  'Write Python code to read a CSV file.',
  'How did artificial intelligence develop?',
  'What are best practices for database management?',
];

// Suggested questions
const suggestedQuestions = computed(() => {
  const raw: any = $t('dashboard.workspace.suggestions') as any;
  const fallbackSuggestions =
    preferences.app.locale === 'en-US'
      ? DEFAULT_SUGGESTIONS_EN
      : DEFAULT_SUGGESTIONS_VI;

  if (Array.isArray(raw)) {
    const arr = raw as string[];
    return arr.slice(0, 5);
  }
  if (typeof raw === 'string') {
    // Try JSON parse first
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return (parsed as string[]).slice(0, 5);
    } catch {}
    // Try pipe-separated list
    if (raw.includes('|')) {
      return raw
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    // Otherwise, return locale-specific defaults
    return fallbackSuggestions;
  }
  // Default fallback list (5 items)
  return fallbackSuggestions;
});

async function refreshSessions() {
  try {
    console.log('[UI] Refreshing sessions for user:', currentUserId.value);
    const res: any = await ragSessions(currentUserId.value);
    console.log('[UI] Raw sessions response:', res);
    
    // Handle different response formats
    let responseData = res;
    if (res.data) {
      responseData = res.data;
    }
    
    // Check if response has ok field
    if (responseData.ok && responseData.sessions) {
      const loadedSessions = responseData.sessions;
      sessions.value = [...loadedSessions];
      console.log('[UI] Refreshed sessions:', loadedSessions.length);
      console.log('[UI] Sessions list:', loadedSessions.map((s: any) => ({ id: s.sessionId, title: s.title, updatedAt: s.updatedAt })));
    } else if (responseData.sessions) {
      // Fallback: direct sessions array
      sessions.value = [...responseData.sessions];
      console.log('[UI] Refreshed sessions (fallback):', responseData.sessions.length);
    } else {
      console.warn('[UI] Unexpected sessions response format:', responseData);
      sessions.value = [];
    }
  } catch (err: any) {
    console.error('[UI] Refresh sessions error:', err);
    antdMessage.error(err?.response?.data?.error || err?.message || $t('dashboard.workspace.loadSessionsFailed'));
    sessions.value = [];
  }
}

async function selectSession(sid: string) {
  sessionId.value = sid;
  // Không tải messages từ server nữa; UI chỉ hiển thị lịch sử trong phiên hiện tại
  messages.value = [];
}

function createNewSession() {
  sessionId.value = '';
  messages.value = [];
  input.value = '';
}

async function selectSuggestedQuestion(question: string) {
  input.value = question;
  await nextTick();
  send();
}

async function send() {
  const content = input.value.trim();
  if (!content || sending.value) return;
  
  sending.value = true;
  const userMsg = content;
  input.value = '';
  
  // Add user message immediately
  const userMessage = {
    role: 'user',
    content: userMsg,
    createdAt: new Date().toISOString(),
  };
  // Use array assignment to ensure reactivity
  messages.value = [...messages.value, userMessage];
  console.log('[UI] Added user message, total messages:', messages.value.length);
  
  // Validate selectedModel before sending
  if (!selectedModel.value || selectedModel.value.trim() === '') {
    antdMessage.error($t('dashboard.workspace.pleaseSelectModel'));
    return;
  }
  
  // If the selectedModel exists in dropdown options, trust it even if it looks like an API key.
  const validOptionValues = new Set(availableModels.value.map((m) => m.value));
  const isFromDropdown = validOptionValues.has(selectedModel.value);
  
  // Additional validation: ensure it's not an API key
  if (!isFromDropdown && selectedModel.value.length > 30 && (
    selectedModel.value.startsWith('AIza') ||
    selectedModel.value.startsWith('sk-') ||
    /^[A-Za-z0-9_-]{40,}$/.test(selectedModel.value)
  )) {
    antdMessage.error($t('dashboard.workspace.invalidModelSelection'));
    console.error('[UI] Invalid modelKey detected:', selectedModel.value);
    return;
  }
  
  console.log('[UI] Sending chat with model:', selectedModel.value);
  
  try {
    const res: any = await ragChat({
      sessionId: sessionId.value || undefined,
      userId: currentUserId.value,
      message: userMsg,
      model: selectedModel.value,
      topK: topK.value,
      collection: collection.value || 'default',
      historyLimit: 10,
      systemPrompt: systemPrompt.value || undefined,
    });
    
    // Axios returns { data: {...}, status: 200, ... }
    const responseData = res.data || res;
    console.log('[UI] Received full response:', res);
    console.log('[UI] Response data:', responseData);
    console.log('[UI] Response ok:', responseData.ok);
    console.log('[UI] Response answer:', responseData.answer);
    console.log('[UI] Response answer type:', typeof responseData.answer);
    console.log('[UI] Response answer length:', responseData.answer?.length);
    
    // Check if response is ok
    if (!responseData.ok) {
      console.error('[UI] Response not ok:', responseData);
      antdMessage.error($t('dashboard.workspace.sendFailed'));
      return;
    }
    
    // Update sessionId if new session created
    if (!sessionId.value && responseData.sessionId) {
      sessionId.value = responseData.sessionId;
      console.log('[UI] New session created:', responseData.sessionId);
      // Refresh sessions to show in sidebar
      await refreshSessions();
    } else if (sessionId.value && responseData.sessionId) {
      // Also refresh if session already exists (to update title, etc.)
      refreshSessions();
    }
    
    // Add assistant response - handle all cases including empty string
    const hasAnswer = responseData.answer !== null && responseData.answer !== undefined;
    if (hasAnswer) {
      const answerText = String(responseData.answer).trim();
      const assistantMessage = {
        role: 'assistant',
        content: answerText || '(Empty response)',
        createdAt: new Date().toISOString(),
        contextChunks: responseData.context || [],
      };
      
      // Use array assignment to ensure reactivity
      messages.value = [...messages.value, assistantMessage];
      
      console.log('[UI] Added assistant message:', assistantMessage);
      console.log('[UI] Total messages now:', messages.value.length);
      console.log('[UI] Messages array:', JSON.stringify(messages.value, null, 2));
      
      // Force Vue reactivity update
      await nextTick();
      scrollToBottom();
    } else {
      console.warn('[UI] No answer field in response. Full response:', JSON.stringify(responseData, null, 2));
      antdMessage.warning($t('dashboard.workspace.sendFailed'));
    }
    
    // Don't reload messages - we already have them in the UI
    // Only reload if we need to sync with server (optional)
  } catch (err: any) {
    console.error('[UI] Send error:', err);
    // Remove user message on error
    messages.value = messages.value.filter(m => {
      // Compare by content and timestamp to find the right message
      return !(m.role === 'user' && m.content === userMsg && Math.abs(new Date(m.createdAt).getTime() - new Date(userMessage.createdAt).getTime()) < 1000);
    });
    antdMessage.error(err?.message || $t('dashboard.workspace.sendFailed'));
  } finally {
    sending.value = false;
  }
}

function scrollToBottom() {
  nextTick(() => {
    try {
      // Find scroll container inside messages area
      const messagesArea = document.querySelector('.messages-area');
      if (messagesArea) {
        const scrollContainer = messagesArea.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
          return;
        }
      }
      // Fallback: find any scroll area viewport
      const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    } catch (err) {
      console.warn('[UI] Scroll error:', err);
    }
  });
}

onMounted(async () => {
  // Load available models first
  await loadModels();
  // Then refresh sessions
  refreshSessions();
});
</script>

<template>
  <div class="flex h-[calc(100vh-120px)] bg-background">
    <!-- Left Sidebar: Chat History -->
    <div class="w-64 border-r bg-muted/30 flex flex-col">
      <!-- New Chat Button -->
      <div class="p-3 border-b">
        <Button @click="createNewSession" class="w-full" :variant="!sessionId ? 'default' : 'outline'">
          <span class="mr-2">+</span>
          {{ $t('dashboard.workspace.newChat') }}
        </Button>
      </div>
      
      <!-- Sessions List -->
      <ScrollArea class="flex-1">
        <div class="p-2 space-y-1">
          <!-- Empty state -->
          <div v-if="sortedSessions.length === 0" class="text-center p-4 text-muted-foreground">
            <div class="text-4xl mb-2">💬</div>
            <p class="text-xs">{{ $t('dashboard.workspace.noSessions') }}</p>
            <p class="text-[10px] opacity-70 mt-1">{{ $t('dashboard.workspace.startChatting') }}</p>
          </div>
          <!-- Sessions -->
          <div
            v-for="s in sortedSessions"
            :key="s.sessionId"
            @click="selectSession(s.sessionId)"
            :class="[
              'group p-3 rounded-lg cursor-pointer transition-all duration-200',
              sessionId === s.sessionId 
                ? 'bg-primary text-primary-foreground shadow-md' 
                : 'hover:bg-muted/50 hover:shadow-sm'
            ]"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <!-- <span class="text-sm">💬</span> -->
                  <div class="text-sm font-medium truncate flex-1 cursor-pointer">
                    {{ s.title || $t('dashboard.workspace.untitledChat') }}
                  </div>
                </div>
                <div :class="[
                  'text-xs truncate',
                  sessionId === s.sessionId ? 'opacity-80' : 'opacity-60'
                ]">
                  {{ new Date(s.updatedAt).toLocaleDateString('vi-VN', { 
                    day: 'numeric', 
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) }}
                </div>
              </div>
              <div class="flex items-center gap-1"></div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>

    <!-- Right Main: Chat Area -->
    <div class="flex-1 flex flex-col">
      <!-- Chat Header -->
      <div class="border-b p-4 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">{{ currentSessionTitle }}</h2>
          <p class="text-sm text-muted-foreground">{{ currentModelLabel }}</p>
        </div>
        <div class="flex items-center gap-2">
          <Select v-model="selectedModel" :disabled="loadingModels || availableModels.length === 0">
            <SelectTrigger class="w-48">
              <SelectValue :placeholder="loadingModels ? $t('dashboard.workspace.loadingModels') : (availableModels.length === 0 ? $t('dashboard.workspace.noModelsAvailable') : $t('dashboard.workspace.selectModel'))" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem 
                v-for="model in availableModels" 
                :key="model.value" 
                :value="model.value"
              >
                {{ model.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- Messages Area -->
      <ScrollArea ref="messagesScrollRef" class="flex-1 p-4 messages-area">
        <div v-if="messages.length === 0" class="flex items-center justify-center h-full text-muted-foreground">
          <div class="text-center max-w-2xl w-full">
            <p class="text-lg mb-2">{{ $t('dashboard.workspace.startConversation') }}</p>
            <p class="text-sm mb-6">{{ $t('dashboard.workspace.sendMessage') }}</p>
            
            <!-- Suggested Questions -->
            <div v-if="suggestedQuestions.length > 0" class="mt-8">
              <p class="text-sm font-medium mb-4 text-foreground">{{ $t('dashboard.workspace.suggestedQuestions') }}</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  v-for="(question, idx) in suggestedQuestions"
                  :key="idx"
                  @click="selectSuggestedQuestion(question)"
                  class="p-4 text-left rounded-lg border border-border bg-background hover:bg-muted hover:border-primary transition-all duration-200 text-sm"
                >
                  <span class="text-muted-foreground mr-2">{{ idx + 1 }}.</span>
                  {{ question }}
                </button>
              </div>
            </div>
            
            <p class="text-xs mt-6 opacity-50">{{ $t('dashboard.workspace.messagesCount') }}: {{ messages.length }}</p>
          </div>
        </div>
        <div v-else class="space-y-6 max-w-3xl mx-auto py-4">
          <div
            v-for="(m, idx) in messages"
            :key="`${m.role}-${idx}-${m.createdAt || Date.now()}`"
            :class="[
              'flex gap-3 items-start',
              m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            ]"
          >
            <!-- Avatar/Icon -->
            <div
              :class="[
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
              ]"
            >
              <span v-if="m.role === 'user'">👤</span>
              <span v-else>🤖</span>
            </div>
            
            <!-- Message Content -->
            <div
              :class="[
                'flex flex-col gap-1',
                m.role === 'user' ? 'items-end' : 'items-start',
                'max-w-[75%]'
              ]"
            >
              <div
                :class="[
                  'rounded-2xl px-4 py-3 shadow-sm',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted border border-border rounded-tl-sm'
                ]"
              >
                <div class="whitespace-pre-wrap text-sm leading-relaxed">{{ m.content }}</div>
                <details v-if="m.contextChunks?.length" class="mt-3">
                  <summary class="cursor-pointer text-xs opacity-70 hover:opacity-100 transition-opacity">
                    📎 {{ $t('dashboard.workspace.context') }} ({{ m.contextChunks.length }})
                  </summary>
                  <div class="mt-2 space-y-2 pt-2 border-t border-border/50">
                    <div
                      v-for="(c, cidx) in m.contextChunks"
                      :key="cidx"
                      class="p-2 bg-background/50 rounded-lg text-xs border border-border/30"
                    >
                      <div class="opacity-70 mb-1 text-[10px]">
                        Score: {{ c.score.toFixed(4) }} • {{ c.docId }} / {{ c.chunkId }}
                      </div>
                      <div class="whitespace-pre-wrap text-xs">{{ c.content }}</div>
                    </div>
                  </div>
                </details>
              </div>
              <!-- Timestamp -->
              <div class="text-xs text-muted-foreground px-1">
                {{ m.createdAt ? new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '' }}
              </div>
            </div>
          </div>
          <div v-if="sending" class="flex gap-3 items-start">
            <!-- Avatar -->
            <div class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              <span>🤖</span>
            </div>
            <!-- Loading bubble -->
            <div class="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div class="flex items-center gap-2">
                <div class="flex gap-1">
                  <div class="w-2 h-2 bg-current rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-2 h-2 bg-current rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-2 h-2 bg-current rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
                <span class="text-sm text-muted-foreground">{{ $t('dashboard.workspace.thinking') }}</span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <!-- Input Area -->
      <div class="border-t p-4">
        <div class="max-w-3xl mx-auto">
          <div class="flex gap-2">
            <Textarea
              v-model="input"
              @keydown.enter.exact.prevent="send"
              @keydown.enter.shift.exact="input += '\n'"
              rows="2"
              class="flex-1 resize-none"
              :placeholder="$t('dashboard.workspace.typeMessage')"
              :disabled="sending"
            />
            <Button @click="send" :disabled="!input.trim() || sending">
              {{ $t('dashboard.workspace.send') }}
            </Button>
          </div>
          <div class="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <Input
              v-model="systemPrompt"
              :placeholder="$t('dashboard.workspace.systemPrompt')"
              class="flex-1 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.space-y-1 > * + * { margin-top: 0.25rem; }
.space-y-2 > * + * { margin-top: 0.5rem; }
.space-y-6 > * + * { margin-top: 1.5rem; }
</style>
