import type { RouteRecordRaw } from 'vue-router';

import {
  VBEN_LOGO_URL,
} from '@vben/constants';

import { IFrameView } from '#/layouts';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    meta: {
      badgeType: 'dot',
      icon: VBEN_LOGO_URL,
      order: 9998,
      title: $t('demos.vben.title'),
    },
    name: 'VbenProject',
    path: '/vben-admin',
    children: [
      {
        name: 'Document',
        path: '/document',
        component: IFrameView,
        meta: {
          icon: 'lucide:book-open-text',
          title: $t('demos.vben.document'),
        },
      }
    ],
  },
];

export default routes;
