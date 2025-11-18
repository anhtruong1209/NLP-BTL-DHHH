import type { VbenFormSchema } from '#/adapter/form';
import type { OnActionClickFn, VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AIModel } from '#/api/models';

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      fieldName: 'name',
      label: 'Tên Model',
      rules: 'required',
      componentProps: {
        placeholder: 'Ví dụ: Gemini 2.5 Flash API Key',
      },
    },
    {
      component: 'Input',
      fieldName: 'model',
      label: 'Model Name',
      rules: 'required',
      componentProps: {
        placeholder: 'Ví dụ: gemini-2.5-flash',
      },
    },
    {
      component: 'Input',
      fieldName: 'apiKey',
      label: 'API Key',
      rules: 'required',
      componentProps: {
        type: 'password',
        placeholder: 'Nhập API key từ Google AI Studio',
      },
    },
    {
      component: 'Textarea',
      fieldName: 'description',
      label: 'Mô tả',
      componentProps: {
        placeholder: 'Mô tả về API key này',
        rows: 3,
      },
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
      label: 'Tên Model',
      componentProps: {
        placeholder: 'Tìm theo tên',
      },
    },
    {
      component: 'Input',
      fieldName: 'model',
      label: 'Model',
      componentProps: {
        placeholder: 'Tìm theo model name',
      },
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
      title: 'Tên',
      width: 200,
    },
    {
      field: 'model',
      title: 'Model',
      width: 180,
    },
    {
      field: 'description',
      title: 'Mô tả',
      minWidth: 200,
    },
    {
      cellRender: {
        attrs: { 
          beforeChange: onStatusChange,
          // CellSwitch hỗ trợ boolean values
          checkedValue: true,
          unCheckedValue: false,
        },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
      },
      field: 'enabled',
      title: 'Status',
      width: 100,
    },
    {
      field: 'usage_count',
      title: 'Số lần dùng',
      width: 120,
    },
    {
      field: 'last_used',
      title: 'Lần cuối dùng',
      width: 180,
      formatter: ({ cellValue }) => {
        if (!cellValue) return '-';
        try {
          const date = new Date(cellValue);
          if (isNaN(date.getTime())) return '-';
          return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        } catch {
          return '-';
        }
      },
    },
    {
      field: 'createdAt',
      title: 'Ngày tạo',
      width: 180,
      formatter: ({ cellValue }) => {
        if (!cellValue) return '-';
        try {
          const date = new Date(cellValue);
          if (isNaN(date.getTime())) return '-';
          return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
        } catch {
          return '-';
        }
      },
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

