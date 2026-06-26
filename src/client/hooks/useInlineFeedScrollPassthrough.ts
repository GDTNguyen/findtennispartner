import { useEffect } from 'react';
import { installInlineFeedScrollPassthrough } from '../lib/inline-feed-scroll-passthrough';

export function useInlineFeedScrollPassthrough() {
  useEffect(() => installInlineFeedScrollPassthrough(), []);
}
