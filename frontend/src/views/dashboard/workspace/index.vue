<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';

import { useUserStore } from '@vben/stores';
import { message as antdMessage } from 'ant-design-vue';
import {
  Button,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@vben-core/shadcn-ui';

import { ragChat, ragMessages, ragSessions } from '#/api/rag';
import { getAvailableModels, type AIModel } from '#/api/models';
import { useAuthStore } from '#/store';

const userStore = useUserStore();
const authStore = useAuthStore();

const collection = ref('default');
const systemPrompt = ref('');
const topK = ref(5);

const selectedModel = ref('');
const availableModels = ref<Array<{ value: string; label: string }>>([]);
const loadingModels = ref(false);
const loadingSessions = ref(false);

const sessionId = ref('');
const sessions = ref<any[]>([]);
const messages = ref<
  Array<{ role: 'user' | 'assistant'; content: string; contextChunks?: any[]; createdAt?: string }>
>([]);
const input = ref('');
const sending = ref(false);
const messagesLoading = ref(false);

const suggestions = [
  'Giải thích về machine learning là gì?',
  'Làm thế nào để tối ưu hiệu suất web app?',
  'Tóm tắt giúp tôi văn bản bất kỳ.',
  'Viết email xin nghỉ phép trang trọng.',
  'Liệt kê những bước xây dựng chatbot RAG.',
];

const currentSessionTitle = computed(() => {
  if (!sessionId.value) {
    return 'Cuộc trò chuyện mới';
  }
  const current = sessions.value.find((s) => s.sessionId === sessionId.value);
  return current?.title || 'Cuộc trò chuyện';
});

const currentModelLabel = computed(() => {
  const model = availableModels.value.find((m) => m.value === selectedModel.value);
  return model?.label || 'Chưa chọn model';
});

const sortedSessions = computed(() =>
  [...sessions.value].sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
  ),
);

async function ensureUserInfo() {
  if (userStore.userInfo) return;
  try {
    await authStore.fetchUserInfo();
  } catch (error) {
    console.warn('[Workspace] Failed to load user info:', error);
    antdMessage.error('Không thể lấy thông tin người dùng, vui lòng đăng nhập lại.');
  }
}

async function loadModels() {
  loadingModels.value = true;
  try {
    const res: any = await getAvailableModels();
    const models: AIModel[] = Array.isArray(res?.models) ? res.models : res?.data?.models ?? [];
    const enabled = models.map((m) => ({
      value: m.modelKey || (m as any).payloadModel || m.modelId,
      label: m.name,
    }));
    availableModels.value = enabled;
    if (enabled.length > 0 && !selectedModel.value) {
      selectedModel.value = enabled[0]?.value ?? 'gemini-2.5-flash';
    }
  } catch (error) {
    console.error('[Workspace] Load models failed:', error);
    availableModels.value = [{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }];
    selectedModel.value = 'gemini-2.5-flash';
    antdMessage.warning('Không thể tải model, sử dụng mặc định.');
  } finally {
    loadingModels.value = false;
  }
}

async function refreshSessions() {
  loadingSessions.value = true;
  try {
    const res: any = await ragSessions();
    const payload = res?.data ?? res;
    sessions.value = payload?.sessions ?? [];
    if (!sessionId.value && sessions.value.length > 0) {
      sessionId.value = sessions.value[0].sessionId;
      await loadMessagesForSession(sessionId.value);
    }
  } catch (error) {
    console.error('[Workspace] Load sessions failed:', error);
    antdMessage.error('Không tải được danh sách cuộc trò chuyện.');
    sessions.value = [];
  } finally {
    loadingSessions.value = false;
  }
}

async function loadMessagesForSession(id?: string) {
  if (!id) {
    messages.value = [];
    return;
  }
  messagesLoading.value = true;
  try {
    const res: any = await ragMessages(id, 500);
    const payload = res?.data ?? res;
    messages.value = payload?.messages ?? [];
  } catch (error) {
    console.error('[Workspace] Load messages failed:', error);
    antdMessage.error('Không tải được lịch sử cuộc trò chuyện.');
    messages.value = [];
  } finally {
    messagesLoading.value = false;
    scrollToBottom();
  }
}

async function selectSession(id: string) {
  if (sessionId.value === id) return;
  sessionId.value = id;
  await loadMessagesForSession(id);
}

function createNewSession() {
  sessionId.value = '';
  messages.value = [];
  input.value = '';
}

function addMessage(role: 'user' | 'assistant', content: string, extra?: Record<string, any>) {
  messages.value = [
    ...messages.value,
    {
      role,
      content,
      createdAt: new Date().toISOString(),
      ...(extra || {}),
    },
  ];
}

function scrollToBottom() {
  nextTick(() => {
    try {
      const area = document.querySelector('.messages-area [data-radix-scroll-area-viewport]');
      if (area) {
        area.scrollTop = area.scrollHeight;
      }
    } catch (error) {
      console.warn('[Workspace] Scroll error:', error);
    }
  });
}

async function send(messageOverride?: string) {
  const content = (messageOverride ?? input.value).trim();
  if (!content || sending.value) return;
  if (!selectedModel.value) {
    antdMessage.warning('Vui lòng chọn model trước.');
    return;
  }

  sending.value = true;
  if (!messageOverride) {
    input.value = '';
  }
  addMessage('user', content);
  scrollToBottom();

  try {
    const res: any = await ragChat({
      sessionId: sessionId.value || undefined,
      message: content,
      model: selectedModel.value,
      topK: topK.value,
      collection: collection.value || 'default',
      historyLimit: 10,
      systemPrompt: systemPrompt.value || undefined,
    });
    const data = res?.data ?? res;
    if (!data?.ok) {
      throw new Error(data?.error || 'Chat API trả về lỗi.');
    }

    if (!sessionId.value && data.sessionId) {
      sessionId.value = data.sessionId;
    }

    await refreshSessions();

    addMessage('assistant', String(data.answer ?? '').trim() || '(Không có phản hồi)', {
      contextChunks: data.context ?? [],
    });
    scrollToBottom();
  } catch (error: any) {
    console.error('[Workspace] Send failed:', error);
    messages.value = messages.value.filter((m, idx) => !(idx === messages.value.length - 1 && m.role === 'user'));
    antdMessage.error(error?.message || 'Gửi tin nhắn thất bại.');
  } finally {
    sending.value = false;
  }
}

function useSuggestion(text: string) {
  input.value = text;
  send(text);
}

onMounted(async () => {
  await ensureUserInfo();
  await loadModels();
  await refreshSessions();
});
</script>

<template>
  <div class="flex h-[calc(100vh-120px)] bg-background">
    <div class="w-64 border-r bg-muted/30 flex flex-col">
      <div class="p-3 border-b">
        <Button class="w-full" :variant="!sessionId ? 'default' : 'outline'" @click="createNewSession">
          <span class="mr-2">+</span>
          Cuộc trò chuyện mới
        </Button>
      </div>
      <ScrollArea class="flex-1">
        <div class="p-2 space-y-1">
          <div
            v-if="!loadingSessions && sortedSessions.length === 0"
            class="text-center p-4 text-muted-foreground text-xs"
          >
            Chưa có cuộc trò chuyện nào
          </div>
          <div
            v-for="item in sortedSessions"
            :key="item.sessionId"
            class="rounded-lg p-3 cursor-pointer transition-all"
            :class="sessionId === item.sessionId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/60'"
            @click="selectSession(item.sessionId)"
          >
            <div class="text-sm font-medium truncate">
              {{ item.title || 'Chưa đặt tiêu đề' }}
            </div>
            <div class="text-xs opacity-70">
              {{ new Date(item.updatedAt || item.createdAt).toLocaleString('vi-VN') }}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>

    <div class="flex-1 flex flex-col">
      <div class="border-b p-4 flex items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold">{{ currentSessionTitle }}</h2>
          <p class="text-sm text-muted-foreground">{{ currentModelLabel }}</p>
        </div>
        <Select v-model="selectedModel" :disabled="loadingModels || availableModels.length === 0">
          <SelectTrigger class="w-56">
            <SelectValue
              :placeholder="
                loadingModels
                  ? 'Đang tải model...'
                  : availableModels.length === 0
                    ? 'Không có model khả dụng'
                    : 'Chọn model'
              "
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="model in availableModels" :key="model.value" :value="model.value">
              {{ model.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea class="flex-1 p-4 messages-area">
        <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-muted-foreground">
          <p class="text-base mb-2">Bắt đầu trò chuyện</p>
          <p class="text-xs">Hãy chọn một gợi ý hoặc nhập câu hỏi của bạn.</p>
        </div>
        <div v-else class="space-y-5 max-w-3xl mx-auto py-4">
          <div
            v-for="(message, index) in messages"
            :key="index"
            class="flex gap-3"
            :class="message.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
          >
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
              :class="message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'"
            >
              {{ message.role === 'user' ? '👤' : '🤖' }}
            </div>
            <div class="max-w-[75%] space-y-2" :class="message.role === 'user' ? 'items-end text-right' : 'items-start'">
              <div
                class="rounded-2xl px-4 py-3 whitespace-pre-wrap text-sm shadow-sm"
                :class="message.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm'"
              >
                {{ message.content }}
              </div>
              <details v-if="message.contextChunks?.length" class="text-xs opacity-80">
                <summary>📎 Nguồn tham chiếu ({{ message.contextChunks.length }})</summary>
                <div class="mt-2 space-y-2">
                  <div
                    v-for="(chunk, cidx) in message.contextChunks"
                    :key="cidx"
                    class="border border-border/40 rounded-lg p-2 bg-background/70 text-left"
                  >
                    <div class="text-[11px] opacity-70 mb-1">
                      {{ chunk.docId }} / {{ chunk.chunkId }} · điểm {{ chunk.score?.toFixed(4) ?? '—' }}
                    </div>
                    <div class="whitespace-pre-wrap text-xs">{{ chunk.content }}</div>
                  </div>
                </div>
              </details>
              <div class="text-[11px] text-muted-foreground">
                {{ message.createdAt ? new Date(message.createdAt).toLocaleTimeString('vi-VN') : '' }}
              </div>
            </div>
          </div>
          <div v-if="sending" class="flex gap-3 items-start">
            <div class="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              🤖
            </div>
            <div class="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <span class="animate-pulse text-xs">Đang xử lý...</span>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div class="border-t p-4">
        <div class="max-w-3xl mx-auto space-y-2">
          <div class="flex gap-2">
            <Textarea
              v-model="input"
              rows="2"
              class="flex-1 resize-none"
              placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter để xuống dòng)"
              :disabled="sending"
              @keydown.enter.exact.prevent="send()"
              @keydown.enter.shift.exact="input += '\n'"
            />
            <Button :disabled="sending || !input.trim()" @click="send()">
              Gửi
            </Button>
          </div>
          <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Button
              v-for="suggest in suggestions"
              :key="suggest"
              size="sm"
              variant="outline"
              @click="useSuggestion(suggest)"
            >
              {{ suggest }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.space-y-5 > :not([hidden]) ~ :not([hidden]) {
  margin-top: 1.25rem;
}
</style>

