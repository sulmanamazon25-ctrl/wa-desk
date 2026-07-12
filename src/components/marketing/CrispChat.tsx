"use client";

import * as React from "react";
import Script from "next/script";

export function CrispChat() {
  const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
  if (!websiteId) return null;

  return (
    <Script id="crisp-chat" strategy="afterInteractive">{`
      window.$crisp=[];window.CRISP_WEBSITE_ID="${websiteId}";
      (function(){var d=document,s=d.createElement("script");
      s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();
    `}</Script>
  );
}
