import { Glass, type GlassProps } from './Glass';

export type CardProps = Omit<GlassProps, 'kind'>;

/** Glass card for widgets, sitting on a Sheet (radius 28). */
export function Card(props: CardProps) {
  return <Glass kind="card" {...props} />;
}
