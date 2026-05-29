-- STACK Service Desk DB initialization
-- Creates pgvector extension and sets up initial configuration

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE stack_db TO stack;
