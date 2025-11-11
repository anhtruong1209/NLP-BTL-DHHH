<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '@vben/stores';
import { message as antdMessage } from 'ant-design-vue';
import { Page } from '@vben/common-ui';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  ScrollArea,
} from '@vben-core/shadcn-ui';
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
  <Page title="ChatBot" description="RAG + Chat with memory">
    <Card class="mb-4">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <div class="text-xs text-muted-foreground mb-1">Collection</div>
            <Input v-model="collection" class="w-44" placeholder="default" />
          </div>
          <div>
            <div class="text-xs text-muted-foreground mb-1">Top K</div>
            <Input v-model="topK" type="number" class="w-24" />
          </div>
          <div class="flex-1 min-w-[260px]">
            <div class="text-xs text-muted-foreground mb-1">Model</div>
            <Input :value="activeModelName" readonly />
          </div>
          <div class="flex-1 min-w-[260px]">
            <div class="text-xs text-muted-foreground mb-1">System Prompt</div>
            <Input v-model="systemPrompt" placeholder="You are a helpful assistant..." />
          </div>
        </div>
        <div class="mt-3 flex items-end gap-3">
          <div>
            <div class="text-xs text-muted-foreground mb-1">Session</div>
            <Select v-model="sessionId">
              <SelectTrigger class="w-64">
                <SelectValue placeholder="New session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">New session</SelectItem>
                <SelectItem v-for="s in sessions" :key="s.sessionId" :value="s.sessionId">
                  {{ s.title || s.sessionId }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button @click="refreshSessions" :disabled="loading">Refresh Sessions</Button>
          <Button @click="loadMessages" :disabled="!sessionId || loading">Load Messages</Button>
        </div>
      </CardContent>
    </Card>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card class="md:col-span-2 h-[60vh]">
        <CardContent class="h-full p-3">
          <ScrollArea class="h-full">
            <div v-if="messages.length === 0" class="text-muted-foreground">No messages yet. Start chatting below.</div>
            <div v-else class="space-y-3">
              <div v-for="(m, idx) in messages" :key="idx">
                <div class="text-[12px] text-muted-foreground">{{ m.role.toUpperCase() }}</div>
                <div class="whitespace-pre-wrap">{{ m.content }}</div>
                <details v-if="m.contextChunks?.length" class="mt-1">
                  <summary class="cursor-pointer text-xs text-muted-foreground">Context ({{ m.contextChunks.length }})</summary>
                  <div class="mt-1 space-y-2">
                    <div v-for="(c, cidx) in m.contextChunks" :key="cidx" class="p-2 border rounded">
                      <div class="text-[12px] text-muted-foreground">Score: {{ c.score.toFixed(4) }} • {{ c.docId }} / {{ c.chunkId }}</div>
                      <div class="text-sm whitespace-pre-wrap">{{ c.content }}</div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Quick Ingest</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea v-model="ingestText" rows="8" placeholder="Paste text to index" />
          <div class="mt-2 flex gap-2">
            <Button @click="doIngest" :disabled="loading || !ingestText.trim()">Ingest</Button>
            <Button variant="secondary" @click="ingestText = ''">Clear</Button>
          </div>
          <div class="text-xs text-muted-foreground mt-1">
            Stored to collection "{{ collection || 'default' }}".
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="mt-4 flex items-end gap-2">
      <Textarea v-model="input" rows="2" class="flex-1 min-w-[240px]" placeholder="Type your message..." />
      <Button @click="send" :disabled="loading || !input.trim()">Send</Button>
    </div>
  </Page>
</template>

<style scoped>
.space-y-3 > * + * { margin-top: 0.75rem; }
.space-y-4 > * + * { margin-top: 1rem; }
.space-y-2 > * + * { margin-top: 0.5rem; }
</style>
