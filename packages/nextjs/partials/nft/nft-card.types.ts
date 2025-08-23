export type MediaAspect = "1:1" | "3:4" | "16:9";

export interface NFTCardAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface NFTCardProps {
  id: string | number;
  name: string;
  imageUrl: string;
  description?: string;
  owner?: string;
  priceEth?: string | number;
  badgeText?: string;
  mediaAspect?: MediaAspect;
  href?: string;
  onClick?: () => void;
  ctaPrimary?: NFTCardAction;
  ctaSecondary?: NFTCardAction;
  size?: "sm" | "md" | "lg";
  density?: "comfortable" | "compact";
  selectable?: boolean;
  selected?: boolean;
  className?: string;
}
