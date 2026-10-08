import { redirect } from 'next/navigation';
import { getAuthenticatedUser, isUserAuthorized } from '@/auth/guard';

export const dynamic = 'force-dynamic';

export default async function CostoGananciaPage(props: {
  searchParams?: Promise<{ profileId?: string }>;
}) {
  // 1. Guard obligatorio de servidor: valida sesión activa del usuario
  const user = await getAuthenticatedUser();
  if (!user || !isUserAuthorized(user)) {
    redirect('/login');
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const query = searchParams.profileId ? `?profileId=${searchParams.profileId}` : '';
  redirect(`/fabrica${query}`);
}
