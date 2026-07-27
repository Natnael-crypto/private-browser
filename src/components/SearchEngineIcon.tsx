import React from 'react';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { SearchEngine } from '../browser/browserStore';

interface SearchEngineIconProps {
  engine: SearchEngine;
  size?: number;
}

/**
 * Authentic real-world brand icons for all supported search engines:
 * - Google (4-color 'G')
 * - DuckDuckGo (Dax the duck on orange circle)
 * - Brave (Flame orange lion)
 * - Bing (Teal Microsoft Bing 'b' ribbon)
 * - Ecosia (Green sprout & tree)
 */

export function GoogleIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

export function DuckDuckGoIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Orange circle base */}
      <Circle cx="16" cy="16" r="16" fill="#DE5833" />
      {/* White Dax duck body & head */}
      <Path
        fill="#FFFFFF"
        d="M21.5 26.8c-.3-1.6-2.3-5.2-3-6.7s-1.5-3.6-1.2-5c.1-.2.7-.4 1.1-.5.9-.2 1.9.1 2.3-.5.3-.4.2-1.2-.2-1.9-.3-.5-.8-.8-1.4-.9-.2-.3-.6-.6-1.1-.9-.6-.3-1.9-.8-2.6-.9-.5-.1-.6.1-.8.1.2 0 1.1.5 1.3.5-.2.1-.7 0-1 .1-.2.1-.3.4-.3.5.9-.1 2.4 0 3.3.4-.7.1-1.7.2-2.2.4-1.3.7-1.9 2.3-1.5 4.2.3 1.9 1.8 8.8 2.3 11.1.5 2.3-1 3.8-2 4.2l1 .1-.3.7c1.2.1 2.6-.3 2.6-.3-.3.7-2.1 1-2.1 1s.9.3 2.3-.3l2.3-.9.7 1.8 1.3-1.3.5 1.4c0-.1 1-.4.7-1.9z"
      />
      {/* Dax Duck Eye */}
      <Circle cx="14" cy="13.5" r="0.9" fill="#2D4F8E" />
      <Circle cx="14.2" cy="13.3" r="0.3" fill="#FFFFFF" />
      {/* Dax Duck Beak */}
      <Path
        fill="#FDD20A"
        d="M17.5 16.2c.1-.4 1.2-1.3 2-1.3.8 0 1.1 0 1.7-.2.7-.2 2.4-.6 2.9-.8.5-.2 2.5.1 1.1.9-.6.3-2.3 1-3.5 1.3-1.2.4-1.9-.3-2.3.2-.3.5-.1 1.1 1.3 1.2 1.9.2 3.7-.9 3.9-.3.3.5-1.6 1.2-2.7 1.3-1.1 0-3.4-.7-3.7-1-.3-.2-.8-.8-.7-1.3z"
      />
      {/* Dax Green Bow Tie */}
      <Path
        fill="#65BC46"
        d="M17.6 22.8c-2.7-1.4-2.7-.8-.3 3.1l2.5-1.2c-.4-.3-.8-.9-1.1-1.3-.3-.4-.7-.6-1.1-.6zm1.1-.1c1.8-1.4 2.2-1.3.1 3.1l-1.4-.7.8-1.5c.2-.5.3-.9.5-.9z"
      />
      <Circle cx="18" cy="23.3" r="0.7" fill="#43A244" />
    </Svg>
  );
}

export function BraveIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="braveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FB542B" />
          <Stop offset="50%" stopColor="#F04229" />
          <Stop offset="100%" stopColor="#DF3C26" />
        </LinearGradient>
      </Defs>
      {/* Brave Lion Head Silhouette */}
      <Path
        fill="url(#braveGrad)"
        d="M41.8 0l5.6 6.3s4.9-1.4 7.2 1c2.3 2.3 4.2 4.4 4.2 4.4l-1.5 3.7 1.9 5.5s-5.6 21.3-6.3 23.9c-1.3 5.1-2.2 7.1-5.9 9.7-3.7 2.6-10.4 7.1-11.4 7.8-1.1.7-2.5 1.8-3.7 1.8s-2.6-1.2-3.7-1.8c-1.1-.7-7.7-5.2-11.4-7.8-3.7-2.6-4.6-4.6-5.9-9.7-.7-2.6-6.3-23.9-6.3-23.9l1.9-5.5-1.5-3.7s1.9-2.1 4.2-4.4c2.3-2.3 7.2-1 7.2-1L22.2 0h19.6z"
      />
      {/* Brave Lion Inner White Features */}
      <Path
        fill="#FFFFFF"
        d="M32 39.8c-.4 0-2.8.8-4.7 1.8-1.9 1-3.3 1.7-3.8 2-.4.3-.2.8.2 1.1.4.3 5.9 4.5 6.4 5 .5.5 1.3 1.2 1.9 1.2s1.3-.8 1.8-1.2c.5-.5 6-4.7 6.4-5 .4-.3.7-.8.2-1.1-.4-.3-1.8-1-3.8-2-1.9-1-4.3-1.8-4.6-1.8zm0-30.1s-1.1 0-2.7.5c-1.6.5-3.4 1.2-4.2 1.2-.8 0-6.9-1.2-6.9-1.2S11 19.1 11 20.9c0 1.9.9 2.4 1.8 3.3l5.4 5.7c.5.5 1.6 1.4 1 2.8-.6 1.5-1.5 3.4-.5 5.3 1 1.9 2.8 3.2 3.9 3 1.1-.2 3.8-1.6 4.7-2.2 1-.6 4-3.2 4-4.1 0-1-3.2-2.7-3.8-3.1-.6-.4-3.3-1.9-3.3-2.5 0-.6 0-.8.8-2.3.8-1.5 2.2-3.5 2-4.8-.2-1.3-2.5-2-4.2-2.6-1.6-.6-4.8-1.8-5.2-2-.4-.2-.3-.4.9-.5 1.2-.1 4.6-.6 6.1-.1 1.5.4 4.1 1.1 4.3 1.4.2.3.4.4.2 1.5-.2 1.2-1.3 6.9-1.4 7.9-.1 1-.3 1.7.8 1.9 1.1.2 2.9.7 3.5.7s2.5-.4 3.5-.7c1.1-.2.9-1 .8-1.9-.1-1-1.2-6.7-1.4-7.9-.2-1.1 0-1.2.2-1.5.2-.3 2.8-1 4.3-1.4 1.5-.4 4.9 0 6.1.1 1.2.1 1.3.3.9.5-.4.2-3.6 1.4-5.2 2-1.6.6-3.9 1.3-4.2 2.6-.2 1.3 1.2 3.3 2 4.8.8 1.5.8 1.7.8 2.3 0 .6-2.7 2.1-3.3 2.5-.6.4-3.8 2.1-3.8 3.1z"
      />
    </Svg>
  );
}

export function BingIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Microsoft Bing iconic teal ribbon 'b' */}
      <Path
        fill="#008373"
        d="M6.1 0l6.392 2.25v22.5l9.004-5.198-4.414-2.07-2.785-6.932 14.186 4.984v7.246L12.497 32 6.1 28.442z"
      />
      {/* Inner subtle shading overlay */}
      <Path
        fill="#00A290"
        opacity={0.3}
        d="M12.492 2.25v22.5l9.004-5.198-4.414-2.07-2.785-6.932z"
      />
    </Svg>
  );
}

export function EcosiaIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Ecosia vibrant forest green circle */}
      <Circle cx="16" cy="16" r="16" fill="#00A878" />
      {/* Ecosia Crisp White Tree & Sprouting Leaves */}
      <Path
        fill="#FFFFFF"
        d="M16 6c-3.8 0-6.8 2.8-7 6.4-.7.4-1.2 1.1-1.2 2 0 1.1.8 2 1.9 2.1.2 1.8 1.4 3.3 3.1 3.9l-.8 4.6h3.6V20.8c.2 0 .3 0 .4 0s.2 0 .4 0V25h3.6l-.8-4.6c1.7-.6 2.9-2.1 3.1-3.9 1.1-.1 1.9-1 1.9-2.1 0-.9-.5-1.6-1.2-2-.2-3.6-3.2-6.4-7-6.4zm-1.8 3.5c1.1-1.1 2.5-1.1 3.6 0 .4.4.7 1 .8 1.6-1.4-.4-3-.4-4.4 0 .1-.6.4-1.2-.8-1.6z"
      />
      {/* Warm earth accent ground */}
      <Path
        fill="#D4DB34"
        d="M13 25h6c.6 0 1 .4 1 1s-.4 1-1 1h-6c-.6 0-1-.4-1-1s.4-1 1-1z"
        opacity={0.9}
      />
    </Svg>
  );
}

export default function SearchEngineIcon({ engine, size = 22 }: SearchEngineIconProps) {
  switch (engine) {
    case 'Google':
      return <GoogleIcon size={size} />;
    case 'DuckDuckGo':
      return <DuckDuckGoIcon size={size} />;
    case 'Brave':
      return <BraveIcon size={size} />;
    case 'Bing':
      return <BingIcon size={size} />;
    case 'Ecosia':
      return <EcosiaIcon size={size} />;
    default:
      return <GoogleIcon size={size} />;
  }
}
