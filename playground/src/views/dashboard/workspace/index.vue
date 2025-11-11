<script lang="ts" setup>
import type {
  WorkbenchProjectItem,
  WorkbenchQuickNavItem,
  WorkbenchTodoItem,
  WorkbenchTrendItem,
} from '@vben/common-ui';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  AnalysisChartCard,
  WorkbenchHeader,
  WorkbenchProject,
  WorkbenchQuickNav,
  WorkbenchTodo,
  WorkbenchTrends,
} from '@vben/common-ui';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import AnalyticsVisitsSource from '../analytics/analytics-visits-source.vue';

const userStore = useUserStore();

// ChatBot workspace data
// url 也可以是内部路由，在 navTo 方法中识别处理，进行内部跳转
// 例如：url: /dashboard/workspace
const projectItems: WorkbenchProjectItem[] = [
  {
    color: '#3fb27f',
    content: '智能对话助手，随时为您解答问题。',
    date: '2024-01-01',
    group: 'ChatBot',
    icon: 'mdi:robot',
    title: 'ChatBot 对话',
    url: '/dashboard/workspace',
  },
  {
    color: '#00d8ff',
    content: 'AI 驱动的智能客服系统。',
    date: '2024-01-01',
    group: 'ChatBot',
    icon: 'mdi:chat',
    title: '智能客服',
    url: '/dashboard/workspace',
  },
  {
    color: '#e18525',
    content: '多轮对话管理，提升用户体验。',
    date: '2024-01-01',
    group: 'ChatBot',
    icon: 'mdi:message-text',
    title: '对话管理',
    url: '/dashboard/workspace',
  },
  {
    color: '#bf0c2c',
    content: '知识库管理，训练更智能的机器人。',
    date: '2024-01-01',
    group: 'ChatBot',
    icon: 'mdi:book-open',
    title: '知识库',
    url: '/dashboard/workspace',
  },
  {
    color: '#9c27b0',
    content: '数据分析，了解用户需求。',
    date: '2024-01-01',
    group: 'ChatBot',
    icon: 'mdi:chart-line',
    title: '数据分析',
    url: '/dashboard/workspace',
  },
  {
    color: '#EBD94E',
    content: '配置管理，自定义 ChatBot 行为。',
    date: '2024-01-01',
    group: 'ChatBot',
    icon: 'mdi:cog',
    title: '配置管理',
    url: '/dashboard/workspace',
  },
];

// ChatBot 快捷导航
const quickNavItems: WorkbenchQuickNavItem[] = [
  {
    color: '#1fdaca',
    icon: 'mdi:robot',
    title: 'ChatBot 对话',
    url: '/dashboard/workspace',
  },
  {
    color: '#bf0c2c',
    icon: 'mdi:chat',
    title: '对话历史',
    url: '/dashboard/workspace',
  },
  {
    color: '#e18525',
    icon: 'mdi:book-open',
    title: '知识库',
    url: '/dashboard/workspace',
  },
  {
    color: '#3fb27f',
    icon: 'mdi:cog',
    title: 'ChatBot 配置',
    url: '/dashboard/workspace',
  },
  {
    color: '#4daf1bc9',
    icon: 'mdi:chart-line',
    title: '数据分析',
    url: '/dashboard/workspace',
  },
  {
    color: '#00d8ff',
    icon: 'mdi:account-group',
    title: '用户管理',
    url: '/system/user',
  },
];

const todoItems = ref<WorkbenchTodoItem[]>([
  {
    completed: false,
    content: `优化 ChatBot 对话响应速度，提升用户体验。`,
    date: '2024-07-30 11:00:00',
    title: '优化 ChatBot 性能',
  },
  {
    completed: true,
    content: `更新知识库内容，添加新的常见问题解答。`,
    date: '2024-07-30 11:00:00',
    title: '更新知识库',
  },
  {
    completed: false,
    content: `分析用户对话数据，识别需要改进的对话场景。`,
    date: '2024-07-30 11:00:00',
    title: '分析对话数据',
  },
  {
    completed: false,
    content: `配置新的 ChatBot 对话流程，支持多轮对话。`,
    date: '2024-07-30 11:00:00',
    title: '配置对话流程',
  },
  {
    completed: false,
    content: `测试 ChatBot 在不同场景下的响应准确性。`,
    date: '2024-07-30 11:00:00',
    title: '测试 ChatBot 功能',
  },
]);
const trendItems: WorkbenchTrendItem[] = [
  {
    avatar: 'svg:avatar-1',
    content: `在 <a>ChatBot 团队</a> 创建了新的对话流程`,
    date: '刚刚',
    title: 'ChatBot',
  },
  {
    avatar: 'svg:avatar-2',
    content: `更新了 <a>知识库</a> 内容`,
    date: '1个小时前',
    title: 'ChatBot',
  },
  {
    avatar: 'svg:avatar-3',
    content: `发布了 <a>ChatBot 新功能</a> `,
    date: '1天前',
    title: 'ChatBot',
  },
  {
    avatar: 'svg:avatar-4',
    content: `优化了 <a>对话响应速度</a> `,
    date: '2天前',
    title: 'ChatBot',
  },
  {
    avatar: 'svg:avatar-1',
    content: `回复了用户关于 <a>ChatBot 使用</a> 的问题`,
    date: '3天前',
    title: 'ChatBot',
  },
  {
    avatar: 'svg:avatar-2',
    content: `完成了 <a>对话数据分析</a> `,
    date: '1周前',
    title: 'ChatBot',
  },
  {
    avatar: 'svg:avatar-3',
    content: `发布了 <a>ChatBot 配置更新</a> `,
    date: '1周前',
    title: 'ChatBot',
  },
  {
    avatar: 'svg:avatar-4',
    content: `新增了 <a>多轮对话</a> 功能`,
    date: '2024-01-01 20:00',
    title: 'ChatBot',
  },
  {
    avatar: 'svg:avatar-4',
    content: `发表文章 <a>如何配置 ChatBot Admin</a> `,
    date: '2024-01-01 20:00',
    title: 'ChatBot',
  },
];

const router = useRouter();

// 这是一个示例方法，实际项目中需要根据实际情况进行调整
// This is a sample method, adjust according to the actual project requirements
function navTo(nav: WorkbenchProjectItem | WorkbenchQuickNavItem) {
  if (nav.url?.startsWith('http')) {
    openWindow(nav.url);
    return;
  }
  if (nav.url?.startsWith('/')) {
    router.push(nav.url).catch((error) => {
      console.error('Navigation failed:', error);
    });
  } else {
    console.warn(`Unknown URL for navigation item: ${nav.title} -> ${nav.url}`);
  }
}
</script>

<template>
  <div class="p-5">
    <WorkbenchHeader
      :avatar="userStore.userInfo?.avatar || preferences.app.defaultAvatar"
    >
      <template #title>
        Chào buổi sáng, {{ userStore.userInfo?.realName }}, bắt đầu một ngày làm việc của bạn!
      </template>
      <template #description> Hôm nay trời nắng, 20℃ - 32℃! </template>
    </WorkbenchHeader>

    <div class="mt-5 flex flex-col lg:flex-row">
      <div class="mr-4 w-full lg:w-3/5">
        <WorkbenchProject :items="projectItems" title="Dự án" @click="navTo" />
        <WorkbenchTrends :items="trendItems" class="mt-5" title="Hoạt động gần đây" />
      </div>
      <div class="w-full lg:w-2/5">
        <WorkbenchQuickNav
          :items="quickNavItems"
          class="mt-5 lg:mt-0"
          title="Điều hướng nhanh"
          @click="navTo"
        />
        <WorkbenchTodo :items="todoItems" class="mt-5" title="Công việc cần làm" />
        <AnalysisChartCard class="mt-5" title="Nguồn truy cập">
          <AnalyticsVisitsSource />
        </AnalysisChartCard>
      </div>
    </div>
  </div>
</template>
