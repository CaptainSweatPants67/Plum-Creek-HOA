-- Cover the reviewer relationship used by rental review records.
create index rental_agreements_reviewer_idx on public.rental_agreements(reviewed_by);
