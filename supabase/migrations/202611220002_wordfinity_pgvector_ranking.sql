-- Store BGE-M3 vectors in pgvector and rank each target against the full dictionary.
create extension if not exists vector with schema extensions;

alter table public.wordfinity_word_embeddings
  add column if not exists embedding_vector extensions.vector(1024);

create or replace function public.wordfinity_compute_semantic_ranking(
  p_target_word text,
  p_dictionary_sha text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_key text := lower(trim(p_target_word));
  target_embedding extensions.vector(1024);
  total_candidates integer;
  ranked_count integer;
begin
  if target_key = '' or p_dictionary_sha is null or length(p_dictionary_sha) < 16 then
    raise exception 'target_word und dictionary_sha sind erforderlich';
  end if;

  select e.embedding_vector into target_embedding
  from public.wordfinity_word_embeddings e
  where e.word_key = target_key
    and e.dictionary_sha = p_dictionary_sha
    and e.model = '@cf/baai/bge-m3'
    and e.embedding_vector is not null;

  if target_embedding is null then
    raise exception 'Embedding für Zielwort % nicht gefunden', target_key;
  end if;

  select count(*)::integer into total_candidates
  from public.wordfinity_word_embeddings e
  where e.dictionary_sha = p_dictionary_sha
    and e.model = '@cf/baai/bge-m3'
    and e.embedding_vector is not null;

  with ranked as (
    select e.word,
      row_number() over (
        order by (e.embedding_vector OPERATOR(extensions.<=>) target_embedding) asc, e.word_key asc
      )::integer as rank,
      (1 - (e.embedding_vector OPERATOR(extensions.<=>) target_embedding))::double precision as similarity
    from public.wordfinity_word_embeddings e
    where e.dictionary_sha = p_dictionary_sha
      and e.model = '@cf/baai/bge-m3'
      and e.embedding_vector is not null
  ),
  top_rows as (
    select word, rank, similarity from ranked
    where rank <= 750 order by rank
  )
  insert into public.wordfinity_semantic_rankings
    (target_word, category, dictionary_sha, model, candidate_count, rankings, computed_at)
  select target_key,
    coalesce((
      select e.category from public.wordfinity_word_embeddings e
      where e.word_key = target_key
        and e.dictionary_sha = p_dictionary_sha
        and e.model = '@cf/baai/bge-m3'
      limit 1
    ), 'Unbekannt'),
    p_dictionary_sha,
    '@cf/baai/bge-m3',
    total_candidates,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('word', word, 'rank', rank, 'similarity', similarity)
        order by rank
      ) from top_rows
    ), '[]'::jsonb),
    now()
  on conflict (target_word) do update set
    category = excluded.category,
    dictionary_sha = excluded.dictionary_sha,
    model = excluded.model,
    candidate_count = excluded.candidate_count,
    rankings = excluded.rankings,
    computed_at = now();

  select jsonb_array_length(r.rankings) into ranked_count
  from public.wordfinity_semantic_rankings r
  where r.target_word = target_key;

  return jsonb_build_object(
    'target_word', target_key,
    'candidate_count', total_candidates,
    'ranked_count', ranked_count,
    'model', '@cf/baai/bge-m3'
  );
end;
$$;

revoke all on function public.wordfinity_compute_semantic_ranking(text, text) from public, anon, authenticated;
grant execute on function public.wordfinity_compute_semantic_ranking(text, text) to service_role;
