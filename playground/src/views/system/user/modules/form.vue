<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { getRoleList } from '#/api/system/role';
import { createUser, updateUser } from '#/api/system/user';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<SystemUserApi.SystemUser>();
const roleOptions = ref<Array<{ label: string; value: string }>>([]);

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(roleOptions),
  showDefaultActions: false,
});

const id = ref();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    drawerApi.lock();
    (id.value ? updateUser(id.value, values) : createUser(values))
      .then(() => {
        emits('success');
        drawerApi.close();
      })
      .catch(() => {
        drawerApi.unlock();
      });
  },

  async onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<SystemUserApi.SystemUser>();
      formApi.resetForm();

      if (data) {
        formData.value = data;
        id.value = data.id;
      } else {
        id.value = undefined;
      }

      // Load roles if not already loaded
      if (roleOptions.value.length === 0) {
        await loadRoles();
      }

      // Wait for Vue to flush DOM updates (form fields mounted)
      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    }
  },
});

async function loadRoles() {
  try {
    const res = await getRoleList({ page: 1, pageSize: 100 });
    // Response structure: { code: 0, data: { items: [...], total: number } }
    const roles = Array.isArray(res) 
      ? res 
      : (res as any)?.data?.items || [];
    roleOptions.value = roles.map((role: any) => ({
      label: role.name,
      value: role.code,
    }));
    // Update form schema with new role options
    formApi.updateSchema({
      fieldName: 'role',
      componentProps: {
        options: roleOptions.value,
      },
    });
  } catch (error) {
    console.error('Error loading roles:', error);
  }
}

const getDrawerTitle = computed(() => {
  return formData.value?.id
    ? $t('common.edit', $t('system.user.name'))
    : $t('common.create', $t('system.user.name'));
});
</script>
<template>
  <Drawer :title="getDrawerTitle">
    <Form />
  </Drawer>
</template>

