import { redirect } from 'next/navigation';

export default function LegacyBranchPage() {
    redirect('/inventory/configurations/location');
}
