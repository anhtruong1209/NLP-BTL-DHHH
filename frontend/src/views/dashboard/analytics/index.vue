<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue';
import { useUserStore } from '@vben/stores';
import { message as antdMessage } from 'ant-design-vue';
import { Page } from '@vben/common-ui';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@vben-core/shadcn-ui';
import { getAnalyticsStats, type AnalyticsStats } from '#/api/analytics';
import { $t } from '#/locales';
import AnalyticsDailySessions from './analytics-daily-sessions.vue';
import AnalyticsModelUsage from './analytics-model-usage.vue';
import AnalyticsUserStats from './analytics-user-stats.vue';
import AnalyticsMessagesTrend from './analytics-messages-trend.vue';
import AnalyticsHourlyStats from './analytics-hourly-stats.vue';
import AnalyticsResponseTime from './analytics-response-time.vue';

const userStore = useUserStore();
const isAdmin = computed(() => {
  const userRole = (userStore.userInfo as any)?.role;
  return userRole === 0; // 0 = admin
});

const loading = ref(false);
const stats = ref<AnalyticsStats | null>(null);
const days = ref(30);

async function loadStats() {
  loading.value = true;
  try {
    const res: any = await getAnalyticsStats({ days: days.value });
    console.log('[Analytics] Response:', res);
    
    // requestClient automatically extracts 'data' field, so res is already the data object
    // Backend returns: { code: 0, data: { stats: {...} } }
    // requestClient returns: { stats: {...} }
    if (res?.stats) {
      stats.value = res.stats;
    } else {
      console.error('[Analytics] Unexpected response format:', res);
      throw new Error('Invalid response format');
    }
    
    console.log('[Analytics] Stats loaded:', stats.value);
  } catch (err: any) {
    console.error('[Analytics] Load error:', err);
    antdMessage.error(err?.message || $t('dashboard.analytics.failedToLoad'));
    stats.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadStats();
});
</script>

<template>
  <Page :title="$t('dashboard.analytics.title')" :description="$t('dashboard.analytics.description')">
    <div class="space-y-4">
      <!-- Filters -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>{{ $t('dashboard.analytics.filters') }}</CardTitle>
            <Select v-model="days" @update:model-value="loadStats">
              <SelectTrigger class="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="7">{{ $t('dashboard.analytics.last7Days') }}</SelectItem>
                <SelectItem :value="30">{{ $t('dashboard.analytics.last30Days') }}</SelectItem>
                <SelectItem :value="90">{{ $t('dashboard.analytics.last90Days') }}</SelectItem>
                <SelectItem :value="365">{{ $t('dashboard.analytics.lastYear') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <!-- Overview Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle class="text-sm font-medium">{{ $t('dashboard.analytics.totalSessions') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ stats?.totalSessions || 0 }}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle class="text-sm font-medium">{{ $t('dashboard.analytics.totalMessages') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ stats?.totalMessages || 0 }}</div>
          </CardContent>
        </Card>
        <Card v-if="isAdmin">
          <CardHeader>
            <CardTitle class="text-sm font-medium">{{ $t('dashboard.analytics.totalUsers') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ stats?.totalUsers || 0 }}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle class="text-sm font-medium">{{ $t('dashboard.analytics.modelsUsed') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="text-3xl font-bold">{{ stats?.modelUsage?.length || 0 }}</div>
          </CardContent>
        </Card>
      </div>

      <!-- Charts Row 1 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Daily Sessions Chart -->
        <Card>
          <CardHeader>
            <CardTitle>{{ $t('dashboard.analytics.dailyChatSessions') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsDailySessions v-if="stats?.dailyStats" :data="stats.dailyStats" />
            <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
              {{ $t('dashboard.analytics.noModelUsageData') }}
            </div>
          </CardContent>
        </Card>

        <!-- Model Usage Chart -->
        <Card>
          <CardHeader>
            <CardTitle>{{ $t('dashboard.analytics.modelUsageDistribution') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsModelUsage v-if="stats?.modelUsage" :data="stats.modelUsage" />
            <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
              {{ $t('dashboard.analytics.noModelUsageData') }}
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Charts Row 2 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Messages Daily Stats Chart -->
        <Card>
          <CardHeader>
            <CardTitle>{{ $t('dashboard.analytics.messagesDailyStats') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsMessagesTrend v-if="stats?.messagesDailyStats && stats.messagesDailyStats.length > 0" :data="stats.messagesDailyStats" />
            <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
              {{ $t('dashboard.analytics.noModelUsageData') }}
            </div>
          </CardContent>
        </Card>

        <!-- Hourly Stats Chart -->
        <Card>
          <CardHeader>
            <CardTitle>{{ $t('dashboard.analytics.hourlyStats') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsHourlyStats v-if="stats?.hourlyStats && stats.hourlyStats.length > 0" :data="stats.hourlyStats" />
            <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
              {{ $t('dashboard.analytics.noModelUsageData') }}
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Charts Row 3 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Response Time Trend Chart -->
        <Card>
          <CardHeader>
            <CardTitle>{{ $t('dashboard.analytics.responseTimeTrend') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsResponseTime v-if="stats?.avgResponseTimeDaily && stats.avgResponseTimeDaily.length > 0" :data="stats.avgResponseTimeDaily" />
            <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
              {{ $t('dashboard.analytics.noModelUsageData') }}
            </div>
          </CardContent>
        </Card>

        <!-- User Stats Chart (Admin only) -->
        <Card v-if="isAdmin">
          <CardHeader>
            <CardTitle>{{ $t('dashboard.analytics.topUsersBySessions') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsUserStats v-if="stats?.userStats && stats.userStats.length > 0" :data="stats.userStats" />
            <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
              {{ $t('dashboard.analytics.noModelUsageData') }}
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Tables Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Model Usage Table -->
        <Card>
          <CardHeader>
            <CardTitle>{{ $t('dashboard.analytics.modelUsageDetails') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="!stats?.modelUsage?.length" class="text-center py-8 text-muted-foreground">
              {{ $t('dashboard.analytics.noModelUsageData') }}
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b">
                    <th class="text-left p-2">{{ $t('dashboard.analytics.model') }}</th>
                    <th class="text-right p-2">{{ $t('dashboard.analytics.usageCount') }}</th>
                    <th class="text-right p-2">{{ $t('dashboard.analytics.avgResponseTime') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="m in stats.modelUsage" :key="m.modelKey" class="border-b">
                    <td class="p-2 font-medium">{{ m.modelKey }}</td>
                    <td class="text-right p-2">{{ m.count }}</td>
                    <td class="text-right p-2">{{ m.avgResponseTime }}ms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <!-- Top Conversations Table -->
        <Card>
          <CardHeader>
            <CardTitle>{{ $t('dashboard.analytics.topConversations') }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="!stats?.topConversations?.length" class="text-center py-8 text-muted-foreground">
              {{ $t('dashboard.analytics.noModelUsageData') }}
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b">
                    <th class="text-left p-2">{{ $t('dashboard.analytics.conversation') }}</th>
                    <th class="text-right p-2">{{ $t('dashboard.analytics.messageCount') }}</th>
                    <th class="text-right p-2">{{ $t('dashboard.analytics.lastMessage') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in stats.topConversations" :key="c.sessionId" class="border-b">
                    <td class="p-2 font-medium">{{ c.title }}</td>
                    <td class="text-right p-2">{{ c.messageCount }}</td>
                    <td class="text-right p-2 text-xs text-muted-foreground">
                      {{ new Date(c.lastMessage).toLocaleDateString() }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.space-y-4 > * + * { margin-top: 1rem; }
</style>
