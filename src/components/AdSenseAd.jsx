import React, { useEffect } from 'react';

const AdSenseAd = ({ adSlot, adFormat = 'auto', responsive = true, className }) => {
  useEffect(() => {
    if (window.adsbygoogle) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error("AdSense error: ", e);
      }
    }
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: 'block' }}
      data-ad-client={import.meta.env.VITE_ADMOB_APP_ID}
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive={responsive}
    ></ins>
  );
};

export default AdSenseAd;