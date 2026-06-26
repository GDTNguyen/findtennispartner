import L from 'leaflet';
import type { PartnerPin, PartnerPinSocialLinks } from '../../shared/api';
import { formatPartnerPinLabel } from '../../shared/api';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function socialLinkRows(links: PartnerPinSocialLinks): string {
  const rows: string[] = [];
  const add = (label: string, href: string | undefined) => {
    if (!href) return;
    const safeHref = escapeHtml(href);
    rows.push(
      `<a class="partner-pin-popup__chip partner-pin-popup__link" href="${safeHref}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    );
  };

  add('Instagram', links.instagram);
  add('X', links.x);
  add('Facebook', links.facebook);
  add('AllCourtPro', links.allcourt);
  add('Link', links.other);

  if (rows.length === 0) return '';
  return `<div class="partner-pin-popup__links">${rows.join('')}</div>`;
}

export function buildPartnerPinPopupHtml(pin: PartnerPin, canDelete: boolean): string {
  const label = formatPartnerPinLabel(pin.utrLevel, pin.locationLabel);
  const postButton = canDelete
    ? `<button type="button" class="partner-pin-popup__post" data-pin-id="${escapeHtml(pin.id)}">Post to subreddit</button>`
    : '';
  const deleteButton = canDelete
    ? `<button type="button" class="partner-pin-popup__delete" data-pin-id="${escapeHtml(pin.id)}">Remove pin</button>`
    : '';

  return `<div class="partner-pin-popup__inner">
<div class="partner-pin-popup__header">
<span class="partner-pin-popup__badge">Looking for partner</span>
<span class="partner-pin-popup__user">u/${escapeHtml(pin.username)}</span>
</div>
<p class="partner-pin-popup__label">${escapeHtml(label)}</p>
${socialLinkRows(pin.socialLinks)}
${postButton || deleteButton ? `<div class="partner-pin-popup__actions">${postButton}${deleteButton}</div>` : ''}
</div>`;
}

export function createPartnerPinIcon(isMine: boolean): L.DivIcon {
  const html = `<div class="partner-pin-marker${isMine ? ' partner-pin-marker--mine' : ''}">
<span class="partner-pin-marker__dot" aria-hidden="true"></span>
<span class="partner-pin-marker__badge">LFP</span>
</div>`;

  return L.divIcon({
    className: 'partner-pin-divicon',
    html,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function createClusterBubbleIcon(count: number): L.DivIcon {
  let bucket = 'sm';
  let size = 44;
  if (count >= 25) {
    bucket = 'lg';
    size = 56;
  } else if (count >= 10) {
    bucket = 'md';
    size = 50;
  }

  const html = `<div class="partner-pin-cluster partner-pin-cluster--${bucket}"><span>${count}</span></div>`;
  return L.divIcon({
    className: 'partner-pin-divicon',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
