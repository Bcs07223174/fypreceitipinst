import type { UserProfile } from '../styles/types';
import { ReceptionistLayout } from '../src/modules/receptionist/layout/ReceptionistLayout';

interface LayoutProps {
  profile: UserProfile | null;
}

export default function Layout({ profile }: LayoutProps) {
  return <ReceptionistLayout profile={profile} />;
}
