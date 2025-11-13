<script lang="ts" setup>
import type { AIModel } from '#/api/models';

import { nextTick, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { useVbenForm } from '#/adapter/form';
import { createModel, updateModel } from '#/api/models';

import { useFormSchema } from '../data';

const emits = defineEmits(['success']);

const formData = ref<AIModel>();

const [Form, formApi] = useVbenForm({
  schema: useFormSchema(),
  showDefaultActions: false,
});

const modelId = ref<string>();
const [Drawer, drawerApi] = useVbenDrawer({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const values = await formApi.getValues();
    drawerApi.lock();
    (modelId.value ? updateModel(modelId.value, values) : createModel(values))
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
      const data = drawerApi.getData<AIModel>();
      formApi.resetForm();

      if (data) {
        formData.value = data;
        modelId.value = data.modelId;
      } else {
        modelId.value = undefined;
      }

      await nextTick();
      if (data) {
        formApi.setValues(data);
      }
    }
  },
});

defineExpose({
  setData: drawerApi.setData,
  open: drawerApi.open,
  close: drawerApi.close,
});
</script>

<template>
  <Drawer :title="modelId ? 'Edit Model' : 'Create Model'">
    <Form />
  </Drawer>
</template>

