-- UNIPROXITI V14: certificação independente por trilha sem reescrever o histórico V13.
-- Apenas estrutura e funções: o banco de questões permanece privado no Supabase.
-- O currículo anterior, as 16 notas já registradas e o certificado geral continuam intactos.

create table if not exists public.academy_track_exam_questions(
  code text primary key check(code ~ '^tr_[a-z0-9_]{4,70}$'),
  track_id text not null check(track_id ~ '^[a-z][a-z0-9_-]{2,39}$'),
  curriculum_version text not null default '2026-09-v1',
  sort_order integer not null check(sort_order between 1 and 100),
  prompt text not null check(length(btrim(prompt)) between 20 and 1200),
  options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options)=4),
  correct_index integer not null check(correct_index between 0 and 3),
  explanation text not null check(length(btrim(explanation)) between 20 and 1600),
  critical boolean not null default false,
  unique(track_id,curriculum_version,sort_order)
);
create table if not exists public.academy_track_exam_attempts(
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  curriculum_version text not null default '2026-09-v1',
  answers jsonb not null,
  correct_count integer not null check(correct_count between 0 and 10),
  total integer not null check(total=10),
  exam_score numeric(5,2) not null check(exam_score between 0 and 100),
  quiz_average numeric(5,2) not null check(quiz_average between 0 and 100),
  overall_score numeric(5,2) not null check(overall_score between 0 and 100),
  critical_correct boolean not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists academy_track_attempts_owner_idx
 on public.academy_track_exam_attempts(user_id,track_id,created_at desc);
create table if not exists public.academy_track_certificates(
  id uuid primary key default gen_random_uuid(),
  verification_code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  holder_name text not null check(length(btrim(holder_name)) between 3 and 160),
  track_id text not null,
  curriculum_version text not null default '2026-09-v1',
  course_count integer not null check(course_count=2),
  quiz_average numeric(5,2) not null check(quiz_average between 0 and 100),
  exam_score numeric(5,2) not null check(exam_score between 0 and 100),
  overall_score numeric(5,2) not null check(overall_score between 0 and 100),
  exam_attempt_id bigint not null references public.academy_track_exam_attempts(id) on delete restrict,
  issued_at timestamptz not null default now(),
  unique(user_id,track_id,curriculum_version)
);

alter table public.academy_track_exam_questions enable row level security;
alter table public.academy_track_exam_attempts enable row level security;
alter table public.academy_track_certificates enable row level security;
revoke all on public.academy_track_exam_questions,public.academy_track_exam_attempts,
  public.academy_track_certificates from public,anon,authenticated;
grant select on public.academy_track_exam_attempts,public.academy_track_certificates to authenticated;
-- Gabaritos jamais recebem SELECT dos usuários, nem por view.
create policy academy_track_attempt_own on public.academy_track_exam_attempts
 for select to authenticated using(
 user_id=(select auth.uid()) and (public.proxiti_is_admin() or public.proxiti_can('training')));
create policy academy_track_cert_own on public.academy_track_certificates
 for select to authenticated using(
 user_id=(select auth.uid()) and (public.proxiti_is_admin() or public.proxiti_can('training')));

create or replace function public.proxiti_academy_track_questions(p_track text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare finished integer; available integer; payload jsonb;
begin
 if (select auth.uid()) is null or not
    (public.proxiti_is_admin() or public.proxiti_can('training'))
 then raise exception 'Capacitação não autorizada'; end if;
 select count(*) into available from public.academy_courses
  where track_id=p_track and curriculum_version='2026-09-v1' and active;
 if available<>2 then raise exception 'Trilha indisponível'; end if;
 select count(*) into finished from public.academy_courses c
 join public.academy_course_progress p on p.course_id=c.code
  and p.curriculum_version=c.curriculum_version
 where c.track_id=p_track and c.active and c.curriculum_version='2026-09-v1'
  and p.user_id=(select auth.uid()) and p.completed_at is not null;
 if finished<>2 then raise exception 'Conclua as duas aulas desta trilha antes da prova'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'code',q.code,'prompt',q.prompt,'options',q.options,
   'track_id',p_track,'critical',q.critical) order by q.sort_order,q.code),'[]'::jsonb)
 into payload from (
   select code,prompt,options,critical,sort_order from public.academy_questions
    where track_id=p_track and exam and curriculum_version='2026-09-v1'
   union all
   select code,prompt,options,critical,sort_order from public.academy_track_exam_questions
    where track_id=p_track and curriculum_version='2026-09-v1'
 ) q;
 if jsonb_array_length(payload)<>10 then raise exception 'Prova desta trilha em preparação'; end if;
 return payload;
end; $$;
revoke all on function public.proxiti_academy_track_questions(text) from public,anon;
grant execute on function public.proxiti_academy_track_questions(text) to authenticated;

create or replace function public.proxiti_academy_submit_track_exam(
 p_track text,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare available integer; finished integer; quiz_avg numeric(5,2);
 total integer; correct integer; critical_ok boolean;
 exam_score numeric(5,2);final_score numeric(5,2);passed boolean;
 holder text; attempt_id bigint; certificate public.academy_track_certificates%rowtype;
begin
 if (select auth.uid()) is null or not
    (public.proxiti_is_admin() or public.proxiti_can('training'))
 then raise exception 'Capacitação não autorizada'; end if;
 select count(*) into available from public.academy_courses
  where track_id=p_track and curriculum_version='2026-09-v1' and active;
 if available<>2 then raise exception 'Trilha indisponível'; end if;
 select count(*),round(avg(p.best_score),2) into finished,quiz_avg
 from public.academy_courses c join public.academy_course_progress p
  on p.course_id=c.code and p.curriculum_version=c.curriculum_version
 where c.track_id=p_track and c.active and c.curriculum_version='2026-09-v1'
  and p.user_id=(select auth.uid()) and p.completed_at is not null;
 if finished<>2 then raise exception 'Conclua as duas aulas desta trilha antes da prova'; end if;
 if p_answers is null or jsonb_typeof(p_answers)<>'object'
 then raise exception 'Respostas inválidas'; end if;
 with questions as (
   select code,prompt,correct_index,critical from public.academy_questions
     where track_id=p_track and exam and curriculum_version='2026-09-v1'
   union all
   select code,prompt,correct_index,critical from public.academy_track_exam_questions
     where track_id=p_track and curriculum_version='2026-09-v1'
 ) select count(*),
   count(*) filter(where (p_answers->>q.code)::integer=q.correct_index),
   coalesce(bool_and((p_answers->>q.code)::integer=q.correct_index)
     filter(where q.critical),true)
 into total,correct,critical_ok from questions q;
 if total<>10 or (select count(*) from jsonb_object_keys(p_answers))<>total
  or exists(select 1 from jsonb_object_keys(p_answers) a(code)
    where not exists(
      select 1 from public.academy_questions q where q.code=a.code and
        q.track_id=p_track and q.exam and q.curriculum_version='2026-09-v1'
      union all
      select 1 from public.academy_track_exam_questions q where q.code=a.code and
        q.track_id=p_track and q.curriculum_version='2026-09-v1'))
 then raise exception 'Responda às dez questões da trilha'; end if;
 if exists(select 1 from jsonb_each_text(p_answers) a(code,value)
  where value !~ '^[0-3]$')
 then raise exception 'Alternativa inválida'; end if;
 -- Os cálculos acima são repetidos depois da validação para não converter valores inválidos.
 with questions as (
   select code,correct_index,critical from public.academy_questions
     where track_id=p_track and exam and curriculum_version='2026-09-v1'
   union all
   select code,correct_index,critical from public.academy_track_exam_questions
     where track_id=p_track and curriculum_version='2026-09-v1'
 ) select count(*) filter(where (p_answers->>q.code)::integer=q.correct_index),
   coalesce(bool_and((p_answers->>q.code)::integer=q.correct_index)
     filter(where q.critical),true)
 into correct,critical_ok from questions q;
 exam_score:=round(correct*100.0/total,2);
 final_score:=round(quiz_avg*0.60+exam_score*0.40,2);
 passed:=exam_score>=75 and final_score>=80 and critical_ok;
 insert into public.academy_track_exam_attempts(
  user_id,track_id,answers,correct_count,total,exam_score,
  quiz_average,overall_score,critical_correct,passed)
 values((select auth.uid()),p_track,p_answers,correct,total,exam_score,
  quiz_avg,final_score,critical_ok,passed) returning id into attempt_id;
 if passed then
   select nullif(btrim(display_name),'') into holder from public.profiles
    where id=(select auth.uid());
   if holder is null or length(holder)<3 then
    raise exception 'Defina seu nome completo no Perfil antes de emitir o certificado'; end if;
   insert into public.academy_track_certificates(
    verification_code,user_id,holder_name,track_id,course_count,
    quiz_average,exam_score,overall_score,exam_attempt_id)
   values('PXI-TRI-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
    (select auth.uid()),holder,p_track,2,quiz_avg,exam_score,final_score,attempt_id)
   on conflict(user_id,track_id,curriculum_version) do nothing;
   select * into certificate from public.academy_track_certificates
    where user_id=(select auth.uid()) and track_id=p_track
      and curriculum_version='2026-09-v1';
 end if;
 return jsonb_build_object(
  'score',exam_score,'quiz_average',quiz_avg,'overall_score',final_score,
  'correct',correct,'total',total,'critical_correct',critical_ok,
  'passed',passed,'certificate',case when certificate.id is not null then
    jsonb_build_object('id',certificate.id,'code',certificate.verification_code,
      'name',certificate.holder_name,'track_id',certificate.track_id,
      'issued_at',certificate.issued_at,'score',certificate.overall_score)
  else null end);
end; $$;
revoke all on function public.proxiti_academy_submit_track_exam(text,jsonb) from public,anon;
grant execute on function public.proxiti_academy_submit_track_exam(text,jsonb) to authenticated;

create or replace function public.proxiti_academy_verify_track_certificate(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare found boolean;
begin
 if p_code is null or length(p_code)>64 then return jsonb_build_object('valid',false);end if;
 select exists(select 1 from public.academy_track_certificates
  where verification_code=p_code) into found;
 return jsonb_build_object('valid',found,'type','interno','issuer','PROXITI');
end; $$;
revoke all on function public.proxiti_academy_verify_track_certificate(text) from public,anon;
grant execute on function public.proxiti_academy_verify_track_certificate(text) to authenticated;
