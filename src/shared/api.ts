export type PartnerPinSocialLinks = {
  instagram?: string;
  x?: string;
  facebook?: string;
  allcourt?: string;
  other?: string;
};

export type PartnerPinProfile = {
  utrLevel: string;
  locationLabel: string;
  socialLinks: PartnerPinSocialLinks;
  lastLat?: number;
  lastLng?: number;
};

export type PartnerPin = {
  id: string;
  lat: number;
  lng: number;
  utrLevel: string;
  locationLabel: string;
  socialLinks: PartnerPinSocialLinks;
  username: string;
  createdAt: string;
};

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string;
  pins: PartnerPin[];
  pinProfile: PartnerPinProfile | null;
};

export type CreatePinRequest = {
  lat: number;
  lng: number;
  utrLevel: string;
  locationLabel: string;
  socialLinks: PartnerPinSocialLinks;
};

export type CreatePinResponse = {
  type: 'create-pin';
  pin: PartnerPin;
  pins: PartnerPin[];
  pinProfile: PartnerPinProfile;
};

export type DeletePinResponse = {
  type: 'delete-pin';
  pins: PartnerPin[];
};

export type CreatePartnerPostResponse = {
  type: 'post-created';
  postId: string;
  pinId: string;
};

export function formatPartnerPinLabel(utrLevel: string, locationLabel: string): string {
  return `[${utrLevel.trim()}, ${locationLabel.trim()}]`;
}

export function buildPartnerPostTitle(pin: PartnerPin): string {
  return formatPartnerPinLabel(pin.utrLevel, pin.locationLabel);
}

function socialLinkLines(links: PartnerPinSocialLinks): string[] {
  const rows: string[] = [];
  const add = (label: string, href: string | undefined) => {
    if (!href) return;
    rows.push(`- ${label}: ${href}`);
  };
  add('Instagram', links.instagram);
  add('X', links.x);
  add('Facebook', links.facebook);
  add('AllCourtPro', links.allcourt);
  add('Profile', links.other);
  return rows;
}

export function buildPartnerPostBody(pin: PartnerPin): string {
  const label = formatPartnerPinLabel(pin.utrLevel, pin.locationLabel);
  const links = socialLinkLines(pin.socialLinks);
  const linkBlock = links.length > 0 ? `\n\n**Links**\n${links.join('\n')}` : '';

  return `**${label}**

Fill in whatever applies — delete the rest:

- **When I'm free:** (e.g. weekday mornings, weekends)
- **Pace / level I'm looking for:** (e.g. rallying, match play, drills)
- **Singles or doubles:**
- **Indoor or outdoor:**
- **How long I like to hit:**
- **Best way to contact me:**${linkBlock}`;
}
