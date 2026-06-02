-- =============================================================================
-- Datadog Database Monitoring - explain plans
-- =============================================================================
-- The Datadog Agent requires the datadog schema and explain function in each
-- monitored database to collect DBM explain plans.

CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;

CREATE OR REPLACE FUNCTION datadog.explain_statement(
   l_query TEXT,
   OUT explain JSON
)
RETURNS SETOF JSON AS
$$
DECLARE
   curs REFCURSOR;
   plan JSON;

BEGIN
   SET TRANSACTION READ ONLY;

   OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
   FETCH curs INTO plan;
   CLOSE curs;
   RETURN QUERY SELECT plan;
END;
$$
LANGUAGE 'plpgsql'
RETURNS NULL ON NULL INPUT
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION datadog.explain_statement(TEXT) TO datadog;

CREATE OR REPLACE FUNCTION datadog.pg_stat_statements()
RETURNS SETOF pg_stat_statements AS
$$
  SELECT * FROM pg_stat_statements;
$$
LANGUAGE sql
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION datadog.pg_stat_statements() TO datadog;

\connect postgres

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;

CREATE OR REPLACE FUNCTION datadog.explain_statement(
   l_query TEXT,
   OUT explain JSON
)
RETURNS SETOF JSON AS
$$
DECLARE
   curs REFCURSOR;
   plan JSON;

BEGIN
   SET TRANSACTION READ ONLY;

   OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
   FETCH curs INTO plan;
   CLOSE curs;
   RETURN QUERY SELECT plan;
END;
$$
LANGUAGE 'plpgsql'
RETURNS NULL ON NULL INPUT
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION datadog.explain_statement(TEXT) TO datadog;

CREATE OR REPLACE FUNCTION datadog.pg_stat_statements()
RETURNS SETOF pg_stat_statements AS
$$
  SELECT * FROM pg_stat_statements;
$$
LANGUAGE sql
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION datadog.pg_stat_statements() TO datadog;
