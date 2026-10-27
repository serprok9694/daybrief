import { Glass, type GlassProps } from './Glass';

export type SheetProps = Omit<GlassProps, 'kind'>;

/** The large glass panel (radius 40, 32 on mobile). Padding and gap are up to the screen. */
export function Sheet(props: SheetProps) {
  return <Glass kind="sheet" {...props} />;
}
