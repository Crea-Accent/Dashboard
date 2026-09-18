import { NotPermitted } from '@/providers/PermissionsProvider';

export default function StockLayout({ children }: { children: React.ReactNode }) {
	return <NotPermitted permission="stock.read">{children}</NotPermitted>;
}
