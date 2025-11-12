<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';
import { onMounted, ref, watch } from 'vue';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface Props {
  data?: Array<{ userId: string; sessionCount: number }>;
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
          width: 1,
        },
      },
      trigger: 'axis',
    },
    xAxis: {
      data: props.data.map(u => `User ${u.userId}`),
      type: 'category',
    },
    yAxis: {
      max: Math.max(...props.data.map(u => u.sessionCount), 0) * 1.2 || 100,
      splitNumber: 4,
      type: 'value',
    },
    series: [
      {
        barMaxWidth: 80,
        data: props.data.map(u => u.sessionCount),
        itemStyle: {
          color: '#019680',
        },
        name: 'Sessions',
        type: 'bar',
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

