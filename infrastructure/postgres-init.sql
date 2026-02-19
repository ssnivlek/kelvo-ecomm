-- ================================================================
-- PostgreSQL init script for Datadog DBM (Database Monitoring)
-- ================================================================
-- Runs once when the PostgreSQL container is first created.
-- Creates the 'datadog' user with pg_monitor permissions needed
-- for Datadog Database Monitoring to collect query metrics,
-- explain plans, and database health data.
--
-- Mounted into Docker: /docker-entrypoint-initdb.d/
-- On RDS: run manually via psql or include in deploy-aws.sh
-- ================================================================

-- Create read-only monitoring user for Datadog Agent
CREATE USER datadog WITH PASSWORD 'datadog';

-- pg_monitor grants read access to pg_stat_*, pg_locks, etc.
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;

-- Schema for Datadog explain plans (required for DBM query samples)
CREATE SCHEMA IF NOT EXISTS datadog;
GRANT USAGE ON SCHEMA datadog TO datadog;
GRANT USAGE ON SCHEMA public TO datadog;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datadog;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datadog;

-- Function for explain plans (Datadog DBM uses this to collect query plans)
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
    OPEN curs FOR EXECUTE pg_catalog.concat('EXPLAIN (FORMAT JSON) ', l_query);
    FETCH curs INTO plan;
    CLOSE curs;
    RETURN QUERY SELECT plan;
END;
$$
LANGUAGE 'plpgsql'
RETURNS NULL ON NULL INPUT
SECURITY DEFINER;
