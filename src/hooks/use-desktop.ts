"use client";

import { useEffect, useState } from "react";

/**
 * Must be `false` on the very first client render to match SSR output; otherwise
 * `disabled={!isElectron}` and conditional `onRefreshChats` cause hydration mismatches
 * in Electron (server has no `window.desktop`, first client pass did).
 */
export function useIsElectron() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(!!window.desktop);
  }, []);
  return ready;
}
