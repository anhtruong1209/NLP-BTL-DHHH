<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { AIModel } from '#/api/models';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteModel, getModels, updateModel } from '#/api/models';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

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
          const res: any = await getModels();
          // requestClient automatically extracts 'data' field, so res is already the data object
          const models = res?.models || [];
          
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
        },
      },
    },
    rowConfig: {
      keyField: 'modelId',
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
    await updateModel(row.modelId, { enabled: newEnabled });
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
  deleteModel(row.modelId)
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
