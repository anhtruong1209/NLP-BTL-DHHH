<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';
import { onMounted, ref, watch } from 'vue';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

interface Props {
  data?: Array<{ hour: string; count: number }>;
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
      axisTick: {
        show: false,
      },
      boundaryGap: false,
      data: props.data.map(d => d.hour.split(' ')[1] || d.hour), // Extract hour part
      splitLine: {
        lineStyle: {
          type: 'solid',
          width: 1,
        },
        show: true,
      },
      type: 'category',
    },
    yAxis: {
      axisTick: {
        show: false,
      },
      splitNumber: 4,
      type: 'value',
    },
    series: [
      {
        barMaxWidth: 80,
        data: props.data.map(d => d.count),
        itemStyle: {
          color: '#4f69fd',
        },
        name: 'Messages',
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

