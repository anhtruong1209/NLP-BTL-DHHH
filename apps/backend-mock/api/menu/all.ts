import { eventHandler } from 'h3';
import { verifyAccessToken } from '~/utils/jwt-utils';
import { MOCK_MENUS } from '~/utils/mock-data';
import { unAuthorizedResponse, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  const userinfo = await verifyAccessToken(event);
  if (!userinfo) {
    return unAuthorizedResponse(event);
  }

  // Get menus based on username, but filter by roles if needed
  let menus = MOCK_MENUS.find((item) => item.username === userinfo.username)?.menus ?? [];
  
  // Filter menus based on role - remove System menu if not admin (role === 0)
  const isAdmin = (userinfo as any).role === 0;
  if (!isAdmin) {
    menus = menus.filter((menu: any) => {
      // Remove System menu if user is not admin
      if (menu.name === 'System' || menu.path === '/system') {
        return false;
      }
      // Also filter children
      if (menu.children) {
        menu.children = menu.children.filter((child: any) => {
          if (child.path?.startsWith('/system')) {
            return false;
          }
          return true;
        });
      }
      return true;
    });
  }
  
  return useResponseSuccess(menus);
});
