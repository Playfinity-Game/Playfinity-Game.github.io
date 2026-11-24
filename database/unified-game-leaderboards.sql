-- Unified per-game PLAYFINITY leaderboards.
-- Apply once to the Supabase project vfandcnxeiuakxmjewmr.

create unique index if not exists playfinity_game_scores_event_award_uq
on public.playfinity_game_scores (game_key, player_key, (metadata->>'event_id'), (metadata->>'award_key'))
where metadata ? 'event_id' and metadata ? 'award_key';

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='playfinity_game_scores'
      and policyname='Public can submit supported game scores'
  ) then
    create policy "Public can submit supported game scores"
    on public.playfinity_game_scores
    for insert to anon, authenticated
    with check (
      game_key in ('playdoku','wordfinity','guesswhat','guessmoji','fivex')
      and points in (1,3,10)
      and char_length(trim(player_key)) between 1 and 80
      and char_length(trim(display_name)) between 1 and 40
      and metadata ? 'event_id'
      and metadata ? 'award_key'
      and char_length(metadata->>'event_id') between 1 and 100
      and char_length(metadata->>'award_key') between 1 and 32
      and ((game_key='guessmoji' and points=10) or (game_key<>'guessmoji' and points in (1,3)))
    );
  end if;
end $$;

create or replace function public.award_game_points(
  p_game_key text,
  p_player_key text,
  p_display_name text,
  p_points integer,
  p_event_id text,
  p_award_key text
) returns boolean
language plpgsql
security invoker
set search_path = public
as $function$
declare
  clean_game text := lower(trim(p_game_key));
  clean_player text := left(lower(trim(p_player_key)),80);
  clean_name text := left(trim(p_display_name),40);
  clean_event text := left(trim(p_event_id),100);
  clean_award text := left(trim(p_award_key),32);
begin
  if clean_game not in ('playdoku','wordfinity','guesswhat','guessmoji','fivex')
     or clean_player is null or clean_player = '' or clean_player in ('unknown','local-player')
     or clean_name is null or clean_name = ''
     or clean_event is null or clean_event = ''
     or clean_award is null or clean_award = ''
     or not (
       (clean_game='guessmoji' and p_points=10)
       or (clean_game<>'guessmoji' and p_points in (1,3))
     ) then
    return false;
  end if;

  insert into public.playfinity_game_scores
    (game_key, player_key, display_name, score, points, metadata)
  values
    (clean_game, clean_player, clean_name, p_points, p_points,
     jsonb_build_object('event_id',clean_event,'round_id',clean_event,'award_key',clean_award))
  on conflict do nothing;

  return found;
end;
$function$;

create or replace function public.get_game_leaderboard(
  p_game_key text,
  p_period text default 'all'
) returns table(player_key text, display_name text, points bigint)
language sql
stable
security invoker
set search_path = public
as $function$
  select s.player_key,
         (array_agg(s.display_name order by s.created_at desc))[1] as display_name,
         sum(s.points)::bigint as points
  from public.playfinity_game_scores s
  where s.game_key = lower(trim(p_game_key))
    and p_game_key in ('playdoku','wordfinity','guesswhat','guessmoji','fivex')
    and (
      p_period = 'all'
      or (p_period = 'last24hours' and s.created_at >= now() - interval '24 hours')
      or (p_period = 'weekly' and s.created_at >= (date_trunc('week', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin'))
    )
  group by s.player_key
  order by sum(s.points) desc, s.player_key asc
  limit 10;
$function$;

grant execute on function public.award_game_points(text,text,text,integer,text,text) to anon, authenticated;
grant execute on function public.get_game_leaderboard(text,text) to anon, authenticated;
