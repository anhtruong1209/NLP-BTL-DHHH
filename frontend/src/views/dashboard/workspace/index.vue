<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';

import { useUserStore } from '@vben/stores';
import { message as antdMessage } from 'ant-design-vue';
import {
  Button,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@vben-core/shadcn-ui';

import {
  getMyChats,
  getChatMessages,
  processAIMessage,
  getAvailableModels,
  type Chat,
  type ChatMessage,
} from '#/api/chat';
import { useAuthStore } from '#/store';

const userStore = useUserStore();
const authStore = useAuthStore();

const selectedModel = ref('');
const availableModels = ref<Array<{ value: string; label: string }>>([]);
const loadingModels = ref(false);
const loadingSessions = ref(false);

const chatId = ref<number | null>(null);
const chats = ref<Chat[]>([]);
const messages = ref<ChatMessage[]>([]);
const input = ref('');
const sending = ref(false);
const lastSendAt = ref(0);
const messagesLoading = ref(false);

const suggestions = [
  'Giải thích về machine learning là gì?',
  'Làm thế nào để tối ưu hiệu suất web app?',
  'Tóm tắt giúp tôi văn bản bất kỳ.',
  'Viết email xin nghỉ phép trang trọng.',
  'Liệt kê những bước xây dựng chatbot RAG.',
];

const currentChatTitle = computed(() => {
  if (!chatId.value) {
    return 'Cuộc trò chuyện mới';
  }
  const current = chats.value.find((c) => c.id === chatId.value);
  return current?.title || 'Cuộc trò chuyện';
});

const currentModelLabel = computed(() => {
  const model = availableModels.value.find((m) => m.value === selectedModel.value);
  return model?.label || 'Chưa chọn model';
});

const sortedChats = computed(() =>
  [...chats.value].sort((a, b) => {
    try {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;
      return dateB - dateA;
    } catch {
      return 0;
    }
  }),
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
    const res = await getAvailableModels();
    console.log('[Workspace] getAvailableModels response:', res);
    
    // getAvailableModels đã normalize response về { status: 'success', models: [...] }
    // Và luôn trả về models (từ API hoặc default), không throw error
    const models = res?.models || [];
    console.log('[Workspace] Extracted models:', models);
    
    availableModels.value = models.length > 0 ? models : [{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }];
    
    if (availableModels.value.length > 0 && !selectedModel.value) {
      selectedModel.value = availableModels.value[0]?.value ?? 'gemini-2.5-flash';
      console.log('[Workspace] Selected model:', selectedModel.value);
    }
  } catch (error: any) {
    // getAvailableModels không nên throw error, nhưng nếu có thì xử lý
    console.error('[Workspace] Load models failed (unexpected):', error);
    // Nếu không có model nào, dùng default
    if (availableModels.value.length === 0) {
      availableModels.value = [{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }];
      selectedModel.value = 'gemini-2.5-flash';
    }
  } finally {
    loadingModels.value = false;
  }
}

async function refreshChats() {
  loadingSessions.value = true;
  try {
    // getMyChats đã normalize response về array
    const chatsList = await getMyChats();
    console.log('[Workspace] getMyChats response:', chatsList);
    
    // Kiểm tra nếu có data hợp lệ
    if (Array.isArray(chatsList) && chatsList.length > 0) {
      chats.value = chatsList;
      console.log('[Workspace] Set chats.value:', chats.value);
      
      // Nếu có chat và chưa chọn chat nào, chọn chat đầu tiên
      if (!chatId.value && chats.value.length > 0 && chats.value[0]) {
        chatId.value = chats.value[0].id;
        await loadMessagesForChat(chats.value[0].id);
      }
    } else {
      // Không có chat hoặc data không hợp lệ
      chats.value = [];
      console.log('[Workspace] No chats found or invalid data');
    }
  } catch (error: any) {
    // Chỉ log error nếu thực sự là lỗi (không có data hợp lệ)
    // Nếu error nhưng có data trong error.response.data, getMyChats đã xử lý rồi
    if (error?.response?.status && error.response.status >= 400) {
      console.error('[Workspace] Load chats failed with HTTP error:', error);
      antdMessage.error('Không tải được danh sách cuộc trò chuyện.');
      chats.value = [];
    } else {
      // Có thể là network error hoặc lỗi khác
      console.warn('[Workspace] Load chats failed (non-HTTP error):', error);
      chats.value = [];
    }
  } finally {
    loadingSessions.value = false;
  }
}

async function loadMessagesForChat(id?: number) {
  if (!id) {
    messages.value = [];
    return;
  }
  messagesLoading.value = true;
  try {
    // getChatMessages đã normalize response về array
    const messagesList = await getChatMessages(id);
    console.log('[Workspace] getChatMessages response:', messagesList);
    
    // Kiểm tra nếu có data hợp lệ
    if (Array.isArray(messagesList)) {
      messages.value = messagesList;
      console.log('[Workspace] Set messages.value:', messages.value);
    } else {
      messages.value = [];
      console.log('[Workspace] Invalid messages data, setting empty array');
    }
  } catch (error: any) {
    // Chỉ log error nếu thực sự là lỗi (không có data hợp lệ)
    // Nếu error nhưng có data trong error.response.data, getChatMessages đã xử lý rồi
    if (error?.response?.status && error.response.status >= 400) {
      console.error('[Workspace] Load messages failed with HTTP error:', error);
      antdMessage.error('Không tải được lịch sử cuộc trò chuyện.');
      messages.value = [];
    } else {
      // Có thể là network error hoặc lỗi khác
      console.warn('[Workspace] Load messages failed (non-HTTP error):', error);
      messages.value = [];
    }
  } finally {
    messagesLoading.value = false;
    scrollToBottom();
  }
}

async function selectChat(id: number) {
  if (chatId.value === id) return;
  chatId.value = id;
  await loadMessagesForChat(id);
}

function createNewChat() {
  chatId.value = null;
  messages.value = [];
  input.value = '';
}

function addMessageToUI(role: 'user' | 'assistant', content: string) {
  messages.value = [
    ...messages.value,
    {
      id: Date.now(),
      chat_id: chatId.value || 0,
      role,
      content,
      createdAt: new Date().toISOString(),
    } as ChatMessage,
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

  const now = Date.now();
  if (now - lastSendAt.value < 3000) {
    antdMessage.warning('Hãy chờ vài giây rồi gửi câu tiếp theo nhé.');
    return;
  }
  sending.value = true;
  lastSendAt.value = now;
  if (!messageOverride) {
    input.value = '';
  }
  addMessageToUI('user', content);
  scrollToBottom();

  const startedAt = Date.now();
  try {
    // Chuẩn bị history từ messages hiện tại
    const history = messages.value
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10) // Lấy 10 tin nhắn gần nhất
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const res = await processAIMessage({
      message: content,
      chatId: chatId.value || undefined,
      model: selectedModel.value,
      history,
      useGoogleSearch: false,
    });

    console.log('[Workspace] processAIMessage response:', res);
    
    // baseRequestClient trả về axios response, nên res.data = { status: "success", data: {...} }
    // Hoặc có thể res.data đã là { chat, userMessage, aiMessage } trực tiếp
    let responseData: any = res.data;
    
    // Nếu có structure { status: "success", data: {...} }, lấy data.data
    if (responseData && responseData.status === 'success' && responseData.data) {
      responseData = responseData.data;
    }
    
    console.log('[Workspace] Extracted data:', responseData);
    
    const data = responseData as { chat: Chat; userMessage: ChatMessage; aiMessage: ChatMessage };
    
    if (!data || !data.chat || !data.aiMessage) {
      console.error('[Workspace] Invalid response structure:', res);
      throw new Error('Chat API trả về dữ liệu không hợp lệ.');
    }

    // Cập nhật chatId nếu là chat mới
    if (!chatId.value && data.chat.id) {
      chatId.value = data.chat.id;
    }

    // Cập nhật messages từ response
    messages.value = [
      ...messages.value.filter((m) => m.role === 'user' && m.content === content).length === 0
        ? messages.value
        : messages.value.slice(0, -1), // Xóa message user tạm nếu đã có trong response
      data.userMessage,
      data.aiMessage,
    ];

    await refreshChats();
    scrollToBottom();
  } catch (error: any) {
    console.error('[Workspace] Send failed:', error);
    // Xóa message user nếu gửi thất bại
    messages.value = messages.value.filter(
      (m, idx) => !(idx === messages.value.length - 1 && m.role === 'user'),
    );
    antdMessage.error(error?.response?.data?.message || error?.message || 'Gửi tin nhắn thất bại.');
  } finally {
    const elapsed = Date.now() - startedAt;
    const remaining = 3000 - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    sending.value = false;
  }
}

function useSuggestion(text: string) {
  // Chỉ đổ text vào ô nhập, để người dùng chỉnh sửa rồi tự gửi
  input.value = text;
}

onMounted(async () => {
  await ensureUserInfo();
  await loadModels();
  await refreshChats();
});
</script>

<template>
  <div class="flex h-[calc(100vh-120px)] bg-background">
    <div class="w-64 border-r bg-muted/30 flex flex-col">
      <div class="p-3 border-b">
        <Button class="w-full" :variant="!chatId ? 'default' : 'outline'" @click="createNewChat">
          <span class="mr-2">+</span>
          Cuộc trò chuyện mới
        </Button>
      </div>
      <ScrollArea class="flex-1">
        <div class="p-2 space-y-1">
          <div
            v-if="!loadingSessions && sortedChats.length === 0"
            class="text-center p-4 text-muted-foreground text-xs"
          >
            Chưa có cuộc trò chuyện nào
          </div>
          <div
            v-for="item in sortedChats"
            :key="item.id"
            class="rounded-lg p-3 cursor-pointer transition-all"
            :class="chatId === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/60'"
            @click="selectChat(item.id)"
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
          <h2 class="text-lg font-semibold">{{ currentChatTitle }}</h2>
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
            :key="message.id || index"
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

