import { reddit } from '@devvit/web/server';

export const REDDIT_TITLE_MAX = 300;

export function redditTitle(line: string): string {
  const title = line.trim();
  if (title.length <= REDDIT_TITLE_MAX) return title;
  return `${title.slice(0, REDDIT_TITLE_MAX - 1)}…`;
}

export async function submitPartnerPinPost(options: {
  subredditName: string;
  title: string;
  text: string;
}) {
  return reddit.submitPost({
    subredditName: options.subredditName,
    title: redditTitle(options.title),
    text: options.text,
    runAs: 'USER',
  });
}
