import type { PartnerPin, PartnerPinProfile, PartnerPinSocialLinks } from '../../shared/api';

export type AddPinDraft = {
  lat: number;
  lng: number;
  utrLevel: string;
  locationLabel: string;
  socialLinks: PartnerPinSocialLinks;
};

const emptySocialLinks = (): PartnerPinSocialLinks => ({
  instagram: '',
  x: '',
  facebook: '',
  allcourt: '',
  other: '',
});

function socialLinksToFormValues(links: PartnerPinSocialLinks | undefined): PartnerPinSocialLinks {
  return {
    instagram: links?.instagram ?? '',
    x: links?.x ?? '',
    facebook: links?.facebook ?? '',
    allcourt: links?.allcourt ?? '',
    other: links?.other ?? '',
  };
}

export function createEmptyDraft(lat: number, lng: number): AddPinDraft {
  return {
    lat,
    lng,
    utrLevel: '',
    locationLabel: '',
    socialLinks: emptySocialLinks(),
  };
}

export function createDraftFromPin(
  lat: number,
  lng: number,
  source: PartnerPin | PartnerPinProfile
): AddPinDraft {
  return {
    lat,
    lng,
    utrLevel: source.utrLevel,
    locationLabel: source.locationLabel,
    socialLinks: socialLinksToFormValues(source.socialLinks),
  };
}
