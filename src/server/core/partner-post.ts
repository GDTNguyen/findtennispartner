import { reddit } from '@devvit/web/server';

export const REDDIT_TITLE_MAX = 300;

export function redditTitle(line: string): string {
  const title = line.trim();
  if (title.length <= REDDIT_TITLE_MAX) return title;
  return `${title.slice(0, REDDIT_TITLE_MAX - 1)}…`;
}

export function friendlyServerPostError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('not approved') && lower.includes('run as user')) {
    return (
      'App version not approved to post as user on mobile. ' +
      'During playtest only the app developer can post from the Reddit app; use reddit.com or publish for review.'
    );
  }
  if (lower.includes('usergeneratedcontent')) {
    return 'Post content could not be submitted as user-generated content.';
  }
  return message;
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
