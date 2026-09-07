export function isMobileOrTablet(
  ua = navigator.userAgent,
  platform = navigator.platform,
  maxTouchPoints = navigator.maxTouchPoints,
) {
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Silk|Kindle/i.test(ua);
  const ipadDesktopUA = platform === 'MacIntel' && maxTouchPoints > 1;
  return mobileUA || ipadDesktopUA;
}
