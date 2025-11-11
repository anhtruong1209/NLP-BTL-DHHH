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
  <div class="p-5">
    <a-row justify="space-between" align="middle" class="mb-4">
      <a-col>
        <a-typography-title :level="4" style="margin:0">ChatBot</a-typography-title>
      </a-col>
      <a-col>
        <a-typography-text type="secondary">
          Xin chào, {{ userStore.userInfo?.realName || 'User' }}
        </a-typography-text>
      </a-col>
    </a-row>

    <a-card size="small" class="mb-4">
      <a-form layout="inline">
        <a-form-item label="Collection">
          <a-input v-model:value="collection" style="width:180px" placeholder="default" />
        </a-form-item>
        <a-form-item label="Top K">
          <a-input-number v-model:value="topK" :min="1" :max="20" style="width:120px" />
        </a-form-item>
        <a-form-item label="Model" style="min-width:260px;flex:1">
          <a-input :value="activeModelName" readonly />
        </a-form-item>
        <a-form-item label="System Prompt" style="min-width:260px;flex:1">
          <a-input v-model:value="systemPrompt" placeholder="You are a helpful assistant..." />
        </a-form-item>
      </a-form>
    </a-card>

    <a-row :gutter="16" class="mb-4">
      <a-col>
        <a-form layout="inline">
          <a-form-item label="Session">
            <a-select v-model:value="sessionId" style="width:260px" :options="[{ label: 'New session', value: '' }, ...sessions.map(s=>({label: s.title || s.sessionId, value: s.sessionId}))]" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="refreshSessions" :loading="loading">Refresh Sessions</a-button>
          </a-form-item>
          <a-form-item>
            <a-button @click="loadMessages" :disabled="!sessionId" :loading="loading">Load Messages</a-button>
          </a-form-item>
        </a-form>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <a-col :span="16">
        <a-card size="small" style="height:60vh;overflow:auto">
          <a-empty v-if="messages.length === 0" description="No messages yet. Start chatting below." />
          <a-list v-else :data-source="messages" :split="false">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-typography-text type="secondary" style="font-size:12px">{{ item.role.toUpperCase() }}</a-typography-text>
                <div class="whitespace-pre-wrap">{{ item.content }}</div>
                <a-collapse v-if="item.contextChunks?.length" ghost class="mt-1">
                  <a-collapse-panel :header="`Context (${item.contextChunks.length})`" key="ctx">
                    <a-list :data-source="item.contextChunks" size="small">
                      <template #renderItem="{ item: c }">
                        <a-list-item>
                          <a-typography-text type="secondary" style="font-size:12px">
                            Score: {{ c.score.toFixed(4) }} • {{ c.docId }} / {{ c.chunkId }}
                          </a-typography-text>
                          <div class="whitespace-pre-wrap text-sm">{{ c.content }}</div>
                        </a-list-item>
                      </template>
                    </a-list>
                  </a-collapse-panel>
                </a-collapse>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="Quick Ingest" size="small">
          <a-textarea v-model:value="ingestText" :rows="8" placeholder="Paste text to index" />
          <a-space class="mt-2">
            <a-button type="primary" @click="doIngest" :disabled="!ingestText.trim()" :loading="loading">Ingest</a-button>
            <a-button @click="ingestText = ''">Clear</a-button>
          </a-space>
          <a-typography-text type="secondary" style="display:block;margin-top:6px">
            Stored to collection "{{ collection || 'default' }}".
          </a-typography-text>
        </a-card>
      </a-col>
    </a-row>

    <a-form @submit.prevent="send" layout="inline" class="mt-4">
      <a-form-item style="flex:1;min-width:240px">
        <a-textarea v-model:value="input" :rows="2" placeholder="Type your message..." />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="send" :disabled="!input.trim()" :loading="loading">Send</a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<style scoped>
.space-y-3 > * + * { margin-top: 0.75rem; }
.space-y-4 > * + * { margin-top: 1rem; }
.space-y-2 > * + * { margin-top: 0.5rem; }
</style>
