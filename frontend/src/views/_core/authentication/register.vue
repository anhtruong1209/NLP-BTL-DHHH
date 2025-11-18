<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, h } from 'vue';

import { AuthenticationRegister, z } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Register' });

const authStore = useAuthStore();

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: 'Nhập email của bạn',
        type: 'email',
      },
      fieldName: 'email',
      label: 'Email',
      rules: z.string().email({ message: 'Email không hợp lệ' }).min(1, { message: 'Vui lòng nhập email' }),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: 'Nhập họ của bạn',
      },
      fieldName: 'firstName',
      label: 'Họ',
      rules: z.string().optional(),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: 'Nhập tên của bạn',
      },
      fieldName: 'lastName',
      label: 'Tên',
      rules: z.string().optional(),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      renderComponentContent() {
        return {
          strengthText: () => $t('authentication.passwordStrength'),
        };
      },
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.confirmPassword'),
      },
      dependencies: {
        rules(values) {
          const { password } = values;
          return z
            .string({ required_error: $t('authentication.passwordTip') })
            .min(1, { message: $t('authentication.passwordTip') })
            .refine((value) => value === password, {
              message: $t('authentication.confirmPasswordTip'),
            });
        },
        triggerFields: ['password'],
      },
      fieldName: 'confirmPassword',
      label: $t('authentication.confirmPassword'),
    },
    {
      component: 'VbenCheckbox',
      fieldName: 'agreePolicy',
      renderComponentContent: () => ({
        default: () =>
          h('span', [
            $t('authentication.agree'),
            h(
              'a',
              {
                class: 'vben-link ml-1 ',
                href: '',
              },
              `${$t('authentication.privacyPolicy')} & ${$t('authentication.terms')}`,
            ),
          ]),
      }),
      rules: z.boolean().refine((value) => !!value, {
        message: $t('authentication.agreeTip'),
      }),
    },
  ];
});

async function handleSubmit(value: Recordable<any>) {
  try {
    await authStore.authRegister(value);
    // authRegister sẽ tự động redirect sau khi đăng ký thành công
  } catch (error: any) {
    console.error('Register failed:', error);
    const errorMessage = error?.response?.data?.message || error?.message || 'Đăng ký thất bại. Vui lòng thử lại.';
    
    // Kiểm tra nếu email đã tồn tại
    if (errorMessage.includes('already in use') || errorMessage.includes('Email already')) {
      message.error('Email này đã được sử dụng. Vui lòng chọn email khác.');
    } else {
      message.error(errorMessage);
    }
  }
}
</script>

<template>
  <AuthenticationRegister
    :form-schema="formSchema"
    :loading="authStore.registerLoading"
    @submit="handleSubmit"
  />
</template>
