<script lang="ts" setup>
import { computed } from 'vue';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { AIModel } from '#/api/models';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteModel, getModels, updateModel } from '#/api/models';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const userStore = useUserStore();
const isAdmin = computed(() => {
  const userInfo = userStore.userInfo;
  if (!userInfo) {
    console.warn('[Model List] userInfo is null/undefined');
    return false;
  }
  // Check nhiều cách để đảm bảo detect admin
  const hasAdminRole = 
    userInfo.roles?.includes('admin') || 
    userInfo.role === 'admin' ||
    (userInfo as any).isAdmin === true;
  
  console.log('[Model List] Checking admin:', {
    userInfo,
    roles: userInfo.roles,
    role: userInfo.role,
    isAdmin: (userInfo as any).isAdmin,
    hasAdminRole,
  });
  
  return hasAdminRole;
});

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onActionClick, onStatusChange),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          // Đợi userInfo được load nếu chưa có
          if (!userStore.userInfo) {
            console.log('[Model List] Waiting for userInfo...');
            // Đợi một chút để userInfo được load
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Check lại admin sau khi đợi
          const currentIsAdmin = isAdmin.value;
          
          // Chỉ gọi API nếu user là admin
          if (!currentIsAdmin) {
            console.warn('[Model List] User is not admin, blocking API call');
            message.warning('Bạn không có quyền truy cập trang này.');
            return {
              items: [],
              total: 0,
            };
          }
          
          console.log('[Model List] User is admin, proceeding with API call');
          
          try {
            const res: any = await getModels();
            // getModels() trả về { status: 'success', models: [...] }
            const models = res?.models || res?.data?.models || [];
            
            console.log('[Model List] Received models:', models);
            console.log('[Model List] First model enabled value:', models[0]?.enabled, 'is_active:', models[0]?.is_active);
            
            // Apply filters if any
            let filtered = models;
            if (formValues?.name) {
              filtered = filtered.filter((m: AIModel) => 
                m.name?.toLowerCase().includes(formValues.name.toLowerCase())
              );
            }
            if (formValues?.type) {
              filtered = filtered.filter((m: AIModel) => m.type === formValues.type);
            }
            if (formValues?.enabled !== undefined) {
              filtered = filtered.filter((m: AIModel) => m.enabled === formValues.enabled);
            }
            
            // Pagination
            const pageNum = page.currentPage;
            const pageSize = page.pageSize;
            const start = (pageNum - 1) * pageSize;
            const end = start + pageSize;
            const items = filtered.slice(start, end);
            
            return {
              items,
              total: filtered.length,
            };
          } catch (error: any) {
            if (error?.response?.status === 403) {
              message.error('Bạn không có quyền truy cập danh sách model.');
              return {
                items: [],
                total: 0,
              };
            }
            throw error;
          }
        },
      },
    },
    rowConfig: {
      keyField: 'id', // Dùng id từ backend
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<AIModel>,
});

function onActionClick(e: OnActionClickParams<AIModel>) {
  switch (e.code) {
    case 'delete': {
      onDelete(e.row);
      break;
    }
    case 'edit': {
      onEdit(e.row);
      break;
    }
  }
}

function confirm(content: string, title: string) {
  return new Promise((resolve, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('Đã hủy'));
      },
      onOk() {
        resolve(true);
      },
      title,
    });
  });
}

async function onStatusChange(newEnabled: boolean, row: AIModel) {
  try {
    await confirm(
      `Bạn có muốn ${newEnabled ? 'kích hoạt' : 'vô hiệu hóa'} model "${row.name}" không?`,
      'Thay đổi trạng thái',
    );
    const modelId = row.modelId || String(row.id || '');
    await updateModel(modelId, { enabled: newEnabled });
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: AIModel) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: AIModel) {
  const hideLoading = message.loading({
    content: `Đang xóa model "${row.name}"...`,
    duration: 0,
    key: 'action_process_msg',
  });
  const modelId = row.modelId || String(row.id || '');
  deleteModel(modelId)
    .then(() => {
      message.success({
        content: `Đã xóa model "${row.name}" thành công`,
        key: 'action_process_msg',
      });
      onRefresh();
    })
    .catch(() => {
      hideLoading();
    });
}

function onRefresh() {
  gridApi.query();
}

function onCreate() {
  formDrawerApi.setData({}).open();
}
</script>

<template>
  <Page auto-content-height>
    <FormDrawer @success="onRefresh" />
    <Grid table-title="Quản lý Model">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          Tạo Model
        </Button>
      </template>
    </Grid>
  </Page>
</template>
