<script lang="ts" setup>
import type { Recordable } from '@vben/types';

import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { SystemUserApi } from '#/api';

import { computed } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteUser, getUserList, updateUser } from '#/api';
import { $t } from '#/locales';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const userStore = useUserStore();
const isAdmin = computed(() => {
  const userInfo = userStore.userInfo;
  if (!userInfo) {
    console.warn('[User List] userInfo is null/undefined');
    return false;
  }
  // Check nhiều cách để đảm bảo detect admin
  const hasAdminRole = 
    userInfo.roles?.includes('admin') || 
    userInfo.role === 'admin' ||
    (userInfo as any).isAdmin === true;
  
  console.log('[User List] Checking admin:', {
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
    fieldMappingTime: [['createTime', ['startTime', 'endTime']]],
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
            console.log('[User List] Waiting for userInfo...');
            // Đợi một chút để userInfo được load
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          // Check lại admin sau khi đợi
          const currentIsAdmin = isAdmin.value;
          
          // Chỉ gọi API nếu user là admin
          if (!currentIsAdmin) {
            console.warn('[User List] User is not admin, blocking API call');
            message.warning('Bạn không có quyền truy cập trang này.');
            return {
              items: [],
              total: 0,
            };
          }
          
          console.log('[User List] User is admin, proceeding with API call');
          
          try {
            const result = await getUserList({
              page: page.currentPage,
              pageSize: page.pageSize,
              ...formValues,
            });
            console.log('[User List] getUserList result:', result);
            return result;
          } catch (error: any) {
            console.log('[User List] Error caught in query:', error);
            console.log('[User List] error type:', typeof error);
            
            // Nếu error chính nó là array hoặc có data hợp lệ, getUserList đã xử lý rồi
            // Chỉ throw error nếu thực sự là lỗi HTTP
            if (error?.response?.status === 403) {
              message.error('Bạn không có quyền truy cập danh sách người dùng.');
              return {
                items: [],
                total: 0,
              };
            }
            
            // Nếu error nhưng không phải HTTP error (có thể là interceptor issue)
            // getUserList đã xử lý và return data rồi, nên không nên throw
            // Nhưng nếu vẫn throw thì return empty để tránh crash
            if (!error?.response?.status || error.response.status < 400) {
              console.warn('[User List] Non-HTTP error, returning empty result');
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
      keyField: 'id',
    },

    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SystemUserApi.SystemUser>,
});

function onActionClick(e: OnActionClickParams<SystemUserApi.SystemUser>) {
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

/**
 * 将Antd的Modal.confirm封装为promise，方便在异步函数中调用。
 * @param content 提示内容
 * @param title 提示标题
 */
function confirm(content: string, title: string) {
  return new Promise((reslove, reject) => {
    Modal.confirm({
      content,
      onCancel() {
        reject(new Error('Đã hủy'));
      },
      onOk() {
        reslove(true);
      },
      title,
    });
  });
}

/**
 * 状态开关即将改变
 * @param newStatus 期望改变的状态值
 * @param row 行数据
 * @returns 返回false则中止改变，返回其他值（undefined、true）则允许改变
 */
async function onStatusChange(
  newStatus: number,
  row: SystemUserApi.SystemUser,
) {
  const status: Recordable<string> = {
    0: 'Vô hiệu hóa',
    1: 'Kích hoạt',
  };
  try {
    await confirm(
      `Bạn có muốn thay đổi trạng thái của {row.realName} thành 【${status[newStatus.toString()]}】 không？`,
      `Thay đổi trạng thái`,
    );
    await updateUser(row.id, { status: newStatus });
    return true;
  } catch {
    return false;
  }
}

function onEdit(row: SystemUserApi.SystemUser) {
  formDrawerApi.setData(row).open();
}

function onDelete(row: SystemUserApi.SystemUser) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.realName]),
    duration: 0,
    key: 'action_process_msg',
  });
  deleteUser(row.id)
    .then(() => {
      message.success({
        content: $t('ui.actionMessage.deleteSuccess', [row.realName]),
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
    <Grid :table-title="$t('system.user.list')">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />
          {{ $t('ui.actionTitle.create', [$t('system.user.name')]) }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>

