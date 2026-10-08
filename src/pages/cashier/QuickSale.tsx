import { POS } from './POS';
import type { Shift } from '@/types';

export function QuickSale({ shift }: { shift: Shift }) {
  return <POS shift={shift} saleType="quick" />;
}
