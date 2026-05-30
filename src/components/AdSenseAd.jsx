import React, { useEffect } from 'react';
import { useAdConfig } from '../contexts/AdConfigContext';

const AdSenseAd = ({ adSlot, adFormat = 'auto', responsive = true, className }) => {
  const { adConfig, loading, error } = useAdConfig();

  useEffect(() => {
    if (!loading && adConfig && window.adsbygoogle) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({
          google_ad_client: "ca-pub-5756320219871523",
          enable_page_level_ads: true,
        });
      } catch (e) {
        console.error("AdSense error: ", e);
      }
    }
  }, [loading, adConfig]);

  if (loading || error || !adConfig) {
    return null; // Don't render ads until config is loaded or if there's an error
  }

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: 'block' }}
      data-ad-client="ca-pub-5756320219871523"
      data-ad-slot={adSlot}
      data-ad-format={adFormat}
      data-full-width-responsive={responsive}
    ></ins>
  );
};

export default AdSenseAd;