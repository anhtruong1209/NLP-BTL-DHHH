<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '@vben/stores';
import { message as antdMessage } from 'ant-design-vue';
import { ragChat, ragIngest, ragMessages, ragSessions } from '#/api/rag';

const userStore = useUserStore();
const currentUserId = computed(() => userStore.userInfo?.id || userStore.userInfo?.username || 'guest');

const collection = ref<string>('default');
const topK = ref<number>(5);
const activeModelName = ref<string>('Qwen2.5-0.5B-Instruct (GGUF q5_k_m)');
const systemPrompt = ref<string>('');
const sessionId = ref<string>('');
const sessions = ref<any[]>([]);
const messages = ref<any[]>([]);
const input = ref<string>('');
const ingestText = ref<string>('');
const loading = ref<boolean>(false);

async function refreshSessions() {
  loading.value = true;
  try {
    const res: any = await ragSessions(currentUserId.value);
    sessions.value = res.sessions ?? [];
  } catch (err: any) {
    antdMessage.error(err?.message || 'Load sessions failed');
  } finally {
    loading.value = false;
  }
}

async function loadMessages() {
  if (!sessionId.value) return;
  loading.value = true;
  try {
    const res: any = await ragMessages(sessionId.value, 500, currentUserId.value);
    messages.value = res.messages ?? [];
  } catch (err: any) {
    antdMessage.error(err?.message || 'Load messages failed');
  } finally {
    loading.value = false;
  }
}

async function doIngest() {
  const text = ingestText.value.trim();
  if (!text) return;
  loading.value = true;
  try {
    await ragIngest({
      collection: collection.value || 'default',
      texts: [{ text }],
      chunkSize: 800,
      chunkOverlap: 100,
    });
    antdMessage.success('Ingested');
  } catch (err: any) {
    antdMessage.error(err?.message || 'Ingest failed');
  } finally {
    loading.value = false;
  }
}

async function send() {
  const content = input.value.trim();
  if (!content) return;
  loading.value = true;
  try {
    const res: any = await ragChat({
      sessionId: sessionId.value || undefined,
      userId: currentUserId.value,
      message: content,
      topK: topK.value,
      collection: collection.value || 'default',
      historyLimit: 10,
      systemPrompt: systemPrompt.value || undefined,
    });
    if (!sessionId.value && res.sessionId) {
      sessionId.value = res.sessionId;
      await refreshSessions();
    }
    input.value = '';
    await loadMessages();
  } catch (err: any) {
    antdMessage.error(err?.message || 'Send failed');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  refreshSessions();
});
</script>

<template>
  <div class="p-5 space-y-4">
    <div class="flex items-center justify-between">
      <div class="text-xl font-semibold">ChatBot</div>
      <div class="text-sm text-gray-600">
        Xin chào, {{ userStore.userInfo?.realName || 'User' }}
      </div>
    </div>

    <div class="flex flex-wrap gap-3 items-end">
      <div>
        <label class="block text-sm font-medium">Collection</label>
        <input v-model="collection" class="border px-2 py-1 rounded w-44" placeholder="default" />
      </div>
      <div>
        <label class="block text-sm font-medium">Top K</label>
        <input v-model.number="topK" type="number" min="1" max="20" class="border px-2 py-1 rounded w-24" />
      </div>
      <div class="flex-1 min-w-[260px]">
        <label class="block text-sm font-medium">Model</label>
        <input :value="activeModelName" class="border px-2 py-1 rounded w-full bg-gray-100" readonly />
      </div>
      <div class="flex-1 min-w-[260px]">
        <label class="block text-sm font-medium">System Prompt</label>
        <input v-model="systemPrompt" class="border px-2 py-1 rounded w-full" placeholder="You are a helpful assistant..." />
      </div>
    </div>

    <div class="flex flex-wrap gap-3 items-end">
      <div>
        <label class="block text-sm font-medium">Session</label>
        <select v-model="sessionId" class="border px-2 py-1 rounded w-64">
          <option value="">New session</option>
          <option v-for="s in sessions" :key="s.sessionId" :value="s.sessionId">
            {{ s.title || s.sessionId }}
          </option>
        </select>
      </div>
      <button class="bg-blue-600 text-white px-3 py-1 rounded" @click="refreshSessions" :disabled="loading">
        Refresh Sessions
      </button>
      <button class="bg-gray-600 text-white px-3 py-1 rounded" @click="loadMessages" :disabled="!sessionId || loading">
        Load Messages
      </button>
    </div>

    <div class="grid md:grid-cols-3 gap-4">
      <div class="md:col-span-2 border rounded p-3 h-[60vh] overflow-auto bg-white">
        <div v-if="messages.length === 0" class="text-gray-500">No messages yet. Start chatting below.</div>
        <div v-for="(m, idx) in messages" :key="idx" class="mb-3">
          <div class="text-xs text-gray-500">{{ m.role.toUpperCase() }}</div>
          <div class="whitespace-pre-wrap">{{ m.content }}</div>
          <details v-if="m.contextChunks?.length" class="mt-1">
            <summary class="cursor-pointer text-xs text-gray-600">Context ({{ m.contextChunks.length }})</summary>
            <div class="mt-1 space-y-2">
              <div v-for="(c, cidx) in m.contextChunks" :key="cidx" class="p-2 bg-gray-50 rounded border">
                <div class="text-xs text-gray-500">Score: {{ c.score.toFixed(4) }} • {{ c.docId }} / {{ c.chunkId }}</div>
                <div class="text-sm whitespace-pre-wrap">{{ c.content }}</div>
              </div>
            </div>
          </details>
        </div>
      </div>
      <div class="md:col-span-1 border rounded p-3 space-y-3 bg-white">
        <div>
          <div class="font-medium mb-1">Quick Ingest</div>
          <textarea v-model="ingestText" class="border w-full h-40 p-2 rounded" placeholder="Paste text to index"></textarea>
          <div class="flex gap-2 mt-2">
            <button class="bg-green-600 text-white px-3 py-1 rounded" @click="doIngest" :disabled="loading || !ingestText.trim()">
              Ingest
            </button>
            <button class="bg-gray-300 px-3 py-1 rounded" @click="ingestText=''">Clear</button>
          </div>
          <div class="text-xs text-gray-500 mt-1">Stored to collection "{{ collection || 'default' }}".</div>
        </div>
      </div>
    </div>

    <form @submit.prevent="send" class="flex gap-2 items-end">
      <textarea v-model="input" class="border flex-1 min-h-[44px] p-2 rounded" placeholder="Type your message..."></textarea>
      <button class="bg-blue-600 text-white px-4 py-2 rounded" :disabled="loading || !input.trim()">Send</button>
    </form>
  </div>
</template>

<style scoped>
.space-y-3 > * + * { margin-top: 0.75rem; }
.space-y-4 > * + * { margin-top: 1rem; }
.space-y-2 > * + * { margin-top: 0.5rem; }
</style>
