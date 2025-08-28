export type MediaAspect = "1:1" | "3:4" | "16:9";

export interface NFTCardAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** If true, shows a spinner in the button and disables it. */
  loading?: boolean;
}

export interface NFTCardProps {
  id: string | number;
  name: string;
  imageUrl: string;
  description?: string;
  owner?: string;
  /** Formatted amount to display (e.g., from formatEther). Unit-agnostic. */
  priceAmount?: string | number;
  /** Optional currency/unit label for price, defaults to "TTRUST" in the card if not provided */
  priceUnit?: string;
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
