-- Mémoire collective : les numéros de téléphone, courriels et photos signalés avertissent les utilisateurs suivants.
-- Confidentialité (Loi 25) : les numéros et courriels de l'annonceur ne sont jamais conservés en clair,
-- seulement une empreinte SHA-256 ; les photos, seulement une empreinte visuelle (dHash 64 bits), non réversible.
-- Seuls les comptes à l'identité confirmée peuvent signaler (comme pour les liens).

create table if not exists public.signalements_cles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('tel', 'courriel', 'photo')),
  cle text not null,
  motif text not null,
  created_at timestamptz not null default now(),
  unique (user_id, type, cle)
);
create index if not exists signalements_cles_type_cle_idx on public.signalements_cles (type, cle);
alter table public.signalements_cles enable row level security;
revoke all on public.signalements_cles from anon, authenticated;

-- Empreinte d'un numéro (10 derniers chiffres) ou d'un courriel (minuscules). Null si invalide.
create or replace function public.empreinte_contact(p_type text, p_valeur text)
 returns text language plpgsql immutable set search_path to ''
as $function$
declare v text;
begin
  if p_type = 'tel' then
    v := regexp_replace(coalesce(p_valeur, ''), '\D', '', 'g');
    if length(v) < 10 then return null; end if;
    v := right(v, 10);
  elsif p_type = 'courriel' then
    v := lower(trim(coalesce(p_valeur, '')));
    if v !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then return null; end if;
  else
    return null;
  end if;
  return encode(extensions.digest('habitascan|' || p_type || '|' || v, 'sha256'), 'hex');
end $function$;

-- Signaler les numéros, courriels et photos d'une annonce (le lien reste dans la table signalements).
create or replace function public.signaler_cles(p_motif text, p_tels text[], p_courriels text[], p_photos text[])
 returns integer language plpgsql security definer set search_path to ''
as $function$
declare uid uuid := auth.uid(); n integer := 0; x text; e text; k integer;
begin
  if uid is null then raise exception 'session'; end if;
  if public.est_suspendu() then raise exception 'compte suspendu'; end if;
  if not exists (select 1 from public.profiles where id = uid and identite_statut = 'confirmee') then
    raise exception 'identite non confirmee';
  end if;
  if p_motif not in ('argent_avant_bail','faux_proprietaire','logement_inexistant','photos_volees','autre') then
    raise exception 'motif invalide';
  end if;
  if (select count(*) from public.signalements_cles where user_id = uid and created_at > now() - interval '1 day') > 60 then
    raise exception 'trop de signalements';
  end if;
  foreach x in array coalesce(p_tels[1:5], '{}') loop
    e := public.empreinte_contact('tel', x);
    if e is not null then
      insert into public.signalements_cles (user_id, type, cle, motif) values (uid, 'tel', e, p_motif) on conflict do nothing;
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  foreach x in array coalesce(p_courriels[1:5], '{}') loop
    e := public.empreinte_contact('courriel', x);
    if e is not null then
      insert into public.signalements_cles (user_id, type, cle, motif) values (uid, 'courriel', e, p_motif) on conflict do nothing;
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  foreach x in array coalesce(p_photos[1:8], '{}') loop
    if x ~ '^[0-9a-f]{16}$' and x <> '0000000000000000' and x <> 'ffffffffffffffff' then
      insert into public.signalements_cles (user_id, type, cle, motif) values (uid, 'photo', x, p_motif) on conflict do nothing;
      get diagnostics k = row_count; n := n + k;
    end if;
  end loop;
  return n;
end $function$;

-- Combien de personnes (distinctes) ont signalé ces numéros, courriels et photos.
-- Photos : même image si l'empreinte diffère d'au plus 6 bits sur 64.
create or replace function public.memoire_collective(p_tels text[], p_courriels text[], p_photos text[])
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare tels jsonb := '[]'; courriels jsonb := '[]'; photo integer := 0; x text; e text; c integer;
begin
  if auth.uid() is null then return null; end if;
  foreach x in array coalesce(p_tels[1:5], '{}') loop
    e := public.empreinte_contact('tel', x);
    select count(distinct user_id) into c from public.signalements_cles where type = 'tel' and cle = e;
    tels := tels || to_jsonb(coalesce(c, 0));
  end loop;
  foreach x in array coalesce(p_courriels[1:5], '{}') loop
    e := public.empreinte_contact('courriel', x);
    select count(distinct user_id) into c from public.signalements_cles where type = 'courriel' and cle = e;
    courriels := courriels || to_jsonb(coalesce(c, 0));
  end loop;
  foreach x in array coalesce(p_photos[1:8], '{}') loop
    if x ~ '^[0-9a-f]{16}$' then
      select count(distinct user_id) into c from public.signalements_cles
       where type = 'photo' and bit_count(('x' || cle)::bit(64) # ('x' || x)::bit(64)) <= 6;
      photo := greatest(photo, coalesce(c, 0));
    end if;
  end loop;
  return jsonb_build_object('tels', tels, 'courriels', courriels, 'photo', photo);
end $function$;

-- Console admin : voir et retirer les signalements de numéros, courriels et photos.
create or replace function public.admin_signalements_cles()
 returns table(type text, cle text, nb bigint, motifs text[], dernier timestamptz)
 language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  return query
    select s.type, s.cle, count(distinct s.user_id), array_agg(distinct s.motif), max(s.created_at)
    from public.signalements_cles s group by s.type, s.cle order by 5 desc limit 300;
end $function$;

create or replace function public.admin_retirer_cle(p_type text, p_cle text)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.est_admin() then raise exception 'reserve aux admins'; end if;
  delete from public.signalements_cles where type = p_type and cle = p_cle;
  perform public.journaliser('retirer_signalement_' || p_type, left(p_cle, 12), null);
end $function$;

revoke all on function public.signaler_cles(text, text[], text[], text[]) from public, anon;
revoke all on function public.memoire_collective(text[], text[], text[]) from public, anon;
revoke all on function public.admin_signalements_cles() from public, anon;
revoke all on function public.admin_retirer_cle(text, text) from public, anon;
grant execute on function public.signaler_cles(text, text[], text[], text[]) to authenticated;
grant execute on function public.memoire_collective(text[], text[], text[]) to authenticated;
grant execute on function public.admin_signalements_cles() to authenticated;
grant execute on function public.admin_retirer_cle(text, text) to authenticated;
