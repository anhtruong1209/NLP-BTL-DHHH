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
    // Use public endpoint that doesn't require admin access
    const res: any = await getAvailableModels();
    // requestClient automatically extracts 'data' field
    const models: AIModel[] = res?.models || [];
    
    // Map to select format (models are already filtered to enabled only)
    const enabledModels = models.map(m => ({
      value: m.modelKey,
      label: m.name,
    }));
    
    availableModels.value = enabledModels;
    
    // Set default model if available and not already set
    if (enabledModels.length > 0 && !selectedModel.value) {
      const firstModel = enabledModels[0];
      if (firstModel) {
        selectedModel.value = firstModel.value;
        console.log('[UI] Set default model:', firstModel.value);
      }
    }
    
    console.log('[UI] Loaded models:', enabledModels);
    console.log('[UI] Selected model:', selectedModel.value);
  } catch (err: any) {
    console.error('[UI] Load models error:', err);
    // Fallback to default models if API fails
    availableModels.value = [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    ];
    if (!selectedModel.value) {
      selectedModel.value = 'gemini-2.5-flash';
    }
    antdMessage.warning('Failed to load models, using default');
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
  if (!sessionId.value) return 'New Chat';
  const s = sessions.value.find(s => s.sessionId === sessionId.value);
  return s?.title || 'Chat';
});

// Current model label
const currentModelLabel = computed(() => {
  return availableModels.value.find(m => m.value === selectedModel.value)?.label || 'Select Model';
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
    antdMessage.error(err?.response?.data?.error || err?.message || 'Load sessions failed');
    sessions.value = [];
  }
}

async function loadMessages() {
  if (!sessionId.value) {
    messages.value = [];
    return;
  }
  loading.value = true;
  try {
    console.log('[UI] Loading messages for session:', sessionId.value, 'user:', currentUserId.value);
    const res: any = await ragMessages(sessionId.value, 500, currentUserId.value);
    // Axios returns { data: {...}, status: 200, ... }
    const responseData = res.data || res;
    const loadedMessages = responseData.messages ?? [];
    console.log('[UI] Loaded messages:', loadedMessages.length);
    // Use array assignment to ensure reactivity
    messages.value = [...loadedMessages];
    console.log('[UI] Messages after load:', messages.value.length);
    await nextTick();
    scrollToBottom();
  } catch (err: any) {
    console.error('[UI] Load messages error:', err);
    // Don't show error if it's just a permission issue when loading
    if (err?.response?.status !== 403) {
      antdMessage.error(err?.message || 'Load messages failed');
    }
  } finally {
    loading.value = false;
  }
}

// Auto-load messages when session changes
watch(sessionId, (newId) => {
  if (newId) {
    loadMessages();
  } else {
    messages.value = [];
  }
});

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
    antdMessage.error('Please select a model first');
    return;
  }
  
  // Additional validation: ensure it's not an API key
  if (selectedModel.value.length > 30 && (
    selectedModel.value.startsWith('AIza') || 
    selectedModel.value.startsWith('sk-') ||
    /^[A-Za-z0-9_-]{40,}$/.test(selectedModel.value)
  )) {
    antdMessage.error('Invalid model selection. Please select a model from the dropdown.');
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
      antdMessage.error('Server returned an error');
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
      antdMessage.warning('Received response without answer field');
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
    antdMessage.error(err?.message || 'Send failed');
  } finally {
    sending.value = false;
  }
}

async function togglePin(session: any) {
  try {
    const newPinned = !session.pinned;
    await ragPinSession(session.sessionId, newPinned);
    session.pinned = newPinned;
    await refreshSessions();
  } catch (err: any) {
    antdMessage.error(err?.message || 'Failed to pin/unpin session');
  }
}

function startEditTitle(session: any) {
  editingSessionId.value = session.sessionId;
  editingTitle.value = session.title || '';
}

function cancelEditTitle() {
  editingSessionId.value = null;
  editingTitle.value = '';
}

async function saveEditTitle(session: any) {
  const newTitle = editingTitle.value.trim();
  if (!newTitle) {
    antdMessage.warning('Title cannot be empty');
    return;
  }
  if (newTitle === session.title) {
    cancelEditTitle();
    return;
  }
  try {
    const res: any = await ragUpdateSessionTitle(session.sessionId, newTitle);
    const responseData = res.data || res;
    if (responseData.ok) {
      session.title = newTitle;
      session.updatedAt = new Date().toISOString();
      await refreshSessions();
      cancelEditTitle();
      antdMessage.success('Title updated');
    }
  } catch (err: any) {
    antdMessage.error(err?.message || 'Failed to update title');
  }
}

async function deleteSession(session: any) {
  Modal.confirm({
    title: 'Delete Chat Session',
    content: `Are you sure you want to delete "${session.title || 'Untitled Chat'}"? This action cannot be undone.`,
    okText: 'Delete',
    okType: 'danger',
    cancelText: 'Cancel',
    async onOk() {
      try {
        console.log('[UI] Deleting session:', session.sessionId);
        const res: any = await ragDeleteSession(session.sessionId);
        console.log('[UI] Delete response:', res);
        const responseData = res.data || res;
        if (responseData.ok) {
          // If deleted session is current, clear it
          if (sessionId.value === session.sessionId) {
            sessionId.value = '';
            messages.value = [];
          }
          await refreshSessions();
          antdMessage.success('Session deleted successfully');
        } else {
          antdMessage.error(responseData.error || 'Failed to delete session');
        }
      } catch (err: any) {
        console.error('[UI] Delete session error:', err);
        antdMessage.error(err?.response?.data?.error || err?.message || 'Failed to delete session');
      }
    },
  });
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
          New Chat
        </Button>
      </div>
      
      <!-- Sessions List -->
      <ScrollArea class="flex-1">
        <div class="p-2 space-y-1">
          <!-- Empty state -->
          <div v-if="sortedSessions.length === 0" class="text-center p-4 text-muted-foreground">
            <div class="text-4xl mb-2">💬</div>
            <p class="text-xs">No sessions yet</p>
            <p class="text-[10px] opacity-70 mt-1">Start chatting to create one</p>
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
                  <span class="text-sm">💬</span>
                  <!-- Edit mode -->
                  <div v-if="editingSessionId === s.sessionId" class="flex-1 flex items-center gap-1">
                    <Input
                      v-model="editingTitle"
                      @keydown.enter="saveEditTitle(s)"
                      @keydown.esc="cancelEditTitle"
                      class="text-sm h-7 flex-1 text-foreground"
                      @click.stop
                    />
                    <button
                      @click.stop="saveEditTitle(s)"
                      class="p-1 hover:bg-primary-foreground/20 rounded text-xs"
                      title="Save"
                    >
                      ✓
                    </button>
                    <button
                      @click.stop="cancelEditTitle"
                      class="p-1 hover:bg-primary-foreground/20 rounded text-xs"
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                  <!-- Display mode -->
                  <div
                    v-else
                    class="text-sm font-medium truncate flex-1 cursor-pointer"
                    @dblclick.stop="startEditTitle(s)"
                    :title="'Double-click to edit'"
                  >
                    {{ s.title || 'Untitled Chat' }}
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
              <div class="flex items-center gap-1">
                <button
                  v-if="editingSessionId !== s.sessionId"
                  @click.stop="startEditTitle(s)"
                  :class="[
                    'p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100',
                    sessionId === s.sessionId ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted'
                  ]"
                  title="Edit title"
                >
                  ✏️
                </button>
                <button
                  @click.stop="togglePin(s)"
                  :class="[
                    'p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100',
                    sessionId === s.sessionId ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted'
                  ]"
                  :title="s.pinned ? 'Unpin' : 'Pin'"
                >
                  <span :class="s.pinned ? '' : 'opacity-50'">📌</span>
                </button>
                <button
                  v-if="editingSessionId !== s.sessionId"
                  @click.stop="deleteSession(s)"
                  :class="[
                    'p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100',
                    sessionId === s.sessionId ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted'
                  ]"
                  title="Delete session"
                >
                  🗑️
                </button>
              </div>
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
              <SelectValue :placeholder="loadingModels ? 'Loading models...' : (availableModels.length === 0 ? 'No models available' : 'Select model')" />
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
          <div class="text-center">
            <p class="text-lg mb-2">Start a conversation</p>
            <p class="text-sm">Send a message to begin chatting with Gemini AI</p>
            <p class="text-xs mt-2 opacity-50">Messages count: {{ messages.length }}</p>
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
                    📎 Context ({{ m.contextChunks.length }})
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
                <span class="text-sm text-muted-foreground">Thinking...</span>
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
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              :disabled="sending"
            />
            <Button @click="send" :disabled="!input.trim() || sending">
              Send
            </Button>
          </div>
          <div class="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <Input
              v-model="systemPrompt"
              placeholder="System prompt (optional)"
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
