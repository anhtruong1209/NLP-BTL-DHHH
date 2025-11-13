<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';
import { onMounted, ref, watch } from 'vue';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { $t } from '#/locales';

interface Props {
  data?: Array<{ date: string; avgResponseTime: number; count: number }>;
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
});

const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function updateChart() {
  if (!chartRef.value || !props.data || props.data.length === 0) return;

  renderEcharts({
    grid: {
      bottom: 0,
      containLabel: true,
      left: '1%',
      right: '1%',
      top: '2%',
    },
    tooltip: {
      axisPointer: {
        lineStyle: {
          color: '#019680',
          width: 1,
        },
      },
      trigger: 'axis',
    },
    xAxis: {
      axisTick: {
        show: false,
      },
      boundaryGap: false,
      data: props.data.map(d => d.date),
      splitLine: {
        lineStyle: {
          type: 'solid',
          width: 1,
        },
        show: true,
      },
      type: 'category',
    },
    yAxis: [
      {
        axisTick: {
          show: false,
        },
        name: 'Response Time (ms)',
        splitArea: {
          show: true,
        },
        splitNumber: 4,
        type: 'value',
      },
    ],
    series: [
      {
        areaStyle: {},
        data: props.data.map(d => d.avgResponseTime),
        itemStyle: {
          color: '#019680',
        },
        name: $t('dashboard.analytics.avgResponseTime'),
        smooth: true,
        type: 'line',
      },
    ],
  });
}

watch(() => props.data, updateChart, { deep: true });

onMounted(() => {
  updateChart();
});
</script>

<template>
  <EchartsUI ref="chartRef" />
</template>

