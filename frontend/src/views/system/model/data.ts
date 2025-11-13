import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AIModel } from '#/api/models';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: 'Model Name',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: 'Gemini', value: 'gemini' },
          { label: 'Local', value: 'local' },
        ],
      },
      fieldName: 'type',
      label: 'Type',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'modelKey',
      label: 'Model Key',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'apiKey',
      label: 'API Key',
      componentProps: {
        type: 'password',
      },
    },
    {
      component: 'Input',
      fieldName: 'localPath',
      label: 'Local Path',
    },
    {
      component: 'Select',
      componentProps: {
        options: [
          { label: 'Transformers', value: 'transformers' },
          { label: 'GGUF', value: 'gguf' },
          { label: 'ONNX', value: 'onnx' },
        ],
      },
      fieldName: 'localType',
      label: 'Local Type',
    },
    {
      component: 'InputNumber',
      fieldName: 'defaultMaxTokens',
      label: 'Default Max Tokens',
      componentProps: {
        min: 1,
        max: 4096,
      },
      defaultValue: 2048,
    },
    {
      component: 'InputNumber',
      fieldName: 'defaultTemperature',
      label: 'Default Temperature',
      componentProps: {
        min: 0,
        max: 2,
        step: 0.1,
      },
      defaultValue: 0.8,
    },
    {
      component: 'InputNumber',
      fieldName: 'defaultTopP',
      label: 'Default Top P',
      componentProps: {
        min: 0,
        max: 1,
        step: 0.01,
      },
      defaultValue: 0.95,
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: 'Description',
    },
    {
      component: 'RadioGroup',
      componentProps: {
        buttonStyle: 'solid',
        options: [
          { label: 'Enabled', value: true },
          { label: 'Disabled', value: false },
        ],
        optionType: 'button',
      },
      defaultValue: true,
      fieldName: 'enabled',
      label: 'Status',
    },
  ];
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: 'Model Name',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: 'Gemini', value: 'gemini' },
          { label: 'Local', value: 'local' },
        ],
      },
      fieldName: 'type',
      label: 'Type',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: 'Enabled', value: true },
          { label: 'Disabled', value: false },
        ],
      },
      fieldName: 'enabled',
      label: 'Status',
    },
  ];
}

export function useColumns<T = AIModel>(
  onActionClick: OnActionClickFn<T>,
  onStatusChange?: (newStatus: any, row: T) => PromiseLike<boolean | undefined>,
): VxeTableGridOptions['columns'] {
  return [
    {
      field: 'name',
      title: 'Model Name',
      width: 200,
    },
    {
      field: 'type',
      title: 'Type',
      width: 100,
      cellRender: {
        name: 'CellTag',
        attrs: {
          options: [
            { label: 'Gemini', value: 'gemini', color: 'blue' },
            { label: 'Local', value: 'local', color: 'green' },
          ],
        },
      },
    },
    {
      field: 'modelKey',
      title: 'Model Key',
      width: 200,
    },
    {
      field: 'provider',
      title: 'Provider',
      width: 150,
    },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'enabled',
      title: 'Status',
      width: 100,
    },
    {
      field: 'defaultMaxTokens',
      title: 'Max Tokens',
      width: 120,
    },
    {
      field: 'defaultTemperature',
      title: 'Temperature',
      width: 120,
    },
    {
      field: 'defaultTopP',
      title: 'Top P',
      width: 100,
    },
    {
      field: 'createdAt',
      title: 'Created At',
      width: 200,
      formatter: 'formatDateTime',
    },
    {
      field: 'description',
      minWidth: 200,
      title: 'Description',
    },
    {
      align: 'center',
      cellRender: {
        attrs: {
          nameField: 'name',
          nameTitle: 'Model',
          onClick: onActionClick,
        },
        name: 'CellOperation',
      },
      field: 'operation',
      fixed: 'right',
      title: 'Operation',
      width: 130,
    },
  ];
}

